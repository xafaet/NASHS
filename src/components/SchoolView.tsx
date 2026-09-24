import React, { useState, useEffect } from 'react';
import { School, Award, Calendar, MapPin, CheckCircle2, UserCheck, BookOpen } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { SchoolInfo } from '../types';
import { apiFetch } from '../utils/api';
import { INITIAL_SCHOOL_INFO } from '../constants/initialCmsData';

export const SchoolView: React.FC = () => {
  const { language } = useLanguage();
  const [info, setInfo] = useState<SchoolInfo>(INITIAL_SCHOOL_INFO);

  useEffect(() => {
    apiFetch('/api/school-info')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setInfo(data); })
      .catch(err => console.warn('School info load paused:', err));
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 space-y-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0a331c] text-white rounded-3xl p-8 sm:p-12 shadow-xl border-b-4 border-amber-400">
        <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
          <School className="w-4 h-4" />
          <span>Established {info.established_year} • EIIN: {info.eiin_number}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {language === 'bn' ? info.name_bn : info.name_en}
        </h1>
        <p className="text-emerald-100 text-base sm:text-lg mt-3 max-w-2xl leading-relaxed">
          {language === 'bn' ? info.history_bn : info.history_en}
        </p>
      </div>

      {/* Headmaster Message & Former Headmasters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Headmaster Desk */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {language === 'bn' ? info.headmaster_name_bn : info.headmaster_name_en}
              </h3>
              <span className="text-xs text-[#0f4d2a] font-semibold">
                {language === 'bn' ? 'প্রধান শিক্ষকের বাণী' : 'Message from the Headmaster'}
              </span>
            </div>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line italic">
            "{language === 'bn' ? info.headmaster_message_bn : info.headmaster_message_en}"
          </p>
        </div>

        {/* Former Headmasters Roll of Honor */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
            {language === 'bn' ? 'স্মরণীয় প্রধান শিক্ষকবৃন্দ' : 'Former Headmasters'}
          </h4>
          <ul className="space-y-3 text-xs">
            {info.former_headmasters.map((head, idx) => (
              <li key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="font-bold text-slate-900 block">
                  {language === 'bn' ? head.name_bn : head.name_en}
                </span>
                <span className="text-emerald-700 font-mono text-[11px]">
                  {head.period}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
        <h3 className="text-xl font-bold text-slate-900">
          {language === 'bn' ? 'ক্যাম্পাস ও আধুনিক সুবিধাসমূহ' : 'Campus Infrastructure & Facilities'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {info.facilities.map((fac, idx) => (
            <div key={idx} className="flex items-center gap-2.5 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{fac}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
