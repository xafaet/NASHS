import React, { useState, useEffect } from 'react';
import { Award, Users, Mail, Phone, ShieldCheck, Heart, MapPin, Target, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CommitteeMember, AssociationInfo } from '../types';
import { apiFetch } from '../utils/api';

export const AssociationView: React.FC = () => {
  const { language, t } = useLanguage();
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [associationInfo, setAssociationInfo] = useState<AssociationInfo | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/committee').then(res => res.ok ? res.json() : []),
      apiFetch('/api/association-info').then(res => res.ok ? res.json() : null),
    ])
      .then(([commData, infoData]) => {
        setCommittee(commData || []);
        if (infoData) setAssociationInfo(infoData);
      })
      .catch(err => console.warn('Association data load paused:', err));
  }, []);

  const name = associationInfo
    ? (language === 'bn' ? associationInfo.name_bn : associationInfo.name_en)
    : t('nav.association');

  const intro = associationInfo
    ? (language === 'bn' ? associationInfo.intro_bn : associationInfo.intro_en)
    : (language === 'bn'
      ? 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয়ের দেশ-বিদেশে অবস্থানরত সকল প্রাক্তন শিক্ষার্থীদের মেলবন্ধন ও সার্বিক উন্নয়নে নিবেদিত।'
      : 'Uniting alumni across all generations in service, fellowship, and advancement of our beloved institution.');

  const mission = associationInfo
    ? (language === 'bn' ? associationInfo.mission_bn : associationInfo.mission_en)
    : '';

  const vision = associationInfo
    ? (language === 'bn' ? associationInfo.vision_bn : associationInfo.vision_en)
    : '';

  const objectives = associationInfo
    ? (language === 'bn' ? associationInfo.objectives_bn : associationInfo.objectives_en)
    : [];

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 space-y-12">
      {/* Association Header */}
      <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0a331c] text-white rounded-3xl p-8 sm:p-12 shadow-xl border-b-4 border-amber-400 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
          <Award className="w-4 h-4" />
          <span>
            {language === 'bn' ? 'প্রাক্তন শিক্ষার্থী পরিষদ • স্থাপিত ১৯৮৫' : 'Alumni Association • Est. 1985'}
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {name}
        </h1>
        <p className="text-emerald-100 text-base sm:text-lg mt-3 max-w-2xl leading-relaxed">
          {intro}
        </p>
      </div>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0f4d2a] flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {language === 'bn' ? 'আমাদের মূল লক্ষ্য ও মিশন' : 'Our Mission'}
          </h3>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            {mission || (language === 'bn'
              ? 'বিদ্যালয়ের দরিদ্র ও মেধাবী শিক্ষার্থীদের বৃত্তি প্রদান, বিজ্ঞানাগার সমৃদ্ধকরণ এবং সকল ব্যাচের মধ্যে সুদৃঢ় ভ্রাতৃত্ববোধ গড়ে তোলা।'
              : 'Supporting student scholarships, advancing school development, and strengthening lifelong alumni fellowship.')}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Heart className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {language === 'bn' ? 'আমাদের ভিশন' : 'Our Vision'}
          </h3>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            {vision || (language === 'bn'
              ? 'একটি গতিশীল ও আন্তর্জাতিক প্রাক্তন শিক্ষার্থী নেটওয়ার্ক যা বিদ্যালয় ও সমাজ গঠনে পথিকৃৎ হিসেবে কাজ করবে।'
              : 'A thriving global alumni community empowering future generations and championing institutional excellence.')}
          </p>
        </div>
      </div>

      {/* Key Strategic Objectives */}
      {objectives && objectives.length > 0 && (
        <div className="bg-emerald-50/60 rounded-3xl border border-emerald-200 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-800" />
            <h3 className="text-lg font-bold text-slate-900">
              {language === 'bn' ? 'পরিষদের প্রধান কর্মপরিকল্পনাসমূহ' : 'Core Objectives & Commitments'}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {objectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Committee Directory */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {language === 'bn' ? 'কেন্দ্রীয় পরিচালনা ও উদযাপন পরিষদ' : 'Leadership & Organizing Committee'}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {language === 'bn'
              ? 'পরিষদ পরিচালনা ও পুনর্মিলনী আয়োজনে দায়িত্বপ্রাপ্ত ব্যক্তিবর্গ'
              : 'Elected officials and conveners actively coordinating alumni association initiatives.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {committee.map(member => (
            <div
              key={member.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center text-center space-y-3 hover:shadow-md transition"
            >
              <img
                src={member.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                alt={member.name_en}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-full object-cover border-4 border-emerald-100 shadow-inner"
              />
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  {language === 'bn' ? member.name_bn : member.name_en}
                </h4>
                <span className="text-xs font-bold text-[#0f4d2a] block mt-0.5">
                  {language === 'bn' ? member.designation_bn : member.designation_en}
                </span>
                {member.batch_year && (
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full inline-block mt-1">
                    {language === 'bn' ? `ব্যাচ ${member.batch_year}` : `Batch ${member.batch_year}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
