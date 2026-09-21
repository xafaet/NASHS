import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Award,
  Calendar,
  CreditCard,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Clock,
  MapPin,
  Briefcase,
  Building2,
  Lock,
  Save,
  Edit3,
  Globe,
  Phone,
  Mail,
  Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Registration, User } from '../types';
import { DigitalEntryPass } from './DigitalEntryPass';
import { apiFetch } from '../utils/api';

export const MemberPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedPass, setSelectedPass] = useState<Registration | null>(null);
  const [activeTab, setActiveTab] = useState<'pass' | 'profile' | 'security'>('pass');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Security / Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile editable state
  const [profileData, setProfileData] = useState<Partial<User>>({
    name: '',
    name_bn: '',
    phone: '',
    blood_group: '',
    gender: 'male',
    occupation: '',
    designation: '',
    organization: '',
    work_location: '',
    business_name: '',
    business_type: '',
    business_address: '',
    business_website: '',
    address: '',
    bio: '',
    photo_url: '',
    privacy: {
      show_phone_publicly: false,
      show_email_publicly: false,
      show_business_publicly: true,
    }
  });

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        const token = localStorage.getItem('nash_token');
        const headers = { Authorization: `Bearer ${token}` };

        const [regRes, profRes] = await Promise.all([
          apiFetch('/api/member/registrations', { headers }),
          apiFetch('/api/member/profile', { headers })
        ]);

        if (regRes.ok) {
          const data = await regRes.json();
          setRegistrations(data || []);
          if (data && data.length > 0 && data[0].payment_status === 'paid') {
            setSelectedPass(data[0]);
          }
        }

        if (profRes.ok) {
          const prof = await profRes.json();
          setProfileData({
            name: prof.name || '',
            name_bn: prof.name_bn || '',
            phone: prof.phone || '',
            blood_group: prof.blood_group || '',
            gender: prof.gender || 'male',
            occupation: prof.occupation || '',
            designation: prof.designation || '',
            organization: prof.organization || '',
            work_location: prof.work_location || '',
            business_name: prof.business_name || '',
            business_type: prof.business_type || '',
            business_address: prof.business_address || '',
            business_website: prof.business_website || '',
            address: prof.address || '',
            bio: prof.bio || '',
            photo_url: prof.photo_url || prof.avatar || '',
            privacy: prof.privacy || {
              show_phone_publicly: false,
              show_email_publicly: false,
              show_business_publicly: true,
            }
          });
        }
      } catch (err) {
        console.warn('Member portal data load paused:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const token = localStorage.getItem('nash_token');
      const res = await fetch('/api/member/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      setProfileMsg({
        type: 'success',
        text: language === 'bn' ? 'প্রোফাইল সফলভাবে হালনাগাদ করা হয়েছে।' : 'Profile updated successfully!'
      });
    } catch (err: any) {
      setProfileMsg({
        type: 'error',
        text: err.message || 'Error updating profile.'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert(language === 'bn' ? 'ছবির আকার সর্বোচ্চ ৩ মেগাবাইট হতে হবে।' : 'Image size must be 3MB or less.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setProfileData(prev => ({ ...prev, photo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMsg({
        type: 'error',
        text: language === 'bn' ? 'বর্তমান ও নতুন পাসওয়ার্ড প্রদান করুন।' : 'Both current and new password are required.',
      });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: 'error',
        text: language === 'bn' ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: 'error',
        text: language === 'bn' ? 'নতুন পাসওয়ার্ড দুটি মিলছে না।' : 'New passwords do not match.',
      });
      return;
    }

    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      const token = localStorage.getItem('nash_token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');

      setPasswordMsg({
        type: 'success',
        text: language === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' : 'Password changed successfully!',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({
        type: 'error',
        text: err.message || 'Failed to change password.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 space-y-8">
      {/* Top Welcome Header */}
      <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0a331c] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b-4 border-amber-400">
        <div className="flex items-center gap-4">
          <div className="relative">
            {profileData.photo_url ? (
              <img
                src={profileData.photo_url}
                alt={user?.name || 'Alumnus'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold text-2xl shadow-lg border-2 border-amber-300">
                {user?.name?.charAt(0) || 'A'}
              </div>
            )}
          </div>
          <div>
            <div className="inline-block bg-white/10 px-3 py-0.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 mb-1">
              {language === 'bn' ? 'প্রাক্তন শিক্ষার্থী পরিষদ সদস্য পোর্টাল' : 'Alumni Member Portal'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {profileData.name || user?.name}
            </h1>
            <p className="text-emerald-200 text-sm mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{user?.batch || 'Batch Alumnus'}</span>
              <span>•</span>
              <span className="font-mono text-emerald-100">{user?.phone || user?.email}</span>
              {profileData.occupation && (
                <>
                  <span>•</span>
                  <span className="text-amber-300">{profileData.occupation}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium transition cursor-pointer border border-white/20"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout', 'Logout')}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 bg-white p-2 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab('pass')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'pass'
              ? 'bg-[#0f4d2a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>{language === 'bn' ? 'আমার প্রবেশপত্র ও নিবন্ধন' : 'My Registration & Pass'}</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-[#0f4d2a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{language === 'bn' ? 'প্রোফাইল, পেশা ও ব্যবসা' : 'Career, Business & Profile'}</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#0f4d2a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>{language === 'bn' ? 'সিকিউরিটি ও পাসওয়ার্ড' : 'Security & Password'}</span>
        </button>
      </div>

      {/* TAB 1: REGISTRATION & DIGITAL ENTRY PASS */}
      {activeTab === 'pass' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Profile Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-emerald-700" />
                  {language === 'bn' ? 'সদস্য পরিচিতি' : 'Member Identity'}
                </span>
                <button
                  onClick={() => setActiveTab('profile')}
                  className="text-xs text-[#0f4d2a] hover:underline font-bold inline-flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {language === 'bn' ? 'সম্পাদনা' : 'Edit'}
                </button>
              </h3>

              <div className="space-y-3 text-xs sm:text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">
                    {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                  </span>
                  <span className="font-semibold text-slate-900">{profileData.name || user?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    {language === 'bn' ? 'পাসের বছর ও ব্যাচ' : 'Passing Year & Batch'}
                  </span>
                  <span className="font-bold text-[#0f4d2a]">{user?.batch || 'Batch Alumnus'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Phone'}
                  </span>
                  <span className="font-mono text-slate-900">{profileData.phone || user?.phone || 'N/A'}</span>
                </div>
                {profileData.occupation && (
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {language === 'bn' ? 'পেশা / কর্মস্থল' : 'Occupation / Work'}
                    </span>
                    <span className="text-slate-900 font-medium">
                      {profileData.occupation}
                      {profileData.organization ? ` at ${profileData.organization}` : ''}
                    </span>
                  </div>
                )}
                {profileData.business_name && (
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {language === 'bn' ? 'ব্যবসা / উদ্যোগ' : 'Business / Venture'}
                    </span>
                    <span className="text-slate-900 font-medium">{profileData.business_name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <h4 className="font-bold flex items-center gap-1.5 text-[#0f4d2a] text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                {language === 'bn' ? 'সহায়তা ও তথ্য কেন্দ্র' : 'Help & Support'}
              </h4>
              <p>
                {language === 'bn'
                  ? 'আপনার নিবন্ধন সংক্রান্ত কোনো প্রশ্ন থাকলে যোগাযোগ করুন: +৮৮০ ১৮১৯-১২৩৪৫৬'
                  : 'For any event or pass issues, contact the Registration Sub-committee: +880 1819-123456'}
              </p>
            </div>
          </div>

          {/* Right Column: Registrations & Entry Token Pass */}
          <div className="lg:col-span-2 space-y-6">
            {/* Registration Status Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  {language === 'bn' ? '৮৫ বছর পূর্তি উৎসব নিবন্ধন' : '85th Anniversary Registration'}
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {language === 'bn' ? 'নিবন্ধিত' : 'Registered'}
                </span>
              </div>

              {registrations.length > 0 ? (
                registrations.map(reg => (
                  <div
                    key={reg.id}
                    className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 text-base block">
                        {reg.full_name} — {language === 'bn' ? reg.batch_name_bn : reg.batch_name}
                      </span>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300">
                          {reg.id}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-emerald-800">
                          ৳{(reg.fee_amount || 0).toLocaleString()} ({(reg.payment_status || 'pending').toUpperCase()})
                        </span>
                        {reg.token_code && (
                          <>
                            <span>•</span>
                            <span className="font-mono font-bold text-[#0f4d2a]">
                              Token: {reg.token_code}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedPass(reg)}
                      className="px-4 py-2 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                    >
                      {language === 'bn' ? 'প্রবেশপত্র দেখুন' : 'View Pass'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  {language === 'bn' ? 'কোনো নিবন্ধন তথ্য পাওয়া যায়নি।' : 'No registrations found.'}
                </div>
              )}
            </div>

            {/* Digital Entry Pass Viewer */}
            {selectedPass && selectedPass.token_code && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                    <Printer className="w-5 h-5 text-emerald-700" />
                    {language === 'bn' ? 'আপনার ডিজিটাল প্রবেশপত্র' : 'Your Digital Entry Pass'}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {language === 'bn' ? 'গেটে প্রদর্শনের জন্য প্রস্তুত' : 'Ready for gate scan'}
                  </span>
                </div>

                <DigitalEntryPass
                  tokenCode={selectedPass.token_code}
                  fullName={selectedPass.full_name}
                  batchName={selectedPass.batch_name}
                  batchNameBn={selectedPass.batch_name_bn}
                  passingYear={selectedPass.passing_year}
                  qrCodeSvg={selectedPass.qr_code_svg}
                  photoUrl={selectedPass.photo_url || profileData.photo_url}
                  bloodGroup={selectedPass.blood_group || profileData.blood_group}
                  occupation={selectedPass.occupation || profileData.occupation}
                  status={selectedPass.payment_status === 'paid' ? 'active' : 'pending'}
                  checkedIn={selectedPass.checked_in}
                  checkedInAt={selectedPass.checked_in_at}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE, CAREER, BUSINESS & PRIVACY */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSave} className="space-y-6">
          {profileMsg && (
            <div
              className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {profileMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          {/* Section 1: Basic & Photo */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-emerald-700" />
              {language === 'bn' ? 'ব্যক্তিগত তথ্য ও ছবি' : 'Personal Details & Profile Photo'}
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group shrink-0">
                {profileData.photo_url ? (
                  <img
                    src={profileData.photo_url}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-700 shadow-md"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold">{language === 'bn' ? 'ছবি যুক্ত করুন' : 'Add Photo'}</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center text-white text-xs font-bold transition cursor-pointer">
                  <span>{language === 'bn' ? 'পরিবর্তন' : 'Change'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">
                  {language === 'bn' ? 'প্রোফাইল ছবি (সর্বোচ্চ ৩ মেগাবাইট, JPG/PNG/WebP)' : 'Official Profile Photo (Max 3MB, JPG/PNG/WebP)'}
                </p>
                <p>
                  {language === 'bn'
                    ? 'আপনার এই ছবিটি ডিজিটাল প্রবেশপত্র এবং অ্যালামনাই ডিরেক্টরিতে প্রদর্শিত হবে।'
                    : 'This photo will appear on your official entry pass and in the alumni directory.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'পূর্ণ নাম (ইংরেজি)' : 'Full Name (English)'}
                </label>
                <input
                  type="text"
                  required
                  value={profileData.name || ''}
                  onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'পূর্ণ নাম (বাংলায়)' : 'Full Name (Bengali)'}
                </label>
                <input
                  type="text"
                  value={profileData.name_bn || ''}
                  onChange={e => setProfileData({ ...profileData, name_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="বাংলা নাম"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  required
                  value={profileData.phone || ''}
                  onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
                </label>
                <select
                  value={profileData.blood_group || ''}
                  onChange={e => setProfileData({ ...profileData, blood_group: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{language === 'bn' ? '-- নির্বাচন করুন --' : '-- Select --'}</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'বর্তমান ঠিকানা' : 'Current Residence Address'}
                </label>
                <input
                  type="text"
                  value={profileData.address || ''}
                  onChange={e => setProfileData({ ...profileData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder={language === 'bn' ? 'বাড়ি/ফ্ল্যাট, রোড, এলাকা, জেলা' : 'Street address, Area, District/City'}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Career & Employment */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-700" />
              {language === 'bn' ? 'পেশাগত তথ্য ও কর্মজীবন' : 'Career History & Professional Details'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'পেশা / ক্যাটাগরি' : 'Occupation / Industry'}
                </label>
                <input
                  type="text"
                  value={profileData.occupation || ''}
                  onChange={e => setProfileData({ ...profileData, occupation: e.target.value })}
                  placeholder="e.g. Engineer, Doctor, Educator, Business"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'পদবি / ডেজিগনেশন' : 'Job Title / Designation'}
                </label>
                <input
                  type="text"
                  value={profileData.designation || ''}
                  onChange={e => setProfileData({ ...profileData, designation: e.target.value })}
                  placeholder="e.g. Senior Software Architect, Managing Director"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'প্রতিষ্ঠান / কোম্পানি' : 'Organization / Company Name'}
                </label>
                <input
                  type="text"
                  value={profileData.organization || ''}
                  onChange={e => setProfileData({ ...profileData, organization: e.target.value })}
                  placeholder="e.g. Grameenphone, Ministry of Health"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'কর্মস্থল / শহর' : 'Work Location / City'}
                </label>
                <input
                  type="text"
                  value={profileData.work_location || ''}
                  onChange={e => setProfileData({ ...profileData, work_location: e.target.value })}
                  placeholder="e.g. Chattogram, Dhaka, Dubai, London"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Business Information (Directory) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-700" />
              {language === 'bn' ? 'ব্যবসা ও উদ্যোক্তা তথ্য (ঐচ্ছিক)' : 'Business & Entrepreneurship (Optional)'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'আপনার নিজস্ব ব্যবসা বা প্রতিষ্ঠান থাকলে তা অ্যালামনাই বাণিজ্যিক সংযোগের জন্য উল্লেখ করতে পারেন।'
                : 'Share your business details to connect with fellow alumni entrepreneurs.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Business / Trade Name'}
                </label>
                <input
                  type="text"
                  value={profileData.business_name || ''}
                  onChange={e => setProfileData({ ...profileData, business_name: e.target.value })}
                  placeholder="e.g. Sobhan Electronics, Bengal Logistics"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'ব্যবসার ধরন' : 'Business Sector / Category'}
                </label>
                <input
                  type="text"
                  value={profileData.business_type || ''}
                  onChange={e => setProfileData({ ...profileData, business_type: e.target.value })}
                  placeholder="e.g. Retail, Healthcare, IT, Export-Import"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'ওয়েবসাইট / ফেসবুক পেজ' : 'Website / Social Link'}
                </label>
                <input
                  type="text"
                  value={profileData.business_website || ''}
                  onChange={e => setProfileData({ ...profileData, business_website: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  {language === 'bn' ? 'ব্যবসায়িক ঠিকানা' : 'Business Address'}
                </label>
                <input
                  type="text"
                  value={profileData.business_address || ''}
                  onChange={e => setProfileData({ ...profileData, business_address: e.target.value })}
                  placeholder="e.g. Muradpur, Chattogram"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Privacy Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-700" />
              {language === 'bn' ? 'ব্যক্তিগত গোপনীয়তা নিয়ন্ত্রণ' : 'Alumni Directory Privacy Controls'}
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.privacy?.show_phone_publicly || false}
                  onChange={e =>
                    setProfileData({
                      ...profileData,
                      privacy: {
                        ...(profileData.privacy || { show_email_publicly: false, show_business_publicly: true }),
                        show_phone_publicly: e.target.checked,
                      }
                    })
                  }
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  {language === 'bn'
                    ? 'অন্যান্য নিবন্ধিত প্রাক্তন শিক্ষার্থীদের কাছে আমার মোবাইল নম্বর দৃশ্যমান করুন'
                    : 'Show my phone number to verified alumni members'}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.privacy?.show_email_publicly || false}
                  onChange={e =>
                    setProfileData({
                      ...profileData,
                      privacy: {
                        ...(profileData.privacy || { show_phone_publicly: false, show_business_publicly: true }),
                        show_email_publicly: e.target.checked,
                      }
                    })
                  }
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  {language === 'bn'
                    ? 'অন্যান্য নিবন্ধিত প্রাক্তন শিক্ষার্থীদের কাছে আমার ইমেইল দৃশ্যমান করুন'
                    : 'Show my email address to verified alumni members'}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.privacy?.show_business_publicly ?? true}
                  onChange={e =>
                    setProfileData({
                      ...profileData,
                      privacy: {
                        ...(profileData.privacy || { show_phone_publicly: false, show_email_publicly: false }),
                        show_business_publicly: e.target.checked,
                      }
                    })
                  }
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                />
                <span className="text-slate-700">
                  {language === 'bn'
                    ? 'আমার ব্যবসা ও উদ্যোগের তথ্য অ্যালামনাই বিজনেস ডিরেক্টরিতে প্রদর্শন করুন'
                    : 'List my business/venture in the Alumni Business Network'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {savingProfile
                  ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...')
                  : (language === 'bn' ? 'প্রোফাইল পরিবর্তন সংরক্ষণ করুন' : 'Save Profile Changes')}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: SECURITY & PASSWORD CHANGE */}
      {activeTab === 'security' && (
        <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-[#0f4d2a]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                {language === 'bn' ? 'অ্যাকাউন্ট নিরাপত্তা ও পাসওয়ার্ড পরিবর্তন' : 'Account Security & Change Password'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'bn'
                  ? 'আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করতে নিয়মিত শক্তিশালী পাসওয়ার্ড ব্যবহার করুন।'
                  : 'Maintain account security by using a strong, distinct password.'}
              </p>
            </div>
          </div>

          {passwordMsg && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 text-xs sm:text-sm ${
                passwordMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {passwordMsg.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                {language === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                {language === 'bn' ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'New Password (min 6 characters)'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                {language === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-6 py-3 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {passwordLoading
                    ? (language === 'bn' ? 'হালনাগাদ হচ্ছে...' : 'Updating...')
                    : (language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Update Password')}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
