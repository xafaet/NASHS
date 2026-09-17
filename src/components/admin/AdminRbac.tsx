import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Edit2, Key, CheckCircle2, Lock } from 'lucide-react';
import { Role } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'pages.manage', label: 'Manage CMS Pages & Sections', category: 'Content' },
  { key: 'menus.manage', label: 'Manage Header, Menus & Footer', category: 'Content' },
  { key: 'faqs.manage', label: 'Manage FAQs', category: 'Content' },
  { key: 'notices.manage', label: 'Manage Notices & News', category: 'Content' },
  { key: 'media.manage', label: 'Manage Media & Documents', category: 'Content' },
  { key: 'registrations.view', label: 'View Alumni Registrations', category: 'Operations' },
  { key: 'registrations.manage', label: 'Approve / Edit Registrations', category: 'Operations' },
  { key: 'payments.manage', label: 'Verify Payments & Gateways', category: 'Finance' },
  { key: 'tokens.manage', label: 'Generate & Void Tokens / Gate Check-in', category: 'Operations' },
  { key: 'batch.manage', label: 'Manage Batch Calculation & Overrides', category: 'Operations' },
  { key: 'users.manage', label: 'Manage User Profiles & Usernames', category: 'Administration' },
  { key: 'roles.manage', label: 'Manage RBAC Roles & Permissions', category: 'Administration' },
  { key: 'settings.manage', label: 'Manage Global Site Configuration', category: 'Administration' },
];

export const AdminRbac: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = () => {
    apiFetch('/api/admin/roles', { headers: getHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setRoles(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Roles load paused:', err);
        setLoading(false);
      });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    try {
      const isNew = !roles.some(r => r.id === editingRole.id);
      const url = isNew ? '/api/admin/roles' : `/api/admin/roles/${editingRole.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(editingRole),
      });

      if (!res.ok) throw new Error('Failed to save role');
      showToast('Role updated successfully!');
      fetchRoles();
      setModalOpen(false);
      setEditingRole(null);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const togglePermission = (permKey: string) => {
    if (!editingRole) return;
    const exists = editingRole.permissions.includes(permKey);
    const updated = exists
      ? editingRole.permissions.filter(p => p !== permKey)
      : [...editingRole.permissions, permKey];
    setEditingRole({ ...editingRole, permissions: updated });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading roles and permissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            Granular Role-Based Access Control (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define system roles and assign granular security permissions across all modules.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRole({
              id: `role-${Date.now()}`,
              name: 'Custom Admin',
              description: 'Custom administrative delegate with scoped access',
              permissions: ['registrations.view'],
              is_system: false,
            });
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Role</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map(role => (
          <div key={role.id} className="p-6 bg-white rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{role.name}</h3>
                  {role.is_system && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                      System Core
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
              </div>

              <button
                onClick={() => {
                  setEditingRole({ ...role });
                  setModalOpen(true);
                }}
                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Permissions ({role.permissions.includes('*') ? 'All (*)' : role.permissions.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.includes('*') ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Full Root Access (*)
                  </span>
                ) : (
                  role.permissions.map(perm => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono"
                    >
                      {perm}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Role Modal */}
      {modalOpen && editingRole && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-700" />
              {roles.some(r => r.id === editingRole.id) ? 'Edit Role Permissions' : 'New Role'}
            </h3>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Role Title
                </label>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingRole.description}
                  onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Select Granular Permissions
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {AVAILABLE_PERMISSIONS.map(p => {
                    const isChecked = editingRole.permissions.includes(p.key) || editingRole.permissions.includes('*');
                    return (
                      <label
                        key={p.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs transition ${
                          isChecked ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={editingRole.permissions.includes('*')}
                          onChange={() => togglePermission(p.key)}
                          className="mt-0.5 text-emerald-700 rounded-sm"
                        />
                        <div>
                          <span className="font-bold text-slate-800 block">{p.label}</span>
                          <span className="font-mono text-[10px] text-slate-400">{p.key}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingRole(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
