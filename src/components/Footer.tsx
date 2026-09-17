import React, { useState, useEffect } from 'react';
import { School, MapPin, Phone, Mail, Award, Facebook, Youtube, Globe, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { FooterConfig, GlobalSettings } from '../types';
import { apiFetch } from '../utils/api';

export const Footer: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const { language, t } = useLanguage();
  const [footerConfig, setFooterConfig] = useState<FooterConfig | null>(null);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);

  useEffect(() => {
    apiFetch('/api/appearance/footer')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFooterConfig(data); })
      .catch(err => console.warn('Footer config load paused:', err));

    apiFetch('/api/global-settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(data); })
      .catch(err => console.warn('Global settings load paused:', err));
  }, []);

  const handleLinkClick = (url: string) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
      return;
    }
    const clean = url.replace(/^[/#]+/, '') || 'home';
    onNavigate(clean);
  };

  const columns = footerConfig?.columns || [];

  return (
    <footer className="bg-[#072615] text-white border-t-4 border-amber-400 no-print">
      {/* Upper Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Col 1: Identity & Heritage */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt="Logo"
                className="w-12 h-12 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0f4d2a] to-[#135d34] border border-amber-400 flex items-center justify-center text-amber-300">
                <School className="w-6 h-6" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                {language === 'bn'
                  ? settings?.site_name_bn || 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয়'
                  : settings?.site_name_en || 'Nanupur Abu Sobhan High School'}
              </h3>
              <p className="text-xs text-amber-400 font-semibold">
                {language === 'bn'
                  ? settings?.site_tagline_bn || 'প্রাক্তন শিক্ষার্থী পরিষদ'
                  : settings?.site_tagline_en || 'Alumni Association'}
              </p>
            </div>
          </div>
          <p className="text-xs text-emerald-200/80 leading-relaxed">
            {language === 'bn'
              ? '১৯৪২ সাল থেকে জ্ঞান, নৈতিকতা ও মানবিক মূল্যবোধের আলো ছড়িয়ে ৮৫ বছর পূর্ণ করতে চলেছে আমাদের প্রিয় বিদ্যাপীঠ।'
              : 'Preserving over eight decades of academic distinction, fellowship, and community transformation in Nanupur, Fatikchhari, Chattogram.'}
          </p>
          <div className="inline-flex items-center gap-2 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800 text-[11px] text-amber-300">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>85th Anniversary • 16 Jan 2027</span>
          </div>

          {/* Social Links */}
          {settings?.social_links && (
            <div className="flex items-center gap-2 pt-2">
              {settings.social_links.facebook && (
                <a
                  href={settings.social_links.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 hover:text-white rounded-lg transition"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {settings.social_links.youtube && (
                <a
                  href={settings.social_links.youtube}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 hover:text-white rounded-lg transition"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Dynamic CMS Columns (Col 2 & 3 or custom) */}
        {columns.length > 0 ? (
          columns.map(col => (
            <div key={col.id} className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 border-b border-emerald-900 pb-2">
                {language === 'bn' ? col.title_bn || col.title_en : col.title_en}
              </h4>
              <ul className="space-y-2 text-xs text-emerald-200">
                {col.links.map(lnk => (
                  <li key={lnk.id}>
                    <button
                      onClick={() => handleLinkClick(lnk.url)}
                      className="hover:text-white transition cursor-pointer text-left block"
                    >
                      {language === 'bn' ? lnk.label_bn || lnk.label_en : lnk.label_en}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          // Default fallbacks
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 border-b border-emerald-900 pb-2">
                {language === 'bn' ? '৮৫ বছর পূর্তি উৎসব' : '85th Anniversary Event'}
              </h4>
              <ul className="space-y-2 text-xs text-emerald-200">
                <li>
                  <button onClick={() => onNavigate('register')} className="hover:text-white transition cursor-pointer">
                    {t('nav.register', 'Register for Reunion')}
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('verify')} className="hover:text-white transition cursor-pointer flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    {t('nav.verify_pass', 'Verify Token Code')}
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('notices')} className="hover:text-white transition cursor-pointer">
                    {language === 'bn' ? 'জরুরি বিজ্ঞপ্তি' : 'Latest Official Notices'}
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 border-b border-emerald-900 pb-2">
                {language === 'bn' ? 'পরিচিতি ও পরিষদ' : 'Organization'}
              </h4>
              <ul className="space-y-2 text-xs text-emerald-200">
                <li>
                  <button onClick={() => onNavigate('school')} className="hover:text-white transition cursor-pointer">
                    {t('nav.school', 'School History')}
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('committee')} className="hover:text-white transition cursor-pointer">
                    {t('nav.committee', 'Executive Committee')}
                  </button>
                </li>
                <li>
                  <button onClick={() => onNavigate('contact')} className="hover:text-white transition cursor-pointer">
                    {t('nav.contact', 'Contact & Helpline')}
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}

        {/* Contact & Secretariat Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 border-b border-emerald-900 pb-2">
            {language === 'bn' ? 'ঠিকানা ও যোগাযোগ' : 'Secretariat Address'}
          </h4>
          <div className="space-y-2.5 text-xs text-emerald-200">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {settings?.contact_address ||
                  (language === 'bn'
                    ? 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ, ফটিকছড়ি, চট্টগ্রাম ৪৩৫০'
                    : 'Nanupur Abu Sobhan High School, Nanupur, Fatikchhari, Chattogram 4350, Bangladesh')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono">
                {settings?.contact_phone || '+880 1819-123456'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{settings?.contact_email || 'reunion2027@nanupuralumni.org'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Strip */}
      <div className="bg-[#041a0e] text-emerald-300/80 text-[11px] py-4 px-4 border-t border-emerald-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            {language === 'bn'
              ? footerConfig?.copyright_bn || '© ১৯৪২–২০২৭ নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন শিক্ষার্থী পরিষদ। সর্বস্বত্ব সংরক্ষিত।'
              : footerConfig?.copyright_en || '© 1942–2027 Nanupur Abu Sobhan High School Alumni Association. All rights reserved.'}
          </span>
          <div className="flex items-center gap-1 text-emerald-400">
            <span>Preserving 85 Years of Heritage with Pride</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
