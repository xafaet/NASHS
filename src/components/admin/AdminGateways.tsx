import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Edit2, ShieldAlert, Key, CheckCircle2, XCircle, Copy, Check, Info } from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Copied ${text} to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
      payment_mode: gw.payment_mode || (gw.app_key || gw.credentials?.app_key ? 'automatic' : 'manual'),
      account_type: gw.account_type || 'Merchant',
      merchant_id: gw.merchant_id || gw.credentials?.merchant_id || gw.credentials?.merchant_number || '',
      merchant_number: gw.merchant_number || gw.credentials?.merchant_number || gw.credentials?.merchant_id || gw.merchant_id || '',
      username: gw.username || gw.credentials?.username || '',
      password: gw.password || gw.credentials?.password || '',
      base_url: gw.base_url || gw.credentials?.base_url || '',
      credentials: {
        merchant_number: gw.credentials?.merchant_number || gw.credentials?.merchant_id || gw.merchant_id || '',
        merchant_id: gw.credentials?.merchant_id || gw.merchant_id || '',
        app_key: gw.credentials?.app_key || gw.api_key || gw.store_id || '',
        app_secret: gw.credentials?.app_secret || gw.secret_key || '',
        store_id: gw.credentials?.store_id || gw.store_id || '',
        username: gw.credentials?.username || gw.username || '',
        password: gw.credentials?.password || gw.password || '',
        base_url: gw.credentials?.base_url || gw.base_url || '',
        ...(gw.credentials || {}),
      },
    });
    setModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingGateway({
      id: `gw-${Date.now()}`,
      name: 'bKash Payment Gateway',
      code: 'bkash',
      display_name_en: 'bKash Payment',
      display_name_bn: 'বিকাশ পেমেন্ট',
      is_enabled: true,
      is_test_mode: false,
      payment_mode: 'manual',
      account_type: 'Merchant',
      currency: 'BDT',
      transaction_prefix: 'BK',
      sort_order: gateways.length + 1,
      merchant_id: '01819123456',
      merchant_number: '01819123456',
      username: '',
      password: '',
      base_url: 'https://tokenized.pay.bka.sh/v1.2.0-beta',
      credentials: {
        app_key: '',
        app_secret: '',
        merchant_number: '01819123456',
        merchant_id: '01819123456',
        username: '',
        password: '',
        base_url: 'https://tokenized.pay.bka.sh/v1.2.0-beta',
      },
      instructions_en: 'Send registration fee to our official bKash Merchant account and enter the Transaction ID.',
      instructions_bn: 'আমাদের অফিসিয়াল বিকাশ মার্চেন্ট নম্বরে ফি পাঠিয়ে ট্রানজেকশন আইডি (TrxID) প্রদান করুন।',
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
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  gw.payment_mode === 'automatic'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {gw.payment_mode === 'automatic' ? 'Automatic API Checkout' : `Manual Payment (${gw.account_type || 'Merchant'})`}
                </span>
              </div>
              <p className="line-clamp-2">{gw.instructions_en}</p>
              <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-700 flex items-center justify-between">
                <span>{gw.account_type || 'Merchant'} Account:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    {getMerchantDisplay(gw)}
                  </span>
                  {getMerchantDisplay(gw) !== 'Configured' && (
                    <button
                      type="button"
                      onClick={() => handleCopy(getMerchantDisplay(gw), gw.id)}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-emerald-700 cursor-pointer transition"
                      title="Copy Number"
                    >
                      {copiedId === gw.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gateway Edit Modal */}
      {modalOpen && editingGateway && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-700" />
              Configure {editingGateway.name || 'Payment Gateway'}
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

              {/* Mode Toggle: Manual vs Automatic Payment */}
              <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Payment Integration Mode</span>
                  <span className="text-[11px] text-slate-500">
                    {editingGateway.payment_mode === 'automatic'
                      ? 'Automated API checkout gateway flow'
                      : 'Manual payment with account number & TrxID verification'}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEditingGateway({ ...editingGateway, payment_mode: 'manual' })}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                      editingGateway.payment_mode !== 'automatic'
                        ? 'bg-[#0f4d2a] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Manual Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGateway({ ...editingGateway, payment_mode: 'automatic' })}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
                      editingGateway.payment_mode === 'automatic'
                        ? 'bg-[#0f4d2a] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Automatic Payment
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGateway.is_enabled}
                    onChange={e => setEditingGateway({ ...editingGateway, is_enabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-sm"
                  />
                  Enable Gateway for Alumni
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-amber-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGateway.is_test_mode}
                    onChange={e => setEditingGateway({ ...editingGateway, is_test_mode: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded-sm"
                  />
                  Sandbox / Test Mode
                </label>
              </div>

              {/* Conditional Configuration based on Mode */}
              {editingGateway.payment_mode === 'automatic' ? (
                /* AUTOMATIC PAYMENT MODE FIELDS */
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-600" />
                      Automatic API Gateway Credentials
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                      API Mode
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        API App Key / Store ID *
                      </label>
                      <input
                        type="text"
                        value={
                          editingGateway.credentials?.app_key ||
                          editingGateway.credentials?.store_id ||
                          editingGateway.app_key ||
                          editingGateway.api_key ||
                          editingGateway.store_id ||
                          ''
                        }
                        onChange={e => {
                          const val = e.target.value;
                          setEditingGateway({
                            ...editingGateway,
                            app_key: val,
                            api_key: val,
                            store_id: val,
                            credentials: {
                              ...(editingGateway.credentials || {}),
                              app_key: val,
                              store_id: val,
                            },
                          });
                        }}
                        placeholder="e.g. c8x7k9p1q..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        API Secret / PassKey *
                      </label>
                      <input
                        type="password"
                        value={
                          editingGateway.credentials?.app_secret ||
                          editingGateway.credentials?.store_passwd ||
                          editingGateway.app_secret ||
                          editingGateway.secret_key ||
                          ''
                        }
                        onChange={e => {
                          const val = e.target.value;
                          setEditingGateway({
                            ...editingGateway,
                            app_secret: val,
                            secret_key: val,
                            credentials: {
                              ...(editingGateway.credentials || {}),
                              app_secret: val,
                              store_passwd: val,
                            },
                          });
                        }}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        API Username (Optional)
                      </label>
                      <input
                        type="text"
                        value={editingGateway.username || editingGateway.credentials?.username || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEditingGateway({
                            ...editingGateway,
                            username: val,
                            credentials: { ...(editingGateway.credentials || {}), username: val },
                          });
                        }}
                        placeholder="e.g. merchant_user"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        API Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={editingGateway.password || editingGateway.credentials?.password || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEditingGateway({
                            ...editingGateway,
                            password: val,
                            credentials: { ...(editingGateway.credentials || {}), password: val },
                          });
                        }}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={editingGateway.base_url || editingGateway.credentials?.base_url || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setEditingGateway({
                          ...editingGateway,
                          base_url: val,
                          credentials: { ...(editingGateway.credentials || {}), base_url: val },
                        });
                      }}
                      placeholder="https://tokenized.pay.bka.sh/v1.2.0-beta"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-white"
                    />
                  </div>
                </div>
              ) : (
                /* MANUAL PAYMENT MODE FIELDS */
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                      Manual Payment Details
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      Manual Mode
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Account / Mobile Number *
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          value={
                            editingGateway.merchant_number ||
                            editingGateway.merchant_id ||
                            editingGateway.credentials?.merchant_number ||
                            editingGateway.credentials?.merchant_id ||
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
                          placeholder="01819xxxxxx"
                          className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono font-bold bg-white"
                        />
                        {editingGateway.merchant_number && (
                          <button
                            type="button"
                            onClick={() => handleCopy(editingGateway.merchant_number || '', 'test-copy')}
                            className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
                            title="Test Copy Number"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Account Type *
                      </label>
                      <select
                        value={editingGateway.account_type || 'Merchant'}
                        onChange={e => setEditingGateway({
                          ...editingGateway,
                          account_type: e.target.value as any,
                        })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                      >
                        <option value="Merchant">Merchant (মার্চেন্ট - Make Payment)</option>
                        <option value="Personal">Personal (ব্যক্তিগত - Send Money)</option>
                        <option value="Agent">Agent (এজেন্ট - Cash Out)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-white/70 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                    <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      In <strong>Manual Payment</strong> mode, alumni will see this account number with a one-click copy button. After completing the payment in their mobile app, they submit their Transaction ID (TrxID) for verification.
                    </span>
                  </div>
                </div>
              )}

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
