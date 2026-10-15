import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Save,
  RotateCcw,
  Eye,
  Sliders,
  HelpCircle,
  Smartphone,
  Info,
  ShieldCheck,
  ArrowRight,
  Printer,
  Download,
  Copy,
  Check,
  Sparkles,
  Phone,
  Mail,
  Clock,
  MapPin,
  ExternalLink,
  Layers,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { RegistrationConfirmationConfig } from '../../types';

interface Props {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
}

export const AdminRegistrationConfirmation: React.FC<Props> = ({ onNotify, getHeaders }) => {
  const [config, setConfig] = useState<RegistrationConfirmationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'instructions' | 'toggles' | 'support' | 'preview'>('content');
  const [previewLang, setPreviewLang] = useState<'bn' | 'en'>('bn');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const defaultHeaders = () => {
    if (getHeaders) return getHeaders();
    const token = localStorage.getItem('nash_token') || localStorage.getItem('nash_auth_token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/registration/confirmation-config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        onNotify?.('Failed to load confirmation settings from database.');
      }
    } catch (err: any) {
      console.error(err);
      onNotify?.('Error loading confirmation settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = <K extends keyof RegistrationConfirmationConfig>(
    key: K,
    val: RegistrationConfirmationConfig[K]
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      [key]: val,
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      // Validate safe return destination
      const dest = (config.return_button_destination || '/').trim();
      if (/^(javascript:|data:|vbscript:)/i.test(dest)) {
        onNotify?.('Unsafe return button destination. Must be a safe path starting with "/"');
        setSaving(false);
        return;
      }

      const res = await apiFetch('/api/admin/registration/confirmation-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...defaultHeaders(),
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onNotify?.('Registration confirmation page settings saved to database successfully!');
        setConfig(data.config || config);
        setHasUnsavedChanges(false);
      } else {
        throw new Error(data.message || 'Failed to save confirmation settings');
      }
    } catch (err: any) {
      console.error(err);
      onNotify?.(err.message || 'Error saving confirmation settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset all confirmation page settings to default configuration?')) {
      await loadConfig();
      setHasUnsavedChanges(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-semibold">Loading confirmation page configuration from database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Registration Confirmation Page CMS
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Database-Driven
                </span>
                {hasUnsavedChanges && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Customize every heading, guidance message, instruction step, and support block displayed to alumni right after submitting their registration form.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 overflow-x-auto no-scrollbar">
          {[
            { id: 'content', label: 'Headings & Messages', icon: Layers },
            { id: 'instructions', label: 'Payment & Next Steps', icon: Smartphone },
            { id: 'toggles', label: 'Section Visibility', icon: Sliders },
            { id: 'support', label: 'Support & Return Link', icon: HelpCircle },
            { id: 'preview', label: 'Interactive Live Preview', icon: Eye },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Headings & Messages */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Headings & Primary Messages</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure the post-registration header banner and initial thank you message shown to applicants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Heading EN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Page Heading (English)
              </label>
              <input
                type="text"
                value={config.heading_en}
                onChange={e => handleChange('heading_en', e.target.value)}
                placeholder="e.g. Thank you for registering!"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Heading BN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Page Heading (বাংলা)
              </label>
              <input
                type="text"
                value={config.heading_bn}
                onChange={e => handleChange('heading_bn', e.target.value)}
                placeholder="যেমন: আপনার রেজিস্ট্রেশনের জন্য ধন্যবাদ!"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Subheading EN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Subheading / Event Name (English)
              </label>
              <input
                type="text"
                value={config.subheading_en}
                onChange={e => handleChange('subheading_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Subheading BN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Subheading / Event Name (বাংলা)
              </label>
              <input
                type="text"
                value={config.subheading_bn}
                onChange={e => handleChange('subheading_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Confirmation Message EN */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Confirmation Notice (English)
              </label>
              <textarea
                rows={3}
                value={config.confirmation_message_en}
                onChange={e => handleChange('confirmation_message_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Confirmation Message BN */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Confirmation Notice (বাংলা)
              </label>
              <textarea
                rows={3}
                value={config.confirmation_message_bn}
                onChange={e => handleChange('confirmation_message_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Supporting Text EN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Supporting Text (English)
              </label>
              <textarea
                rows={2}
                value={config.supporting_text_en}
                onChange={e => handleChange('supporting_text_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Supporting Text BN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Supporting Text (বাংলা)
              </label>
              <textarea
                rows={2}
                value={config.supporting_text_bn}
                onChange={e => handleChange('supporting_text_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Token Box Labels */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Token / Reference Label (English)
              </label>
              <input
                type="text"
                value={config.token_label_en}
                onChange={e => handleChange('token_label_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Token / Reference Label (বাংলা)
              </label>
              <input
                type="text"
                value={config.token_label_bn}
                onChange={e => handleChange('token_label_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Token Help Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Token Reference Instruction (English)
              </label>
              <input
                type="text"
                value={config.token_help_text_en}
                onChange={e => handleChange('token_help_text_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Token Reference Instruction (বাংলা)
              </label>
              <input
                type="text"
                value={config.token_help_text_bn}
                onChange={e => handleChange('token_help_text_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Payment Instructions & Next Steps */}
      {activeTab === 'instructions' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Payment & Step-by-Step Instructions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify guidance on how registrants should send their fee, enter TrxID, and verify approval.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Section Titles */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Payment Section Title (English)
              </label>
              <input
                type="text"
                value={config.payment_instructions_title_en}
                onChange={e => handleChange('payment_instructions_title_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Payment Section Title (বাংলা)
              </label>
              <input
                type="text"
                value={config.payment_instructions_title_bn}
                onChange={e => handleChange('payment_instructions_title_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Payment Instructions Multiline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Payment Instructions Steps (English - 1 per line)
              </label>
              <textarea
                rows={5}
                value={config.payment_instructions_en}
                onChange={e => handleChange('payment_instructions_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none leading-relaxed"
              />
              <span className="text-[11px] text-slate-500">Each numbered line is rendered as a clean checklist item.</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Payment Instructions Steps (বাংলা - প্রতি লাইনে একটি)
              </label>
              <textarea
                rows={5}
                value={config.payment_instructions_bn}
                onChange={e => handleChange('payment_instructions_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none leading-relaxed"
              />
              <span className="text-[11px] text-slate-500">প্রতিটি লাইন আলাদা ধাপ হিসেবে প্রদর্শিত হবে।</span>
            </div>

            {/* Next Steps Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Next Steps Guidance Title (English)
              </label>
              <input
                type="text"
                value={config.next_steps_title_en}
                onChange={e => handleChange('next_steps_title_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Next Steps Guidance Title (বাংলা)
              </label>
              <input
                type="text"
                value={config.next_steps_title_bn}
                onChange={e => handleChange('next_steps_title_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Next Steps Multiline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Next Steps Guidance (English)
              </label>
              <textarea
                rows={4}
                value={config.next_steps_en}
                onChange={e => handleChange('next_steps_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Next Steps Guidance (বাংলা)
              </label>
              <textarea
                rows={4}
                value={config.next_steps_bn}
                onChange={e => handleChange('next_steps_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Informational Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Important Rules / Notes Title (English)
              </label>
              <input
                type="text"
                value={config.info_notes_title_en}
                onChange={e => handleChange('info_notes_title_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Important Rules / Notes Title (বাংলা)
              </label>
              <input
                type="text"
                value={config.info_notes_title_bn}
                onChange={e => handleChange('info_notes_title_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Important Rules & Guidelines (English)
              </label>
              <textarea
                rows={4}
                value={config.info_notes_en}
                onChange={e => handleChange('info_notes_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Important Rules & Guidelines (বাংলা)
              </label>
              <textarea
                rows={4}
                value={config.info_notes_bn}
                onChange={e => handleChange('info_notes_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Section Visibility Toggles */}
      {activeTab === 'toggles' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Section Visibility & Display Controls</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggle specific content modules on the confirmation page on or off without altering database records or backend flows.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                key: 'show_token_box',
                label: 'Registration Token Banner',
                desc: 'Displays the highlighted reference number banner with copy button',
              },
              {
                key: 'show_download_slip_button',
                label: 'PDF Registration Slip Download',
                desc: 'Allows registrants to download an instant PDF summary slip',
              },
              {
                key: 'show_print_button',
                label: 'Print Summary Button',
                desc: 'Provides a one-click browser print dialog for the summary',
              },
              {
                key: 'show_manual_payment_accounts',
                label: 'Payment Account Cards',
                desc: 'Shows official bKash & Nagad merchant/personal numbers',
              },
              {
                key: 'show_payment_instructions',
                label: 'Step-by-Step Payment Guide',
                desc: 'Displays the numbered payment process instructions',
              },
              {
                key: 'show_confirm_payment_form',
                label: 'Confirm Payment (TrxID) Form',
                desc: 'Interactive form enabling user to submit transaction ID',
              },
              {
                key: 'show_info_notes',
                label: 'Informational Notes & Rules',
                desc: 'Displays anniversary guidelines and entry requirements',
              },
              {
                key: 'show_support_contact',
                label: 'Helpdesk & Support Box',
                desc: 'Shows alumni helpline phones, email, and booth hours',
              },
              {
                key: 'show_return_button',
                label: 'Return to Website Button',
                desc: 'Enables quick navigation back to the main portal or home',
              },
            ].map(item => {
              const checked = Boolean((config as any)[item.key]);
              return (
                <label
                  key={item.key}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 transition cursor-pointer select-none ${
                    checked
                      ? 'bg-emerald-50/70 border-emerald-500 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => handleChange(item.key as any, e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Support Contact & Safe Return Link */}
      {activeTab === 'support' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Support Contacts & Return Navigation</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure committee helpline details and ensure the return button redirects safely to internal destinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Support Titles */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Support Section Title (English)</label>
              <input
                type="text"
                value={config.support_title_en}
                onChange={e => handleChange('support_title_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Support Section Title (বাংলা)</label>
              <input
                type="text"
                value={config.support_title_bn}
                onChange={e => handleChange('support_title_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Helpline Phone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Support Helpline Numbers</label>
              <input
                type="text"
                value={config.support_phone}
                onChange={e => handleChange('support_phone', e.target.value)}
                placeholder="+880 1819-000000, +880 1711-000000"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Support Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Support Email Address</label>
              <input
                type="email"
                value={config.support_email}
                onChange={e => handleChange('support_email', e.target.value)}
                placeholder="support@nashalumni.org"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Support Hours */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Support Hours (English)</label>
              <input
                type="text"
                value={config.support_hours_en}
                onChange={e => handleChange('support_hours_en', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Support Hours (বাংলা)</label>
              <input
                type="text"
                value={config.support_hours_bn}
                onChange={e => handleChange('support_hours_bn', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Return Button Label EN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Return Button Label (English)</label>
              <input
                type="text"
                value={config.return_button_label_en}
                onChange={e => handleChange('return_button_label_en', e.target.value)}
                placeholder="Return to Homepage"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Return Button Label BN */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Return Button Label (বাংলা)</label>
              <input
                type="text"
                value={config.return_button_label_bn}
                onChange={e => handleChange('return_button_label_bn', e.target.value)}
                placeholder="মূল ওয়েবসাইটে ফিরে যান"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Return Button Destination */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Safe Return Destination (Must start with /)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={config.return_button_destination}
                  onChange={e => handleChange('return_button_destination', e.target.value)}
                  placeholder="/"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-bold">Quick Presets:</span>
                  {[
                    { label: 'Homepage (/)', path: '/' },
                    { label: 'Member Portal (/member)', path: '/member' },
                    { label: 'Token Verification (/token)', path: '/token' },
                    { label: 'Schedule (/schedule)', path: '/schedule' },
                  ].map(preset => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => handleChange('return_button_destination', preset.path)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        config.return_button_destination === preset.path
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Security note: Only internal application paths starting with "/" are permitted. External URLs and script execution protocols are strictly rejected by the server validator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Live Interactive Preview */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Live Post-Registration Preview
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (Simulates genuine backend database values & layout)
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPreviewLang('bn')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  previewLang === 'bn' ? 'bg-[#0f4d2a] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বাংলা প্রিভিউ
              </button>
              <button
                type="button"
                onClick={() => setPreviewLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  previewLang === 'en' ? 'bg-[#0f4d2a] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English Preview
              </button>
            </div>
          </div>

          {/* Render Preview Frame */}
          <div className="bg-slate-100 p-4 sm:p-6 rounded-2xl border-2 border-dashed border-emerald-300 space-y-6">
            {/* Official Confirmation Card */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-600/40 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0f4d2a] text-white p-6 sm:p-8 text-center relative">
                <div className="inline-flex p-3 bg-amber-400/20 rounded-full text-amber-300 mb-3">
                  <CheckCircle2 className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {previewLang === 'bn' ? config.heading_bn : config.heading_en}
                </h2>
                <p className="text-emerald-100 text-sm sm:text-base mt-2 max-w-2xl mx-auto leading-relaxed">
                  {previewLang === 'bn' ? config.confirmation_message_bn : config.confirmation_message_en}
                </p>
                {config.subheading_en && (
                  <span className="inline-block mt-3 px-3 py-1 bg-white/10 rounded-full text-xs text-emerald-200">
                    {previewLang === 'bn' ? config.subheading_bn : config.subheading_en}
                  </span>
                )}
              </div>

              {/* Token Banner */}
              {config.show_token_box && (
                <div className="p-6 sm:p-8 bg-amber-50/60 border-b border-amber-200/80">
                  <div className="max-w-xl mx-auto text-center space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block">
                      {previewLang === 'bn' ? config.token_label_bn : config.token_label_en}
                    </span>

                    <div className="inline-flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border-2 border-amber-400 shadow-md">
                      <span className="font-mono text-2xl sm:text-3xl font-black text-[#0f4d2a] tracking-wider">
                        NASHS-2008-0042
                      </span>
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-900 flex items-center gap-1.5 text-xs font-bold">
                        <Copy className="w-3.5 h-3.5 text-amber-800" />
                        <span>Copy</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-amber-900 leading-normal">
                      {previewLang === 'bn' ? config.token_help_text_bn : config.token_help_text_en}
                    </p>

                    <div className="pt-2 flex justify-center gap-3 flex-wrap">
                      {config.show_download_slip_button && (
                        <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-bold shadow-xs">
                          <Download className="w-4 h-4 text-[#0f4d2a]" />
                          <span>Download Registration Slip (PDF)</span>
                        </div>
                      )}
                      {config.show_print_button && (
                        <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-xs">
                          <Printer className="w-4 h-4 text-slate-500" />
                          <span>Print Summary</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions and Manual Payment */}
              <div className="p-6 sm:p-8 space-y-6">
                {config.show_manual_payment_accounts && (
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-[#0f4d2a]" />
                      <span>{previewLang === 'bn' ? 'ম্যানুয়াল পেমেন্ট নম্বর (bKash ও Nagad)' : 'Manual Payment Numbers (bKash & Nagad)'}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-pink-200 bg-pink-50/50 space-y-2">
                        <div className="flex justify-between font-bold text-pink-900">
                          <span>bKash (Merchant)</span>
                          <span>৳1,000 BDT</span>
                        </div>
                        <div className="font-mono font-bold text-lg text-pink-950 bg-white p-2.5 rounded-lg border border-pink-200">
                          01819-123456
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/50 space-y-2">
                        <div className="flex justify-between font-bold text-orange-900">
                          <span>Nagad (Personal)</span>
                          <span>৳1,000 BDT</span>
                        </div>
                        <div className="font-mono font-bold text-lg text-orange-950 bg-white p-2.5 rounded-lg border border-orange-200">
                          01712-654321
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step-by-Step Payment Instructions */}
                {config.show_payment_instructions && (
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Info className="w-4 h-4 text-[#0f4d2a]" />
                      <span>{previewLang === 'bn' ? config.payment_instructions_title_bn : config.payment_instructions_title_en}</span>
                    </h4>
                    <div className="space-y-1.5 text-xs text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                      {previewLang === 'bn' ? config.payment_instructions_bn : config.payment_instructions_en}
                    </div>
                  </div>
                )}

                {/* Informational Notes */}
                {config.show_info_notes && (
                  <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200 space-y-2">
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{previewLang === 'bn' ? config.info_notes_title_bn : config.info_notes_title_en}</span>
                    </h4>
                    <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">
                      {previewLang === 'bn' ? config.info_notes_bn : config.info_notes_en}
                    </p>
                  </div>
                )}

                {/* Support Helpline Box */}
                {config.show_support_contact && (
                  <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-emerald-700" />
                      <span>{previewLang === 'bn' ? config.support_title_bn : config.support_title_en}</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-emerald-950">
                      <div>📞 Phone: <strong>{config.support_phone}</strong></div>
                      <div>✉️ Email: <strong>{config.support_email}</strong></div>
                      <div>🕒 Hours: <strong>{previewLang === 'bn' ? config.support_hours_bn : config.support_hours_en}</strong></div>
                      <div>📍 Office: <strong>{previewLang === 'bn' ? config.support_location_bn : config.support_location_en}</strong></div>
                    </div>
                  </div>
                )}

                {/* Return Button */}
                {config.show_return_button && (
                  <div className="text-center pt-2">
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[#0f4d2a] text-white shadow-md">
                      <span>{previewLang === 'bn' ? config.return_button_label_bn : config.return_button_label_en}</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
