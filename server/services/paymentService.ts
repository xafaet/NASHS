import crypto from 'crypto';
import { db } from '../db';
import { PaymentGateway, PaymentStatus, PaymentTransaction, Registration, PaymentGatewayConfig } from '../../src/types';
import { TokenService } from './tokenService';
import {
  IPaymentGatewayAdapter,
  BKashGatewayAdapter,
  NagadGatewayAdapter,
  RocketGatewayAdapter,
  SSLCommerzGatewayAdapter,
  GenericGatewayAdapter,
} from './paymentAdapters';

export interface PaymentInitiateRequest {
  registration_id: string;
  gateway: PaymentGateway;
  return_url?: string;
}

export interface PaymentVerifyRequest {
  transaction_id: string;
  registration_id: string;
  amount: number;
  gateway: PaymentGateway;
  gateway_ref?: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  payload?: Record<string, any>;
}

export class PaymentManager {
  /**
   * Resolves the adapter instance based on configuration from the database.
   */
  static getAdapter(gatewayCode: string): IPaymentGatewayAdapter {
    const code = (gatewayCode || 'bkash').toLowerCase();
    const gateways = db.get('payment_gateways') || [];
    const config = gateways.find((g: PaymentGatewayConfig) => (g.code || '').toLowerCase() === code);

    const fallbackConfig: PaymentGatewayConfig = config || {
      id: `gw-${code}`,
      code: code,
      name: code.toUpperCase(),
      display_name_en: code.toUpperCase(),
      display_name_bn: code.toUpperCase(),
      is_enabled: true,
      is_test_mode: true,
      currency: 'BDT',
      transaction_prefix: code.toUpperCase().slice(0, 3),
      sort_order: 99,
    };

    switch (code) {
      case 'bkash':
        return new BKashGatewayAdapter(fallbackConfig);
      case 'nagad':
        return new NagadGatewayAdapter(fallbackConfig);
      case 'rocket':
        return new RocketGatewayAdapter(fallbackConfig);
      case 'sslcommerz':
      case 'card':
        return new SSLCommerzGatewayAdapter(fallbackConfig);
      default:
        return new GenericGatewayAdapter(fallbackConfig);
    }
  }

  /**
   * Returns sanitized public gateway settings for the frontend.
   * Secret keys and private merchant keys are never exposed.
   */
  static getPublicGateways(): Array<{
    id: string;
    code: string;
    name: string;
    display_name_en: string;
    display_name_bn: string;
    is_test_mode: boolean;
    payment_mode?: 'manual' | 'automatic';
    account_type?: 'Merchant' | 'Personal' | 'Agent';
    merchant_number?: string;
    currency: string;
    icon_url?: string;
    instructions_en?: string;
    instructions_bn?: string;
    sort_order: number;
  }> {
    const gateways = db.get('payment_gateways') || [];
    return gateways
      .filter((g: PaymentGatewayConfig) => g.is_enabled)
      .sort((a: PaymentGatewayConfig, b: PaymentGatewayConfig) => a.sort_order - b.sort_order)
      .map((g: PaymentGatewayConfig) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        display_name_en: g.display_name_en,
        display_name_bn: g.display_name_bn,
        is_test_mode: g.is_test_mode,
        payment_mode: g.payment_mode || (g.credentials?.manual_mode ? 'manual' : 'automatic'),
        account_type: g.account_type || (g.credentials?.account_type as any) || 'Personal',
        merchant_number: g.merchant_number || g.merchant_id || g.credentials?.merchant_number,
        currency: g.currency,
        icon_url: g.icon_url,
        instructions_en: g.instructions_en,
        instructions_bn: g.instructions_bn,
        sort_order: g.sort_order,
      }));
  }
}

export class PaymentService {
  /**
   * Initiate a payment session using the gateway adapter
   */
  static async initiatePayment(req: PaymentInitiateRequest): Promise<{
    session_id: string;
    gateway: PaymentGateway;
    amount: number;
    currency: string;
    checkout_url?: string;
    instruction?: string;
    registration: Registration;
  }> {
    const registrations = db.get('registrations');
    const reg = registrations.find(r => r.id === req.registration_id);

    if (!reg) {
      throw new Error('Registration record not found.');
    }

    if (reg.payment_status === 'paid') {
      throw new Error('Registration is already paid.');
    }

    const regConfig = db.get('registration_config');
    const amount = reg.fee_amount || regConfig?.fee_amount || 1000;
    const currency = reg.currency || regConfig?.currency || 'BDT';

    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const adapter = PaymentManager.getAdapter(req.gateway);

    const initResult = await adapter.initializePayment({
      transactionId,
      registrationId: reg.id,
      amount,
      currency,
      customerName: reg.full_name,
      customerPhone: reg.phone,
      customerEmail: reg.email,
      returnUrl: req.return_url,
    });

    // Update registration payment status to processing
    reg.payment_status = 'processing';
    db.set('registrations', registrations);

    // Record initiated transaction
    const payments = db.get('payments');
    const newTx: PaymentTransaction = {
      id: `pay-${Date.now()}`,
      registration_id: reg.id,
      transaction_id: transactionId,
      gateway: req.gateway,
      method: adapter.name,
      amount,
      currency,
      status: 'processing',
      gateway_ref: initResult.sessionToken,
      gateway_response: initResult.rawResponse,
      created_at: new Date().toISOString(),
    };
    payments.push(newTx);
    db.set('payments', payments);

    return {
      session_id: initResult.sessionToken || transactionId,
      gateway: req.gateway,
      amount,
      currency,
      checkout_url: initResult.redirectUrl,
      instruction: initResult.instruction,
      registration: reg,
    };
  }

  /**
   * Verify and finalize payment with automatic token issuance
   */
  static async verifyPayment(verification: PaymentVerifyRequest): Promise<{
    success: boolean;
    registration: Registration;
    transaction: PaymentTransaction;
    token?: any;
    message: string;
  }> {
    const registrations = db.get('registrations');
    const regIndex = registrations.findIndex(r => r.id === verification.registration_id);

    if (regIndex === -1) {
      throw new Error('Registration record not found for verification.');
    }

    const reg = registrations[regIndex];
    const payments = db.get('payments');
    const adapter = PaymentManager.getAdapter(verification.gateway);

    if (verification.status === 'SUCCESS') {
      const verifyResult = await adapter.verifyPayment({
        transactionId: verification.transaction_id,
        gatewayRef: verification.gateway_ref,
        amount: verification.amount,
        currency: reg.currency || 'BDT',
        payload: verification.payload,
      });

      // Mark registration confirmed & paid
      reg.payment_status = 'paid';
      reg.registration_status = 'confirmed';
      reg.updated_at = new Date().toISOString();

      // Issue digital entry pass token
      const token = await TokenService.issueToken(reg);
      reg.token_id = token.id;
      reg.token_code = token.token_code;
      reg.qr_code_svg = token.qr_code_svg;

      registrations[regIndex] = reg;
      db.set('registrations', registrations);

      // Record successful transaction
      const gatewayUpper = (verification.gateway || 'ONLINE').toUpperCase();
      const finalTx: PaymentTransaction = {
        id: `pay-${Date.now()}`,
        registration_id: reg.id,
        transaction_id: verification.transaction_id || `TRX-${Date.now()}`,
        gateway: verification.gateway,
        method: `${gatewayUpper} Payment Verified`,
        amount: verification.amount,
        currency: reg.currency || 'BDT',
        status: 'paid',
        gateway_ref: verifyResult.gatewayRef,
        gateway_response: verifyResult.rawResponse,
        created_at: new Date().toISOString(),
      };
      payments.push(finalTx);
      db.set('payments', payments);

      // Log audit
      const auditLogs = db.get('audit_logs');
      auditLogs.push({
        id: `log-${Date.now()}`,
        user_name: reg.full_name,
        user_email: reg.email || reg.phone,
        action: 'PAYMENT_SUCCESS',
        entity: 'Registration',
        details: `Paid ${reg.currency} ${verification.amount} via ${gatewayUpper} (Trx: ${finalTx.transaction_id}). Token ${token.token_code} issued.`,
        ip: '127.0.0.1',
        created_at: new Date().toISOString(),
      });
      db.set('audit_logs', auditLogs);

      return {
        success: true,
        registration: reg,
        transaction: finalTx,
        token,
        message: 'Payment verified successfully and entry pass issued.',
      };
    } else {
      // Payment Failed or Cancelled
      reg.payment_status = verification.status === 'CANCELLED' ? 'cancelled' : 'failed';
      reg.updated_at = new Date().toISOString();
      registrations[regIndex] = reg;
      db.set('registrations', registrations);

      const failedTx: PaymentTransaction = {
        id: `pay-${Date.now()}`,
        registration_id: reg.id,
        transaction_id: verification.transaction_id || `TRX-FAIL-${Date.now()}`,
        gateway: verification.gateway,
        method: (verification.gateway || 'ONLINE').toUpperCase(),
        amount: verification.amount,
        currency: reg.currency || 'BDT',
        status: verification.status === 'CANCELLED' ? 'cancelled' : 'failed',
        failure_reason: `User or gateway reported ${verification.status}`,
        created_at: new Date().toISOString(),
      };
      payments.push(failedTx);
      db.set('payments', payments);

      return {
        success: false,
        registration: reg,
        transaction: failedTx,
        message: `Payment was ${(verification.status || 'unsuccessful').toLowerCase()}.`,
      };
    }
  }

  /**
   * Submit manual payment confirmation (bKash / Nagad) by registrant.
   * DOES NOT automatically verify payment.
   * Moves status to 'payment_submitted' / 'under_review' for administrative audit.
   */
  static async submitManualPayment(req: {
    registration_id?: string;
    token_code?: string;
    gateway: string;
    transaction_id: string;
    sender_number: string;
    amount?: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    registration: Registration;
    transaction: PaymentTransaction;
    message: string;
    message_bn: string;
  }> {
    const registrations = db.get('registrations') || [];
    const cleanId = (req.registration_id || '').trim();
    const cleanToken = (req.token_code || '').trim().toUpperCase();
    const cleanTrx = (req.transaction_id || '').trim().toUpperCase();
    const cleanSender = (req.sender_number || '').trim();

    if (!cleanTrx) {
      throw new Error('Please enter a valid Transaction ID (TrxID).');
    }
    if (!cleanSender) {
      throw new Error('Please provide the sender mobile number used for payment.');
    }

    const regIndex = registrations.findIndex(
      r => (cleanId && r.id === cleanId) ||
           (cleanToken && (r.token_code || '').toUpperCase() === cleanToken) ||
           (cleanId && (r.token_code || '').toUpperCase() === cleanId.toUpperCase())
    );

    if (regIndex === -1) {
      throw new Error('Registration record not found. Please verify your Registration ID or Token Number.');
    }

    const reg = registrations[regIndex];

    if (reg.payment_status === 'paid' || reg.payment_status === 'verified') {
      throw new Error('This registration is already paid and verified.');
    }

    const gatewayName = (req.gateway || 'bkash').toLowerCase();
    const amount = Number(req.amount) || reg.fee_amount || 1000;
    const nowIso = new Date().toISOString();

    // Check for duplicate TrxID in other paid/submitted records
    const payments = db.get('payments') || [];
    const duplicateTrx = payments.find(
      p => (p.transaction_id || '').toUpperCase() === cleanTrx &&
           p.registration_id !== reg.id &&
           p.status !== 'rejected' &&
           p.status !== 'failed'
    );
    if (duplicateTrx) {
      throw new Error(`The Transaction ID "${cleanTrx}" has already been submitted for another registration. Please double check your SMS receipt.`);
    }

    // Update registration record to payment_submitted
    reg.payment_status = 'payment_submitted';
    reg.payment_method = gatewayName === 'nagad' ? 'Nagad Manual' : 'bKash Manual';
    reg.transaction_id = cleanTrx;
    reg.sender_number = cleanSender;
    reg.paid_amount = amount;
    reg.payment_submitted_at = nowIso;
    reg.notes = req.notes ? `${reg.notes ? reg.notes + ' | ' : ''}Manual Payment Note: ${req.notes}` : reg.notes;
    reg.updated_at = nowIso;

    registrations[regIndex] = reg;
    db.set('registrations', registrations);

    // Record or update transaction in payments collection
    const existingTxIdx = payments.findIndex(p => p.registration_id === reg.id && (p.status === 'pending' || p.status === 'payment_submitted'));
    const paymentTx: PaymentTransaction = {
      id: existingTxIdx !== -1 ? payments[existingTxIdx].id : `pay-${Date.now()}`,
      registration_id: reg.id,
      transaction_id: cleanTrx,
      gateway: gatewayName,
      method: gatewayName === 'nagad' ? 'Nagad Manual Transfer' : 'bKash Manual Transfer',
      amount,
      currency: reg.currency || 'BDT',
      status: 'payment_submitted',
      sender_mobile: cleanSender,
      token_code: reg.token_code,
      notes: req.notes || undefined,
      created_at: nowIso,
    };

    if (existingTxIdx !== -1) {
      payments[existingTxIdx] = paymentTx;
    } else {
      payments.push(paymentTx);
    }
    db.set('payments', payments);

    // Update token status if exists
    const tokens = db.get('tokens') || [];
    const tokenIdx = tokens.findIndex(t => t.registration_id === reg.id || t.token_code === reg.token_code);
    if (tokenIdx !== -1 && tokens[tokenIdx].status !== 'active') {
      tokens[tokenIdx].status = 'pending_payment';
      db.set('tokens', tokens);
    }

    // Log Audit Trail
    const auditLogs = db.get('audit_logs') || [];
    auditLogs.push({
      id: `log-${Date.now()}`,
      user_name: reg.full_name,
      user_email: reg.email || reg.phone,
      action: 'PAYMENT_CONFIRMATION_SUBMITTED',
      entity: 'Payment',
      details: `Submitted manual payment confirmation via ${gatewayName.toUpperCase()} (TrxID: ${cleanTrx}, Sender: ${cleanSender}, Amount: ৳${amount}) for Token ${reg.token_code || reg.id}`,
      ip: '127.0.0.1',
      created_at: nowIso,
    });
    db.set('audit_logs', auditLogs);

    return {
      success: true,
      registration: reg,
      transaction: paymentTx,
      message: 'Payment confirmation submitted successfully. Awaiting administrator verification.',
      message_bn: 'পেমেন্ট তথ্য সফলভাবে জমা দেওয়া হয়েছে। অ্যাডমিন কর্তৃক যাচাই সম্পন্ন হওয়ার পর রেজিস্ট্রেশন নিশ্চিত হবে।',
    };
  }

  /**
   * Admin approves and verifies manual payment.
   * Activates Entry Token and confirms registration.
   */
  static async verifyManualPayment(
    registrationId: string,
    adminUser: { name: string; email?: string },
    adminNotes?: string
  ): Promise<{
    success: boolean;
    registration: Registration;
    token: any;
    message: string;
  }> {
    const registrations = db.get('registrations') || [];
    const regIndex = registrations.findIndex(r => r.id === registrationId || r.token_code === registrationId);

    if (regIndex === -1) {
      throw new Error('Registration record not found.');
    }

    const reg = registrations[regIndex];
    const nowIso = new Date().toISOString();

    reg.payment_status = 'paid';
    reg.registration_status = 'confirmed';
    reg.payment_verified_at = nowIso;
    reg.verified_by = adminUser.name || 'Admin';
    if (adminNotes) {
      reg.admin_notes = adminNotes;
    }
    reg.updated_at = nowIso;

    // Issue / activate official digital entry token
    const token = await TokenService.issueToken(reg, 'active');
    reg.token_id = token.id;
    reg.token_code = token.token_code;
    reg.qr_code_svg = token.qr_code_svg;

    registrations[regIndex] = reg;
    db.set('registrations', registrations);

    // Update payments table
    const payments = db.get('payments') || [];
    const txIndex = payments.findIndex(p => p.registration_id === reg.id);
    if (txIndex !== -1) {
      payments[txIndex].status = 'paid';
      payments[txIndex].verified_at = nowIso;
      payments[txIndex].verified_by = adminUser.name;
      db.set('payments', payments);
    } else {
      payments.push({
        id: `pay-${Date.now()}`,
        registration_id: reg.id,
        transaction_id: reg.transaction_id || `MANUAL-${Date.now()}`,
        gateway: (reg.payment_method || 'bkash').toLowerCase().includes('nagad') ? 'nagad' : 'bkash',
        method: reg.payment_method || 'Manual Payment Verified',
        amount: reg.fee_amount || 1000,
        currency: reg.currency || 'BDT',
        status: 'paid',
        sender_mobile: reg.sender_number || reg.phone,
        token_code: reg.token_code,
        verified_at: nowIso,
        verified_by: adminUser.name,
        created_at: nowIso,
      });
      db.set('payments', payments);
    }

    // Update tokens table status to active
    const tokens = db.get('tokens') || [];
    const tokIndex = tokens.findIndex(t => t.id === token.id || t.token_code === token.token_code);
    if (tokIndex !== -1) {
      tokens[tokIndex].status = 'active';
      db.set('tokens', tokens);
    }

    // Log Audit Trail
    const auditLogs = db.get('audit_logs') || [];
    auditLogs.push({
      id: `log-${Date.now()}`,
      user_name: adminUser.name,
      user_email: adminUser.email || 'admin@nanupuralumni.org',
      action: 'PAYMENT_VERIFIED',
      entity: 'Payment',
      details: `Admin ${adminUser.name} verified manual payment for ${reg.full_name} (Token: ${token.token_code}, TrxID: ${reg.transaction_id || 'N/A'})`,
      ip: '127.0.0.1',
      created_at: nowIso,
    });
    db.set('audit_logs', auditLogs);

    return {
      success: true,
      registration: reg,
      token,
      message: `Payment verified successfully for ${reg.full_name}. Digital Entry Pass activated.`,
    };
  }

  /**
   * Admin rejects manual payment submission with reason.
   */
  static async rejectManualPayment(
    registrationId: string,
    adminUser: { name: string; email?: string },
    reason: string
  ): Promise<{
    success: boolean;
    registration: Registration;
    message: string;
  }> {
    const registrations = db.get('registrations') || [];
    const regIndex = registrations.findIndex(r => r.id === registrationId || r.token_code === registrationId);

    if (regIndex === -1) {
      throw new Error('Registration record not found.');
    }

    const reg = registrations[regIndex];
    const nowIso = new Date().toISOString();

    reg.payment_status = 'rejected';
    reg.admin_notes = reason || 'Payment rejected: invalid transaction ID or amount';
    reg.updated_at = nowIso;

    registrations[regIndex] = reg;
    db.set('registrations', registrations);

    // Update payments table
    const payments = db.get('payments') || [];
    const txIndex = payments.findIndex(p => p.registration_id === reg.id);
    if (txIndex !== -1) {
      payments[txIndex].status = 'rejected';
      payments[txIndex].failure_reason = reason;
      db.set('payments', payments);
    }

    // Update tokens table status to pending_payment
    const tokens = db.get('tokens') || [];
    const tokIndex = tokens.findIndex(t => t.registration_id === reg.id || t.token_code === reg.token_code);
    if (tokIndex !== -1) {
      tokens[tokIndex].status = 'pending_payment';
      db.set('tokens', tokens);
    }

    // Log Audit Trail
    const auditLogs = db.get('audit_logs') || [];
    auditLogs.push({
      id: `log-${Date.now()}`,
      user_name: adminUser.name,
      user_email: adminUser.email || 'admin@nanupuralumni.org',
      action: 'PAYMENT_REJECTED',
      entity: 'Payment',
      details: `Admin ${adminUser.name} rejected payment for ${reg.full_name} (${reg.id}). Reason: ${reason}`,
      ip: '127.0.0.1',
      created_at: nowIso,
    });
    db.set('audit_logs', auditLogs);

    return {
      success: true,
      registration: reg,
      message: `Payment rejected for ${reg.full_name}.`,
    };
  }
}
