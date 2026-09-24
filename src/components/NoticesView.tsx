import React, { useState, useEffect } from 'react';
import { Bell, Calendar, Download, FileText, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Notice } from '../types';
import { apiFetch } from '../utils/api';
import { INITIAL_NOTICES } from '../constants/initialCmsData';

export const NoticesView: React.FC = () => {
  const { language, t } = useLanguage();
  const [notices, setNotices] = useState<Notice[]>(INITIAL_NOTICES);
  const [activeNotice, setActiveNotice] = useState<Notice | null>(INITIAL_NOTICES[0] || null);

  useEffect(() => {
    apiFetch('/api/notices')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list = data || [];
        setNotices(list);
        if (list.length > 0) setActiveNotice(list[0]);
      })
      .catch(err => console.warn('Notices load paused:', err));
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Bell className="w-8 h-8 text-[#0f4d2a]" />
          <span>{t('nav.notices', 'Official Notices & Circulars')}</span>
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {language === 'bn'
            ? '৮৫ বছর পূর্তি উৎসব ও পরিষদ সম্পর্কিত সকল দাপ্তরিক ঘোষণা ও নির্দেশনা।'
            : 'Official announcements, registration guidelines, and event circulars.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Notices List */}
        <div className="space-y-3">
          {notices.map(n => (
            <button
              key={n.id}
              onClick={() => setActiveNotice(n)}
              className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                activeNotice?.id === n.id
                  ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{n.publish_date}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                {language === 'bn' ? n.title_bn : n.title_en}
              </h4>
            </button>
          ))}
        </div>

        {/* Notice Reader */}
        {activeNotice && (
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-bold">
                CIRCULAR #{(activeNotice.id || '').toUpperCase()}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                {language === 'bn' ? activeNotice.title_bn : activeNotice.title_en}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                <span>Published: {activeNotice.publish_date}</span>
                <span>•</span>
                <span>Category: {(activeNotice.category || (language === 'bn' ? 'সাধারণ' : 'General')).toUpperCase()}</span>
              </div>
            </div>

            <div className="prose prose-sm text-slate-700 leading-relaxed space-y-4">
              <p className="font-semibold text-slate-900">
                {language === 'bn' ? activeNotice.content_bn : activeNotice.content_en}
              </p>
              <p className="text-xs text-slate-500">
                Issued under the authority of the Convener & Member Secretary, Nanupur Abu Sobhan High School Alumni Association.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
