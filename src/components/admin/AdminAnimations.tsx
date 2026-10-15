import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Sliders,
  Shield,
  Eye,
  Save,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  Play,
  RotateCcw,
  Compass,
  Layout,
  MousePointer,
  Repeat,
  Gauge,
} from 'lucide-react';
import { AnimationConfig } from '../../types';
import { apiFetch } from '../../utils/api';
import { INITIAL_ANIMATION_CONFIG } from '../../constants/initialCmsData';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminAnimations: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [config, setConfig] = useState<AnimationConfig>(INITIAL_ANIMATION_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    apiFetch('/api/appearance/animations')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Failed to load animations:', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/appearance/animations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save animation settings');
      }

      const updated = await res.json();
      setConfig(updated);
      window.dispatchEvent(new CustomEvent('nash-animations-updated'));
      showToast('Animation settings saved successfully!');
    } catch (e: any) {
      showToast(e.message || 'Error saving animation settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig({
      ...INITIAL_ANIMATION_CONFIG,
      updated_at: new Date().toISOString(),
    });
    setPreviewKey(k => k + 1);
    showToast('Reset to default smooth motion preset (click Save to publish).');
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading animation engine settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 rounded-2xl shadow-sm border border-emerald-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Framer Motion & Smooth UI Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Appearance & Animations Configuration</h2>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl">
            Configure global website animations, scroll reveals, interactive micro-transitions, and responsive touch feedback across all public and portal views.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preset & Global Master Toggles */}
        <div className="lg:col-span-2 space-y-6">
          {/* Master Switch & Presets */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-700" />
              <span>Global Animation Engine Settings</span>
            </h3>

            {/* Global Master Switch */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <span className="font-bold text-slate-900 text-sm block">Enable Website Animations</span>
                <span className="text-xs text-slate-500">
                  Global master switch. When disabled, all animations are turned off for maximum accessibility and performance.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.is_enabled}
                  onChange={e => {
                    setConfig({ ...config, is_enabled: e.target.checked });
                    setPreviewKey(k => k + 1);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Presets Selection */}
            <div className="space-y-3 pt-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Global Animation Preset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'minimal', label: 'Minimal', desc: 'Instant clean reveals & 0.2s duration' },
                  { id: 'subtle', label: 'Subtle', desc: 'Gentle fade-ins & delicate 0.35s motion' },
                  { id: 'smooth', label: 'Smooth', desc: 'Polished 0.5s modern transitions (Default)' },
                  { id: 'dynamic', label: 'Dynamic', desc: 'Crisp spring reveals & responsive scale' },
                ].map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setConfig({ ...config, preset: preset.id as any });
                      setPreviewKey(k => k + 1);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      config.preset === preset.id || (preset.id === 'dynamic' && config.preset === 'energetic')
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 text-emerald-950 font-medium'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs sm:text-sm block">{preset.label}</span>
                      <span className="text-[10px] sm:text-xs text-slate-500 mt-1 block leading-tight">
                        {preset.desc}
                      </span>
                    </div>
                    {(config.preset === preset.id || (preset.id === 'dynamic' && config.preset === 'energetic')) && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 self-end mt-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration, Delay & Stagger Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">Duration</label>
                  <span className="font-mono text-emerald-700 font-bold">{config.duration}s</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.05"
                  value={config.duration}
                  onChange={e => {
                    setConfig({ ...config, duration: parseFloat(e.target.value) });
                    setPreviewKey(k => k + 1);
                  }}
                  className="w-full accent-emerald-700"
                />
                <span className="text-[10px] text-slate-400 block">Transition speed</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">Initial Delay</label>
                  <span className="font-mono text-emerald-700 font-bold">{config.default_delay || 0}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={config.default_delay || 0}
                  onChange={e => {
                    setConfig({ ...config, default_delay: parseFloat(e.target.value) });
                    setPreviewKey(k => k + 1);
                  }}
                  className="w-full accent-emerald-700"
                />
                <span className="text-[10px] text-slate-400 block">Pause before motion</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">Card Stagger</label>
                  <span className="font-mono text-emerald-700 font-bold">{config.stagger_delay}s</span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.3"
                  step="0.02"
                  value={config.stagger_delay}
                  onChange={e => {
                    setConfig({ ...config, stagger_delay: parseFloat(e.target.value) });
                    setPreviewKey(k => k + 1);
                  }}
                  className="w-full accent-emerald-700"
                />
                <span className="text-[10px] text-slate-400 block">Sequence spacing</span>
              </div>
            </div>

            {/* Interaction & Scroll Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 block">Scroll-Triggered Reveals</span>
                  <span className="text-[10px] text-slate-500 block">Animate elements as they enter viewport</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.scroll_triggered ?? true}
                    onChange={e => {
                      setConfig({ ...config, scroll_triggered: e.target.checked });
                      setPreviewKey(k => k + 1);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 block">Hover & Interactive Feedback</span>
                  <span className="text-[10px] text-slate-500 block">Micro-scaling and tap feedback on controls</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.hover_effects ?? true}
                    onChange={e => {
                      setConfig({ ...config, hover_effects: e.target.checked });
                      setPreviewKey(k => k + 1);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Play Mode & Intensity Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Animation Playback
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'once', label: 'Play Once (Recommended)' },
                    { id: 'repeat', label: 'Repeat on Re-scroll' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setConfig({ ...config, play_mode: mode.id as any })}
                      className={`flex-1 py-2 px-3 text-xs rounded-lg border font-medium transition cursor-pointer text-center ${
                        (config.play_mode ?? 'once') === mode.id
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Motion Intensity
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'subtle', label: 'Subtle' },
                    { id: 'standard', label: 'Standard' },
                    { id: 'high', label: 'High' },
                  ].map(intensity => (
                    <button
                      key={intensity.id}
                      type="button"
                      onClick={() => setConfig({ ...config, intensity: intensity.id as any })}
                      className={`flex-1 py-2 px-2 text-xs rounded-lg border font-medium transition cursor-pointer text-center ${
                        (config.intensity ?? 'standard') === intensity.id
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {intensity.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Granular Page and Component Toggles */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-700" />
              <span>Independent Page & Component Controls</span>
            </h3>
            <p className="text-xs text-slate-500">
              Control animations independently for specific sections without affecting the rest of the website.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: 'enable_homepage',
                  label: 'Homepage & Landing Sections',
                  desc: 'Main landing page layout and sections',
                },
                {
                  key: 'enable_header_nav',
                  label: 'Header & Navigation Bar',
                  desc: 'Top bar, brand logo, and dropdown menus',
                },
                {
                  key: 'enable_hero_animations',
                  label: 'Hero Sections & Titles',
                  desc: 'Headings, CTA buttons, and badge cards',
                },
                {
                  key: 'enable_stats_cards',
                  label: 'Statistics Cards & Counters',
                  desc: 'Stats strip, countdown, and metrics pulse',
                },
                {
                  key: 'enable_notices_news',
                  label: 'Notice & News Cards',
                  desc: 'Notice board feeds and news articles',
                },
                {
                  key: 'enable_events_schedule',
                  label: 'Event Listings & Schedules',
                  desc: '85th anniversary program schedule cards',
                },
                {
                  key: 'enable_forms_inputs',
                  label: 'Forms & Interactive Inputs',
                  desc: 'Registration form inputs, steps & validation',
                },
                {
                  key: 'enable_member_portal',
                  label: 'Member Portal Views',
                  desc: 'Digital badge, ID pass, and profile tabs',
                },
                {
                  key: 'enable_admin_interface',
                  label: 'Administrative Interface',
                  desc: 'Admin dashboard widgets and management tables',
                },
                {
                  key: 'enable_page_transitions',
                  label: 'Smooth Page Transitions',
                  desc: 'Soft fade when switching between portal and views',
                },
                {
                  key: 'respect_reduced_motion',
                  label: 'Respect OS Reduced Motion',
                  desc: 'Automatically disable animations for sensitive users',
                },
              ].map(item => (
                <div
                  key={item.key}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                    <span className="text-[10px] text-slate-500 leading-tight block">{item.desc}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={(config as any)[item.key] ?? true}
                      onChange={e => {
                        setConfig({ ...config, [item.key]: e.target.checked });
                        setPreviewKey(k => k + 1);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 sticky top-24">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-700" />
                <span>Live Interactive Preview</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewKey(k => k + 1)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Replay</span>
              </button>
            </div>

            <div className="p-4 bg-slate-100/80 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Simulated Card Stagger ({config.preset})
                </span>
                <span className="text-[10px] font-mono text-emerald-800 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                  {config.duration}s
                </span>
              </div>

              <div key={previewKey} className="space-y-2">
                {[1, 2, 3].map((num, idx) => (
                  <div
                    key={num}
                    style={{
                      transitionDuration: config.is_enabled ? `${config.duration}s` : '0s',
                      transitionDelay: config.is_enabled ? `${(config.default_delay || 0) + idx * config.stagger_delay}s` : '0s',
                    }}
                    className={`p-3 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-between transform transition-all ${
                      config.is_enabled
                        ? 'translate-y-0 opacity-100 hover:-translate-y-0.5'
                        : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        #{num}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Notice Card Item {num}</span>
                        <span className="text-[10px] text-slate-400">Preview with active timings</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  style={{
                    transitionDuration: `${config.duration}s`,
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0f4d2a] text-white shadow-xs transition-transform ${
                    config.enable_button_hover && (config.hover_effects ?? true) ? 'hover:scale-[1.02] active:scale-95' : ''
                  }`}
                >
                  Interactive Button Scale Test
                </button>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 text-emerald-900 text-xs flex items-start gap-2">
              <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                All animation settings are stored in SQLite and sync seamlessly with the cPanel MySQL database.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
