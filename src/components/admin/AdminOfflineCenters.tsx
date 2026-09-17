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
} from 'lucide-react';
import { OfflineRegistrationCenter } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminOfflineCenters: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [centers, setCenters] = useState<OfflineRegistrationCenter[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingCenter, setEditingCenter] = useState<OfflineRegistrationCenter | null>(null);

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/offline-centers', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCenters(data || []);
      }
    } catch (err) {
      console.warn('Failed to load offline centers:', err);
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
      timings: 'Daily 10:00 AM – 6:00 PM',
      map_url: '',
      order_index: nextOrder,
      is_active: true,
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
      showToast('Please provide a center name.');
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
        headers: getHeaders(),
        body: JSON.stringify(editingCenter),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save offline center');
      }

      showToast(isNew ? 'New registration center created!' : 'Registration center updated successfully!');
      setModalOpen(false);
      setEditingCenter(null);
      fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error saving center');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/offline-centers/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete center');
      showToast('Offline registration center removed.');
      setDeleteConfirmId(null);
      fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error deleting center');
    }
  };

  const handleToggleActive = async (center: OfflineRegistrationCenter) => {
    try {
      const updated = { ...center, is_active: !center.is_active };
      const res = await fetch(`/api/admin/offline-centers/${center.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast(`Center ${updated.is_active ? 'enabled' : 'disabled'}.`);
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
      for (const item of updated) {
        await fetch(`/api/admin/offline-centers/${item.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ order_index: item.order_index }),
        });
      }
      showToast('Center display order updated.');
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
            Offline Registration Centers
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage authorized physical registration booths and help desks for alumni registering in person.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Registration Center</span>
        </button>
      </div>

      {/* Centers Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Active Centers ({centers.length})
          </span>
          <span className="text-xs text-slate-400">
            Drag or use arrows to reorder display on homepage
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading registration centers...</div>
        ) : centers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No offline registration centers yet.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add physical centers so alumni can find and contact nearby locations to submit paper forms and cash payments.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-emerald-800 text-white text-xs font-bold rounded-xl hover:bg-emerald-700"
            >
              Add First Center
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {centers.map((center, index) => (
              <div
                key={center.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-slate-50/70 ${
                  !center.is_active ? 'opacity-60 bg-slate-50/40' : ''
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
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === centers.length - 1}
                      onClick={() => handleReorder(index, 'down')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 mt-0.5">
                    <MapPin className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{center.name_en || center.name_bn}</h4>
                      {center.name_bn && center.name_en && (
                        <>
                          <span className="text-slate-300 text-xs">/</span>
                          <span className="text-xs text-slate-600 font-medium">{center.name_bn}</span>
                        </>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          center.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {center.is_active ? 'ACTIVE' : 'DISABLED'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Order #{center.order_index}</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {center.address_en || center.address_bn}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-emerald-700" />
                        <a href={`tel:${center.phone}`} className="hover:underline text-slate-700 font-semibold">
                          {center.phone}
                        </a>
                      </span>

                      {center.contact_person && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{center.contact_person}</span>
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
                          <span>Maps Link</span>
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
                    onClick={() => setDeleteConfirmId(center.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Delete Center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && editingCenter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-700" />
                <span>{editingCenter.id ? 'Edit Registration Center' : 'Add New Registration Center'}</span>
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingCenter(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Center Name (English) <span className="text-red-500">*</span>
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
                    Center Name (Bengali)
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Address (English) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editingCenter.address_en}
                    onChange={e => setEditingCenter({ ...editingCenter, address_en: e.target.value })}
                    placeholder="Physical address or room number"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Address (Bengali)
                  </label>
                  <textarea
                    rows={2}
                    value={editingCenter.address_bn}
                    onChange={e => setEditingCenter({ ...editingCenter, address_bn: e.target.value })}
                    placeholder="ঠিকানা (বাংলায়)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

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
                    Used directly by "Call Now" on frontend
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={editingCenter.contact_person || ''}
                    onChange={e => setEditingCenter({ ...editingCenter, contact_person: e.target.value })}
                    placeholder="e.g. Master Rafiqul Islam"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingCenter.order_index}
                    onChange={e => setEditingCenter({ ...editingCenter, order_index: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Google Maps Location / URL
                </label>
                <input
                  type="url"
                  value={editingCenter.map_url || ''}
                  onChange={e => setEditingCenter({ ...editingCenter, map_url: e.target.value })}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Used directly by "Get Direction" on frontend. If left empty, a search URL will be generated automatically.
                </span>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCenter.is_active}
                    onChange={e => setEditingCenter({ ...editingCenter, is_active: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Enable this center immediately on frontend website
                  </span>
                </label>
              </div>

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
                  <span>Save Center</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6" />
              <h4 className="font-bold text-slate-900 text-base">Delete Registration Center?</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this offline registration center? It will be immediately removed from the homepage.
            </p>
            <div className="pt-3 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
