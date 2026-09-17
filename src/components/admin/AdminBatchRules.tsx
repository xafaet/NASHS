import React, { useState, useEffect } from 'react';
import { GraduationCap, Save, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';
import { BatchConfig, BatchOverride } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminBatchRules: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [config, setConfig] = useState<BatchConfig | null>(null);
  const [overrides, setOverrides] = useState<BatchOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Simulator
  const [testYear, setTestYear] = useState<number>(2024);
  const [testResult, setTestResult] = useState<any>(null);

  // New Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [newOverride, setNewOverride] = useState<BatchOverride>({
    passing_year: 1971,
    batch_number: 28,
    reason: '',
  });

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/batch-config', { headers: getHeaders() }).then(r => r.ok ? r.json() : null),
      apiFetch('/api/admin/batch-overrides', { headers: getHeaders() }).then(r => r.ok ? r.json() : []),
    ])
      .then(([cfg, ovr]) => {
        if (cfg) setConfig(cfg);
        if (ovr) setOverrides(ovr || []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Batch configuration load paused:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!config) return;
    // Calculate preview
    const foundOverride = overrides.find(o => o.passing_year === Number(testYear));
    if (foundOverride) {
      setTestResult({
        year: testYear,
        batchNumber: foundOverride.batch_number,
        isOverride: true,
        reason: foundOverride.reason,
      });
    } else {
      const calculated = config.reference_batch + (Number(testYear) - config.reference_year);
      setTestResult({
        year: testYear,
        batchNumber: calculated,
        isOverride: false,
      });
    }
  }, [testYear, config, overrides]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/batch-config', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to update batch calculation configuration');
      showToast('Batch calculation rule updated!');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/batch-overrides', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newOverride),
      });
      if (!res.ok) throw new Error('Failed to add batch override');
      const saved = await res.json();
      setOverrides([...overrides, saved]);
      setOverrideModalOpen(false);
      showToast('Batch override saved!');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleDeleteOverride = async (year: number) => {
    if (!confirm(`Are you sure you want to remove the override for year ${year}?`)) return;
    try {
      const res = await fetch(`/api/admin/batch-overrides/${year}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete override');
      setOverrides(overrides.filter(o => o.passing_year !== year));
      showToast('Override removed.');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading batch calculation rules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-emerald-700" />
          Dynamic Batch Calculation Engine
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure the base reference formula: <span className="font-mono font-bold text-emerald-800">Batch = Reference Batch + (Passing Year - Reference Year)</span>. 
          The canonical school benchmark is <strong>2008 = 65th Batch</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Formula Config */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Formula Parameters
            </h3>

            {config && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Reference Year
                    </label>
                    <input
                      type="number"
                      value={config.reference_year}
                      onChange={e => setConfig({ ...config, reference_year: parseInt(e.target.value) || 2008 })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Default: 2008</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Reference Batch Number
                    </label>
                    <input
                      type="number"
                      value={config.reference_batch}
                      onChange={e => setConfig({ ...config, reference_batch: parseInt(e.target.value) || 65 })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                      required
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Default: 65</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Formula Description / Notes
                  </label>
                  <input
                    type="text"
                    value={config.description || ''}
                    onChange={e => setConfig({ ...config, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Formula'}</span>
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Overrides Table */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                  Manual Batch Overrides
                </h3>
                <p className="text-xs text-slate-500">
                  Special academic years or double cohorts that deviate from standard linear arithmetic.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Override</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {overrides.map(ovr => (
                <div key={ovr.passing_year} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        Year {ovr.passing_year}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-xs">
                        Batch {ovr.batch_number}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                        Overridden
                      </span>
                    </div>
                    {ovr.reason && <p className="text-xs text-slate-500 mt-0.5">{ovr.reason}</p>}
                  </div>

                  <button
                    onClick={() => handleDeleteOverride(ovr.passing_year)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {overrides.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No manual overrides configured. All batch numbers are calculated automatically via the base formula.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Calculator / Test Sandbox */}
        <div className="space-y-4">
          <div className="bg-emerald-950 text-white p-6 rounded-2xl shadow-xs border border-emerald-900 space-y-4">
            <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2 uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-amber-400" />
              Formula Sandbox
            </h3>
            <p className="text-xs text-emerald-200">
              Test how any SSC passing year resolves in real-time.
            </p>

            <div>
              <label className="block text-xs font-bold text-emerald-300 uppercase mb-1">
                Enter SSC Passing Year
              </label>
              <input
                type="number"
                value={testYear}
                onChange={e => setTestYear(parseInt(e.target.value) || 2024)}
                className="w-full px-3 py-2 text-sm bg-emerald-900 border border-emerald-700 text-white rounded-lg font-mono focus:ring-2 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            {testResult && (
              <div className="bg-emerald-900/60 p-4 rounded-xl border border-emerald-800 space-y-2">
                <div className="text-xs text-emerald-300">Resolved Batch:</div>
                <div className="text-2xl font-black text-amber-300 font-mono">
                  Batch {testResult.batchNumber}
                </div>
                <div className="text-xs">
                  {testResult.isOverride ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Manual Override: {testResult.reason}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Standard Calculated Formula
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {overrideModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Academic Year Override</h3>
            <form onSubmit={handleAddOverride} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  SSC Passing Year
                </label>
                <input
                  type="number"
                  value={newOverride.passing_year}
                  onChange={e => setNewOverride({ ...newOverride, passing_year: parseInt(e.target.value) || 1971 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Assigned Batch Number
                </label>
                <input
                  type="number"
                  value={newOverride.batch_number}
                  onChange={e => setNewOverride({ ...newOverride, batch_number: parseInt(e.target.value) || 28 })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Reason / Historical Context
                </label>
                <input
                  type="text"
                  value={newOverride.reason}
                  onChange={e => setNewOverride({ ...newOverride, reason: e.target.value })}
                  placeholder="e.g., Liberation war combined batch"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
