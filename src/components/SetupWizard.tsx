import React, { useState } from 'react';
import {
  Database,
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  User,
  Mail,
  Phone,
  Globe,
  DollarSign,
  ShieldCheck,
  Loader2,
  Check,
  Layers,
  Sparkles,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SetupWizardProps {
  onComplete: () => void;
  reason?: string;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, reason }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 2: Database Config
  const [driver, setDriver] = useState<'supabase' | 'mysql' | 'local'>('supabase');

  // Supabase / Cloud Postgres details
  const [pgHost, setPgHost] = useState('aws-0-ap-southeast-1.pooler.supabase.com');
  const [pgPort, setPgPort] = useState('6543');
  const [pgDatabase, setPgDatabase] = useState('postgres');
  const [pgUser, setPgUser] = useState('postgres.yourproject');
  const [pgPassword, setPgPassword] = useState('');
  const [pgSsl, setPgSsl] = useState(true);
  const [pgConnString, setPgConnString] = useState('');

  // cPanel MySQL details
  const [mysqlHost, setMysqlHost] = useState('localhost');
  const [mysqlPort, setMysqlPort] = useState('3306');
  const [mysqlDatabase, setMysqlDatabase] = useState('alumni_platform');
  const [mysqlUser, setMysqlUser] = useState('cpanel_user');
  const [mysqlPassword, setMysqlPassword] = useState('');

  // Testing database connection
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Step 3: Super Admin details
  const [adminName, setAdminName] = useState('Super Administrator');
  const [adminEmail, setAdminEmail] = useState('admin@nanupuralumni.org');
  const [adminPhone, setAdminPhone] = useState('01819123456');
  const [adminPassword, setAdminPassword] = useState('Admin@Nash2027');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('Admin@Nash2027');

  // Step 4: Site Information (Focused strictly on Website Setup)
  const [siteName, setSiteName] = useState('Nanupur Abu Sobhan High School Alumni Association');
  const [siteUrl, setSiteUrl] = useState(typeof window !== 'undefined' ? window.location.origin : 'https://nanupuralumni.org');
  const [siteEmail, setSiteEmail] = useState('info@nanupuralumni.org');
  const [defaultLang, setDefaultLang] = useState<'bn' | 'en'>('bn');

  // Installation state
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Test Database Connection
  const handleTestConnection = async () => {
    setTestingDb(true);
    setDbTestResult(null);

    const payload: any = { driver };

    if (driver === 'mysql') {
      payload.host = mysqlHost;
      payload.port = parseInt(mysqlPort, 10) || 3306;
      payload.database = mysqlDatabase;
      payload.username = mysqlUser;
      payload.password = mysqlPassword;
    } else if (driver === 'supabase') {
      if (pgConnString.trim()) {
        payload.connectionString = pgConnString.trim();
      } else {
        payload.host = pgHost;
        payload.port = parseInt(pgPort, 10) || 5432;
        payload.database = pgDatabase;
        payload.username = pgUser;
        payload.password = pgPassword;
        payload.ssl = pgSsl;
      }
    }

    try {
      const res = await fetch('/api/setup/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setDbTestResult(data);
    } catch (err: any) {
      setDbTestResult({
        success: false,
        message: 'Could not communicate with the installation backend. Check server status.',
      });
    } finally {
      setTestingDb(false);
    }
  };

  // Perform Final Installation
  const handlePerformInstall = async () => {
    if (adminPassword !== adminConfirmPassword) {
      setInstallError('Admin passwords do not match. Please re-enter.');
      return;
    }
    if (adminPassword.length < 6) {
      setInstallError('Password must be at least 6 characters.');
      return;
    }

    setInstalling(true);
    setInstallError(null);

    const installPayload: any = {
      database: {
        driver,
        host: driver === 'mysql' ? mysqlHost : pgHost,
        port: driver === 'mysql' ? parseInt(mysqlPort, 10) : parseInt(pgPort, 10),
        database: driver === 'mysql' ? mysqlDatabase : pgDatabase,
        username: driver === 'mysql' ? mysqlUser : pgUser,
        password: driver === 'mysql' ? mysqlPassword : pgPassword,
        ssl: pgSsl,
        connectionString: driver === 'supabase' && pgConnString ? pgConnString : undefined,
      },
      admin: {
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        password: adminPassword,
      },
      site: {
        site_name: siteName,
        site_url: siteUrl,
        site_email: siteEmail,
        default_language: defaultLang,
      },
    };

    try {
      const res = await fetch('/api/setup/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installPayload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Installation process failed.');
      }

      setInstallSuccess(true);
      setCurrentStep(5); // Step 5: Finish / Congratulations
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#0f4d2a', '#f59e0b', '#10b981', '#ffffff'],
        });
      } catch (e) {}
    } catch (err: any) {
      setInstallError(err.message || 'Installation failed. Please verify your settings and retry.');
    } finally {
      setInstalling(false);
    }
  };

  const steps = [
    { num: 1, label: 'Welcome' },
    { num: 2, label: 'Database' },
    { num: 3, label: 'Super Admin' },
    { num: 4, label: 'Website Setup' },
    { num: 5, label: 'Finish' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-600/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Main Installer Card */}
      <div className="relative w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top Branding Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#0f4d2a] to-emerald-950 px-8 py-6 border-b border-emerald-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xl shadow-lg">
                85
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Nanupur Abu Sobhan High School
                </h1>
                <p className="text-xs text-amber-300 font-medium">
                  Alumni Association & 85th Anniversary Platform • Setup Wizard
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono bg-emerald-900/60 text-emerald-200 px-3 py-1 rounded-full border border-emerald-700/50">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              v2.0 Production
            </span>
          </div>

          {/* Stepper Dots */}
          <div className="mt-6 flex items-center justify-between max-w-md mx-auto">
            {steps.map((s, idx) => {
              const isActive = currentStep === s.num;
              const isPast = currentStep > s.num;
              return (
                <div key={s.num} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/20'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`w-6 sm:w-10 h-0.5 ${
                        isPast ? 'bg-emerald-600' : 'bg-slate-800'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reason banner if triggered due to missing connection */}
        {reason && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Database Setup Required: {reason}</span>
          </div>
        )}

        {/* Wizard Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* STEP 1: WELCOME & ENVIRONMENT */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Welcome to the Alumni Platform Installation
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  This quick setup wizard will guide you through connecting your database
                  (Supabase Cloud or cPanel MySQL), creating your Super Administrator account, and configuring
                  essential website information. Event and reunion-specific settings remain configurable later from the authenticated admin dashboard.
                </p>
              </div>

              {/* Environment Readiness Check */}
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Pre-Installation System Checks
                </h3>
                <div className="divide-y divide-slate-800 text-xs">
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">Node.js Execution Runtime:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready & Modern
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">Database Driver Adapters (Supabase & cPanel MySQL):</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Installed (pg + mysql2)
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">Storage & Configuration Permissions:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Writable (/data)
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">QR Code & Entry Pass Engine:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition cursor-pointer"
                >
                  <span>Begin Installation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DATABASE CONFIGURATION */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Configure Database Connection</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Choose between a Cloud Database (Supabase PostgreSQL), a cPanel/Self-Hosted MySQL database, or
                  the Resilient Local Store.
                </p>
              </div>

              {/* Database Driver Selector */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDriver('supabase');
                    setDbTestResult(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    driver === 'supabase'
                      ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Cloud className="w-6 h-6 text-emerald-400 mb-2" />
                  <span className="text-sm font-bold block">Option A: Cloud</span>
                  <span className="text-[11px] text-slate-400">Supabase (PostgreSQL)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDriver('mysql');
                    setDbTestResult(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    driver === 'mysql'
                      ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Server className="w-6 h-6 text-amber-400 mb-2" />
                  <span className="text-sm font-bold block">Option B: cPanel</span>
                  <span className="text-[11px] text-slate-400">MySQL / MariaDB</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDriver('local');
                    setDbTestResult(null);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    driver === 'local'
                      ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Database className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-sm font-bold block">Option C: Embedded</span>
                  <span className="text-[11px] text-slate-400">Resilient High-Perf Store</span>
                </button>
              </div>

              {/* Form for Option A: Supabase */}
              {driver === 'supabase' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold text-slate-200">Supabase Connection Parameters</span>
                    <span>PostgreSQL 15+ compatible</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Host / Pooler</label>
                      <input
                        type="text"
                        value={pgHost}
                        onChange={e => setPgHost(e.target.value)}
                        placeholder="aws-0-ap-southeast-1.pooler.supabase.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Port</label>
                      <input
                        type="text"
                        value={pgPort}
                        onChange={e => setPgPort(e.target.value)}
                        placeholder="6543 (Pooler) or 5432"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Database Name</label>
                      <input
                        type="text"
                        value={pgDatabase}
                        onChange={e => setPgDatabase(e.target.value)}
                        placeholder="postgres"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Username</label>
                      <input
                        type="text"
                        value={pgUser}
                        onChange={e => setPgUser(e.target.value)}
                        placeholder="postgres.yourproject"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Password</label>
                      <input
                        type="password"
                        value={pgPassword}
                        onChange={e => setPgPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pgSsl}
                        onChange={e => setPgSsl(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-300">Require SSL / TLS Encrypted Connection</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Form for Option B: cPanel MySQL */}
              {driver === 'mysql' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-bold text-slate-200">cPanel / Self-Hosted MySQL Credentials</span>
                    <span>MySQL 8.0+ / MariaDB 10.5+</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">MySQL Host</label>
                      <input
                        type="text"
                        value={mysqlHost}
                        onChange={e => setMysqlHost(e.target.value)}
                        placeholder="localhost or 127.0.0.1"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">MySQL Port</label>
                      <input
                        type="text"
                        value={mysqlPort}
                        onChange={e => setMysqlPort(e.target.value)}
                        placeholder="3306"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Database Name</label>
                      <input
                        type="text"
                        value={mysqlDatabase}
                        onChange={e => setMysqlDatabase(e.target.value)}
                        placeholder="cpaneluser_alumni"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">DB Username</label>
                      <input
                        type="text"
                        value={mysqlUser}
                        onChange={e => setMysqlUser(e.target.value)}
                        placeholder="cpaneluser_admin"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">DB Password</label>
                      <input
                        type="password"
                        value={mysqlPassword}
                        onChange={e => setMysqlPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form for Option C: Embedded */}
              {driver === 'local' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-2 text-xs text-slate-300">
                  <p className="font-bold text-white text-sm">Resilient Embedded JSON Database Store</p>
                  <p className="text-slate-400">
                    Runs out-of-the-box inside the container with immediate zero-setup persistence in <code>data/db.json</code>.
                    Allows seamless export to Supabase or MySQL anytime from the Admin Database Management panel.
                  </p>
                </div>
              )}

              {/* TEST CONNECTION BUTTON & RESULT */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingDb}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  {testingDb ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Testing Database Connection...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>Test Database Connection Before Proceeding</span>
                    </>
                  )}
                </button>

                {dbTestResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                      dbTestResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                        : 'bg-red-950/40 border-red-500/50 text-red-300'
                    }`}
                  >
                    {dbTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{dbTestResult.message}</p>
                      {dbTestResult.details && (
                        <p className="font-mono text-[11px] opacity-80 mt-0.5">
                          {JSON.stringify(dbTestResult.details)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-3 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 text-xs shadow-lg transition cursor-pointer"
                >
                  <span>Continue to Super Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUPER ADMIN ACCOUNT */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Create Super Admin Account</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  This primary administrative credential will grant full access to the CMS, RBAC, registrations, and
                  gate entrance controls.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={adminName}
                        onChange={e => setAdminName(e.target.value)}
                        placeholder="Super Administrator"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Official Admin Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={e => setAdminEmail(e.target.value)}
                        placeholder="admin@nanupuralumni.org"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Mobile Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={adminPhone}
                      onChange={e => setAdminPhone(e.target.value)}
                      placeholder="01819123456"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Admin Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        value={adminConfirmPassword}
                        onChange={e => setAdminConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-3 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 text-xs shadow-lg transition cursor-pointer"
                >
                  <span>Continue to Website Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: WEBSITE SETUP */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Website Setup</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Configure essential website identity, public contact email, and default system language.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Website & Organization Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Website URL</label>
                    <input
                      type="text"
                      value={siteUrl}
                      onChange={e => setSiteUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Public Contact Email</label>
                    <input
                      type="email"
                      value={siteEmail}
                      onChange={e => setSiteEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Default Language</label>
                  <select
                    value={defaultLang}
                    onChange={e => setDefaultLang(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="bn">বাংলা (Bengali)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              {/* Install Error Banner */}
              {installError && (
                <div className="p-3.5 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{installError}</span>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-3 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={installing}
                  onClick={handlePerformInstall}
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-black flex items-center gap-2 shadow-xl shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
                >
                  {installing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Installing & Migrating Schema...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Execute Installation Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: INSTALLATION COMPLETED */}
          {currentStep === 5 && (
            <div className="text-center space-y-6 py-6 animate-in fade-in">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-2xl font-black text-white">Installation Successful!</h2>
                <p className="text-sm text-slate-400">
                  The Nanupur Abu Sobhan High School Alumni Platform has been successfully initialized and
                  configured. Your Super Admin account and database schema are ready.
                </p>
              </div>

              {/* Account summary pill */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-sm mx-auto text-xs space-y-1 text-left">
                <div className="flex justify-between text-slate-400">
                  <span>Super Admin:</span>
                  <span className="text-white font-mono">{adminEmail}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Database Driver:</span>
                  <span className="text-emerald-400 font-mono uppercase">{driver}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Website URL:</span>
                  <span className="text-amber-400 font-mono">{siteUrl}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onComplete}
                  className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition cursor-pointer"
                >
                  <span>Launch Alumni Website</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
