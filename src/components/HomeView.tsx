import React, { useState, useEffect } from 'react';
import {
  Award,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Users,
  GraduationCap,
  School,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gift,
  Utensils,
  Music,
  HeartHandshake,
  Phone,
  Navigation,
  Sparkle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { ProgramScheduleSectionConfig, HeroConfig } from '../types';

const defaultHero: HeroConfig = {
  badge_en: '1942–2027 • 85 Glorious Years of Legacy',
  badge_bn: '১৯৪২–২০২৭ • ৮৫ বছরের গৌরবময় ঐতিহ্য',
  show_badge: true,
  headline_en: '85th Anniversary Celebration &',
  headline_bn: '৮৫ বছর পূর্তি উৎসব ও',
  headline_highlight_en: 'Grand Alumni Reunion 2027',
  headline_highlight_bn: 'প্রাক্তন শিক্ষার্থী পুনর্মিলনী ২০২৭',
  subheading_en: 'Welcoming all beloved alumni of Nanupur Abu Sobhan High School to an unforgettable reunion of camaraderie, nostalgia, and community.',
  subheading_bn: 'ঐতিহ্যবাহী নানুপুর আবু সোবহান উচ্চ বিদ্যালয়ের সকল প্রাক্তন শিক্ষার্থীকে প্রাণঢালা আমন্ত্রণ। আসুন শৈশব ও কৈশোরের সোনালী স্মৃতিতে অবগাহন করি।',
  date_text_en: '16 January 2027 (Saturday)',
  date_text_bn: '১৬ জানুয়ারি ২০২৭ (শনিবার)',
  show_date: true,
  venue_text_en: 'Nanupur Abu Sobhan High School Campus',
  venue_text_bn: 'বিদ্যালয় প্রাঙ্গণ, নানুপুর, ফটিকছড়ি, চট্টগ্রাম',
  show_venue: true,
  fee_text_en: 'Registration Fee: ৳1,000 BDT',
  fee_text_bn: 'নিবন্ধন ফি: ১,০০০ টাকা',
  show_fee: true,
  primary_cta_text_en: 'Register for Reunion Now',
  primary_cta_text_bn: 'অনলাইনে নিবন্ধন করুন',
  primary_cta_link: 'register',
  show_primary_cta: true,
  secondary_cta_text_en: 'Verify Token Code',
  secondary_cta_text_bn: 'পাস যাচাই করুন',
  secondary_cta_link: 'verify',
  show_secondary_cta: true,
  countdown_target_date: '2027-01-16T08:00:00+06:00',
  countdown_label_en: 'Countdown to Historic Reunion',
  countdown_label_bn: 'উৎসব শুরু হতে বাকি',
  show_countdown: true,
  background_style: 'gradient',
  background_image_url: '',
  hero_image_url: '',
  overlay_opacity: 20,
  accent_color: '#fbbf24',
};

interface HomeViewProps {
  onNavigate: (view: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const { language, t } = useLanguage();

  // Dynamic fee & event info
  const [eventData, setEventData] = useState<any>(null);
  const [heroConfig, setHeroConfig] = useState<HeroConfig>(defaultHero);
  const [notices, setNotices] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [offlineCenters, setOfflineCenters] = useState<any[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [programSchedule, setProgramSchedule] = useState<ProgramScheduleSectionConfig | null>(null);

  // Live Countdown to 16 January 2027
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetStr = heroConfig.countdown_target_date || '2027-01-16T08:00:00+06:00';
    const target = new Date(targetStr).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [heroConfig.countdown_target_date]);

  useEffect(() => {
    const loadHero = () => {
      apiFetch('/api/appearance/hero')
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setHeroConfig(data); })
        .catch(err => console.warn('Hero load paused:', err));
    };

    loadHero();
    window.addEventListener('nash-hero-updated', loadHero);

    apiFetch('/api/events/current')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setEventData(data); })
      .catch(err => console.warn('Event data load paused:', err));

    apiFetch('/api/notices')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setNotices(data.slice(0, 3)); })
      .catch(err => console.warn('Notices load paused:', err));

    apiFetch('/api/faq')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setFaqs(data.filter((f: any) => f.is_active));
        }
      })
      .catch(err => console.warn('FAQs load paused:', err));

    const loadBooths = () => {
      apiFetch('/api/offline-centers')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data)) {
            setOfflineCenters(data);
          }
        })
        .catch(err => console.warn('Offline centers load paused:', err));
    };
    loadBooths();

    apiFetch('/api/program-schedule')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setProgramSchedule(data);
        }
      })
      .catch(err => console.warn('Program schedule load paused:', err));

    return () => {
      window.removeEventListener('nash-hero-updated', loadHero);
    };
  }, []);

  const getScheduleIcon = (icon?: string) => {
    switch (icon) {
      case 'gift':
        return <Gift className="w-5 h-5 text-emerald-700" />;
      case 'users':
        return <Users className="w-5 h-5 text-emerald-700" />;
      case 'award':
        return <Award className="w-5 h-5 text-emerald-700" />;
      case 'utensils':
        return <Utensils className="w-5 h-5 text-emerald-700" />;
      case 'music':
        return <Music className="w-5 h-5 text-emerald-700" />;
      case 'heart':
      case 'heart-handshake':
        return <HeartHandshake className="w-5 h-5 text-emerald-700" />;
      case 'sparkles':
        return <Sparkles className="w-5 h-5 text-emerald-700" />;
      default:
        return <Clock className="w-5 h-5 text-emerald-700" />;
    }
  };

  return (
    <div className="space-y-16 pb-16">
      {/* HERO SECTION - 100% CMS & DATABASE DRIVEN */}
      <section
        className={`relative overflow-hidden text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b-8 border-amber-400 ${
          heroConfig.background_style === 'image' && heroConfig.background_image_url
            ? ''
            : heroConfig.background_style === 'solid'
            ? 'bg-[#0a331c]'
            : 'bg-gradient-to-b from-[#0a331c] via-[#0f4d2a] to-[#135d34]'
        }`}
        style={
          heroConfig.background_style === 'image' && heroConfig.background_image_url
            ? {
                backgroundImage: `linear-gradient(rgba(10, 51, 28, ${(heroConfig.overlay_opacity ?? 20) / 100}), rgba(19, 93, 52, ${(heroConfig.overlay_opacity ?? 20) / 100})), url('${heroConfig.background_image_url}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {/* Subtle decorative geometric overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d4971c_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-8">
          {/* Milestone Badge */}
          {heroConfig.show_badge !== false && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs sm:text-sm font-extrabold uppercase tracking-widest animate-in fade-in zoom-in-90 duration-300">
              <Award className="w-4 h-4 text-amber-400" />
              <span>
                {language === 'bn'
                  ? heroConfig.badge_bn || heroConfig.badge_en
                  : heroConfig.badge_en || heroConfig.badge_bn}
              </span>
            </div>
          )}

          {/* Hero Image if configured */}
          {heroConfig.hero_image_url && (
            <div className="flex justify-center -mb-2">
              <img
                src={heroConfig.hero_image_url}
                alt="Hero Emblem"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-xl animate-in zoom-in-90 duration-300"
              />
            </div>
          )}

          {/* Main Headline & Subheading */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-display">
              {language === 'bn' ? (
                <>
                  {heroConfig.headline_bn}{' '}
                  {heroConfig.headline_highlight_bn && (
                    <>
                      <br />
                      <span style={{ color: heroConfig.accent_color || '#fbbf24' }}>
                        {heroConfig.headline_highlight_bn}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  {heroConfig.headline_en}{' '}
                  {heroConfig.headline_highlight_en && (
                    <>
                      <br />
                      <span style={{ color: heroConfig.accent_color || '#fbbf24' }}>
                        {heroConfig.headline_highlight_en}
                      </span>
                    </>
                  )}
                </>
              )}
            </h1>

            {(heroConfig.subheading_en || heroConfig.subheading_bn) && (
              <p className="text-emerald-100 text-base sm:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
                {language === 'bn'
                  ? heroConfig.subheading_bn || heroConfig.subheading_en
                  : heroConfig.subheading_en || heroConfig.subheading_bn}
              </p>
            )}
          </div>

          {/* Event Key Details Pill Bar */}
          {(heroConfig.show_date || heroConfig.show_venue || heroConfig.show_fee) && (
            <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-6 bg-black/30 backdrop-blur-xs px-6 py-3.5 rounded-2xl border border-white/10 text-xs sm:text-sm">
              {heroConfig.show_date && (
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>
                    {language === 'bn'
                      ? heroConfig.date_text_bn || heroConfig.date_text_en
                      : heroConfig.date_text_en || heroConfig.date_text_bn}
                  </span>
                </div>
              )}
              {heroConfig.show_date && (heroConfig.show_venue || heroConfig.show_fee) && (
                <span className="hidden sm:inline text-white/30">•</span>
              )}
              {heroConfig.show_venue && (
                <div className="flex items-center gap-2 text-emerald-100 font-semibold">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>
                    {language === 'bn'
                      ? heroConfig.venue_text_bn || heroConfig.venue_text_en
                      : heroConfig.venue_text_en || heroConfig.venue_text_bn}
                  </span>
                </div>
              )}
              {heroConfig.show_venue && heroConfig.show_fee && (
                <span className="hidden sm:inline text-white/30">•</span>
              )}
              {heroConfig.show_fee && (
                <div className="flex items-center gap-2 text-emerald-100 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    {language === 'bn'
                      ? heroConfig.fee_text_bn || heroConfig.fee_text_en
                      : heroConfig.fee_text_en || heroConfig.fee_text_bn}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Prominent Action Buttons */}
          {(heroConfig.show_primary_cta || heroConfig.show_secondary_cta) && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              {heroConfig.show_primary_cta && (
                <button
                  onClick={() => onNavigate(heroConfig.primary_cta_link || 'register')}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl font-extrabold text-base bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 shadow-xl shadow-amber-950/30 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5 text-slate-950" />
                  <span>
                    {language === 'bn'
                      ? heroConfig.primary_cta_text_bn || 'অনলাইনে নিবন্ধন করুন'
                      : heroConfig.primary_cta_text_en || 'Register for Reunion Now'}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              {heroConfig.show_secondary_cta && (
                <button
                  onClick={() => onNavigate(heroConfig.secondary_cta_link || 'verify')}
                  className="w-full sm:w-auto px-7 py-4 rounded-xl font-bold text-base bg-white/10 hover:bg-white/20 active:bg-white/5 text-white border border-white/20 backdrop-blur-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                  <span>
                    {language === 'bn'
                      ? heroConfig.secondary_cta_text_bn || 'পাস যাচাই করুন'
                      : heroConfig.secondary_cta_text_en || 'Verify Token Code'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* LIVE COUNTDOWN TIMER */}
          {heroConfig.show_countdown && (
            <div className="pt-8 max-w-xl mx-auto">
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-200 block mb-3">
                {language === 'bn'
                  ? heroConfig.countdown_label_bn || 'উৎসব শুরু হতে বাকি'
                  : heroConfig.countdown_label_en || 'Countdown to Historic Reunion'}
              </span>
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                <div className="bg-black/40 backdrop-blur-xs p-3 sm:p-4 rounded-2xl border border-white/10">
                  <span className="text-2xl sm:text-4xl font-extrabold text-amber-400 font-mono block">
                    {timeLeft.days}
                  </span>
                  <span className="text-[10px] sm:text-xs text-emerald-200 font-semibold uppercase">
                    {language === 'bn' ? 'দিন' : 'Days'}
                  </span>
                </div>
                <div className="bg-black/40 backdrop-blur-xs p-3 sm:p-4 rounded-2xl border border-white/10">
                  <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono block">
                    {timeLeft.hours.toString().padStart(2, '0')}
                  </span>
                  <span className="text-[10px] sm:text-xs text-emerald-200 font-semibold uppercase">
                    {language === 'bn' ? 'ঘণ্টা' : 'Hours'}
                  </span>
                </div>
                <div className="bg-black/40 backdrop-blur-xs p-3 sm:p-4 rounded-2xl border border-white/10">
                  <span className="text-2xl sm:text-4xl font-extrabold text-white font-mono block">
                    {timeLeft.minutes.toString().padStart(2, '0')}
                  </span>
                  <span className="text-[10px] sm:text-xs text-emerald-200 font-semibold uppercase">
                    {language === 'bn' ? 'মিনিট' : 'Minutes'}
                  </span>
                </div>
                <div className="bg-black/40 backdrop-blur-xs p-3 sm:p-4 rounded-2xl border border-white/10">
                  <span className="text-2xl sm:text-4xl font-extrabold text-amber-400 font-mono block">
                    {timeLeft.seconds.toString().padStart(2, '0')}
                  </span>
                  <span className="text-[10px] sm:text-xs text-emerald-200 font-semibold uppercase">
                    {language === 'bn' ? 'সেকেন্ড' : 'Seconds'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-6 sm:p-8 -mt-12 relative z-20 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#0f4d2a] font-mono">1942</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {language === 'bn' ? 'প্রতিষ্ঠা বছর' : 'Foundation Year'}
            </span>
          </div>
          <div className="space-y-1 pt-4 lg:pt-0">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-600 font-mono">85</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {language === 'bn' ? 'বছরের গৌরব' : 'Years of Legacy'}
            </span>
          </div>
          <div className="space-y-1 pt-4 lg:pt-0">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#0f4d2a] font-mono">84+</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {language === 'bn' ? 'ঐতিহাসিক ব্যাচ' : 'Registered Batches'}
            </span>
          </div>
          <div className="space-y-1 pt-4 lg:pt-0">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-600 font-mono">5,000+</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {language === 'bn' ? 'প্রত্যাশিত উপস্থিতি' : 'Expected Attendees'}
            </span>
          </div>
        </div>
      </section>

      {/* EVENT SCHEDULE / HIGHLIGHTS - 100% CMS CONTROLLED & TOGGLEABLE */}
      {programSchedule && programSchedule.is_enabled !== false && (
        <section id="program-schedule" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            {(programSchedule.badge_en || programSchedule.badge_bn) && (
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {language === 'bn' ? (programSchedule.badge_bn || programSchedule.badge_en) : (programSchedule.badge_en || programSchedule.badge_bn)}
              </span>
            )}
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {language === 'bn' ? (programSchedule.title_bn || programSchedule.title_en) : (programSchedule.title_en || programSchedule.title_bn)}
            </h2>
            {(programSchedule.subtitle_en || programSchedule.subtitle_bn) && (
              <p className="text-slate-500 text-sm max-w-xl mx-auto">
                {language === 'bn' ? (programSchedule.subtitle_bn || programSchedule.subtitle_en) : (programSchedule.subtitle_en || programSchedule.subtitle_bn)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(programSchedule.items || [])
              .filter(item => item.is_active !== false)
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map(item => (
                <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                        {item.time}
                      </span>
                      {getScheduleIcon(item.icon)}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {language === 'bn' ? (item.title_bn || item.title_en) : (item.title_en || item.title_bn)}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {language === 'bn' ? (item.description_bn || item.description_en) : (item.description_en || item.description_bn)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* NOTICES PREVIEW */}
      {notices.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {language === 'bn' ? 'জরুরি ঘোষণা' : 'Official Announcements'}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                  {language === 'bn' ? 'সর্বশেষ বিজ্ঞপ্তি ও নোটিশ' : 'Latest Circulars & Guidelines'}
                </h3>
              </div>
              <button
                onClick={() => onNavigate('notices')}
                className="text-xs font-bold text-[#0f4d2a] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'bn' ? 'সকল নোটিশ দেখুন' : 'View All Notices'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {notices.map(n => (
                <div key={n.id} className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs space-y-2">
                  <span className="text-[11px] font-mono text-emerald-700 font-bold block">
                    {n.publish_date}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2">
                    {language === 'bn' ? n.title_bn : n.title_en}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {language === 'bn' ? n.content_bn : n.content_en}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* OFFLINE REGISTRATION CENTERS (OFFICIAL BOOTHS) */}
      {offlineCenters.length > 0 && (
        <section id="centers" className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <MapPin className="w-3.5 h-3.5 text-amber-700" />
              <span>{language === 'bn' ? 'অফলাইন নিবন্ধন বুথ' : 'Offline Registration Centers'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {language === 'bn' ? 'সরাসরি নিবন্ধন ও ফি জমাদান কেন্দ্র' : 'Authorized Registration Booths'}
            </h2>
            <p className="text-slate-600 text-sm max-w-2xl mx-auto">
              {language === 'bn'
                ? 'অনলাইনের পাশাপাশি নানুপুর ও চট্টগ্রামের নির্ধারিত কেন্দ্রসমূহে সরাসরি উপস্থিত হয়ে নিবন্ধন সম্পন্ন ও ফি পরিশোধ করা যাবে।'
                : 'In addition to online payment, you can visit our authorized offline booths to register and pay in person.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {offlineCenters.map((center) => {
              const name = language === 'bn' ? (center.name_bn || center.name_en) : (center.name_en || center.name_bn);
              const address = language === 'bn' ? (center.address_bn || center.address_en) : (center.address_en || center.address_bn);
              const contactPerson = language === 'bn' ? (center.contact_person_bn || center.contact_person) : (center.contact_person || center.contact_person_bn);
              const timings = language === 'bn' ? (center.timings_bn || center.timings) : (center.timings || center.timings_bn);
              const description = language === 'bn' ? (center.description_bn || center.description_en) : (center.description_en || center.description_bn);
              const rawAddress = `${center.name_en || center.name_bn}, ${center.address_en || center.address_bn}`;
              const mapLink = center.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddress)}`;

              return (
                <div
                  key={center.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0f4d2a] flex items-center justify-center border border-emerald-200">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {name}
                      </h3>
                      {contactPerson && (
                        <p className="text-xs text-emerald-800 font-semibold mt-0.5">
                          {language === 'bn' ? 'দায়িত্বপ্রাপ্ত:' : 'Contact:'} {contactPerson}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {address}
                    </p>

                    {description && (
                      <p className="text-xs text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100/70">
                        {description}
                      </p>
                    )}

                    {timings && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span>{timings}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    {center.phone && (
                      <a
                        href={`tel:${center.phone.replace(/[^0-9+]/g, '')}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#0f4d2a] hover:bg-[#135d34] text-white text-xs font-bold transition shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'কল করুন' : 'Call Now'}</span>
                      </a>
                    )}

                    <a
                      href={mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition border border-slate-200"
                    >
                      <Navigation className="w-3.5 h-3.5 text-slate-600" />
                      <span>{language === 'bn' ? 'দিকনির্দেশনা' : 'Direction'}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {language === 'bn' ? 'সাধারণ জিজ্ঞাসাসমূহ (FAQ)' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-slate-500 text-sm">
            {language === 'bn'
              ? 'নিবন্ধন ও প্রবেশপত্র সংক্রান্ত যাবতীয় তথ্যাবলি'
              : 'Everything you need to know regarding registration, fees, passes, and venue attendance.'}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.length > 0 ? (
            faqs.map((faq, idx) => {
              const q = language === 'bn' ? faq.question_bn || faq.question_en : faq.question_en;
              const a = language === 'bn' ? faq.answer_bn || faq.answer_en : faq.answer_en;
              const isOpen = openFaq === faq.id || (openFaq === null && idx === 0);

              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? '' : faq.id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm hover:text-emerald-800 transition cursor-pointer"
                  >
                    <span>
                      {idx + 1}. {q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-700' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 whitespace-pre-line bg-slate-50/50">
                      {a}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  {language === 'bn'
                    ? '১. পুনর্মিলনীর নিবন্ধন ফি কত এবং এতে কী কী অন্তর্ভুক্ত রয়েছে?'
                    : '1. What is the reunion registration fee and what does it cover?'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {language === 'bn'
                    ? `নিবন্ধন ফি নির্ধারিত হয়েছে ৳${eventData?.registration_fee || 1000} টাকা। এর মধ্যে সারাদিনের খাবার (মেজবানি ভোজ, নাস্তা), কাস্টম স্মারক কিট, টি-শার্ট, ক্যাপ, ৮৫ বছর পূর্তির স্মরণিকা গ্রন্থ ও সাংস্কৃতিক সন্ধ্যা উপভোগ অন্তর্ভুক্ত।`
                    : `The official registration fee is ৳${eventData?.registration_fee || 1000} BDT. This covers full day dining (authentic Mezban feast, refreshments), commemorative gift kit (polo shirt, souvenir book, tote, cap), and musical concert entry.`}
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  {language === 'bn'
                    ? '২. আমি আমার ডিজিটাল প্রবেশপত্র কীভাবে সংগ্রহ করব?'
                    : '2. How do I receive my official digital entry pass?'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {language === 'bn'
                    ? 'পেমেন্ট সম্পন্ন হওয়ার সাথে সাথে সিস্টেম স্বয়ংক্রিয়ভাবে একটি নিরাপদ কিউআর কোডযুক্ত প্রবেশপত্র ইস্যু করে। আপনি এটি সঙ্গে সঙ্গে ডাউনলোড বা প্রিন্ট করতে পারবেন, অথবা সদস্য পোর্টালে লগইন করে যেকোনো সময় দেখতে পারবেন।'
                    : 'Immediately upon successful payment, our server generates your cryptographic entry pass featuring token code NASH-85-2027-XXXXXX and secure QR code. You can print, download as image, or view it anytime in your Member Portal.'}
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  {language === 'bn'
                    ? '৩. কীভাবে আমার ব্যাচ নির্ধারিত হয়?'
                    : '3. How is my batch dynamically calculated?'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {language === 'bn'
                    ? 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় ১৯৪২ সালে প্রতিষ্ঠিত। আপনি যখন আপনার এসএসসি পাসের বছর (যেমন ২০০৫) প্রদান করেন, সিস্টেম স্বয়ংক্রিয়ভাবে আপনার ব্যাচের নাম (যেমন ব্যাচ ২০০৫ / ৬৪তম ব্যাচ) নির্ধারণ করে।'
                    : 'Established in 1942, our system calculates your official batch number dynamically based on your SSC graduation year (e.g. 2005 corresponds to Batch 2005 / 64th Batch).'}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0a331c] rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl border-4 border-amber-400/80 space-y-6">
          <div className="inline-flex p-3 bg-amber-400/20 text-amber-300 rounded-2xl">
            <School className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight max-w-2xl mx-auto">
            {language === 'bn'
              ? 'আসুন ফিরে যাই সোনালী সেই দিনগুলিতে...'
              : 'Let Us Return to Our Golden Campus Days'}
          </h2>
          <p className="text-emerald-100 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {language === 'bn'
              ? '১৬ জানুয়ারি ২০২৭ তারিখে নানুপুর আবু সোবহান উচ্চ বিদ্যালয়ের মাঠ আপনাকে ডাকছে। আজই নিবন্ধন সম্পন্ন করে আপনার প্রবেশপত্র নিশ্চিত করুন।'
              : 'Join thousands of your fellow alumni on 16 January 2027. Secure your official 85th Anniversary entry pass today.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('register')}
              className="px-8 py-4 rounded-xl font-extrabold text-base bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xl transition cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-slate-950" />
              <span>{language === 'bn' ? 'অনলাইনে নিবন্ধন করুন' : 'Register for Reunion (৳1,000 BDT)'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
