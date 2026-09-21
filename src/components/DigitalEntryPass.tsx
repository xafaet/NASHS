import React, { useRef, useState } from 'react';
import { Printer, Download, ShieldCheck, Calendar, MapPin, Award, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface DigitalEntryPassProps {
  tokenCode: string;
  fullName: string;
  batchName: string;
  batchNameBn?: string;
  passingYear: number;
  qrCodeSvg?: string;
  photoUrl?: string;
  bloodGroup?: string;
  occupation?: string;
  status?: string;
  checkedIn: boolean;
  checkedInAt?: string;
  eventDate?: string;
  venue?: string;
  venueBn?: string;
  onClose?: () => void;
}

export const DigitalEntryPass: React.FC<DigitalEntryPassProps> = ({
  tokenCode,
  fullName,
  batchName,
  batchNameBn,
  passingYear,
  qrCodeSvg,
  photoUrl,
  bloodGroup,
  occupation,
  status = 'active',
  checkedIn,
  checkedInAt,
  eventDate = '16 January 2027',
  venue = 'Nanupur Abu Sobhan High School Premises',
  venueBn = 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাঙ্গণ',
  onClose,
}) => {
  const { language, t } = useLanguage();
  const passRef = useRef<HTMLDivElement>(null);

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      setDownloadingPdf(true);
      const res = await fetch(`/api/tokens/${encodeURIComponent(tokenCode)}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `NASH-85-Pass-${tokenCode}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.warn('Direct PDF stream fetch failed, falling back to window open / text:', e);
    } finally {
      setDownloadingPdf(false);
    }

    // Direct link fallback
    const fallbackLink = document.createElement('a');
    fallbackLink.href = `/api/tokens/${encodeURIComponent(tokenCode)}/pdf`;
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener noreferrer';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Printable Area */}
      <div
        id="printable-pass"
        ref={passRef}
        className="w-full max-w-xl bg-gradient-to-b from-[#0f4d2a] via-[#135d34] to-[#0a331c] text-white rounded-2xl shadow-2xl overflow-hidden border-4 border-amber-400/80 relative"
      >
        {/* Watermark Seal Background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
          <Award className="w-96 h-96 text-white" />
        </div>

        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-6 py-3 flex items-center justify-between font-bold text-xs sm:text-sm tracking-wide shadow-md">
          <span className="flex items-center gap-1.5 font-extrabold uppercase">
            <Award className="w-4 h-4 text-emerald-950" />
            {t('token.entry_pass', 'Official Digital Entry Pass')}
          </span>
          <span className="bg-emerald-950 text-amber-300 px-2.5 py-0.5 rounded-full text-xs font-mono">
            85 YEARS • 1942–2027
          </span>
        </div>

        {/* Pass Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* School & Event Identity */}
          <div className="text-center space-y-1.5 border-b border-white/20 pb-5">
            <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm">
              {language === 'bn'
                ? 'নানুপুর আবু সোবহান উচ্চ বিদ্যালয় প্রাক্তন শিক্ষার্থী পরিষদ'
                : 'Nanupur Abu Sobhan High School Alumni Association'}
            </h3>
            <div className="inline-block bg-white/10 backdrop-blur-sm px-4 py-1 rounded-full border border-amber-400/40">
              <p className="text-amber-300 font-semibold text-sm sm:text-base">
                {language === 'bn'
                  ? '৮৫ বছর পূর্তি উৎসব ও প্রাক্তন শিক্ষার্থী পুনর্মিলনী'
                  : '85th Anniversary Celebration & Alumni Reunion'}
              </p>
            </div>
          </div>

          {/* Attendee Info & QR Block */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center bg-black/25 rounded-xl p-5 border border-white/10 backdrop-blur-sm">
            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-lg border-2 border-amber-400">
              {qrCodeSvg ? (
                <div
                  className="w-36 h-36 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              ) : (
                <div className="w-36 h-36 bg-slate-100 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                  <ShieldCheck className="w-10 h-10 text-emerald-700 mb-1" />
                  <span>Verified QR</span>
                </div>
              )}
              <span className="text-[10px] text-slate-800 font-mono font-bold mt-1 tracking-wider">
                {tokenCode}
              </span>
            </div>

            {/* Attendee Details */}
            <div className="sm:col-span-2 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs uppercase tracking-wider text-emerald-200 block font-medium">
                    {t('form.full_name', 'Alumni Name')}
                  </span>
                  <h4 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    {fullName}
                  </h4>
                  {occupation && (
                    <span className="text-xs text-emerald-300 block mt-0.5">
                      {occupation}
                    </span>
                  )}
                </div>
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={fullName}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-amber-400 shadow-md shrink-0 bg-slate-800"
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/10">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">
                    {language === 'bn' ? 'নির্ধারিত ব্যাচ' : 'Alumni Batch'}
                  </span>
                  <span className="inline-block bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded text-sm mt-0.5 shadow-sm">
                    {language === 'bn' && batchNameBn ? batchNameBn : batchName}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">
                    {language === 'bn' ? 'পাসের বছর' : 'Passing Year'}
                  </span>
                  <span className="text-base font-semibold text-white">
                    {passingYear}
                  </span>
                  {bloodGroup && (
                    <span className="ml-2 text-xs font-bold text-red-400 bg-red-950/60 border border-red-500/40 px-1.5 py-0.5 rounded">
                      {bloodGroup}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">
                  {t('token.number', 'Token Code')}
                </span>
                <span className="font-mono text-base font-extrabold text-amber-300 tracking-wider">
                  {tokenCode}
                </span>
              </div>
            </div>
          </div>

          {/* Event Details Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-emerald-200 block text-[10px] uppercase font-semibold">
                  {language === 'bn' ? 'অনুষ্ঠানের তারিখ' : 'Date & Time'}
                </span>
                <span className="text-white font-medium">16 January 2027 (Saturday)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-emerald-200 block text-[10px] uppercase font-semibold">
                  {language === 'bn' ? 'স্থান' : 'Venue'}
                </span>
                <span className="text-white font-medium truncate block max-w-[200px]">
                  {language === 'bn' ? venueBn : venue}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="flex items-center justify-between border-t border-white/15 pt-4 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">{t('token.valid', 'Payment Verified & Pass Active')}</span>
            </div>
            {checkedIn ? (
              <span className="bg-red-600 text-white font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                {language === 'bn' ? 'প্রবেশ সম্পন্ন' : 'Checked In'}
              </span>
            ) : (
              <span className="bg-emerald-800 text-emerald-100 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-emerald-600">
                {language === 'bn' ? 'প্রবেশের জন্য প্রস্তুত' : 'Ready for Entry'}
              </span>
            )}
          </div>
        </div>

        {/* Security Barcode Simulation Strip */}
        <div className="bg-slate-950/80 px-6 py-2 border-t border-amber-400/30 flex items-center justify-between text-[11px] text-slate-400">
          <span>SECURE ID: {tokenCode}</span>
          <span>AUTHORIZED BY NASH ALUMNI ASSOCIATION</span>
        </div>
      </div>

      {/* Action Buttons (Excluded from Print) */}
      <div className="no-print mt-6 flex flex-wrap gap-3 justify-center">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-[#0f4d2a] hover:bg-[#135d34] text-white shadow-lg shadow-emerald-950/20 transition cursor-pointer"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          {t('token.print', 'Print Entry Pass')}
        </button>

        <button
          onClick={handleDownload}
          disabled={downloadingPdf}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          {downloadingPdf ? (
            <Loader2 className="w-4 h-4 text-slate-950 animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-slate-950" />
          )}
          <span>{downloadingPdf ? (language === 'bn' ? 'ডাউনলোড হচ্ছে...' : 'Downloading...') : (language === 'bn' ? 'অফিসিয়াল PDF পাস' : 'Download Official PDF')}</span>
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
};
