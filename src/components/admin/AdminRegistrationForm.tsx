import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  Sliders,
  Check,
  X,
  Layers,
  HelpCircle,
  Image as ImageIcon,
  FileCheck,
  Info,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { RegistrationFormFieldConfig } from '../../types';

interface AdminRegistrationFormProps {
  onNotify?: (msg: string) => void;
  getHeaders?: () => Record<string, string>;
}

export const AdminRegistrationForm: React.FC<AdminRegistrationFormProps> = ({
  onNotify,
  getHeaders,
}) => {
  const [fields, setFields] = useState<RegistrationFormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<RegistrationFormFieldConfig | null>(null);
  const [isNewField, setIsNewField] = useState(false);
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');

  // Registration Image Upload Settings (Default: 1.5 MB = 1,572,864 bytes)
  const [maxImageSizeMb, setMaxImageSizeMb] = useState<number>(1.5);
  const [acceptedFormats, setAcceptedFormats] = useState<string[]>(['image/jpeg', 'image/png', 'image/webp']);
  const [savingImageSettings, setSavingImageSettings] = useState(false);

  const getAuthHeaders = () => {
    const base = getHeaders ? getHeaders() : {};
    const token = typeof window !== 'undefined' ? localStorage.getItem('nash_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...base,
    };
  };

  const normalizeFields = (data: any[]): RegistrationFormFieldConfig[] => {
    if (!Array.isArray(data)) return [];
    return data.map((item, idx) => {
      const isEnabled =
        item.is_enabled !== undefined
          ? item.is_enabled
          : item.enabled !== undefined
          ? item.enabled
          : true;
      const isRequired =
        item.is_required !== undefined
          ? item.is_required
          : item.required !== undefined
          ? item.required
          : false;
      const fieldId = item.id || `field_${item.name || idx}_${idx}`;
      return {
        ...item,
        id: fieldId,
        name: item.name || `field_${idx}`,
        is_enabled: isEnabled,
        enabled: isEnabled,
        is_required: isRequired,
        required: isRequired,
        order: typeof item.order === 'number' ? item.order : idx + 1,
        options: Array.isArray(item.options) ? item.options : [],
      };
    });
  };

  const loadFields = async () => {
    setLoading(true);
    try {
      let res = await apiFetch('/api/admin/registration/fields', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        res = await apiFetch('/api/registration/fields');
      }
      if (res.ok) {
        const data = await res.json();
        setFields(normalizeFields(data));
      } else {
        onNotify?.('Failed to load registration fields configuration.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Network error loading registration fields.');
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrationConfig = async () => {
    try {
      const res = await apiFetch('/api/registration/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg?.max_image_size_mb) {
          setMaxImageSizeMb(Number(cfg.max_image_size_mb));
        }
        if (Array.isArray(cfg?.image_accepted_formats) && cfg.image_accepted_formats.length > 0) {
          setAcceptedFormats(cfg.image_accepted_formats);
        }
      }
    } catch (e) {
      console.warn('Failed to load registration config:', e);
    }
  };

  useEffect(() => {
    loadFields();
    loadRegistrationConfig();
  }, []);

  const handleSaveImageSettings = async () => {
    setSavingImageSettings(true);
    try {
      const res = await apiFetch('/api/admin/registration/image-limit', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          max_image_size_mb: maxImageSizeMb,
          image_accepted_formats: acceptedFormats,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update image limit');
      onNotify?.(`Registration image size limit successfully updated to ${maxImageSizeMb} MB!`);
    } catch (err: any) {
      onNotify?.(err.message || 'Error updating image size limit');
    } finally {
      setSavingImageSettings(false);
    }
  };

  const handleSaveAllFields = async (updatedFields: RegistrationFormFieldConfig[]) => {
    setSaving(true);
    try {
      const payload = updatedFields.map((f, idx) => ({
        ...f,
        id: f.id || f.name || `field_${idx}`,
        order: idx + 1,
        is_enabled:
          f.enabled !== undefined ? f.enabled : f.is_enabled !== undefined ? f.is_enabled : true,
        is_required:
          f.required !== undefined
            ? f.required
            : f.is_required !== undefined
            ? f.is_required
            : false,
      }));

      const res = await apiFetch('/api/admin/registration/fields', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setFields(normalizeFields(saved));
        onNotify?.('Registration form configuration saved and published successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        onNotify?.(err.message || 'Failed to save form fields.');
      }
    } catch (err) {
      console.error(err);
      onNotify?.('Error saving registration form configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (id: string) => {
    const updated = fields.map(f => {
      const match = f.id === id || f.name === id;
      if (!match) return f;
      const nextVal = !(f.enabled ?? f.is_enabled ?? true);
      return { ...f, enabled: nextVal, is_enabled: nextVal };
    });
    setFields(updated);
    handleSaveAllFields(updated);
  };

  const handleToggleRequired = (id: string) => {
    const updated = fields.map(f => {
      const match = f.id === id || f.name === id;
      if (!match) return f;
      const nextVal = !(f.required ?? f.is_required ?? false);
      return { ...f, required: nextVal, is_required: nextVal };
    });
    setFields(updated);
    handleSaveAllFields(updated);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const items = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const reordered = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    setFields(reordered);
    handleSaveAllFields(reordered);
  };

  const handleDeleteField = (id: string) => {
    const field = fields.find(f => f.id === id || f.name === id);
    if (!field) return;
    if (['full_name', 'phone', 'passing_year'].includes(field.name)) {
      alert('Core field cannot be deleted. You may disable it instead if needed.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the field "${field.label_en}"?`)) return;
    const updated = fields.filter(f => f.id !== id && f.name !== id);
    setFields(updated);
    handleSaveAllFields(updated);
  };

  const handleSaveFieldModal = () => {
    if (!editingField) return;
    if (!editingField.label_en || !editingField.name) {
      alert('Please fill in Field ID Name and English Label.');
      return;
    }

    // sanitize name
    const sanitizedName = editingField.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isEnabled = editingField.enabled ?? editingField.is_enabled ?? true;
    const isRequired = editingField.required ?? editingField.is_required ?? false;

    const fieldToSave: RegistrationFormFieldConfig = {
      ...editingField,
      id: editingField.id || `field_${sanitizedName}`,
      name: sanitizedName,
      enabled: isEnabled,
      is_enabled: isEnabled,
      required: isRequired,
      is_required: isRequired,
    };

    let updatedList = [...fields];
    if (isNewField) {
      updatedList.push({
        ...fieldToSave,
        id: `field_${Date.now()}`,
        order: updatedList.length + 1,
      });
    } else {
      updatedList = updatedList.map(f =>
        f.id === editingField.id || f.name === editingField.name ? fieldToSave : f
      );
    }

    setFields(updatedList);
    handleSaveAllFields(updatedList);
    setEditingField(null);
    setIsNewField(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading form builder configuration...</div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-12 w-full">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 sm:pb-6">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 shrink-0" />
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900 leading-tight">
                Registration Form Field Builder
              </h2>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed">
              Configure every field of the reunion registration process. Add, reorder, edit labels, set validations, or toggle fields on and off.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => setPreviewTab(previewTab === 'editor' ? 'preview' : 'editor')}
              className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                previewTab === 'preview'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{previewTab === 'preview' ? 'Exit Live Preview' : 'Live Form Preview'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsNewField(true);
                setEditingField({
                  id: `field_${Date.now()}`,
                  name: 'custom_field',
                  label_en: '',
                  label_bn: '',
                  placeholder_en: '',
                  placeholder_bn: '',
                  type: 'text',
                  required: false,
                  enabled: true,
                  order: fields.length + 1,
                  grid_span: 'half',
                });
              }}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Field</span>
            </button>
          </div>
        </div>

        {/* Live Preview Mode */}
        {previewTab === 'preview' && (
          <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Live Frontend Preview (Active Fields Only)
              </span>
              <span className="text-xs text-slate-500">
                {fields.filter(f => f.enabled).length} Fields Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...fields]
                .filter(f => (f.enabled ?? f.is_enabled) !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((field, fIdx) => (
                  <div
                    key={field.id || field.name || `prev_field_${fIdx}`}
                    className={field.grid_span === 'full' ? 'md:col-span-2' : 'md:col-span-1'}
                  >
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {field.label_en} {field.label_bn && <span className="text-slate-500">({field.label_bn})</span>}
                      {(field.required ?? field.is_required) && <span className="text-rose-500 ml-1">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        disabled
                        rows={2}
                        placeholder={field.placeholder_en || ''}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    ) : field.type === 'select' ? (
                      <select disabled className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg">
                        <option value="">{field.placeholder_en || 'Select...'}</option>
                        {field.options?.map((opt: any, optIdx: number) => {
                          const optVal = typeof opt === 'string' ? opt : (opt.value || opt.label_en || `opt_${optIdx}`);
                          const optLabel = typeof opt === 'string' ? opt : (opt.label_en || opt.value || optVal);
                          return (
                            <option key={`${field.name || field.id}_prev_opt_${optVal}_${optIdx}`} value={optVal}>
                              {optLabel}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        disabled
                        placeholder={field.placeholder_en || ''}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    )}
                    {field.help_text_en && (
                      <span className="text-[10px] text-slate-500 mt-0.5 block">{field.help_text_en}</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* Registration Image Upload Size & Formats Configuration */}
        <div className="mt-6 p-5 sm:p-6 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 rounded-2xl border border-emerald-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <ImageIcon className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Photo & Image Upload Size Limit</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Database-Driven
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Set the authoritative maximum file size for alumni registration photos. The backend and client-side forms will enforce this limit in real time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveImageSettings}
              disabled={savingImageSettings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 self-start sm:self-auto shrink-0"
            >
              <Save className="w-4 h-4 text-amber-300" />
              <span>{savingImageSettings ? 'Saving...' : 'Save Limit'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-emerald-100/80">
            {/* Limit Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Max Photo Size (MB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="25"
                  step="0.1"
                  value={maxImageSizeMb}
                  onChange={(e) => setMaxImageSizeMb(Math.max(0.1, Math.min(25, parseFloat(e.target.value) || 1.5)))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 shrink-0">
                  MB
                </span>
              </div>
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-slate-400 font-semibold">Presets:</span>
                {[0.5, 1, 1.5, 2, 3, 5, 10].map((preset) => (
                  <button
                    key={`preset_${preset}`}
                    type="button"
                    onClick={() => setMaxImageSizeMb(preset)}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition cursor-pointer border ${
                      maxImageSizeMb === preset
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}MB
                  </button>
                ))}
              </div>
            </div>

            {/* Accepted Formats */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Accepted Image Formats
              </label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {[
                  { mime: 'image/jpeg', label: 'JPG / JPEG' },
                  { mime: 'image/png', label: 'PNG' },
                  { mime: 'image/webp', label: 'WebP' },
                ].map((fmt) => {
                  const isChecked = acceptedFormats.includes(fmt.mime);
                  return (
                    <label
                      key={fmt.mime}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition shadow-xs ${
                        isChecked
                          ? 'bg-emerald-50/80 border-emerald-400 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            if (acceptedFormats.length > 1) {
                              setAcceptedFormats(acceptedFormats.filter(f => f !== fmt.mime));
                            }
                          } else {
                            setAcceptedFormats([...acceptedFormats, fmt.mime]);
                          }
                        }}
                        className="rounded text-emerald-700 focus:ring-emerald-500"
                      />
                      <span>{fmt.label}</span>
                    </label>
                  );
                })}
              </div>
              <span className="text-[10px] text-slate-500 block">
                Validated server-side against binary file signatures.
              </span>
            </div>

            {/* Live Registration Notice Badge */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Public Form Indicator Preview
              </label>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Public Helper Badge:</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Accepted formats: <strong>{acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}</strong> • Max file size: <strong>{maxImageSizeMb} MB</strong>
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  অনুমোদিত ফরম্যাট: <strong>{acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}</strong> • সর্বোচ্চ আকার: <strong>{maxImageSizeMb} MB</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Hosting Environment / cPanel PHP Limits Advisory */}
          <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900 block">
                Hosting & cPanel PHP Upload Requirements (upload_max_filesize & post_max_size):
              </span>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                Application-level limit (<strong>{maxImageSizeMb} MB</strong>) is strictly enforced in code and database. To ensure web servers and PHP do not drop valid requests before reaching the application, ensure your hosting environment (cPanel / <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">php.ini</code> / <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.htaccess</code>) has <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">upload_max_filesize ≥ 16M</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">post_max_size ≥ 16M</code>. Application settings cannot override a lower hosting-level cap.
              </p>
            </div>
          </div>
        </div>

        {/* Fields Table / Order Editor */}
        {previewTab === 'editor' && (
          <div className="mt-6 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {[...fields]
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((field, index) => {
                const fieldKey = field.id || field.name || `field_item_${index}`;
                const isFieldEnabled = (field.enabled ?? field.is_enabled) !== false;
                const isFieldRequired = (field.required ?? field.is_required) === true;

                return (
                  <div
                    key={fieldKey}
                    className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition ${
                      !isFieldEnabled ? 'bg-slate-50/80 opacity-60' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                      <div className="flex flex-col items-center gap-1 text-slate-400 pt-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveField(index, 'up')}
                          className="p-1.5 hover:text-emerald-700 disabled:opacity-20 cursor-pointer rounded hover:bg-slate-100 transition"
                          title="Move Up"
                          aria-label="Move Field Up"
                        >
                          <MoveUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === fields.length - 1}
                          onClick={() => handleMoveField(index, 'down')}
                          className="p-1.5 hover:text-emerald-700 disabled:opacity-20 cursor-pointer rounded hover:bg-slate-100 transition"
                          title="Move Down"
                          aria-label="Move Field Down"
                        >
                          <MoveDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-full">
                            {field.name}
                          </span>
                          <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            Type: {field.type}
                          </span>
                          <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            Span: {field.grid_span}
                          </span>
                          {isFieldRequired && (
                            <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Required *
                            </span>
                          )}
                          {!isFieldEnabled && (
                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm break-words">
                          {field.label_en}{' '}
                          {field.label_bn && <span className="text-slate-500 font-normal">({field.label_bn})</span>}
                        </h4>
                        {field.placeholder_en && (
                          <p className="text-xs text-slate-500 break-words">Placeholder: &ldquo;{field.placeholder_en}&rdquo;</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap self-start sm:self-center shrink-0 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleToggleRequired(field.id || field.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer min-h-[34px] ${
                          isFieldRequired
                            ? 'border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                        title={isFieldRequired ? 'Make Optional' : 'Make Required'}
                      >
                        {isFieldRequired ? 'Mandatory' : 'Optional'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(field.id || field.name)}
                        className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center ${
                          isFieldEnabled
                            ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                        }`}
                        title={isFieldEnabled ? 'Click to disable' : 'Click to enable'}
                        aria-label={isFieldEnabled ? 'Disable field' : 'Enable field'}
                      >
                        {isFieldEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsNewField(false);
                          setEditingField({
                            ...field,
                            id: field.id || field.name,
                            enabled: isFieldEnabled,
                            is_enabled: isFieldEnabled,
                            required: isFieldRequired,
                            is_required: isFieldRequired,
                          });
                        }}
                        className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                        title="Edit Field Properties"
                        aria-label="Edit Field Properties"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {!['full_name', 'phone', 'passing_year'].includes(field.name) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteField(field.id || field.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                          title="Delete Field"
                          aria-label="Delete Field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Edit / Add Field Modal */}
      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full my-auto overflow-hidden">
            <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base break-words">
                {isNewField ? 'Add Custom Registration Field' : `Edit Field: ${editingField.name}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingField(null);
                  setIsNewField(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Internal Field Key *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isNewField && ['full_name', 'phone', 'passing_year'].includes(editingField.name)}
                    value={editingField.name}
                    onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="e.g. t_shirt_size"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Input Type
                  </label>
                  <select
                    value={editingField.type}
                    onChange={e => setEditingField({ ...editingField, type: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="text">Text Input</option>
                    <option value="number">Number Input</option>
                    <option value="tel">Telephone / Phone</option>
                    <option value="email">Email</option>
                    <option value="date">Date Picker</option>
                    <option value="select">Dropdown Select</option>
                    <option value="textarea">Multi-line Text Area</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Label (English) *
                </label>
                <input
                  type="text"
                  required
                  value={editingField.label_en}
                  onChange={e => setEditingField({ ...editingField, label_en: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Full Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Label (Bengali / বাংলা) *
                </label>
                <input
                  type="text"
                  required
                  value={editingField.label_bn}
                  onChange={e => setEditingField({ ...editingField, label_bn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="যেমন: পূর্ণ নাম"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Placeholder (English)
                  </label>
                  <input
                    type="text"
                    value={editingField.placeholder_en || ''}
                    onChange={e => setEditingField({ ...editingField, placeholder_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Enter full name..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Placeholder (Bengali)
                  </label>
                  <input
                    type="text"
                    value={editingField.placeholder_bn || ''}
                    onChange={e => setEditingField({ ...editingField, placeholder_bn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="আপনার নাম লিখুন..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Grid Width
                  </label>
                  <select
                    value={editingField.grid_span}
                    onChange={e => setEditingField({ ...editingField, grid_span: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="half">Half Width (2 columns on desktop)</option>
                    <option value="full">Full Width (1 column spanning across)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Help Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={editingField.help_text_en || ''}
                    onChange={e => setEditingField({ ...editingField, help_text_en: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Short tip below field"
                  />
                </div>
              </div>

              {/* Options editor for Select types */}
              {editingField.type === 'select' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Dropdown Options (Comma separated list)
                  </label>
                  <input
                    type="text"
                    value={
                      Array.isArray(editingField.options)
                        ? editingField.options
                            .map((o: any) => (typeof o === 'string' ? o : o.value || o.label_en))
                            .filter(Boolean)
                            .join(', ')
                        : ''
                    }
                    onChange={e => {
                      const vals = e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);
                      setEditingField({
                        ...editingField,
                        options: vals,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    placeholder="e.g. M, L, XL, XXL"
                  />
                  <span className="text-[11px] text-slate-500">
                    Comma-separated values for options in the dropdown.
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal_field_required"
                    checked={editingField.required}
                    onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="modal_field_required" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Required Field
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal_field_enabled"
                    checked={editingField.enabled}
                    onChange={e => setEditingField({ ...editingField, enabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="modal_field_enabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Enabled on Form
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingField(null);
                  setIsNewField(false);
                }}
                className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFieldModal}
                className="w-full sm:w-auto px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm text-center"
              >
                Save Field Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
