import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Save,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { CMSPage, PageSection, PageSectionType } from '../../types';
import { apiFetch } from '../../utils/api';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
  onPreviewPage?: (slug: string) => void;
}

export const AdminPages: React.FC<Props> = ({ showToast, getHeaders, onPreviewPage }) => {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<CMSPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<CMSPage | null>(null);

  // Section editor modal
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = () => {
    apiFetch('/api/admin/pages', { headers: getHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setPages(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Pages load paused:', err);
        setLoading(false);
      });
  };

  const handleCreateNewPage = () => {
    const newP: CMSPage = {
      id: `page-${Date.now()}`,
      slug: `custom-page-${Date.now().toString().slice(-4)}`,
      title_en: 'New Custom Page',
      title_bn: 'নতুন পৃষ্ঠা',
      status: 'draft',
      sections: [
        {
          id: `sec-${Date.now()}`,
          type: 'hero',
          order: 1,
          is_active: true,
          title_en: 'Page Title',
          title_bn: 'পৃষ্ঠার শিরোনাম',
          subtitle_en: 'Brief introduction or tagline for this section',
          subtitle_bn: 'এই বিভাগের সংক্ষিপ্ত পরিচিতি',
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActivePage(newP);
    setIsEditing(true);
  };

  const handleSavePage = async () => {
    if (!activePage) return;
    try {
      const isNew = !pages.some(p => p.id === activePage.id);
      const url = isNew ? '/api/admin/pages' : `/api/admin/pages/${activePage.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(activePage),
      });

      if (!res.ok) throw new Error('Failed to save page');
      const saved = await res.json();
      showToast('Page saved successfully!');
      fetchPages();
      setActivePage(saved);
      setIsEditing(false);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleToggleStatus = async (page: CMSPage) => {
    try {
      const nextStatus = page.status === 'published' ? 'draft' : 'published';
      const res = await apiFetch(`/api/admin/pages/${page.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update page status');
      showToast(`Page is now ${nextStatus}.`);
      fetchPages();
    } catch (e: any) {
      showToast(e.message || 'Failed to update page status');
    }
  };

  const confirmDeletePage = async () => {
    if (!pageToDelete) return;
    try {
      const res = await apiFetch(`/api/admin/pages/${pageToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete page');
      showToast(`Page "${pageToDelete.title_en}" deleted successfully.`);
      fetchPages();
      if (activePage?.id === pageToDelete.id) {
        setActivePage(null);
        setIsEditing(false);
      }
      setPageToDelete(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to delete page');
    }
  };

  const addSection = (type: PageSectionType) => {
    if (!activePage) return;
    const newSec: PageSection = {
      id: `sec-${Date.now()}`,
      type,
      order: activePage.sections.length + 1,
      is_active: true,
      title_en: `New ${type.toUpperCase()} Section`,
      title_bn: `নতুন ${type} বিভাগ`,
      content_en: 'Section content in English...',
      content_bn: 'বাংলা বিষয়বস্তু...',
    };
    setActivePage({
      ...activePage,
      sections: [...activePage.sections, newSec],
    });
    setEditingSection(newSec);
    setSectionModalOpen(true);
  };

  const moveSection = (index: number, dir: 'up' | 'down') => {
    if (!activePage) return;
    const target = dir === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= activePage.sections.length) return;

    const secs = [...activePage.sections];
    const [moved] = secs.splice(index, 1);
    secs.splice(target, 0, moved);
    const updated = secs.map((s, idx) => ({ ...s, order: idx + 1 }));
    setActivePage({ ...activePage, sections: updated });
  };

  const saveEditingSection = (sec: PageSection) => {
    if (!activePage) return;
    const updated = activePage.sections.map(s => (s.id === sec.id ? sec : s));
    setActivePage({ ...activePage, sections: updated });
    setSectionModalOpen(false);
    setEditingSection(null);
  };

  const deleteSection = (secId: string) => {
    if (!activePage) return;
    const updated = activePage.sections.filter(s => s.id !== secId);
    setActivePage({ ...activePage, sections: updated });
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading pages...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            Page & Content Manager
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Build custom web pages using modular sections (Hero, Text, Gallery, Stats, Committee, FAQ, CTA).
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleCreateNewPage}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Page</span>
          </button>
        )}
      </div>

      {/* Main Container: List vs Builder */}
      {!isEditing ? (
        /* PAGE LIST VIEW */
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">All Pages ({pages.length})</span>
          </div>

          <div className="divide-y divide-slate-100">
            {pages.map(page => (
              <div key={page.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{page.title_en}</h4>
                    <span className="text-xs text-slate-400">/</span>
                    <span className="text-xs font-medium text-slate-600">{page.title_bn}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        page.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {page.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>Slug: /{page.slug}</span>
                    <span>•</span>
                    <span>{page.sections.length} Sections</span>
                    <span>•</span>
                    <span>Updated {new Date(page.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(page)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      page.status === 'published'
                        ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                    title={page.status === 'published' ? 'Click to make Draft' : 'Click to Publish'}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{page.status === 'published' ? 'Published' : 'Draft'}</span>
                  </button>
                  {onPreviewPage && (
                    <button
                      type="button"
                      onClick={() => onPreviewPage(page.slug)}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
                      title="Preview Page"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage({ ...page });
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Sections</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageToDelete(page)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                    title="Delete Page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* SECTION BUILDER & PAGE EDITOR VIEW */
        activePage && (
          <div className="space-y-6">
            {/* Page Metadata Header */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-emerald-800 uppercase">Page Header & Slug</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setActivePage(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Back to Pages
                  </button>
                  <button
                    onClick={handleSavePage}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Page</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Page Title (English)
                  </label>
                  <input
                    type="text"
                    value={activePage.title_en}
                    onChange={e => setActivePage({ ...activePage, title_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Page Title (Bengali)
                  </label>
                  <input
                    type="text"
                    value={activePage.title_bn}
                    onChange={e => setActivePage({ ...activePage, title_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={activePage.slug}
                    onChange={e => setActivePage({ ...activePage, slug: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="block text-xs font-bold text-slate-700 uppercase">Status:</label>
                <div className="flex gap-3">
                  {(['draft', 'published', 'scheduled'] as const).map(st => (
                    <label key={st} className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="page_status"
                        checked={activePage.status === st}
                        onChange={() => setActivePage({ ...activePage, status: st })}
                        className="text-emerald-700"
                      />
                      <span className="capitalize">{st}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Structured Section Builder */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Page Sections ({activePage.sections.length})</h3>
                  <p className="text-xs text-slate-500">Each block renders responsive bilingual content on the frontend.</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 mr-1">Add Block:</span>
                  {(['hero', 'text', 'stats', 'gallery', 'committee', 'faq', 'cta'] as PageSectionType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addSection(type)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 text-xs font-bold rounded-md transition uppercase tracking-wider cursor-pointer"
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {activePage.sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, 'up')}
                          className="p-1 hover:bg-slate-200 text-slate-400 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === activePage.sections.length - 1}
                          onClick={() => moveSection(idx, 'down')}
                          className="p-1 hover:bg-slate-200 text-slate-400 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-[10px] font-bold uppercase tracking-wider">
                            {sec.type}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{sec.title_en || 'Untitled Section'}</span>
                          <span className="text-xs text-slate-500 font-medium">({sec.title_bn})</span>
                        </div>
                        {sec.content_en && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{sec.content_en}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingSection({ ...sec });
                          setSectionModalOpen(true);
                        }}
                        className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-100/50 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSection(sec.id)}
                        className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-100/50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {activePage.sections.length === 0 && (
                  <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                    No sections added to this page yet. Click one of the buttons above to add a Hero, Text, Stats, or Gallery section.
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Section Editor Modal */}
      {sectionModalOpen && editingSection && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-800 text-white rounded text-xs">
                  {editingSection.type}
                </span>
                Edit Section
              </h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Section Title (English)
                  </label>
                  <input
                    type="text"
                    value={editingSection.title_en || ''}
                    onChange={e => setEditingSection({ ...editingSection, title_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Section Title (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingSection.title_bn || ''}
                    onChange={e => setEditingSection({ ...editingSection, title_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Subtitle (English)
                  </label>
                  <input
                    type="text"
                    value={editingSection.subtitle_en || ''}
                    onChange={e => setEditingSection({ ...editingSection, subtitle_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Subtitle (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingSection.subtitle_bn || ''}
                    onChange={e => setEditingSection({ ...editingSection, subtitle_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Content Body (English)
                </label>
                <textarea
                  rows={4}
                  value={editingSection.content_en || ''}
                  onChange={e => setEditingSection({ ...editingSection, content_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Content Body (Bengali)
                </label>
                <textarea
                  rows={4}
                  value={editingSection.content_bn || ''}
                  onChange={e => setEditingSection({ ...editingSection, content_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Image or Banner URL
                </label>
                <input
                  type="text"
                  value={editingSection.image_url || ''}
                  onChange={e => setEditingSection({ ...editingSection, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              {(editingSection.type === 'cta' || editingSection.type === 'hero') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Button Text (EN)
                    </label>
                    <input
                      type="text"
                      value={editingSection.button_text_en || ''}
                      onChange={e => setEditingSection({ ...editingSection, button_text_en: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Button Text (BN)
                    </label>
                    <input
                      type="text"
                      value={editingSection.button_text_bn || ''}
                      onChange={e => setEditingSection({ ...editingSection, button_text_bn: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Button Target Link
                    </label>
                    <input
                      type="text"
                      value={editingSection.button_url || ''}
                      onChange={e => setEditingSection({ ...editingSection, button_url: e.target.value })}
                      placeholder="#register or /school"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSectionModalOpen(false);
                  setEditingSection(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEditingSection(editingSection)}
                className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Page Delete Confirmation Modal */}
      {pageToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete CMS Page</h3>
                <p className="text-xs text-slate-500">This action will delete the page and all its sections.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900">"{pageToDelete.title_en}"</span> (/{pageToDelete.slug})? This will also remove it from the Supabase database.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPageToDelete(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePage}
                className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Page</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
