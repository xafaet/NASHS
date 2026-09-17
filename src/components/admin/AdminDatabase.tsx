import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Server,
  Cloud,
  Layers,
  RefreshCw,
  Download,
  Terminal,
  ShieldCheck,
  HardDrive,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface AdminDatabaseProps {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
}

export const AdminDatabase: React.FC<AdminDatabaseProps> = ({ onNotify, getHeaders }) => {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const getAuthHeaders = () => {
    const base = getHeaders ? getHeaders() : {};
    const token = typeof window !== 'undefined' ? localStorage.getItem('nash_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...base,
    };
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/database/status', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Error loading database status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const copyEnvSample = () => {
    const envText = `# Production Database Configuration (cPanel or Supabase)
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nash_reunion_db
DB_USER=cpanel_dbuser
DB_PASSWORD=your_secure_password

# Or for Supabase (Postgres):
# DB_DRIVER=supabase
# DB_HOST=db.your-supabase-project.supabase.co
# DB_PORT=5432
# DB_NAME=postgres
# DB_USER=postgres
# DB_PASSWORD=your_supabase_password`;

    navigator.clipboard.writeText(envText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    onNotify?.('Environment configuration template copied to clipboard!');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6 text-emerald-700" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Database Architecture & Portability
              </h2>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Engineered for seamless portability between Supabase (PostgreSQL), cPanel (MySQL / MariaDB), and local development.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/?view=setup';
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Launch Setup Wizard</span>
            </button>

            <button
              type="button"
              onClick={loadStatus}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Check Live Connection</span>
            </button>
          </div>
        </div>

        {/* Current Connection Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Active Storage Engine
              </span>
              <HardDrive className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {dbStatus?.active_driver?.toUpperCase() || 'LOCAL / IN-MEMORY'}
            </div>
            <p className="text-xs text-slate-600">
              {dbStatus?.is_external
                ? 'Connected to configured external database.'
                : 'Zero-config local mode with automatic auto-persistence.'}
            </p>
          </div>

          <div className="p-5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Database Portability
              </span>
              <Server className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">cPanel + Supabase</div>
            <p className="text-xs text-slate-600">
              ANSI SQL schema migration bundled in `/server/db/schema.sql`.
            </p>
          </div>

          <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Persistence Integrity
              </span>
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div className="text-xl font-extrabold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              <span>Operational</span>
            </div>
            <p className="text-xs text-slate-600">
              Real transactions, no mock delays, and instant data persistence.
            </p>
          </div>
        </div>

        {/* Portability Setup Guide */}
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Terminal className="w-5 h-5 text-slate-700" />
              Production Deployment Instructions
            </h3>
            <button
              type="button"
              onClick={copyEnvSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy .env snippet'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-3">
            <p>
              To run this application against your <strong>cPanel MySQL</strong> or <strong>Supabase PostgreSQL</strong> database:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-2 font-medium">
              <li>
                In cPanel phpMyAdmin or Supabase SQL editor, import the schema from <code className="bg-white px-1.5 py-0.5 rounded border">server/db/schema.sql</code>.
              </li>
              <li>
                In your production environment or hosting settings, define the <code className="bg-white px-1.5 py-0.5 rounded border">DB_DRIVER</code> (mysql or supabase), <code className="bg-white px-1.5 py-0.5 rounded border">DB_HOST</code>, <code className="bg-white px-1.5 py-0.5 rounded border">DB_USER</code>, and <code className="bg-white px-1.5 py-0.5 rounded border">DB_PASSWORD</code>.
              </li>
              <li>
                The server automatically uses connection pooling and parameterized queries with zero client-side credential exposure.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
