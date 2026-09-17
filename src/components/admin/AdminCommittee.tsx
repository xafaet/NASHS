import React, { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Edit2, Users, CheckCircle2, ShieldAlert, Phone, Mail } from 'lucide-react';
import { Committee, CommitteeMemberItem, CommitteeDesignation } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminCommittee: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string>('');
  const [members, setMembers] = useState<CommitteeMemberItem[]>([]);
  const [designations, setDesignations] = useState<CommitteeDesignation[]>([]);
  const [loading, setLoading] = useState(true);

  // Committee Modal
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);

  // Member Modal
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMemberItem | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [commRes, desigRes] = await Promise.all([
        apiFetch('/api/committees'),
        apiFetch('/api/committee-designations'),
      ]);

      const commData: Committee[] = commRes.ok ? await commRes.json() : [];
      const desigData: CommitteeDesignation[] = desigRes.ok ? await desigRes.json() : [];

      setCommittees(commData);
      setDesignations(desigData);

      const activeComm = commData.find(c => c.is_current) || commData[0];
      if (activeComm) {
        setSelectedCommitteeId(activeComm.id);
        fetchMembers(activeComm.id);
      }
      setLoading(false);
    } catch (err) {
      console.warn('Committee admin data paused:', err);
      setLoading(false);
    }
  };

  const fetchMembers = async (commId: string) => {
    try {
      const res = await apiFetch(`/api/committee-members?committee_id=${commId}`);
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch (err) {
      console.warn('Members fetch paused:', err);
    }
  };

  const handleSelectCommittee = (id: string) => {
    setSelectedCommitteeId(id);
    fetchMembers(id);
  };

  const handleSaveCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommittee) return;

    try {
      const isNew = !committees.some(c => c.id === editingCommittee.id);
      const url = isNew ? '/api/admin/committees' : `/api/admin/committees/${editingCommittee.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(editingCommittee),
      });

      if (!res.ok) throw new Error('Failed to save committee');

      showToast('Committee tenure details saved successfully!');
      setCommitteeModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDeleteCommittee = async (id: string) => {
    if (!window.confirm('Delete this committee and its members?')) return;
    try {
      const res = await fetch(`/api/admin/committees/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Committee deleted');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    try {
      const isNew = !members.some(m => m.id === editingMember.id);
      const url = isNew ? '/api/admin/committee-members' : `/api/admin/committee-members/${editingMember.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          ...editingMember,
          committee_id: selectedCommitteeId,
        }),
      });

      if (!res.ok) throw new Error('Failed to save committee member');

      showToast('Committee member saved successfully!');
      setMemberModalOpen(false);
      fetchMembers(selectedCommitteeId);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm('Remove this member from the committee?')) return;
    try {
      const res = await fetch(`/api/admin/committee-members/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Member removed');
        fetchMembers(selectedCommitteeId);
      }
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const currentCommittee = committees.find(c => c.id === selectedCommitteeId);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading committees...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-700" />
            Executive & Convening Committee Administration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize jubilee committees, tenure periods, designations, and leadership hierarchies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingCommittee({
                id: `comm-${Date.now()}`,
                name_en: '',
                name_bn: '',
                committee_type: 'convening',
                tenure_label: '2026–2027',
                is_current: false,
                is_active: true,
                order_index: committees.length + 1,
              });
              setCommitteeModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Committee</span>
          </button>
        </div>
      </div>

      {/* Committee Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {committees.map(c => (
          <div
            key={c.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer border ${
              selectedCommitteeId === c.id
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => handleSelectCommittee(c.id)}
          >
            <span>{c.name_en}</span>
            {c.is_current && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded ${
                selectedCommitteeId === c.id ? 'bg-amber-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
              }`}>
                Current
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Selected Committee Details & Action Toolbar */}
      {currentCommittee && (
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base">{currentCommittee.name_en}</h3>
              {currentCommittee.name_bn && (
                <span className="text-slate-500 text-sm">({currentCommittee.name_bn})</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tenure: <span className="font-semibold text-slate-700">{currentCommittee.tenure_label}</span> • Type: <span className="capitalize font-semibold text-slate-700">{currentCommittee.committee_type}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingCommittee(currentCommittee);
                setCommitteeModalOpen(true);
              }}
              className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition cursor-pointer"
              title="Edit Committee Info"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditingMember({
                  id: `cm-${Date.now()}`,
                  committee_id: currentCommittee.id,
                  custom_name_en: '',
                  custom_name_bn: '',
                  designation_en: designations[0]?.title_en || 'Member',
                  designation_bn: designations[0]?.title_bn || 'সদস্য',
                  batch_year: 2000,
                  order_index: members.length + 1,
                  is_active: true,
                });
                setMemberModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>
        </div>
      )}

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(m => (
          <div key={m.id} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between hover:border-emerald-200 transition">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.custom_name_en} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-sm">
                    {m.custom_name_en.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm truncate">{m.custom_name_en}</div>
                {m.custom_name_bn && (
                  <div className="text-slate-500 text-xs truncate">{m.custom_name_bn}</div>
                )}
                <div className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-bold text-[11px]">
                  {m.designation_en}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {m.batch_name || (m.batch_year ? `SSC ${m.batch_year}` : 'Alumni')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingMember(m);
                    setMemberModalOpen(true);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-emerald-700 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteMember(m.id)}
                  className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Committee Modal */}
      {committeeModalOpen && editingCommittee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {committees.some(c => c.id === editingCommittee.id) ? 'Edit Committee' : 'Create Committee'}
            </h3>

            <form onSubmit={handleSaveCommittee} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Committee Name (English)
                </label>
                <input
                  type="text"
                  required
                  value={editingCommittee.name_en}
                  onChange={e => setEditingCommittee({ ...editingCommittee, name_en: e.target.value })}
                  placeholder="e.g. 85th Jubilee Convening Committee"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Committee Name (Bangla)
                </label>
                <input
                  type="text"
                  value={editingCommittee.name_bn || ''}
                  onChange={e => setEditingCommittee({ ...editingCommittee, name_bn: e.target.value })}
                  placeholder="৮৫তম বার্ষিকী আহ্বায়ক কমিটি"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tenure Label
                  </label>
                  <input
                    type="text"
                    value={editingCommittee.tenure_label || ''}
                    onChange={e => setEditingCommittee({ ...editingCommittee, tenure_label: e.target.value })}
                    placeholder="2026–2027"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Committee Type
                  </label>
                  <select
                    value={editingCommittee.committee_type}
                    onChange={e => setEditingCommittee({ ...editingCommittee, committee_type: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="convening">Convening (আহ্বায়ক)</option>
                    <option value="executive">Executive (কার্যনির্বাহী)</option>
                    <option value="advisory">Advisory (উপদেষ্টা)</option>
                    <option value="subcommittee">Sub-Committee</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={editingCommittee.is_current}
                  onChange={e => setEditingCommittee({ ...editingCommittee, is_current: e.target.checked })}
                  className="rounded text-emerald-700"
                />
                <label htmlFor="isCurrent" className="text-xs font-semibold text-slate-700">
                  Set as Current Active Committee on Public Site
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCommitteeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {memberModalOpen && editingMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {members.some(m => m.id === editingMember.id) ? 'Edit Committee Member' : 'Add Committee Member'}
            </h3>

            <form onSubmit={handleSaveMember} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name (EN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.custom_name_en}
                    onChange={e => setEditingMember({ ...editingMember, custom_name_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name (BN)
                  </label>
                  <input
                    type="text"
                    value={editingMember.custom_name_bn || ''}
                    onChange={e => setEditingMember({ ...editingMember, custom_name_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Designation (EN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.designation_en}
                    onChange={e => setEditingMember({ ...editingMember, designation_en: e.target.value })}
                    placeholder="e.g. Convener, Member Secretary"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Designation (BN)
                  </label>
                  <input
                    type="text"
                    value={editingMember.designation_bn || ''}
                    onChange={e => setEditingMember({ ...editingMember, designation_bn: e.target.value })}
                    placeholder="e.g. আহ্বায়ক, সদস্য সচিব"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Passing Year (SSC)
                  </label>
                  <input
                    type="number"
                    value={editingMember.batch_year || ''}
                    onChange={e => setEditingMember({ ...editingMember, batch_year: parseInt(e.target.value, 10) || undefined })}
                    placeholder="e.g. 1986"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Photo URL
                  </label>
                  <input
                    type="url"
                    value={editingMember.photo_url || ''}
                    onChange={e => setEditingMember({ ...editingMember, photo_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={editingMember.phone || ''}
                    onChange={e => setEditingMember({ ...editingMember, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Display Order Index
                  </label>
                  <input
                    type="number"
                    value={editingMember.order_index}
                    onChange={e => setEditingMember({ ...editingMember, order_index: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
