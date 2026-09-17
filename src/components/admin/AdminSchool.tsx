import React, { useState, useEffect } from 'react';
import { School, Save, Plus, Trash2, Edit2, CheckCircle2, History, Award, Building } from 'lucide-react';
import { SchoolInfo, SchoolMilestone, HeadmasterHistoryItem, SchoolFacilityItem } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminSchool: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'history' | 'headmaster' | 'milestones' | 'facilities'>('general');

  useEffect(() => {
    fetchSchoolInfo();
  }, []);

  const fetchSchoolInfo = async () => {
    try {
      const res = await apiFetch('/api/school-info');
      if (res.ok) {
        setSchool(await res.json());
      }
      setLoading(false);
    } catch (err) {
      console.warn('School info fetch paused:', err);
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setSaving(true);

    try {
      const res = await fetch('/api/admin/school-info', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(school),
      });

      if (!res.ok) throw new Error('Failed to save school information');

      const updated = await res.json();
      setSchool(updated);
      showToast('School information & institutional legacy saved successfully!');
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !school) {
    return <div className="p-8 text-center text-slate-500">Loading school heritage information...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <School className="w-5 h-5 text-emerald-700" />
            School Heritage & Institutional Profiles
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain institutional history, headmaster message, timeline milestones, and campus facilities.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'general', label: 'Basic Info & EIIN' },
          { id: 'history', label: 'Institutional History' },
          { id: 'headmaster', label: 'Headmaster Message' },
          { id: 'milestones', label: `Historical Milestones (${school.milestones?.length || 0})` },
          { id: 'facilities', label: `Facilities & Campus (${school.facilities?.length || 0})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer border ${
              activeTab === tab.id
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: General */}
        {activeTab === 'general' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  School Name (English)
                </label>
                <input
                  type="text"
                  value={school.name_en}
                  onChange={e => setSchool({ ...school, name_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  School Name (Bangla)
                </label>
                <input
                  type="text"
                  value={school.name_bn}
                  onChange={e => setSchool({ ...school, name_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Established Year
                </label>
                <input
                  type="number"
                  value={school.established_year}
                  onChange={e => setSchool({ ...school, established_year: parseInt(e.target.value, 10) || 1942 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  EIIN Number
                </label>
                <input
                  type="text"
                  value={school.eiin || ''}
                  onChange={e => setSchool({ ...school, eiin: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  School Code
                </label>
                <input
                  type="text"
                  value={school.school_code || ''}
                  onChange={e => setSchool({ ...school, school_code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Address (English)
                </label>
                <input
                  type="text"
                  value={school.address_en || ''}
                  onChange={e => setSchool({ ...school, address_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Address (Bangla)
                </label>
                <input
                  type="text"
                  value={school.address_bn || ''}
                  onChange={e => setSchool({ ...school, address_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={school.phone || ''}
                  onChange={e => setSchool({ ...school, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  value={school.email || ''}
                  onChange={e => setSchool({ ...school, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  value={school.website || ''}
                  onChange={e => setSchool({ ...school, website: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: History */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Institutional History (Bangla)
              </label>
              <textarea
                rows={6}
                value={school.history_bn || ''}
                onChange={e => setSchool({ ...school, history_bn: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-sans leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Institutional History (English)
              </label>
              <textarea
                rows={6}
                value={school.history_en || ''}
                onChange={e => setSchool({ ...school, history_en: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-sans leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Tab 3: Headmaster */}
        {activeTab === 'headmaster' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Current Headmaster Name (EN)
                </label>
                <input
                  type="text"
                  value={school.headmaster_name || ''}
                  onChange={e => setSchool({ ...school, headmaster_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Current Headmaster Name (BN)
                </label>
                <input
                  type="text"
                  value={school.headmaster_name_bn || ''}
                  onChange={e => setSchool({ ...school, headmaster_name_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Headmaster Message (Bangla)
              </label>
              <textarea
                rows={5}
                value={school.headmaster_message_bn || ''}
                onChange={e => setSchool({ ...school, headmaster_message_bn: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Headmaster Message (English)
              </label>
              <textarea
                rows={5}
                value={school.headmaster_message_en || ''}
                onChange={e => setSchool({ ...school, headmaster_message_en: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Milestones */}
        {activeTab === 'milestones' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">Milestone Timeline</h3>
              <button
                type="button"
                onClick={() => {
                  const milestones = school.milestones || [];
                  setSchool({
                    ...school,
                    milestones: [
                      ...milestones,
                      {
                        year: 2026,
                        title_en: 'New Milestone',
                        title_bn: 'নতুন অর্জন',
                        description_en: '',
                        description_bn: '',
                      },
                    ],
                  });
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Add Milestone
              </button>
            </div>

            <div className="space-y-3">
              {(school.milestones || []).map((m, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Year</label>
                      <input
                        type="number"
                        value={m.year}
                        onChange={e => {
                          const list = [...(school.milestones || [])];
                          list[idx].year = parseInt(e.target.value, 10) || 1942;
                          setSchool({ ...school, milestones: list });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-mono font-bold"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Title (EN)</label>
                      <input
                        type="text"
                        value={m.title_en}
                        onChange={e => {
                          const list = [...(school.milestones || [])];
                          list[idx].title_en = e.target.value;
                          setSchool({ ...school, milestones: list });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Title (Bangla)"
                      value={m.title_bn}
                      onChange={e => {
                        const list = [...(school.milestones || [])];
                        list[idx].title_bn = e.target.value;
                        setSchool({ ...school, milestones: list });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Description (EN)"
                        value={m.description_en}
                        onChange={e => {
                          const list = [...(school.milestones || [])];
                          list[idx].description_en = e.target.value;
                          setSchool({ ...school, milestones: list });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = (school.milestones || []).filter((_, i) => i !== idx);
                          setSchool({ ...school, milestones: list });
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Facilities */}
        {activeTab === 'facilities' && (
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">Campus Facilities</h3>
              <button
                type="button"
                onClick={() => {
                  const facilities = school.facilities || [];
                  setSchool({
                    ...school,
                    facilities: [
                      ...facilities,
                      {
                        title_en: 'New Facility',
                        title_bn: 'নতুন সুবিধা',
                        description_en: '',
                        description_bn: '',
                      },
                    ],
                  });
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Add Facility
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(school.facilities || []).map((f, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-700">Facility #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = (school.facilities || []).filter((_, i) => i !== idx);
                        setSchool({ ...school, facilities: list });
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Title (EN)"
                    value={f.title_en}
                    onChange={e => {
                      const list = [...(school.facilities || [])];
                      list[idx].title_en = e.target.value;
                      setSchool({ ...school, facilities: list });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Title (BN)"
                    value={f.title_bn}
                    onChange={e => {
                      const list = [...(school.facilities || [])];
                      list[idx].title_bn = e.target.value;
                      setSchool({ ...school, facilities: list });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                  <textarea
                    rows={2}
                    placeholder="Description..."
                    value={f.description_en}
                    onChange={e => {
                      const list = [...(school.facilities || [])];
                      list[idx].description_en = e.target.value;
                      setSchool({ ...school, facilities: list });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
