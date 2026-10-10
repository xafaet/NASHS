import React, { useState, useEffect } from 'react';
import {
  Mail,
  Server,
  Lock,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  FileText,
  Clock,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { MailSettings } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminMailSettings: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates' | 'test'>('smtp');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/mail-settings', {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        showToast('Failed to load email settings.');
      }
    } catch (err: any) {
      console.error('Error loading mail settings:', err);
      showToast('Error connecting to email service backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setTestResult(null);

    try {
      const res = await apiFetch('/api/admin/mail-settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        showToast('Email settings successfully saved to database!');
      } else {
        showToast(data.message || 'Failed to update email settings.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving email settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      showToast('Please enter a valid recipient email address.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await apiFetch('/api/admin/mail-settings/test', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          to_email: testEmail,
          settings,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        showToast('Test email successfully dispatched!');
      } else {
        showToast('Test email failed. See diagnostics below.');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error communicating with mail server.',
      });
      showToast('Failed to execute email test.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
        <span className="text-sm font-medium">Loading database mail settings...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
        <p className="font-semibold text-sm">Failed to retrieve mail configuration.</p>
        <button
          onClick={fetchSettings}
          className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-700" />
            Email Automation & SMTP Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Configure Laravel-style mail credentials (SMTP, Sendmail, Log) and automated notification triggers.
            Official registration passes (PDF) are automatically dispatched immediately upon payment confirmation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSettings}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Reload from Database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-t-2xl gap-2 overflow-x-auto">
        {[
          { id: 'smtp', label: 'SMTP Server & Credentials', icon: Server },
          { id: 'templates', label: 'Confirmation Email Templates', icon: FileText },
          { id: 'test', label: 'Test Delivery & Diagnostics', icon: Send },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-emerald-700 text-emerald-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Form */}
      <form onSubmit={handleSave} className="bg-white rounded-b-2xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-xs -mt-6">
        {/* SUBTAB 1: SMTP CONFIG */}
        {activeTab === 'smtp' && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <span className="font-bold">Automated PDF Dispatch:</span> When an administrator verifies manual payment (bKash/Nagad),
                the system generates the official PDF Entry Pass and automatically dispatches it to the registrant's email address.
                Credentials configured here are stored securely in the database and never exposed to the public.
              </div>
            </div>

            {/* General Toggles */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-900">Enable Automated Email Notifications</p>
                <p className="text-xs text-slate-500">Send instant confirmation emails with PDF pass attachments upon payment verification</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.email_notifications_enabled !== false}
                  onChange={e => setSettings({ ...settings, email_notifications_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Mail Driver */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mail Driver</label>
                <select
                  value={settings.mail_driver}
                  onChange={e => setSettings({ ...settings, mail_driver: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                >
                  <option value="smtp">SMTP (Recommended for Production)</option>
                  <option value="sendmail">Sendmail (Local Server)</option>
                  <option value="log">Log / Sandbox (Testing)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Use SMTP for reliable Gmail, cPanel, or SendGrid delivery.</p>
              </div>

              {/* SMTP Host */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtp_host}
                  onChange={e => setSettings({ ...settings, smtp_host: e.target.value })}
                  placeholder="e.g. smtp.gmail.com or mail.nanupuralumni.org"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Hostname or IP address of your outgoing mail server.</p>
              </div>

              {/* Port */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={settings.smtp_port}
                  onChange={e => setSettings({ ...settings, smtp_port: parseInt(e.target.value, 10) || 587 })}
                  placeholder="587 or 465"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Common ports: 587 (TLS/STARTTLS), 465 (SSL), 25.</p>
              </div>

              {/* Encryption */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Encryption Protocol</label>
                <select
                  value={settings.smtp_encryption}
                  onChange={e => setSettings({ ...settings, smtp_encryption: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                >
                  <option value="tls">TLS / STARTTLS (Port 587)</option>
                  <option value="ssl">SSL (Port 465)</option>
                  <option value="none">None (Insecure / Local)</option>
                </select>
              </div>

              {/* Timeout */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Connection Timeout (ms)</label>
                <input
                  type="number"
                  value={settings.timeout || 10000}
                  onChange={e => setSettings({ ...settings, timeout: parseInt(e.target.value, 10) || 10000 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600 font-mono"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={settings.smtp_username}
                  onChange={e => setSettings({ ...settings, smtp_username: e.target.value })}
                  placeholder="e.g. reunion@nanupuralumni.org"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                />
                <p className="text-[11px] text-slate-400 mt-1">Usually your full email address.</p>
              </div>

              {/* Password */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Password / App Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={settings.smtp_password || ''}
                    onChange={e => setSettings({ ...settings, smtp_password: e.target.value })}
                    placeholder={settings.smtp_password ? '••••••••' : 'Enter SMTP password or App Password'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  For Gmail, use a 16-character <strong>Google App Password</strong> (not your normal account password).
                </p>
              </div>

              {/* From Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">From Email Address</label>
                <input
                  type="email"
                  value={settings.from_email}
                  onChange={e => setSettings({ ...settings, from_email: e.target.value })}
                  placeholder="reunion@nanupuralumni.org"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                  required
                />
              </div>

              {/* From Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">From Name (Sender Display)</label>
                <input
                  type="text"
                  value={settings.from_name}
                  onChange={e => setSettings({ ...settings, from_name: e.target.value })}
                  placeholder="Nanupur Abu Sobhan High School Alumni Association"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                  required
                />
              </div>

              {/* Reply-to */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reply-To Email Address</label>
                <input
                  type="email"
                  value={settings.reply_to || ''}
                  onChange={e => setSettings({ ...settings, reply_to: e.target.value })}
                  placeholder="info@nanupuralumni.org"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: TEMPLATES */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Customizable Email Subjects & Copy</h3>
              <p className="text-xs text-slate-500">
                Configure the subject lines and congratulatory intro text sent to confirmed registrants alongside their attached PDF pass.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject (English)</label>
                <input
                  type="text"
                  value={settings.templates?.confirmation_subject_en || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, confirmation_subject_en: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject (Bengali)</label>
                <input
                  type="text"
                  value={settings.templates?.confirmation_subject_bn || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, confirmation_subject_bn: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Introductory Message (English)</label>
                <textarea
                  rows={3}
                  value={settings.templates?.confirmation_body_en || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, confirmation_body_en: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Introductory Message (Bengali)</label>
                <textarea
                  rows={3}
                  value={settings.templates?.confirmation_body_bn || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      templates: { ...settings.templates, confirmation_body_bn: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <span className="font-bold">Dynamic Tokens Included Automatically:</span> Token number, registrant name, batch, T-shirt size, gate designation, event venue, QR code, and attached printable PDF pass are dynamically compiled and embedded for every registration.
            </div>
          </div>
        )}

        {/* SUBTAB 3: TEST & DIAGNOSTICS */}
        {activeTab === 'test' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-700" />
                Live SMTP Handshake & Delivery Test
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Send a real test email through your configured SMTP server to verify credentials, firewall access, and inbox delivery.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email (e.g. your email)"
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testing || !testEmail}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-xs"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Results Display */}
            {testResult && (
              <div
                className={`p-5 rounded-xl border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-2 flex-1">
                    <h4 className="font-bold text-sm">
                      {testResult.success ? 'SMTP Connection Successful' : 'SMTP Connection Failed'}
                    </h4>
                    <p className="text-xs leading-relaxed">{testResult.message}</p>

                    {testResult.details && (
                      <pre className="mt-2 p-3 bg-black/5 rounded-lg text-[11px] font-mono overflow-x-auto">
                        {JSON.stringify(testResult.details, null, 2)}
                      </pre>
                    )}

                    {!testResult.success && (
                      <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-800 space-y-1">
                        <p className="font-bold">Troubleshooting Tips:</p>
                        <ul className="list-disc pl-5 space-y-0.5">
                          <li>For Gmail: Ensure 2-Step Verification is active and generate an <strong>App Password</strong>.</li>
                          <li>For cPanel: Check whether your port requires SSL (465) or TLS (587).</li>
                          <li>Verify that the From Address matches your authenticated account username.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Actions Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Changes take effect immediately and are saved to the primary database.
          </span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
