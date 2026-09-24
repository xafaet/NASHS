import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail, Send, CheckCircle2, Clock, Navigation, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { GlobalSettings } from '../types';
import { apiFetch } from '../utils/api';
import { INITIAL_GLOBAL_SETTINGS } from '../constants/initialCmsData';

export const ContactView: React.FC = () => {
  const { language, t } = useLanguage();
  const [settings, setSettings] = useState<GlobalSettings>(INITIAL_GLOBAL_SETTINGS);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', batch: '', message: '' });

  useEffect(() => {
    apiFetch('/api/global-settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(data); })
      .catch(err => console.warn('Global settings load paused:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/contact/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        throw new Error('Failed to send message. Please try again.');
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Error sending message');
    } finally {
      setSubmitting(false);
    }
  };

  const address = language === 'bn'
    ? settings?.contact_address_bn || 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ, নানুপুর, ফটিকছড়ি, চট্টগ্রাম ৪৩৫০, বাংলাদেশ।'
    : settings?.contact_address_en || 'Nanupur Abu Sobhan High School Premises, Nanupur, Fatikchhari, Chattogram 4350, Bangladesh.';

  const phone = settings?.contact_phone || '+880 1819-123456';
  const email = settings?.contact_email || 'reunion@nanupurhighschool.edu.bd';

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('nav.contact', 'Contact Secretariat & Helpline')}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {language === 'bn'
            ? '৮৫ বছর পূর্তি পুনর্মিলনী সংক্রান্ত যে কোনো জিজ্ঞাসা ও সহযোগিতার জন্য আমাদের সাথে যোগাযোগ করুন।'
            : 'Get in touch with the 85th Anniversary Reception & Registration Sub-committees.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Info Cards */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0f4d2a] flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">
              {language === 'bn' ? 'বিদ্যালয় ও অনুষ্ঠান ভেন্যু' : 'Event Venue & Campus'}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {address}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">
              {language === 'bn' ? 'জরুরি হেল্পলাইন নম্বর' : 'Helpline & WhatsApp'}
            </h4>
            <p className="text-xs font-mono text-slate-700">
              <a href={`tel:${phone}`} className="hover:underline font-bold text-emerald-800">
                {phone}
              </a>
              <span className="block text-[11px] text-slate-400 font-sans mt-0.5">
                {language === 'bn' ? 'সাধারণ সহায়তা ও নিবন্ধন ডেস্ক' : 'General & Registration Inquiries'}
              </span>
            </p>
            {email && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 flex items-center gap-1.5 font-mono">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#0f4d2a] flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">
              {language === 'bn' ? 'যাতায়াত নির্দেশনা' : 'Route Guidance'}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'bn'
                ? 'চট্টগ্রাম মুরাদপুর অথবা অক্সিজেন মোড় থেকে নাজিরহাট/ফটিকছড়িগামী বাসে নানুপুর লায়লা কবির কলেজ গেট বা নানুপুর বাজারে নেমে হেঁটে ২ মিনিট।'
                : 'From Muradpur / Oxygen Bus Terminal (Chattogram), board Fatikchhari / Nazirhat buses to Nanupur Bazar, then a 2-minute walk to school campus.'}
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <h3 className="text-xl font-bold text-slate-900">
            {language === 'bn' ? 'বার্তা অথবা জিজ্ঞাসা পাঠান' : 'Send an Inquiry / Message'}
          </h3>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-6 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-emerald-900 text-lg">
                {language === 'bn' ? 'আপনার বার্তা সফলভাবে গৃহীত হয়েছে' : 'Message Received!'}
              </h4>
              <p className="text-xs text-emerald-700">
                {language === 'bn'
                  ? 'আমাদের অভ্যর্থনা দল দ্রুত আপনার সাথে যোগাযোগ করবে।'
                  : 'Our reception sub-committee will respond to your inquiry shortly.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: '', phone: '', batch: '', message: '' });
                }}
                className="mt-3 px-4 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer"
              >
                {language === 'bn' ? 'আরেকটি বার্তা পাঠান' : 'Send Another Message'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    {language === 'bn' ? 'আপনার নাম' : 'Your Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  {language === 'bn' ? 'এসএসসি পাসের বছর বা ব্যাচ' : 'SSC Batch / Passing Year'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2005"
                  value={formData.batch}
                  onChange={e => setFormData({ ...formData, batch: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  {language === 'bn' ? 'আপনার বার্তা' : 'Message'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder={language === 'bn' ? 'আপনার জিজ্ঞাসা এখানে লিখুন...' : 'Write your question or request here...'}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 bg-[#0f4d2a] hover:bg-[#135d34] disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4 text-amber-400" />
                <span>
                  {submitting
                    ? (language === 'bn' ? 'পাঠানো হচ্ছে...' : 'Sending...')
                    : (language === 'bn' ? 'বার্তা পাঠান' : 'Send Message')}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
