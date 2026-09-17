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
}
