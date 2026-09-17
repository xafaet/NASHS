import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  X,
  Lock,
  Copy,
  Check,
  HelpCircle,
  Smartphone,
  CreditCard,
  Mail,
} from 'lucide-react';
import { PaymentGateway, Registration } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PaymentModalProps {
  registration: Registration;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokenData: any) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  registration,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language, t } = useLanguage();
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('bkash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual payment inputs
  const [senderNumber, setSenderNumber] = useState(registration.phone || '');
  const [transactionId, setTransactionId] = useState('');
  const [copied, setCopied] = useState(false);

  // Dynamic gateway configurations from server
  const [gatewaysData, setGatewaysData] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/payment-gateways')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setGatewaysData(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Find active gateway info
  const activeGatewayConfig = gatewaysData.find(g => g.code === selectedGateway);

  // Determine manual account numbers and instructions
  const isManualGateway = selectedGateway === 'bkash' || selectedGateway === 'nagad';
  const merchantNumber =
    activeGatewayConfig?.merchant_id ||
    activeGatewayConfig?.merchant_number ||
    (selectedGateway === 'bkash' ? '01819-123456' : '01712-654321');

  const accountType =
    activeGatewayConfig?.credentials?.account_type ||
    (selectedGateway === 'bkash' ? 'Personal (Send Money)' : 'Personal (Send Money)');

  const instructionsEn =
    activeGatewayConfig?.instructions_en ||
    (selectedGateway === 'bkash'
      ? `1. Open your bKash app or dial *247#\n2. Choose 'Send Money' (or 'Payment')\n3. Enter Recipient Number: ${merchantNumber}\n4. Enter Amount: ৳${registration.fee_amount}\n5. Enter Reference: Your Mobile Number (${registration.phone})\n6. Copy the TrxID and enter below.`
      : `1. Open your Nagad app or dial *167#\n2. Choose 'Send Money'\n3. Enter Recipient Number: ${merchantNumber}\n4. Enter Amount: ৳${registration.fee_amount}\n5. Enter Reference: ${registration.phone}\n6. Copy the TrxID and enter below.`);

  const instructionsBn =
    activeGatewayConfig?.instructions_bn ||
    (selectedGateway === 'bkash'
      ? `১. বিকাশ অ্যাপে প্রবেশ করুন অথবা *২৪৭# ডায়াল করুন\n২. 'Send Money' অপশন সিলেক্ট করুন\n৩. প্রাপক নম্বর দিন: ${merchantNumber}\n৪. টাকার পরিমাণ দিন: ৳${registration.fee_amount}\n৫. রেফারেন্সে আপনার মোবাইল নম্বর দিন\n৬. সফল পেমেন্টের পর প্রাপ্ত TrxID টি নিচের বক্সে দিন।`
      : `১. নগদ অ্যাপে প্রবেশ করুন অথবা *১৬৭# ডায়াল করুন\n২. 'Send Money' অপশন সিলেক্ট করুন\n৩. প্রাপক নম্বর দিন: ${merchantNumber}\n৪. টাকার পরিমাণ দিন: ৳${registration.fee_amount}\n৫. রেফারেন্সে আপনার মোবাইল নম্বর দিন\n৬. সফল পেমেন্টের পর প্রাপ্ত TrxID টি নিচের বক্সে দিন।`);

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(merchantNumber.replace(/[\s-]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePay = async (simulateOutcome: 'SUCCESS' | 'FAILED' = 'SUCCESS') => {
    setError(null);

    // Validation for manual bKash & Nagad payments
    if (simulateOutcome === 'SUCCESS' && isManualGateway) {
      if (!senderNumber.trim()) {
        setError(
          language === 'bn'
            ? 'দয়া করে আপনার যে নম্বর থেকে টাকা পাঠানো হয়েছে সেই নম্বরটি লিখুন।'
            : 'Please enter the sender mobile number used to send money.'
        );
        return;
      }
      if (!transactionId.trim() || transactionId.trim().length < 4) {
        setError(
          language === 'bn'
            ? 'সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন (যেমন: BK89A2B4 অথবা 9G8F7K).'
            : 'Please enter a valid Transaction ID (TrxID) received via SMS.'
        );
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Initiate payment session on server
      const initRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registration.id,
          gateway: selectedGateway,
        }),
      });

      if (!initRes.ok) {
        const errData = await initRes.json();
        throw new Error(errData.message || 'Payment initiation failed.');
      }

      const initData = await initRes.json();

      // 2. Server-side verification & token issuance
      const finalTrxId = isManualGateway
        ? transactionId.trim().toUpperCase()
        : `TRX-${(selectedGateway || 'ONLINE').toUpperCase()}-${Date.now().toString().slice(-6)}`;

      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registration.id,
          transaction_id: finalTrxId,
          amount: initData.amount,
          gateway: selectedGateway,
          gateway_ref: `REF-${Date.now()}`,
          status: simulateOutcome,
          payload: {
            sender_mobile: senderNumber,
            manual_payment: isManualGateway,
            submitted_at: new Date().toISOString(),
          },
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(verifyData.message || 'Payment verification failed.');
      }

      if (verifyData.success) {
        // Trigger simulated confirmation email with PDF pass
        try {
          await fetch(`/api/registrations/${registration.id}/send-confirmation-email`, {
            method: 'POST',
          });
        } catch (e) {}

        onSuccess(verifyData);
      } else {
        setError(verifyData.message || 'Payment was declined. You can retry with another payment method.');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment processing error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const gateways = [
    {
      id: 'bkash' as PaymentGateway,
      name: 'bKash Manual',
      nameBn: 'বিকাশ (ম্যানুয়াল)',
      color: 'border-pink-500 bg-pink-50/70 text-pink-900',
      badge: 'Send Money',
      badgeBn: 'সেন্ড মানি',
    },
    {
      id: 'nagad' as PaymentGateway,
      name: 'Nagad Manual',
      nameBn: 'নগদ (ম্যানুয়াল)',
      color: 'border-orange-500 bg-orange-50/70 text-orange-900',
      badge: 'Send Money',
      badgeBn: 'সেন্ড মানি',
    },
    {
      id: 'rocket' as PaymentGateway,
      name: 'Rocket / DBBL',
      nameBn: 'রকেট',
      color: 'border-purple-500 bg-purple-50/70 text-purple-900',
      badge: 'Online',
      badgeBn: 'অনলাইন',
    },
    {
      id: 'sslcommerz' as PaymentGateway,
      name: 'Cards / Banking',
      nameBn: 'ভিসা / মাস্টারকার্ড',
      color: 'border-blue-500 bg-blue-50/70 text-blue-900',
      badge: 'Direct Gateway',
      badgeBn: 'গেটওয়ে',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#0f4d2a] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {language === 'bn' ? '৮৫ বছর পূর্তি নিবন্ধন ফি পেমেন্ট' : 'Reunion Registration Fee Payment'}
              </h3>
              <p className="text-xs text-emerald-200">
                {language === 'bn' ? 'বিকাশ ও নগদ ম্যানুয়াল পেমেন্ট সাপোর্ট' : 'bKash & Nagad Manual Payment Support'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Summary Strip */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">
              {language === 'bn' ? 'নিবন্ধনকারী ও ব্যাচ' : 'Attendee & Batch'}
            </span>
            <span className="font-bold text-slate-800 text-sm">
              {registration.full_name} ({language === 'bn' ? registration.batch_name_bn : registration.batch_name})
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">
              {language === 'bn' ? 'মোট প্রদেয় ফি' : 'Total Payable Fee'}
            </span>
            <span className="font-extrabold text-lg sm:text-xl text-[#0f4d2a]">
              ৳{registration.fee_amount.toLocaleString()} {registration.currency}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-r-lg flex items-start gap-2.5 text-sm text-red-800 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{language === 'bn' ? 'ত্রুটি' : 'Notice'}</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              {language === 'bn' ? 'পেমেন্ট মাধ্যম নির্বাচন করুন' : 'Select Payment Method'}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {gateways.map(gw => {
                const isSelected = selectedGateway === gw.id;
                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => {
                      setSelectedGateway(gw.id);
                      setError(null);
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition relative cursor-pointer ${
                      isSelected
                        ? `${gw.color} ring-2 ring-emerald-600/30 font-bold shadow-sm`
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{language === 'bn' ? gw.nameBn : gw.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                    </div>
                    {gw.badge && (
                      <span className="text-[10px] text-slate-500 block mt-1">
                        {language === 'bn' ? gw.badgeBn : gw.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MANUAL BKASH & NAGAD INSTRUCTIONS & ACCOUNT CARD */}
          {isManualGateway ? (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-4">
              {/* Account Details Box */}
              <div className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-500 block">
                    {selectedGateway.toUpperCase()} {accountType}
                  </span>
                  <span className="font-mono text-base font-black text-slate-900 tracking-wider">
                    {merchantNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{language === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'নম্বর কপি' : 'Copy'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Instructions Box */}
              <div className="text-xs text-slate-700 space-y-1 bg-white/60 p-3 rounded-xl border border-amber-100">
                <span className="font-bold text-slate-900 block mb-1">
                  {language === 'bn' ? 'পেমেন্ট নির্দেশাবলী:' : 'Payment Instructions:'}
                </span>
                <p className="whitespace-pre-line leading-relaxed font-sans text-slate-600">
                  {language === 'bn' ? instructionsBn : instructionsEn}
                </p>
              </div>

              {/* Input 1: Sender Mobile Number */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  {language === 'bn' ? 'প্রেরক মোবাইল নম্বর (Sender Mobile Number)' : 'Sender Mobile Number'}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={senderNumber}
                  onChange={e => setSenderNumber(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono font-medium"
                />
              </div>

              {/* Input 2: Transaction ID (TrxID) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  {language === 'bn' ? 'ট্রানজেকশন আইডি (Transaction ID / TrxID)' : 'Transaction ID (TrxID)'}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value.toUpperCase())}
                  placeholder="e.g. BK89A2B4 or 9G8F7K"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono font-bold uppercase tracking-wider text-slate-900"
                />
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'টাকা পাঠানোর পর বিকাশ/নগদ থেকে প্রাপ্ত ট্রানজেকশন আইডি এখানে লিখুন।'
                    : 'Enter the Transaction ID received in your confirmation SMS.'}
                </p>
              </div>
            </div>
          ) : (
            /* Online Gateway / Card */
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#0f4d2a] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {selectedGateway.toUpperCase()} Online Gateway
                </span>
                <span className="bg-emerald-200/60 text-emerald-900 font-mono text-[10px] px-2 py-0.5 rounded font-bold">
                  DIRECT GATEWAY
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {language === 'bn'
                  ? 'এই মাধ্যমে কার্ড ও অনলাইন ব্যাংকিং পেমেন্ট গেটওয়েতে সরাসরি কানেক্ট হবে।'
                  : 'Direct online checkout simulator with automated confirmation.'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => handlePay('SUCCESS')}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>
                    {language === 'bn' ? 'যাচাই ও প্রবেশপত্র প্রস্তুত হচ্ছে...' : 'Verifying & Generating Pass...'}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {isManualGateway
                      ? language === 'bn'
                        ? 'পেমেন্ট নিশ্চিত করুন ও ডিজিটাল টোকেন সংগ্রহ করুন'
                        : 'Submit Payment & Issue Digital Entry Pass'
                      : language === 'bn'
                      ? `৳${registration.fee_amount.toLocaleString()} পরিশোধ করুন`
                      : `Pay ৳${registration.fee_amount.toLocaleString()} BDT`}
                  </span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </>
              )}
            </button>

            {/* Simulated Fail/Cancel Button for QA Testing */}
            <button
              onClick={() => handlePay('FAILED')}
              disabled={loading}
              type="button"
              className="w-full py-2 px-3 text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              {language === 'bn' ? 'পরীক্ষামূলক: ব্যর্থ পেমেন্ট সিমুলেট করুন' : 'Test: Simulate Payment Failure'}
            </button>
          </div>
        </div>

        {/* Security Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            256-Bit SSL Encrypted
          </span>
          <span className="flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            Instant PDF & Email Delivery
          </span>
        </div>
      </div>
    </div>
  );
};
