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
  Activity,
  FileCode2,
  FileSpreadsheet,
  FileJson,
  ArrowRight,
  Clock,
  Wifi,
  ExternalLink,
  Users,
  Calendar,
  Ticket,
  FileText,
  Radio,
  CheckCircle,
  XCircle,
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
  const [testingConnection, setTestingConnection] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [exporting, setExporting] = useState<'sql' | 'json' | 'csv' | null>(null);

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
      console.error('Error loading database status:', err);
      onNotify?.('Error loading database status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const runLiveDiagnostic = async () => {
    setTestingConnection(true);
    try {
      const res = await apiFetch('/api/admin/database/test-connection', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setDiagnosticResult(data);
      if (data.success) {
        onNotify?.(`Live connection test passed! Latency: ${data.latency_ms || 0}ms (${data.driver})`);
        loadStatus();
      } else {
        onNotify?.(`Connection test warning: ${data.error || 'Connection failed'}`);
      }
    } catch (err: any) {
      setDiagnosticResult({ success: false, error: err.message });
      onNotify?.('Diagnostic test failed: ' + err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const res = await apiFetch('/api/admin/database/reconnect', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        onNotify?.('Database connection pool re-initialized!');
        await loadStatus();
      } else {
        onNotify?.('Reconnect warning: ' + (data.message || 'Unable to re-initialize pool'));
      }
    } catch (err: any) {
      onNotify?.('Reconnect error: ' + err.message);
    } finally {
      setReconnecting(false);
    }
  };

  const handleExport = async (format: 'mysql' | 'postgres' | 'json' | 'csv') => {
    setExporting(format);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nash_token') : null;
      const response = await fetch(`/api/admin/database/export?format=${format}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Export request returned status ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().split('T')[0];
      const filename =
        format === 'mysql'
          ? `nash_alumni_cpanel_mysql_dump_${dateStr}.sql`
          : format === 'postgres'
          ? `nash_alumni_cloudsql_postgres_dump_${dateStr}.sql`
          : format === 'json'
          ? `nash_alumni_db_backup_${dateStr}.json`
          : `nash_alumni_registrations_${dateStr}.csv`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      onNotify?.(`Database ${format.toUpperCase()} export downloaded successfully!`);
    } catch (err: any) {
      console.error('Export download error:', err);
      onNotify?.('Database export failed: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  const copyEnvSample = () => {
    const envText = `# Production Database Configuration (cPanel MySQL or Supabase PostgreSQL)
# Option A: Supabase PostgreSQL (Recommended)
DATABASE_URL=postgresql://postgres.xxx:your_password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
DB_DRIVER=supabase

# Option B: cPanel MySQL / MariaDB
# DB_DRIVER=mysql
# DB_HOST=localhost
# DB_PORT=3306
# DB_NAME=nash_reunion_db
# DB_USER=cpanel_dbuser
# DB_PASSWORD=your_secure_password`;

    navigator.clipboard.writeText(envText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    onNotify?.('Production database environment snippet copied to clipboard!');
  };

  const diagnostic = dbStatus?.diagnostic;
  const tableCounts = dbStatus?.table_counts || {};
  const isSupabase = dbStatus?.active_driver === 'supabase' || diagnostic?.driver === 'supabase';

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Database Architecture & Diagnostics
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      dbStatus?.is_connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        dbStatus?.is_connected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'
                      }`}
                    />
                    {dbStatus?.is_connected ? 'Live Connected' : 'Local Resilient Mode'}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                    {dbStatus?.active_driver === 'supabase'
                      ? 'Supabase PostgreSQL'
                      : dbStatus?.active_driver === 'mysql'
                      ? 'cPanel MySQL'
                      : 'Local Resilient Cache'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runLiveDiagnostic}
              disabled={testingConnection}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Testing Query...' : 'Run Diagnostics'}</span>
            </button>

            <button
              type="button"
              onClick={handleReconnect}
              disabled={reconnecting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
              <span>{reconnecting ? 'Reconnecting...' : 'Reconnect Pool'}</span>
            </button>
          </div>
        </div>

        {/* Live Diagnostics & Connection Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1 */}
          <div className="p-5 bg-gradient-to-br from-emerald-50/60 to-slate-50 border border-emerald-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-700" />
                Active Driver
              </span>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px] font-bold uppercase">
                {dbStatus?.active_driver || 'local'}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {isSupabase ? 'Supabase PostgreSQL Pool' : 'MySQL / Portable Engine'}
            </div>
            <p className="text-xs text-slate-600">
              Host: <code className="font-mono text-slate-800">{diagnostic?.host || 'localhost'}</code>
            </p>
            <p className="text-xs text-slate-600">
              Database: <code className="font-mono text-slate-800">{diagnostic?.database || 'postgres'}</code>
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-5 bg-gradient-to-br from-blue-50/60 to-slate-50 border border-blue-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-blue-700" />
                Live Health
              </span>
              <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded text-[10px] font-bold">
                {diagnostic?.latency_ms !== null && diagnostic?.latency_ms !== undefined
                  ? `${diagnostic.latency_ms} ms`
                  : 'Active'}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Operational</span>
            </div>
            <p className="text-xs text-slate-600">
              Bi-directional sync enabled with automatic database fail-safe caching.
            </p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last connected: {diagnostic?.last_connected_at ? new Date(diagnostic.last_connected_at).toLocaleTimeString() : 'Recent'}
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-5 bg-gradient-to-br from-amber-50/60 to-slate-50 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                Persistent State
              </span>
              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-bold">
                Protected
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">Installation Locked</div>
            <p className="text-xs text-slate-600">
              Installation status is persisted in the database table <code className="font-mono text-slate-800">site_settings</code>.
            </p>
            <p className="text-[11px] text-emerald-700 font-medium">
              Setup wizard will never show on normal restarts.
            </p>
          </div>
        </div>

        {/* Live Diagnostic Test Output Banner (if triggered) */}
        {diagnosticResult && (
          <div
            className={`p-4 rounded-xl border text-xs transition animate-in fade-in duration-200 ${
              diagnosticResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {diagnosticResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>
                    {diagnosticResult.success
                      ? `Connection Diagnostic: Successfully contacted ${diagnosticResult.driver} database`
                      : 'Connection Diagnostic Failed'}
                  </span>
                  {diagnosticResult.latency_ms !== undefined && (
                    <span className="font-mono bg-white/70 px-2 py-0.5 rounded border border-current">
                      Roundtrip: {diagnosticResult.latency_ms}ms
                    </span>
                  )}
                </div>
                {diagnosticResult.server_version && (
                  <div>
                    Server Engine: <code className="font-mono">{diagnosticResult.server_version}</code>
                  </div>
                )}
                {diagnosticResult.tables && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(diagnosticResult.tables).map(([tbl, count]: any) => (
                      <span
                        key={tbl}
                        className="px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-700 font-mono text-[11px]"
                      >
                        {tbl}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {diagnosticResult.error && (
                  <p className="text-red-700 font-medium">{diagnosticResult.error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table Records Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-700" />
              Real Database Collections & Record Counts
            </h3>
            <span className="text-xs text-slate-500">Live synced across server & remote database</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-medium">
                <Users className="w-3.5 h-3.5" />
                <span>Users / Admins</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {tableCounts.users ?? 0}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-medium">
                <Calendar className="w-3.5 h-3.5" />
                <span>Registrations</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">
                {tableCounts.registrations ?? 0}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-medium">
                <Ticket className="w-3.5 h-3.5" />
                <span>Entry Tokens</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {tableCounts.tokens ?? 0}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-medium">
                <FileText className="w-3.5 h-3.5" />
                <span>Audit Logs</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {tableCounts.audit_logs ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Database Export Section */}
        <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Database Export & Disaster Recovery Backups
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Generate real, production-ready backups of your entire application database in multiple standard formats.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* cPanel MySQL Export */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400">
                  <FileCode2 className="w-4 h-4" />
                  <h4 className="font-bold text-sm text-white">cPanel MySQL (.sql)</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Optimized for cPanel phpMyAdmin, MySQL 5.7/8.0+, and MariaDB with InnoDB engine and utf8mb4 encoding.
                </p>
              </div>
              <button
                type="button"
                disabled={exporting === 'mysql'}
                onClick={() => handleExport('mysql')}
                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${exporting === 'mysql' ? 'animate-bounce' : ''}`} />
                <span>{exporting === 'mysql' ? 'Generating MySQL...' : 'Export cPanel MySQL'}</span>
              </button>
            </div>

            {/* Cloud SQL Postgres Export */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sky-400">
                  <Database className="w-4 h-4" />
                  <h4 className="font-bold text-sm text-white">Cloud SQL / Supabase (.sql)</h4>
                </div>
                <p className="text-xs text-slate-300">
                  PostgreSQL 14+ schema with JSONB columns and ON CONFLICT upsert syntax for Supabase and Google Cloud SQL.
                </p>
              </div>
              <button
                type="button"
                disabled={exporting === 'postgres'}
                onClick={() => handleExport('postgres')}
                className="w-full py-2 px-3 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${exporting === 'postgres' ? 'animate-bounce' : ''}`} />
                <span>{exporting === 'postgres' ? 'Generating Postgres...' : 'Export Cloud Postgres'}</span>
              </button>
            </div>

            {/* JSON Export */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400">
                  <FileJson className="w-4 h-4" />
                  <h4 className="font-bold text-sm text-white">System Archive (.json)</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Complete JSON backup of all portal collections, CMS pages, committee records, media paths, and global settings.
                </p>
              </div>
              <button
                type="button"
                disabled={exporting === 'json'}
                onClick={() => handleExport('json')}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${exporting === 'json' ? 'animate-bounce' : ''}`} />
                <span>{exporting === 'json' ? 'Generating JSON...' : 'Download JSON Archive'}</span>
              </button>
            </div>

            {/* CSV Export */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-blue-400">
                  <FileSpreadsheet className="w-4 h-4" />
                  <h4 className="font-bold text-sm text-white">Attendee Roster (.csv)</h4>
                </div>
                <p className="text-xs text-slate-300">
                  RFC-4180 CSV spreadsheet containing event attendees, T-Shirt sizes, batches, payment status, and entry tokens.
                </p>
              </div>
              <button
                type="button"
                disabled={exporting === 'csv'}
                onClick={() => handleExport('csv')}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${exporting === 'csv' ? 'animate-bounce' : ''}`} />
                <span>{exporting === 'csv' ? 'Exporting CSV...' : 'Download Attendee CSV'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Portability Setup Guide */}
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-700" />
              Production Deployment Instructions (Supabase & cPanel)
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

          <div className="text-xs text-slate-600 space-y-2">
            <p>
              To run this application against your production <strong>Supabase PostgreSQL</strong> or <strong>cPanel MySQL</strong>:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-2 font-medium">
              <li>
                In Supabase SQL editor or cPanel phpMyAdmin, you can run the SQL dump from the backup tool above or <code className="bg-white px-1.5 py-0.5 rounded border">server/db/schema.sql</code>.
              </li>
              <li>
                Configure the environment variables in your server or hosting control panel.
              </li>
              <li>
                The backend automatically uses connection pooling, parameterized queries, and bi-directional real-time sync.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
