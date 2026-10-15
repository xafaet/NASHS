import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Image as ImageIcon,
  Database,
  FileCheck,
  Info,
  RefreshCw,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Search,
} from 'lucide-react';
import { SettingItem } from '../../types';
import { apiFetch } from '../../utils/api';

interface AdminSettingsTableProps {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
}

export const AdminSettingsTable: React.FC<AdminSettingsTableProps> = ({
  onNotify,
  getHeaders,
}) => {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Dedicated state for registration_image_max_size
  const [imageSizeMb, setImageSizeMb] = useState<number>(1.5);
  const [imageSizeSaving, setImageSizeSaving] = useState(false);
  const [imageSizeError, setImageSizeError] = useState<string | null>(null);

  // Modal for editing/adding any setting
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  const defaultHeaders = () => {
    if (getHeaders) return getHeaders();
    const token =
      localStorage.getItem('nash_token') ||
      localStorage.getItem('nash_auth_token') ||
      localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadSettingsTable = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/settings/table');
      if (res.ok) {
        const data = await res.json();
        const items: SettingItem[] = Array.isArray(data.settings) ? data.settings : [];
        setSettings(items);

        // Find registration_image_max_size
        const imgSetting = items.find(s => s.key === 'registration_image_max_size');
        if (imgSetting && imgSetting.value) {
          const parsed = parseFloat(imgSetting.value);
          if (!isNaN(parsed) && parsed > 0) {
            setImageSizeMb(parsed);
          }
        }
      } else {
        onNotify?.('Failed to load database settings table.');
      }
    } catch (err: any) {
      console.error(err);
      onNotify?.('Error loading settings table: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsTable();
  }, []);

  const handleSaveImageSize = async () => {
    if (imageSizeMb < 0.1 || imageSizeMb > 25) {
      setImageSizeError('Size must be between 0.1 MB and 25 MB.');
      return;
    }
    setImageSizeError(null);
    setImageSizeSaving(true);

    try {
      const res = await apiFetch('/api/admin/settings/registration-image-size', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...defaultHeaders(),
        },
        body: JSON.stringify({ size_mb: imageSizeMb }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update image size setting');
      }

      onNotify?.(`Registration image size limit set to ${imageSizeMb} MB in database settings table!`);
      await loadSettingsTable();
    } catch (err: any) {
      setImageSizeError(err.message || 'Error updating setting');
      onNotify?.(err.message || 'Error updating setting');
    } finally {
      setImageSizeSaving(false);
    }
  };

  const handleSaveModalItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.key.trim()) {
      alert('Setting key is required.');
      return;
    }

    setSavingKey(editingItem.key);
    try {
      const res = await apiFetch(`/api/admin/settings/item/${encodeURIComponent(editingItem.key)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...defaultHeaders(),
        },
        body: JSON.stringify({
          value: editingItem.value,
          group: editingItem.group || 'general',
          description: editingItem.description,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save setting');
      }

      onNotify?.(`Setting "${editingItem.key}" successfully saved to database!`);
      setEditingItem(null);
      setIsNewItem(false);
      await loadSettingsTable();
    } catch (err: any) {
      alert(err.message || 'Error saving setting');
    } finally {
      setSavingKey(null);
    }
  };

  const groups: string[] = ['all', ...Array.from(new Set<string>(settings.map(s => s.group || 'general')))];

  const filteredSettings = settings.filter(s => {
    const matchSearch =
      s.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.value || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchGroup = selectedGroup === 'all' || (s.group || 'general') === selectedGroup;
    return matchSearch && matchGroup;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
              <Database className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Database Settings Table CMS
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  `settings` Table
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Migration Seeded
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Manage global application key-value pairs stored in the authoritative <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-emerald-800">settings</code> database table. Seeded with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-emerald-800">registration_image_max_size</code> (default 1.5MB).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={loadSettingsTable}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Refresh from Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsNewItem(true);
                setEditingItem({
                  key: '',
                  value: '',
                  group: 'general',
                  type: 'string',
                  description: '',
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-300" />
              <span>Add Custom Setting</span>
            </button>
          </div>
        </div>
      </div>

      {/* FEATURED CMS SECTION: Registration Image Size Limit */}
      <div className="bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/50 rounded-2xl border-2 border-emerald-300 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-200/80 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <ImageIcon className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Registration Image Max Size (<code className="font-mono text-xs bg-emerald-100/80 text-emerald-900 px-2 py-0.5 rounded">registration_image_max_size</code>)
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                Configures the single source of truth for maximum permitted alumni photo uploads. Stored persistently in the database <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-emerald-800 border border-emerald-200">settings</code> table.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveImageSize}
            disabled={imageSizeSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md cursor-pointer disabled:opacity-50 shrink-0 self-start md:self-auto"
          >
            {imageSizeSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                <span>Saving to DB...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-amber-300" />
                <span>Save Image Limit</span>
              </>
            )}
          </button>
        </div>

        {/* Input & Presets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Maximum Size in Megabytes (MB)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="25"
                value={imageSizeMb}
                onChange={e => {
                  setImageSizeError(null);
                  setImageSizeMb(parseFloat(e.target.value) || 0);
                }}
                className="w-full px-4 py-2.5 bg-white border-2 border-emerald-300 rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
              <span className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shrink-0">
                MB
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-500">Presets:</span>
              {[0.5, 1, 1.5, 2, 3, 5, 10].map(p => (
                <button
                  key={`preset_${p}`}
                  type="button"
                  onClick={() => {
                    setImageSizeError(null);
                    setImageSizeMb(p);
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    imageSizeMb === p
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p} MB {p === 1.5 && '(Default)'}
                </button>
              ))}
            </div>

            {imageSizeError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold pt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{imageSizeError}</span>
              </div>
            )}
          </div>

          {/* Byte Calculation & Enforcement */}
          <div className="space-y-2 bg-white/80 p-4 rounded-xl border border-emerald-100 shadow-xs">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enforcement Specs
            </span>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span>Exact Byte Limit:</span>
                <strong className="font-mono text-emerald-800">
                  {Math.round(imageSizeMb * 1024 * 1024).toLocaleString()} bytes
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Database Key:</span>
                <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded font-mono">
                  registration_image_max_size
                </code>
              </div>
              <div className="flex justify-between items-center">
                <span>Backend Validation:</span>
                <span className="text-emerald-700 font-bold">Magic byte + Buffer size</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Frontend Indicator:</span>
                <span className="text-slate-800 font-medium">&ldquo;Maximum image size: {imageSizeMb} MB&rdquo;</span>
              </div>
            </div>
          </div>

          {/* Hosting Notice */}
          <div className="space-y-2 bg-amber-50/80 p-4 rounded-xl border border-amber-200 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Hosting Environment Notice</span>
            </div>
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              PHP hosting directives (<code className="font-mono">upload_max_filesize</code> & <code className="font-mono">post_max_size</code>) in cPanel must be at least <strong>16M</strong> so the web server does not drop uploads before reaching application logic.
            </p>
          </div>
        </div>
      </div>

      {/* FULL SETTINGS TABLE (ALL DATABASE KEYS) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              All `settings` Table Records ({filteredSettings.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Persistent key-value configurations stored in the database.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter by group */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Group:</span>
              <select
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
              >
                {groups.map((g: string) => (
                  <option key={g} value={g}>
                    {g.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search setting key..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-64"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Loading settings table...
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No settings found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Updated At</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSettings.map(item => (
                  <tr
                    key={item.key}
                    className={`hover:bg-slate-50/80 transition ${
                      item.key === 'registration_image_max_size' ? 'bg-emerald-50/40 font-medium' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        {item.key === 'registration_image_max_size' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        )}
                        <span>{item.key}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs truncate">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {item.value} {item.key === 'registration_image_max_size' ? 'MB' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {item.group || 'general'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                      {item.type || 'string'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">
                      {item.description || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap text-[11px]">
                      {item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewItem(false);
                          setEditingItem({ ...item });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition"
                      >
                        <Edit2 className="w-3 h-3 text-emerald-700" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {isNewItem ? 'Create New Database Setting' : `Edit Setting: ${editingItem.key}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsNewItem(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModalItem} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Setting Key *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isNewItem}
                  value={editingItem.key}
                  onChange={e => setEditingItem({ ...editingItem, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. registration_image_max_size"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Setting Value *
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.value}
                  onChange={e => setEditingItem({ ...editingItem, value: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Value..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Group
                  </label>
                  <input
                    type="text"
                    value={editingItem.group || 'general'}
                    onChange={e => setEditingItem({ ...editingItem, group: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. registration"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={editingItem.type || 'string'}
                    onChange={e => setEditingItem({ ...editingItem, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="string">String</option>
                    <option value="numeric">Numeric</option>
                    <option value="boolean">Boolean</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingItem.description || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Explain what this setting controls..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsNewItem(false);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(savingKey)}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingKey ? 'Saving...' : 'Save to Settings Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
