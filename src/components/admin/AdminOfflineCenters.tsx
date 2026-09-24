import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Navigation,
  Save,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  User,
  RotateCcw,
  AlertTriangle,
  FileText,
  Info,
} from 'lucide-react';
import { OfflineRegistrationCenter } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminOfflineCenters: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [centers, setCenters] = useState<OfflineRegistrationCenter[]>([]);
  const [trashedCenters, setTrashedCenters] = useState<OfflineRegistrationCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<OfflineRegistrationCenter | null>(null);
  const [trashConfirmId, setTrashConfirmId] = useState<string | null>(null);
  const [forceDeleteConfirmId, setForceDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/offline-centers', { headers: getHeaders() });
      if (res.ok) {
        const data: OfflineRegistrationCenter[] = await res.json();
        const active = (data || []).filter(c => !c.is_trashed);
        const trashed = (data || []).filter(c => c.is_trashed);
        setCenters(active.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
        setTrashedCenters(trashed);
      }
    } catch (err) {
      console.warn('Failed to load offline booths:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    const nextOrder = centers.length > 0 ? Math.max(...centers.map(c => c.order_index || 0)) + 1 : 1;
    setEditingCenter({
      id: '',
      name_en: '',
      name_bn: '',
      address_en: '',
      address_bn: '',
      phone: '',
      contact_person: '',
      contact_person_bn: '',
      timings: 'Daily 10:00 AM – 6:00 PM',
      timings_bn: 'প্রতিদিন সকাল ১০:০০ - সন্ধ্যা ৬:০০',
      description_en: '',
      description_bn: '',
      map_url: '',
      order_index: nextOrder,
      is_active: true,
      is_trashed: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (center: OfflineRegistrationCenter) => {
    setEditingCenter({ ...center });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCenter) return;

    if (!editingCenter.name_en.trim() && !editingCenter.name_bn.trim()) {
      showToast('Please provide a booth name in English or Bengali.');
      return;
    }
    if (!editingCenter.phone.trim()) {
      showToast('Please provide a contact phone number.');
      return;
    }

    try {
      const isNew = !editingCenter.id;
      const url = isNew ? '/api/admin/offline-centers' : `/api/admin/offline-centers/${editingCenter.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(editingCenter),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save booth');
      }

      showToast(isNew ? 'New registration booth created in database!' : 'Registration booth updated successfully!');
      setModalOpen(false);
      setEditingCenter(null);
      fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error saving booth');
    }
  };

  const handleMoveToTrash = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/offline-centers/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to trash booth');
      showToast('Registration booth moved to trash.');
      setTrashConfirmId(null);
      fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error trashing booth');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/offline-centers/${id}/restore`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to restore booth');
      showToast('Registration booth restored successfully!');
      fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error restoring booth');
    }
  };

  const handleForceDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/offline-centers/${id}/force`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to permanently delete booth');
      showToast('Registration booth permanently deleted from database.');
      setForceDeleteConfirmId(null);
      fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error deleting booth');
    }
  };

  const handleToggleActive = async (center: OfflineRegistrationCenter) => {
    try {
      const updated = { ...center, is_active: !center.is_active };
      const res = await fetch(`/api/admin/offline-centers/${center.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast(`Booth "${center.name_en || center.name_bn}" is now ${updated.is_active ? 'ENABLED' : 'DISABLED'}.`);
      setCenters(centers.map(c => (c.id === center.id ? updated : c)));
    } catch (err: any) {
      showToast(err.message || 'Error updating status');
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= centers.length) return;

    const list = [...centers];
    const [moved] = list.splice(index, 1);
    list.splice(newIndex, 0, moved);

    // Reassign order_index
    const updated = list.map((item, idx) => ({ ...item, order_index: idx + 1 }));
    setCenters(updated);

    try {
      const ids = updated.map(c => c.id);
      await fetch('/api/admin/offline-centers/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ ids }),
      });
      showToast('Registration booths order updated and saved.');
    } catch (err) {
      showToast('Failed to sync display order.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-700" />
            Authorized Registration Booths (100% CMS Driven)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage physical booths, location details, coordinator contacts, and display order. Fully backed by the database.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Registration Booth</span>
        </button>
      </div>

      {/* Tabs: Active vs Trashed */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-t-2xl gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'active'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Active Booths</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800">
            {centers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trash')}
          className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'trash'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Trash / Deleted</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-200 text-slate-700">
            {trashedCenters.length}
          </span>
        </button>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-b-2xl rounded-tr-none shadow-xs border border-t-0 border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading registration booths from database...</div>
        ) : activeTab === 'active' ? (
          centers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">No active registration booths found.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Add physical registration booths so alumni can easily locate offline help desks to submit registration forms and fees.
              </p>
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2 bg-emerald-800 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
              >
                Add First Booth
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {centers.map((center, index) => (
                <div
                  key={center.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-slate-50/70 ${
                    !center.is_active ? 'opacity-65 bg-slate-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    {/* Order controls */}
                    <div className="flex flex-col gap-1 pt-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleReorder(index, 'up')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="Move Up in Display Order"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === centers.length - 1}
                        onClick={() => handleReorder(index, 'down')}
                        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="Move Down in Display Order"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Pin Icon */}
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 mt-0.5">
                      <MapPin className="w-5 h-5" />
                    </div>

                    {/* Booth Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {center.name_en || center.name_bn}
                        </h4>
                        {center.name_bn && center.name_en && (
                          <>
                            <span className="text-slate-300 text-xs">/</span>
                            <span className="text-xs text-slate-600 font-medium">{center.name_bn}</span>
                          </>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            center.is_active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {center.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          Order #{center.order_index}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {center.address_en || center.address_bn}
                        {center.address_bn && center.address_en && ` • ${center.address_bn}`}
                      </p>

                      {(center.description_en || center.description_bn) && (
                        <p className="text-xs text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                          {center.description_en || center.description_bn}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-emerald-700" />
                          <a href={`tel:${center.phone}`} className="hover:underline text-slate-700 font-bold">
                            {center.phone}
                          </a>
                        </span>

                        {(center.contact_person || center.contact_person_bn) && (
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {center.contact_person}
                              {center.contact_person_bn && ` (${center.contact_person_bn})`}
                            </span>
                          </span>
                        )}

                        {center.timings && (
                          <span className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{center.timings}</span>
                          </span>
                        )}

                        {center.map_url && (
                          <a
                            href={center.map_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Directions</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleToggleActive(center)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        center.is_active
                          ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {center.is_active ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(center)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setTrashConfirmId(center.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Move Booth to Trash"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // TRASH TAB
          trashedCenters.length === 0 ? (
            <div className="p-12 text-center space-y-2 text-slate-500">
              <Trash2 className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold">Trash is empty.</p>
              <p className="text-xs text-slate-400">Deleted booths appear here and can be restored at any time.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {trashedCenters.map(center => (
                <div
                  key={center.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-red-50/20"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{center.name_en || center.name_bn}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                        Trashed
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{center.address_en || center.address_bn}</p>
                    <p className="text-[11px] text-slate-400">Phone: {center.phone}</p>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleRestore(center.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore Booth</span>
                    </button>

                    <button
                      onClick={() => setForceDeleteConfirmId(center.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Forever</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* CREATE / EDIT BOOTH MODAL */}
      {modalOpen && editingCenter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-700" />
                <span>{editingCenter.id ? 'Edit Registration Booth' : 'Add New Authorized Registration Booth'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingCenter(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Booth Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Booth Name (English) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCenter.name_en}
                    onChange={e => setEditingCenter({ ...editingCenter, name_en: e.target.value })}
                    placeholder="e.g. School Secretariat / Headmaster Office"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Booth Name (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingCenter.name_bn}
                    onChange={e => setEditingCenter({ ...editingCenter, name_bn: e.target.value })}
                    placeholder="যেমন: বিদ্যালয় সচিবালয় / প্রধান শিক্ষক দপ্তর"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Physical Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Address / Location (English) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editingCenter.address_en}
                    onChange={e => setEditingCenter({ ...editingCenter, address_en: e.target.value })}
                    placeholder="Physical address, room number, or landmark"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Address / Location (Bengali)
                  </label>
                  <textarea
                    rows={2}
                    value={editingCenter.address_bn}
                    onChange={e => setEditingCenter({ ...editingCenter, address_bn: e.target.value })}
                    placeholder="ঠিকানা বা অবস্থান (বাংলায়)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Contact Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Contact Person Name (English)
                  </label>
                  <input
                    type="text"
                    value={editingCenter.contact_person || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, contact_person: e.target.value })}
                    placeholder="e.g. Master Rafiqul Islam"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Contact Person Name (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingCenter.contact_person_bn || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, contact_person_bn: e.target.value })}
                    placeholder="যেমন: মাষ্টার রফিকুল ইসলাম"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone & Timings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Contact Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingCenter.phone}
                    onChange={e => setEditingCenter({ ...editingCenter, phone: e.target.value })}
                    placeholder="+880 1819-123456"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Directly clickable on website for instant calls.
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Opening Hours / Timings
                  </label>
                  <input
                    type="text"
                    value={editingCenter.timings || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, timings: e.target.value })}
                    placeholder="e.g. Daily 10:00 AM – 6:00 PM"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              {/* Description (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Booth Description / Guidance (English)
                  </label>
                  <textarea
                    rows={2}
                    value={editingCenter.description_en || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, description_en: e.target.value })}
                    placeholder="e.g. Collect printed forms or submit cash directly to desk coordinator."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Booth Description / Guidance (Bengali)
                  </label>
                  <textarea
                    rows={2}
                    value={editingCenter.description_bn || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, description_bn: e.target.value })}
                    placeholder="যেমন: সরাসরি মুদ্রিত ফর্ম সংগ্রহ ও নগদ ফি জমাদানের সুবিধা।"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Map URL & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Google Maps / Directions URL
                  </label>
                  <input
                    type="url"
                    value={editingCenter.map_url || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, map_url: e.target.value })}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingCenter.order_index}
                    onChange={e => setEditingCenter({ ...editingCenter, order_index: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Status / Visibility */}
              <div className="pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCenter.is_active}
                    onChange={e => setEditingCenter({ ...editingCenter, is_active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Enable this booth immediately on the public website
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingCenter(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Booth</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE TO TRASH CONFIRMATION */}
      {trashConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <Trash2 className="w-6 h-6" />
              <h4 className="font-bold text-slate-900 text-base">Move Booth to Trash?</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This booth will be hidden from the homepage immediately. You can restore it anytime from the "Trash / Deleted" tab.
            </p>
            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTrashConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMoveToTrash(trashConfirmId)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORCE DELETE CONFIRMATION */}
      {forceDeleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="font-bold text-slate-900 text-base">Permanently Delete Booth?</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure? This action cannot be undone. The booth record will be permanently deleted from the database.
            </p>
            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setForceDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleForceDelete(forceDeleteConfirmId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
