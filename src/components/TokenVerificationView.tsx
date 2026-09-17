import React, { useState, useEffect } from 'react';
import { Search, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Calendar, MapPin, Award, UserCheck, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const TokenVerificationView: React.FC = () => {
  const { language, t } = useLanguage();
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    token?: any;
    message?: string;
  } | null>(null);

  // Check query param if user scanned QR directly: /verify?token=...
  useEffect(() => {
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

    try {
      const res = await fetch(`/api/tokens/verify/${encodeURIComponent(code)}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        isValid: false,
        message: 'Verification server communication failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex p-3 bg-emerald-100 text-[#0f4d2a] rounded-2xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('verify.title', 'Entry Token Verification')}
        </h2>
        <p className="text-slate-600 text-sm max-w-md mx-auto">
          {t('verify.desc', 'Check the authenticity of any 85th Anniversary entry token issued by Nanupur Abu Sobhan High School Alumni Association.')}
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
            {language === 'bn' ? 'টোকেন কোড প্রবেশ করান' : 'Enter Official Token Code'}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder={t('verify.input_placeholder', 'e.g. NASH-85-2027-A9F4K2')}
                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono text-base tracking-wider uppercase focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="py-3.5 px-6 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 text-amber-400" />}
              <span>{t('verify.button', 'Verify Token')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Verification Result Display */}
      {result && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {result.isValid && result.token ? (
            <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-500 overflow-hidden">
              {/* Header Status Bar */}
              <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-amber-300" />
                  <span className="font-bold text-lg">
                    {t('verify.valid_title', 'Valid & Genuine Token')}
                  </span>
                </div>
                <span className="font-mono text-xs bg-emerald-950 text-amber-300 px-3 py-1 rounded-full font-bold">
                  {result.token.code}
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
                      {result.token.alumni_name}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium block">
                      {language === 'bn' ? 'ব্যাচ' : 'Alumni Batch'}
                    </span>
                    <span className="text-lg font-bold text-[#0f4d2a] block mt-0.5">
                      {language === 'bn' && result.token.batch_bn ? result.token.batch_bn : result.token.batch}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Award className="w-4 h-4 text-[#0f4d2a]" />
                    <span>{language === 'bn' ? result.token.event_title_bn : result.token.event_title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Calendar className="w-4 h-4 text-[#0f4d2a]" />
                    <span>{result.token.event_date} (Saturday)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <MapPin className="w-4 h-4 text-[#0f4d2a]" />
                    <span>{language === 'bn' ? result.token.venue_bn : result.token.venue}</span>
                  </div>
                </div>

                {/* Gate Check-in Status */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    {language === 'bn' ? 'গেট প্রবেশের অবস্থা:' : 'Gate Entrance Status:'}
                  </span>
                  {result.token.checked_in ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                      {language === 'bn' ? 'ইতিমধ্যে প্রবেশ সম্পন্ন' : 'Already Checked In'} ({new Date(result.token.checked_in_at).toLocaleTimeString()})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      {language === 'bn' ? 'সক্রিয় ও প্রবেশের জন্য প্রস্তুত' : 'Active & Ready for Gate Entry'}
                    </span>
                  )}
                </div>
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
                {result.message || 'The token code you entered could not be verified against the official registration records.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
