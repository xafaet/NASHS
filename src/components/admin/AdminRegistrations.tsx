import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  Eye,
  X,
  Save,
  AlertTriangle,
  QrCode,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface RegistrationItem {
  id: string;
  event_id?: string;
  full_name: string;
  dob?: string;
  gender?: string;
  blood_group?: string;
  phone: string;
  email?: string;
  passing_year: number;
  batch_id?: string;
  batch_name?: string;
  batch_name_bn?: string;
  address?: string;
  occupation?: string;
  photo_url?: string;
  fee_amount?: number;
  currency?: string;
  payment_status: 'paid' | 'pending' | 'failed' | 'refunded';
  payment_method?: string;
  token_code?: string;
  qr_code_svg?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  created_at?: string;
  updated_at?: string;
  notes?: string;
}

interface AdminRegistrationsProps {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
  onDataChange?: () => void;
  initialData?: RegistrationItem[];
}

export const AdminRegistrations: React.FC<AdminRegistrationsProps> = ({
  onNotify,
  getHeaders,
  onDataChange,
  initialData,
}) => {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>(() =>
    initialData && Array.isArray(initialData) ? initialData : []
  );
  const [isLoading, setIsLoading] = useState(() => !(initialData && initialData.length > 0));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const base = getHeaders ? getHeaders() : {};
    const token = typeof window !== 'undefined' ? localStorage.getItem('nash_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...base,
      ...extra,
    };
  };

  // Sync with initialData if parent updates it
  useEffect(() => {
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      setRegistrations(prev => (prev.length === 0 ? initialData : prev));
      setIsLoading(false);
    }
  }, [initialData]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<RegistrationItem | null>(null);
  const [deletingRegistration, setDeletingRegistration] = useState<RegistrationItem | null>(null);
  const [viewingRegistration, setViewingRegistration] = useState<RegistrationItem | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // Form State for Add
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    dob: '1995-01-01',
    gender: 'male',
    passing_year: '2008',
    blood_group: '',
    address: '',
    occupation: '',
    fee_amount: 1000,
    payment_status: 'paid' as 'paid' | 'pending',
    payment_method: 'offline_cash',
    checked_in: false,
    photo_url: '',
    notes: '',
  });

  const loadRegistrations = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/admin/registrations?limit=500', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.data || []);
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn('Registration fetch returned non-ok status:', res.status, err);
        onNotify?.(err.message || 'Failed to load registrations. Please re-authenticate.');
      }
    } catch (err) {
      console.error('Failed to load registrations:', err);
      onNotify?.('Error loading registrations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  // Handle Add Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.phone || !formData.passing_year) {
      onNotify?.('Please provide name, phone number, and passing year.');
      return;
    }

    try {
      const res = await apiFetch('/api/admin/registrations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          fee_amount: Number(formData.fee_amount) || 1000,
          passing_year: parseInt(formData.passing_year, 10),
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setRegistrations([created, ...registrations]);
        setIsAddModalOpen(false);
        onDataChange?.();
        setFormData({
          full_name: '',
          phone: '',
          email: '',
          dob: '1995-01-01',
          gender: 'male',
          passing_year: '2008',
          blood_group: '',
          address: '',
          occupation: '',
          fee_amount: 1000,
          payment_status: 'paid',
          payment_method: 'offline_cash',
          checked_in: false,
          photo_url: '',
          notes: '',
        });
        onNotify?.(`Registration for ${created.full_name} created successfully!`);
      } else {
        const err = await res.json();
        onNotify?.(err.message || 'Failed to create registration.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Network error while saving registration.');
    }
  };

  // Handle Edit Save
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration) return;

    try {
      const res = await apiFetch(`/api/admin/registrations/${editingRegistration.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingRegistration),
      });

      if (res.ok) {
        const updated = await res.json();
        setRegistrations(registrations.map(r => (r.id === updated.id ? updated : r)));
        setEditingRegistration(null);
        onDataChange?.();
        onNotify?.(`Registration for ${updated.full_name} updated successfully.`);
      } else {
        const err = await res.json();
        onNotify?.(err.message || 'Failed to update registration.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Network error while updating registration.');
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingRegistration) return;

    try {
      const res = await apiFetch(`/api/admin/registrations/${deletingRegistration.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        setRegistrations(registrations.filter(r => r.id !== deletingRegistration.id));
        onNotify?.(`Registration ${deletingRegistration.id} removed from database.`);
        setDeletingRegistration(null);
        onDataChange?.();
      } else {
        const err = await res.json();
        onNotify?.(err.message || 'Failed to delete registration.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Network error deleting registration.');
    }
  };

  // Quick Toggle Check-in
  const handleToggleCheckin = async (reg: RegistrationItem) => {
    const newStatus = !reg.checked_in;
    try {
      const res = await apiFetch(`/api/admin/registrations/${reg.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          checked_in: newStatus,
          checked_in_at: newStatus ? new Date().toISOString() : null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRegistrations(registrations.map(r => (r.id === reg.id ? updated : r)));
        onDataChange?.();
        onNotify?.(`${reg.full_name} check-in ${newStatus ? 'confirmed' : 'reverted'}.`);
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Failed to toggle check-in state.');
    }
  };

  // Quick Mark as Paid
  const handleMarkAsPaid = async (reg: RegistrationItem) => {
    try {
      const res = await apiFetch(`/api/admin/registrations/${reg.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          payment_status: 'paid',
          payment_method: 'manual_verification',
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setRegistrations(registrations.map(r => (r.id === reg.id ? updated : r)));
        onDataChange?.();
        onNotify?.(`Payment confirmed & token generated for ${reg.full_name}!`);
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Failed to update payment status.');
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (registrations.length === 0) {
      onNotify?.('No registrations available to export.');
      return;
    }

    const headers = [
      'Registration ID',
      'Full Name',
      'Phone',
      'Email',
      'Passing Year',
      'Batch',
      'Gender',
      'Blood Group',
      'Occupation',
      'Address',
      'Fee Amount',
      'Payment Status',
      'Payment Method',
      'Token Code',
      'Checked In',
      'Registered At',
    ];

    const rows = filteredRegistrations.map(r => [
      `"${r.id}"`,
      `"${r.full_name}"`,
      `"${r.phone}"`,
      `"${r.email || ''}"`,
      r.passing_year,
      `"${r.batch_name || ''}"`,
      `"${r.gender || ''}"`,
      `"${r.blood_group || ''}"`,
      `"${r.occupation || ''}"`,
      `"${(r.address || '').replace(/"/g, '""')}"`,
      r.fee_amount || 1000,
      `"${r.payment_status}"`,
      `"${r.payment_method || ''}"`,
      `"${r.token_code || ''}"`,
      r.checked_in ? 'Yes' : 'No',
      `"${r.created_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nash_85th_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify?.(`Exported ${filteredRegistrations.length} registrations to CSV.`);
  };

  // Bulk Import CSV
  const handleImportCsv = async () => {
    if (!importCsvText.trim()) {
      onNotify?.('Please paste CSV data to import.');
      return;
    }

    setImporting(true);
    try {
      const lines = importCsvText.trim().split('\n');
      if (lines.length < 2) {
        onNotify?.('CSV must contain a header row and at least one data row.');
        setImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
        if (currentLine.length < 2) continue;

        const rowObj: any = {};
        headers.forEach((header, index) => {
          rowObj[header] = currentLine[index] || '';
        });

        const fullName = rowObj.full_name || rowObj.name || rowObj['full name'] || currentLine[0];
        const phone = rowObj.phone || rowObj.mobile || rowObj['phone'] || currentLine[1];
        const passingYear = parseInt(rowObj.passing_year || rowObj.year || rowObj['passing year'] || currentLine[2], 10);

        if (fullName && phone && !isNaN(passingYear)) {
          rows.push({
            full_name: fullName,
            phone,
            passing_year: passingYear,
            email: rowObj.email || '',
            blood_group: rowObj.blood_group || rowObj['blood group'] || '',
            occupation: rowObj.occupation || '',
            address: rowObj.address || '',
            payment_status: rowObj.payment_status || 'paid',
          });
        }
      }

      if (rows.length === 0) {
        onNotify?.('Could not parse valid registration rows from the CSV text.');
        setImporting(false);
        return;
      }

      const res = await apiFetch('/api/admin/registrations/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rows, default_payment_status: 'paid' }),
      });

      if (res.ok) {
        const result = await res.json();
        onNotify?.(`Successfully imported ${result.imported} registrations (${result.skipped} skipped).`);
        setIsImportModalOpen(false);
        setImportCsvText('');
        loadRegistrations();
        onDataChange?.();
      } else {
        const err = await res.json();
        onNotify?.(err.message || 'Import failed.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Error parsing or importing CSV.');
    } finally {
      setImporting(false);
    }
  };

  // Filtered registrations
  const filteredRegistrations = registrations.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.full_name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.phone && r.phone.includes(q)) ||
      (r.token_code && r.token_code.toLowerCase().includes(q)) ||
      (r.passing_year && r.passing_year.toString().includes(q));

    const matchesStatus = statusFilter === 'all' || r.payment_status === statusFilter;
    const matchesBatch = batchFilter === 'all' || r.passing_year.toString() === batchFilter;

    return matchesSearch && matchesStatus && matchesBatch;
  });

  // Unique batches for filter dropdown
  const uniqueBatches = Array.from(new Set(registrations.map(r => r.passing_year)))
    .filter((y): y is number => typeof y === 'number' && !isNaN(y))
    .sort((a, b) => Number(b) - Number(a));

  // Statistics counters
  const totalCount = registrations.length;
  const paidCount = registrations.filter(r => r.payment_status === 'paid').length;
  const pendingCount = registrations.filter(r => r.payment_status === 'pending').length;
  const checkedInCount = registrations.filter(r => r.checked_in).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0f4d2a]" />
            <span>Alumni Registrations Management</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage, edit, verify, export, and delete registration records across all batches.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadRegistrations}
            title="Reload from database"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0f4d2a] hover:bg-[#135d34] text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Registration</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Registered</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{totalCount}</span>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">Paid & Verified</span>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">{paidCount}</span>
        </div>
        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">Pending Payments</span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{pendingCount}</span>
        </div>
        <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 shadow-xs">
          <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">Gate Checked-In</span>
          <span className="text-2xl font-black text-blue-900 mt-1 block">{checkedInCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, phone, reg ID, token..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Year:</span>
            <select
              value={batchFilter}
              onChange={e => setBatchFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="all">All Passing Years</option>
              {uniqueBatches.map(year => (
                <option key={year} value={year.toString()}>
                  Passing Year {year}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing {filteredRegistrations.length} of {totalCount}
          </div>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Alumnus Information</th>
                <th className="py-3 px-4">Year & Batch</th>
                <th className="py-3 px-4">Contact & Location</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Digital Pass</th>
                <th className="py-3 px-4">Gate Check-in</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading && registrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                      <p className="font-semibold text-sm">Loading dynamic registration records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm">No registrations match your criteria.</p>
                    <p className="text-xs mt-1">Try resetting filters or adding a new registration.</p>
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map(reg => {
                  const isPaid = reg.payment_status === 'paid';
                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/75 transition">
                      {/* Alumnus Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">
                            {reg.photo_url ? (
                              <img
                                src={reg.photo_url}
                                alt={reg.full_name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              reg.full_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{reg.full_name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{reg.id}</span>
                            {reg.blood_group && (
                              <span className="inline-block ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                {reg.blood_group}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Passing Year & Batch */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-900 block">
                          {reg.batch_name || `Year ${reg.passing_year}`}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Passing Year: <strong className="text-slate-700">{reg.passing_year}</strong>
                        </span>
                      </td>

                      {/* Contact & Location */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-slate-700 font-mono">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{reg.phone}</span>
                          </div>
                          {reg.email && (
                            <div className="flex items-center gap-1 text-slate-500 text-[11px] truncate max-w-[160px]">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{reg.email}</span>
                            </div>
                          )}
                          {reg.address && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[160px] block">
                              {reg.address}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {isPaid ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-amber-600" />}
                            <span>{reg.payment_status}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 block font-semibold">
                            {reg.fee_amount || 1000} {reg.currency || 'BDT'}
                          </span>
                        </div>
                      </td>

                      {/* Digital Pass Token */}
                      <td className="py-3.5 px-4">
                        {reg.token_code ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[11px] font-bold text-slate-900 block">
                              {reg.token_code}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                              <QrCode className="w-3 h-3" /> Active Pass
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unissued (Pending)</span>
                        )}
                      </td>

                      {/* Gate Check-In Button */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleCheckin(reg)}
                          title="Click to toggle check-in state"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            reg.checked_in
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {reg.checked_in ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-blue-200" />
                              <span>Checked In</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5 text-slate-400" />
                              <span>Not In</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => setViewingRegistration(reg)}
                            title="View Full Profile & Pass"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick Mark Paid if pending */}
                          {!isPaid && (
                            <button
                              onClick={() => handleMarkAsPaid(reg)}
                              title="Mark Paid & Issue Pass"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => setEditingRegistration({ ...reg })}
                            title="Edit Registration"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingRegistration(reg)}
                            title="Delete Registration"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODAL 1: ADD MANUAL REGISTRATION                           */}
      {/* ========================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>Add Alumni Registration</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Mohammad Harun"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Passing Year (SSC) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1942"
                    max="2035"
                    required
                    value={formData.passing_year}
                    onChange={e => setFormData({ ...formData, passing_year: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={formData.blood_group}
                    onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="">Unknown / None</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alumnus@example.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={e => setFormData({ ...formData, occupation: e.target.value })}
                    placeholder="e.g. Teacher, Engineer, Businessman"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Present Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Nanupur, Fatikchhari, Chattogram"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Fee Amount (BDT)
                  </label>
                  <input
                    type="number"
                    value={formData.fee_amount}
                    onChange={e => setFormData({ ...formData, fee_amount: parseInt(e.target.value, 10) || 1000 })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={formData.payment_status}
                    onChange={e => setFormData({ ...formData, payment_status: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="paid">Paid (Issue Digital Token)</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="offline_cash">Offline Cash (Booth)</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="admin_complimentary">Complimentary / Free</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="add-checked-in"
                  checked={formData.checked_in}
                  onChange={e => setFormData({ ...formData, checked_in: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="add-checked-in" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Mark as already checked in at the gate
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0f4d2a] hover:bg-[#135d34] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Save Registration to Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: EDIT REGISTRATION                                 */}
      {/* ========================================================== */}
      {editingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <span>Edit Registration: {editingRegistration.id}</span>
              </h3>
              <button
                onClick={() => setEditingRegistration(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRegistration.full_name}
                    onChange={e => setEditingRegistration({ ...editingRegistration, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Mobile Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingRegistration.phone}
                    onChange={e => setEditingRegistration({ ...editingRegistration, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Passing Year
                  </label>
                  <input
                    type="number"
                    min="1942"
                    max="2035"
                    required
                    value={editingRegistration.passing_year}
                    onChange={e =>
                      setEditingRegistration({
                        ...editingRegistration,
                        passing_year: parseInt(e.target.value, 10) || 2008,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Batch Name Override
                  </label>
                  <input
                    type="text"
                    value={editingRegistration.batch_name || ''}
                    onChange={e => setEditingRegistration({ ...editingRegistration, batch_name: e.target.value })}
                    placeholder="e.g. 65th Batch"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={editingRegistration.blood_group || ''}
                    onChange={e => setEditingRegistration({ ...editingRegistration, blood_group: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="">Unknown / None</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editingRegistration.email || ''}
                    onChange={e => setEditingRegistration({ ...editingRegistration, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={editingRegistration.occupation || ''}
                    onChange={e => setEditingRegistration({ ...editingRegistration, occupation: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Present Address
                </label>
                <input
                  type="text"
                  value={editingRegistration.address || ''}
                  onChange={e => setEditingRegistration({ ...editingRegistration, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Fee Amount ({editingRegistration.currency || 'BDT'})
                  </label>
                  <input
                    type="number"
                    value={editingRegistration.fee_amount || 1000}
                    onChange={e =>
                      setEditingRegistration({
                        ...editingRegistration,
                        fee_amount: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={editingRegistration.payment_status}
                    onChange={e =>
                      setEditingRegistration({
                        ...editingRegistration,
                        payment_status: e.target.value as any,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Digital Pass Token Code
                  </label>
                  <input
                    type="text"
                    value={editingRegistration.token_code || ''}
                    onChange={e => setEditingRegistration({ ...editingRegistration, token_code: e.target.value })}
                    placeholder="Auto-generated when paid"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-checked-in"
                  checked={!!editingRegistration.checked_in}
                  onChange={e => setEditingRegistration({ ...editingRegistration, checked_in: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="edit-checked-in" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Gate Checked-in status
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRegistration(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0f4d2a] hover:bg-[#135d34] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Update Registration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 3: DELETE CONFIRMATION                               */}
      {/* ========================================================== */}
      {deletingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Delete Alumni Registration?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete the registration for{' '}
                <strong className="text-slate-900">{deletingRegistration.full_name}</strong> ({deletingRegistration.id})?
                This will also purge any associated digital entry tokens and QR codes from the database.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingRegistration(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 4: VIEW FULL DETAILS & PASS                          */}
      {/* ========================================================== */}
      {viewingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-linear-to-r from-[#0f4d2a] to-[#156738] p-6 text-white text-center relative">
              <button
                onClick={() => setViewingRegistration(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 block">
                Official Digital Entry Pass
              </span>
              <h3 className="text-xl font-black mt-1">{viewingRegistration.full_name}</h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                {viewingRegistration.batch_name || `Passing Year ${viewingRegistration.passing_year}`}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* QR Code SVG if exists */}
              {viewingRegistration.qr_code_svg && (
                <div className="w-40 h-40 mx-auto p-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                  <div
                    className="w-full h-full"
                    dangerouslySetInnerHTML={{ __html: viewingRegistration.qr_code_svg }}
                  />
                </div>
              )}

              {viewingRegistration.token_code && (
                <div className="text-center">
                  <span className="text-[11px] text-slate-500 uppercase font-bold block">Token Verification Code</span>
                  <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg inline-block mt-0.5">
                    {viewingRegistration.token_code}
                  </span>
                </div>
              )}

              <div className="divide-y divide-slate-100 text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Registration ID:</span>
                  <span className="font-mono font-bold text-slate-900">{viewingRegistration.id}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Mobile Phone:</span>
                  <span className="font-mono font-bold text-slate-900">{viewingRegistration.phone}</span>
                </div>
                {viewingRegistration.email && (
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-semibold text-slate-900">{viewingRegistration.email}</span>
                  </div>
                )}
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Blood Group:</span>
                  <span className="font-bold text-red-600">{viewingRegistration.blood_group || 'Not specified'}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-bold uppercase text-emerald-800">{viewingRegistration.payment_status}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Gate Check-in:</span>
                  <span className="font-bold text-slate-900">
                    {viewingRegistration.checked_in ? 'Checked In' : 'Not Checked In'}
                  </span>
                </div>
                {viewingRegistration.address && (
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Address:</span>
                    <span className="font-medium text-slate-900 text-right max-w-[200px]">
                      {viewingRegistration.address}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingRegistration(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 5: BULK IMPORT CSV                                   */}
      {/* ========================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Bulk Import Registrations (CSV)</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Paste CSV text below with headers: <code>full_name, phone, passing_year, email, blood_group, occupation</code>.
            </p>

            <textarea
              rows={8}
              value={importCsvText}
              onChange={e => setImportCsvText(e.target.value)}
              placeholder="full_name,phone,passing_year,email,blood_group&#10;Mohammad Harun,01711223344,2008,harun@gmail.com,B+&#10;Kamal Hossain,01822334455,2010,kamal@example.com,A+"
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0f4d2a] hover:bg-[#135d34] text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{importing ? 'Importing...' : 'Start Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
