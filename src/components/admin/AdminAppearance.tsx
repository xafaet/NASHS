import React, { useState, useEffect } from 'react';
import {
  Menu,
  Plus,
  Trash2,
  Edit2,
  Save,
  ArrowUp,
  ArrowDown,
  Layers,
  PanelTop,
  PanelBottom,
  ExternalLink,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import { HeaderConfig, TopBarConfig, NavigationMenuItem, FooterConfig } from '../../types';
import { apiFetch } from '../../utils/api';
import { AdminHero } from './AdminHero';

interface Props {
  showToast: (msg: string) => void;
  getHeaders: () => Record<string, string>;
}

export const AdminAppearance: React.FC<Props> = ({ showToast, getHeaders }) => {
  const [activeSection, setActiveSection] = useState<'menus' | 'hero' | 'topbar' | 'header' | 'footer'>('menus');

  const [topbar, setTopbar] = useState<TopBarConfig | null>(null);
  const [header, setHeader] = useState<HeaderConfig | null>(null);
  const [menus, setMenus] = useState<NavigationMenuItem[]>([]);
  const [footer, setFooter] = useState<FooterConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Menu item modal state
  const [editingMenu, setEditingMenu] = useState<NavigationMenuItem | null>(null);
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [menuToDelete, setMenuToDelete] = useState<NavigationMenuItem | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/appearance/topbar').then(r => r.ok ? r.json() : null),
      apiFetch('/api/appearance/header').then(r => r.ok ? r.json() : null),
      apiFetch('/api/appearance/menus').then(r => r.ok ? r.json() : []),
      apiFetch('/api/appearance/footer').then(r => r.ok ? r.json() : null),
    ])
      .then(([tb, hd, mn, ft]) => {
        if (tb) setTopbar(tb);
        if (hd) setHeader(hd);
        if (mn) setMenus(mn || []);
        if (ft) setFooter(ft);
        setLoading(false);
      })
      .catch(err => {
        console.warn('Appearance configurations load paused:', err);
        setLoading(false);
      });
  }, []);

  const saveTopBar = async () => {
    if (!topbar) return;
    try {
      const res = await fetch('/api/admin/appearance/topbar', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(topbar),
      });
      if (!res.ok) throw new Error('Failed to update Top Bar');
      showToast('Top Bar updated successfully!');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const saveHeader = async () => {
    if (!header) return;
    try {
      const res = await fetch('/api/admin/appearance/header', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(header),
      });
      if (!res.ok) throw new Error('Failed to update Header');
      showToast('Header configuration updated successfully!');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const saveFooter = async () => {
    if (!footer) return;
    try {
      const res = await fetch('/api/admin/appearance/footer', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(footer),
      });
      if (!res.ok) throw new Error('Failed to update Footer');
      showToast('Footer configuration updated successfully!');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu) return;

    try {
      const isNew = !menus.some(m => m.id === editingMenu.id);
      const url = isNew ? '/api/admin/appearance/menus' : `/api/admin/appearance/menus/${editingMenu.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(editingMenu),
      });

      if (!res.ok) throw new Error('Failed to save menu item');
      const savedItem = await res.json();

      if (isNew) {
        setMenus([...menus, savedItem]);
      } else {
        setMenus(menus.map(m => (m.id === savedItem.id ? savedItem : m)));
      }

      setMenuModalOpen(false);
      setEditingMenu(null);
      window.dispatchEvent(new CustomEvent('nash-menus-changed'));
      showToast('Menu item saved successfully!');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleToggleActive = async (item: NavigationMenuItem) => {
    try {
      const res = await fetch(`/api/admin/appearance/menus/${item.id}/toggle`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to toggle menu state');
      const data = await res.json();
      const nextActive = data.item ? data.item.is_active : !item.is_active;

      setMenus(menus.map(m => (m.id === item.id ? { ...m, is_active: nextActive } : m)));
      window.dispatchEvent(new CustomEvent('nash-menus-changed'));
      showToast(`Menu item ${item.label_en} is now ${nextActive ? 'active' : 'disabled'}.`);
    } catch (e: any) {
      showToast(e.message || 'Failed to toggle menu status.');
    }
  };

  const confirmDeleteMenu = async () => {
    if (!menuToDelete) return;
    try {
      const res = await fetch(`/api/admin/appearance/menus/${menuToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete menu item');
      setMenus(menus.filter(m => m.id !== menuToDelete.id && m.parent_id !== menuToDelete.id));
      window.dispatchEvent(new CustomEvent('nash-menus-changed'));
      showToast(`Menu item "${menuToDelete.label_en}" removed from database.`);
      setMenuToDelete(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to delete menu item.');
    }
  };

  const moveMenu = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= menus.length) return;

    const reordered = [...menus];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    // Update order numbers
    const updated = reordered.map((item, idx) => ({ ...item, order: idx + 1 }));
    setMenus(updated);

    // Save items
    try {
      for (const item of updated) {
        await fetch(`/api/admin/appearance/menus/${item.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getHeaders(),
          },
          body: JSON.stringify(item),
        });
      }
      window.dispatchEvent(new CustomEvent('nash-menus-changed'));
      showToast('Menu order updated.');
    } catch (e: any) {
      showToast('Failed to sync menu order.');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading appearance controls...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-700" />
          Appearance & Navigation Management
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Customize the dynamic top announcement bar, header branding, navigation menus, and multi-column footer without modifying code.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-t-2xl gap-2 overflow-x-auto">
        {[
          { id: 'menus', label: 'Navigation Menus', icon: Menu },
          { id: 'hero', label: 'Hero Section', icon: Sparkles },
          { id: 'topbar', label: 'Top Announcement Bar', icon: PanelTop },
          { id: 'header', label: 'Header Settings', icon: Layers },
          { id: 'footer', label: 'Footer Columns', icon: PanelBottom },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'border-emerald-700 text-emerald-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="bg-white p-6 rounded-b-2xl rounded-tr-none shadow-xs border border-t-0 border-slate-200">
        {/* 1. NAVIGATION MENUS */}
        {activeSection === 'menus' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Main Menu Structure</h3>
                <p className="text-xs text-slate-500">Manage links, labels, ordering, and dropdown sub-menus.</p>
              </div>
              <button
                onClick={() => {
                  setEditingMenu({
                    id: `menu-${Date.now()}`,
                    label_en: '',
                    label_bn: '',
                    url: '/',
                    target: '_self',
                    order: menus.length + 1,
                    is_active: true,
                  });
                  setMenuModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Menu Item</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {menus.map((item, index) => {
                const isSubItem = !!item.parent_id;
                const parent = menus.find(m => m.id === item.parent_id);
                return (
                  <div
                    key={item.id}
                    className={`py-3 px-4 flex items-center justify-between hover:bg-slate-50 rounded-xl transition ${
                      isSubItem ? 'ml-8 bg-emerald-50/40 border-l-2 border-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveMenu(index, 'up')}
                          className="p-1 hover:bg-slate-200 rounded-sm text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === menus.length - 1}
                          onClick={() => moveMenu(index, 'down')}
                          className="p-1 hover:bg-slate-200 rounded-sm text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{item.label_en}</span>
                          <span className="text-xs text-slate-400">/</span>
                          <span className="text-xs text-slate-600 font-medium">{item.label_bn}</span>
                          {!item.is_active && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
                              Disabled
                            </span>
                          )}
                          {isSubItem && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                              Sub-item of {parent?.label_en || 'Parent'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>{item.url}</span>
                          <span>•</span>
                          <span>{item.target === '_blank' ? 'Opens in New Tab' : 'Same Window'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          item.is_active
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title={item.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMenu({ ...item });
                          setMenuModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        title="Edit Menu Item"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuToDelete(item)}
                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete Menu Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. TOP ANNOUNCEMENT BAR */}
        {activeSection === 'topbar' && topbar && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="topbar_enabled"
                  checked={topbar.is_enabled}
                  onChange={e => setTopbar({ ...topbar, is_enabled: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                <label htmlFor="topbar_enabled" className="text-sm font-bold text-slate-900">
                  Enable Top Notification / Announcement Bar
                </label>
              </div>
              <button
                onClick={saveTopBar}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Top Bar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Announcement Text (English)
                </label>
                <input
                  type="text"
                  value={topbar.announcement_en}
                  onChange={e => setTopbar({ ...topbar, announcement_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Announcement Text (Bengali)
                </label>
                <input
                  type="text"
                  value={topbar.announcement_bn}
                  onChange={e => setTopbar({ ...topbar, announcement_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Helpline Phone Number
                </label>
                <input
                  type="text"
                  value={topbar.contact_phone || ''}
                  onChange={e => setTopbar({ ...topbar, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  value={topbar.contact_email || ''}
                  onChange={e => setTopbar({ ...topbar, contact_email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={topbar.show_contact_info}
                  onChange={e => setTopbar({ ...topbar, show_contact_info: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                Show Contact Info
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={topbar.show_language_selector}
                  onChange={e => setTopbar({ ...topbar, show_language_selector: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                Show Language Switcher
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={topbar.show_login_link}
                  onChange={e => setTopbar({ ...topbar, show_login_link: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                Show Login Link
              </label>
            </div>
          </div>
        )}

        {/* 3. HEADER SETTINGS */}
        {activeSection === 'header' && header && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Header Branding & CTA Controls</h3>
              <button
                onClick={saveHeader}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Header</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Header CTA Button Text (English)
                </label>
                <input
                  type="text"
                  value={header.cta_text_en}
                  onChange={e => setHeader({ ...header, cta_text_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Header CTA Button Text (Bengali)
                </label>
                <input
                  type="text"
                  value={header.cta_text_bn}
                  onChange={e => setHeader({ ...header, cta_text_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Header CTA Target Link
              </label>
              <input
                type="text"
                value={header.cta_url}
                onChange={e => setHeader({ ...header, cta_url: e.target.value })}
                placeholder="#register or /register"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={header.show_cta_button}
                  onChange={e => setHeader({ ...header, show_cta_button: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                Show CTA Button in Header
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={header.show_search}
                  onChange={e => setHeader({ ...header, show_search: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                Show Search Bar
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={header.show_language_switcher}
                  onChange={e => setHeader({ ...header, show_language_switcher: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                Show Language Switcher
              </label>
            </div>
          </div>
        )}

        {/* 4. FOOTER CONFIGURATION */}
        {activeSection === 'footer' && footer && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Footer Content & Columns</h3>
              <button
                onClick={saveFooter}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Footer</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Footer Description (English)
                </label>
                <textarea
                  rows={3}
                  value={footer.description_en}
                  onChange={e => setFooter({ ...footer, description_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Footer Description (Bengali)
                </label>
                <textarea
                  rows={3}
                  value={footer.description_bn}
                  onChange={e => setFooter({ ...footer, description_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Footer Columns</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {footer.columns.map((col, idx) => (
                  <div key={col.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Column {idx + 1}</span>
                    <input
                      type="text"
                      value={col.title_en}
                      onChange={e => {
                        const updated = [...footer.columns];
                        updated[idx].title_en = e.target.value;
                        setFooter({ ...footer, columns: updated });
                      }}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded-sm bg-white"
                      placeholder="Title (EN)"
                    />
                    <input
                      type="text"
                      value={col.title_bn}
                      onChange={e => {
                        const updated = [...footer.columns];
                        updated[idx].title_bn = e.target.value;
                        setFooter({ ...footer, columns: updated });
                      }}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded-sm bg-white"
                      placeholder="Title (BN)"
                    />
                    <span className="text-[10px] text-slate-500 block">{col.links.length} active links</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. HERO SECTION */}
        {activeSection === 'hero' && (
          <div className="pt-2">
            <AdminHero showToast={showToast} getHeaders={getHeaders} />
          </div>
        )}
      </div>

      {/* Menu Item Edit / Create Modal */}
      {menuModalOpen && editingMenu && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {menus.some(m => m.id === editingMenu.id) ? 'Edit Navigation Item' : 'Add Navigation Item'}
            </h3>

            <form onSubmit={handleSaveMenuItem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Label (English)
                  </label>
                  <input
                    type="text"
                    value={editingMenu.label_en}
                    onChange={e => setEditingMenu({ ...editingMenu, label_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Label (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingMenu.label_bn}
                    onChange={e => setEditingMenu({ ...editingMenu, label_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Destination URL
                </label>
                <input
                  type="text"
                  value={editingMenu.url}
                  onChange={e => setEditingMenu({ ...editingMenu, url: e.target.value })}
                  placeholder="/, #about, #register, #verify or https://"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Parent Menu (Dropdown)
                  </label>
                  <select
                    value={editingMenu.parent_id || ''}
                    onChange={e => setEditingMenu({ ...editingMenu, parent_id: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">None (Top-Level Item)</option>
                    {menus
                      .filter(m => m.id !== editingMenu.id && !m.parent_id)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.label_en}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Window Target
                  </label>
                  <select
                    value={editingMenu.target}
                    onChange={e => setEditingMenu({ ...editingMenu, target: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="_self">Same Tab (_self)</option>
                    <option value="_blank">New Tab (_blank)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="menu_active"
                  checked={editingMenu.is_active}
                  onChange={e => setEditingMenu({ ...editingMenu, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                <label htmlFor="menu_active" className="text-xs font-semibold text-slate-700">
                  Visible in Navigation
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMenuModalOpen(false);
                    setEditingMenu(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Menu Item Confirmation Modal */}
      {menuToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Navigation Item</h3>
                <p className="text-xs text-slate-500">This action will remove it from the menu and database.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Are you sure you want to delete <span className="font-bold text-slate-900">"{menuToDelete.label_en}"</span> ({menuToDelete.label_bn})? Any nested child links will also be detached.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMenuToDelete(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMenu}
                className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
