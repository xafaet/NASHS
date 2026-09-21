import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Ticket,
  GraduationCap,
  FileText,
  Bell,
  Newspaper,
  Image as ImageIcon,
  School,
  Settings,
  ShieldAlert,
  Search,
  Download,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Save,
  RotateCcw,
  LogOut,
  ExternalLink,
  Award,
  Globe,
  Layers,
  HelpCircle,
  Key,
  Upload,
  Eye,
  MapPin,
  Calendar,
  Server,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Registration,
  Batch,
  CommitteeMember,
  Notice,
  NewsPost,
  MediaItem,
  SchoolInfo,
  AssociationInfo,
  SiteSettings,
  AuditLog,
  DashboardStats
} from '../types';
import { AdminGlobalSettings } from './admin/AdminGlobalSettings';
import { AdminAppearance } from './admin/AdminAppearance';
import { AdminPages } from './admin/AdminPages';
import { AdminFaq } from './admin/AdminFaq';
import { AdminGateways } from './admin/AdminGateways';
import { AdminOfflineCenters } from './admin/AdminOfflineCenters';
import { AdminRegistrations } from './admin/AdminRegistrations';
import { AdminRbac } from './admin/AdminRbac';
import { AdminUsers } from './admin/AdminUsers';
import { AdminCommittee } from './admin/AdminCommittee';
import { AdminSchool } from './admin/AdminSchool';
import { AdminSchedule } from './admin/AdminSchedule';
import { AdminRegistrationForm } from './admin/AdminRegistrationForm';
import { AdminDatabase } from './admin/AdminDatabase';
import { AdminGateScanner } from './admin/AdminGateScanner';
import { AdminNews } from './admin/AdminNews';
import { apiFetch } from '../utils/api';

type AdminTab =
  | 'dashboard'
  | 'registrations'
  | 'registration_fields'
  | 'schedule'
  | 'payments'
  | 'tokens'
  | 'checkin'
  | 'batches'
  | 'offline_centers'
  | 'gateways'
  | 'pages'
  | 'faq'
  | 'appearance'
  | 'global_settings'
  | 'users'
  | 'rbac'
  | 'notices'
  | 'news'
  | 'media'
  | 'school'
  | 'committee'
  | 'database'
  | 'settings'
  | 'audit';

export const AdminPortal: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // State Containers
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regSearch, setRegSearch] = useState('');
  const [regBatchFilter, setRegBatchFilter] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('');

  const [payments, setPayments] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [news, setNews] = useState<NewsPost[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Gate Check-in Simulator state
  const [checkInCode, setCheckInCode] = useState('');
  const [checkInResult, setCheckInResult] = useState<any>(null);

  // Bulk import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Photo viewer modal state
  const [viewingPhoto, setViewingPhoto] = useState<{ name: string; url: string } | null>(null);

  // Status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getHeaders = () => {
    const token = localStorage.getItem('nash_token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  };

  // Load Dashboard Data
  const loadDashboard = async () => {
    try {
      const res = await apiFetch('/api/admin/dashboard', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Dashboard load paused:', err);
    }
  };

  // Load Registrations
  const loadRegistrations = async () => {
    try {
      const res = await apiFetch('/api/admin/registrations', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.data || []);
      }
    } catch (err) {
      console.warn('Registrations load paused:', err);
    }
  };

  // Load Settings
  const loadSettings = async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn('Settings load paused:', err);
    }
  };

  // Load Batches
  const loadBatches = async () => {
    try {
      const res = await apiFetch('/api/batches');
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch (err) {
      console.warn('Batches load paused:', err);
    }
  };

  // Load Notices
  const loadNotices = async () => {
    try {
      const res = await apiFetch('/api/notices');
      if (res.ok) {
        const data = await res.json();
        setNotices(data);
      }
    } catch (err) {
      console.warn('Notices load paused:', err);
    }
  };

  // Load School Info
  const loadSchoolInfo = async () => {
    try {
      const res = await apiFetch('/api/school-info');
      if (res.ok) {
        const data = await res.json();
        setSchoolInfo(data);
      }
    } catch (err) {
      console.warn('School info load paused:', err);
    }
  };

  // Load Committee
  const loadCommittee = async () => {
    try {
      const res = await apiFetch('/api/committee');
      if (res.ok) {
        const data = await res.json();
        setCommittee(data);
      }
    } catch (err) {
      console.warn('Committee load paused:', err);
    }
  };

  // Load Media
  const loadMedia = async () => {
    try {
      const res = await apiFetch('/api/admin/media', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMedia(data);
      }
    } catch (err) {
      console.warn('Media load paused:', err);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      const res = await apiFetch('/api/admin/audit-logs', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.warn('Audit logs load paused:', err);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadRegistrations();
    loadSettings();
    loadBatches();
    loadNotices();
    loadSchoolInfo();
    loadCommittee();
    loadMedia();
    loadAuditLogs();
  }, []);

  // Handle Settings Save (e.g. changing fee from BDT 1,000 to BDT 1,200)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast('Settings saved successfully and audit log updated!');
        loadAuditLogs();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // Handle Event Gate Check-in
  const handleGateCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInCode.trim()) return;

    try {
      const res = await fetch('/api/tokens/check-in', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          token_code: checkInCode.trim(),
          operator_name: user?.name || 'Gate Officer'
        })
      });
      const data = await res.json();
      setCheckInResult(data);
      if (data.success) {
        showToast('Check-in confirmed successfully!');
        loadDashboard();
        loadRegistrations();
      }
    } catch (err) {
      console.error('Check in failed:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Registration ID', 'Name', 'Phone', 'Passing Year', 'Batch', 'Fee', 'Payment Status', 'Token Code', 'Checked In'];
    const rows = registrations.map(r => [
      r.id,
      `"${r.full_name}"`,
      r.phone,
      r.passing_year,
      `"${r.batch_name}"`,
      r.fee_amount,
      r.payment_status,
      r.token_code || '',
      r.checked_in ? 'YES' : 'NO'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nash_85_registrations_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Import Handler
  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      let items: any[] = [];
      const trimmed = importText.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const firstLine = lines[0].toLowerCase();
          const hasHeader = firstLine.includes('name') || firstLine.includes('phone') || firstLine.includes('year');
          const dataLines = hasHeader ? lines.slice(1) : lines;

          items = dataLines.map(line => {
            const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
            return {
              full_name: parts[0] || 'Alumnus',
              phone: parts[1] || '',
              passing_year: parseInt(parts[2], 10) || 2000,
              blood_group: parts[3] || '',
              profession: parts[4] || '',
              payment_status: (parts[5] || 'paid').toLowerCase()
            };
          });
        }
      }

      if (items.length === 0) {
        throw new Error('No valid registration records found in input.');
      }

      const res = await fetch('/api/admin/registrations/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ items }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportResult(data);
      showToast(`Successfully processed: ${data.imported_count} imported, ${data.updated_count} updated!`);
      loadRegistrations();
      loadDashboard();
    } catch (err: any) {
      showToast(err.message || 'Import error');
    } finally {
      setImportLoading(false);
    }
  };

  // Filtered registrations
  const filteredRegs = registrations.filter(r => {
    const q = (regSearch || '').toLowerCase();
    const matchSearch =
      !q ||
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q) ||
      (r.token_code && (r.token_code || '').toLowerCase().includes(q)) ||
      (r.phone && r.phone.includes(regSearch));

    const matchBatch = !regBatchFilter || r.batch_name === regBatchFilter || (r.passing_year && r.passing_year.toString() === regBatchFilter);
    const matchStatus = !regStatusFilter || r.payment_status === regStatusFilter;

    return matchSearch && matchBatch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* WordPress-style Top Admin Bar */}
      <header className="bg-slate-900 text-slate-200 px-4 py-2.5 flex items-center justify-between text-xs border-b border-slate-800 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <School className="w-4 h-4 text-emerald-400" />
            <span>NASH 85th Admin</span>
          </div>
          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'ওয়েবসাইটে ফিরে যান' : 'View Public Site'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-emerald-400 font-medium">
            {user?.name} ({user?.role})
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-slate-400 hover:text-red-400 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Admin Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* WordPress-style Left Sidebar */}
        <aside className="w-64 bg-slate-800 text-slate-300 flex flex-col shrink-0 border-r border-slate-700">
          <div className="p-4 border-b border-slate-700/80">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">
              Management Portal
            </span>
            <span className="text-sm font-semibold text-white">85th Anniversary CMS</span>
          </div>

          <nav className="p-3 space-y-1 overflow-y-auto flex-1 text-sm">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-amber-400" />
              <span>Dashboard</span>
            </button>

            <div className="pt-2 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              CMS & Content
            </div>

            <button
              onClick={() => setActiveTab('pages')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'pages' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>CMS Pages (Builder)</span>
            </button>

            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'schedule' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Program Schedule (CMS)</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'appearance' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Appearance & Menus</span>
            </button>

            <button
              onClick={() => setActiveTab('global_settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'global_settings' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Global Site Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('faq')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'faq' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>FAQ Manager</span>
            </button>

            <button
              onClick={() => setActiveTab('school')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'school' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <School className="w-4 h-4 text-emerald-400" />
              <span>School Info</span>
            </button>

            <button
              onClick={() => setActiveTab('committee')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'committee' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Committee</span>
            </button>

            <button
              onClick={() => setActiveTab('notices')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'notices' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Notices</span>
            </button>

            <button
              onClick={() => setActiveTab('news')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'news' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Newspaper className="w-4 h-4 text-amber-400" />
              <span>News & Updates</span>
            </button>

            <button
              onClick={() => setActiveTab('media')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'media' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Media Library</span>
            </button>

            <div className="pt-3 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Anniversary Operations
            </div>

            <button
              onClick={() => setActiveTab('registrations')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'registrations' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Registrations</span>
              </div>
              <span className="text-xs bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                {registrations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('registration_fields')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'registration_fields' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Registration Form Builder</span>
            </button>

            <button
              onClick={() => setActiveTab('checkin')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'checkin' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Gate Check-In</span>
            </button>

            <button
              onClick={() => setActiveTab('offline_centers')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'offline_centers' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Offline Centers</span>
            </button>

            <button
              onClick={() => setActiveTab('gateways')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'gateways' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>Payment Gateways</span>
            </button>

            <div className="pt-3 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Users & Administration
            </div>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'users' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Users & Profiles</span>
            </button>

            <button
              onClick={() => setActiveTab('rbac')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'rbac' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Roles & Permissions (RBAC)</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'database' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Database & Portability</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'settings' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4 text-emerald-400" />
              <span>Fee & Registration Config</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'audit' ? 'bg-[#0f4d2a] text-white shadow' : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>Audit Logs</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="mb-6 p-4 bg-emerald-800 text-white rounded-xl shadow-lg flex items-center justify-between animate-in fade-in duration-200">
              <span className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-300" />
                {toastMessage}
              </span>
              <button
                onClick={() => setToastMessage(null)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && stats && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  85th Anniversary Overview
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Live real-time statistics calculated directly from the database.
                </p>
              </div>

              {/* Key Metrics Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Registrations */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Registrations
                  </span>
                  <div className="my-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                      {stats.total_registrations.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Target Capacity: 5,000
                  </span>
                </div>

                {/* Paid Registrations */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Paid & Confirmed
                  </span>
                  <div className="my-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#0f4d2a]">
                      {stats.paid_registrations.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Tokens Issued
                  </span>
                </div>

                {/* Total Revenue */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Total Revenue
                  </span>
                  <div className="my-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-amber-600">
                      ৳{stats.total_revenue.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Current Fee: ৳{settings?.registration_fee || 1000} BDT
                  </span>
                </div>

                {/* Checked In */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Checked In at Gate
                  </span>
                  <div className="my-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                      {stats.checked_in_count}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Event Day: 16 Jan 2027
                  </span>
                </div>
              </div>

              {/* Batch Distribution & Recent Registrations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Batch Distribution */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-700" />
                    Top Active Batches
                  </h3>
                  <div className="space-y-3">
                    {stats.batch_distribution.length > 0 ? (
                      stats.batch_distribution.map(b => (
                        <div key={b.batch} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-800">{b.batch}</span>
                            <span className="text-emerald-800 font-bold">
                              {b.paid} Paid ({b.count} Total)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-[#0f4d2a] h-2.5 rounded-full"
                              style={{ width: `${Math.min(100, (b.paid / Math.max(1, stats.paid_registrations)) * 100 * 3)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No batch data available yet.</p>
                    )}
                  </div>
                </div>

                {/* Recent Registrations Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-700" />
                      Recent Registrations
                    </h3>
                    <button
                      onClick={() => setActiveTab('registrations')}
                      className="text-xs text-emerald-700 font-bold hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {stats.recent_registrations.slice(0, 6).map(r => (
                      <div key={r.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 block">{r.full_name}</span>
                          <span className="text-slate-500 font-mono text-[11px]">{r.id} • {r.batch_name}</span>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {r.payment_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTRATIONS MANAGEMENT */}
          {activeTab === 'registrations' && (
            <AdminRegistrations
              onNotify={showToast}
              getHeaders={getHeaders}
              initialData={registrations as any}
              onDataChange={() => {
                loadRegistrations();
                loadDashboard();
              }}
            />
          )}

          {/* TAB 3: GATE CHECK-IN SCANNER */}
          {activeTab === 'checkin' && (
            <AdminGateScanner
              onNotify={showToast}
              getHeaders={getHeaders}
            />
          )}

          {/* TAB 4: SETTINGS & REGISTRATION FEE */}
          {activeTab === 'settings' && settings && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Platform Settings & Configuration
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Manage registration fee, event dates, currency, and payment gateway simulation mode.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">
                    Event & Registration Fee Management
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Registration Fee (BDT) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={settings.registration_fee}
                        onChange={e => setSettings({ ...settings, registration_fee: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Changing this fee (e.g. 1000 → 1200) instantly reflects across the entire website and database.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={settings.currency}
                        onChange={e => setSettings({ ...settings, currency: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Registration Status
                      </label>
                      <select
                        value={settings.registration_open ? 'open' : 'closed'}
                        onChange={e => setSettings({ ...settings, registration_open: e.target.value === 'open' })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      >
                        <option value="open">Open (Accepting Registrations)</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Registration Deadline
                      </label>
                      <input
                        type="date"
                        value={settings.registration_deadline}
                        onChange={e => setSettings({ ...settings, registration_deadline: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                      Payment Gateway Simulator Mode (Sandbox)
                    </label>
                    <select
                      value={settings.payment_test_mode ? 'true' : 'false'}
                      onChange={e => setSettings({ ...settings, payment_test_mode: e.target.value === 'true' })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      <option value="true">Sandbox Simulator Active (Instant mock payments)</option>
                      <option value="false">Live Production Gateway</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl font-bold transition cursor-pointer shadow-md"
                  >
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>Save Settings to Database</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  System Audit Logs
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Immutable record of administrative operations, fee changes, and critical security actions.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Admin / User</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Entity</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {log.user_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-800 font-mono px-2 py-0.5 rounded font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">{log.entity}</td>
                        <td className="px-4 py-3 text-slate-800">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: NOTICES */}
          {activeTab === 'notices' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Notices Management (CMS)
                  </h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Publish official announcements and bilingual notices.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {notices.map(notice => (
                  <div key={notice.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{notice.title_en}</h4>
                        <p className="text-slate-600 text-sm">{notice.title_bn}</p>
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                        {notice.publish_date}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{notice.content_en}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: BATCHES */}
          {activeTab === 'batches' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Batch Directory & Formula
                </h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  View and manage all alumni batches from SSC 1942 to 2026.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Batch Name (EN)</th>
                      <th className="px-4 py-3">ব্যাচের নাম (বাংলা)</th>
                      <th className="px-4 py-3">Passing Year</th>
                      <th className="px-4 py-3">Batch Number</th>
                      <th className="px-4 py-3">Paid Registrations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {batches.slice(0, 25).map(b => (
                      <tr key={b.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-bold text-slate-900">{b.name_en}</td>
                        <td className="px-4 py-3 font-semibold">{b.name_bn}</td>
                        <td className="px-4 py-3 font-mono">{b.passing_year}</td>
                        <td className="px-4 py-3 font-mono">No. {b.batch_number}</td>
                        <td className="px-4 py-3 font-bold text-[#0f4d2a]">{b.registration_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: SCHOOL & COMMITTEE */}
          {activeTab === 'school' && (
            <AdminSchool showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'committee' && (
            <AdminCommittee showToast={showToast} getHeaders={getHeaders} />
          )}

          {/* TAB 9: MEDIA LIBRARY */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    WordPress-Style Media Library
                  </h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Manage images, event banners, and promotional media.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {media.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm group">
                    <div className="h-32 bg-slate-100 overflow-hidden">
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                    <div className="p-2.5 text-xs">
                      <span className="font-semibold text-slate-800 truncate block">{item.name}</span>
                      <span className="text-slate-400 text-[10px]">{item.size}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CMS & APPEARANCE MODULES */}
          {activeTab === 'global_settings' && (
            <AdminGlobalSettings showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'appearance' && (
            <AdminAppearance showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'pages' && (
            <AdminPages showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'news' && (
            <AdminNews />
          )}

          {activeTab === 'faq' && (
            <AdminFaq showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'gateways' && (
            <AdminGateways showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'offline_centers' && (
            <AdminOfflineCenters showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'rbac' && (
            <AdminRbac showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'users' && (
            <AdminUsers showToast={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'schedule' && (
            <AdminSchedule onNotify={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'registration_fields' && (
            <AdminRegistrationForm onNotify={showToast} getHeaders={getHeaders} />
          )}

          {activeTab === 'database' && (
            <AdminDatabase onNotify={showToast} getHeaders={getHeaders} />
          )}
        </main>
      </div>

      {/* PHOTO VIEWER MODAL */}
      {viewingPhoto && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">{viewingPhoto.name}</h4>
              <button
                onClick={() => setViewingPhoto(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-100 max-h-80 flex items-center justify-center border border-slate-200">
              <img src={viewingPhoto.url} alt={viewingPhoto.name} className="w-full h-full object-contain" />
            </div>
            <button
              onClick={() => setViewingPhoto(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-base">Bulk Import Alumni Registrations</h3>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste CSV records (one per line) or a JSON array of alumni. The system will automatically compute batches, assign IDs, and issue digital passes.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600">
              <strong>CSV format:</strong> Full Name, Phone, Passing Year, Blood Group, Profession, Status
              <br />
              <strong>Example:</strong>
              <br />
              Dr. Anisur Rahman, 01711000000, 1994, B+, Physician, paid
              <br />
              Kamrul Hasan, 01819000000, 2005, O+, Engineer, paid
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Data Content
              </label>
              <textarea
                rows={6}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Paste CSV rows or JSON data here..."
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {importResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                <p className="font-bold">{importResult.message}</p>
                <p>Imported: {importResult.imported_count} • Updated: {importResult.updated_count}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importLoading || !importText.trim()}
                onClick={handleBulkImport}
                className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {importLoading ? 'Processing...' : 'Start Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
