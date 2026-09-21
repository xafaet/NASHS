import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Search,
  Check,
  X,
  Sparkles,
  Calendar,
  User,
  Tag,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { NewsPost } from '../../types';

export const AdminNews: React.FC = () => {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Partial<NewsPost> | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/news');
      if (res.ok) {
        const data = await res.json();
        setPosts(data || []);
      }
    } catch (err) {
      console.error('Failed to load admin news posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleOpenAdd = () => {
    setEditingPost({
      title_en: '',
      title_bn: '',
      excerpt_en: '',
      excerpt_bn: '',
      content_en: '',
      content_bn: '',
      category: 'Reunion Updates',
      author: 'Alumni Media Cell',
      status: 'published',
      is_featured: false,
      featured_image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      publish_date: new Date().toISOString().split('T')[0],
      slug: '',
    });
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (post: NewsPost) => {
    setEditingPost({ ...post });
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete article "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/news/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
      } else {
        alert('Failed to delete post.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const handleToggleStatus = async (post: NewsPost) => {
    const nextStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const res = await fetch(`/api/admin/news/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => (p.id === post.id ? updated : p)));
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost?.title_en && !editingPost?.title_bn) {
      setErrorMessage('Please provide a title in at least English or Bengali.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const isNew = !editingPost.id;
      const url = isNew ? '/api/admin/news' : `/api/admin/news/${editingPost.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPost),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) {
          setPosts(prev => [saved, ...prev]);
        } else {
          setPosts(prev => prev.map(p => (p.id === saved.id ? saved : p)));
        }
        setModalOpen(false);
        setEditingPost(null);
      } else {
        const errData = await res.json();
        setErrorMessage(errData.message || 'Failed to save news article.');
      }
    } catch (err) {
      console.error('Error saving post:', err);
      setErrorMessage('Network error while saving news article.');
    } finally {
      setSaving(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (statusFilter !== 'all' && post.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = post.title_en?.toLowerCase().includes(q) || post.title_bn?.toLowerCase().includes(q);
      const matchCategory = post.category?.toLowerCase().includes(q);
      const matchAuthor = post.author?.toLowerCase().includes(q);
      return matchTitle || matchCategory || matchAuthor;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-emerald-700" />
            <h2 className="text-xl font-bold text-slate-900">News & Updates CMS</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Database-backed publishing system for 85th reunion press releases, event announcements, and articles.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0f4d2a] hover:bg-[#135d34] text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Write New Article</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {(['all', 'published', 'draft'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st} ({posts.filter(p => (st === 'all' ? true : p.status === st)).length})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search news titles or authors..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Posts Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading articles from database...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Newspaper className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No articles found</p>
            <p className="text-xs text-slate-400">Click "Write New Article" to publish your first announcement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3.5 px-4">Article</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Author</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPosts.map(post => (
                  <tr key={post.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="flex items-center gap-3">
                        {post.featured_image && (
                          <img
                            src={post.featured_image}
                            alt=""
                            className="w-12 h-10 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                          />
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {post.is_featured && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] uppercase">
                                Featured
                              </span>
                            )}
                            <p className="font-bold text-slate-900 truncate">
                              {post.title_en || post.title_bn}
                            </p>
                          </div>
                          {post.title_bn && post.title_en && (
                            <p className="text-[11px] text-slate-400 truncate">
                              {post.title_bn}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 font-semibold text-slate-700">
                        {post.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {post.author || 'NASH Media'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {post.publish_date ? new Date(post.publish_date).toLocaleDateString() : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(post)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition ${
                          post.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        {post.status === 'published' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span>{post.status}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(post)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Edit Article"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(post.id, post.title_en || post.title_bn)}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Delete Article"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Article Create / Edit Modal */}
      {modalOpen && editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200">
            <div className="p-6 bg-gradient-to-r from-[#0f4d2a] to-[#135d34] text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <Newspaper className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">
                  {editingPost.id ? 'Edit News Article' : 'Write New Article'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
              {errorMessage && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-center gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Title Bilingual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Title (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPost.title_en || ''}
                    onChange={e => setEditingPost({ ...editingPost, title_en: e.target.value })}
                    placeholder="e.g. 85th Anniversary Grand Reunion Schedule Released"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Title (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingPost.title_bn || ''}
                    onChange={e => setEditingPost({ ...editingPost, title_bn: e.target.value })}
                    placeholder="যেমন: ৮৫ বছর পূর্তি পুনর্মিলনীর মূল কর্মসূচি ঘোষণা"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Excerpt Bilingual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Short Excerpt (English)
                  </label>
                  <textarea
                    rows={2}
                    value={editingPost.excerpt_en || ''}
                    onChange={e => setEditingPost({ ...editingPost, excerpt_en: e.target.value })}
                    placeholder="A brief 1-2 sentence lead summary of the announcement..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Short Excerpt (Bengali)
                  </label>
                  <textarea
                    rows={2}
                    value={editingPost.excerpt_bn || ''}
                    onChange={e => setEditingPost({ ...editingPost, excerpt_bn: e.target.value })}
                    placeholder="সংক্ষিপ্ত সারসংক্ষেপ (১-২ বাক্য)..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Full Content (English) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Content (English) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={editingPost.content_en || ''}
                  onChange={e => setEditingPost({ ...editingPost, content_en: e.target.value })}
                  placeholder="Enter complete news details, schedule timings, venue instructions..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none font-sans"
                />
              </div>

              {/* Full Content (Bengali) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Content (Bengali)
                </label>
                <textarea
                  rows={5}
                  value={editingPost.content_bn || ''}
                  onChange={e => setEditingPost({ ...editingPost, content_bn: e.target.value })}
                  placeholder="সম্পূর্ণ সংবাদ প্রতিবেদন বা নোটিশের বিস্তারিত বিবরণ..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none font-sans"
                />
              </div>

              {/* Category, Author, Publish Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={editingPost.category || 'Reunion Updates'}
                    onChange={e => setEditingPost({ ...editingPost, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                  >
                    <option value="Reunion Updates">Reunion Updates</option>
                    <option value="Announcements">Announcements</option>
                    <option value="School Heritage">School Heritage</option>
                    <option value="Executive Committee">Executive Committee</option>
                    <option value="Press Releases">Press Releases</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Author / Department
                  </label>
                  <input
                    type="text"
                    value={editingPost.author || ''}
                    onChange={e => setEditingPost({ ...editingPost, author: e.target.value })}
                    placeholder="e.g. Media Wing, NASH"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Publication Date
                  </label>
                  <input
                    type="date"
                    value={editingPost.publish_date || ''}
                    onChange={e => setEditingPost({ ...editingPost, publish_date: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              {/* Featured Image & Custom Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Featured Image URL
                  </label>
                  <input
                    type="text"
                    value={editingPost.featured_image || ''}
                    onChange={e => setEditingPost({ ...editingPost, featured_image: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Slug (Optional URL key)
                  </label>
                  <input
                    type="text"
                    value={editingPost.slug || ''}
                    onChange={e => setEditingPost({ ...editingPost, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="e.g. 85th-reunion-announcement"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              {/* Status & Featured Toggles */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="published"
                      checked={editingPost.status === 'published'}
                      onChange={() => setEditingPost({ ...editingPost, status: 'published' })}
                      className="text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="text-xs font-bold text-emerald-900">Publish Immediately</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={editingPost.status === 'draft'}
                      onChange={() => setEditingPost({ ...editingPost, status: 'draft' })}
                      className="text-amber-700 focus:ring-amber-600"
                    />
                    <span className="text-xs font-bold text-amber-900">Save as Draft</span>
                  </label>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingPost.is_featured}
                    onChange={e => setEditingPost({ ...editingPost, is_featured: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Feature as Hero / Headline Story
                  </span>
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#0f4d2a] hover:bg-[#135d34] text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingPost.id ? 'Update Article' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
