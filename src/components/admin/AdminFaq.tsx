import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Trash2, Edit2, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { FAQItem } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminFaq: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = () => {
    apiFetch('/api/admin/faqs', { headers: getHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setFaqs(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('FAQs load paused:', err);
        setLoading(false);
      });
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;
    try {
      const isNew = !faqs.some(f => f.id === editingFaq.id);
      const url = isNew ? '/api/admin/faqs' : `/api/admin/faqs/${editingFaq.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(editingFaq),
      });

      if (!res.ok) throw new Error('Failed to save FAQ');
      showToast('FAQ item saved successfully!');
      fetchFaqs();
      setModalOpen(false);
      setEditingFaq(null);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    try {
      const res = await fetch(`/api/admin/faqs/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete FAQ');
      showToast('FAQ deleted.');
      fetchFaqs();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const categories = Array.from(new Set(faqs.map(f => f.category || 'General')));

  const filteredFaqs = selectedCategory === 'all' ? faqs : faqs.filter(f => f.category === selectedCategory);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading FAQs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-700" />
            Frequently Asked Questions (FAQ)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage categorized bilingual questions and answers displayed across the portal.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingFaq({
              id: `faq-${Date.now()}`,
              question_en: '',
              question_bn: '',
              answer_en: '',
              answer_bn: '',
              category: 'General',
              order: faqs.length + 1,
              is_active: true,
            });
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New FAQ</span>
        </button>
      </div>

      {/* Categories Bar */}
      <div className="flex gap-2 border-b border-slate-200 bg-white px-6 pt-3 rounded-t-2xl overflow-x-auto">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 border-b-2 text-xs font-bold cursor-pointer transition ${
            selectedCategory === 'all'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Questions ({faqs.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 border-b-2 text-xs font-bold cursor-pointer transition ${
              selectedCategory === cat
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {cat} ({faqs.filter(f => f.category === cat).length})
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="bg-white rounded-b-2xl rounded-tr-none shadow-xs border border-t-0 border-slate-200 divide-y divide-slate-100">
        {filteredFaqs.map(faq => (
          <div key={faq.id} className="p-5 flex items-start justify-between hover:bg-slate-50 transition gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">
                  {faq.category}
                </span>
                <span className="font-bold text-slate-900 text-sm">{faq.question_en}</span>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs text-slate-600 font-medium">{faq.question_bn}</span>
                {!faq.is_active && (
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-bold">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{faq.answer_en}</p>
              <p className="text-xs text-slate-500 line-clamp-2 italic">{faq.answer_bn}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setEditingFaq({ ...faq });
                  setModalOpen(true);
                }}
                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteFaq(faq.id)}
                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredFaqs.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            No FAQs found in this category.
          </div>
        )}
      </div>

      {/* FAQ Modal */}
      {modalOpen && editingFaq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {faqs.some(f => f.id === editingFaq.id) ? 'Edit FAQ Item' : 'New FAQ Item'}
            </h3>

            <form onSubmit={handleSaveFaq} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={editingFaq.category}
                    onChange={e => setEditingFaq({ ...editingFaq, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    placeholder="Registration, Payment, Schedule..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingFaq.order}
                    onChange={e => setEditingFaq({ ...editingFaq, order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Question (English)
                </label>
                <input
                  type="text"
                  value={editingFaq.question_en}
                  onChange={e => setEditingFaq({ ...editingFaq, question_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Question (Bengali)
                </label>
                <input
                  type="text"
                  value={editingFaq.question_bn}
                  onChange={e => setEditingFaq({ ...editingFaq, question_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Answer (English)
                </label>
                <textarea
                  rows={3}
                  value={editingFaq.answer_en}
                  onChange={e => setEditingFaq({ ...editingFaq, answer_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Answer (Bengali)
                </label>
                <textarea
                  rows={3}
                  value={editingFaq.answer_bn}
                  onChange={e => setEditingFaq({ ...editingFaq, answer_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="faq_is_active"
                  checked={editingFaq.is_active}
                  onChange={e => setEditingFaq({ ...editingFaq, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                <label htmlFor="faq_is_active" className="text-xs font-semibold text-slate-700">
                  Visible to Public Users
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingFaq(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Save FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
