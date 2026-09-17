import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Edit2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Key,
  UserCheck,
  Plus,
  Copy,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Trash2,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  X,
  QrCode,
  Shield,
} from 'lucide-react';
import { User, Role } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminUsers: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{ user: User; tempPass: string } | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // View User Profile & History
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Delete User Confirmation
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create User form state
  const [createForm, setCreateForm] = useState({
    username: '',
    name: '',
    name_bn: '',
    email: '',
    phone: '',
    role: 'alumni_member',
    passing_year: '',
    gender: 'male',
    blood_group: '',
  });

  useEffect(() => {
    fetchUsers();
    apiFetch('/api/admin/roles', { headers: getHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRoles(data || []))
      .catch(err => console.warn('Roles load paused:', err));
  }, []);

  const fetchUsers = () => {
    apiFetch('/api/admin/users', { headers: getHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setUsers(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Users load paused:', err);
        setLoading(false);
      });
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser({ ...u });
    setNewUsername(u.username || '');
    setUsernameError('');
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUsernameError('');

    try {
      const payload = {
        ...editingUser,
        name: (editingUser.name || (editingUser as any).full_name || '').trim(),
        username: newUsername.trim(),
        passing_year: editingUser.passing_year ? parseInt(editingUser.passing_year as any, 10) : undefined,
      };

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to update user');
      }

      showToast('User profile & permissions updated successfully!');
      fetchUsers();
      setModalOpen(false);
      setEditingUser(null);
    } catch (e: any) {
      setUsernameError(e.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...createForm,
        passing_year: createForm.passing_year ? parseInt(createForm.passing_year, 10) : undefined,
      };

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create user');
      }

      showToast(`User account created successfully for @${data.username}`);
      setCreateModalOpen(false);
      setCreateForm({
        username: '',
        name: '',
        name_bn: '',
        email: '',
        phone: '',
        role: 'alumni_member',
        passing_year: '',
        gender: 'male',
        blood_group: '',
      });
      fetchUsers();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleResetPassword = async (u: User) => {
    if (!window.confirm(`Generate temporary login credential for ${u.name} (@${u.username})?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setResetResult({ user: u, tempPass: data.temp_password });
      setResetModalOpen(true);
      showToast(`Temporary password generated for ${u.name}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleOpenView = async (u: User) => {
    setViewingUser(u);
    setViewingDetails(null);
    setLoadingDetails(true);
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingDetails(data);
      }
    } catch (err) {
      console.warn('Could not load detailed profile:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }
      showToast(data.message || `User @${deletingUser.username} deleted. All historical records preserved.`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const term = (searchTerm || '').toLowerCase();
  const filtered = users.filter(u => {
    const matchesSearch =
      (u.name || (u as any).full_name || '').toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.phone || '').includes(searchTerm || '');

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'admin') return u.role === 'super_admin' || u.role === 'admin' || (u.role as string).includes('admin');
    return u.status === statusFilter;
  });

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading user directory...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            User & Alumni Profile Administration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage system access, usernames, multi-tier roles, and password credentials for all members.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by name, username, phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50"
            />
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: `All Users (${users.length})` },
          { id: 'active', label: `Active (${users.filter(u => u.status === 'active').length})` },
          { id: 'admin', label: `Administrators (${users.filter(u => (u.role as string).includes('admin')).length})` },
          { id: 'pending', label: `Pending (${users.filter(u => u.status === 'pending').length})` },
          { id: 'suspended', label: `Suspended (${users.filter(u => u.status === 'suspended' || u.status === 'blocked').length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">User & Contact</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Passing Year</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {u.name || (u as any).full_name || 'Alumni Member'}
                      {u.name_bn && <span className="ml-1.5 text-xs font-normal text-slate-400">({u.name_bn})</span>}
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">{u.email} • {u.phone || 'No Phone'}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-emerald-800">
                    @{u.username}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded font-bold capitalize ${
                      u.role === 'super_admin' ? 'bg-amber-100 text-amber-900' :
                      (u.role as string).includes('admin') ? 'bg-purple-50 text-purple-800' :
                      'bg-emerald-50 text-emerald-800'
                    }`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {u.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : u.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold capitalize">
                        <XCircle className="w-3.5 h-3.5" /> {u.status || 'Suspended'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-slate-700">
                    {u.passing_year ? `${u.passing_year} (${u.batch || 'Batch'})` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenView(u)}
                        title="View Complete Profile & History"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(u)}
                        title="Reset Password & Issue Temp Pass"
                        className="p-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 rounded-lg text-slate-600 transition cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        title="Edit User Profile"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingUser(u)}
                        title="Delete User (Archive Protected)"
                        className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 rounded-lg text-slate-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {modalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              Modify User Profile & Credentials
            </h3>

            {usernameError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{usernameError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Username (Must be unique across entire system)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name (English)
                  </label>
                  <input
                    type="text"
                    value={editingUser.name || ''}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name (Bangla)
                  </label>
                  <input
                    type="text"
                    value={editingUser.name_bn || ''}
                    onChange={e => setEditingUser({ ...editingUser, name_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Passing Year
                  </label>
                  <input
                    type="number"
                    min="1942"
                    max="2035"
                    value={editingUser.passing_year || ''}
                    onChange={e => setEditingUser({ ...editingUser, passing_year: parseInt(e.target.value, 10) || undefined })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Gender
                  </label>
                  <select
                    value={editingUser.gender || 'male'}
                    onChange={e => setEditingUser({ ...editingUser, gender: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Blood Group
                  </label>
                  <select
                    value={editingUser.blood_group || ''}
                    onChange={e => setEditingUser({ ...editingUser, blood_group: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Select...</option>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    System Role
                  </label>
                  <select
                    value={editingUser.role}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="alumni_member">Alumni Member</option>
                    <option value="event_admin">Event Admin</option>
                    <option value="finance_admin">Finance Admin</option>
                    <option value="content_admin">Content Admin</option>
                    <option value="gate_manager">Gate Officer</option>
                    <option value="admin">System Admin</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Account Status
                  </label>
                  <select
                    value={editingUser.status || 'active'}
                    onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending Approval</option>
                    <option value="suspended">Suspended</option>
                    <option value="blocked">Blocked</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-700" />
              Create New Alumni or Admin Account
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">@</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. didar_alam"
                    value={createForm.username}
                    onChange={e => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name (EN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Full Name (BN)
                  </label>
                  <input
                    type="text"
                    value={createForm.name_bn}
                    onChange={e => setCreateForm({ ...createForm, name_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Passing Year
                  </label>
                  <input
                    type="number"
                    min="1942"
                    max="2035"
                    placeholder="2008"
                    value={createForm.passing_year}
                    onChange={e => setCreateForm({ ...createForm, passing_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Gender
                  </label>
                  <select
                    value={createForm.gender}
                    onChange={e => setCreateForm({ ...createForm, gender: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Role
                  </label>
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="alumni_member">Alumni Member</option>
                    <option value="event_admin">Event Admin</option>
                    <option value="finance_admin">Finance Admin</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Result Modal */}
      {resetModalOpen && resetResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Temporary Credential Generated
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                A secure one-time temporary password was assigned to <strong>{resetResult.user.name}</strong> (@{resetResult.user.username}).
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase">One-Time Temporary Password</div>
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200">
                <span className="font-mono font-bold text-base text-emerald-800 tracking-wider">
                  {resetResult.tempPass}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resetResult.tempPass);
                    showToast('Temporary password copied to clipboard!');
                  }}
                  className="p-1.5 text-slate-500 hover:text-emerald-700 rounded transition cursor-pointer"
                  title="Copy Password"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Provide this temporary password to the member. They will be prompted to set a personal password upon their next login.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setResetModalOpen(false);
                  setResetResult(null);
                }}
                className="w-full py-2.5 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer"
              >
                Close & Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Profile & History Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-emerald-800 text-white font-black text-xl flex items-center justify-center shadow-sm">
                  {viewingUser.photo_url ? (
                    <img
                      src={viewingUser.photo_url}
                      alt={viewingUser.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    (viewingUser.name || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">{viewingUser.name}</h3>
                    {viewingUser.name_bn && (
                      <span className="text-sm font-bangla text-slate-500 font-medium">
                        ({viewingUser.name_bn})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                    <span className="font-mono font-bold text-emerald-800">@{viewingUser.username}</span>
                    <span>•</span>
                    <span className="font-semibold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {viewingUser.role ? viewingUser.role.replace('_', ' ') : 'Member'}
                    </span>
                    <span>•</span>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        viewingUser.status === 'active'
                          ? 'text-emerald-700'
                          : viewingUser.status === 'pending'
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {viewingUser.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setViewingUser(null);
                  setViewingDetails(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails && (
              <div className="p-8 text-center text-slate-400 text-sm">
                Loading profile and linked event records...
              </div>
            )}

            {/* Profile Content */}
            {(!loadingDetails || viewingDetails) && (
              <div className="space-y-4">
                {/* Identity & Contact Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                      Contact Information
                    </span>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{viewingUser.email || viewingDetails?.email || 'No email registered'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-mono">{viewingUser.phone || viewingDetails?.phone || 'No phone registered'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                      Academic & Batch
                    </span>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Passing Year: <strong>{viewingUser.passing_year || viewingDetails?.passing_year || '—'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <Shield className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Assigned Batch: <strong>{viewingUser.batch || viewingDetails?.batch || `Batch ${viewingUser.passing_year || '—'}`}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                      Personal Information
                    </span>
                    <div className="text-slate-800 font-medium">
                      Gender: <span className="capitalize">{viewingUser.gender || viewingDetails?.gender || 'N/A'}</span>
                    </div>
                    <div className="text-slate-800 font-medium">
                      Blood Group: <span className="font-mono font-bold text-red-600">{viewingUser.blood_group || viewingDetails?.blood_group || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">
                      Professional & Location
                    </span>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{viewingUser.occupation || viewingDetails?.occupation || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">{viewingDetails?.address || 'No address provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Bio if available */}
                {(viewingUser.bio || viewingDetails?.bio) && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px] mb-1">
                      Alumni Bio
                    </span>
                    <p className="text-slate-700 leading-relaxed italic">
                      "{viewingUser.bio || viewingDetails?.bio}"
                    </p>
                  </div>
                )}

                {/* Linked 85th Reunion Registration & Entry Pass */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-emerald-700" />
                      85th Anniversary Reunion Registration Status
                    </span>
                    {viewingDetails?.registrations && viewingDetails.registrations.length > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[11px] font-bold rounded-full">
                        {viewingDetails.registrations.length} Registration(s) Linked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[11px] font-medium rounded-full">
                        No active registration
                      </span>
                    )}
                  </div>

                  {viewingDetails?.registrations && viewingDetails.registrations.length > 0 ? (
                    <div className="space-y-2">
                      {viewingDetails.registrations.map((reg: any) => (
                        <div
                          key={reg.id}
                          className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">{reg.id}</span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                                  reg.payment_status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {reg.payment_status}
                              </span>
                              {reg.checked_in && (
                                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-100 text-blue-800">
                                  Checked In
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                            <div>Batch: <strong>{reg.batch_name || `Batch ${reg.passing_year}`}</strong></div>
                            <div>Fee: <strong>BDT {reg.fee_amount || 1000}</strong></div>
                            {reg.token_code && (
                              <div className="col-span-2 font-mono text-[11px] text-emerald-900 bg-emerald-50 px-2 py-1 rounded">
                                Token: <strong>{reg.token_code}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-800/80">
                      This user has not yet registered for the 85th Anniversary Reunion or was created as an administrator.
                    </p>
                  )}
                </div>

                {/* Historical Records Preservation Notice */}
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Archive Preservation Policy:</span>{' '}
                    All historical transactions, registration passes, tokens, and audit trails associated with this member are permanently preserved for institutional memory and financial integrity.
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setViewingUser(null);
                  setViewingDetails(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-slate-800 text-white rounded-xl hover:bg-slate-700 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete User Account?
              </h3>
              <p className="text-xs text-slate-500">
                You are about to delete the user account for <strong>{deletingUser.name}</strong> (
                <span className="font-mono font-bold text-emerald-800">@{deletingUser.username}</span>).
              </p>
            </div>

            <div className="p-3.5 bg-red-50/70 border border-red-200/80 rounded-xl space-y-2 text-xs text-red-800">
              <div className="font-bold flex items-center gap-1.5 text-red-900">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                Access & Permissions Revocation
              </div>
              <p className="leading-relaxed text-[11.5px]">
                The user's login access, password credentials, and administrative roles will be immediately terminated.
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1 text-xs text-emerald-900">
              <div className="font-bold flex items-center gap-1.5 text-emerald-950">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                Data Preservation Guarantee
              </div>
              <p className="leading-relaxed text-[11.5px] text-emerald-800">
                All historical records (such as 85th Reunion registration forms, payment receipts, gate tokens, and audit logs) are <strong>preserved in the database archive</strong> to maintain financial and event records.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 cursor-pointer shadow-xs transition flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting Account...' : 'Confirm Delete & Preserve Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
