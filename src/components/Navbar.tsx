import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Phone,
  Globe,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  School,
  ExternalLink,
  Search,
  BookOpen,
  Users,
  QrCode,
  FileText,
  ArrowRight,
  Command,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { GlobalSettings, HeaderConfig, TopBarConfig, NavigationMenuItem } from '../types';
import { apiFetch } from '../utils/api';
import {
  INITIAL_MENUS,
  INITIAL_GLOBAL_SETTINGS,
  INITIAL_TOPBAR_CONFIG,
  INITIAL_HEADER_CONFIG,
} from '../constants/initialCmsData';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenLogin }) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout, isAdmin } = useAuth();

  const [settings, setSettings] = useState<GlobalSettings>(INITIAL_GLOBAL_SETTINGS);
  const [topbar, setTopbar] = useState<TopBarConfig>(INITIAL_TOPBAR_CONFIG);
  const [header, setHeader] = useState<HeaderConfig>(INITIAL_HEADER_CONFIG);
  const [menus, setMenus] = useState<NavigationMenuItem[]>(INITIAL_MENUS);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileActiveDropdown, setMobileActiveDropdown] = useState<string | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logoError, setLogoError] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K for search, Escape to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setSearchModalOpen(false);
        setActiveDropdown(null);
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadMenus = () => {
    apiFetch('/api/appearance/menus')
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (Array.isArray(data)) setMenus(data);
      })
      .catch(err => console.warn('Menus load paused:', err));
  };

  useEffect(() => {
    apiFetch('/api/global-settings')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(err => console.warn('Global settings load paused:', err));

    apiFetch('/api/appearance/topbar')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setTopbar(data);
      })
      .catch(err => console.warn('Topbar load paused:', err));

    apiFetch('/api/appearance/header')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setHeader(data);
      })
      .catch(err => console.warn('Header load paused:', err));

    loadMenus();

    window.addEventListener('nash-menus-changed', loadMenus);
    return () => {
      window.removeEventListener('nash-menus-changed', loadMenus);
    };
  }, []);

  const handleNavClick = (targetUrl: string, target = '_self') => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    setMobileActiveDropdown(null);

    if (targetUrl.startsWith('http')) {
      if (target === '_blank') {
        window.open(targetUrl, '_blank');
      } else {
        window.location.href = targetUrl;
      }
      return;
    }

    // Strip leading slashes or hashes
    const clean = targetUrl.replace(/^[/#]+/, '') || 'home';
    onNavigate(clean);
  };

  const handleMouseEnter = (itemId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(itemId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  const isVerifyUrl = (url?: string, labelEn?: string, labelBn?: string) => {
    if ((labelEn || '').toLowerCase().includes('verify pass')) return true;
    if ((labelBn || '').includes('পাস যাচাই')) return true;
    if (!url) return false;
    const clean = url.replace(/^[/#]+/, '').toLowerCase();
    return clean === 'verify' || clean === 'verify-token' || clean === 'token-verification';
  };

  const topLevelMenus = menus
    .filter(m => !m.parent_id && m.is_active && !isVerifyUrl(m.url, m.label_en, m.label_bn))
    .sort((a, b) => a.order - b.order);

  const getSubMenus = (parentId: string) =>
    menus
      .filter(m => m.parent_id === parentId && m.is_active)
      .sort((a, b) => a.order - b.order);

  const siteName =
    language === 'bn'
      ? settings?.site_name_bn || 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয়'
      : settings?.site_name_en || 'Nanupur Abu Sobhan High School';

  const siteTagline =
    language === 'bn'
      ? settings?.site_tagline_bn || 'প্রাক্তন শিক্ষার্থী পরিষদ • ৮৫ বছর পূর্তি উৎসব ২০২৭'
      : settings?.site_tagline_en || 'Alumni Association • 85th Anniversary Celebration 2027';

  // Quick search items for spotlight search
  const searchQuickLinks = [
    {
      id: 'history',
      label_bn: 'বিদ্যালয়ের ৮৫ বছরের গৌরবময় ইতিহাস',
      label_en: 'School History & 85 Years Heritage',
      url: 'school',
      icon: BookOpen,
      category: language === 'bn' ? 'পরিচিতি' : 'About',
    },
    {
      id: 'association',
      label_bn: 'প্রাক্তন শিক্ষার্থী পরিষদ কার্যনির্বাহী কমিটি',
      label_en: 'Alumni Association & Executive Committee',
      url: 'association',
      icon: Users,
      category: language === 'bn' ? 'পরিষদ' : 'Association',
    },
    {
      id: 'register',
      label_bn: '৮৫ বছর পূর্তি উৎসব ২০২৭ অনলাইন নিবন্ধন',
      label_en: '85th Reunion Registration Form',
      url: 'register',
      icon: Sparkles,
      category: language === 'bn' ? 'নিবন্ধন' : 'Registration',
    },
    {
      id: 'verify',
      label_bn: 'ডিজিটাল এন্ট্রি পাস ও কিউআর কোড যাচাই',
      label_en: 'Digital Entry Pass & Token Verification',
      url: 'verify',
      icon: QrCode,
      category: language === 'bn' ? 'নিরাপত্তা' : 'Pass Verification',
    },
    {
      id: 'notices',
      label_bn: 'দাপ্তরিক নোটিশ ও জরুরি ঘোষণা',
      label_en: 'Official Notices & Press Releases',
      url: 'notices',
      icon: FileText,
      category: language === 'bn' ? 'বিজ্ঞপ্তি' : 'Notices',
    },
    {
      id: 'contact',
      label_bn: 'যোগাযোগ ও সরাসরি সহায়তা কেন্দ্র',
      label_en: 'Contact & Offline Registration Centers',
      url: 'contact',
      icon: Phone,
      category: language === 'bn' ? 'সহায়তা' : 'Support',
    },
    {
      id: 'faq',
      label_bn: 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলী (FAQ)',
      label_en: 'Frequently Asked Questions (FAQ)',
      url: 'home',
      icon: HelpCircle,
      category: language === 'bn' ? 'তথ্য' : 'Info',
    },
  ];

  const filteredSearchLinks = searchQuery.trim()
    ? searchQuickLinks.filter(
        item =>
          item.label_bn.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.label_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchQuickLinks;

  return (
    <header className="w-full sticky top-0 z-40 transition-shadow">
      {/* 1. TOP UTILITY BAR (Refined, Modern, High-Contrast) */}
      {(topbar?.is_enabled ?? true) && (
        <div className="bg-[#072615] text-emerald-100/90 text-xs py-2 px-4 sm:px-6 lg:px-8 border-b border-emerald-900/60 selection:bg-amber-400 selection:text-slate-950">
          <div className="max-w-7xl mx-auto flex justify-between items-center gap-3">
            {/* Left: Event Highlight Badge */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-700/60 text-amber-300 font-bold text-[11px] sm:text-xs shrink-0 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  {language === 'bn'
                    ? topbar?.announcement_bn || '১৬ জানুয়ারি ২০২৭ • শনিবার'
                    : topbar?.announcement_en || '16 January 2027 • Saturday'}
                </span>
              </div>
              <span className="hidden md:inline text-emerald-700 font-bold">•</span>
              <span className="hidden md:inline text-emerald-200/90 text-xs font-medium truncate">
                {language === 'bn'
                  ? '৮৫ বছর পূর্তি উৎসব ও প্রাক্তন শিক্ষার্থী পুনর্মিলনী'
                  : '85th Anniversary Celebration & Grand Reunion'}
              </span>
            </div>

            {/* Right: Phone, Auth & Language Switcher */}
            <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs shrink-0">
              {(topbar?.show_contact_info ?? true) && (
                <div className="hidden sm:flex items-center gap-1.5 text-emerald-200 hover:text-white transition">
                  <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                  <a
                    href={`tel:${topbar?.contact_phone || settings?.contact_phone || '+8801819123456'}`}
                    className="font-mono hover:underline text-emerald-100"
                  >
                    {topbar?.contact_phone || settings?.contact_phone || '+880 1819-123456'}
                  </a>
                </div>
              )}

              {(topbar?.show_login_link ?? true) && !user && (
                <button
                  onClick={onOpenLogin}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 hover:brightness-105 font-extrabold text-xs tracking-wide shadow-xs hover:shadow transition-all duration-200 cursor-pointer border border-amber-300 active:scale-95 group"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-950 group-hover:scale-110 transition-transform shrink-0" />
                  <span>{language === 'bn' ? 'লগইন' : 'Login'}</span>
                </button>
              )}

              {user && (
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 text-amber-300 font-bold text-xs border border-emerald-700/70 transition cursor-pointer shadow-xs active:scale-95"
                    title={user.name}
                  >
                    <div className="w-4 h-4 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-[10px]">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="max-w-[85px] sm:max-w-[120px] truncate">{user.name}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-amber-400/80 transition-transform duration-200 ${
                        userDropdownOpen ? 'rotate-180 text-amber-300' : ''
                      }`}
                    />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5 text-slate-900">
                      <div className="px-3.5 py-2.5 border-b border-slate-100">
                        <span className="font-bold text-slate-900 text-xs block truncate">
                          {user.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                            {user.role}
                          </span>
                          {user.passing_year && (
                            <span className="text-[10px] font-mono text-slate-500 font-semibold">
                              Batch {user.passing_year}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="py-1 space-y-0.5">
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            handleNavClick('member');
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#0f4d2a] rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('nav.member_portal', 'Member Portal / Dashboard')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            handleNavClick('profile');
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#0f4d2a] rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{language === 'bn' ? 'আমার প্রোফাইল' : 'My Profile'}</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setUserDropdownOpen(false);
                              handleNavClick('admin');
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-bold text-emerald-900 hover:bg-emerald-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                          >
                            <School className="w-3.5 h-3.5 text-amber-600" />
                            <span>{t('nav.admin_portal', 'Admin Portal')}</span>
                          </button>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            logout();
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-500" />
                          <span>{t('nav.logout', 'Logout')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(topbar?.show_language_selector ?? true) && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-emerald-800">|</span>
                  <button
                    onClick={toggleLanguage}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/90 hover:bg-emerald-800 text-white font-bold transition-all cursor-pointer border border-emerald-700/60 shadow-xs group active:scale-95"
                    title={language === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
                  >
                    <Globe className="w-3 h-3 text-amber-400 group-hover:rotate-45 transition-transform duration-300 shrink-0" />
                    <span className="text-[11px] tracking-wide font-medium">
                      {language === 'bn' ? 'English' : 'বাংলা'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN NAVIGATION BAR */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-all duration-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          {/* Brand Crest & School Logo */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none shrink-0"
          >
            {settings?.logo_url && !logoError ? (
              <img
                src={settings.logo_url}
                alt="School Crest"
                onError={() => setLogoError(true)}
                className="w-11 h-11 sm:w-12 sm:h-12 object-contain group-hover:scale-105 transition-transform duration-200 rounded-xl shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#0f4d2a] via-[#135d34] to-[#0a2e19] text-white flex flex-col items-center justify-center p-1 shadow-sm border border-amber-400/90 shrink-0 group-hover:shadow group-hover:scale-105 transition-all duration-200">
                <School className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-amber-300" />
                <span className="text-[8px] font-extrabold text-amber-300 tracking-tighter uppercase font-mono">
                  1942
                </span>
              </div>
            )}

            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight tracking-tight group-hover:text-[#0f4d2a] transition-colors">
                {siteName}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium tracking-normal mt-0.5 line-clamp-1">
                {siteTagline}
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav
            ref={dropdownRef}
            className="hidden lg:flex items-center gap-1 font-semibold text-sm text-slate-700"
          >
            {topLevelMenus.map(item => {
                const subItems = getSubMenus(item.id);
                const label = language === 'bn' ? item.label_bn || item.label_en : item.label_en;
                const hasSubs = subItems.length > 0;
                const isOpen = activeDropdown === item.id;
                const isCurrent =
                  currentView === item.url.replace(/^[/#]+/, '') ||
                  (item.url === '/' && currentView === 'home');

                if (hasSubs) {
                  return (
                    <div
                      key={item.id}
                      className="relative"
                      onMouseEnter={() => handleMouseEnter(item.id)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <button
                        onClick={() => setActiveDropdown(isOpen ? null : item.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition cursor-pointer text-sm ${
                          isOpen || isCurrent
                            ? 'text-[#0f4d2a] bg-emerald-50/90 font-bold border border-emerald-100 shadow-2xs'
                            : 'hover:text-[#0f4d2a] hover:bg-slate-100/80'
                        }`}
                      >
                        <span>{label}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-emerald-700' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div
                          className="absolute top-full left-0 pt-1.5 w-64 z-50 animate-in fade-in zoom-in-95 duration-150"
                          onMouseEnter={() => handleMouseEnter(item.id)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/90 p-2 ring-1 ring-black/5">
                            {subItems.map(sub => {
                              const subLabel =
                                language === 'bn' ? sub.label_bn || sub.label_en : sub.label_en;
                              const isSubActive =
                                currentView === sub.url.replace(/^[/#]+/, '');

                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => handleNavClick(sub.url, sub.target)}
                                  className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition flex items-center justify-between group cursor-pointer ${
                                    isSubActive
                                      ? 'bg-emerald-50 text-[#0f4d2a] font-bold'
                                      : 'text-slate-700 hover:bg-emerald-50/70 hover:text-[#0f4d2a]'
                                  }`}
                                >
                                  <span>{subLabel}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.url, item.target)}
                    className={`px-3.5 py-2 rounded-xl transition cursor-pointer text-sm ${
                      isCurrent
                        ? 'text-[#0f4d2a] bg-emerald-50 font-bold border border-emerald-100/70 shadow-2xs'
                        : 'hover:text-[#0f4d2a] hover:bg-slate-100/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
          </nav>

          {/* Right Action Tools: Search, Register CTA, User Account */}
          <div className="hidden lg:flex items-center gap-2.5">
            {/* Verify Pass Action Button */}
            <button
              onClick={() => handleNavClick('verify')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                currentView === 'verify'
                  ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                  : 'bg-emerald-50/90 hover:bg-emerald-100 text-[#0f4d2a] border-emerald-200/90 shadow-2xs hover:shadow-xs'
              }`}
              title={language === 'bn' ? 'ডিজিটাল এন্ট্রি পাস ও কিউআর কোড যাচাই' : 'Verify Digital Entry Pass & QR'}
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-semibold whitespace-nowrap">
                {language === 'bn' ? 'পাস যাচাই' : 'Verify Pass'}
              </span>
            </button>

            {/* Quick Search Spotlight Button */}
            {(header?.show_search ?? true) && (
              <button
                onClick={() => setSearchModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-[#0f4d2a] bg-slate-100/80 hover:bg-emerald-50/80 rounded-xl transition cursor-pointer border border-slate-200/80 hover:border-emerald-200 group"
                title={language === 'bn' ? 'অনুসন্ধান করুন (Cmd+K)' : 'Search Website (Cmd+K)'}
              >
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700" />
                <span className="hidden xl:inline text-[11px] font-medium text-slate-500 group-hover:text-emerald-900">
                  {language === 'bn' ? 'খুঁজুন' : 'Search'}
                </span>
                <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-slate-400 border border-slate-200 shadow-2xs">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Registration CTA Button */}
            {(header?.show_cta_button ?? true) && (
              <button
                onClick={() => handleNavClick(header?.cta_url || 'register')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wide bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0f4d2a] hover:from-[#135d34] hover:to-[#176e3d] text-white shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer border border-emerald-700/60 group max-w-[175px] text-center"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 group-hover:rotate-12 transition-transform duration-300" />
                <span className="leading-tight line-clamp-2">
                  {language === 'bn'
                    ? header?.cta_text_bn || 'পুনর্মিলনী নিবন্ধন'
                    : header?.cta_text_en || 'Register for Reunion'}
                </span>
              </button>
            )}
          </div>

          {/* Mobile Actions: Search, Language & Hamburger */}
          <div className="lg:hidden flex items-center gap-1.5">
            {(header?.show_search ?? true) && (
              <button
                onClick={() => setSearchModalOpen(true)}
                className="p-2 text-slate-600 hover:text-[#0f4d2a] rounded-xl hover:bg-slate-100 transition cursor-pointer"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              {language === 'bn' ? 'EN' : 'বাং'}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-[#0f4d2a] rounded-xl hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. MOBILE SLIDE-DOWN DRAWER & BACKDROP */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-30 lg:hidden transition-opacity"
          />

          {/* Slide Drawer */}
          <div className="lg:hidden relative z-40 bg-white border-b border-slate-200 shadow-2xl animate-in slide-in-from-top-4 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 space-y-4">
              {/* Primary Navigation Items */}
              <div className="space-y-1">
                {topLevelMenus.map(item => {
                    const subItems = getSubMenus(item.id);
                    const label = language === 'bn' ? item.label_bn || item.label_en : item.label_en;
                    const hasSubs = subItems.length > 0;
                    const isExpanded = mobileActiveDropdown === item.id;
                    const isCurrent =
                      currentView === item.url.replace(/^[/#]+/, '') ||
                      (item.url === '/' && currentView === 'home');

                    if (hasSubs) {
                      return (
                        <div key={item.id} className="rounded-xl overflow-hidden border border-slate-100">
                          <button
                            onClick={() =>
                              setMobileActiveDropdown(isExpanded ? null : item.id)
                            }
                            className={`w-full px-4 py-3 text-left font-bold text-sm flex items-center justify-between transition ${
                              isExpanded || isCurrent
                                ? 'bg-emerald-50 text-[#0f4d2a]'
                                : 'text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span>{label}</span>
                            <ChevronDown
                              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-emerald-700' : ''
                              }`}
                            />
                          </button>

                          {isExpanded && (
                            <div className="bg-slate-50/80 px-4 py-2 space-y-1 border-t border-slate-100">
                              {subItems.map(sub => {
                                const subLabel =
                                  language === 'bn' ? sub.label_bn || sub.label_en : sub.label_en;
                                const isSubCurrent =
                                  currentView === sub.url.replace(/^[/#]+/, '');

                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => handleNavClick(sub.url, sub.target)}
                                    className={`w-full py-2 px-3 text-left text-xs font-semibold rounded-lg transition flex items-center justify-between ${
                                      isSubCurrent
                                        ? 'text-[#0f4d2a] font-bold bg-white shadow-2xs'
                                        : 'text-slate-600 hover:text-[#0f4d2a]'
                                    }`}
                                  >
                                    <span>{subLabel}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-300" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.url, item.target)}
                        className={`w-full px-4 py-2.5 text-left font-bold text-sm rounded-xl transition ${
                          isCurrent
                            ? 'bg-emerald-50 text-[#0f4d2a]'
                            : 'text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
              </div>

              {/* Quick Action Shortcuts */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => handleNavClick('verify')}
                  className={`w-full py-2.5 rounded-xl font-bold text-center text-sm flex items-center justify-center gap-2 cursor-pointer transition border ${
                    currentView === 'verify'
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-[#0f4d2a] border-emerald-200 shadow-2xs'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  <span>
                    {language === 'bn' ? 'ডিজিটাল এন্ট্রি পাস যাচাই' : 'Verify Entry Pass & QR'}
                  </span>
                </button>

                <button
                  onClick={() => handleNavClick(header?.cta_url || 'register')}
                  className="w-full py-3 bg-gradient-to-r from-[#0f4d2a] to-[#135d34] text-white rounded-xl font-bold text-center text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-transform"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {language === 'bn'
                      ? header?.cta_text_bn || '৮৫ বছর পূর্তি পুনর্মিলনী নিবন্ধন'
                      : header?.cta_text_en || 'Register for 85th Reunion'}
                  </span>
                </button>

                {user ? (
                  <div className="space-y-1.5 pt-2">
                    <button
                      onClick={() => handleNavClick('member')}
                      className="w-full py-2 text-center text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      <span>{t('nav.member_portal', 'Member Portal')} ({user.name})</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleNavClick('admin')}
                        className="w-full py-2 text-center text-xs font-bold text-amber-800 bg-amber-50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <School className="w-3.5 h-3.5" />
                        <span>{t('nav.admin_portal', 'Admin Portal')}</span>
                      </button>
                    )}

                    <button
                      onClick={logout}
                      className="w-full py-2 text-center text-xs font-bold text-red-600 bg-red-50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('nav.logout', 'Logout')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full py-2.5 text-center text-xs font-bold text-slate-800 bg-slate-100 hover:bg-emerald-50 rounded-xl flex items-center justify-center gap-2 cursor-pointer border border-slate-200 transition"
                    >
                      <UserIcon className="w-4 h-4 text-emerald-700" />
                      <span>{language === 'bn' ? 'অ্যাকাউন্টে লগইন করুন' : 'Member / Admin Login'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. FAST SPOTLIGHT SEARCH MODAL */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-150"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-emerald-700 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'ওয়েবসাইটে খুঁজুন (যেমন: ইতিহাস, কমিটি, নোটিশ, নিবন্ধন)...'
                    : 'Search site (e.g., History, Committee, Notices, Register)...'
                }
                className="w-full text-sm sm:text-base outline-none text-slate-900 placeholder:text-slate-400 font-medium"
                autoFocus
              />
              <button
                onClick={() => {
                  setSearchModalOpen(false);
                  setSearchQuery('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 space-y-2 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {language === 'bn' ? 'প্রস্তাবিত বিভাগসমূহ' : 'Quick Navigation'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {filteredSearchLinks.length} {language === 'bn' ? 'ফলাফল' : 'results'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {filteredSearchLinks.map(link => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.id}
                      onClick={() => {
                        setSearchModalOpen(false);
                        handleNavClick(link.url);
                      }}
                      className="p-3 bg-white hover:bg-emerald-50 hover:text-[#0f4d2a] rounded-xl border border-slate-200/90 text-left font-semibold transition cursor-pointer flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0 group-hover:bg-[#0f4d2a] group-hover:text-amber-300 transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="block font-bold text-slate-800 group-hover:text-[#0f4d2a]">
                            {language === 'bn' ? link.label_bn : link.label_en}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {link.category}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
