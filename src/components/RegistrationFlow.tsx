import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  User as UserIcon,
  Phone,
  Mail,
  Award,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Heart,
  Clock,
  Upload,
  Briefcase,
  MapPin,
  Camera,
  FileText,
  Shirt,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Registration, RegistrationFieldConfig } from '../types';
import { PaymentModal } from './PaymentModal';
import { DigitalEntryPass } from './DigitalEntryPass';
import { apiFetch } from '../utils/api';

interface RegistrationFlowProps {
  onGoToPortal?: () => void;
}

const DEFAULT_REGISTRATION_FIELDS: RegistrationFieldConfig[] = [
  {
    name: 'full_name',
    label_en: 'Full Name',
    label_bn: 'পূর্ণ নাম',
    placeholder_en: 'e.g. Mohammad Rafiqul Islam',
    placeholder_bn: 'যেমন: মোহাম্মদ রফিকুল ইসলাম',
    help_text_en: 'As per academic certificates or National ID',
    help_text_bn: 'সনদপত্র অথবা জাতীয় পরিচয়পত্র অনুযায়ী',
    type: 'text',
    is_required: true,
    is_enabled: true,
    order: 1,
    grid_span: 'full',
  },
  {
    name: 'dob',
    label_en: 'Date of Birth',
    label_bn: 'জন্ম তারিখ',
    type: 'date',
    is_required: true,
    is_enabled: true,
    order: 2,
    grid_span: 'half',
  },
  {
    name: 'gender',
    label_en: 'Gender',
    label_bn: 'লিঙ্গ',
    type: 'select',
    is_required: true,
    is_enabled: true,
    order: 3,
    options: ['male', 'female', 'other'],
    options_bn: ['পুরুষ', 'মহিলা', 'অন্যান্য'],
    grid_span: 'half',
  },
  {
    name: 'passing_year',
    label_en: 'Passing / SSC Year',
    label_bn: 'পাসের বছর / এসএসসি সাল',
    placeholder_en: 'e.g. 2005',
    placeholder_bn: 'যেমন: ২০০৫',
    help_text_en: 'Year you completed SSC or studied at Nanupur High School',
    help_text_bn: 'যে সালে বিদ্যালয় ত্যাগ বা এসএসসি উত্তীর্ণ হয়েছিলেন',
    type: 'number',
    is_required: true,
    is_enabled: true,
    order: 4,
    grid_span: 'half',
    validation_rule: 'min:1942|max:2035',
  },
  {
    name: 'phone',
    label_en: 'Mobile Number',
    label_bn: 'মোবাইল নম্বর',
    placeholder_en: '018XXXXXXXX',
    placeholder_bn: '০১৮XXXXXXXX',
    help_text_en: 'Active mobile number to receive confirmation & entry pass',
    help_text_bn: 'এসএমএস ও প্রবেশ টোকেন কোড পেতে সচল নম্বর দিন',
    type: 'tel',
    is_required: true,
    is_enabled: true,
    order: 5,
    grid_span: 'half',
  },
  {
    name: 'blood_group',
    label_en: 'Blood Group',
    label_bn: 'রক্তের গ্রুপ',
    type: 'select',
    is_required: false,
    is_enabled: true,
    order: 6,
    options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    grid_span: 'half',
  },
  {
    name: 't_shirt_size',
    label_en: 'T-Shirt Size',
    label_bn: 'টি-শার্টের সাইজ',
    placeholder_en: 'Select size (M, L, XL, XXL, XXXL)',
    placeholder_bn: 'সাইজ নির্বাচন করুন',
    help_text_en: 'Commemorative 85th reunion polo shirt size',
    help_text_bn: '৮৫ বছর পূর্তির বিশেষ স্মারক টি-শার্টের সাইজ',
    type: 'select',
    is_required: true,
    is_enabled: true,
    order: 7,
    options: ['M', 'L', 'XL', 'XXL', 'XXXL'],
    options_bn: ['M (মিডিয়াম)', 'L (লার্জ)', 'XL (এক্সট্রা লার্জ)', 'XXL (ডাবল এক্সেল)', 'XXXL (ট্রিপল এক্সেল)'],
    grid_span: 'half',
    validation_rule: 'required|in:M,L,XL,XXL,XXXL',
  },
  {
    name: 'email',
    label_en: 'Email Address',
    label_bn: 'ইমেইল ঠিকানা',
    placeholder_en: 'alumni@example.com',
    placeholder_bn: 'alumni@example.com',
    type: 'email',
    is_required: false,
    is_enabled: true,
    order: 8,
    grid_span: 'half',
  },
  {
    name: 'occupation',
    label_en: 'Occupation / Organization',
    label_bn: 'পেশা / কর্মস্থল',
    placeholder_en: 'e.g. Engineer, Teacher, Banker',
    placeholder_bn: 'যেমন: প্রকৌশলী, শিক্ষক, ব্যবসায়ী',
    type: 'text',
    is_required: false,
    is_enabled: true,
    order: 9,
    grid_span: 'half',
  },
  {
    name: 'address',
    label_en: 'Current Address / Location',
    label_bn: 'বর্তমান ঠিকানা',
    placeholder_en: 'e.g. Chattogram, Dhaka, or Abroad',
    placeholder_bn: 'যেমন: চট্টগ্রাম, ঢাকা, অথবা প্রবাস',
    type: 'text',
    is_required: false,
    is_enabled: true,
    order: 10,
    grid_span: 'full',
  },
  {
    name: 'photo_url',
    label_en: 'Passholder Photo',
    label_bn: 'প্রবেশপত্রের জন্য ছবি',
    help_text_en: 'Clear portrait photo for printed digital entry pass (max 2MB)',
    help_text_bn: 'ডিজিটাল প্রবেশপত্রের জন্য স্পষ্ট পাসপোর্ট সাইজ ছবি (সর্বোচ্চ ২ MB)',
    type: 'file',
    is_required: false,
    is_enabled: true,
    order: 11,
    grid_span: 'full',
  },
];

export const RegistrationFlow: React.FC<RegistrationFlowProps> = ({ onGoToPortal }) => {
  const { language, t } = useLanguage();

  // Dynamic Form Configuration
  const [fields, setFields] = useState<RegistrationFieldConfig[]>(DEFAULT_REGISTRATION_FIELDS);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    gender: 'male',
    passing_year: '2005',
    blood_group: '',
    t_shirt_size: 'L',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Event & Fee Settings
  const [feeAmount, setFeeAmount] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>('BDT');
  const [eventId, setEventId] = useState<string>('event-85th-anniversary');

  // UI Flow Steps: 'form' | 'review' | 'success'
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');
  const [createdRegistration, setCreatedRegistration] = useState<Registration | null>(null);
  const [issuedToken, setIssuedToken] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch dynamic registration form fields from CMS/Database
  useEffect(() => {
    apiFetch('/api/registration/fields')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setFields(data);
        }
      })
      .catch(err => console.warn('Registration fields load fallback active:', err));
  }, []);

  // Fetch current event & fee on mount
  useEffect(() => {
    apiFetch('/api/events/current')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.id) {
          setEventId(data.id);
        }
        if (data?.registration_fee) {
          setFeeAmount(data.registration_fee);
        }
        if (data?.currency) {
          setCurrency(data.currency);
        }
      })
      .catch(err => console.warn('Event fee load paused:', err));
  }, []);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage(
          language === 'bn'
            ? 'ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট হতে পারে।'
            : 'Photo size must be 2MB or less.'
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        handleInputChange('photo_url', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Dynamic Validation against CMS-configured rules
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const activeFields = fields.filter(f => f.is_enabled !== false);

    for (const field of activeFields) {
      const val = formValues[field.name];
      const isMissing = val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
      const fieldLabel = language === 'bn' ? field.label_bn : field.label_en;

      if (field.is_required && isMissing) {
        setErrorMessage(
          language === 'bn'
            ? `অনুগ্রহ করে '${fieldLabel}' পূরণ করুন।`
            : `Please enter '${fieldLabel}'.`
        );
        return;
      }

      if (!isMissing && field.validation_rule) {
        const rules = field.validation_rule.split('|');
        for (const rule of rules) {
          if (rule.startsWith('min:')) {
            const min = parseInt(rule.split(':')[1], 10);
            if (field.type === 'number') {
              if (Number(val) < min) {
                setErrorMessage(
                  language === 'bn'
                    ? `'${fieldLabel}' অবশ্যই সর্বনিম্ন ${min} হতে হবে।`
                    : `'${fieldLabel}' must be at least ${min}.`
                );
                return;
              }
            } else if (String(val).length < min) {
              setErrorMessage(
                language === 'bn'
                  ? `'${fieldLabel}' কমপক্ষে ${min} অক্ষরের হতে হবে।`
                  : `'${fieldLabel}' must be at least ${min} characters.`
              );
              return;
            }
          }
          if (rule.startsWith('max:')) {
            const max = parseInt(rule.split(':')[1], 10);
            if (field.type === 'number') {
              if (Number(val) > max) {
                setErrorMessage(
                  language === 'bn'
                    ? `'${fieldLabel}' সর্বোচ্চ ${max} হতে পারে।`
                    : `'${fieldLabel}' cannot exceed ${max}.`
                );
                return;
              }
            } else if (String(val).length > max) {
              setErrorMessage(
                language === 'bn'
                  ? `'${fieldLabel}' সর্বোচ্চ ${max} অক্ষরের হতে পারে।`
                  : `'${fieldLabel}' cannot exceed ${max} characters.`
              );
              return;
            }
          }
        }
      }
    }

    setStep('review');
  };

  const handleConfirmAndInitiatePayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          full_name: formValues.full_name || '',
          dob: formValues.dob || '',
          gender: formValues.gender || 'male',
          passing_year: parseInt(formValues.passing_year, 10) || 2005,
          blood_group: formValues.blood_group || undefined,
          t_shirt_size: formValues.t_shirt_size || 'L',
          phone: formValues.phone || '',
          email: formValues.email || undefined,
          address: formValues.address || undefined,
          occupation: formValues.occupation || undefined,
          photo_url: formValues.photo_url || undefined,
          notes: JSON.stringify(formValues),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.existing_registration_id) {
          setErrorMessage(data.message);
          return;
        }
        throw new Error(data.message || 'Registration creation failed.');
      }

      setCreatedRegistration(data.registration);
      setShowPaymentModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating registration.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (verifyResult: any) => {
    setShowPaymentModal(false);
    setCreatedRegistration(verifyResult.registration);
    setIssuedToken(verifyResult.token);
    setStep('success');

    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0f4d2a', '#d4971c', '#c92a2a', '#229957'],
      });
    } catch (e) {
      // Ignore in environments without canvas
    }
  };

  // Helper icon selector for dynamic fields
  const renderFieldIcon = (field: RegistrationFieldConfig) => {
    switch (field.name) {
      case 'full_name':
        return <UserIcon className="w-5 h-5" />;
      case 'dob':
        return <Calendar className="w-5 h-5" />;
      case 'phone':
        return <Phone className="w-5 h-5" />;
      case 'email':
        return <Mail className="w-5 h-5" />;
      case 'blood_group':
        return <Heart className="w-5 h-5" />;
      case 't_shirt_size':
        return <Shirt className="w-5 h-5" />;
      case 'occupation':
        return <Briefcase className="w-5 h-5" />;
      case 'address':
        return <MapPin className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  // Active, ordered fields for rendering
  const activeFields = [...fields]
    .filter(f => f.is_enabled !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Step Progress Indicators */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-xl mx-auto relative">
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-200 -z-0" />

          {/* Step 1 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                step === 'form'
                  ? 'bg-[#0f4d2a] text-white ring-4 ring-emerald-100 shadow-md'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              1
            </div>
            <span className="text-xs font-semibold mt-1.5 text-slate-700">
              {language === 'bn' ? 'তথ্য পূরণ' : 'Personal Info'}
            </span>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                step === 'review'
                  ? 'bg-[#0f4d2a] text-white ring-4 ring-emerald-100 shadow-md'
                  : step === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              2
            </div>
            <span className="text-xs font-semibold mt-1.5 text-slate-700">
              {language === 'bn' ? 'যাচাই ও ফি' : 'Review & Fee'}
            </span>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                step === 'success'
                  ? 'bg-[#0f4d2a] text-white ring-4 ring-emerald-100 shadow-md'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              3
            </div>
            <span className="text-xs font-semibold mt-1.5 text-slate-700">
              {language === 'bn' ? 'প্রবেশ টোকেন' : 'Entry Token'}
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: DYNAMIC FORM */}
      {step === 'form' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#0f4d2a] to-[#135d34] text-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Award className="w-4 h-4" />
              <span>{t('nav.reunion_title')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('reg.heading')}</h2>
            <p className="text-emerald-100 text-sm mt-1.5 max-w-xl">{t('reg.subheading')}</p>
          </div>

          {errorMessage && (
            <div className="m-6 mb-0 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleProceedToReview} className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {activeFields.map(field => {
                const label = language === 'bn' ? field.label_bn : field.label_en;
                const placeholder =
                  language === 'bn' ? field.placeholder_bn || '' : field.placeholder_en || '';
                const helpText = language === 'bn' ? field.help_text_bn : field.help_text_en;
                const spanClass =
                  field.grid_span === 'half' ? 'col-span-1' : 'col-span-1 sm:col-span-2';
                const value = formValues[field.name] ?? '';

                if (field.type === 'file') {
                  return (
                    <div key={field.name} className={`${spanClass} p-4 bg-slate-50 rounded-2xl border border-slate-200`}>
                      <label className="block text-sm font-bold text-slate-800 mb-1">
                        {label} {field.is_required && <span className="text-red-500">*</span>}
                      </label>
                      {helpText && <p className="text-xs text-slate-500 mb-3">{helpText}</p>}
                      <div className="flex items-center gap-4">
                        {value ? (
                          <div className="relative">
                            <img
                              src={value}
                              alt="Uploaded Preview"
                              className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-600 shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleInputChange(field.name, '')}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs font-bold flex items-center justify-center cursor-pointer shadow-sm hover:bg-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                            <Camera className="w-6 h-6" />
                          </div>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer shadow-xs"
                        >
                          <Upload className="w-4 h-4 text-emerald-700" />
                          <span>
                            {value
                              ? language === 'bn'
                                ? 'ছবি পরিবর্তন করুন'
                                : 'Change Photo'
                              : language === 'bn'
                              ? 'ছবি নির্বাচন করুন'
                              : 'Upload Photo'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                }

                if (field.type === 'select') {
                  return (
                    <div key={field.name} className={spanClass}>
                      <label className="block text-sm font-bold text-slate-800 mb-1.5">
                        {label} {field.is_required && <span className="text-red-500">*</span>}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          {renderFieldIcon(field)}
                        </div>
                        <select
                          value={value}
                          required={field.is_required}
                          onChange={e => handleInputChange(field.name, e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none transition text-base"
                        >
                          <option value="">
                            {placeholder || (language === 'bn' ? 'নির্বাচন করুন' : 'Select...')}
                          </option>
                          {field.options?.map((opt, idx) => {
                            const optLabel =
                              language === 'bn' && field.options_bn?.[idx]
                                ? field.options_bn[idx]
                                : opt;
                            return (
                              <option key={opt} value={opt}>
                                {optLabel}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      {helpText && <span className="text-xs text-slate-500 mt-1 block">{helpText}</span>}
                    </div>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={field.name} className={spanClass}>
                      <label className="block text-sm font-bold text-slate-800 mb-1.5">
                        {label} {field.is_required && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        rows={3}
                        value={value}
                        required={field.is_required}
                        onChange={e => handleInputChange(field.name, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none transition text-base"
                      />
                      {helpText && <span className="text-xs text-slate-500 mt-1 block">{helpText}</span>}
                    </div>
                  );
                }

                return (
                  <div key={field.name} className={spanClass}>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">
                      {label} {field.is_required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        {renderFieldIcon(field)}
                      </div>
                      <input
                        type={field.type}
                        required={field.is_required}
                        value={value}
                        onChange={e => handleInputChange(field.name, e.target.value)}
                        placeholder={placeholder}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none transition text-base"
                      />
                    </div>
                    {helpText && <span className="text-xs text-slate-500 mt-1 block">{helpText}</span>}
                  </div>
                );
              })}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-4 px-6 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/20 transition cursor-pointer"
              >
                <span>{t('form.next', 'Review & Proceed')}</span>
                <ArrowRight className="w-5 h-5 text-amber-400" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: REVIEW & FEE CONFIRMATION */}
      {step === 'review' && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="bg-[#0f4d2a] text-white p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {language === 'bn' ? 'তথ্য ও ফি পর্যালোচনা' : 'Review Registration Details'}
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              {language === 'bn'
                ? 'পেমেন্টে এগিয়ে যাওয়ার পূর্বে আপনার তথ্য যাচাই করুন।'
                : 'Please verify your information before proceeding to payment.'}
            </p>
          </div>

          {errorMessage && (
            <div className="m-6 mb-0 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {/* Info Summary Table from dynamic fields */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 divide-y divide-slate-200 text-sm">
              {activeFields.map(field => {
                const val = formValues[field.name];
                if (!val && !field.is_required) return null;
                const label = language === 'bn' ? field.label_bn : field.label_en;

                if (field.type === 'file' && val) {
                  return (
                    <div key={field.name} className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-500">{label}</span>
                      <img
                        src={val}
                        alt="Review Passholder"
                        className="w-10 h-10 rounded-full object-cover border border-emerald-600"
                      />
                    </div>
                  );
                }

                return (
                  <div key={field.name} className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-900">{String(val || '—')}</span>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Fee Box from Database */}
            <div className="bg-amber-50/70 border-2 border-amber-300/80 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block">
                  {language === 'bn' ? 'অফিসিয়াল নিবন্ধন ফি' : 'Official Reunion Registration Fee'}
                </span>
                <p className="text-xs text-amber-800 mt-0.5">
                  {language === 'bn'
                    ? 'স্মরণিকা কিট, ভেন্যু খাবার, ব্যাচ উপহার ও সাংস্কৃতিক সন্ধ্যা অন্তর্ভুক্ত'
                    : 'Includes commemorative kit, full-day dining, souvenir & cultural evening'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#0f4d2a]">
                  ৳{feeAmount.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-600 block">{currency}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="py-3.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('form.back', 'Back & Edit')}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmAndInitiatePayment}
                disabled={loading}
                className="flex-1 py-3.5 px-6 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span>
                  {language === 'bn'
                    ? `পেমেন্ট করুন (৳${feeAmount.toLocaleString()})`
                    : `Proceed to Payment (৳${feeAmount.toLocaleString()} BDT)`}
                </span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS & DIGITAL ENTRY PASS */}
      {step === 'success' && createdRegistration && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          {/* Celebratory Banner */}
          <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0f4d2a] text-white rounded-2xl p-6 sm:p-8 text-center shadow-xl border-2 border-amber-400/50">
            <div className="inline-flex p-3 bg-amber-400/20 rounded-full text-amber-300 mb-3">
              <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {language === 'bn' ? '🎉 অভিনন্দন! আপনার নিবন্ধন সফল হয়েছে' : '🎉 Registration Successful!'}
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base mt-2 max-w-lg mx-auto">
              {language === 'bn'
                ? 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে। আপনার জন্য নির্ধারিত ডিজিটাল প্রবেশপত্র নিচে দেওয়া হলো। এটি প্রিন্ট বা সংরক্ষণ করে রাখুন।'
                : 'Payment verified successfully. Your official 85th Anniversary entry pass with verified QR code has been issued below.'}
            </p>
          </div>

          {/* Digital Entry Pass */}
          <DigitalEntryPass
            tokenCode={createdRegistration.token_code || 'NASH-85-2027-ABC123'}
            fullName={createdRegistration.full_name}
            batchName={createdRegistration.batch_name}
            batchNameBn={createdRegistration.batch_name_bn}
            passingYear={createdRegistration.passing_year}
            qrCodeSvg={createdRegistration.qr_code_svg || issuedToken?.qr_code_svg}
            photoUrl={createdRegistration.photo_url || formValues.photo_url}
            bloodGroup={createdRegistration.blood_group || formValues.blood_group}
            occupation={createdRegistration.occupation || formValues.occupation}
            status="active"
            checkedIn={false}
          />

          {/* Go to Member Portal Button */}
          {onGoToPortal && (
            <div className="text-center pt-4">
              <button
                onClick={onGoToPortal}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md transition cursor-pointer"
              >
                <span>{t('token.view_portal', 'Go to Member Portal')}</span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment Gateway Modal */}
      {createdRegistration && (
        <PaymentModal
          registration={createdRegistration}
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};
