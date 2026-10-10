import { Request, Response } from 'express';
import { db } from '../db';
import { AuthRequest } from '../auth';
import { PaymentService, PaymentManager } from '../services/paymentService';
import { TokenService } from '../services/tokenService';
import { generateEntryPassPDF } from '../services/pdfService';
import { MailService } from '../services/mailService';
import { PaymentStatus, RegistrationStatus, Registration, PaymentTransaction } from '../../src/types';

/**
 * PaymentController
 * Handles manual payment submissions from registrants and provides administrative
 * review methods to update registration and payment statuses.
 */
export class PaymentController {
  /**
   * Method to store manual payment details submitted by a registrant (bKash, Nagad, etc.).
   * Validates required details, checks for duplicate TrxIDs, records payment transaction,
   * updates the registration status to 'payment_submitted', and prepares for admin audit.
   */
  static async storeManualPayment(req: Request, res: Response): Promise<void> {
    try {
      const regId = req.params.id || req.body.registration_id || req.body.token_code || req.body.id;
      const tokenCode = req.body.token_code;
      const gateway = req.body.gateway || req.body.payment_method || 'bkash';
      const transactionId = req.body.transaction_id || req.body.trx_id;
      const senderNumber = req.body.sender_number || req.body.sender_mobile;
      const amount =
        req.body.amount !== undefined && req.body.amount !== ''
          ? Number(req.body.amount)
          : req.body.paid_amount !== undefined && req.body.paid_amount !== ''
          ? Number(req.body.paid_amount)
          : undefined;
      const notes = req.body.notes;

      // Validation
      if (!regId && !tokenCode) {
        res.status(400).json({
          success: false,
          message: 'Registration ID or Token Number is required to store manual payment details.',
        });
        return;
      }

      if (!transactionId || typeof transactionId !== 'string' || !transactionId.trim()) {
        res.status(400).json({
          success: false,
          message: 'Please enter a valid Transaction ID (TrxID) from your bKash or Nagad SMS receipt.',
        });
        return;
      }

      if (!senderNumber || typeof senderNumber !== 'string' || !senderNumber.trim()) {
        res.status(400).json({
          success: false,
          message: 'Please provide the sender mobile number used to complete the payment.',
        });
        return;
      }

      const result = await PaymentService.submitManualPayment({
        registration_id: regId,
        token_code: tokenCode,
        gateway,
        transaction_id: transactionId,
        sender_number: senderNumber,
        amount,
        notes,
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error('PaymentController.storeManualPayment error:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Payment confirmation submission failed.',
      });
    }
  }

  /**
   * Separate admin method to update the registration and payment status after review.
   * Allows administrators to approve, reject, or set payment into 'under_review' status.
   * If approved ('paid' or 'verified'), the entry token is activated and registration is confirmed.
   * If rejected ('rejected'), reason and administrative notes are stored and token remains pending.
   */
  static async updatePaymentStatusAfterReview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const regId = req.params.id || req.body.registration_id || req.body.id || req.body.token_code;
      const targetPaymentStatus: PaymentStatus = req.body.payment_status || req.body.status;
      const targetRegistrationStatus: RegistrationStatus | undefined = req.body.registration_status;
      const adminNotes = req.body.admin_notes || req.body.notes || req.body.reason || '';
      const correctedTrxId = req.body.transaction_id || req.body.trx_id;
      const verifiedAmount =
        req.body.amount !== undefined && req.body.amount !== ''
          ? Number(req.body.amount)
          : req.body.paid_amount !== undefined && req.body.paid_amount !== ''
          ? Number(req.body.paid_amount)
          : undefined;

      const adminUser = req.user || {
        name: req.body.admin_name || 'Admin',
        email: req.body.admin_email || 'admin@nanupuralumni.org',
      };

      if (!regId) {
        res.status(400).json({
          success: false,
          message: 'Registration ID or Token Number is required.',
        });
        return;
      }

      if (!targetPaymentStatus) {
        res.status(400).json({
          success: false,
          message: 'Target payment status is required (e.g. "paid", "rejected", "under_review", "pending").',
        });
        return;
      }

      const registrations = db.get('registrations') || [];
      const regIndex = registrations.findIndex(
        r => r.id === regId || (r.token_code && r.token_code.toUpperCase() === String(regId).toUpperCase())
      );

      if (regIndex === -1) {
        res.status(404).json({
          success: false,
          message: `Registration record not found for "${regId}".`,
        });
        return;
      }

      const reg = registrations[regIndex];
      const nowIso = new Date().toISOString();
      const payments = db.get('payments') || [];
      const txIndex = payments.findIndex(p => p.registration_id === reg.id);
      let paymentTx: PaymentTransaction | null = txIndex !== -1 ? payments[txIndex] : null;
      let issuedToken = null;
      let emailResult: any = null;

      // Allow admin to update or correct transaction ID and paid amount if provided
      if (correctedTrxId && typeof correctedTrxId === 'string' && correctedTrxId.trim()) {
        reg.transaction_id = correctedTrxId.trim().toUpperCase();
      }
      if (verifiedAmount !== undefined && !isNaN(verifiedAmount)) {
        reg.paid_amount = verifiedAmount;
      }
      if (req.body.sender_number) {
        reg.sender_number = String(req.body.sender_number).trim();
      }

      // Handle the review outcome
      if (targetPaymentStatus === 'paid' || targetPaymentStatus === 'verified') {
        // 1. APPROVE / VERIFY PAYMENT
        reg.payment_status = 'paid';
        reg.registration_status = targetRegistrationStatus || 'confirmed';
        reg.payment_verified_at = nowIso;
        reg.verified_by = adminUser.name || 'Admin';
        reg.admin_notes = adminNotes || 'Payment verified after administrative review';
        reg.updated_at = nowIso;

        // Activate or generate official entry token
        issuedToken = await TokenService.issueToken(reg, 'active');
        reg.token_id = issuedToken.id;
        reg.token_code = issuedToken.token_code;
        reg.qr_code_svg = issuedToken.qr_code_svg;

        // Update payment transaction record
        if (paymentTx) {
          paymentTx.status = 'paid';
          paymentTx.verified_at = nowIso;
          paymentTx.verified_by = adminUser.name;
          if (correctedTrxId) paymentTx.transaction_id = reg.transaction_id;
          if (verifiedAmount !== undefined) paymentTx.amount = verifiedAmount;
          if (adminNotes) paymentTx.notes = adminNotes;
          payments[txIndex] = paymentTx;
        } else {
          paymentTx = {
            id: `pay-${Date.now()}`,
            registration_id: reg.id,
            transaction_id: reg.transaction_id || `MANUAL-${Date.now()}`,
            gateway: (reg.payment_method || 'bkash').toLowerCase().includes('nagad') ? 'nagad' : 'bkash',
            method: reg.payment_method || 'Manual Payment Verified',
            amount: verifiedAmount || reg.paid_amount || reg.fee_amount || 1000,
            currency: reg.currency || 'BDT',
            status: 'paid',
            sender_mobile: reg.sender_number || reg.phone,
            token_code: reg.token_code,
            verified_at: nowIso,
            verified_by: adminUser.name,
            notes: adminNotes || undefined,
            created_at: nowIso,
          };
          payments.push(paymentTx);
        }

        // Ensure token in tokens collection is marked active
        const tokens = db.get('tokens') || [];
        const tokIndex = tokens.findIndex(t => t.id === issuedToken?.id || t.token_code === issuedToken?.token_code);
        if (tokIndex !== -1) {
          tokens[tokIndex].status = 'active';
          db.set('tokens', tokens);
        }

        // Generate official registration pass PDF and automatically email to registrant
        if (reg.email && reg.email.includes('@')) {
          try {
            const gates = db.get('gates') || [];
            const activeGates = gates.filter((g: any) => g.is_active).sort((a: any, b: any) => a.display_order - b.display_order);
            let gateName = activeGates[0]?.gate_name || 'Gate 01 - Main Gate (VIP, Alumni & Delegates)';
            if (reg.passing_year && activeGates.length > 1) {
              const year = Number(reg.passing_year);
              if (year <= 1990 && activeGates[1]) gateName = activeGates[1].gate_name;
              else if (year <= 2010 && activeGates[2]) gateName = activeGates[2].gate_name;
              else if (activeGates[3]) gateName = activeGates[3].gate_name;
            }

            const pdfBuffer = await generateEntryPassPDF({
              tokenCode: reg.token_code,
              fullName: reg.full_name,
              batchName: reg.batch_name || issuedToken?.batch_name || 'Alumni Batch',
              batchNameBn: reg.batch_name_bn || issuedToken?.batch_name_bn,
              passingYear: reg.passing_year,
              registrationId: reg.id,
              bloodGroup: reg.blood_group,
              tShirtSize: reg.t_shirt_size || undefined,
              occupation: reg.occupation,
              phone: reg.phone,
              eventDate: 'Saturday, 16 January 2027 • 08:00 AM onwards',
              venue: 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram',
              gateName,
              status: 'paid',
            });

            emailResult = await MailService.sendRegistrationConfirmationEmail(reg, issuedToken, pdfBuffer);
          } catch (pdfErr: any) {
            console.error('Failed to generate PDF pass or send confirmation email:', pdfErr);
            emailResult = { success: false, error: pdfErr.message };
          }
        }

        // Audit log
        const auditLogs = db.get('audit_logs') || [];
        auditLogs.push({
          id: `log-${Date.now()}`,
          user_name: adminUser.name,
          user_email: adminUser.email || 'admin@nanupuralumni.org',
          action: 'PAYMENT_VERIFIED',
          entity: 'Payment',
          details: `Admin ${adminUser.name} approved and verified payment for ${reg.full_name} (${reg.id}). Token ${reg.token_code} activated. Automated PDF Pass email ${emailResult?.success ? 'dispatched' : 'skipped/failed'}. Notes: ${adminNotes || 'N/A'}`,
          ip: req.ip || '127.0.0.1',
          created_at: nowIso,
        });
        db.set('audit_logs', auditLogs);

      } else if (targetPaymentStatus === 'rejected') {
        // 2. REJECT PAYMENT
        reg.payment_status = 'rejected';
        reg.registration_status = targetRegistrationStatus || 'pending';
        reg.payment_rejected_at = nowIso;
        reg.rejected_by = adminUser.name || 'Admin';
        reg.admin_notes = adminNotes || 'Payment rejected: Invalid or unverified transaction details';
        reg.updated_at = nowIso;

        if (paymentTx) {
          paymentTx.status = 'rejected';
          paymentTx.failure_reason = adminNotes || 'Payment rejected: Transaction details unverified';
          payments[txIndex] = paymentTx;
        }

        // Keep entry token in pending_payment status
        const tokens = db.get('tokens') || [];
        const tokIndex = tokens.findIndex(t => t.registration_id === reg.id || t.token_code === reg.token_code);
        if (tokIndex !== -1) {
          tokens[tokIndex].status = 'pending_payment';
          db.set('tokens', tokens);
        }

        // Audit log
        const auditLogs = db.get('audit_logs') || [];
        auditLogs.push({
          id: `log-${Date.now()}`,
          user_name: adminUser.name,
          user_email: adminUser.email || 'admin@nanupuralumni.org',
          action: 'PAYMENT_REJECTED',
          entity: 'Payment',
          details: `Admin ${adminUser.name} rejected payment for ${reg.full_name} (${reg.id}). Reason: ${adminNotes || 'Unverified transaction'}`,
          ip: req.ip || '127.0.0.1',
          created_at: nowIso,
        });
        db.set('audit_logs', auditLogs);

      } else {
        // 3. OTHER STATUSES: 'under_review', 'pending', 'cancelled', 'failed', 'refunded'
        reg.payment_status = targetPaymentStatus;
        if (targetRegistrationStatus) {
          reg.registration_status = targetRegistrationStatus;
        }
        if (adminNotes) {
          reg.admin_notes = adminNotes;
        }
        reg.updated_at = nowIso;

        if (paymentTx) {
          paymentTx.status = targetPaymentStatus;
          if (adminNotes) paymentTx.notes = adminNotes;
          payments[txIndex] = paymentTx;
        }

        // If under_review or pending, ensure token is in pending_payment status
        const tokens = db.get('tokens') || [];
        const tokIndex = tokens.findIndex(t => t.registration_id === reg.id || t.token_code === reg.token_code);
        if (tokIndex !== -1 && tokens[tokIndex].status !== 'active') {
          tokens[tokIndex].status = 'pending_payment';
          db.set('tokens', tokens);
        }

        const auditLogs = db.get('audit_logs') || [];
        auditLogs.push({
          id: `log-${Date.now()}`,
          user_name: adminUser.name,
          user_email: adminUser.email || 'admin@nanupuralumni.org',
          action: 'PAYMENT_STATUS_UPDATED',
          entity: 'Payment',
          details: `Admin ${adminUser.name} updated payment status to "${targetPaymentStatus}" for ${reg.full_name} (${reg.id}). Notes: ${adminNotes || 'N/A'}`,
          ip: req.ip || '127.0.0.1',
          created_at: nowIso,
        });
        db.set('audit_logs', auditLogs);
      }

      // Persist updated records
      registrations[regIndex] = reg;
      db.set('registrations', registrations);
      db.set('payments', payments);

      res.status(200).json({
        success: true,
        message: `Payment status successfully updated to "${targetPaymentStatus}" for ${reg.full_name}.`,
        registration: reg,
        transaction: paymentTx,
        token: issuedToken || undefined,
        email_delivery: emailResult || undefined,
      });
    } catch (err: any) {
      console.error('PaymentController.updatePaymentStatusAfterReview error:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to update payment status after review.',
      });
    }
  }

  /**
   * Admin convenience method to verify and approve manual payment.
   * Delegates to updatePaymentStatusAfterReview with payment_status: 'paid'.
   */
  static async verifyManualPayment(req: AuthRequest, res: Response): Promise<void> {
    req.body = {
      ...req.body,
      payment_status: 'paid',
      registration_status: req.body.registration_status || 'confirmed',
    };
    return PaymentController.updatePaymentStatusAfterReview(req, res);
  }

  /**
   * Admin convenience method to reject manual payment.
   * Delegates to updatePaymentStatusAfterReview with payment_status: 'rejected'.
   */
  static async rejectManualPayment(req: AuthRequest, res: Response): Promise<void> {
    req.body = {
      ...req.body,
      payment_status: 'rejected',
      registration_status: req.body.registration_status || 'pending',
    };
    return PaymentController.updatePaymentStatusAfterReview(req, res);
  }

  /**
   * Get public payment gateways for registrant checkout
   */
  static async getPublicGateways(req: Request, res: Response): Promise<void> {
    try {
      const gateways = PaymentManager.getPublicGateways();
      res.status(200).json(gateways);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch payment gateways.',
      });
    }
  }

  /**
   * Get payment transaction details for a registration
   */
  static async getPaymentDetails(req: Request, res: Response): Promise<void> {
    try {
      const idOrToken = req.params.id;
      const registrations = db.get('registrations') || [];
      const reg = registrations.find(
        r => r.id === idOrToken || (r.token_code && r.token_code.toUpperCase() === idOrToken.toUpperCase())
      );

      if (!reg) {
        res.status(404).json({ success: false, message: 'Registration record not found.' });
        return;
      }

      const payments = db.get('payments') || [];
      const tx = payments.find(p => p.registration_id === reg.id);

      res.status(200).json({
        success: true,
        registration: reg,
        payment: tx || null,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to retrieve payment details.',
      });
    }
  }

  /**
   * Admin method to list all payment transactions with filtering and search
   */
  static async getAllPayments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const payments = db.get('payments') || [];
      const { status, gateway, search } = req.query;

      let filtered = [...payments];

      if (status && typeof status === 'string') {
        filtered = filtered.filter(p => p.status === status);
      }

      if (gateway && typeof gateway === 'string') {
        filtered = filtered.filter(p => (p.gateway || '').toLowerCase() === gateway.toLowerCase());
      }

      if (search && typeof search === 'string') {
        const query = search.toLowerCase();
        filtered = filtered.filter(
          p =>
            (p.transaction_id && p.transaction_id.toLowerCase().includes(query)) ||
            (p.registration_id && p.registration_id.toLowerCase().includes(query)) ||
            (p.sender_mobile && p.sender_mobile.includes(query)) ||
            (p.token_code && p.token_code.toLowerCase().includes(query))
        );
      }

      res.status(200).json({
        success: true,
        total: filtered.length,
        payments: filtered,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to retrieve payment records.',
      });
    }
  }
}
