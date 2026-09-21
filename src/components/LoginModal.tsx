import React, { useState } from 'react';
import { X, Lock, Mail, AlertCircle, Loader2, UserCheck, ShieldCheck, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, user } = useAuth();
  const { language, t } = useLanguage();

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [verifiedUser, setVerifiedUser] = useState<{
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
    passing_year?: number;
    requires_passing_year?: boolean;
  } | null>(null);
  const [passingYearInput, setPassingYearInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleResetModalState = () => {
    setMode('login');
    setError(null);
    setSuccessMsg(null);
    setForgotStep(1);
    setVerifiedUser(null);
    setPassingYearInput('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    handleResetModalState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const success = await login(identifier, password);
    setLoading(false);

    if (success) {
      handleClose();
      // Determine destination based on identifier or admin keyword
      const isSuperOrAdmin =
        identifier.toLowerCase().includes('admin') ||
        identifier.toLowerCase().includes('super') ||
        user?.role === 'super_admin' ||
        user?.role === 'admin';

      if (isSuperOrAdmin) {
        onSuccess('admin');
      } else {
        onSuccess('member');
      }
    } else {
      setError(
        language === 'bn'
          ? 'লগইন ব্যর্থ হয়েছে। দয়া করে সঠিক ইউজারনেম/ইমেইল ও পাসওয়ার্ড দিন।'
          : 'Login failed. Please verify your username/email/mobile and password.'
      );
    }
  };

  const handleVerifyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(language === 'bn' ? 'দয়া করে ইউজারনেম, ইমেইল বা মোবাইল নম্বর দিন' : 'Please provide your username, email, or mobile number');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (language === 'bn' ? 'অ্যাকাউন্ট খুঁজে পাওয়া যায়নি' : 'Account not found'));
      }

      setVerifiedUser(data.user);
      setForgotStep(2);
      if (data.user.passing_year) {
        // Pre-fill passing year if known or let them confirm
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify account.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError(language === 'bn' ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(language === 'bn' ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          passing_year: passingYearInput ? parseInt(passingYearInput, 10) : undefined,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || (language === 'bn' ? 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে' : 'Failed to reset password'));
      }

      setSuccessMsg(
        language === 'bn'
          ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! লগইন করা হচ্ছে...'
          : 'Password reset successfully! Logging you in...'
      );

      // Log in the user immediately
      const loggedIn = await login(identifier, newPassword);
      setTimeout(() => {
        handleClose();
        if (loggedIn) {
          const isSuperOrAdmin =
            data.user?.role === 'super_admin' || data.user?.role === 'admin';
          onSuccess(isSuperOrAdmin ? 'admin' : 'member');
        }
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to execute password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f4d2a] to-[#135d34] text-white p-6 relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold mb-3 shadow-md">
            {mode === 'login' ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <h3 className="text-xl font-bold tracking-tight">
            {mode === 'login'
              ? t('nav.login', 'Account Sign In')
              : (language === 'bn' ? 'পাসওয়ার্ড রিসেট ও পুনরুদ্ধার' : 'Password Reset & Recovery')}
          </h3>
          <p className="text-xs text-emerald-100 mt-1">
            {mode === 'login'
              ? (language === 'bn'
                  ? 'প্রাক্তন শিক্ষার্থী সদস্য বা পরিষদ অ্যাডমিন হিসেবে লগইন করুন।'
                  : 'Sign in to access Member Pass or Admin Management.')
              : (language === 'bn'
                  ? 'আপনার অ্যাকাউন্ট যাচাই করে নতুন পাসওয়ার্ড নির্ধারণ করুন।'
                  : 'Verify your account and set a new secure password.')}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-center gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* LOGIN FORM */
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    {language === 'bn' ? 'ইউজারনেম, ইমেইল অথবা মোবাইল' : 'Username, Email or Mobile'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      placeholder="admin@nanupuralumni.org or 01711..."
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-slate-700">
                      {language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
                    >
                      {language === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{language === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
                </button>
              </form>
            </>
          ) : (
            /* FORGOT / RESET PASSWORD FLOW */
            <div className="space-y-4">
              {forgotStep === 1 ? (
                <form onSubmit={handleVerifyAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      {language === 'bn' ? 'ইউজারনেম, ইমেইল বা মোবাইল নম্বর' : 'Username, Email or Mobile'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        placeholder="e.g. 01819... or admin@nanupuralumni.org"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === 'bn'
                        ? 'আপনার নিবন্ধিত অ্যাকাউন্টের ইউজারনেম, ইমেইল বা ফোন নম্বর দিন।'
                        : 'Enter your registered email, username, or contact phone.'}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4 text-amber-400" />}
                    <span>{language === 'bn' ? 'অ্যাকাউন্ট যাচাই করুন' : 'Verify Account'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'লগইন স্ক্রিনে ফিরে যান' : 'Back to Sign In'}</span>
                  </button>
                </form>
              ) : (
                /* STEP 2: SET NEW PASSWORD */
                <form onSubmit={handleExecuteReset} className="space-y-4">
                  {verifiedUser && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-xs font-bold text-emerald-900">
                        {language === 'bn' ? 'যাচাইকৃত ব্যবহারকারী:' : 'Verified User:'} {verifiedUser.name}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        @{verifiedUser.username} {verifiedUser.email ? `• ${verifiedUser.email}` : ''}
                      </div>
                    </div>
                  )}

                  {verifiedUser?.requires_passing_year && (
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        {language === 'bn' ? 'এসএসসি পাসের সাল নিশ্চিত করুন' : 'Confirm SSC Passing Year'}
                      </label>
                      <input
                        type="number"
                        required
                        value={passingYearInput}
                        onChange={e => setPassingYearInput(e.target.value)}
                        placeholder="e.g. 2005"
                        min="1942"
                        max="2035"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        {language === 'bn' ? 'নিরাপত্তার স্বার্থে আপনার এসএসসি পাসের সাল লিখুন।' : 'For account security verification.'}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      {language === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      {language === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 text-amber-400" />}
                    <span>{language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ও লগইন' : 'Reset Password & Sign In'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setError(null);
                    }}
                    className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'পূর্ববর্তী ধাপে যান' : 'Back to Previous Step'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
