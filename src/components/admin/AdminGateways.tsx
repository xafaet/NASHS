import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Edit2, ShieldAlert, Key, CheckCircle2, XCircle } from 'lucide-react';
import { PaymentGatewayConfig } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminGateways: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGateway, setEditingGateway] = useState<PaymentGatewayConfig | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = () => {
    apiFetch('/api/admin/payment-gateways', { headers: getHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setGateways(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Gateways load paused:', err);
        setLoading(false);
      });
  };

  const getMerchantDisplay = (gw: PaymentGatewayConfig) => {
    return (
      gw.credentials?.merchant_number ||
      gw.credentials?.merchant_id ||
      gw.merchant_id ||
      gw.merchant_number ||
      gw.store_id ||
      'Configured'
    );
  };

  const handleOpenEdit = (gw: PaymentGatewayConfig) => {
    setEditingGateway({
      ...gw,
      merchant_id: gw.merchant_id || gw.credentials?.merchant_id || gw.credentials?.merchant_number || '',
      credentials: {
        merchant_number: gw.credentials?.merchant_number || gw.credentials?.merchant_id || gw.merchant_id || '',
        merchant_id: gw.credentials?.merchant_id || gw.merchant_id || '',
        app_key: gw.credentials?.app_key || gw.api_key || gw.store_id || '',
        app_secret: gw.credentials?.app_secret || gw.secret_key || '',
        store_id: gw.credentials?.store_id || gw.store_id || '',
        ...(gw.credentials || {}),
      },
    });
    setModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingGateway({
      id: `gw-${Date.now()}`,
      name: 'bKash Merchant',
      code: 'bkash',
      display_name_en: 'bKash Payment',
      display_name_bn: 'বিকাশ পেমেন্ট',
      is_enabled: true,
      is_test_mode: true,
      currency: 'BDT',
      transaction_prefix: 'BK',
      sort_order: gateways.length + 1,
      merchant_id: '01819123456',
      credentials: {
        app_key: '',
        app_secret: '',
        merchant_number: '01819123456',
        merchant_id: '01819123456',
      },
      instructions_en: 'Make payment through the secure bKash checkout gateway.',
      instructions_bn: 'বিকাশ গেটওয়ের মাধ্যমে নিরাপদে পেমেন্ট সম্পন্ন করুন।',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGateway) return;
    try {
      const isNew = !gateways.some(g => g.id === editingGateway.id);
      const url = isNew ? '/api/admin/payment-gateways' : `/api/admin/payment-gateways/${editingGateway.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(editingGateway),
      });

      if (!res.ok) throw new Error('Failed to save gateway config');
      showToast('Payment gateway configuration saved!');
      fetchGateways();
      setModalOpen(false);
      setEditingGateway(null);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment gateway?')) return;
    try {
      const res = await fetch(`/api/admin/payment-gateways/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete gateway');
      showToast('Gateway removed.');
      fetchGateways();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading payment gateways...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-700" />
            Payment Gateway Abstraction Layer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure active payment processors (bKash, Nagad, Rocket, SSLCommerz), API credentials, and test modes via adapter architecture.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Payment Gateway</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gateways.map(gw => (
          <div
            key={gw.id}
            className={`p-6 bg-white rounded-2xl shadow-xs border transition ${
              gw.is_enabled ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">{gw.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono uppercase">
                    {gw.code}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {gw.is_enabled ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                      <XCircle className="w-3.5 h-3.5" /> Disabled
                    </span>
                  )}
                  <span>•</span>
                  {gw.is_test_mode ? (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      Sandbox / Test Mode
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Live Production
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(gw)}
                  className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(gw.id)}
                  className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <p className="line-clamp-2">{gw.instructions_en}</p>
              <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-700 flex items-center justify-between">
                <span>Merchant / Account:</span>
                <span className="font-bold text-slate-900">
                  {getMerchantDisplay(gw)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gateway Edit Modal */}
      {modalOpen && editingGateway && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-700" />
              Configure Payment Gateway Adapter
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Gateway Display Name
                  </label>
                  <input
                    type="text"
                    value={editingGateway.name}
                    onChange={e => setEditingGateway({ ...editingGateway, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Adapter Identifier (Code)
                  </label>
                  <select
                    value={editingGateway.code}
                    onChange={e => setEditingGateway({ ...editingGateway, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="bkash">bKash (bkash)</option>
                    <option value="nagad">Nagad (nagad)</option>
                    <option value="rocket">Rocket (rocket)</option>
                    <option value="sslcommerz">SSLCommerz (sslcommerz)</option>
                    <option value="card">Credit/Debit Card (card)</option>
                    <option value="manual">Manual Bank Transfer (manual)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingGateway.is_enabled}
                    onChange={e => setEditingGateway({ ...editingGateway, is_enabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  Enable Gateway for Alumni
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-amber-700">
                  <input
                    type="checkbox"
                    checked={editingGateway.is_test_mode}
                    onChange={e => setEditingGateway({ ...editingGateway, is_test_mode: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded-sm"
                  />
                  Sandbox / Test Mode
                </label>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase">Gateway Credentials</span>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Merchant / Account Number
                  </label>
                  <input
                    type="text"
                    value={
                      editingGateway.credentials?.merchant_number ||
                      editingGateway.credentials?.merchant_id ||
                      editingGateway.merchant_id ||
                      editingGateway.merchant_number ||
                      ''
                    }
                    onChange={e => {
                      const val = e.target.value;
                      setEditingGateway({
                        ...editingGateway,
                        merchant_id: val,
                        merchant_number: val,
                        credentials: {
                          ...(editingGateway.credentials || {}),
                          merchant_number: val,
                          merchant_id: val,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    API App Key / Store ID
                  </label>
                  <input
                    type="text"
                    value={
                      editingGateway.credentials?.app_key ||
                      editingGateway.credentials?.store_id ||
                      editingGateway.api_key ||
                      editingGateway.store_id ||
                      ''
                    }
                    onChange={e => {
                      const val = e.target.value;
                      setEditingGateway({
                        ...editingGateway,
                        api_key: val,
                        store_id: val,
                        credentials: {
                          ...(editingGateway.credentials || {}),
                          app_key: val,
                          store_id: val,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    API Secret / PassKey
                  </label>
                  <input
                    type="password"
                    value={
                      editingGateway.credentials?.app_secret ||
                      editingGateway.credentials?.store_passwd ||
                      editingGateway.secret_key ||
                      ''
                    }
                    onChange={e => {
                      const val = e.target.value;
                      setEditingGateway({
                        ...editingGateway,
                        secret_key: val,
                        credentials: {
                          ...(editingGateway.credentials || {}),
                          app_secret: val,
                          store_passwd: val,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Checkout Instructions (English)
                </label>
                <textarea
                  rows={2}
                  value={editingGateway.instructions_en || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, instructions_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Checkout Instructions (Bengali)
                </label>
                <textarea
                  rows={2}
                  value={editingGateway.instructions_bn || ''}
                  onChange={e => setEditingGateway({ ...editingGateway, instructions_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingGateway(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save Gateway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
