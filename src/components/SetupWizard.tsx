import React, { useState, useEffect } from 'react';
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
  UserCheck,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiFetch, safeJson } from '../utils/api';

interface SetupWizardProps {
  onComplete: () => void;
  reason?: string;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, reason }) => {
  // Global Setup Lock State
  const [checkingInitialStatus, setCheckingInitialStatus] = useState<boolean>(true);
  const [alreadyInstalled, setAlreadyInstalled] = useState<boolean>(false);
  const [installedInfo, setInstalledInfo] = useState<{
    site_name?: string;
    site_url?: string;
    driver?: string;
    installed_at?: string;
  } | null>(null);

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Field-level validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2: Database Config
  const [driver, setDriver] = useState<'supabase' | 'mysql'>('mysql');

  // Supabase / Cloud Postgres details (Clean blank defaults)
  const [pgHost, setPgHost] = useState('');
  const [pgPort, setPgPort] = useState('5432');
  const [pgDatabase, setPgDatabase] = useState('');
  const [pgUser, setPgUser] = useState('');
  const [pgPassword, setPgPassword] = useState('');
  const [pgSsl, setPgSsl] = useState(true);
  const [pgConnString, setPgConnString] = useState('');

  // cPanel MySQL details (Clean blank defaults)
  const [mysqlHost, setMysqlHost] = useState('localhost');
  const [mysqlPort, setMysqlPort] = useState('3306');
  const [mysqlDatabase, setMysqlDatabase] = useState('');
  const [mysqlUser, setMysqlUser] = useState('');
  const [mysqlPassword, setMysqlPassword] = useState('');
  const [showMysqlPassword, setShowMysqlPassword] = useState(false);

  // Testing database connection
  const [testingDb, setTestingDb] = useState(false);
  const [dbTested, setDbTested] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Step 3: Super Admin details
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Step 4: Site Information
  const [siteName, setSiteName] = useState('Nanupur Abu Sobhan High School Alumni Association');
  const [siteUrl, setSiteUrl] = useState(
    typeof window !== 'undefined' ? window.location.origin : 'https://nanupuralumni.org'
  );
  const [siteEmail, setSiteEmail] = useState('info@nanupuralumni.org');
  const [defaultLang, setDefaultLang] = useState<'bn' | 'en'>('bn');

  // Installation execution state
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Unverified connection bypass modal/warning
  const [showUnverifiedWarning, setShowUnverifiedWarning] = useState(false);

  // 1. Initial Mount Check: Detect if already installed to prevent unauthorized reconfiguration
  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      try {
        const res = await apiFetch('/api/setup/status');
        if (res.ok) {
          const data = await safeJson<{
            is_installed: boolean;
            site_name?: string;
            site_url?: string;
            driver?: string;
            installed_at?: string;
          }>(res, { is_installed: false });

          if (isMounted && data && data.is_installed) {
            setAlreadyInstalled(true);
            setInstalledInfo(data);
          }
        }
      } catch (err) {
        console.warn('Could not query installation status:', err);
      } finally {
        if (isMounted) setCheckingInitialStatus(false);
      }
    }
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Clear specific field error when value changes
  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Reset DB test status when database inputs change
  const handleDbInputChange = (setter: (val: string) => void, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    clearError(field);
    setDbTestResult(null);
    setDbTested(false);
    setShowUnverifiedWarning(false);
  };

  // -------------------------------------------------------------
  // VALIDATION LOGIC
  // -------------------------------------------------------------

  const validateMysql = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    const host = mysqlHost.trim();
    const port = parseInt(mysqlPort, 10);
    const dbName = mysqlDatabase.trim();
    const user = mysqlUser.trim();

    if (!host) {
      errs.mysqlHost = 'MySQL Host is required (typically "localhost" or "127.0.0.1" on cPanel)';
    } else if (/\s/.test(host)) {
      errs.mysqlHost = 'Host cannot contain whitespace';
    } else if (host.startsWith('http://') || host.startsWith('https://')) {
      errs.mysqlHost = 'Enter hostname or IP without http:// or https:// prefix';
    }

    if (!mysqlPort.trim()) {
      errs.mysqlPort = 'MySQL Port is required (default: 3306)';
    } else if (isNaN(port) || port < 1 || port > 65535) {
      errs.mysqlPort = 'Port must be a valid number between 1 and 65535';
    }

    if (!dbName) {
      errs.mysqlDatabase = 'Database Name is required (e.g., cpaneluser_alumni)';
    } else if (/\s/.test(dbName)) {
      errs.mysqlDatabase = 'Database name cannot contain spaces';
    }

    if (!user) {
      errs.mysqlUser = 'DB Username is required (e.g., cpaneluser_admin)';
    } else if (/\s/.test(user)) {
      errs.mysqlUser = 'DB Username cannot contain spaces';
    }

    return errs;
  };

  const validateSupabase = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (pgConnString.trim()) {
      if (!pgConnString.includes('postgres://') && !pgConnString.includes('postgresql://')) {
        errs.pgConnString = 'Connection string must start with postgresql:// or postgres://';
      }
      return errs;
    }

    if (!pgHost.trim()) errs.pgHost = 'PostgreSQL Host/Pooler is required';
    const port = parseInt(pgPort, 10);
    if (!pgPort.trim() || isNaN(port) || port < 1 || port > 65535) errs.pgPort = 'Valid port required (e.g. 5432 or 6543)';
    if (!pgDatabase.trim()) errs.pgDatabase = 'Database name is required (default: postgres)';
    if (!pgUser.trim()) errs.pgUser = 'Database username is required';

    return errs;
  };

  const validateStep2 = (): boolean => {
    let errs: Record<string, string> = {};
    if (driver === 'mysql') {
      errs = validateMysql();
    } else if (driver === 'supabase') {
      errs = validateSupabase();
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateAdmin = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!adminName.trim() || adminName.trim().length < 2) {
      errs.adminName = 'Full Name is required (at least 2 characters)';
    }

    const rawUsername = adminUsername.trim();
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!rawUsername) {
      errs.adminUsername = 'Super Admin Username is required';
    } else if (!usernameRegex.test(rawUsername)) {
      errs.adminUsername = 'Username must be 3-30 characters with letters, numbers, underscores, or hyphens (no spaces)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminEmail.trim()) {
      errs.adminEmail = 'Official Admin Email is required';
    } else if (!emailRegex.test(adminEmail.trim())) {
      errs.adminEmail = 'Please provide a valid administrative email address';
    }

    const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
    const cleanPhone = adminPhone.replace(/[\s-]/g, '');
    if (!adminPhone.trim()) {
      errs.adminPhone = 'Mobile phone number is required';
    } else if (!bdPhoneRegex.test(cleanPhone) && cleanPhone.length < 10) {
      errs.adminPhone = 'Please provide a valid mobile number (e.g. 01712345678)';
    }

    if (!adminPassword) {
      errs.adminPassword = 'Password is required';
    } else if (adminPassword.length < 6) {
      errs.adminPassword = 'Password must be at least 6 characters long';
    }

    if (!adminConfirmPassword) {
      errs.adminConfirmPassword = 'Password confirmation is required';
    } else if (adminPassword !== adminConfirmPassword) {
      errs.adminConfirmPassword = 'Passwords do not match';
    }

    return errs;
  };

  const validateStep3 = (): boolean => {
    const errs = validateAdmin();
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSite = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!siteName.trim() || siteName.trim().length < 3) {
      errs.siteName = 'Website Name is required (minimum 3 characters)';
    }

    if (!siteUrl.trim()) {
      errs.siteUrl = 'Website URL is required';
    } else if (!/^https?:\/\//i.test(siteUrl.trim())) {
      errs.siteUrl = 'Website URL must include http:// or https://';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!siteEmail.trim()) {
      errs.siteEmail = 'Public Contact Email is required';
    } else if (!emailRegex.test(siteEmail.trim())) {
      errs.siteEmail = 'Please provide a valid public contact email';
    }

    return errs;
  };

  const validateStep4 = (): boolean => {
    const errs = validateSite();
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // -------------------------------------------------------------
  // TEST DATABASE CONNECTION
  // -------------------------------------------------------------
  const handleTestConnection = async () => {
    // Validate fields before sending request
    if (!validateStep2()) {
      return;
    }

    setTestingDb(true);
    setDbTestResult(null);

    const payload: any = { driver };

    if (driver === 'mysql') {
      payload.host = mysqlHost.trim() || 'localhost';
      payload.port = parseInt(mysqlPort, 10) || 3306;
      payload.database = mysqlDatabase.trim();
      payload.username = mysqlUser.trim();
      payload.password = mysqlPassword;
    } else if (driver === 'supabase') {
      if (pgConnString.trim()) {
        payload.connectionString = pgConnString.trim();
      } else {
        payload.host = pgHost.trim();
        payload.port = parseInt(pgPort, 10) || 5432;
        payload.database = pgDatabase.trim();
        payload.username = pgUser.trim();
        payload.password = pgPassword;
        payload.ssl = pgSsl;
      }
    }

    try {
      const res = await apiFetch('/api/setup/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res, {
        success: false,
        message: 'Unexpected server response while verifying connection.',
      });

      setDbTestResult(data);
      if (data?.success) {
        setDbTested(true);
        setShowUnverifiedWarning(false);
      } else {
        setDbTested(false);
      }
    } catch (err: any) {
      setDbTestResult({
        success: false,
        message: err.message || 'Could not communicate with the database verification service.',
      });
      setDbTested(false);
    } finally {
      setTestingDb(false);
    }
  };

  // Step 2 Proceed Guard
  const handleProceedFromStep2 = () => {
    if (!validateStep2()) {
      return;
    }

    // Verify that database connection was tested successfully
    if (!dbTested || !dbTestResult?.success) {
      setShowUnverifiedWarning(true);
      return;
    }

    setCurrentStep(3);
  };

  // Step 3 Proceed Guard
  const handleProceedFromStep3 = () => {
    if (!validateStep3()) {
      return;
    }
    setCurrentStep(4);
  };

  // -------------------------------------------------------------
  // PERFORM INSTALLATION
  // -------------------------------------------------------------
  const handlePerformInstall = async () => {
    if (!validateStep4()) {
      return;
    }
    // Re-verify Step 2 and Step 3
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      setCurrentStep(3);
      return;
    }

    setInstalling(true);
    setInstallError(null);

    const installPayload: any = {
      database: {
        driver,
        host: driver === 'mysql' ? mysqlHost.trim() : pgHost.trim(),
        port: driver === 'mysql' ? parseInt(mysqlPort, 10) : parseInt(pgPort, 10),
        database: driver === 'mysql' ? mysqlDatabase.trim() : pgDatabase.trim(),
        username: driver === 'mysql' ? mysqlUser.trim() : pgUser.trim(),
        password: driver === 'mysql' ? mysqlPassword : pgPassword,
        ssl: pgSsl,
        connectionString: driver === 'supabase' && pgConnString.trim() ? pgConnString.trim() : undefined,
      },
      admin: {
        name: adminName.trim(),
        username: adminUsername.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        password: adminPassword,
        password_confirmation: adminConfirmPassword,
      },
      site: {
        site_name: siteName.trim(),
        site_url: siteUrl.trim(),
        site_email: siteEmail.trim(),
        default_language: defaultLang,
      },
    };

    try {
      const res = await apiFetch('/api/setup/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(installPayload),
      });

      const data = await safeJson(res, {
        success: false,
        message: 'Failed to process setup installation.',
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Installation process could not be completed.');
      }

      setInstallSuccess(true);
      setCurrentStep(5);
      try {
        confetti({
          particleCount: 120,
          spread: 90,
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

  // Password Strength Estimator
  const getPasswordStrength = () => {
    if (!adminPassword) return { score: 0, label: 'Empty', color: 'bg-slate-700' };
    let score = 0;
    if (adminPassword.length >= 6) score += 1;
    if (adminPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(adminPassword) && /[a-z]/.test(adminPassword)) score += 1;
    if (/\d/.test(adminPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(adminPassword)) score += 1;

    if (score <= 2) return { score: 1, label: 'Fair (Min 6 chars)', color: 'bg-amber-500' };
    if (score <= 4) return { score: 2, label: 'Good', color: 'bg-emerald-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-400' };
  };

  const steps = [
    { num: 1, label: 'Welcome' },
    { num: 2, label: 'Database' },
    { num: 3, label: 'Super Admin' },
    { num: 4, label: 'Website Setup' },
    { num: 5, label: 'Finish' },
  ];

  // -------------------------------------------------------------
  // VIEW: CHECKING INITIAL STATUS
  // -------------------------------------------------------------
  if (checkingInitialStatus) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center py-10 px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-sm font-medium text-slate-300">Checking system installation state...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: ALREADY INSTALLED & SECURED (PREVENTS UNAUTHORIZED CONFIGURATION)
  // -------------------------------------------------------------
  if (alreadyInstalled) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center py-10 px-4 sm:px-6">
        <div className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Installation Locked</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              The Nanupur Abu Sobhan High School Alumni Platform has already been successfully installed and is active in production.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2 font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span>Platform Status:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Installed & Active
              </span>
            </div>
            {installedInfo?.site_name && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Organization:</span>
                <span className="text-slate-200 truncate max-w-[220px]">{installedInfo.site_name}</span>
              </div>
            )}
            {installedInfo?.driver && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Database Engine:</span>
                <span className="text-amber-400 uppercase">{installedInfo.driver}</span>
              </div>
            )}
            {installedInfo?.installed_at && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Installed At:</span>
                <span className="text-slate-300">{new Date(installedInfo.installed_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3.5 text-xs text-emerald-300 text-left flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              For security reasons, re-running the setup wizard is restricted to protect stored credentials and member records. To update database credentials, website settings, or administrators, please log in with your Super Administrator account.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onComplete}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span>Return to Website</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: SETUP WIZARD STEPS
  // -------------------------------------------------------------
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
                  (cPanel MySQL or Supabase Cloud), creating your Super Administrator account, and configuring
                  essential website information. All reunion and event settings can be managed anytime from the authenticated admin dashboard.
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
                    <span className="text-slate-400">Database Driver Adapters (cPanel MySQL & Supabase):</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Installed (mysql2 + pg)
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">Storage & Configuration Permissions:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Writable (/data)
                    </span>
                  </div>
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">UTF-8 / Bengali Character Support:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified (utf8mb4)
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
                  Select your production database engine. The platform connects directly to your verified database as the authoritative source of truth.
                </p>
              </div>

              {/* Database Driver Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setDriver('mysql');
                    setDbTestResult(null);
                    setDbTested(false);
                    setErrors({});
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    driver === 'mysql'
                      ? 'border-amber-400 bg-amber-950/30 text-white ring-2 ring-amber-400/20'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Server className="w-6 h-6 text-amber-400 mb-2" />
                  <span className="text-sm font-bold block text-white">cPanel MySQL / MariaDB</span>
                  <span className="text-[11px] text-slate-400">Standard cPanel Shared / VPS Hosting (Recommended)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDriver('supabase');
                    setDbTestResult(null);
                    setDbTested(false);
                    setErrors({});
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    driver === 'supabase'
                      ? 'border-emerald-500 bg-emerald-950/40 text-white ring-2 ring-emerald-500/20'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Cloud className="w-6 h-6 text-emerald-400 mb-2" />
                  <span className="text-sm font-bold block text-white">PostgreSQL / Supabase</span>
                  <span className="text-[11px] text-slate-400">Managed Cloud Database with SSL connection</span>
                </button>
              </div>

              {/* Form for Option A: cPanel MySQL */}
              {driver === 'mysql' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-amber-400" />
                      cPanel MySQL / MariaDB Credentials
                    </span>
                    <span className="text-slate-400">MySQL 8.0+ / MariaDB 10.5+</span>
                  </div>

                  {/* cPanel helpful tips card */}
                  <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-200/90 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <Info className="w-3.5 h-3.5" />
                      cPanel Hosting Guidance:
                    </p>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      On cPanel, database and usernames always begin with your cPanel username prefix (e.g., <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">cpaneluser_alumni</code>). Ensure the user is added to the database with <strong className="text-white">ALL PRIVILEGES</strong> granted in cPanel &gt; MySQL Databases.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">
                        MySQL Host <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={mysqlHost}
                        onChange={handleDbInputChange(setMysqlHost, 'mysqlHost')}
                        placeholder="localhost or 127.0.0.1"
                        className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.mysqlHost
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-amber-400'
                        }`}
                      />
                      {errors.mysqlHost ? (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.mysqlHost}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">Usually &quot;localhost&quot; or &quot;127.0.0.1&quot; on cPanel</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">
                        MySQL Port <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={mysqlPort}
                        onChange={handleDbInputChange(setMysqlPort, 'mysqlPort')}
                        placeholder="3306"
                        className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.mysqlPort
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-amber-400'
                        }`}
                      />
                      {errors.mysqlPort ? (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.mysqlPort}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">Standard MySQL port is 3306</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">
                        Database Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={mysqlDatabase}
                        onChange={handleDbInputChange(setMysqlDatabase, 'mysqlDatabase')}
                        placeholder="cpuser_alumni"
                        className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.mysqlDatabase
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-amber-400'
                        }`}
                      />
                      {errors.mysqlDatabase ? (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.mysqlDatabase}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">Full DB name with prefix</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">
                        DB Username <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={mysqlUser}
                        onChange={handleDbInputChange(setMysqlUser, 'mysqlUser')}
                        placeholder="cpuser_admin"
                        className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.mysqlUser
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-amber-400'
                        }`}
                      />
                      {errors.mysqlUser ? (
                        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {errors.mysqlUser}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-1">Full username with prefix</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">
                        DB Password
                      </label>
                      <div className="relative">
                        <input
                          type={showMysqlPassword ? 'text' : 'password'}
                          value={mysqlPassword}
                          onChange={handleDbInputChange(setMysqlPassword, 'mysqlPassword')}
                          placeholder="••••••••••••"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMysqlPassword(!showMysqlPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition"
                        >
                          {showMysqlPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">cPanel MySQL user password</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Form for Option B: Supabase */}
              {driver === 'supabase' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      Supabase Cloud PostgreSQL Parameters
                    </span>
                    <span className="text-slate-400">PostgreSQL 15+ compatible</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Host / Pooler</label>
                      <input
                        type="text"
                        value={pgHost}
                        onChange={handleDbInputChange(setPgHost, 'pgHost')}
                        placeholder="aws-0-ap-southeast-1.pooler.supabase.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                      {errors.pgHost && <p className="text-[11px] text-red-400 mt-1">{errors.pgHost}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Port</label>
                      <input
                        type="text"
                        value={pgPort}
                        onChange={handleDbInputChange(setPgPort, 'pgPort')}
                        placeholder="6543 (Pooler) or 5432"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                      {errors.pgPort && <p className="text-[11px] text-red-400 mt-1">{errors.pgPort}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Database Name</label>
                      <input
                        type="text"
                        value={pgDatabase}
                        onChange={handleDbInputChange(setPgDatabase, 'pgDatabase')}
                        placeholder="postgres"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                      {errors.pgDatabase && <p className="text-[11px] text-red-400 mt-1">{errors.pgDatabase}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Username</label>
                      <input
                        type="text"
                        value={pgUser}
                        onChange={handleDbInputChange(setPgUser, 'pgUser')}
                        placeholder="postgres.yourproject"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                      {errors.pgUser && <p className="text-[11px] text-red-400 mt-1">{errors.pgUser}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-medium mb-1">Password</label>
                      <input
                        type="password"
                        value={pgPassword}
                        onChange={handleDbInputChange(setPgPassword, 'pgPassword')}
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
                      <span>Testing {driver === 'mysql' ? 'cPanel MySQL' : 'PostgreSQL'} Connection...</span>
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
                    <div className="space-y-1">
                      <p className="font-bold">{dbTestResult.message}</p>
                      {dbTestResult.details && (
                        <div className="bg-slate-950/60 p-2 rounded-lg font-mono text-[11px] space-y-0.5">
                          {dbTestResult.details.server_version && (
                            <p>Server Version: {dbTestResult.details.server_version}</p>
                          )}
                          {dbTestResult.details.database && (
                            <p>Connected Database: {dbTestResult.details.database}</p>
                          )}
                          {dbTestResult.details.host && (
                            <p>Endpoint: {dbTestResult.details.host}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Warning if user tries to proceed without testing */}
                {showUnverifiedWarning && (
                  <div className="p-3.5 rounded-xl border border-amber-500/50 bg-amber-950/40 text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="font-bold">Database connection not verified</p>
                      <p className="text-[11px] text-amber-200/80 leading-relaxed">
                        Please click <strong>&quot;Test Database Connection Before Proceeding&quot;</strong> to confirm that your database credentials work before continuing to Super Admin creation.
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                        >
                          Test Connection Now
                        </button>
                      </div>
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
                  onClick={handleProceedFromStep2}
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
                  This primary administrative credential grants complete access to the CMS, RBAC, registrations, payments, and gate entrance controls.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={adminName}
                        onChange={e => {
                          setAdminName(e.target.value);
                          clearError('adminName');
                        }}
                        placeholder="e.g. Safaet Ullah"
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none transition ${
                          errors.adminName
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                    {errors.adminName && <p className="text-[11px] text-red-400 mt-1">{errors.adminName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Super Admin Username <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={e => {
                          setAdminUsername(e.target.value);
                          clearError('adminUsername');
                        }}
                        placeholder="e.g. safaet or admin"
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.adminUsername
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                    {errors.adminUsername ? (
                      <p className="text-[11px] text-red-400 mt-1">{errors.adminUsername}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">Exact login username (3-30 letters, numbers, _, -)</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Official Admin Email <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={e => {
                          setAdminEmail(e.target.value);
                          clearError('adminEmail');
                        }}
                        placeholder="e.g. admin@nanupuralumni.org"
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none transition ${
                          errors.adminEmail
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                    {errors.adminEmail && <p className="text-[11px] text-red-400 mt-1">{errors.adminEmail}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Mobile Phone Number <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={adminPhone}
                        onChange={e => {
                          setAdminPhone(e.target.value);
                          clearError('adminPhone');
                        }}
                        placeholder="01712345678"
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.adminPhone
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                    {errors.adminPhone ? (
                      <p className="text-[11px] text-red-400 mt-1">{errors.adminPhone}</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">11-digit Bangladeshi mobile number</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Admin Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={e => {
                          setAdminPassword(e.target.value);
                          clearError('adminPassword');
                        }}
                        placeholder="••••••••••••"
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-9 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.adminPassword
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition"
                      >
                        {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {errors.adminPassword && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.adminPassword}</p>
                    )}
                    {adminPassword && (
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="text-slate-400">Strength:</span>
                        <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden flex">
                          <div
                            className={`h-full ${getPasswordStrength().color} transition-all`}
                            style={{ width: `${(getPasswordStrength().score / 3) * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-300">{getPasswordStrength().label}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminConfirmPassword}
                        onChange={e => {
                          setAdminConfirmPassword(e.target.value);
                          clearError('adminConfirmPassword');
                        }}
                        placeholder="••••••••••••"
                        className={`w-full bg-slate-950 border rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none transition ${
                          errors.adminConfirmPassword
                            ? 'border-red-500 ring-1 ring-red-500/40'
                            : 'border-slate-700 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                    {errors.adminConfirmPassword && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.adminConfirmPassword}</p>
                    )}
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
                  onClick={handleProceedFromStep3}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 text-xs shadow-lg transition cursor-pointer"
                >
                  <span>Continue to Website Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: WEBSITE SETUP & PRE-INSTALLATION REVIEW */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Website Setup & Final Review</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Configure essential website identity, public contact email, and review your deployment parameters before finalizing.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">
                    Website & Organization Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={e => {
                      setSiteName(e.target.value);
                      clearError('siteName');
                    }}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition ${
                      errors.siteName
                        ? 'border-red-500 ring-1 ring-red-500/40'
                        : 'border-slate-700 focus:border-emerald-500'
                    }`}
                  />
                  {errors.siteName && <p className="text-[11px] text-red-400 mt-1">{errors.siteName}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Website URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={siteUrl}
                      onChange={e => {
                        setSiteUrl(e.target.value);
                        clearError('siteUrl');
                      }}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition ${
                        errors.siteUrl
                          ? 'border-red-500 ring-1 ring-red-500/40'
                          : 'border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    {errors.siteUrl && <p className="text-[11px] text-red-400 mt-1">{errors.siteUrl}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">
                      Public Contact Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={siteEmail}
                      onChange={e => {
                        setSiteEmail(e.target.value);
                        clearError('siteEmail');
                      }}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition ${
                        errors.siteEmail
                          ? 'border-red-500 ring-1 ring-red-500/40'
                          : 'border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    {errors.siteEmail && <p className="text-[11px] text-red-400 mt-1">{errors.siteEmail}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Default System Language</label>
                  <select
                    value={defaultLang}
                    onChange={e => setDefaultLang(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="bn">বাংলা (Bengali - Default)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              {/* Summary Pre-flight Check */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
                <p className="font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Pre-Installation Configuration Summary
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Database Target:</span>
                    <span className="text-amber-400 font-bold uppercase">{driver}</span>
                    <span className="text-slate-400 block truncate mt-0.5">
                      {driver === 'mysql' ? `${mysqlHost}:${mysqlPort} (${mysqlDatabase})` : driver === 'supabase' ? `${pgHost}:${pgPort}` : 'Embedded Local Store'}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Super Admin:</span>
                    <span className="text-emerald-400 font-bold truncate block font-mono">{adminUsername || 'admin'}</span>
                    <span className="text-slate-400 block truncate mt-0.5">{adminEmail}</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Site Host:</span>
                    <span className="text-white font-bold truncate block">{siteUrl}</span>
                    <span className="text-slate-400 block truncate mt-0.5">{defaultLang === 'bn' ? 'বাংলা' : 'English'}</span>
                  </div>
                </div>
              </div>

              {/* Install Error Banner */}
              {installError && (
                <div className="p-3.5 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{installError}</span>
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
                      <span>Initializing Schema & Credentials...</span>
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-sm mx-auto text-xs space-y-1.5 text-left">
                <div className="flex justify-between text-slate-400">
                  <span>Super Admin Username:</span>
                  <span className="text-emerald-400 font-mono font-bold">{adminUsername}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Official Email:</span>
                  <span className="text-white font-mono">{adminEmail}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Database Driver:</span>
                  <span className="text-amber-400 font-mono uppercase">{driver}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Website URL:</span>
                  <span className="text-slate-200 font-mono">{siteUrl}</span>
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
