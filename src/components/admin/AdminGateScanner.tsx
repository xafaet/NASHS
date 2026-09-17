import React, { useState } from 'react';
import {
  Search,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Phone,
  Calendar,
  MapPin,
  Award,
  CreditCard,
  ShieldCheck,
  RotateCcw,
  Loader2,
  Check,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import confetti from 'canvas-confetti';

interface Props {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
}

export const AdminGateScanner: React.FC<Props> = ({ onNotify, getHeaders }) => {
  const { language, t } = useLanguage();

  // Search input & mode
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Gate configuration
  const [gateName, setGateName] = useState('Gate 1 - Main Entrance');
  const [operatorName, setOperatorName] = useState('Gate Officer (NASH)');

  // Verification state (does NOT mark checked in)
  const [verifiedData, setVerifiedData] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Completed check-in status
  const [checkInSuccess, setCheckInSuccess] = useState<{
    success: boolean;
    message: string;
    record?: any;
    token?: any;
  } | null>(null);

  // Recent check-in audit feed
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);

  const handleVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || identifier).trim();
    if (!code) {
      setVerifyError('Please enter an Entry Token Code or Registered Mobile Number.');
      return;
    }

    setLoading(true);
    setVerifyError(null);
    setVerifiedData(null);
    setCheckInSuccess(null);

    try {
      const res = await fetch(`/api/tokens/gate-verify/${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok || !data.found) {
        setVerifyError(data.message || 'Attendee record not found. Please verify the token code or phone number.');
      } else {
        setVerifiedData(data);
      }
    } catch (err: any) {
      setVerifyError('Failed to communicate with verification server. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCheckIn = async () => {
    if (!verifiedData || !verifiedData.canCheckIn) return;

    setCheckInLoading(true);
    const tokenOrPhone = verifiedData.token?.token_code || verifiedData.member?.phone || identifier;
    const methodUsed = verifiedData.matchedBy === 'phone' ? 'Registered Mobile Number' : 'Entry Token Number';

    try {
      const headers = getHeaders ? getHeaders() : { 'Content-Type': 'application/json' };
      const res = await fetch('/api/tokens/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          token_code: tokenOrPhone,
          operator_name: operatorName,
          gate_name: gateName,
          verification_method: methodUsed,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCheckInSuccess(data);
        if (onNotify) onNotify(`Check-in recorded for ${verifiedData.member?.full_name}!`);

        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#0f4d2a', '#f59e0b', '#10b981'],
          });
        } catch (e) {}

        // Add to local recent audit feed
        const newFeedItem = {
          id: `feed-${Date.now()}`,
          name: verifiedData.member?.full_name,
          batch: verifiedData.member?.batch_name,
          phone: verifiedData.member?.phone,
          token: verifiedData.token?.token_code,
          gate: gateName,
          operator: operatorName,
          time: new Date().toLocaleTimeString(),
        };
        setRecentCheckIns(prev => [newFeedItem, ...prev.slice(0, 9)]);

        // Update local state so button disables
        setVerifiedData({
          ...verifiedData,
          canCheckIn: false,
          status: 'ALREADY_CHECKED_IN',
          message: `Check-in recorded just now at ${new Date().toLocaleTimeString()} by ${operatorName}`,
          token: {
            ...verifiedData.token,
            checked_in: true,
            checked_in_at: new Date().toISOString(),
          },
        });
      } else {
        setVerifyError(data.message || 'Check-in recording failed.');
      }
    } catch (err: any) {
      setVerifyError('Network error while marking check-in. Please try again.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleReset = () => {
    setIdentifier('');
    setVerifiedData(null);
    setVerifyError(null);
    setCheckInSuccess(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-emerald-700" />
            <span>Gate Entrance Check-In Scanner</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Official 85th Anniversary Gate Control. Step 1: <strong>Verify Member</strong> → Step 2: <strong>Mark Check-in</strong>.
          </p>
        </div>

        {/* Gate Officer Configuration */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
          <select
            value={gateName}
            onChange={e => setGateName(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="Gate 1 - Main Entrance">Gate 1 - Main Entrance</option>
            <option value="Gate 2 - VIP & Alumni Lounge">Gate 2 - VIP & Alumni Lounge</option>
            <option value="Gate 3 - North Ground Access">Gate 3 - North Ground Access</option>
            <option value="Gate 4 - Fast Track Digital Pass">Gate 4 - Fast Track Digital Pass</option>
          </select>
          <input
            type="text"
            value={operatorName}
            onChange={e => setOperatorName(e.target.value)}
            placeholder="Officer Name"
            className="w-36 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Lookup Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleVerify();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Enter Entry Token Number OR Registered Mobile Number
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="e.g. NASH-85-2027-A9F4K2 or 01819123456"
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl font-mono text-base uppercase tracking-wider focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Action 1: VERIFY BUTTON */}
              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="py-3.5 px-6 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50 min-w-[150px]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> : <Search className="w-5 h-5 text-amber-400" />}
                <span>[ Verify Attendee ]</span>
              </button>

              {verifiedData && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Clear / Scan Next"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Verification Error Notice */}
      {verifyError && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 flex items-start gap-3.5 text-red-900 animate-in fade-in">
          <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-base">Verification Failed</h4>
            <p className="text-sm text-red-700">{verifyError}</p>
          </div>
        </div>
      )}

      {/* Step 2: Verification Result & Mark Check-In Control */}
      {verifiedData && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-300 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Status Banner */}
          <div
            className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white ${
              verifiedData.canCheckIn
                ? 'bg-emerald-700'
                : verifiedData.status === 'ALREADY_CHECKED_IN'
                ? 'bg-amber-600'
                : 'bg-red-700'
            }`}
          >
            <div className="flex items-center gap-3">
              {verifiedData.canCheckIn ? (
                <CheckCircle2 className="w-7 h-7 text-amber-300" />
              ) : verifiedData.status === 'ALREADY_CHECKED_IN' ? (
                <Clock className="w-7 h-7 text-amber-200" />
              ) : (
                <XCircle className="w-7 h-7 text-red-200" />
              )}
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider opacity-90 block">
                  {verifiedData.canCheckIn
                    ? 'VERIFIED & ELIGIBLE FOR ENTRANCE'
                    : verifiedData.status === 'ALREADY_CHECKED_IN'
                    ? 'ALREADY CHECKED IN (DUPLICATE ATTEMPT)'
                    : `CANNOT CHECK IN: ${verifiedData.status}`}
                </span>
                <span className="font-extrabold text-lg sm:text-xl">
                  {verifiedData.member?.full_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-mono font-bold">
                Matched via: {verifiedData.matchedBy?.toUpperCase()}
              </span>
              {verifiedData.token?.token_code && (
                <span className="bg-white text-slate-950 px-3 py-1 rounded-full text-xs font-mono font-black">
                  {verifiedData.token.token_code}
                </span>
              )}
            </div>
          </div>

          {/* Member Details & Registration Overview */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Member Card */}
              <div className="md:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-emerald-100 text-[#0f4d2a] font-bold text-2xl flex items-center justify-center shrink-0 border border-emerald-200">
                    {verifiedData.member?.photo_url ? (
                      <img
                        src={verifiedData.member.photo_url}
                        alt="Photo"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      verifiedData.member?.full_name?.charAt(0) || 'A'
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-lg">
                      {verifiedData.member?.full_name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                        Batch: {verifiedData.member?.batch_name} ({verifiedData.member?.passing_year})
                      </span>
                      {verifiedData.member?.blood_group && (
                        <span className="bg-red-100 text-red-900 px-2 py-0.5 rounded font-bold">
                          Blood: {verifiedData.member?.blood_group}
                        </span>
                      )}
                      {verifiedData.member?.occupation && (
                        <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-medium">
                          {verifiedData.member?.occupation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Mobile Phone:</span>
                    <span className="font-mono font-bold text-slate-900">{verifiedData.member?.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registration ID:</span>
                    <span className="font-mono font-bold text-slate-900">{verifiedData.registration?.id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Event:</span>
                    <span className="font-bold text-emerald-900">85th Anniversary 2027</span>
                  </div>
                </div>
              </div>

              {/* Status Indicator Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Financial & Security Status
                  </span>
                  <div>
                    <span className="text-xs text-slate-500 block">Payment Status:</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase mt-0.5 ${
                        verifiedData.registration?.payment_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-red-100 text-red-900 border border-red-300'
                      }`}
                    >
                      {verifiedData.registration?.payment_status === 'paid' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                      )}
                      {verifiedData.registration?.payment_status || 'PENDING'} (৳
                      {verifiedData.registration?.fee_amount || 1000})
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">Current Gate Status:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mt-0.5 ${
                        verifiedData.token?.checked_in
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {verifiedData.token?.checked_in ? 'Checked-In Already' : 'Not Checked-In'}
                    </span>
                  </div>
                </div>

                {verifiedData.token?.checked_in_at && (
                  <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Entered: {new Date(verifiedData.token.checked_in_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Check-in Success Banner if just marked */}
            {checkInSuccess && (
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-950">
                <div className="flex items-center gap-2.5">
                  <Check className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-base">Check-In Registered Successfully!</p>
                    <p className="text-xs text-emerald-800">
                      Member granted entry at {gateName} by {operatorName}. Timestamp recorded in audit database.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Scan Next Person
                </button>
              </div>
            )}

            {/* ACTION 2: DISTINCT SEPARATE [ MARK CHECK-IN ] BUTTON */}
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                <span>Gate: <strong>{gateName}</strong></span>
                <span className="mx-2">•</span>
                <span>Officer: <strong>{operatorName}</strong></span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 sm:flex-initial px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel / Scan Another
                </button>

                <button
                  type="button"
                  onClick={handleMarkCheckIn}
                  disabled={checkInLoading || !verifiedData.canCheckIn}
                  className={`flex-1 sm:flex-initial px-8 py-3.5 rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
                    verifiedData.canCheckIn
                      ? 'bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white shadow-emerald-950/20'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {checkInLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Recording Check-In...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5 text-amber-400" />
                      <span>[ Mark Check-in ]</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Recent Check-Ins Audit Log */}
      {recentCheckIns.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span>Recent Gate Check-Ins (This Session)</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono font-bold">
              {recentCheckIns.length} Checked In
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {recentCheckIns.map(item => (
              <div key={item.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{item.name}</span>
                  <span className="text-slate-500 font-mono text-[11px] ml-2">
                    {item.batch} • {item.phone} • Token: {item.token}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {item.gate}
                  </span>
                  <span className="text-slate-400 ml-2 font-mono text-[10px]">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
