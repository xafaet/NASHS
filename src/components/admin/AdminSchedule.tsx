import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Gift,
  Users,
  Award,
  Utensils,
  Music,
  HeartHandshake,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { ProgramScheduleSectionConfig, ProgramScheduleItem } from '../../types';

interface AdminScheduleProps {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
}

const AVAILABLE_ICONS = [
  { value: 'gift', label: 'Gift Box / Souvenir' },
  { value: 'users', label: 'Users / Rally / Assembly' },
  { value: 'award', label: 'Award / Honor / Crest' },
  { value: 'utensils', label: 'Utensils / Feast / Mezban' },
  { value: 'heart', label: 'Heart / Networking / Reunion' },
  { value: 'music', label: 'Music / Concert / Cultural' },
  { value: 'sparkles', label: 'Sparkles / Fireworks' },
  { value: 'clock', label: 'Clock / Timing' },
];

export const AdminSchedule: React.FC<AdminScheduleProps> = ({ onNotify, getHeaders }) => {
  const [config, setConfig] = useState<ProgramScheduleSectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgramScheduleItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  const getAuthHeaders = () => {
    const base = getHeaders ? getHeaders() : {};
    const token = typeof window !== 'undefined' ? localStorage.getItem('nash_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...base,
    };
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/program-schedule');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        onNotify?.('Failed to load program schedule settings.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Network error loading program schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleSaveConfig = async (updatedConfig: ProgramScheduleSectionConfig) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/program-schedule', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedConfig),
      });

      if (res.ok) {
        const saved = await res.json();
        setConfig(saved);
        onNotify?.('Day-Long Festivities & Program Schedule updated successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        onNotify?.(err.message || 'Failed to update schedule.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Error saving program schedule.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSectionStatus = () => {
    if (!config) return;
    const newStatus = !config.is_enabled;
    const updated = { ...config, is_enabled: newStatus };
    setConfig(updated);
    handleSaveConfig(updated);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!config || !config.items) return;
    const items = [...config.items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // re-assign orders
    const reordered = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    const updated = { ...config, items: reordered };
    setConfig(updated);
    handleSaveConfig(updated);
  };

  const handleDeleteItem = (id: string) => {
    if (!config || !config.items) return;
    if (!window.confirm('Are you sure you want to delete this program schedule item?')) return;
    const filtered = config.items.filter(item => item.id !== id);
    const updated = { ...config, items: filtered };
    setConfig(updated);
    handleSaveConfig(updated);
  };

  const handleToggleItemActive = (id: string) => {
    if (!config || !config.items) return;
    const updatedItems = config.items.map(item =>
      item.id === id ? { ...item, is_active: item.is_active === false ? true : false } : item
    );
    const updated = { ...config, items: updatedItems };
    setConfig(updated);
    handleSaveConfig(updated);
  };

  const handleSaveItemModal = () => {
    if (!editingItem || !config) return;
    if (!editingItem.time || !editingItem.title_en) {
      alert('Please fill in at least the Time and English Title.');
      return;
    }

    let items = [...(config.items || [])];
    if (isNewItem) {
      items.push({
        ...editingItem,
        id: `sched-${Date.now()}`,
        order: items.length + 1,
      });
    } else {
      items = items.map(item => (item.id === editingItem.id ? editingItem : item));
    }

    const updated = { ...config, items };
    setConfig(updated);
    handleSaveConfig(updated);
    setEditingItem(null);
    setIsNewItem(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading Day-Long Festivities & Program Schedule settings...
      </div>
    );
  }

  if (!config) {
    return <div className="p-8 text-center text-slate-500">Failed to load schedule.</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header with Title & Enable/Disable Switch */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-emerald-700" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Day-Long Festivities & Program Schedule
              </h2>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Configure event timeline, session times, titles, descriptions, and show/hide the entire section on the frontend.
            </p>
          </div>

          {/* Section Master On/Off Switch */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Frontend Section:
            </span>
            <button
              type="button"
              onClick={toggleSectionStatus}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                config.is_enabled
                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                  : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
              }`}
            >
              {config.is_enabled ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>ENABLED (Visible on Frontend)</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>DISABLED (Hidden from Frontend)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section Header Content Editor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Top Badge (English)
            </label>
            <input
              type="text"
              value={config.badge_en || ''}
              onChange={e => setConfig({ ...config, badge_en: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="e.g. Official Event Program • 16 January 2027"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Top Badge (Bengali / বাংলা)
            </label>
            <input
              type="text"
              value={config.badge_bn || ''}
              onChange={e => setConfig({ ...config, badge_bn: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="যেমন: ১৬ জানুয়ারি ২০২৭ • সারাদিনব্যাপী বর্ণাঢ্য আয়োজন"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Main Section Title (English) *
            </label>
            <input
              type="text"
              value={config.title_en}
              onChange={e => setConfig({ ...config, title_en: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Day-Long Festivities & Program Schedule"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Main Section Title (Bengali / বাংলা) *
            </label>
            <input
              type="text"
              value={config.title_bn}
              onChange={e => setConfig({ ...config, title_bn: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="পুনর্মিলনী উৎসবের সূচি ও আকর্ষণ"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Subtitle (English)
            </label>
            <textarea
              rows={2}
              value={config.subtitle_en || ''}
              onChange={e => setConfig({ ...config, subtitle_en: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Describe the day's excitement in English..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Subtitle (Bengali / বাংলা)
            </label>
            <textarea
              rows={2}
              value={config.subtitle_bn || ''}
              onChange={e => setConfig({ ...config, subtitle_bn: e.target.value })}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="উৎসবের বিবরণ বাংলায় লিখুন..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveConfig(config)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-sm font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>{saving ? 'Saving...' : 'Save Header Settings'}</span>
          </button>
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Program Schedule Timeline Items</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Items will appear in order on the homepage when the section is enabled.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsNewItem(true);
              setEditingItem({
                id: `sched-${Date.now()}`,
                time: '09:00 AM',
                title_en: '',
                title_bn: '',
                description_en: '',
                description_bn: '',
                icon: 'clock',
                order: (config.items?.length || 0) + 1,
                is_active: true,
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Timeline Event</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {(config.items || []).map((item, index) => (
            <div
              key={item.id || `sched_item_${item.order || index}_${index}`}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                item.is_active === false ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/70'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="flex flex-col items-center gap-1 text-slate-400 pt-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveItem(index, 'up')}
                    className="p-1 hover:text-emerald-700 disabled:opacity-20 cursor-pointer"
                    title="Move Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === (config.items?.length || 1) - 1}
                    onClick={() => handleMoveItem(index, 'down')}
                    className="p-1 hover:text-emerald-700 disabled:opacity-20 cursor-pointer"
                    title="Move Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {item.time}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      Icon: {item.icon || 'clock'}
                    </span>
                    {item.is_active === false && (
                      <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        Inactive / Hidden
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {item.title_en}{' '}
                    {item.title_bn && <span className="text-slate-500 font-normal">({item.title_bn})</span>}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.description_en}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleItemActive(item.id)}
                  className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    item.is_active !== false
                      ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
                  title={item.is_active !== false ? 'Click to hide' : 'Click to show'}
                >
                  {item.is_active !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewItem(false);
                    setEditingItem({ ...item });
                  }}
                  className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
                  title="Edit Item"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer"
                  title="Delete Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit / Add Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">
                {isNewItem ? 'Add Program Schedule Event' : 'Edit Program Schedule Event'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsNewItem(false);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Event Time *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.time}
                    onChange={e => setEditingItem({ ...editingItem, time: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. 08:30 AM"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Display Icon
                  </label>
                  <select
                    value={editingItem.icon || 'clock'}
                    onChange={e => setEditingItem({ ...editingItem, icon: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {AVAILABLE_ICONS.map(i => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Title (English) *
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.title_en}
                  onChange={e => setEditingItem({ ...editingItem, title_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Registration Kit & Souvenir Gift"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Title (Bengali / বাংলা) *
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.title_bn}
                  onChange={e => setEditingItem({ ...editingItem, title_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="যেমন: কিট ও স্মরণিকা বিতরণ"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description (English)
                </label>
                <textarea
                  rows={3}
                  value={editingItem.description_en}
                  onChange={e => setEditingItem({ ...editingItem, description_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Event details in English..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description (Bengali / বাংলা)
                </label>
                <textarea
                  rows={3}
                  value={editingItem.description_bn}
                  onChange={e => setEditingItem({ ...editingItem, description_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="বিস্তারিত বাংলায়..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="item_is_active"
                  checked={editingItem.is_active !== false}
                  onChange={e => setEditingItem({ ...editingItem, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="item_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (Display this event on homepage)
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsNewItem(false);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveItemModal}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
