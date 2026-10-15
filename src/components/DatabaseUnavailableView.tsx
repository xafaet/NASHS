import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  ShieldAlert,
  Clock,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Wrench,
  Globe,
  Radio
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface DatabaseUnavailableViewProps {
  state: 'DATABASE_UNAVAILABLE' | 'SCHEMA_INCOMPLETE';
  onRecovered?: () => void;
  report?: {
    driver?: string;
    host?: string;
    message?: string;
    checked_at?: string;
  };
}

export const DatabaseUnavailableView: React.FC<DatabaseUnavailableViewProps> = ({
  state,
  onRecovered,
  report: initialReport,
}) => {
  const [retrying, setRetrying] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>(
    initialReport?.checked_at || new Date().toLocaleTimeString()
  );
  const [report, setReport] = useState<any>(initialReport || null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [lang, setLang] = useState<'en' | 'bn'>('bn');
  const [autoPollCount, setAutoPollCount] = useState(0);

  // Poll database status every 6 seconds to recover automatically
  useEffect(() => {
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/system/db-status');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setReport(data);
            setLastCheck(new Date().toLocaleTimeString());
            setAutoPollCount(c => c + 1);

            if (data.state === 'OPERATIONAL') {
              if (onRecovered) {
                onRecovered();
              } else {
                window.location.reload();
              }
            }
          }
        }
      } catch {
        // Continue polling
      }
    }, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [onRecovered]);

  const handleManualRetry = async () => {
    setRetrying(true);
    try {
      const res = await apiFetch('/api/system/test-db');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        setLastCheck(new Date().toLocaleTimeString());

        if (data.state === 'OPERATIONAL') {
          if (onRecovered) {
            onRecovered();
          } else {
            window.location.reload();
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Manual database retry error:', e);
    } finally {
      setTimeout(() => setRetrying(false), 600);
    }
  };

  const isSchema = state === 'SCHEMA_INCOMPLETE';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#041a0d] via-[#072615] to-[#041a0d] text-white flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      {/* Top Banner */}
      <header className="border-b border-emerald-900/60 bg-[#03150a]/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-[#0f4d2a] flex items-center justify-center font-bold text-amber-300 text-base shadow-md border border-emerald-500/40">
              NAS
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white tracking-wide">
                নানুপুর আবু সোবহান উচ্চ বিদ্যালয়
              </div>
              <div className="text-[10px] sm:text-xs text-emerald-300/80 font-medium">
                ৮৫ বছর পূর্তি উৎসব ও প্রাক্তন শিক্ষার্থী পুনর্মিলনী ২০২৭
              </div>
            </div>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(l => (l === 'bn' ? 'en' : 'bn'))}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/60 hover:bg-emerald-800 text-amber-300 text-xs font-bold border border-emerald-700/60 transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="max-w-2xl mx-auto px-4 py-12 flex-1 flex items-center justify-center">
        <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-emerald-800/40 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-emerald-500 to-amber-400" />

          {/* Status Badge */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              <span>HTTP 503 • {isSchema ? 'SCHEMA PENDING' : 'DATABASE OFFLINE'}</span>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Checked: {lastCheck}</span>
            </div>
          </div>

          {/* Header Icon & Title */}
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3.5 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 shrink-0">
              {isSchema ? (
                <Wrench className="w-7 h-7 text-amber-400" />
              ) : (
                <Database className="w-7 h-7 text-amber-400 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {lang === 'bn'
                  ? isSchema
                    ? 'ডাটাবেজ স্কিমা সেটআপ প্রয়োজন'
                    : 'ওয়েবসাইট সেবা সাময়িকভাবে অনুপলব্ধ'
                  : isSchema
                  ? 'Database Schema Setup Required'
                  : 'Service Temporarily Unavailable'}
              </h1>
              <div className="text-xs sm:text-sm text-amber-300 font-semibold mt-1">
                {lang === 'bn'
                  ? isSchema
                    ? 'প্রয়োজনীয় ডাটাবেজ টেবিল অনুপস্থিত'
                    : 'ডাটাবেজ সংযোগে সাময়িক রক্ষণাবেক্ষণ চলছে'
                  : isSchema
                  ? 'Required database tables have not been initialized'
                  : 'Database connection interrupted — System is attempting to reconnect'}
              </div>
            </div>
          </div>

          {/* Explanatory Text */}
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2 mb-6 border-y border-slate-800/80 py-4">
            {lang === 'bn' ? (
              <>
                <p>
                  আমাদের মূল ডাটাবেজের সাথে সংযোগ পুনঃস্থাপনের কাজ চলছে। ব্যবহারকারীদের নিরাপত্তা নিশ্চিত করতে কোনো কৃত্রিম বা অমিল তথ্য প্রদর্শন বন্ধ রাখা হয়েছে।
                </p>
                <p className="text-emerald-300 font-medium">
                  ✓ সকল নিবন্ধন রেকর্ড, পেমেন্ট ও সদস্য অ্যাকাউন্টের তথ্য সম্পূর্ণ অক্ষত ও নিরাপদ আছে।
                </p>
              </>
            ) : (
              <>
                <p>
                  The platform requires an active database connection to safeguard application data and verify alumni registrations. Service will resume automatically once database connectivity is re-established.
                </p>
                <p className="text-emerald-300 font-medium">
                  ✓ All registration records, payments, and member accounts remain completely secure.
                </p>
              </>
            )}
          </div>

          {/* Live System Diagnostics Box */}
          <div className="bg-black/40 border border-emerald-900/40 rounded-2xl p-4 mb-6 text-xs space-y-2 font-mono">
            <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/60 pb-2">
              <span className="font-sans text-slate-400 font-semibold">Database Driver:</span>
              <span className="text-emerald-300 font-bold uppercase">
                {report?.driver || 'MySQL / MariaDB'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/60 pb-2">
              <span className="font-sans text-slate-400 font-semibold">Target Server:</span>
              <span className="text-slate-200">{report?.host || 'localhost:3306'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="font-sans text-slate-400 font-semibold">Auto-Recovery:</span>
              <span className="text-amber-300 font-sans flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Auto-polling every 6s (Attempt #{autoPollCount + 1})
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleManualRetry}
              disabled={retrying}
              className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-98 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              <span>
                {retrying
                  ? lang === 'bn'
                    ? 'পরীক্ষা করা হচ্ছে...'
                    : 'Checking Connection...'
                  : lang === 'bn'
                  ? 'পুনরায় সংযোগ চেষ্টা করুন'
                  : 'Retry Connection Now'}
              </span>
            </button>

            <button
              onClick={() => setShowDiagnostics(v => !v)}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>{showDiagnostics ? 'Hide Info' : 'Diagnostics'}</span>
            </button>
          </div>

          {/* Expandable Diagnostic Panel */}
          {showDiagnostics && (
            <div className="mt-5 p-4 rounded-xl bg-black/60 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-2 animate-in fade-in duration-200">
              <div className="font-bold text-amber-300 font-sans">
                Administrator Troubleshooting Guide:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-300 font-sans">
                <li>
                  Verify MySQL service is running on your cPanel or server.
                </li>
                <li>
                  Confirm <code>.env</code> credentials match cPanel MySQL User &amp; Database name.
                </li>
                <li>
                  Ensure your MySQL user has full permissions granted to the database.
                </li>
                <li>
                  If tables are missing, import <code>database_setup.sql</code> in phpMyAdmin.
                </li>
              </ul>
              {report?.sanitized_error && (
                <div className="mt-2 p-2 bg-red-950/40 border border-red-900/60 rounded text-red-300">
                  <strong>Diagnostic Error:</strong> {report.sanitized_error}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-900/60 bg-[#03150a]/90 text-center py-4 px-4 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © 2027 নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন শিক্ষার্থী সমিতি
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold">
            Nanupur, Fatikchhari, Chittagong, Bangladesh
          </div>
        </div>
      </footer>
    </div>
  );
};
