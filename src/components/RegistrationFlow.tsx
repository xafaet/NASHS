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
  Copy,
  Check,
  Download,
  Printer,
  Smartphone,
  Info,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Registration, RegistrationFieldConfig } from '../types';
import { DigitalEntryPass } from './DigitalEntryPass';
import { apiFetch } from '../utils/api';

interface RegistrationFlowProps {
  onGoToPortal?: () => void;
  onGoToVerify?: (tokenCode?: string) => void;
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
    placeholder_en: 'Select T-shirt size (M, L, XL, XXL, XXXL)',
    placeholder_bn: 'টি-শার্টের সাইজ নির্বাচন করুন',
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

export const RegistrationFlow: React.FC<RegistrationFlowProps> = ({ onGoToPortal, onGoToVerify }) => {
  const { language, t } = useLanguage();

  // Dynamic Form Configuration
  const [fields, setFields] = useState<RegistrationFieldConfig[]>(DEFAULT_REGISTRATION_FIELDS);
  const [formValues, setFormValues] = useState<Record<string, any>>({
    gender: 'male',
    passing_year: '2005',
    blood_group: '',
    t_shirt_size: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Event & Fee Settings
  const [feeAmount, setFeeAmount] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>('BDT');
  const [eventId, setEventId] = useState<string>('event-85th-anniversary');

  // UI Flow Steps: 'form' | 'review' | 'manual_payment' | 'success'
  const [step, setStep] = useState<'form' | 'review' | 'manual_payment' | 'success'>('form');
  const [createdRegistration, setCreatedRegistration] = useState<Registration | null>(null);
  const [issuedToken, setIssuedToken] = useState<any>(null);
  const [manualPaymentInfo, setManualPaymentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual payment state
  const [selectedGateway, setSelectedGateway] = useState<'bkash' | 'nagad'>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSubmittedSuccess, setPaymentSubmittedSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

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

  // Fetch current event & fee on mount, as well as active payment gateways
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

    apiFetch('/api/gateways')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setManualPaymentInfo((prev: any) => ({
            ...(prev || {}),
            gateways: data,
          }));
        }
      })
      .catch(() => {});
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
          t_shirt_size: formValues.t_shirt_size ? formValues.t_shirt_size.trim().toUpperCase() : undefined,
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
      setIssuedToken(data.token);
      setManualPaymentInfo(data.manual_payment_info);
      setSenderNumber(formValues.phone || data.registration.phone || '');
      setStep('manual_payment');

      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0f4d2a', '#d4971c', '#229957'],
        });
      } catch (e) {
        // Ignore in environments without canvas
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    const token = createdRegistration?.token_code || manualPaymentInfo?.token_code || '';
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyNumber = (num: string, id: string) => {
    navigator.clipboard.writeText(num.replace(/[\s-]/g, ''));
    setCopiedNumber(id);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleSubmitManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdRegistration) return;
    setPaymentError(null);

    if (!senderNumber.trim()) {
      setPaymentError(
        language === 'bn'
          ? 'অনুগ্রহ করে প্রেরক মোবাইল নম্বর লিখুন।'
          : 'Please enter the sender mobile number used for payment.'
      );
      return;
    }

    if (!transactionId.trim() || transactionId.trim().length < 4) {
      setPaymentError(
        language === 'bn'
          ? 'অনুগ্রহ করে সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন।'
          : 'Please enter a valid Transaction ID (TrxID) received from bKash or Nagad.'
      );
      return;
    }

    setPaymentSubmitting(true);
    try {
      const res = await fetch('/api/payments/manual-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: createdRegistration.id,
          token_code: createdRegistration.token_code,
          gateway: selectedGateway,
          sender_number: senderNumber.trim(),
          transaction_id: transactionId.trim().toUpperCase(),
          amount: createdRegistration.fee_amount || feeAmount,
          notes: paymentNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Payment confirmation submission failed.');
      }

      setCreatedRegistration(data.registration);
      setPaymentSubmittedSuccess(true);
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to submit payment confirmation. Please try again.');
    } finally {
      setPaymentSubmitting(false);
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
                  : step === 'manual_payment' || step === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              2
            </div>
            <span className="text-xs font-semibold mt-1.5 text-slate-700">
              {language === 'bn' ? 'যাচাই ও নিশ্চিতকরণ' : 'Review & Submit'}
            </span>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center relative z-10">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                step === 'manual_payment'
                  ? 'bg-[#0f4d2a] text-white ring-4 ring-emerald-100 shadow-md'
                  : step === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              3
            </div>
            <span className="text-xs font-semibold mt-1.5 text-slate-700">
              {language === 'bn' ? 'পেমেন্ট ও টোকেন' : 'Payment & Token'}
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
                {loading ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    <span>{language === 'bn' ? 'জমা দেওয়া হচ্ছে...' : 'Submitting Registration...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-amber-400" />
                    <span>
                      {language === 'bn'
                        ? 'রেজিস্ট্রেশন জমা দিন'
                        : 'Submit Registration'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: REGISTRATION CONFIRMATION & MANUAL PAYMENT INSTRUCTIONS */}
      {step === 'manual_payment' && createdRegistration && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Official Bilingual Confirmation Card */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-600/40 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0f4d2a] via-[#135d34] to-[#0f4d2a] text-white p-6 sm:p-8 text-center relative">
              <div className="inline-flex p-3 bg-amber-400/20 rounded-full text-amber-300 mb-3">
                <CheckCircle2 className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {language === 'bn' ? 'আপনার রেজিস্ট্রেশনের জন্য ধন্যবাদ!' : 'Thank you for registering!'}
              </h2>
              <p className="text-emerald-100 text-sm sm:text-base mt-2 max-w-2xl mx-auto leading-relaxed">
                {language === 'bn'
                  ? 'আপনার রেজিস্ট্রেশন ফর্ম সফলভাবে জমা হয়েছে। আপনার রেজিস্ট্রেশন এখন পেমেন্ট যাচাইয়ের অপেক্ষায় রয়েছে। পেমেন্ট যাচাই সম্পন্ন হওয়ার পর আপনার রেজিস্ট্রেশন চূড়ান্তভাবে নিশ্চিত করা হবে।'
                  : 'Your registration form has been successfully submitted. Your registration is now awaiting payment verification. Your registration will be confirmed after payment verification.'}
              </p>
            </div>

            {/* Token / Payment Reference Banner */}
            <div className="p-6 sm:p-8 bg-amber-50/60 border-b border-amber-200/80">
              <div className="max-w-xl mx-auto text-center space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block">
                  {language === 'bn'
                    ? 'আপনার Registration Token / Payment Reference Number'
                    : 'Your Registration Token / Payment Reference Number'}
                </span>
                
                <div className="inline-flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border-2 border-amber-400 shadow-md">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-[#0f4d2a] tracking-wider">
                    {createdRegistration.token_code || manualPaymentInfo?.token_code}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Copy Token"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" />
                        <span className="text-emerald-800 font-bold">{language === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-amber-800" />
                        <span>{language === 'bn' ? 'কপি করুন' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-amber-900 leading-normal">
                  {language === 'bn'
                    ? 'Use this Token/Reference Number as your bKash or Nagad Payment Reference.'
                    : 'Use this Token/Reference Number as your bKash or Nagad Payment Reference.'}
                </p>

                <div className="pt-2 flex justify-center gap-3 flex-wrap">
                  <a
                    href={`/api/registrations/${createdRegistration.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <Download className="w-4 h-4 text-[#0f4d2a]" />
                    <span>{language === 'bn' ? 'রেজিস্ট্রেশন স্লিপ ডাউনলোড (PDF)' : 'Download Registration Slip (PDF)'}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>{language === 'bn' ? 'প্রিন্ট স্লিপ' : 'Print Summary'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content Body: Manual Payment Numbers & Instructions */}
            <div className="p-6 sm:p-8 space-y-8">
              {/* CMS-Driven Payment Accounts */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#0f4d2a]" />
                  <span>
                    {language === 'bn'
                      ? 'ম্যানুয়াল পেমেন্ট নম্বর (bKash ও Nagad)'
                      : 'Manual Payment Numbers (bKash & Nagad)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  {language === 'bn'
                    ? 'নির্ধারিত ফি পাঠানোর জন্য নিচের যেকোনো একটি নম্বরে টাকা পাঠান:'
                    : 'Send your registration fee to any of the verified official numbers below:'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* bKash Card */}
                  {(() => {
                    const bkashGw = manualPaymentInfo?.gateways?.find((g: any) => g.code === 'bkash');
                    const num = bkashGw?.merchant_number || bkashGw?.merchant_id || bkashGw?.credentials?.merchant_number || '';
                    if (!num) return null;
                    return (
                      <div className="p-5 rounded-2xl border-2 border-pink-200 bg-pink-50/50 flex flex-col justify-between space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-pink-900 text-lg block">bKash</span>
                            <span className="text-[11px] font-semibold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                              {bkashGw?.account_type || 'Merchant'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-pink-200 shadow-xs">
                            ৳{createdRegistration.fee_amount || feeAmount} BDT
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-pink-200">
                          <span className="font-mono text-lg font-black text-pink-950 tracking-wider">
                            {num}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyNumber(num, 'bkash')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-900 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            {copiedNumber === 'bkash' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-pink-800" />
                                <span>{language === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-pink-800" />
                                <span>{language === 'bn' ? 'নম্বর কপি' : 'Copy Number'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-[11px] text-pink-800 leading-snug">
                          {language === 'bn'
                            ? bkashGw?.instructions_bn || 'বিকাশ অ্যাপ থেকে পেমেন্ট করুন এবং রেফারেন্সে আপনার টোকেন নম্বর দিন।'
                            : bkashGw?.instructions_en || 'Send money or make payment from your bKash app using your Token Number as reference.'}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Nagad Card */}
                  {(() => {
                    const nagadGw = manualPaymentInfo?.gateways?.find((g: any) => g.code === 'nagad');
                    const num = nagadGw?.merchant_number || nagadGw?.merchant_id || nagadGw?.credentials?.merchant_number || '';
                    if (!num) return null;
                    return (
                      <div className="p-5 rounded-2xl border-2 border-orange-200 bg-orange-50/50 flex flex-col justify-between space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-orange-900 text-lg block">Nagad</span>
                            <span className="text-[11px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                              {nagadGw?.account_type || 'Personal (Send Money)'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-orange-200 shadow-xs">
                            ৳{createdRegistration.fee_amount || feeAmount} BDT
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-orange-200">
                          <span className="font-mono text-lg font-black text-orange-950 tracking-wider">
                            {num}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyNumber(num, 'nagad')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-900 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            {copiedNumber === 'nagad' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-orange-800" />
                                <span>{language === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-orange-800" />
                                <span>{language === 'bn' ? 'নম্বর কপি' : 'Copy Number'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-[11px] text-orange-800 leading-snug">
                          {language === 'bn'
                            ? nagadGw?.instructions_bn || 'নগদ অ্যাপ থেকে টাকা পাঠান এবং রেফারেন্সে আপনার টোকেন নম্বর দিন।'
                            : nagadGw?.instructions_en || 'Send money from your Nagad app using your Token Number as reference.'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#0f4d2a]" />
                  <span>
                    {language === 'bn' ? 'পেমেন্ট নির্দেশিকা (ধাপে ধাপে):' : 'Payment Instructions (Step-by-Step):'}
                  </span>
                </h4>
                
                {language === 'bn' ? (
                  <ol className="space-y-2.5 text-xs sm:text-sm text-slate-700 list-decimal list-inside font-medium leading-relaxed">
                    <li>উপরের <strong>bKash</strong> অথবা <strong>Nagad</strong> নম্বরে নির্ধারিত রেজিস্ট্রেশন ফি <strong>(৳{(createdRegistration.fee_amount || feeAmount).toLocaleString()})</strong> পাঠান।</li>
                    <li>Payment Reference হিসেবে আপনার Token Number (<strong>{createdRegistration.token_code}</strong>) ব্যবহার করুন।</li>
                    <li>পেমেন্ট সম্পন্ন করার পর নিচের <strong>Confirm Payment</strong> ফর্মটি পূরণ করে জমা দিন।</li>
                    <li>এডমিন কর্তৃক আপনার পেমেন্ট যাচাই করার পর রেজিস্ট্রেশন চূড়ান্তভাবে নিশ্চিত করা হবে।</li>
                  </ol>
                ) : (
                  <ol className="space-y-2.5 text-xs sm:text-sm text-slate-700 list-decimal list-inside font-medium leading-relaxed">
                    <li>Send the registration fee <strong>(৳{(createdRegistration.fee_amount || feeAmount).toLocaleString()} BDT)</strong> to the displayed bKash or Nagad number.</li>
                    <li>Use your generated Token Number (<strong>{createdRegistration.token_code}</strong>) as the Payment Reference.</li>
                    <li>After completing the payment, fill out and submit the <strong>Confirm Payment</strong> form below.</li>
                    <li>Your registration will be confirmed after payment verification by our administration.</li>
                  </ol>
                )}
              </div>

              {/* Interactive Confirm Payment Form */}
              <div className="bg-emerald-50/40 rounded-2xl p-6 border-2 border-emerald-500/40">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {language === 'bn' ? 'পেমেন্ট নিশ্চিতকরণ ফর্ম (Confirm Payment)' : 'Confirm Payment Submission'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {language === 'bn'
                        ? 'টাকা পাঠানোর পর প্রাপ্ত ট্রানজেকশন আইডি (TrxID) নিচে প্রদান করুন'
                        : 'Submit your payment transaction details for administrative verification'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                    {paymentSubmittedSuccess || createdRegistration.payment_status === 'payment_submitted'
                      ? language === 'bn' ? 'যাচাইয়ের অপেক্ষায়' : 'Under Review'
                      : language === 'bn' ? 'পেমেন্ট অপেক্ষমান' : 'Awaiting Payment'}
                  </span>
                </div>

                {paymentSubmittedSuccess || createdRegistration.payment_status === 'payment_submitted' || createdRegistration.payment_status === 'under_review' ? (
                  <div className="bg-white rounded-xl p-5 border border-emerald-200 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>
                        {language === 'bn'
                          ? 'পেমেন্টের তথ্য সফলভাবে জমা হয়েছে!'
                          : 'Payment confirmation details submitted successfully!'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {language === 'bn'
                        ? `আপনার পেমেন্ট বর্তমানে এডমিন কমিটির যাচাইয়ের অপেক্ষায় রয়েছে (স্ট্যাটাস: Payment Under Review)। TrxID যাচাই সম্পন্ন হওয়ার সাথে সাথে আপনার প্রবেশপত্র সক্রিয় হবে। আপনি টোকেন ভেরিফিকেশন পেজে গিয়ে যেকোনো সময় অবস্থা দেখতে পারবেন।`
                        : `Your payment is currently under review by our finance committee (Status: Payment Under Review). Once the TrxID is verified, your entry pass will be activated. You can track status anytime on the token verification page.`}
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 flex justify-between flex-wrap gap-2">
                      <span>Gateway: <strong>{selectedGateway.toUpperCase()}</strong></span>
                      <span>TrxID: <strong>{transactionId || createdRegistration.transaction_id || 'Submitted'}</strong></span>
                      <span>Sender: <strong>{senderNumber || createdRegistration.phone}</strong></span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitManualPayment} className="space-y-4">
                    {paymentError && (
                      <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{paymentError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Payment Method Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {language === 'bn' ? 'পেমেন্ট মাধ্যম *' : 'Payment Method *'}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedGateway('bkash')}
                            className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              selectedGateway === 'bkash'
                                ? 'border-pink-500 bg-pink-50 text-pink-900 shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>bKash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedGateway('nagad')}
                            className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              selectedGateway === 'nagad'
                                ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>Nagad</span>
                          </button>
                        </div>
                      </div>

                      {/* Sender Mobile Number */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {language === 'bn' ? 'প্রেরক মোবাইল নম্বর *' : 'Sender Mobile Number *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={senderNumber}
                          onChange={e => setSenderNumber(e.target.value)}
                          placeholder="e.g. 01XXXXXXXXX"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                        />
                      </div>

                      {/* Transaction ID */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {language === 'bn' ? 'ট্রানজেকশন আইডি (TrxID) *' : 'Transaction ID (TrxID) *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={transactionId}
                          onChange={e => setTransactionId(e.target.value.toUpperCase())}
                          placeholder="e.g. BK89A2B4 or 9G8F7K"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase text-slate-900 tracking-wider focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                        />
                      </div>

                      {/* Paid Amount */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          {language === 'bn' ? 'পরিশোধিত টাকার পরিমাণ' : 'Paid Amount'}
                        </label>
                        <input
                          type="text"
                          disabled
                          value={`৳${(createdRegistration.fee_amount || feeAmount).toLocaleString()} ${currency}`}
                          className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
                        />
                      </div>
                    </div>

                    {/* Optional Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {language === 'bn' ? 'মন্তব্য বা অতিরিক্ত তথ্য (ঐচ্ছিক)' : 'Additional Notes (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                        placeholder={language === 'bn' ? 'যেমন: ভাইয়ের নম্বর থেকে পাঠানো হয়েছে' : 'e.g. Sent from brother’s phone'}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={paymentSubmitting}
                      className="w-full py-3.5 px-6 bg-[#0f4d2a] hover:bg-[#135d34] active:bg-[#0a331c] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
                    >
                      {paymentSubmitting ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          <span>{language === 'bn' ? 'যাচাইয়ের জন্য পাঠানো হচ্ছে...' : 'Submitting Confirmation...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          <span>{language === 'bn' ? 'Confirm Payment (পেমেন্ট নিশ্চিতকরণ জমা দিন)' : 'Confirm Payment Submission'}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    if (onGoToVerify) {
                      onGoToVerify(createdRegistration.token_code);
                    } else {
                      window.location.search = `?token=${encodeURIComponent(createdRegistration.token_code || '')}`;
                    }
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>{language === 'bn' ? 'টোকেন স্ট্যাটাস ও ভেরিফিকেশন পেজে যান' : 'Check Token Status & Verify'}</span>
                </button>

                {onGoToPortal && (
                  <button
                    type="button"
                    onClick={onGoToPortal}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <span>{t('token.view_portal', 'Go to Member Portal')}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS (IF ALREADY VERIFIED) */}
      {step === 'success' && createdRegistration && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
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
    </div>
  );
};
