import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'
import KeyframePreview from '../components/KeyframePreview'

// ═══════════════════════════════════════════════════════════════
// KEYFRAME STYLES PAGE — Unified Styles Management with CRUD
// Layout: col-8 (scrollable cards) + col-4 (sticky device preview)
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = ['all', 'general', 'viral', 'professional', 'cinematic', 'playful', 'minimal']
const STYLE_TYPES = ['all', 'animated', 'static']

// ─── Category Badge ─────────────────────────────────────────────────────────
const categoryColors = {
    viral: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
    professional: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
    cinematic: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    playful: { color: '#ec4899', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.25)' },
    minimal: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
    general: { color: 'var(--color-text-muted)', bg: 'var(--color-surface-1)', border: 'var(--color-border-subtle)' },
}

function CategoryBadge({ category }) {
    const cfg = categoryColors[category] || categoryColors.general
    return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {category}
        </span>
    )
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
    if (!open) return null
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onCancel}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-sm rounded-2xl p-6 space-y-4"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
                onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
                <div className="flex gap-3 pt-2">
                    <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'var(--color-error-text)', color: '#fff' }}>
                        Delete
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Style Card (for Caption & Hook templates) ──────────────────────────────
function StyleCard({ item, type, isSelected, onSelect, onEdit, onDelete, captionTemplates, hookTemplates }) {
    // Resolve actual templates for compositions
    const resolvedCaption = type === 'composition' ? captionTemplates?.find(c => c.id === item.caption_template_id) : (type === 'caption' ? item : null)
    const resolvedHook = type === 'composition' ? hookTemplates?.find(h => h.id === item.hook_template_id) : (type === 'hook' ? item : null)

    // Extract colors/fonts for preview
    const captionColor = resolvedCaption?.config?.colors?.primary || resolvedCaption?.config?.highlight?.color || '#FFFFFF'
    const captionFont = resolvedCaption?.config?.font?.family || 'Inter'
    const captionSize = Math.min((resolvedCaption?.config?.font?.size || 48), 16)
    const highlightColor = resolvedCaption?.config?.highlight?.color || '#FFD700'
    const highlightStyle = resolvedCaption?.config?.highlight?.style || 'color'

    const hookColor = resolvedHook?.config?.text?.default_font?.color || '#FFFFFF'
    const hookFont = resolvedHook?.config?.text?.default_font?.family || 'Anton'
    const hookSize = Math.min((resolvedHook?.config?.text?.default_font?.size || 48), 14)
    const hookFirstLineColor = resolvedHook?.config?.text?.lines?.[0]?.color || hookColor

    // Shadow/outline for caption
    const captionShadow = resolvedCaption?.config?.shadow?.enabled !== false
        ? `0 ${Math.min(resolvedCaption?.config?.shadow?.offset_y || 2, 3)}px ${Math.min(resolvedCaption?.config?.shadow?.blur || 4, 6)}px ${resolvedCaption?.config?.shadow?.color || '#000'}`
        : 'none'
    const captionOutline = resolvedCaption?.config?.outline?.enabled
        ? `${Math.min(resolvedCaption?.config?.outline?.width || 2, 2)}px ${resolvedCaption?.config?.outline?.color || '#000'}`
        : undefined

    return (
        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl overflow-hidden group cursor-pointer transition-all"
            style={{
                border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                background: 'var(--color-surface-1)',
            }}
            onClick={() => onSelect(item)}>
            {/* Preview area */}
            <div className="aspect-[4/3] relative overflow-hidden flex items-center justify-center p-3" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92), rgba(15,8,25,0.95))' }}>
                <div className="text-center relative z-10 space-y-1">
                    {/* Show hook-style preview */}
                    {resolvedHook && (
                        <p className="font-bold uppercase leading-tight truncate max-w-full" style={{
                            color: hookFirstLineColor,
                            fontFamily: hookFont,
                            fontSize: `${hookSize}px`,
                            textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                            letterSpacing: '0.5px',
                        }}>
                            HOOK TEXT
                        </p>
                    )}
                    {/* Show caption-style preview */}
                    {resolvedCaption && (
                        <div className="flex flex-wrap justify-center gap-x-1 items-baseline">
                            <span style={{
                                color: captionColor,
                                fontFamily: captionFont,
                                fontSize: `${captionSize}px`,
                                fontWeight: resolvedCaption?.config?.font?.weight || 'bold',
                                textShadow: captionShadow,
                                WebkitTextStroke: captionOutline,
                            }}>Caption</span>
                            <span style={{
                                color: highlightColor,
                                fontFamily: captionFont,
                                fontSize: `${captionSize}px`,
                                fontWeight: resolvedCaption?.config?.font?.weight || 'bold',
                                textShadow: highlightStyle === 'glow' ? `0 0 6px ${highlightColor}, 0 0 12px ${highlightColor}` : captionShadow,
                                WebkitTextStroke: captionOutline,
                                transform: highlightStyle === 'scale' ? 'scale(1.1)' : undefined,
                                display: 'inline-block',
                                backgroundColor: highlightStyle === 'background' ? `${highlightColor}30` : undefined,
                                padding: highlightStyle === 'background' ? '0 3px' : undefined,
                                borderRadius: highlightStyle === 'background' ? '3px' : undefined,
                            }}>text</span>
                        </div>
                    )}
                    {/* Fallback if neither resolved */}
                    {!resolvedCaption && !resolvedHook && (
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Preview</span>
                    )}
                </div>
                {/* Badges */}
                {item.is_default && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase z-10"
                        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}>
                        DEFAULT
                    </div>
                )}
                <div className="absolute top-1.5 right-1.5 z-10">
                    <span className="px-1.5 py-0.5 rounded text-[7px] font-bold"
                        style={{
                            background: item.style_type === 'animated' ? 'rgba(139,92,246,0.2)' : 'rgba(107,114,128,0.2)',
                            color: item.style_type === 'animated' ? '#a78bfa' : '#9ca3af',
                            border: `1px solid ${item.style_type === 'animated' ? 'rgba(139,92,246,0.3)' : 'rgba(107,114,128,0.3)'}`,
                        }}>
                        {item.style_type || (resolvedHook?.style_type || resolvedCaption?.style_type || '')}
                    </span>
                </div>
                {/* Action buttons on hover */}
                <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(item) }}
                        className="w-6 h-6 rounded-md flex items-center justify-center backdrop-blur-sm transition-colors"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                        <span className="material-symbols-outlined text-[12px]">edit</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item) }}
                        className="w-6 h-6 rounded-md flex items-center justify-center backdrop-blur-sm transition-colors"
                        style={{ background: 'rgba(239,68,68,0.8)', color: '#fff' }}>
                        <span className="material-symbols-outlined text-[12px]">delete</span>
                    </button>
                </div>
            </div>
            {/* Footer */}
            <div className="px-2.5 py-2 space-y-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>{item.name}</p>
                    {isSelected && <span className="w-2 h-2 rounded-full flex-shrink-0 ml-1" style={{ background: 'var(--color-accent)' }} />}
                </div>
                <div className="flex items-center gap-1.5">
                    <CategoryBadge category={item.category || 'general'} />
                </div>
            </div>
        </motion.div>
    )
}

// ─── Template Editor Modal ──────────────────────────────────────────────────
function TemplateEditorModal({ open, type, template, keyframes, onSave, onClose }) {
    const [form, setForm] = useState({})
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open && template) {
            setForm({ ...template })
        } else if (open) {
            // New template defaults
            setForm(type === 'caption' ? {
                name: '', description: '', category: 'general', style_type: 'static',
                config: {
                    font: { family: 'Inter', weight: 'bold', size: 48, letter_spacing: 0, line_height: 1.3, text_transform: 'none' },
                    colors: { primary: '#FFFFFF', secondary: '#CCCCCC' },
                    highlight: { color: '#FFD700', style: 'color', transition: 'smooth', transition_duration_ms: 200 },
                    background: { enabled: false, color: '#000000', opacity: 0.5, padding_x: 12, padding_y: 6, border_radius: 6, per_word: false },
                    outline: { enabled: false, color: '#000000', width: 2 },
                    shadow: { enabled: true, color: '#000000', blur: 4, offset_x: 0, offset_y: 2 },
                    position: { anchor: 'bottom', y_offset: 80, safe_area: { top_percent: 10, bottom_percent: 20, side_percent: 10 } },
                    display: { max_lines: 2, max_line_width_percent: 80, overflow_behavior: 'wrap', words_per_segment: 5 },
                    animation: { entrance_keyframe_id: null, exit_keyframe_id: null, highlight_keyframe_id: null, transform_origin: null },
                }
            } : {
                name: '', description: '', category: 'general', style_type: 'animated',
                config: {
                    text: { lines: [{ font_family: null, font_size: 60, font_weight: '900', color: '#FFFFFF', letter_spacing: 0, text_transform: 'uppercase' }], default_font: { family: 'Anton', weight: 'bold', size: 48, color: '#FFFFFF', letter_spacing: 0 } },
                    box: { enabled: false, color: '#000000', opacity: 0.6, padding: 20, border_radius: 12, border_color: null, border_width: 0 },
                    position: { anchor: 'center', y_offset: 0, x_offset: 0 },
                    animation: { entrance_keyframe_id: null, transform_origin: null, per_line: [] },
                    timing: { display_duration_seconds: 4.0, delay_before_seconds: 0.5 },
                }
            })
        }
    }, [open, template, type])

    const handleSave = async () => {
        if (!form.name?.trim()) { toast.error('Name is required'); return }
        setSaving(true)
        try {
            await onSave(form)
            onClose()
        } catch (e) {
            toast.error(e.message || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    const updateConfig = (path, value) => {
        const parts = path.split('.')
        setForm(prev => {
            const newForm = { ...prev }
            let cfg = { ...(newForm.config || {}) }
            newForm.config = cfg
            let obj = cfg
            for (let i = 0; i < parts.length - 1; i++) {
                obj[parts[i]] = { ...(obj[parts[i]] || {}) }
                obj = obj[parts[i]]
            }
            obj[parts[parts.length - 1]] = value
            return newForm
        })
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[5vh] overflow-y-auto"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="w-full max-w-2xl rounded-2xl mb-10 overflow-hidden"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>
                            {template ? 'edit' : 'add_circle'}
                        </span>
                        {template ? 'Edit' : 'Create'} {type === 'caption' ? 'Caption' : 'Hook'} Template
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>Name</label>
                            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                placeholder="Style name..." />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>Category</label>
                            <select value={form.category || 'general'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>Style Type</label>
                            <select value={form.style_type || 'static'} onChange={e => setForm(f => ({ ...f, style_type: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                <option value="static">Static</option>
                                <option value="animated">Animated</option>
                            </select>
                        </div>
                    </div>

                    {/* Caption-specific config */}
                    {type === 'caption' && (
                        <div className="space-y-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Font</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Family</label>
                                    <input value={form.config?.font?.family || ''} onChange={e => updateConfig('font.family', e.target.value)}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Size</label>
                                    <input type="number" value={form.config?.font?.size || 48} onChange={e => updateConfig('font.size', Number(e.target.value))}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Weight</label>
                                    <select value={form.config?.font?.weight || 'bold'} onChange={e => updateConfig('font.weight', e.target.value)}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                        <option value="normal">Normal</option>
                                        <option value="bold">Bold</option>
                                        <option value="900">Black</option>
                                    </select>
                                </div>
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--color-text-muted)' }}>Colors</p>
                            <div className="flex items-center gap-4">
                                <label className="flex flex-col items-center gap-1">
                                    <input type="color" value={form.config?.colors?.primary || '#FFFFFF'} onChange={e => updateConfig('colors.primary', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0" />
                                    <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Primary</span>
                                </label>
                                <label className="flex flex-col items-center gap-1">
                                    <input type="color" value={form.config?.highlight?.color || '#FFD700'} onChange={e => updateConfig('highlight.color', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0" />
                                    <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Highlight</span>
                                </label>
                                <label className="flex flex-col items-center gap-1">
                                    <input type="color" value={form.config?.shadow?.color || '#000000'} onChange={e => updateConfig('shadow.color', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0" />
                                    <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Shadow</span>
                                </label>
                            </div>
                            {/* Animation selector */}
                            {form.style_type === 'animated' && keyframes?.length > 0 && (
                                <>
                                    <p className="text-[11px] font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--color-text-muted)' }}>Animation</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Entrance</label>
                                            <select value={form.config?.animation?.entrance_keyframe_id || ''} onChange={e => updateConfig('animation.entrance_keyframe_id', e.target.value ? Number(e.target.value) : null)}
                                                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                                <option value="">None</option>
                                                {keyframes.map(kf => <option key={kf.id} value={kf.id}>{kf.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Highlight</label>
                                            <select value={form.config?.animation?.highlight_keyframe_id || ''} onChange={e => updateConfig('animation.highlight_keyframe_id', e.target.value ? Number(e.target.value) : null)}
                                                className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                                <option value="">None</option>
                                                {keyframes.map(kf => <option key={kf.id} value={kf.id}>{kf.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Hook-specific config */}
                    {type === 'hook' && (
                        <div className="space-y-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Default Font</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Family</label>
                                    <input value={form.config?.text?.default_font?.family || ''} onChange={e => updateConfig('text.default_font.family', e.target.value)}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Size</label>
                                    <input type="number" value={form.config?.text?.default_font?.size || 48} onChange={e => updateConfig('text.default_font.size', Number(e.target.value))}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Color</label>
                                    <input type="color" value={form.config?.text?.default_font?.color || '#FFFFFF'} onChange={e => updateConfig('text.default_font.color', e.target.value)}
                                        className="w-full h-9 rounded-lg cursor-pointer border-0" />
                                </div>
                            </div>
                            {/* Animation selector */}
                            {form.style_type === 'animated' && keyframes?.length > 0 && (
                                <>
                                    <p className="text-[11px] font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--color-text-muted)' }}>Animation</p>
                                    <div>
                                        <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Entrance Animation</label>
                                        <select value={form.config?.animation?.entrance_keyframe_id || ''} onChange={e => updateConfig('animation.entrance_keyframe_id', e.target.value ? Number(e.target.value) : null)}
                                            className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                            style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                                            <option value="">None</option>
                                            {keyframes.map(kf => <option key={kf.id} value={kf.id}>{kf.name}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}
                            <p className="text-[11px] font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--color-text-muted)' }}>Timing</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Duration (s)</label>
                                    <input type="number" step="0.5" value={form.config?.timing?.display_duration_seconds || 4} onChange={e => updateConfig('timing.display_duration_seconds', Number(e.target.value))}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Delay (s)</label>
                                    <input type="number" step="0.1" value={form.config?.timing?.delay_before_seconds || 0} onChange={e => updateConfig('timing.delay_before_seconds', Number(e.target.value))}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', opacity: saving ? 0.6 : 1 }}>
                        {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {template ? 'Update' : 'Create'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function KeyframeStylesPage() {
    const [activeTab, setActiveTab] = useState('compositions') // compositions | captions | hooks
    const [compositions, setCompositions] = useState([])
    const [captionTemplates, setCaptionTemplates] = useState([])
    const [hookTemplates, setHookTemplates] = useState([])
    const [keyframes, setKeyframes] = useState([])
    const [loading, setLoading] = useState(true)
    const [category, setCategory] = useState('all')
    const [styleType, setStyleType] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedItem, setSelectedItem] = useState(null)
    const [previewType, setPreviewType] = useState('hook')
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorType, setEditorType] = useState('caption')
    const [editorTemplate, setEditorTemplate] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)

    // Load data
    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [compsRes, captionsRes, hooksRes, kfRes] = await Promise.all([
                api.getStyleCompositions(),
                api.getCaptionTemplates(),
                api.getHookTemplates(),
                api.getKeyframes(),
            ])
            setCompositions(compsRes?.data || compsRes?.items || [])
            setCaptionTemplates(captionsRes?.data || captionsRes?.items || [])
            setHookTemplates(hooksRes?.data || hooksRes?.items || [])
            setKeyframes(kfRes?.data || kfRes?.items || [])
        } catch {
            toast.error('Failed to load styles')
        } finally {
            setLoading(false)
        }
    }

    // Filter logic
    const filterItems = useCallback((items) => {
        let result = items
        if (category !== 'all') result = result.filter(i => i.category === category)
        if (styleType !== 'all') result = result.filter(i => i.style_type === styleType)
        if (search.trim()) result = result.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
        return result
    }, [category, styleType, search])

    const filteredCompositions = useMemo(() => filterItems(compositions), [compositions, filterItems])
    const filteredCaptions = useMemo(() => filterItems(captionTemplates), [captionTemplates, filterItems])
    const filteredHooks = useMemo(() => filterItems(hookTemplates), [hookTemplates, filterItems])

    // CRUD handlers
    const handleCreate = (type) => {
        setEditorType(type)
        setEditorTemplate(null)
        setEditorOpen(true)
    }

    const handleEdit = (item, type) => {
        setEditorType(type)
        setEditorTemplate(item)
        setEditorOpen(true)
    }

    const handleSaveTemplate = async (form) => {
        const isNew = !form.id
        const payload = { name: form.name, description: form.description, category: form.category, style_type: form.style_type, config: form.config }

        if (editorType === 'caption') {
            if (isNew) await api.createCaptionTemplate(payload)
            else await api.updateCaptionTemplate(form.id, payload)
        } else {
            if (isNew) await api.createHookTemplate(payload)
            else await api.updateHookTemplate(form.id, payload)
        }
        toast.success(isNew ? 'Template created' : 'Template updated')
        loadData()
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            if (activeTab === 'captions') await api.deleteCaptionTemplate(deleteTarget.id)
            else if (activeTab === 'hooks') await api.deleteHookTemplate(deleteTarget.id)
            else await api.deleteStyleComposition(deleteTarget.id)
            toast.success('Deleted')
            setDeleteTarget(null)
            loadData()
        } catch {
            toast.error('Delete failed')
        }
    }

    // Preview selection
    const handleSelectItem = (item) => {
        setSelectedItem(item)
        if (activeTab === 'captions') setPreviewType('caption')
        else if (activeTab === 'hooks') setPreviewType('hook')
        else {
            // Composition — prefer hook preview
            const hookTpl = hookTemplates.find(h => h.id === item.hook_template_id)
            const captionTpl = captionTemplates.find(c => c.id === item.caption_template_id)
            if (hookTpl) { setSelectedItem(hookTpl); setPreviewType('hook') }
            else if (captionTpl) { setSelectedItem(captionTpl); setPreviewType('caption') }
        }
    }

    const tabs = [
        { key: 'compositions', label: 'Compositions', icon: 'layers', count: filteredCompositions.length },
        { key: 'captions', label: 'Captions', icon: 'subtitles', count: filteredCaptions.length },
        { key: 'hooks', label: 'Hooks', icon: 'format_quote', count: filteredHooks.length },
    ]

    const currentItems = activeTab === 'compositions' ? filteredCompositions : activeTab === 'captions' ? filteredCaptions : filteredHooks

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="flex flex-col items-center gap-4">
                    <motion.div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}
                        animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--color-accent)' }}>palette</span>
                    </motion.div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading styles...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
            {/* ─── Left Column: Cards (scrollable) ─── */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Styles</h1>
                    {activeTab !== 'compositions' && (
                        <motion.button
                            onClick={() => handleCreate(activeTab === 'captions' ? 'caption' : 'hook')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            Create
                        </motion.button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                    {tabs.map(tab => (
                        <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedItem(null) }}
                            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
                            style={{ color: activeTab === tab.key ? 'var(--btn-primary-text)' : 'var(--color-text-muted)' }}>
                            {activeTab === tab.key && (
                                <motion.div layoutId="tab-pill" className="absolute inset-0 rounded-lg"
                                    style={{ background: 'var(--btn-primary-bg)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                            <span className="relative material-symbols-outlined text-[14px]">{tab.icon}</span>
                            <span className="relative">{tab.label}</span>
                            <span className="relative text-[9px] px-1.5 py-0.5 rounded-full"
                                style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--color-surface-2)' }}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search styles..."
                            className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl outline-none"
                            style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                    </div>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                        className="px-3 py-2.5 rounded-xl text-xs outline-none"
                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
                    </select>
                    {activeTab !== 'compositions' && (
                        <select value={styleType} onChange={e => setStyleType(e.target.value)}
                            className="px-3 py-2.5 rounded-xl text-xs outline-none"
                            style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                            {STYLE_TYPES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Types' : s}</option>)}
                        </select>
                    )}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                        {currentItems.map(item => (
                            <StyleCard
                                key={item.id}
                                item={item}
                                type={activeTab === 'captions' ? 'caption' : activeTab === 'hooks' ? 'hook' : 'composition'}
                                isSelected={selectedItem?.id === item.id}
                                onSelect={handleSelectItem}
                                onEdit={(it) => handleEdit(it, activeTab === 'captions' ? 'caption' : 'hook')}
                                onDelete={setDeleteTarget}
                                captionTemplates={captionTemplates}
                                hookTemplates={hookTemplates}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                {currentItems.length === 0 && (
                    <div className="text-center py-16">
                        <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: 'var(--color-text-muted)' }}>style</span>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No styles found</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Try adjusting your filters or create a new style</p>
                    </div>
                )}
            </div>

            {/* ─── Right Column: Sticky Device Preview (Google Pixel 7 Pro) ─── */}
            <div className="hidden lg:flex w-[340px] xl:w-[380px] flex-shrink-0 items-start justify-center p-6"
                style={{ borderLeft: '1px solid var(--color-border-subtle)' }}>
                <div className="sticky top-6 flex flex-col items-center gap-4">
                    {/* Device Label */}
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>phone_android</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Google Pixel 7 Pro</span>
                    </div>

                    {/* Device Frame */}
                    <div className="relative">
                        {/* Outer bezel */}
                        <div className="rounded-[2.5rem] p-[3px]"
                            style={{ background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset' }}>
                            {/* Inner screen area */}
                            <div className="rounded-[2.3rem] overflow-hidden relative"
                                style={{ width: 280, height: 600, background: 'linear-gradient(180deg, #1a1025 0%, #0d0a14 50%, #1a0f20 100%)' }}>
                                {/* Status bar */}
                                <div className="absolute top-0 left-0 right-0 h-7 flex items-center justify-between px-5 z-30">
                                    <span className="text-[9px] font-medium text-white/50">9:41</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[8px] text-white/50">●●●</span>
                                    </div>
                                </div>
                                {/* Camera punch hole */}
                                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full z-30"
                                    style={{ background: 'radial-gradient(circle, #111 40%, #000 70%)' }} />

                                {/* Preview content */}
                                <div className="absolute inset-0 z-10">
                                    {selectedItem ? (
                                        <KeyframePreview
                                            template={selectedItem}
                                            type={previewType}
                                            text={previewType === 'hook' ? "Sample Hook\nText Here\nAmazing!" : undefined}
                                            words={previewType === 'caption' ? ['This', 'is', 'how', 'your', 'caption', 'looks'] : undefined}
                                            loop={true}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-center space-y-3 px-6">
                                                <span className="material-symbols-outlined text-3xl" style={{ color: 'rgba(255,255,255,0.2)' }}>touch_app</span>
                                                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Select a style to preview</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom nav bar */}
                                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-white/20 z-20" />
                            </div>
                        </div>
                        {/* Side button accent */}
                        <div className="absolute right-[-2px] top-[120px] w-[3px] h-[40px] rounded-r-full" style={{ background: '#333' }} />
                        <div className="absolute left-[-2px] top-[100px] w-[3px] h-[25px] rounded-l-full" style={{ background: '#333' }} />
                        <div className="absolute left-[-2px] top-[140px] w-[3px] h-[50px] rounded-l-full" style={{ background: '#333' }} />
                    </div>

                    {/* Selected style info */}
                    {selectedItem && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="w-full rounded-xl p-3 space-y-2"
                            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Preview</p>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-success-text)' }} />
                            </div>
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{selectedItem.name}</p>
                            <div className="flex items-center gap-2">
                                <CategoryBadge category={selectedItem.category || 'general'} />
                                <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{selectedItem.style_type}</span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ─── Modals ─── */}
            <AnimatePresence>
                {editorOpen && (
                    <TemplateEditorModal
                        open={editorOpen}
                        type={editorType}
                        template={editorTemplate}
                        keyframes={keyframes}
                        onSave={handleSaveTemplate}
                        onClose={() => setEditorOpen(false)}
                    />
                )}
                {deleteTarget && (
                    <ConfirmDialog
                        open={!!deleteTarget}
                        title="Delete Style"
                        message={`Are you sure you want to delete "${deleteTarget.name}"? This action can be undone by an admin.`}
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteTarget(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
