import React, { useState, useEffect } from 'react';
import { Save, Globe, Palette, Phone, Mail, MapPin, Share2, Search, ShieldCheck } from 'lucide-react';
import { GlobalSettings } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminGlobalSettings: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'branding' | 'contact' | 'social' | 'seo'>('general');

  useEffect(() => {
    apiFetch('/api/global-settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Global settings load paused:', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/global-settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const updated = await res.json();
      setSettings(updated);
      showToast('Global settings updated successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading global website configuration...</div>;
  }

  if (!settings) {
    return <div className="p-8 text-center text-red-500">Unable to load settings.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-700" />
            Global Website Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure site identity, bilingual names, typography, branding colors, contact details, and SEO metadata.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-t-2xl gap-2 overflow-x-auto">
        {[
          { id: 'general', label: 'Site Identity', icon: Globe },
          { id: 'branding', label: 'Colors & Typography', icon: Palette },
          { id: 'contact', label: 'Contact & Location', icon: Phone },
          { id: 'social', label: 'Social Links', icon: Share2 },
          { id: 'seo', label: 'SEO & Search Indexing', icon: Search },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-emerald-700 text-emerald-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form Body */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-b-2xl rounded-tr-none shadow-xs border border-t-0 border-slate-200 space-y-6">
        {/* TAB 1: GENERAL / SITE IDENTITY */}
        {activeSubTab === 'general' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Site Name (English)
                </label>
                <input
                  type="text"
                  value={settings.site_name_en}
                  onChange={e => setSettings({ ...settings, site_name_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Site Name (Bengali)
                </label>
                <input
                  type="text"
                  value={settings.site_name_bn}
                  onChange={e => setSettings({ ...settings, site_name_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Site Tagline (English)
                </label>
                <input
                  type="text"
                  value={settings.site_tagline_en}
                  onChange={e => setSettings({ ...settings, site_tagline_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Site Tagline (Bengali)
                </label>
                <input
                  type="text"
                  value={settings.site_tagline_bn}
                  onChange={e => setSettings({ ...settings, site_tagline_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Site Description (English)
                </label>
                <textarea
                  rows={3}
                  value={settings.site_description_en}
                  onChange={e => setSettings({ ...settings, site_description_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Site Description (Bengali)
                </label>
                <textarea
                  rows={3}
                  value={settings.site_description_bn}
                  onChange={e => setSettings({ ...settings, site_description_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Desktop Logo URL
                </label>
                <input
                  type="text"
                  value={settings.logo_url}
                  onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
                  placeholder="/assets/nash-logo.png"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mobile Logo URL
                </label>
                <input
                  type="text"
                  value={settings.mobile_logo_url || ''}
                  onChange={e => setSettings({ ...settings, mobile_logo_url: e.target.value })}
                  placeholder="/assets/nash-logo-sm.png"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Favicon URL
                </label>
                <input
                  type="text"
                  value={settings.favicon_url || ''}
                  onChange={e => setSettings({ ...settings, favicon_url: e.target.value })}
                  placeholder="/favicon.ico"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Copyright Notice (English)
                </label>
                <input
                  type="text"
                  value={settings.copyright_en}
                  onChange={e => setSettings({ ...settings, copyright_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Copyright Notice (Bengali)
                </label>
                <input
                  type="text"
                  value={settings.copyright_bn}
                  onChange={e => setSettings({ ...settings, copyright_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BRANDING & COLORS */}
        {activeSubTab === 'branding' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Primary Theme Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primary_color || '#0f4d2a'}
                    onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300 p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.primary_color || '#0f4d2a'}
                    onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Used for header, primary buttons, badges, and crests.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Secondary Accent (Gold)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.secondary_color || '#d4af37'}
                    onChange={e => setSettings({ ...settings, secondary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300 p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.secondary_color || '#d4af37'}
                    onChange={e => setSettings({ ...settings, secondary_color: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Used for celebratory accents, borders, and stars.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Crimson / Alert Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.accent_color || '#b91c1c'}
                    onChange={e => setSettings({ ...settings, accent_color: e.target.value })}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300 p-1 bg-white"
                  />
                  <input
                    type="text"
                    value={settings.accent_color || '#b91c1c'}
                    onChange={e => setSettings({ ...settings, accent_color: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Used for deadlines, urgent banners, and warnings.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Primary Font Family
              </label>
              <input
                type="text"
                value={settings.font_family || 'Hind Siliguri, Plus Jakarta Sans, sans-serif'}
                onChange={e => setSettings({ ...settings, font_family: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* TAB 3: CONTACT & LOCATION */}
        {activeSubTab === 'contact' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contact Phone / Helpline
                </label>
                <input
                  type="text"
                  value={settings.contact_phone}
                  onChange={e => setSettings({ ...settings, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={settings.contact_email}
                  onChange={e => setSettings({ ...settings, contact_email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Physical Address (English)
                </label>
                <textarea
                  rows={2}
                  value={settings.address_en}
                  onChange={e => setSettings({ ...settings, address_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Physical Address (Bengali)
                </label>
                <textarea
                  rows={2}
                  value={settings.address_bn}
                  onChange={e => setSettings({ ...settings, address_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Google Maps Embed or Link URL
              </label>
              <input
                type="text"
                value={settings.google_maps_url || ''}
                onChange={e => setSettings({ ...settings, google_maps_url: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Office Hours (English)
                </label>
                <input
                  type="text"
                  value={settings.office_hours_en || ''}
                  onChange={e => setSettings({ ...settings, office_hours_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Office Hours (Bengali)
                </label>
                <input
                  type="text"
                  value={settings.office_hours_bn || ''}
                  onChange={e => setSettings({ ...settings, office_hours_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SOCIAL LINKS */}
        {activeSubTab === 'social' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Facebook Page URL
                </label>
                <input
                  type="url"
                  value={settings.social_links.facebook || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, facebook: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  YouTube Channel URL
                </label>
                <input
                  type="url"
                  value={settings.social_links.youtube || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, youtube: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  LinkedIn Profile / Group
                </label>
                <input
                  type="url"
                  value={settings.social_links.linkedin || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, linkedin: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={settings.social_links.instagram || ''}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      social_links: { ...settings.social_links, instagram: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SEO & INDEXING */}
        {activeSubTab === 'seo' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Default Meta Title
              </label>
              <input
                type="text"
                value={settings.seo_default_title}
                onChange={e => setSettings({ ...settings, seo_default_title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Default Meta Description
              </label>
              <textarea
                rows={2}
                value={settings.seo_meta_description}
                onChange={e => setSettings({ ...settings, seo_meta_description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                OpenGraph / Social Share Preview Image URL
              </label>
              <input
                type="text"
                value={settings.seo_og_image || ''}
                onChange={e => setSettings({ ...settings, seo_og_image: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="search_engine_indexing"
                checked={settings.search_engine_indexing}
                onChange={e => setSettings({ ...settings, search_engine_indexing: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="search_engine_indexing" className="text-sm font-semibold text-slate-800">
                Allow Search Engines to Index this Website (Googlebot, Bingbot)
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                robots.txt Content
              </label>
              <textarea
                rows={3}
                value={settings.robots_txt || 'User-agent: *\nAllow: /'}
                onChange={e => setSettings({ ...settings, robots_txt: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-slate-50"
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
