import crypto from 'crypto';
import { PaymentGatewayConfig, PaymentStatus } from '../../src/types';

export interface PaymentInitParams {
  transactionId: string;
  registrationId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  returnUrl?: string;
}

export interface PaymentInitResult {
  success: boolean;
  gatewayCode: string;
  transactionId: string;
  redirectUrl?: string;
  sessionToken?: string;
  instruction?: string;
  rawResponse?: Record<string, any>;
}

export interface PaymentVerifyParams {
  transactionId: string;
  gatewayRef?: string;
  amount: number;
  currency: string;
  payload?: Record<string, any>;
}

export interface PaymentVerifyResult {
  success: boolean;
  status: PaymentStatus;
  gatewayRef: string;
  amount: number;
  currency: string;
  rawResponse?: Record<string, any>;
  message?: string;
}

/**
 * Standard Payment Gateway Adapter Interface
 * Allows adding future payment gateways without rebuilding the core payment architecture.
 */
export interface IPaymentGatewayAdapter {
  readonly code: string;
  readonly name: string;
  initializePayment(params: PaymentInitParams): Promise<PaymentInitResult>;
  verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
  handleCallback(payload: Record<string, any>): Promise<PaymentVerifyResult>;
  getStatus(): { isEnabled: boolean; isTestMode: boolean };
}

/**
 * bKash Payment Gateway Adapter
 */
export class BKashGatewayAdapter implements IPaymentGatewayAdapter {
  readonly code = 'bkash';
  readonly name = 'bKash Mobile Financial Service';

  constructor(private config: PaymentGatewayConfig) {}

  getStatus() {
    return {
      isEnabled: this.config.is_enabled,
      isTestMode: this.config.is_test_mode,
    };
  }

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    const paymentId = `BKASH-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      success: true,
      gatewayCode: this.code,
      transactionId: params.transactionId,
      sessionToken: paymentId,
      redirectUrl: this.config.is_test_mode ? undefined : this.config.callback_url,
      instruction: 'Complete payment using bKash merchant checkout or sandbox simulator.',
      rawResponse: {
        paymentID: paymentId,
        createTime: new Date().toISOString(),
        orgLogo: this.config.icon_url,
        merchantInvoiceNumber: params.transactionId,
        amount: params.amount,
        currency: params.currency,
      },
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const trxId = params.gatewayRef || `BK${Date.now().toString().slice(-6)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    return {
      success: true,
      status: 'paid',
      gatewayRef: trxId,
      amount: params.amount,
      currency: params.currency,
      rawResponse: {
        trxID: trxId,
        paymentID: params.transactionId,
        transactionStatus: 'Completed',
        verificationTime: new Date().toISOString(),
      },
    };
  }

  async handleCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    return this.verifyPayment({
      transactionId: payload.paymentID || payload.transaction_id,
      gatewayRef: payload.trxID || payload.gateway_ref,
      amount: parseFloat(payload.amount || '0'),
      currency: payload.currency || 'BDT',
      payload,
    });
  }
}

/**
 * Nagad Payment Gateway Adapter
 */
export class NagadGatewayAdapter implements IPaymentGatewayAdapter {
  readonly code = 'nagad';
  readonly name = 'Nagad Digital Financial Service';

  constructor(private config: PaymentGatewayConfig) {}

  getStatus() {
    return {
      isEnabled: this.config.is_enabled,
      isTestMode: this.config.is_test_mode,
    };
  }

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    const ref = `NGD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      success: true,
      gatewayCode: this.code,
      transactionId: params.transactionId,
      sessionToken: ref,
      instruction: 'Authenticate via Nagad portal or sandbox simulator.',
      rawResponse: {
        paymentReferenceId: ref,
        status: 'Initialized',
      },
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const trxId = params.gatewayRef || `NG${Date.now().toString().slice(-6)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    return {
      success: true,
      status: 'paid',
      gatewayRef: trxId,
      amount: params.amount,
      currency: params.currency,
      rawResponse: {
        issuerPaymentRefNo: trxId,
        status: 'Success',
      },
    };
  }

  async handleCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    return this.verifyPayment({
      transactionId: payload.order_id || payload.transaction_id,
      gatewayRef: payload.payment_ref_id || payload.gateway_ref,
      amount: parseFloat(payload.amount || '0'),
      currency: payload.currency || 'BDT',
      payload,
    });
  }
}

/**
 * Rocket (Dutch-Bangla Bank) Gateway Adapter
 */
export class RocketGatewayAdapter implements IPaymentGatewayAdapter {
  readonly code = 'rocket';
  readonly name = 'Rocket Mobile Banking';

  constructor(private config: PaymentGatewayConfig) {}

  getStatus() {
    return {
      isEnabled: this.config.is_enabled,
      isTestMode: this.config.is_test_mode,
    };
  }

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    return {
      success: true,
      gatewayCode: this.code,
      transactionId: params.transactionId,
      sessionToken: `RKT-${Date.now()}`,
      instruction: 'Confirm via DBBL Rocket bill pay.',
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const trxId = params.gatewayRef || `RK${Date.now().toString().slice(-6)}`;
    return {
      success: true,
      status: 'paid',
      gatewayRef: trxId,
      amount: params.amount,
      currency: params.currency,
    };
  }

  async handleCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    return this.verifyPayment({
      transactionId: payload.transaction_id,
      gatewayRef: payload.gateway_ref,
      amount: parseFloat(payload.amount || '0'),
      currency: payload.currency || 'BDT',
    });
  }
}

/**
 * SSLCommerz Gateway Adapter (Card / Net Banking)
 */
export class SSLCommerzGatewayAdapter implements IPaymentGatewayAdapter {
  readonly code = 'sslcommerz';
  readonly name = 'SSLCommerz Hosted Checkout';

  constructor(private config: PaymentGatewayConfig) {}

  getStatus() {
    return {
      isEnabled: this.config.is_enabled,
      isTestMode: this.config.is_test_mode,
    };
  }

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    const sessionKey = `SSL-${crypto.randomBytes(16).toString('hex')}`;
    return {
      success: true,
      gatewayCode: this.code,
      transactionId: params.transactionId,
      sessionToken: sessionKey,
      redirectUrl: this.config.is_test_mode
        ? undefined
        : `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=pay&SESSIONKEY=${sessionKey}`,
      instruction: 'Debit / Credit card, Net Banking & Multi-channel checkout.',
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const valId = params.gatewayRef || `SSL_VAL_${Date.now()}`;
    return {
      success: true,
      status: 'paid',
      gatewayRef: valId,
      amount: params.amount,
      currency: params.currency,
      rawResponse: {
        val_id: valId,
        status: 'VALID',
        bank_tran_id: `BANK_${Date.now()}`,
      },
    };
  }

  async handleCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    return this.verifyPayment({
      transactionId: payload.tran_id || payload.transaction_id,
      gatewayRef: payload.val_id || payload.gateway_ref,
      amount: parseFloat(payload.amount || '0'),
      currency: payload.currency || 'BDT',
      payload,
    });
  }
}

/**
 * Generic / Future Gateway Adapter
 * Enables adding any new gateway dynamically from Admin without recompiling code!
 */
export class GenericGatewayAdapter implements IPaymentGatewayAdapter {
  readonly code: string;
  readonly name: string;

  constructor(private config: PaymentGatewayConfig) {
    this.code = config.code;
    this.name = config.name;
  }

  getStatus() {
    return {
      isEnabled: this.config.is_enabled,
      isTestMode: this.config.is_test_mode,
    };
  }

  async initializePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    return {
      success: true,
      gatewayCode: this.code,
      transactionId: params.transactionId,
      sessionToken: `${this.code.toUpperCase()}-${Date.now()}`,
      redirectUrl: this.config.callback_url,
      instruction: this.config.instructions_en || 'Follow payment instructions on gateway interface.',
    };
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    const ref = params.gatewayRef || `${this.code.toUpperCase()}_TRX_${Date.now()}`;
    return {
      success: true,
      status: 'paid',
      gatewayRef: ref,
      amount: params.amount,
      currency: params.currency,
    };
  }

  async handleCallback(payload: Record<string, any>): Promise<PaymentVerifyResult> {
    return this.verifyPayment({
      transactionId: payload.transaction_id,
      gatewayRef: payload.gateway_ref,
      amount: parseFloat(payload.amount || '0'),
      currency: payload.currency || 'BDT',
      payload,
    });
  }
}
