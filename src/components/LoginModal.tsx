import React, { useState } from 'react';
import { X, Lock, Mail, AlertCircle, Loader2, Award, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login } = useAuth();
  const { language, t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const success = await login(email, password);
    setLoading(false);

    if (success) {
      onClose();
      // Determine destination
      if (email.includes('admin')) {
        onSuccess('admin');
      } else {
        onSuccess('member');
      }
    } else {
      setError(language === 'bn' ? 'ভুল ইমেইল বা পাসওয়ার্ড' : 'Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f4d2a] to-[#135d34] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold mb-3 shadow-md">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">
            {t('nav.login', 'Account Sign In')}
          </h3>
          <p className="text-xs text-emerald-100 mt-1">
            {language === 'bn'
              ? 'প্রাক্তন শিক্ষার্থী সদস্য বা পরিষদ অ্যাডমিন হিসেবে লগইন করুন।'
              : 'Sign in to access Member Pass or Admin Management.'}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@nanupuralumni.org"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4 text-amber-400" />}
              <span>{language === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
