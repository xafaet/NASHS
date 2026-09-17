import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { CMSPage, PageSection } from '../types';
import { School, Calendar, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Users, Award, Sparkles } from 'lucide-react';

interface Props {
  slug: string;
  onNavigate: (view: string) => void;
}

export const CMSPageView: React.FC<Props> = ({ slug, onNavigate }) => {
  const { language } = useLanguage();
  const [page, setPage] = useState<CMSPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/pages/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Page not found');
        return res.json();
      })
      .then(data => {
        setPage(data);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Loading content...</p>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
          <School className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">
          {language === 'bn' ? 'পৃষ্ঠাটি পাওয়া যায়নি' : 'Page Not Found'}
        </h2>
        <p className="text-slate-500 text-sm">
          {language === 'bn'
            ? 'আপনি যে পৃষ্ঠাটি খুঁজছেন তা প্রকাশিত হয়নি অথবা সরানো হয়েছে।'
            : 'The page you requested may be unpublished or does not exist.'}
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition cursor-pointer"
        >
          {language === 'bn' ? 'মূল পাতায় ফিরে যান' : 'Return to Home'}
        </button>
      </div>
    );
  }

  const sortedSections = [...(page.sections || [])]
    .filter(s => s.is_active)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {sortedSections.map((sec, idx) => {
        const title = language === 'bn' ? sec.title_bn || sec.title_en : sec.title_en;
        const subtitle = language === 'bn' ? sec.subtitle_bn || sec.subtitle_en : sec.subtitle_en;
        const content = language === 'bn' ? sec.content_bn || sec.content_en : sec.content_en;
        const buttonText = language === 'bn' ? sec.button_text_bn || sec.button_text_en : sec.button_text_en;

        if (sec.type === 'hero') {
          return (
            <div
              key={sec.id}
              className="relative bg-gradient-to-br from-[#0a331c] via-[#0f4d2a] to-[#072615] text-white py-20 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-md"
            >
              <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
                <div className="inline-flex items-center gap-2 bg-emerald-900/80 px-4 py-1.5 rounded-full border border-emerald-700/60 text-xs text-amber-300 font-bold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{subtitle || (language === 'bn' ? 'নানুপুর উচ্চ বিদ্যালয়' : 'Nanupur High School')}</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  {title}
                </h1>
                {content && (
                  <p className="text-base sm:text-lg text-emerald-100/90 max-w-3xl mx-auto leading-relaxed">
                    {content}
                  </p>
                )}
                {buttonText && sec.button_url && (
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        const target = sec.button_url?.replace('#', '') || 'home';
                        onNavigate(target);
                      }}
                      className="inline-flex items-center gap-2 px-8 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl shadow-lg hover:scale-105 transition cursor-pointer"
                    >
                      <span>{buttonText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (sec.type === 'text') {
          return (
            <div key={sec.id} className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
              <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-xs border border-slate-200 space-y-4">
                {title && <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h2>}
                {subtitle && <p className="text-emerald-800 font-semibold text-sm">{subtitle}</p>}
                {content && (
                  <div className="text-slate-700 leading-relaxed text-sm sm:text-base space-y-4 whitespace-pre-line">
                    {content}
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (sec.type === 'image' && sec.image_url) {
          return (
            <div key={sec.id} className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
              <div className="rounded-3xl overflow-hidden shadow-md border border-slate-200">
                <img
                  src={sec.image_url}
                  alt={title || 'Page banner'}
                  className="w-full h-80 sm:h-96 object-cover"
                  referrerPolicy="no-referrer"
                />
                {(title || content) && (
                  <div className="p-6 bg-white space-y-1">
                    {title && <h3 className="font-bold text-slate-900 text-lg">{title}</h3>}
                    {content && <p className="text-xs text-slate-500">{content}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        }

        if (sec.type === 'stats') {
          return (
            <div key={sec.id} className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
              <div className="text-center mb-8">
                {title && <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h2>}
                {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { label: language === 'bn' ? 'প্রতিষ্ঠা বছর' : 'Founded', val: '1942' },
                  { label: language === 'bn' ? 'গৌরবোজ্জ্বল বর্ষ' : 'Heritage Milestone', val: '85th' },
                  { label: language === 'bn' ? 'সফল গ্র্যাজুয়েট' : 'Alumni Network', val: '10,000+' },
                  { label: language === 'bn' ? 'প্রজন্মের মেলবন্ধন' : 'Generations', val: '80+' },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-center">
                    <div className="text-3xl font-black text-emerald-800 font-mono mb-1">{item.val}</div>
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (sec.type === 'cta') {
          return (
            <div key={sec.id} className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
              <div className="bg-gradient-to-r from-[#0f4d2a] to-[#135d34] text-white p-8 sm:p-12 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border-2 border-amber-400">
                <div className="space-y-2 text-center md:text-left">
                  <h3 className="text-2xl sm:text-3xl font-bold">{title}</h3>
                  <p className="text-emerald-100 text-sm max-w-xl">{content}</p>
                </div>
                {buttonText && sec.button_url && (
                  <button
                    onClick={() => {
                      const target = sec.button_url?.replace('#', '') || 'register';
                      onNavigate(target);
                    }}
                    className="px-8 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl shadow-md shrink-0 hover:scale-105 transition cursor-pointer"
                  >
                    {buttonText}
                  </button>
                )}
              </div>
            </div>
          );
        }

        // Default or Custom block
        return (
          <div key={sec.id} className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              {title && <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>}
              {content && <p className="text-slate-700 text-sm">{content}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
