import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Save,
  Eye,
  Calendar,
  MapPin,
  Tag,
  Link,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Layers,
  Palette,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { HeroConfig } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminHero: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [hero, setHero] = useState<HeroConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLang, setPreviewLang] = useState<'en' | 'bn'>('bn');

  useEffect(() => {
    fetchHero();
  }, []);

  const fetchHero = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/appearance/hero');
      if (res.ok) {
        const data = await res.json();
        setHero(data);
      }
    } catch (err) {
      console.warn('Hero config load paused:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hero) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/appearance/hero', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(hero),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update hero section');
      }

      const updated = await res.json();
      setHero(updated);
      window.dispatchEvent(new CustomEvent('nash-hero-updated'));
      showToast('Hero section content, badges, and CTAs saved successfully!');
    } catch (err: any) {
      showToast(err.message || 'Error updating hero section');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
        Loading Hero Section settings...
      </div>
    );
  }

  if (!hero) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
        <p className="text-slate-600 text-sm font-semibold">Unable to load hero configuration.</p>
        <button
          onClick={fetchHero}
          className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Homepage Hero Section (100% CMS-Driven)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Every visible heading, badge, label, button text, link, and background is editable and persisted in the database.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchHero}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Reload from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* LIVE INTERACTIVE PREVIEW CARD */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Eye className="w-4 h-4 text-emerald-700" />
            <span>Live Hero Preview</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPreviewLang('bn')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                previewLang === 'bn' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বাংলা ভিউ
            </button>
            <button
              type="button"
              onClick={() => setPreviewLang('en')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                previewLang === 'en' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English View
            </button>
          </div>
        </div>

        {/* Hero Preview Box */}
        <div
          className="relative rounded-2xl overflow-hidden p-6 sm:p-10 text-white text-center border-b-6 border-amber-400"
          style={{
            background:
              hero.background_style === 'image' && hero.background_image_url
                ? `linear-gradient(rgba(10, 51, 28, ${hero.overlay_opacity / 100}), rgba(19, 93, 52, ${hero.overlay_opacity / 100})), url('${hero.background_image_url}') center/cover no-repeat`
                : 'linear-gradient(to bottom, #0a331c, #0f4d2a, #135d34)',
          }}
        >
          {/* Milestone Badge */}
          {hero.show_badge && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold uppercase tracking-wider mb-4">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{previewLang === 'bn' ? hero.badge_bn || hero.badge_en : hero.badge_en}</span>
            </div>
          )}

          {/* Heading */}
          <h1 className="text-xl sm:text-3xl font-extrabold text-white leading-tight font-display max-w-2xl mx-auto">
            {previewLang === 'bn' ? (
              <>
                {hero.headline_bn}{' '}
                <span style={{ color: hero.accent_color || '#fbbf24' }}>
                  {hero.headline_highlight_bn}
                </span>
              </>
            ) : (
              <>
                {hero.headline_en}{' '}
                <span style={{ color: hero.accent_color || '#fbbf24' }}>
                  {hero.headline_highlight_en}
                </span>
              </>
            )}
          </h1>

          {/* Subheading / Description */}
          <p className="text-emerald-100 text-xs sm:text-sm max-w-xl mx-auto mt-3 font-medium leading-relaxed">
            {previewLang === 'bn' ? hero.subheading_bn || hero.subheading_en : hero.subheading_en}
          </p>

          {/* Key details pill */}
          <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-black/40 backdrop-blur-xs px-4 py-2 rounded-xl border border-white/10 text-xs mt-4">
            {hero.show_date && (
              <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {previewLang === 'bn' ? hero.date_text_bn || hero.date_text_en : hero.date_text_en}
              </span>
            )}
            {hero.show_venue && (
              <span className="flex items-center gap-1.5 text-emerald-100">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {previewLang === 'bn' ? hero.venue_text_bn || hero.venue_text_en : hero.venue_text_en}
              </span>
            )}
            {hero.show_fee && (
              <span className="flex items-center gap-1.5 text-emerald-100">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                {previewLang === 'bn' ? hero.fee_text_bn || hero.fee_text_en : hero.fee_text_en}
              </span>
            )}
          </div>

          {/* Action buttons preview */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            {hero.show_primary_cta && (
              <span className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-400 text-slate-950 shadow-md">
                {previewLang === 'bn' ? hero.primary_cta_text_bn : hero.primary_cta_text_en}
              </span>
            )}
            {hero.show_secondary_cta && (
              <span className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 text-white border border-white/20">
                {previewLang === 'bn' ? hero.secondary_cta_text_bn : hero.secondary_cta_text_en}
              </span>
            )}
          </div>

          {/* Countdown timer preview */}
          {hero.show_countdown && (
            <div className="mt-5 text-[11px] text-emerald-200">
              <span className="font-semibold uppercase tracking-wider block mb-1">
                {previewLang === 'bn' ? hero.countdown_label_bn : hero.countdown_label_en}
              </span>
              <div className="inline-flex gap-2 font-mono font-bold text-amber-400 text-sm">
                <span className="bg-black/40 px-2 py-1 rounded">280d</span>
                <span className="bg-black/40 px-2 py-1 rounded">14h</span>
                <span className="bg-black/40 px-2 py-1 rounded">45m</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDIT FORM */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: BADGE & LABELS */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Top Milestone Badge</span>
              </h3>
              <p className="text-xs text-slate-500">The pill badge displayed above the main heading.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hero.show_badge}
                onChange={e => setHero({ ...hero, show_badge: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-700">Display Badge</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Badge Text (English)
              </label>
              <input
                type="text"
                value={hero.badge_en}
                onChange={e => setHero({ ...hero, badge_en: e.target.value })}
                placeholder="1942–2027 • 85 Glorious Years of Legacy"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Badge Text (Bengali)
              </label>
              <input
                type="text"
                value={hero.badge_bn}
                onChange={e => setHero({ ...hero, badge_bn: e.target.value })}
                placeholder="১৯৪২–২০২৭ • ৮৫ বছরের গৌরবময় ঐতিহ্য"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: HEADINGS & SUBHEADINGS */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Headlines & Supporting Descriptions</span>
            </h3>
            <p className="text-xs text-slate-500">Edit the primary headline and amber highlight phrase.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Main Headline (English)
              </label>
              <input
                type="text"
                required
                value={hero.headline_en}
                onChange={e => setHero({ ...hero, headline_en: e.target.value })}
                placeholder="85th Anniversary Celebration &"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Main Headline (Bengali)
              </label>
              <input
                type="text"
                required
                value={hero.headline_bn}
                onChange={e => setHero({ ...hero, headline_bn: e.target.value })}
                placeholder="৮৫ বছর পূর্তি উৎসব ও"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Highlighted Phrase (English - in Gold)
              </label>
              <input
                type="text"
                value={hero.headline_highlight_en}
                onChange={e => setHero({ ...hero, headline_highlight_en: e.target.value })}
                placeholder="Grand Alumni Reunion 2027"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-semibold text-amber-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Highlighted Phrase (Bengali - in Gold)
              </label>
              <input
                type="text"
                value={hero.headline_highlight_bn}
                onChange={e => setHero({ ...hero, headline_highlight_bn: e.target.value })}
                placeholder="প্রাক্তন শিক্ষার্থী পুনর্মিলনী ২০২৭"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-semibold text-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Supporting Subtitle / Description (English)
              </label>
              <textarea
                rows={3}
                value={hero.subheading_en}
                onChange={e => setHero({ ...hero, subheading_en: e.target.value })}
                placeholder="Welcoming all beloved alumni..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Supporting Subtitle / Description (Bengali)
              </label>
              <textarea
                rows={3}
                value={hero.subheading_bn}
                onChange={e => setHero({ ...hero, subheading_bn: e.target.value })}
                placeholder="ঐতিহ্যবাহী নানুপুর আবু সোবহান উচ্চ বিদ্যালয়ের সকল প্রাক্তন শিক্ষার্থীকে প্রাণঢালা আমন্ত্রণ..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: EVENT DETAILS BAR (DATE, VENUE, FEE) */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Event Date, Venue & Registration Fee Pills</span>
            </h3>
            <p className="text-xs text-slate-500">Configure key event parameters shown in the hero info bar.</p>
          </div>

          {/* Date */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Event Date
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hero.show_date}
                  onChange={e => setHero({ ...hero, show_date: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-600">Show Date Pill</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={hero.date_text_en}
                onChange={e => setHero({ ...hero, date_text_en: e.target.value })}
                placeholder="16 January 2027 (Saturday)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <input
                type="text"
                value={hero.date_text_bn}
                onChange={e => setHero({ ...hero, date_text_bn: e.target.value })}
                placeholder="১৬ জানুয়ারি ২০২৭ (শনিবার)"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Venue */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" /> Event Venue
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hero.show_venue}
                  onChange={e => setHero({ ...hero, show_venue: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-600">Show Venue Pill</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={hero.venue_text_en}
                onChange={e => setHero({ ...hero, venue_text_en: e.target.value })}
                placeholder="Nanupur Abu Sobhan High School Campus"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <input
                type="text"
                value={hero.venue_text_bn}
                onChange={e => setHero({ ...hero, venue_text_bn: e.target.value })}
                placeholder="বিদ্যালয় প্রাঙ্গণ, নানুপুর, ফটিকছড়ি, চট্টগ্রাম"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Fee */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-700" /> Registration Fee
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hero.show_fee}
                  onChange={e => setHero({ ...hero, show_fee: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-600">Show Fee Pill</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={hero.fee_text_en}
                onChange={e => setHero({ ...hero, fee_text_en: e.target.value })}
                placeholder="Registration Fee: ৳1,000 BDT"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <input
                type="text"
                value={hero.fee_text_bn}
                onChange={e => setHero({ ...hero, fee_text_bn: e.target.value })}
                placeholder="নিবন্ধন ফি: ১,০০০ টাকা"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: CALL TO ACTION BUTTONS */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Link className="w-4 h-4 text-amber-500" />
              <span>Call-To-Action (CTA) Buttons & Links</span>
            </h3>
            <p className="text-xs text-slate-500">Configure text, destinations, and visibility of hero action buttons.</p>
          </div>

          {/* Primary CTA */}
          <div className="p-4 bg-amber-50/50 rounded-xl space-y-3 border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Primary Button (Gold)
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hero.show_primary_cta}
                  onChange={e => setHero({ ...hero, show_primary_cta: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-700">Display Primary Button</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Text (English)</label>
                <input
                  type="text"
                  value={hero.primary_cta_text_en}
                  onChange={e => setHero({ ...hero, primary_cta_text_en: e.target.value })}
                  placeholder="Register for Reunion Now"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Text (Bengali)</label>
                <input
                  type="text"
                  value={hero.primary_cta_text_bn}
                  onChange={e => setHero({ ...hero, primary_cta_text_bn: e.target.value })}
                  placeholder="অনলাইনে নিবন্ধন করুন"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Link Target</label>
                <input
                  type="text"
                  value={hero.primary_cta_link}
                  onChange={e => setHero({ ...hero, primary_cta_link: e.target.value })}
                  placeholder="register"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Secondary CTA */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Secondary Button (Outline)
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hero.show_secondary_cta}
                  onChange={e => setHero({ ...hero, show_secondary_cta: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-700">Display Secondary Button</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Text (English)</label>
                <input
                  type="text"
                  value={hero.secondary_cta_text_en}
                  onChange={e => setHero({ ...hero, secondary_cta_text_en: e.target.value })}
                  placeholder="Verify Token Code"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Text (Bengali)</label>
                <input
                  type="text"
                  value={hero.secondary_cta_text_bn}
                  onChange={e => setHero({ ...hero, secondary_cta_text_bn: e.target.value })}
                  placeholder="পাস যাচাই করুন"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Link Target</label>
                <input
                  type="text"
                  value={hero.secondary_cta_link}
                  onChange={e => setHero({ ...hero, secondary_cta_link: e.target.value })}
                  placeholder="verify"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: COUNTDOWN TIMER */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span>Live Countdown Timer</span>
              </h3>
              <p className="text-xs text-slate-500">Target date and labels for the countdown clock.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hero.show_countdown}
                onChange={e => setHero({ ...hero, show_countdown: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <span className="text-xs font-bold text-slate-700">Display Countdown</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Target Date / Time (ISO format)
              </label>
              <input
                type="text"
                value={hero.countdown_target_date}
                onChange={e => setHero({ ...hero, countdown_target_date: e.target.value })}
                placeholder="2027-01-16T08:00:00+06:00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Label (English)
              </label>
              <input
                type="text"
                value={hero.countdown_label_en}
                onChange={e => setHero({ ...hero, countdown_label_en: e.target.value })}
                placeholder="Countdown to Historic Reunion"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Label (Bengali)
              </label>
              <input
                type="text"
                value={hero.countdown_label_bn}
                onChange={e => setHero({ ...hero, countdown_label_bn: e.target.value })}
                placeholder="উৎসব শুরু হতে বাকি"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 6: BACKGROUND, IMAGES & STYLING */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-700" />
              <span>Background, Images & Visual Overlay</span>
            </h3>
            <p className="text-xs text-slate-500">Choose between rich green gradients or custom background photography.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Background Style
              </label>
              <select
                value={hero.background_style}
                onChange={e => setHero({ ...hero, background_style: e.target.value as any })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              >
                <option value="gradient">Official School Emerald Gradient</option>
                <option value="image">Custom Photo Background</option>
                <option value="solid">Solid Dark Green</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Dark Overlay Opacity ({hero.overlay_opacity}%)
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={hero.overlay_opacity}
                onChange={e => setHero({ ...hero, overlay_opacity: parseInt(e.target.value, 10) || 20 })}
                className="w-full accent-emerald-700 cursor-pointer mt-2"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Accent Highlight Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hero.accent_color || '#fbbf24'}
                  onChange={e => setHero({ ...hero, accent_color: e.target.value })}
                  className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={hero.accent_color || '#fbbf24'}
                  onChange={e => setHero({ ...hero, accent_color: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Background Image URL (Optional)
              </label>
              <input
                type="url"
                value={hero.background_image_url || ''}
                onChange={e => setHero({ ...hero, background_image_url: e.target.value })}
                placeholder="https://images.unsplash.com/... or /images/school_campus.jpg"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Shown when Background Style is set to "Custom Photo Background".
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Hero Image / Mascot / Logo URL (Optional)
              </label>
              <input
                type="url"
                value={hero.hero_image_url || ''}
                onChange={e => setHero({ ...hero, hero_image_url: e.target.value })}
                placeholder="https://... or /logo.png"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Optional emblem or photo badge displayed prominently alongside headline.
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM SAVE BAR */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {hero.updated_at ? `Last saved to database: ${new Date(hero.updated_at).toLocaleString()}` : 'Ready to save changes.'}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Hero Section Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
