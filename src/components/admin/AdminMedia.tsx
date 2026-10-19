import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  Eye,
  X,
  UserCheck,
  FileImage,
  AlertCircle,
  Tag,
  Calendar,
  HardDrive,
  Filter,
} from 'lucide-react';
import { MediaItem } from '../../types';
import { apiFetch } from '../../utils/api';

interface AdminMediaProps {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminMedia: React.FC<AdminMediaProps> = ({ showToast, getHeaders }) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'registration' | 'admin_upload'>('all');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // New Media Form state
  const [uploadName, setUploadName] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Replace Form state
  const [replacePreview, setReplacePreview] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/media', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMedia(data);
      } else {
        showToast('Failed to load media library.');
      }
    } catch (err: any) {
      console.warn('Media fetch error:', err);
      showToast('Network error while loading media items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleCopyLink = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    showToast('Public media URL copied to clipboard!');
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleFileUploadSelect = (e: React.ChangeEvent<HTMLInputElement>, isReplace = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds maximum limit of 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (isReplace) {
        setReplacePreview(result);
      } else {
        setUploadPreview(result);
        if (!uploadName) {
          setUploadName(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadPreview) {
      showToast('Please select an image file to upload.');
      return;
    }

    setUploading(true);
    try {
      const res = await apiFetch('/api/admin/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({
          name: uploadName || 'Uploaded Media',
          data: uploadPreview,
          source: 'admin_upload',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      showToast('Image successfully uploaded and added to Media Library!');
      setUploadModalOpen(false);
      setUploadName('');
      setUploadPreview(null);
      await fetchMedia();
    } catch (err: any) {
      showToast(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !replacePreview) {
      showToast('Please select a replacement image.');
      return;
    }

    setReplacing(true);
    try {
      const res = await apiFetch(`/api/admin/media/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({
          data: replacePreview,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Replacement failed');
      }

      showToast('Media image file replaced successfully!');
      setReplaceModalOpen(false);
      setReplacePreview(null);
      if (previewModalOpen) setPreviewModalOpen(false);
      await fetchMedia();
    } catch (err: any) {
      showToast(err.message || 'Replace failed.');
    } finally {
      setReplacing(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!selectedItem) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/media/${selectedItem.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Deletion failed');
      }

      showToast('Media item deleted from server storage and database.');
      setDeleteModalOpen(false);
      setSelectedItem(null);
      if (previewModalOpen) setPreviewModalOpen(false);
      await fetchMedia();
    } catch (err: any) {
      showToast(err.message || 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  // Filter and search
  const filteredMedia = media.filter(item => {
    const matchesSource =
      filterSource === 'all' ||
      (filterSource === 'registration' && item.source === 'registration') ||
      (filterSource === 'admin_upload' && item.source !== 'registration');

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.attendee_name && item.attendee_name.toLowerCase().includes(q)) ||
      (item.token_code && item.token_code.toLowerCase().includes(q)) ||
      (item.registration_id && item.registration_id.toLowerCase().includes(q)) ||
      (item.filename && item.filename.toLowerCase().includes(q));

    return matchesSource && matchesSearch;
  });

  const registrationCount = media.filter(m => m.source === 'registration').length;
  const assetCount = media.length - registrationCount;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Media Library & Photo Assets
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centrally manage registration portrait photos, anniversary event banners, logos, and public media files.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMedia}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition cursor-pointer"
            title="Refresh Media Library"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setUploadName('');
              setUploadPreview(null);
              setUploadModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <FileImage className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
            <span className="text-lg font-bold text-slate-900">{media.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Registration Photos</span>
            <span className="text-lg font-bold text-blue-700">{registrationCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Custom Assets</span>
            <span className="text-lg font-bold text-amber-700">{assetCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center font-bold">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Persistent Storage</span>
            <span className="text-xs font-bold text-emerald-700 font-mono">public/uploads/</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterSource('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterSource === 'all'
                ? 'bg-[#0f4d2a] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Media ({media.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource('registration')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterSource === 'registration'
                ? 'bg-[#0f4d2a] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Registrations ({registrationCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSource('admin_upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterSource === 'admin_upload'
                ? 'bg-[#0f4d2a] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Admin Assets ({assetCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, token, ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-emerald-600"
          />
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          <p className="text-xs font-medium">Loading Media Library items from database...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No media items found</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || filterSource !== 'all'
              ? 'Try modifying your filter or search query.'
              : 'Uploaded registration portrait photos and custom media assets will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map(item => {
            const isReg = item.source === 'registration';
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between group relative"
              >
                {/* Image Container */}
                <div
                  onClick={() => {
                    setSelectedItem(item);
                    setPreviewModalOpen(true);
                  }}
                  className="h-36 bg-slate-100 overflow-hidden relative cursor-pointer flex items-center justify-center group-hover:opacity-95 transition"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Badge */}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase shadow-xs ${
                      isReg ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-white backdrop-blur-xs'
                    }`}
                  >
                    {isReg ? 'Alumni Photo' : 'Upload'}
                  </span>

                  {/* Hover Overlay Icon */}
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <span className="p-1.5 bg-white text-slate-800 rounded-full shadow">
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-2.5 space-y-1 text-xs">
                  <div className="font-semibold text-slate-800 truncate" title={item.name}>
                    {item.attendee_name || item.name}
                  </div>

                  {item.token_code && (
                    <div className="font-mono text-[10px] text-emerald-700 font-bold truncate">
                      {item.token_code}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>{item.size || '1.0 MB'}</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="px-2.5 pb-2.5 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(item.url)}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                    title="Copy Public URL"
                  >
                    {copiedUrl === item.url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <a
                    href={`/api/admin/media/${item.id}/download`}
                    download={item.filename || 'media.jpg'}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                    title="Download Image"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setReplacePreview(null);
                      setReplaceModalOpen(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                    title="Replace Image File"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item);
                      setDeleteModalOpen(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                    title="Delete Media Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Media Item Details</h3>
                <span className="text-xs text-slate-500">{selectedItem.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-100 rounded-xl p-2 flex items-center justify-center max-h-72 overflow-hidden border border-slate-200">
                <img
                  src={selectedItem.url}
                  alt={selectedItem.name}
                  className="max-h-64 object-contain rounded-lg shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Source</span>
                  <span className="font-semibold text-slate-800">
                    {selectedItem.source === 'registration' ? 'Alumni Registration Portrait' : 'Admin Custom Asset'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">File Size</span>
                  <span className="font-semibold text-slate-800">{selectedItem.size || '1.0 MB'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Type / Format</span>
                  <span className="font-semibold text-slate-800">{selectedItem.type || 'image/jpeg'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Uploaded Date</span>
                  <span className="font-semibold text-slate-800">
                    {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
                {selectedItem.attendee_name && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Linked Attendee</span>
                    <span className="font-bold text-blue-700">{selectedItem.attendee_name}</span>
                  </div>
                )}
                {selectedItem.token_code && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Token Code</span>
                    <span className="font-mono font-bold text-emerald-700">{selectedItem.token_code}</span>
                  </div>
                )}
                {selectedItem.registration_id && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Registration ID</span>
                    <span className="font-mono text-slate-700">{selectedItem.registration_id}</span>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Public URL</span>
                  <span className="font-mono text-[11px] text-slate-600 break-all">{selectedItem.url}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(selectedItem.url)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedUrl === selectedItem.url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy URL</span>
                  </button>

                  <a
                    href={`/api/admin/media/${selectedItem.id}/download`}
                    download={selectedItem.filename || 'media.jpg'}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setReplacePreview(null);
                      setReplaceModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace Image</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-700" />
                Upload to Media Library
              </h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMedia} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Media Title / Name</label>
                <input
                  type="text"
                  placeholder="e.g. Reunion Banner, School Gate..."
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Image File</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => handleFileUploadSelect(e, false)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Accepted formats: JPEG, PNG, WebP (Max size: 5 MB)
                </span>
              </div>

              {uploadPreview && (
                <div className="bg-slate-100 p-2 rounded-xl flex items-center justify-center border border-slate-200 max-h-48 overflow-hidden">
                  <img src={uploadPreview} alt="Preview" className="max-h-44 object-contain rounded-lg" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadPreview}
                  className="px-4 py-2 bg-[#0f4d2a] hover:bg-[#135d34] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Save to Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPLACE MODAL */}
      {replaceModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                Replace Image File
              </h3>
              <button
                type="button"
                onClick={() => setReplaceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Replacing this file will update the physical image on server disk while preserving the relationship to{' '}
              <strong className="text-slate-900">{selectedItem.attendee_name || selectedItem.name}</strong>.
            </p>

            <form onSubmit={handleReplaceMedia} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Choose New Image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => handleFileUploadSelect(e, true)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 cursor-pointer"
                  required
                />
              </div>

              {replacePreview && (
                <div className="bg-slate-100 p-2 rounded-xl flex items-center justify-center border border-slate-200 max-h-48 overflow-hidden">
                  <img src={replacePreview} alt="New Preview" className="max-h-44 object-contain rounded-lg" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReplaceModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replacing || !replacePreview}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {replacing ? 'Replacing File...' : 'Confirm Replace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Delete Media Item?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete <strong className="text-slate-800">{selectedItem.name}</strong>?
              </p>
              {selectedItem.source === 'registration' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg mt-2">
                  Notice: This image is linked to registration for <strong>{selectedItem.attendee_name}</strong>. The photo reference will be safely reset without breaking the registration.
                </p>
              )}
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMedia}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
