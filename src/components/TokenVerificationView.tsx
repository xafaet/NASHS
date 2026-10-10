import React, { useState, useEffect } from 'react';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Award,
  UserCheck,
  Loader2,
  Copy,
  Check,
  Download,
  Smartphone,
  Info,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const TokenVerificationView: React.FC = () => {
  const { language, t } = useLanguage();
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  // Manual payment submission state inside verification view
  const [selectedGateway, setSelectedGateway] = useState<'bkash' | 'nagad'>('bkash');
  const [gateways, setGateways] = useState<any[]>([]);
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSubmitMsg, setPaymentSubmitMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Check query param if user scanned QR directly: /verify?token=...
  useEffect(() => {
    fetch('/api/gateways')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data)) setGateways(data);
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const code = params.get('token');
    if (code) {
      setTokenInput(code);
      handleVerify(code);
    }
  }, []);

  const handleVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || tokenInput).trim();
    if (!code) return;

    setLoading(true);
    setResult(null);
    setPaymentSubmitMsg(null);

    try {
      const res = await fetch(`/api/tokens/verify/${encodeURIComponent(code)}`);
      const data = await res.json();
      setResult(data);
      if (data.registration?.phone) {
        setSenderNumber(data.registration.phone);
      }
    } catch (err) {
      setResult({
        isValid: false,
        found: false,
        message: 'Verification server communication failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyNumber = (num: string, id: string) => {
    navigator.clipboard.writeText(num.replace(/[\s-]/g, ''));
    setCopiedNumber(id);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleSubmitPaymentConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result?.registration?.id && !result?.token?.code) return;

    if (!senderNumber.trim()) {
      alert(language === 'bn' ? 'অনুগ্রহ করে প্রেরক নম্বর লিখুন' : 'Please enter sender mobile number');
      return;
    }

    if (!transactionId.trim() || transactionId.trim().length < 4) {
      alert(language === 'bn' ? 'সঠিক TrxID লিখুন' : 'Please enter valid TrxID');
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch('/api/payments/manual-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: result.registration?.id || result.token?.code,
          token_code: result.token?.code || result.registration?.token_code,
          gateway: selectedGateway,
          sender_number: senderNumber.trim(),
          transaction_id: transactionId.trim().toUpperCase(),
          amount: result.registration?.fee_amount || 1000,
          notes: paymentNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Payment submission failed.');
      }

      setPaymentSubmitMsg(
        language === 'bn'
          ? 'পেমেন্ট তথ্য সফলভাবে জমা হয়েছে! স্ট্যাটাস: যাচাইয়ের অপেক্ষায় (Under Review)।'
          : 'Payment details submitted! Status: Under Review.'
      );

      // Reload verification state
      const targetCode = result.token?.code || result.registration?.token_code || tokenInput;
      handleVerify(targetCode);
    } catch (err: any) {
      alert(err.message || 'Submission error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const paymentStatus = result?.status || result?.registration?.payment_status || (result?.is_verified ? 'paid' : 'pending');
  const isPaid = paymentStatus === 'paid' || paymentStatus === 'verified' || result?.is_verified;
  const isUnderReview = paymentStatus === 'payment_submitted' || paymentStatus === 'under_review';
  const isRejected = paymentStatus === 'rejected';
  const isPending = paymentStatus === 'pending';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex p-3 bg-emerald-100 text-[#0f4d2a] rounded-2xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {language === 'bn' ? 'রেজিস্ট্রেশন ও টোকেন ভেরিফিকেশন' : 'Token Verification & Status Tracking'}
        </h2>
        <p className="text-slate-600 text-sm max-w-lg mx-auto">
          {language === 'bn'
            ? 'টোকেন কোড, রেজিস্ট্রেশন আইডি অথবা মোবাইল নম্বর দিয়ে আপনার রেজিস্ট্রেশন ও পেমেন্ট স্ট্যাটাস যাচাই করুন।'
            : 'Track your registration status, verify official entry tokens, or submit payment confirmation using your token code or mobile number.'}
        </p>
      </div>

      {/* Verification Input Box */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="space-y-3"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            {language === 'bn'
              ? 'টোকেন কোড / মোবাইল নম্বর / রেজিস্ট্রেশন আইডি'
              : 'Enter Token Code, Phone Number, or Registration ID'}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder={language === 'bn' ? 'যেমন: NASH-85-2027-A9F4K2 অথবা 01XXXXXXXXX' : 'e.g. NASH-85-2027-A9F4K2 or 01XXXXXXXXX'}
                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono text-base tracking-wider uppercase focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="py-3.5 px-6 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 text-amber-400" />}
              <span>{language === 'bn' ? 'স্ট্যাটাস যাচাই' : 'Check Status'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Verification Result Display */}
      {result && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-6">
          {result.found || result.isValid ? (
            <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
              {/* Header Status Bar */}
              <div
                className={`px-6 py-4 flex items-center justify-between text-white ${
                  isPaid
                    ? 'bg-emerald-700'
                    : isUnderReview
                    ? 'bg-blue-700'
                    : isRejected
                    ? 'bg-red-700'
                    : 'bg-amber-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isPaid ? (
                    <CheckCircle2 className="w-6 h-6 text-amber-300" />
                  ) : isUnderReview ? (
                    <Clock className="w-6 h-6 text-blue-200" />
                  ) : isRejected ? (
                    <XCircle className="w-6 h-6 text-white" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-200" />
                  )}
                  <span className="font-bold text-base sm:text-lg">
                    {isPaid
                      ? language === 'bn' ? 'রেজিস্ট্রেশন নিশ্চিত ও পেমেন্ট যাচাইকৃত' : 'Registration Confirmed & Payment Verified'
                      : isUnderReview
                      ? language === 'bn' ? 'পেমেন্ট জমা হয়েছে — যাচাইয়ের অপেক্ষায়' : 'Payment Submitted — Under Review'
                      : isRejected
                      ? language === 'bn' ? 'পেমেন্ট যাচাই বাতিল হয়েছে' : 'Payment Verification Rejected'
                      : language === 'bn' ? 'রেজিস্ট্রেশন গ্রহণ করা হয়েছে — পেমেন্ট অপেক্ষমান' : 'Registration Received — Payment Pending'}
                  </span>
                </div>
                <span className="font-mono text-xs bg-black/30 text-white px-3 py-1 rounded-full font-bold">
                  {result.token?.code || result.registration?.token_code}
                </span>
              </div>

              {/* Token Details */}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">
                      {t('form.full_name', 'Alumni Name')}
                    </span>
                    <span className="text-lg font-bold text-slate-900 block mt-0.5">
                      {result.token?.alumni_name || result.registration?.full_name}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">
                      {language === 'bn' ? 'ব্যাচ ও এসএসসি সাল' : 'Alumni Batch'}
                    </span>
                    <span className="text-lg font-bold text-[#0f4d2a] block mt-0.5">
                      {result.token?.batch || (result.registration?.passing_year ? `Batch of ${result.registration.passing_year}` : 'Alumni')}
                    </span>
                  </div>
                </div>

                {/* Token / Reference Box */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-amber-900 uppercase block">
                      {language === 'bn' ? 'পেমেন্ট রেফারেন্স / টোকেন কোড:' : 'Payment Reference / Token Code:'}
                    </span>
                    <span className="font-mono text-lg font-black text-[#0f4d2a]">
                      {result.token?.code || result.registration?.token_code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyToken(result.token?.code || result.registration?.token_code || '')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-800" />
                        <span>{language === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'টোকেন কপি' : 'Copy Token'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Event info */}
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Award className="w-4 h-4 text-[#0f4d2a]" />
                    <span>85th Anniversary Celebration & Grand Alumni Reunion 2027</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Calendar className="w-4 h-4 text-[#0f4d2a]" />
                    <span>Saturday, 16 January 2027 • 08:00 AM onwards</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <MapPin className="w-4 h-4 text-[#0f4d2a]" />
                    <span>Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram</span>
                  </div>
                </div>

                {/* Status Specific Section */}
                {isPaid && (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 uppercase">Gate Pass Status</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200 text-emerald-950">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {result.token?.checked_in ? 'Checked In' : 'Active & Verified'}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <a
                        href={`/api/tokens/${encodeURIComponent(result.token?.code || result.registration?.token_code)}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-xs font-bold shadow-md transition"
                      >
                        <Download className="w-4 h-4 text-amber-400" />
                        <span>Download Official Entry Pass (PDF)</span>
                      </a>
                    </div>
                  </div>
                )}

                {isUnderReview && (
                  <div className="p-5 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span>
                        {language === 'bn'
                          ? 'পেমেন্ট যাচাই চলমান রয়েছে'
                          : 'Payment Verification in Progress'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      {language === 'bn'
                        ? 'আপনার জমাকৃত ট্রানজেকশন তথ্য অর্থ কমিটি কর্তৃক যাচাই করা হচ্ছে। যাচাই সম্পন্ন হলে আপনার ডিজিটাল প্রবেশপত্র সম্পূর্ণ সক্রিয় হবে।'
                        : 'Your submitted transaction details are being reviewed by the finance committee. Once verified, your official digital entry pass with QR code will be activated.'}
                    </p>
                    <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs font-mono text-slate-800 flex justify-between flex-wrap gap-2">
                      <span>Method: <strong>{(result.registration?.payment_method || 'bKash').toUpperCase()}</strong></span>
                      <span>TrxID: <strong>{result.registration?.transaction_id || 'Submitted'}</strong></span>
                      <span>Sender: <strong>{result.registration?.phone}</strong></span>
                    </div>
                    <div className="pt-1 flex justify-end">
                      <a
                        href={`/api/registrations/${result.registration?.id || result.token?.code}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-bold shadow-xs hover:bg-slate-50 transition"
                      >
                        <Download className="w-4 h-4 text-[#0f4d2a]" />
                        <span>Download Registration Slip (PDF)</span>
                      </a>
                    </div>
                  </div>
                )}

                {isRejected && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-2">
                    <span className="text-xs font-bold text-red-900 block">Rejection Reason:</span>
                    <p className="text-xs text-red-800">
                      {result.registration?.admin_notes || 'Transaction details could not be matched with statement. Please verify and resubmit.'}
                    </p>
                  </div>
                )}

                {/* If Pending or Rejected: Allow submitting confirmation right here! */}
                {(isPending || isRejected) && (
                  <div className="p-5 bg-amber-50/60 rounded-xl border-2 border-amber-300 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-950">
                        {language === 'bn' ? 'ম্যানুয়াল পেমেন্ট নম্বর ও নিশ্চিতকরণ' : 'Manual Payment Accounts & Confirmation'}
                      </span>
                      <span className="text-xs font-bold text-amber-800">
                        Fee: ৳{result.registration?.fee_amount || 1000} BDT
                      </span>
                    </div>

                    {/* Dynamic bKash & Nagad Accounts */}
                    {(() => {
                      const bkashGw = gateways.find((g: any) => g.code === 'bkash');
                      const nagadGw = gateways.find((g: any) => g.code === 'nagad');
                      const bkashNum = bkashGw?.merchant_number || bkashGw?.merchant_id || bkashGw?.credentials?.merchant_number || '';
                      const nagadNum = nagadGw?.merchant_number || nagadGw?.merchant_id || nagadGw?.credentials?.merchant_number || '';
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {bkashNum && (
                            <div className="p-3 bg-white rounded-xl border border-pink-200 flex justify-between items-center">
                              <div>
                                <span className="font-bold text-pink-900 block">bKash ({bkashGw?.account_type || 'Merchant'})</span>
                                <span className="font-mono font-bold text-pink-950 text-sm">{bkashNum}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyNumber(bkashNum, 'v_bkash')}
                                className="px-2.5 py-1 bg-pink-100 hover:bg-pink-200 text-pink-900 rounded-lg font-bold cursor-pointer"
                              >
                                {copiedNumber === 'v_bkash' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}

                          {nagadNum && (
                            <div className="p-3 bg-white rounded-xl border border-orange-200 flex justify-between items-center">
                              <div>
                                <span className="font-bold text-orange-900 block">Nagad ({nagadGw?.account_type || 'Send Money'})</span>
                                <span className="font-mono font-bold text-orange-950 text-sm">{nagadNum}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyNumber(nagadNum, 'v_nagad')}
                                className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-lg font-bold cursor-pointer"
                              >
                                {copiedNumber === 'v_nagad' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {paymentSubmitMsg && (
                      <div className="p-3 bg-emerald-100 border border-emerald-400 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>{paymentSubmitMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmitPaymentConfirmation} className="space-y-3 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Method *</label>
                          <select
                            value={selectedGateway}
                            onChange={(e) => setSelectedGateway(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                          >
                            <option value="bkash">bKash</option>
                            <option value="nagad">Nagad</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Sender Mobile *</label>
                          <input
                            type="text"
                            required
                            value={senderNumber}
                            onChange={(e) => setSenderNumber(e.target.value)}
                            placeholder="018XXXXXXXX"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Transaction ID (TrxID) *</label>
                          <input
                            type="text"
                            required
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                            placeholder="BK89A2B4"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <a
                          href={`/api/registrations/${result.registration?.id || result.token?.code}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold"
                        >
                          Download Slip (PDF)
                        </a>
                        <button
                          type="submit"
                          disabled={submittingPayment}
                          className="px-5 py-2 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {submittingPayment ? 'Submitting...' : 'Submit Payment Confirmation'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 rounded-2xl shadow-md border-2 border-red-300 p-6 text-center space-y-3">
              <div className="inline-flex p-3 bg-red-100 text-red-600 rounded-full">
                <XCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-red-900">
                {t('verify.invalid_title', 'Invalid or Unrecognized Token')}
              </h3>
              <p className="text-sm text-red-700 max-w-sm mx-auto">
                {result.message || 'The token code or phone number you entered could not be found in official registration records.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
