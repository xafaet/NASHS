import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'bn' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<string, { en: string; bn: string }> = {
  // Navigation & Branding
  'nav.school_name': {
    en: 'Nanupur Abu Sobhan High School Alumni Association',
    bn: 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন শিক্ষার্থী পরিষদ',
  },
  'nav.reunion_title': {
    en: '85th Anniversary Celebration & Alumni Reunion',
    bn: '৮৫ বছর পূর্তি উৎসব ও প্রাক্তন শিক্ষার্থী পুনর্মিলনী',
  },
  'nav.home': { en: 'Home', bn: 'মূল পাতা' },
  'nav.about': { en: 'About', bn: 'পরিচিতি' },
  'nav.school': { en: 'School History', bn: 'বিদ্যালয়ের ইতিহাস' },
  'nav.association': { en: 'Alumni Association', bn: 'প্রাক্তন শিক্ষার্থী পরিষদ' },
  'nav.committee': { en: 'Committee', bn: 'কার্যনির্বাহী কমিটি' },
  'nav.events': { en: 'Anniversary Event', bn: 'পূর্তি উৎসব' },
  'nav.notices': { en: 'Notices', bn: 'বিজ্ঞপ্তি' },
  'nav.news': { en: 'News & Updates', bn: 'সংবাদ ও তথ্য' },
  'nav.verify_pass': { en: 'Verify Token', bn: 'টোকেন যাচাই' },
  'nav.contact': { en: 'Contact', bn: 'যোগাযোগ' },
  'nav.login': { en: 'Login', bn: 'লগইন' },
  'nav.register': { en: 'Register for Reunion', bn: 'পুনর্মিলনী নিবন্ধন' },
  'nav.member_portal': { en: 'Member Portal', bn: 'সদস্য পোর্টাল' },
  'nav.admin_portal': { en: 'Admin Portal', bn: 'অ্যাডমিন পোর্টাল' },
  'nav.logout': { en: 'Logout', bn: 'লগআউট' },

  // Hero Section
  'hero.heritage': {
    en: '85 Years of Heritage, Friendship & Memories',
    bn: '৮৫ বছরের ঐতিহ্য, বন্ধুত্ব ও স্মৃতির মেলবন্ধন',
  },
  'hero.event_date': {
    en: '16 January 2027 • Saturday',
    bn: '১৬ জানুয়ারি ২০২৭ • শনিবার',
  },
  'hero.venue': {
    en: 'Nanupur Abu Sobhan High School Premises, Fatikchhari, Chattogram',
    bn: 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ, ফটিকছড়ি, চট্টগ্রাম',
  },
  'hero.reg_fee': {
    en: 'Registration Fee: BDT',
    bn: 'নিবন্ধন ফি: ৳',
  },
  'hero.cta_register': {
    en: 'Register for 85th Anniversary',
    bn: '৮৫ বছর পূর্তিতে নিবন্ধন করুন',
  },
  'hero.cta_verify': {
    en: 'Already Registered? View My Token',
    bn: 'নিবন্ধন করেছেন? টোকেন দেখুন',
  },

  // Event Details
  'event.title': {
    en: '85th Anniversary Celebration & Grand Alumni Reunion 2027',
    bn: '৮৫ বছর পূর্তি উৎসব ও মহা পুনর্মিলনী ২০২৭',
  },
  'event.organizer': {
    en: 'Organized by Nanupur Abu Sobhan High School Alumni Association',
    bn: 'আয়োজনে: নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন শিক্ষার্থী পরিষদ',
  },
  'event.fee_label': {
    en: 'Reunion Registration Fee',
    bn: 'পুনর্মিলনী নিবন্ধন ফি',
  },
  'event.fee_badge': {
    en: 'Official Fee per Alumnus',
    bn: 'জনপ্রতি নির্ধারিত ফি',
  },
  'event.countdown_days': { en: 'Days', bn: 'দিন' },
  'event.countdown_hours': { en: 'Hours', bn: 'ঘণ্টা' },
  'event.countdown_minutes': { en: 'Minutes', bn: 'মিনিট' },
  'event.countdown_seconds': { en: 'Seconds', bn: 'সেকেন্ড' },

  // Registration Form
  'reg.heading': {
    en: '85th Anniversary Alumni Registration',
    bn: '৮৫ বছর পূর্তি প্রাক্তন শিক্ষার্থী নিবন্ধন',
  },
  'reg.subheading': {
    en: 'Complete your registration in simple steps. A digital entry token with QR code will be generated upon verified payment.',
    bn: 'সহজ কয়েকটি পদক্ষেপে আপনার নিবন্ধন সম্পন্ন করুন। যাচাইকৃত পেমেন্টের সাথে সাথেই কিউআর কোডযুক্ত ডিজিটাল প্রবেশ টোকেন পাবেন।',
  },
  'reg.step_personal': { en: '1. Personal Information', bn: '১. ব্যক্তিগত তথ্য' },
  'reg.step_review': { en: '2. Review & Batch', bn: '২. ব্যাচ ও বিবরণ যাচাই' },
  'reg.step_payment': { en: '3. Secure Payment', bn: '৩. নিরাপদ পেমেন্ট' },
  'reg.step_token': { en: '4. Entry Token', bn: '৪. প্রবেশ টোকেন' },

  'form.full_name': { en: 'Full Name', bn: 'পূর্ণ নাম' },
  'form.full_name_placeholder': { en: 'e.g. Mohammad Rafiqul Islam', bn: 'যেমন: মোহাম্মদ রফিকুল ইসলাম' },
  'form.dob': { en: 'Date of Birth', bn: 'জন্ম তারিখ' },
  'form.gender': { en: 'Gender', bn: 'লিঙ্গ' },
  'form.gender_male': { en: 'Male', bn: 'পুরুষ' },
  'form.gender_female': { en: 'Female', bn: 'নারী' },
  'form.gender_other': { en: 'Other', bn: 'অন্যান্য' },
  'form.passing_year': { en: 'Passing Year (SSC / Metric)', bn: 'পাসের বছর (এসএসসি/ম্যাট্রিক)' },
  'form.passing_year_hint': { en: 'Batch will be calculated automatically', bn: 'পাসের বছর অনুসারে ব্যাচ স্বয়ংক্রিয়ভাবে নির্ধারিত হবে' },
  'form.batch_calculated': { en: 'Calculated Batch', bn: 'নির্ধারিত ব্যাচ' },
  'form.blood_group': { en: 'Blood Group (Optional)', bn: 'রক্তের গ্রুপ (ঐচ্ছিক)' },
  'form.phone': { en: 'Mobile Number', bn: 'মোবাইল নম্বর' },
  'form.phone_placeholder': { en: '01XXXXXXXXX', bn: '০১XXXXXXXXX' },
  'form.email': { en: 'Email (Optional)', bn: 'ইমেইল (ঐচ্ছিক)' },
  'form.next': { en: 'Review & Proceed', bn: 'বিবরণ যাচাই করুন' },
  'form.back': { en: 'Back', bn: 'পূর্ববর্তী' },
  'form.pay_now': { en: 'Proceed to Payment (৳1,000)', bn: 'পেমেন্ট করুন (৳১,০০০)' },

  // Token Pass
  'token.entry_pass': { en: 'Official Digital Entry Pass', bn: 'অফিসিয়াল ডিজিটাল প্রবেশপত্র' },
  'token.number': { en: 'Token Number', bn: 'টোকেন নম্বর' },
  'token.valid': { en: 'Verified & Active', bn: 'যাচাইকৃত ও সক্রিয়' },
  'token.scan_notice': { en: 'Scan QR at school gate on 16 January 2027', bn: '১৬ জানুয়ারি ২০২৭ তারিখে বিদ্যালয়ের প্রধান ফটকে কিউআর স্ক্যান করুন' },
  'token.print': { en: 'Print Pass', bn: 'প্রিন্ট করুন' },
  'token.download': { en: 'Download Pass', bn: 'ডাউনলোড করুন' },
  'token.view_portal': { en: 'Go to Member Portal', bn: 'সদস্য পোর্টালে যান' },

  // Verification Page
  'verify.title': { en: 'Entry Token Verification', bn: 'প্রবেশ টোকেন যাচাইকরণ' },
  'verify.desc': {
    en: 'Check the validity of any 85th Anniversary entry token issued by Nanupur Abu Sobhan High School Alumni Association.',
    bn: 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন শিক্ষার্থী পরিষদ কর্তৃক প্রদত্ত ৮৫ বছর পূর্তি উৎসবের যে কোনো প্রবেশ টোকেন যাচাই করুন।',
  },
  'verify.input_placeholder': { en: 'Enter Token (e.g. NASH-85-2027-ABC123)', bn: 'টোকেন কোড লিখুন (যেমন: NASH-85-2027-ABC123)' },
  'verify.button': { en: 'Verify Token', bn: 'টোকেন যাচাই করুন' },
  'verify.valid_title': { en: 'Valid & Genuine Token', bn: 'বৈধ ও সঠিক প্রবেশ টোকেন' },
  'verify.invalid_title': { en: 'Invalid or Unrecognized Token', bn: 'অবৈধ বা অস্বীকৃত টোকেন' },
  'verify.status_used': { en: 'Already Checked In', bn: 'ইতিমধ্যে প্রবেশ সম্পন্ন হয়েছে' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('nash_lang');
    return (saved === 'en' || saved === 'bn') ? saved : 'bn'; // Default to Bengali as requested
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nash_lang', lang);
    document.documentElement.lang = lang;
  };

  const toggleLanguage = () => {
    const next = language === 'bn' ? 'en' : 'bn';
    setLanguage(next);
  };

  const t = (key: string, fallback?: string): string => {
    const item = translations[key];
    if (item) {
      return item[language] || item.en;
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
