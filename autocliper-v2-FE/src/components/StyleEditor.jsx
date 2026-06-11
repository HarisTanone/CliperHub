import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import toast from 'react-hot-toast'
import KeyframePreview from './KeyframePreview'
import { bakeAnimation, computeParamsHash, applyKeyPointReduction, exportToBackend } from '../utils/keyframeBaker'
import { api } from '../utils/api'

// ═══════════════════════════════════════════════════════════════
// STYLE EDITOR — Full style editing UI with live preview
// Split layout: controls panel (left, scrollable) + live KeyframePreview (right, sticky)
// Supports both 'caption' and 'hook' template types.
// ═══════════════════════════════════════════════════════════════

// ─── Default Config Factories ──────────────────────────────────────────────

function defaultCaptionConfig() {
    return {
        font: { family: 'Inter', weight: '700', size: 48, letter_spacing: 0, line_height: 1.3, text_transform: 'none' },
        colors: { primary: '#FFFFFF', secondary: '#CCCCCC' },
        highlight: { color: '#FFD700', style: 'color', transition: 'smooth', transition_duration_ms: 200 },
        background: { enabled: false, color: '#000000', opacity: 0.7, padding_x: 8, padding_y: 4, border_radius: 8, per_word: false },
        outline: { enabled: false, color: '#000000', width: 2 },
        shadow: { enabled: true, color: '#000000', blur: 4, offset_x: 0, offset_y: 2 },
        position: { anchor: 'bottom', y_offset: 100, safe_area: { top_percent: 10, bottom_percent: 20, side_percent: 10 } },
        display: { max_lines: 2, max_line_width_percent: 80, overflow_behavior: 'wrap', words_per_segment: 5 },
        animation: { entrance_keyframe_id: null, exit_keyframe_id: null, highlight_keyframe_id: null, transform_origin: null },
    }
}

function defaultHookConfig() {
    return {
        text: {
            lines: [
                { font_family: null, font_size: null, font_weight: null, color: null, letter_spacing: null, text_transform: null },
                { font_family: null, font_size: null, font_weight: null, color: null, letter_spacing: null, text_transform: null },
            ],
            default_font: { family: 'Inter', weight: '700', size: 48, color: '#FFFFFF', letter_spacing: 0 },
        },
        box: { enabled: false, color: '#000000', opacity: 0.7, padding: 16, border_radius: 12, border_color: null, border_width: 0 },
        position: { anchor: 'center', y_offset: 0, x_offset: 0 },
        animation: { entrance_keyframe_id: null, transform_origin: null, per_line: [] },
        decorations: { divider: { enable: false }, emoji_row: { enable: false }, badge: { enable: false } },
        effects: { flash: { enable: false }, particles: { enable: false } },
        overlay: { gradient_top: { enable: false }, gradient_bottom: { enable: false } },
        timing: { display_duration_seconds: 3.0, delay_before_seconds: 0.5 },
    }
}

// ─── Reusable UI Controls ──────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-text-primary)' }}
            >
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--icon-accent)' }}>{icon}</span>
                <span className="text-sm font-semibold flex-1">{title}</span>
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-muted)' }}>
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 flex flex-col gap-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function FieldLabel({ label, htmlFor }) {
    return (
        <label htmlFor={htmlFor} className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
        </label>
    )
}

function SliderField({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }) {
    const id = `slider-${label.replace(/\s/g, '-').toLowerCase()}`
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <FieldLabel label={label} htmlFor={id} />
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{value}{unit}</span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--color-accent)]"
                style={{ background: 'var(--color-bg-input)' }}
            />
        </div>
    )
}

function SelectField({ label, value, onChange, options }) {
    const id = `select-${label.replace(/\s/g, '-').toLowerCase()}`
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel label={label} htmlFor={id} />
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    )
}

function ColorField({ label, value, onChange }) {
    const id = `color-${label.replace(/\s/g, '-').toLowerCase()}`
    return (
        <div className="flex items-center gap-2">
            <FieldLabel label={label} htmlFor={id} />
            <div className="flex items-center gap-2 ml-auto">
                <input
                    id={id}
                    type="color"
                    value={value || '#FFFFFF'}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-7 h-7 rounded-md border-0 cursor-pointer"
                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)' }}
                />
                <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--color-text-muted)' }}>{value || '#FFFFFF'}</span>
            </div>
        </div>
    )
}

function ToggleField({ label, checked, onChange }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
                style={{ background: checked ? 'var(--color-accent)' : 'var(--color-surface-3)' }}
            >
                <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform bg-white"
                    style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
                />
            </button>
        </div>
    )
}

function NumberField({ label, value, onChange, min, max, step = 1 }) {
    const id = `number-${label.replace(/\s/g, '-').toLowerCase()}`
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel label={label} htmlFor={id} />
            <input
                id={id}
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
            />
        </div>
    )
}

// ─── Main StyleEditor Component ────────────────────────────────────────────

export default function StyleEditor({ type = 'caption', template = null, onSave }) {
    // Fetched data
    const [fonts, setFonts] = useState([])
    const [keyframes, setKeyframes] = useState([])
    const [, setLoadingFonts] = useState(true)
    const [, setLoadingKeyframes] = useState(true)

    // Template metadata
    const [name, setName] = useState(template?.name || '')
    const [description, setDescription] = useState(template?.description || '')
    const [category, setCategory] = useState(template?.category || 'general')
    const [styleType, setStyleType] = useState(template?.style_type || 'animated')

    // Config state — initialized from template or defaults
    const [config, setConfig] = useState(() => {
        if (template?.config) return JSON.parse(JSON.stringify(template.config))
        return type === 'caption' ? defaultCaptionConfig() : defaultHookConfig()
    })

    // Export/save state
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [previewKey, setPreviewKey] = useState(0)

    // ─── Fetch fonts and keyframes ────────────────────────────────────
    useEffect(() => {
        async function fetchFonts() {
            try {
                const data = await api.getFonts()
                setFonts(Array.isArray(data) ? data : data?.fonts || [])
            } catch {
                toast.error('Failed to load fonts')
            } finally {
                setLoadingFonts(false)
            }
        }
        fetchFonts()
    }, [])

    useEffect(() => {
        async function fetchKeyframes() {
            try {
                const data = await api._req('/api/v1/keyframes')
                const items = Array.isArray(data) ? data : data?.items || data?.keyframes || []
                setKeyframes(items)
            } catch {
                toast.error('Failed to load animations')
            } finally {
                setLoadingKeyframes(false)
            }
        }
        fetchKeyframes()
    }, [])

    // ─── Config helpers (immutable updates) ───────────────────────────
    const updateConfig = useCallback((path, value) => {
        setConfig(prev => {
            const next = JSON.parse(JSON.stringify(prev))
            const keys = path.split('.')
            let obj = next
            for (let i = 0; i < keys.length - 1; i++) {
                if (!obj[keys[i]]) obj[keys[i]] = {}
                obj = obj[keys[i]]
            }
            obj[keys[keys.length - 1]] = value
            return next
        })
    }, [])

    // ─── Derived template object for preview ──────────────────────────
    const previewTemplate = useMemo(() => ({
        name,
        description,
        category,
        style_type: styleType,
        config,
    }), [name, description, category, styleType, config])

    // ─── Font options ─────────────────────────────────────────────────
    const fontOptions = useMemo(() => {
        if (!fonts.length) return [{ value: 'Inter', label: 'Inter' }]
        return fonts.map(f => ({ value: f.name || f.family || f.font_family, label: f.name || f.family || f.font_family }))
    }, [fonts])

    // ─── Keyframe animation options ──────────────────────────────────
    const keyframeOptions = useMemo(() => {
        const none = [{ value: '', label: '— None (Static) —' }]
        const items = keyframes.map(kf => ({
            value: String(kf.id),
            label: `${kf.name}${kf.description ? ` — ${kf.description}` : ''}`,
        }))
        return [...none, ...items]
    }, [keyframes])

    // ─── Preview Animation reset ─────────────────────────────────────
    const handlePreviewAnimation = useCallback(() => {
        setPreviewKey(k => k + 1)
    }, [])

    // ─── Export Keyframes ────────────────────────────────────────────
    const handleExportKeyframes = useCallback(async () => {
        setExporting(true)
        try {
            // Determine which keyframe_id to export based on type
            let keyframeId = null
            if (type === 'caption') {
                keyframeId = config.animation?.entrance_keyframe_id
            } else {
                keyframeId = config.animation?.entrance_keyframe_id
            }

            if (!keyframeId) {
                toast.error('No animation selected to export')
                setExporting(false)
                return
            }

            const selectedKf = keyframes.find(kf => kf.id === Number(keyframeId))
            if (!selectedKf) {
                toast.error('Selected animation not found')
                setExporting(false)
                return
            }

            // Build animation params for baking
            const animationParams = {
                type: 'spring',
                initial: { scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 },
                target: { scale: 1, opacity: 1, x: 0, y: 0, rotation: 0 },
                spring: { stiffness: 100, damping: 10, mass: 1 },
            }

            // Bake the animation
            const frames = bakeAnimation(animationParams, 30)
            const reduced = applyKeyPointReduction(frames)
            const hash = await computeParamsHash(animationParams)

            // Export to backend
            await exportToBackend(selectedKf.name, 30, reduced, hash)
            toast.success('Keyframes exported successfully!')
        } catch (err) {
            toast.error(err.message || 'Export failed')
        } finally {
            setExporting(false)
        }
    }, [type, config.animation, keyframes])

    // ─── Save handler with keyframe_id validation ────────────────────
    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            toast.error('Template name is required')
            return
        }

        // Validate keyframe_id references exist
        const referencedIds = []
        if (type === 'caption') {
            const anim = config.animation || {}
            if (anim.entrance_keyframe_id) referencedIds.push(anim.entrance_keyframe_id)
            if (anim.exit_keyframe_id) referencedIds.push(anim.exit_keyframe_id)
            if (anim.highlight_keyframe_id) referencedIds.push(anim.highlight_keyframe_id)
        } else {
            const anim = config.animation || {}
            if (anim.entrance_keyframe_id) referencedIds.push(anim.entrance_keyframe_id)
            if (anim.per_line) {
                anim.per_line.forEach(pl => {
                    if (pl.keyframe_id) referencedIds.push(pl.keyframe_id)
                })
            }
        }

        // Check all referenced IDs exist in loaded keyframes
        const existingIds = new Set(keyframes.map(kf => kf.id))
        const missing = referencedIds.filter(id => !existingIds.has(Number(id)))
        if (missing.length > 0) {
            toast.error(`Invalid animation reference(s): ID ${missing.join(', ')} not found in registry`)
            return
        }

        setSaving(true)
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                category,
                style_type: styleType,
                config,
            }

            let result
            const endpoint = type === 'caption' ? '/api/v1/caption-templates' : '/api/v1/hook-templates'

            if (template?.id) {
                // Update existing
                result = await api._req(`${endpoint}/${template.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                })
            } else {
                // Create new
                result = await api._req(endpoint, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })
            }

            toast.success(template?.id ? 'Template updated!' : 'Template created!')
            if (onSave) onSave(result)
        } catch (err) {
            toast.error(err.message || 'Failed to save template')
        } finally {
            setSaving(false)
        }
    }, [name, description, category, styleType, config, type, template, keyframes, onSave])

    // ─── Caption-specific controls ───────────────────────────────────
    function renderCaptionControls() {
        const font = config.font || {}
        const colors = config.colors || {}
        const highlight = config.highlight || {}
        const animation = config.animation || {}

        return (
            <>
                {/* Font Controls */}
                <Section title="Font" icon="text_fields">
                    <SelectField
                        label="Font Family"
                        value={font.family || 'Inter'}
                        onChange={(v) => updateConfig('font.family', v)}
                        options={fontOptions}
                    />
                    <SliderField
                        label="Font Size"
                        value={font.size || 48}
                        onChange={(v) => updateConfig('font.size', v)}
                        min={8}
                        max={200}
                        unit="px"
                    />
                    <SelectField
                        label="Font Weight"
                        value={font.weight || '700'}
                        onChange={(v) => updateConfig('font.weight', v)}
                        options={[
                            { value: '400', label: 'Regular (400)' },
                            { value: '500', label: 'Medium (500)' },
                            { value: '600', label: 'Semibold (600)' },
                            { value: '700', label: 'Bold (700)' },
                            { value: '800', label: 'Extrabold (800)' },
                            { value: '900', label: 'Black (900)' },
                        ]}
                    />
                    <SliderField
                        label="Letter Spacing"
                        value={font.letter_spacing || 0}
                        onChange={(v) => updateConfig('font.letter_spacing', v)}
                        min={-5}
                        max={20}
                        step={0.5}
                        unit="px"
                    />
                    <SelectField
                        label="Text Transform"
                        value={font.text_transform || 'none'}
                        onChange={(v) => updateConfig('font.text_transform', v)}
                        options={[
                            { value: 'none', label: 'None' },
                            { value: 'uppercase', label: 'UPPERCASE' },
                            { value: 'lowercase', label: 'lowercase' },
                        ]}
                    />
                </Section>

                {/* Colors */}
                <Section title="Colors" icon="palette">
                    <ColorField label="Primary Color" value={colors.primary} onChange={(v) => updateConfig('colors.primary', v)} />
                    <ColorField label="Secondary Color" value={colors.secondary} onChange={(v) => updateConfig('colors.secondary', v)} />
                    <ColorField label="Highlight Color" value={highlight.color} onChange={(v) => updateConfig('highlight.color', v)} />
                    <SelectField
                        label="Highlight Style"
                        value={highlight.style || 'color'}
                        onChange={(v) => updateConfig('highlight.style', v)}
                        options={[
                            { value: 'color', label: 'Color Change' },
                            { value: 'background', label: 'Background' },
                            { value: 'glow', label: 'Glow' },
                            { value: 'scale', label: 'Scale' },
                            { value: 'underline', label: 'Underline' },
                        ]}
                    />
                    <SelectField
                        label="Highlight Transition"
                        value={highlight.transition || 'smooth'}
                        onChange={(v) => updateConfig('highlight.transition', v)}
                        options={[
                            { value: 'instant', label: 'Instant' },
                            { value: 'smooth', label: 'Smooth' },
                            { value: 'bounce', label: 'Bounce' },
                        ]}
                    />
                    <SliderField
                        label="Transition Duration"
                        value={highlight.transition_duration_ms || 200}
                        onChange={(v) => updateConfig('highlight.transition_duration_ms', v)}
                        min={50}
                        max={500}
                        step={10}
                        unit="ms"
                    />
                </Section>

                {/* Animation Selector */}
                <Section title="Animation" icon="animation">
                    <SelectField
                        label="Entrance Animation"
                        value={animation.entrance_keyframe_id ? String(animation.entrance_keyframe_id) : ''}
                        onChange={(v) => updateConfig('animation.entrance_keyframe_id', v ? Number(v) : null)}
                        options={keyframeOptions}
                    />
                    <SelectField
                        label="Exit Animation"
                        value={animation.exit_keyframe_id ? String(animation.exit_keyframe_id) : ''}
                        onChange={(v) => updateConfig('animation.exit_keyframe_id', v ? Number(v) : null)}
                        options={keyframeOptions}
                    />
                    <SelectField
                        label="Highlight Animation"
                        value={animation.highlight_keyframe_id ? String(animation.highlight_keyframe_id) : ''}
                        onChange={(v) => updateConfig('animation.highlight_keyframe_id', v ? Number(v) : null)}
                        options={keyframeOptions}
                    />
                </Section>

                {/* Background */}
                <Section title="Background" icon="crop_square" defaultOpen={false}>
                    <ToggleField label="Enable Background" checked={config.background?.enabled || false} onChange={(v) => updateConfig('background.enabled', v)} />
                    {config.background?.enabled && (
                        <>
                            <ColorField label="Background Color" value={config.background?.color} onChange={(v) => updateConfig('background.color', v)} />
                            <SliderField label="Opacity" value={config.background?.opacity || 0.7} onChange={(v) => updateConfig('background.opacity', v)} min={0} max={1} step={0.05} />
                            <SliderField label="Padding X" value={config.background?.padding_x || 8} onChange={(v) => updateConfig('background.padding_x', v)} min={0} max={40} unit="px" />
                            <SliderField label="Padding Y" value={config.background?.padding_y || 4} onChange={(v) => updateConfig('background.padding_y', v)} min={0} max={20} unit="px" />
                            <SliderField label="Border Radius" value={config.background?.border_radius || 8} onChange={(v) => updateConfig('background.border_radius', v)} min={0} max={30} unit="px" />
                        </>
                    )}
                </Section>

                {/* Shadow */}
                <Section title="Shadow" icon="blur_on" defaultOpen={false}>
                    <ToggleField label="Enable Shadow" checked={config.shadow?.enabled || false} onChange={(v) => updateConfig('shadow.enabled', v)} />
                    {config.shadow?.enabled && (
                        <>
                            <ColorField label="Shadow Color" value={config.shadow?.color} onChange={(v) => updateConfig('shadow.color', v)} />
                            <SliderField label="Blur" value={config.shadow?.blur || 4} onChange={(v) => updateConfig('shadow.blur', v)} min={0} max={30} unit="px" />
                            <SliderField label="Offset X" value={config.shadow?.offset_x || 0} onChange={(v) => updateConfig('shadow.offset_x', v)} min={-20} max={20} unit="px" />
                            <SliderField label="Offset Y" value={config.shadow?.offset_y || 2} onChange={(v) => updateConfig('shadow.offset_y', v)} min={-20} max={20} unit="px" />
                        </>
                    )}
                </Section>

                {/* Outline */}
                <Section title="Outline" icon="border_style" defaultOpen={false}>
                    <ToggleField label="Enable Outline" checked={config.outline?.enabled || false} onChange={(v) => updateConfig('outline.enabled', v)} />
                    {config.outline?.enabled && (
                        <>
                            <ColorField label="Outline Color" value={config.outline?.color} onChange={(v) => updateConfig('outline.color', v)} />
                            <SliderField label="Width" value={config.outline?.width || 2} onChange={(v) => updateConfig('outline.width', v)} min={1} max={8} unit="px" />
                        </>
                    )}
                </Section>
            </>
        )
    }

    // ─── Hook-specific controls ──────────────────────────────────────
    function renderHookControls() {
        const textConfig = config.text || {}
        const defaultFont = textConfig.default_font || {}
        const lines = textConfig.lines || []
        const animation = config.animation || {}
        const boxConfig = config.box || {}

        return (
            <>
                {/* Default Font */}
                <Section title="Default Font" icon="text_fields">
                    <SelectField
                        label="Font Family"
                        value={defaultFont.family || 'Inter'}
                        onChange={(v) => updateConfig('text.default_font.family', v)}
                        options={fontOptions}
                    />
                    <SliderField
                        label="Font Size"
                        value={defaultFont.size || 48}
                        onChange={(v) => updateConfig('text.default_font.size', v)}
                        min={8}
                        max={200}
                        unit="px"
                    />
                    <SelectField
                        label="Font Weight"
                        value={defaultFont.weight || '700'}
                        onChange={(v) => updateConfig('text.default_font.weight', v)}
                        options={[
                            { value: '400', label: 'Regular (400)' },
                            { value: '500', label: 'Medium (500)' },
                            { value: '600', label: 'Semibold (600)' },
                            { value: '700', label: 'Bold (700)' },
                            { value: '800', label: 'Extrabold (800)' },
                            { value: '900', label: 'Black (900)' },
                        ]}
                    />
                    <ColorField label="Text Color" value={defaultFont.color || '#FFFFFF'} onChange={(v) => updateConfig('text.default_font.color', v)} />
                    <SliderField
                        label="Letter Spacing"
                        value={defaultFont.letter_spacing || 0}
                        onChange={(v) => updateConfig('text.default_font.letter_spacing', v)}
                        min={-5}
                        max={20}
                        step={0.5}
                        unit="px"
                    />
                </Section>

                {/* Per-Line Config */}
                <Section title="Per-Line Config" icon="format_list_numbered">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{lines.length} line(s)</span>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const newLines = [...lines, { font_family: null, font_size: null, font_weight: null, color: null, letter_spacing: null, text_transform: null }]
                                    updateConfig('text.lines', newLines)
                                    // Add corresponding per_line animation entry
                                    const perLine = [...(animation.per_line || [])]
                                    perLine.push({ keyframe_id: null, delay_ms: perLine.length * 150, transform_origin: null })
                                    updateConfig('animation.per_line', perLine)
                                }}
                                className="px-2 py-1 rounded-md text-xs cursor-pointer"
                                style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}
                                aria-label="Add line"
                            >
                                <span className="material-symbols-outlined text-[14px]">add</span>
                            </button>
                            {lines.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newLines = lines.slice(0, -1)
                                        updateConfig('text.lines', newLines)
                                        const perLine = (animation.per_line || []).slice(0, -1)
                                        updateConfig('animation.per_line', perLine)
                                    }}
                                    className="px-2 py-1 rounded-md text-xs cursor-pointer"
                                    style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)', border: '1px solid var(--color-error-border)' }}
                                    aria-label="Remove last line"
                                >
                                    <span className="material-symbols-outlined text-[14px]">remove</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {lines.map((line, idx) => (
                        <div
                            key={idx}
                            className="rounded-lg p-3 flex flex-col gap-2"
                            style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>Line {idx + 1}</span>
                            </div>
                            <SelectField
                                label="Font Override"
                                value={line.font_family || ''}
                                onChange={(v) => {
                                    const newLines = [...lines]
                                    newLines[idx] = { ...newLines[idx], font_family: v || null }
                                    updateConfig('text.lines', newLines)
                                }}
                                options={[{ value: '', label: '— Use Default —' }, ...fontOptions]}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <NumberField
                                    label="Size"
                                    value={line.font_size || ''}
                                    onChange={(v) => {
                                        const newLines = [...lines]
                                        newLines[idx] = { ...newLines[idx], font_size: v || null }
                                        updateConfig('text.lines', newLines)
                                    }}
                                    min={8}
                                    max={200}
                                />
                                <NumberField
                                    label="Delay (ms)"
                                    value={animation.per_line?.[idx]?.delay_ms || 0}
                                    onChange={(v) => {
                                        const perLine = [...(animation.per_line || [])]
                                        while (perLine.length <= idx) perLine.push({ keyframe_id: null, delay_ms: 0, transform_origin: null })
                                        perLine[idx] = { ...perLine[idx], delay_ms: Math.max(0, Math.min(5000, v)) }
                                        updateConfig('animation.per_line', perLine)
                                    }}
                                    min={0}
                                    max={5000}
                                />
                            </div>
                            <ColorField
                                label="Color"
                                value={line.color || defaultFont.color || '#FFFFFF'}
                                onChange={(v) => {
                                    const newLines = [...lines]
                                    newLines[idx] = { ...newLines[idx], color: v }
                                    updateConfig('text.lines', newLines)
                                }}
                            />
                            <SelectField
                                label="Line Animation"
                                value={animation.per_line?.[idx]?.keyframe_id ? String(animation.per_line[idx].keyframe_id) : ''}
                                onChange={(v) => {
                                    const perLine = [...(animation.per_line || [])]
                                    while (perLine.length <= idx) perLine.push({ keyframe_id: null, delay_ms: 0, transform_origin: null })
                                    perLine[idx] = { ...perLine[idx], keyframe_id: v ? Number(v) : null }
                                    updateConfig('animation.per_line', perLine)
                                }}
                                options={keyframeOptions}
                            />
                        </div>
                    ))}
                </Section>

                {/* Container Animation */}
                <Section title="Container Animation" icon="animation">
                    <SelectField
                        label="Entrance Animation"
                        value={animation.entrance_keyframe_id ? String(animation.entrance_keyframe_id) : ''}
                        onChange={(v) => updateConfig('animation.entrance_keyframe_id', v ? Number(v) : null)}
                        options={keyframeOptions}
                    />
                </Section>

                {/* Box / Background */}
                <Section title="Box / Background" icon="crop_square" defaultOpen={false}>
                    <ToggleField label="Enable Box" checked={boxConfig.enabled || false} onChange={(v) => updateConfig('box.enabled', v)} />
                    {boxConfig.enabled && (
                        <>
                            <ColorField label="Box Color" value={boxConfig.color} onChange={(v) => updateConfig('box.color', v)} />
                            <SliderField label="Opacity" value={boxConfig.opacity || 0.7} onChange={(v) => updateConfig('box.opacity', v)} min={0} max={1} step={0.05} />
                            <SliderField label="Padding" value={boxConfig.padding || 16} onChange={(v) => updateConfig('box.padding', v)} min={0} max={60} unit="px" />
                            <SliderField label="Border Radius" value={boxConfig.border_radius || 12} onChange={(v) => updateConfig('box.border_radius', v)} min={0} max={40} unit="px" />
                        </>
                    )}
                </Section>

                {/* Shadow */}
                <Section title="Shadow" icon="blur_on" defaultOpen={false}>
                    <ToggleField label="Enable Shadow" checked={config.shadow?.enabled || false} onChange={(v) => updateConfig('shadow.enabled', v)} />
                    {config.shadow?.enabled && (
                        <>
                            <ColorField label="Shadow Color" value={config.shadow?.color || '#000000'} onChange={(v) => updateConfig('shadow.color', v)} />
                            <SliderField label="Blur" value={config.shadow?.blur || 4} onChange={(v) => updateConfig('shadow.blur', v)} min={0} max={30} unit="px" />
                            <SliderField label="Offset X" value={config.shadow?.offset_x || 0} onChange={(v) => updateConfig('shadow.offset_x', v)} min={-20} max={20} unit="px" />
                            <SliderField label="Offset Y" value={config.shadow?.offset_y || 2} onChange={(v) => updateConfig('shadow.offset_y', v)} min={-20} max={20} unit="px" />
                        </>
                    )}
                </Section>

                {/* Outline */}
                <Section title="Outline" icon="border_style" defaultOpen={false}>
                    <ToggleField label="Enable Outline" checked={config.outline?.enabled || false} onChange={(v) => updateConfig('outline.enabled', v)} />
                    {config.outline?.enabled && (
                        <>
                            <ColorField label="Outline Color" value={config.outline?.color || '#000000'} onChange={(v) => updateConfig('outline.color', v)} />
                            <SliderField label="Width" value={config.outline?.width || 2} onChange={(v) => updateConfig('outline.width', v)} min={1} max={8} unit="px" />
                        </>
                    )}
                </Section>

                {/* Timing */}
                <Section title="Timing" icon="timer" defaultOpen={false}>
                    <SliderField
                        label="Display Duration"
                        value={config.timing?.display_duration_seconds || 3.0}
                        onChange={(v) => updateConfig('timing.display_duration_seconds', v)}
                        min={1}
                        max={10}
                        step={0.5}
                        unit="s"
                    />
                    <SliderField
                        label="Delay Before"
                        value={config.timing?.delay_before_seconds || 0.5}
                        onChange={(v) => updateConfig('timing.delay_before_seconds', v)}
                        min={0}
                        max={5}
                        step={0.1}
                        unit="s"
                    />
                </Section>
            </>
        )
    }

    // ─── Render ──────────────────────────────────────────────────────
    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
            {/* Left: Controls Panel (scrollable) */}
            <div className="flex-1 min-w-0 overflow-y-auto pr-2 flex flex-col gap-4 max-h-[calc(100vh-180px)]">
                {/* Template Metadata */}
                <Section title="Template Info" icon="info">
                    <div className="flex flex-col gap-1">
                        <FieldLabel label="Name" htmlFor="template-name" />
                        <input
                            id="template-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Neon Glow Bounce"
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <FieldLabel label="Description" htmlFor="template-desc" />
                        <textarea
                            id="template-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Optional description..."
                            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                            style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <SelectField
                            label="Category"
                            value={category}
                            onChange={setCategory}
                            options={[
                                { value: 'general', label: 'General' },
                                { value: 'viral', label: 'Viral' },
                                { value: 'professional', label: 'Professional' },
                                { value: 'cinematic', label: 'Cinematic' },
                                { value: 'playful', label: 'Playful' },
                                { value: 'minimal', label: 'Minimal' },
                            ]}
                        />
                        <SelectField
                            label="Style Type"
                            value={styleType}
                            onChange={setStyleType}
                            options={[
                                { value: 'animated', label: 'Animated' },
                                { value: 'static', label: 'Static' },
                            ]}
                        />
                    </div>
                </Section>

                {/* Type-specific controls */}
                {type === 'caption' ? renderCaptionControls() : renderHookControls()}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-2 pb-4">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handlePreviewAnimation}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-90"
                            style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', border: '1px solid var(--btn-secondary-border)' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                            Preview Animation
                        </button>
                        <button
                            type="button"
                            onClick={handleExportKeyframes}
                            disabled={exporting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--color-info-bg)', color: 'var(--color-info-text)', border: '1px solid var(--color-info-border)' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">{exporting ? 'hourglass_empty' : 'upload'}</span>
                            {exporting ? 'Exporting...' : 'Export Keyframes'}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
                    >
                        <span className="material-symbols-outlined text-[18px]">{saving ? 'hourglass_empty' : 'save'}</span>
                        {saving ? 'Saving...' : (template?.id ? 'Update Template' : 'Create Template')}
                    </button>
                </div>
            </div>

            {/* Right: Live Preview (sticky) */}
            <div className="lg:w-[320px] flex-shrink-0 sticky top-0 self-start">
                <div
                    className="rounded-xl p-4 flex flex-col items-center gap-3"
                    style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
                >
                    <div className="flex items-center gap-2 w-full">
                        <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>visibility</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Live Preview</span>
                        {styleType === 'animated' && (
                            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}>
                                Animated
                            </span>
                        )}
                    </div>
                    <KeyframePreview
                        key={previewKey}
                        template={previewTemplate}
                        type={type}
                        text={type === 'hook' ? 'Sample Hook\nText Preview\nLine Three' : undefined}
                        words={type === 'caption' ? ['This', 'is', 'how', 'your', 'caption', 'looks'] : undefined}
                    />
                    <p className="text-[10px] text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Changes update in real-time
                    </p>
                </div>
            </div>
        </div>
    )
}
