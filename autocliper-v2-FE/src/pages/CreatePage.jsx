import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, loadGoogleFonts, getAuthenticatedMediaUrl } from '../utils/api'
import KeyframePreview from '../components/KeyframePreview'
import ResolutionSelector from '../components/ResolutionSelector'

// ─── Legacy Style Card Utilities (inlined from removed remotionStyleUtils.js) ──
function buildCaptionWordStyle(template, { isHighlight = false, scale = 1 } = {}) {
    if (!template) return {}
    const fontSize = Math.max(10, Math.round((template.font_size || 48) * scale))
    const outlineW = (template.outline_width || 0) * scale
    const shadowX = (template.shadow_offset_x || 0) * scale
    const shadowY = (template.shadow_offset_y || 0) * scale
    const shadowBlur = (template.shadow_blur || 4) * scale
    const baseShadow = template.shadow_enabled !== false
        ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${template.shadow_color || '#000000'}`
        : '0 1px 3px rgba(0,0,0,0.8)'
    const base = {
        color: isHighlight ? (template.highlight_color || '#FFD700') : (template.color || '#FFFFFF'),
        fontFamily: template.font_family || 'Inter',
        fontSize: `${fontSize}px`,
        fontWeight: template.font_weight || '700',
        lineHeight: template.line_height || 1.3,
        display: 'inline-block',
        textShadow: baseShadow,
        textTransform: template.text_transform || 'none',
    }
    if (template.outline_enabled && outlineW > 0.5) {
        base.WebkitTextStroke = `${outlineW}px ${template.outline_color || '#000000'}`
    }
    if (isHighlight) {
        const hlStyle = template.highlight_style || 'color'
        if (hlStyle === 'glow') {
            const glowColor = template.highlight_color || '#FFD700'
            base.textShadow = `0 0 ${6 * scale}px ${glowColor}, 0 0 ${14 * scale}px ${glowColor}60, ${baseShadow}`
        }
        if (hlStyle === 'scale') base.transform = 'scale(1.12)'
        if (hlStyle === 'background') {
            base.backgroundColor = `${template.highlight_color || '#FFD700'}30`
            base.padding = `${1 * scale}px ${4 * scale}px`
            base.borderRadius = `${4 * scale}px`
        }
    }
    return base
}

function buildCaptionPillStyle(template, { scale = 1 } = {}) {
    if (!template || !template.bg_enabled) return {}
    const bgColor = template.bg_color || '#000000'
    const bgOpacity = template.bg_opacity ?? 0.7
    const bgPadX = (template.bg_padding_x || 12) * scale
    const bgPadY = (template.bg_padding_y || 6) * scale
    const bgRadius = (template.bg_border_radius || 8) * scale
    const alpha = Math.round(bgOpacity * 255).toString(16).padStart(2, '0')
    return { background: `${bgColor}${alpha}`, padding: `${bgPadY}px ${bgPadX}px`, borderRadius: `${bgRadius}px`, display: 'inline-block' }
}

function buildHookWordStyle(template, { isKeyword = false, scale = 1 } = {}) {
    if (!template) return {}
    const fontSize = isKeyword
        ? Math.round((template.font_size_keyword || 56) * scale)
        : Math.round((template.font_size_normal || 36) * scale)
    const shadow = template.shadow_enabled !== false
        ? `0 ${(template.shadow_offset_y || 3) * scale}px ${(template.shadow_blur || 12) * scale}px ${template.shadow_color || '#000000'}`
        : '0 1px 3px rgba(0,0,0,0.8)'
    const base = {
        color: isKeyword ? (template.keyword_color || '#FFFFFF') : (template.color || '#FFFFFF'),
        fontFamily: template.font_family || 'Anton',
        fontSize: `${fontSize}px`,
        fontWeight: isKeyword ? '900' : (template.font_weight || '400'),
        textShadow: shadow,
        textTransform: template.text_transform || 'uppercase',
        lineHeight: 1.2,
        margin: 0,
    }
    if (isKeyword && template.glow_enabled) {
        const gc = template.glow_color || template.keyword_color || '#FFFFFF'
        const gr = (template.glow_radius || 8) * scale
        base.textShadow = `0 0 ${gr}px ${gc}, 0 0 ${gr * 2}px ${gc}50, ${shadow}`
    }
    return base
}

function buildHookBoxStyle(template, { scale = 1 } = {}) {
    if (!template || !template.box_enabled) return {}
    const color = template.box_color || '#000000'
    const opacity = template.box_opacity ?? 0.6
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0')
    return {
        background: `${color}${alpha}`,
        padding: `${(template.box_padding || 20) * scale}px`,
        borderRadius: `${(template.box_border_radius || 12) * scale}px`,
        ...(template.box_border_width > 0 ? { border: `${template.box_border_width * scale}px solid ${template.box_border_color || 'transparent'}` } : {}),
    }
}

// ─── Keyframe config → flat style mappers (for CaptionStyleCard / HookStyleCard) ──
function flattenCaptionConfig(template) {
    if (!template) return null
    const cfg = template.config || {}
    const font = cfg.font || {}
    const colors = cfg.colors || {}
    const highlight = cfg.highlight || {}
    const outline = cfg.outline || {}
    const shadow = cfg.shadow || {}
    const bg = cfg.background || {}
    return {
        id: template.id,
        name: template.name,
        font_family: font.family || 'Arial',
        font_weight: font.weight || 'bold',
        font_size: font.size || 48,
        text_transform: font.text_transform || 'none',
        line_height: font.line_height || 1.3,
        color: colors.primary || '#FFFFFF',
        highlight_color: highlight.color || '#FFD700',
        highlight_style: highlight.style || 'color',
        outline_enabled: outline.enabled ?? false,
        outline_color: outline.color || '#000000',
        outline_width: outline.width || 0,
        shadow_enabled: shadow.enabled ?? true,
        shadow_color: shadow.color || '#000000',
        shadow_blur: shadow.blur || 4,
        shadow_offset_x: shadow.offset_x || 0,
        shadow_offset_y: shadow.offset_y || 2,
        bg_enabled: bg.enabled ?? false,
        bg_color: bg.color || '#000000',
        bg_opacity: bg.opacity ?? 0.5,
        bg_padding_x: bg.padding_x || 12,
        bg_padding_y: bg.padding_y || 6,
        bg_border_radius: bg.border_radius || 6,
        // Preserve original template data for submission
        _template: template,
    }
}

function flattenHookConfig(template) {
    if (!template) return null
    const cfg = template.config || {}
    const text = cfg.text || {}
    const defaultFont = text.default_font || {}
    const lines = text.lines || []
    const box = cfg.box || {}
    const firstLine = lines[0] || {}
    return {
        id: template.id,
        name: template.name,
        font_family: defaultFont.family || firstLine.font_family || 'Impact',
        font_size_normal: defaultFont.size || 48,
        font_size_keyword: firstLine.font_size || 60,
        font_weight: defaultFont.weight || 'bold',
        color: defaultFont.color || '#FFFFFF',
        keyword_color: firstLine.color || '#FFD700',
        text_transform: firstLine.text_transform || 'uppercase',
        shadow_enabled: true,
        shadow_color: '#000000',
        shadow_blur: 8,
        shadow_offset_y: 3,
        glow_enabled: false,
        glow_color: '#FFFFFF',
        glow_radius: 8,
        box_enabled: box.enabled ?? false,
        box_color: box.color || '#000000',
        box_opacity: box.opacity ?? 0.6,
        box_padding: box.padding || 20,
        box_border_radius: box.border_radius || 0,
        box_border_width: box.border_width || 0,
        box_border_color: box.border_color || 'transparent',
        // Preserve original template data for submission
        _template: template,
    }
}

const PREVIEW_BG = "https://lh3.googleusercontent.com/aida-public/AB6AXuBR8v7XkC5vNu8cT77RaDOH4JfdHz-jjqDZnXfNWnC1yftxffImbLrXQnp0Wc7uCVKDdmFIGTKf4i0uR3BneXMYGm4g0sURS6lQWj20A_od6g5NVwaRH39JjwGctm7e8L_ixngiEO7COOxJdLZp0AJg0K2Xay6coqna9CtqsDt92xch-THdSapYp4bQ9Nq_WQmkhDhFv_qS3ft45j18zz402xoje1TvphZHMvgRNUwa2hMhsJoIORa3iCMC9UUNE_TWVNWgtkTEXgRi"

function hookShadow(hs) {
    if (!hs.shadow_enabled) return 'none'
    return hs.shadow_blur === 0
        ? `2px 4px 0px ${hs.shadow_color || 'rgba(0,0,0,0.7)'}`
        : `0px 0px ${hs.shadow_blur}px ${hs.shadow_color || 'rgba(0,0,0,0.7)'}`
}

function hookBoxBg(hs) {
    if (!hs.box_enabled) return 'transparent'
    const r = parseInt(hs.box_color.slice(1, 3), 16)
    const g = parseInt(hs.box_color.slice(3, 5), 16)
    const b = parseInt(hs.box_color.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${hs.box_opacity || 0.6})`
}

// ─── Animated Caption Style Card ────────────────────────────────────────────
function CaptionStyleCard({ style, isActive, onSelect, index }) {
    const [hlIdx, setHlIdx] = useState(1) // which word is highlighted
    const words = ['sample', 'caption', 'style']

    useEffect(() => {
        const interval = setInterval(() => {
            setHlIdx(prev => (prev + 1) % words.length)
        }, 900)
        return () => clearInterval(interval)
    }, [])

    // Use shared utility for consistent rendering
    const CARD_SCALE = 0.3 // card is about 30% of 1080
    const normalCss = buildCaptionWordStyle(style, { isHighlight: false, scale: CARD_SCALE })
    const highlightCss = buildCaptionWordStyle(style, { isHighlight: true, scale: CARD_SCALE })
    const pillCss = buildCaptionPillStyle(style, { scale: CARD_SCALE })

    return (
        <motion.button layout
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            onClick={() => onSelect(style)}
            className="relative rounded-xl overflow-hidden transition-all group"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
            }}>
            <div className="aspect-[5/4] flex items-center justify-center relative overflow-hidden p-3" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92), rgba(15,8,25,0.95))' }}>
                <div className="text-center relative z-10 flex flex-wrap justify-center gap-x-1.5 items-baseline" style={pillCss}>
                    {words.map((word, wi) => {
                        const isHighlighted = wi === hlIdx
                        return (
                            <motion.span
                                key={wi}
                                animate={{
                                    scale: isHighlighted && style.highlight_style === 'scale' ? 1.15 : 1,
                                }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                style={isHighlighted ? highlightCss : normalCss}
                            >
                                {word}
                            </motion.span>
                        )
                    })}
                </div>
                <motion.div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/3 to-white/8 opacity-0 group-hover:opacity-100 transition-opacity" />
                {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg z-10" style={{ background: 'var(--color-accent)' }}><span className="material-symbols-outlined text-white text-[10px]">check</span></motion.div>}
            </div>
            <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: 'var(--color-surface-1)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>{style.name}</p>
                <p className="text-[8px] truncate ml-1" style={{ color: 'var(--color-text-muted)' }}>{style.font_family}</p>
            </div>
        </motion.button>
    )
}

// ─── Animated Hook Style Card ───────────────────────────────────────────────
function HookStyleCard({ hs, isActive, onSelect, index }) {
    const [pulse, setPulse] = useState(false)

    useEffect(() => {
        const interval = setInterval(() => setPulse(p => !p), 1200)
        return () => clearInterval(interval)
    }, [])

    const CARD_SCALE = 0.3
    const normalCss = buildHookWordStyle(hs, { isKeyword: false, scale: CARD_SCALE })
    const keywordCss = buildHookWordStyle(hs, { isKeyword: true, scale: CARD_SCALE })
    const boxCss = buildHookBoxStyle(hs, { scale: CARD_SCALE })

    return (
        <motion.button layout
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            onClick={() => onSelect(hs)}
            className="relative rounded-xl overflow-hidden transition-all group"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
            }}>
            <div className="aspect-[5/4] flex items-center justify-center relative overflow-hidden p-2" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92), rgba(12,5,22,0.95))' }}>
                <div className="text-center relative z-10" style={boxCss}>
                    <p style={normalCss}>Did you know</p>
                    <motion.p
                        animate={{ scale: pulse ? 1.1 : 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        style={{ ...keywordCss, display: 'inline-block' }}
                    >
                        THIS
                    </motion.p>
                    <p style={normalCss}>trick?</p>
                </div>
                <motion.div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/3 to-white/6 opacity-0 group-hover:opacity-100 transition-opacity" />
                {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-10" style={{ background: 'var(--color-accent)' }}><span className="material-symbols-outlined text-white text-[9px]">check</span></motion.div>}
            </div>
            <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: 'var(--color-surface-1)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>{hs.name}</p>
                {isActive && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
            </div>
        </motion.button>
    )
}

function RangeSlider({ label, value, min, max, step = 1, unit = '', onChange }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
                className="w-full h-1 rounded-full cursor-pointer"
                style={{ background: 'var(--color-border-default)', accentColor: 'var(--color-accent)' }} />
        </div>
    )
}

function ColorDot({ color, onChange, label }) {
    return (
        <label className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className="w-7 h-7 rounded-lg overflow-hidden group-hover:border-primary/60 transition-colors shadow-sm" style={{ border: '2px solid var(--color-border-default)' }}>
                <input type="color" value={color} onChange={e => onChange(e.target.value)} className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-[1.6]" />
            </div>
            <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        </label>
    )
}


// --- Carousel for styles --- (Pro redesign with animated previews)
function StyleCarousel({ styles, selectedStyle, onSelect }) {
    const [page, setPage] = useState(0)
    const [search, setSearch] = useState('')
    const filtered = search.trim()
        ? styles.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.font_family?.toLowerCase().includes(search.toLowerCase()))
        : styles
    const PER_PAGE = 6
    const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
    const visible = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

    useEffect(() => { setPage(0) }, [search])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>style</span>
                    </div>
                    Caption Style
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)' }}>{filtered.length}</span>
                </h3>
                <div className="flex items-center gap-1.5">
                    <motion.button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                    </motion.button>
                    <span className="text-[10px] tabular-nums min-w-[32px] text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>{page + 1}/{totalPages}</span>
                    <motion.button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                    </motion.button>
                </div>
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search caption styles..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl outline-none transition-all"
                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}><span className="material-symbols-outlined text-[14px]">close</span></button>}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
                <AnimatePresence mode="popLayout">
                    {visible.map((style, i) => (
                        <CaptionStyleCard key={style.id} style={style} isActive={selectedStyle?.id === style.id} onSelect={onSelect} index={i} />
                    ))}
                </AnimatePresence>
                {filtered.length === 0 && <p className="col-span-3 text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>No styles found</p>}
            </div>
        </div>
    )
}

// --- Hook Carousel --- (Pro redesign)
function HookCarousel({ hookStyles, selected, onSelect }) {
    const [page, setPage] = useState(0)
    const [search, setSearch] = useState('')
    const filtered = search.trim() ? hookStyles.filter(hs => hs.name.toLowerCase().includes(search.toLowerCase())) : hookStyles
    const PER_PAGE = 6
    const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
    const visible = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
    useEffect(() => { setPage(0) }, [search])
    if (!hookStyles.length) return null

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                    </div>
                    Hook Overlay
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)' }}>{filtered.length}</span>
                </h3>
                <div className="flex items-center gap-1.5">
                    <motion.button onClick={() => onSelect(null)}
                        className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{
                            background: !selected ? 'var(--color-accent-subtle)' : 'transparent',
                            color: !selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            border: `1px solid ${!selected ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                        }}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>None</motion.button>
                    <motion.button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                    </motion.button>
                    <span className="text-[10px] tabular-nums min-w-[32px] text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>{page + 1}/{totalPages}</span>
                    <motion.button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                    </motion.button>
                </div>
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hook styles..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl outline-none transition-all"
                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
                <AnimatePresence mode="popLayout">
                    {visible.map((hs, i) => (
                        <HookStyleCard key={hs.id} hs={hs} isActive={selected?.id === hs.id} onSelect={onSelect} index={i} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}


// --- Customization Panel ---
function CustomizationPanel({ editStyle, setEditStyle }) {
    const [expanded, setExpanded] = useState(false)
    const [configExpanded, setConfigExpanded] = useState(false)
    if (!editStyle) return null

    const config = editStyle.config || {}
    const bgPill = config.background_pill || {}
    const highlight = config.highlight || {}
    const animation = config.animation || {}

    const updateConfig = (section, key, value) => {
        const updated = { ...config }
        if (!updated[section]) updated[section] = {}
        updated[section] = { ...updated[section], [key]: value }
        setEditStyle(s => ({ ...s, config: updated }))
    }

    return (
        <div className="space-y-3">
            <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group"
                style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                <span className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>tune</span>Customize Caption
                </span>
                <span className={`material-symbols-outlined text-[16px] transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }}>expand_more</span>
            </button>
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 rounded-xl space-y-5" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                            {/* Font Weight */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Font Weight</p>
                                <div className="flex gap-2">
                                    {['bold', 'normal'].map(w => (
                                        <button key={w} onClick={() => setEditStyle(s => ({ ...s, font_weight: w }))}
                                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize"
                                            style={{
                                                background: editStyle.font_weight === w ? 'var(--btn-primary-bg)' : 'transparent',
                                                color: editStyle.font_weight === w ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                                                borderColor: editStyle.font_weight === w ? 'var(--btn-primary-bg)' : 'var(--color-border-default)'
                                            }}>
                                            {w}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Display Mode — how words appear */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Word Display</p>
                                <div className="flex gap-2">
                                    {[
                                        { key: 'word_by_word', label: 'Word by Word', icon: 'text_fields' },
                                        { key: 'phrase', label: 'Phrase', icon: 'short_text' },
                                        { key: 'sentence', label: 'Full Sentence', icon: 'notes' },
                                    ].map(m => (
                                        <button key={m.key} onClick={() => setEditStyle(s => ({ ...s, display_mode: m.key }))}
                                            className="flex-1 py-2 rounded-lg text-[10px] font-semibold border transition-all flex flex-col items-center gap-1"
                                            style={{
                                                background: (editStyle.display_mode || 'phrase') === m.key ? 'var(--btn-primary-bg)' : 'transparent',
                                                color: (editStyle.display_mode || 'phrase') === m.key ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                                                borderColor: (editStyle.display_mode || 'phrase') === m.key ? 'var(--btn-primary-bg)' : 'var(--color-border-default)'
                                            }}>
                                            <span className="material-symbols-outlined text-[14px]">{m.icon}</span>
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Colors */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Colors</p>
                                <div className="flex items-center gap-4">
                                    <ColorDot color={editStyle.color} onChange={v => setEditStyle(s => ({ ...s, color: v }))} label="Text" />
                                    <ColorDot color={editStyle.highlight_color} onChange={v => setEditStyle(s => ({ ...s, highlight_color: v }))} label="Highlight" />
                                    <ColorDot color={editStyle.outline_color} onChange={v => setEditStyle(s => ({ ...s, outline_color: v }))} label="Stroke" />
                                    <ColorDot color={editStyle.shadow_color} onChange={v => setEditStyle(s => ({ ...s, shadow_color: v }))} label="Shadow" />
                                </div>
                            </div>
                            {/* Typography */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Typography</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <RangeSlider label="Font Size" value={editStyle.font_size} min={8} max={100} onChange={v => setEditStyle(s => ({ ...s, font_size: v }))} unit="px" />
                                    <RangeSlider label="Line Height" value={editStyle.line_height || 1.3} min={1} max={3} step={0.1} onChange={v => setEditStyle(s => ({ ...s, line_height: v }))} />
                                </div>
                            </div>
                            {/* Effects */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Effects</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <RangeSlider label="Outline Width" value={editStyle.outline_width} min={0} max={10} onChange={v => setEditStyle(s => ({ ...s, outline_width: v }))} unit="px" />
                                    <RangeSlider label="Bottom Offset" value={editStyle.position_y_offset || 80} min={0} max={300} onChange={v => setEditStyle(s => ({ ...s, position_y_offset: v }))} unit="px" />
                                    <RangeSlider label="Shadow X" value={editStyle.shadow_offset_x || 0} min={0} max={20} onChange={v => setEditStyle(s => ({ ...s, shadow_offset_x: v }))} unit="px" />
                                    <RangeSlider label="Shadow Y" value={editStyle.shadow_offset_y || 0} min={0} max={20} onChange={v => setEditStyle(s => ({ ...s, shadow_offset_y: v }))} unit="px" />
                                </div>
                            </div>
                            {/* Advanced Config */}
                            <div>
                                <button onClick={() => setConfigExpanded(e => !e)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all"
                                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
                                    <span className="text-[10px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-accent)' }}>tune</span>
                                        Advanced Config
                                        {Object.keys(config).length > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success-text)' }} />}
                                    </span>
                                    <span className={`material-symbols-outlined text-[12px] transition-transform ${configExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }}>expand_more</span>
                                </button>
                                {configExpanded && (
                                    <div className="mt-3 space-y-3">
                                        {/* Background Pill */}
                                        <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Background Pill</span>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="checkbox" checked={bgPill.enable || false}
                                                        onChange={e => updateConfig('background_pill', 'enable', e.target.checked)}
                                                        className="w-3 h-3 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                                                    <span className="text-[9px]" style={{ color: 'var(--color-text-secondary)' }}>Enable</span>
                                                </label>
                                            </div>
                                            {bgPill.enable && (
                                                <div className="grid grid-cols-2 gap-3 mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={bgPill.color || '#1A0A2E'}
                                                            onChange={e => updateConfig('background_pill', 'color', e.target.value)}
                                                            className="w-5 h-5 rounded cursor-pointer border-0" />
                                                        <span className="text-[8px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{bgPill.color || '#1A0A2E'}</span>
                                                    </div>
                                                    <RangeSlider label="Opacity" value={bgPill.opacity || 200} min={0} max={255} unit="" onChange={v => updateConfig('background_pill', 'opacity', v)} />
                                                    <RangeSlider label="Radius" value={bgPill.border_radius || 16} min={0} max={40} onChange={v => updateConfig('background_pill', 'border_radius', v)} />
                                                    <RangeSlider label="Pad X" value={bgPill.padding_x || 20} min={0} max={60} onChange={v => updateConfig('background_pill', 'padding_x', v)} />
                                                </div>
                                            )}
                                        </div>
                                        {/* Highlight Glow */}
                                        <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Highlight Effect</span>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <select value={highlight.style || 'none'}
                                                        onChange={e => updateConfig('highlight', 'style', e.target.value)}
                                                        className="select text-xs py-1">
                                                        <option value="none">None</option>
                                                        <option value="glow">Glow</option>
                                                    </select>
                                                </div>
                                                {highlight.style === 'glow' && (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <input type="color" value={highlight.glow_color || '#FF69B4'}
                                                                onChange={e => updateConfig('highlight', 'glow_color', e.target.value)}
                                                                className="w-5 h-5 rounded cursor-pointer border-0" />
                                                            <span className="text-[8px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{highlight.glow_color || '#FF69B4'}</span>
                                                        </div>
                                                        <RangeSlider label="Radius" value={highlight.glow_radius || 10} min={0} max={30} onChange={v => updateConfig('highlight', 'glow_radius', v)} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {/* Animation */}
                                        <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Animation</span>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div>
                                                    <select value={animation.chunk_enter || 'fade_up'}
                                                        onChange={e => updateConfig('animation', 'chunk_enter', e.target.value)}
                                                        className="select text-xs py-1">
                                                        <option value="fade_up">Fade Up</option>
                                                        <option value="fade_in">Fade In</option>
                                                        <option value="scale_up">Scale Up</option>
                                                        <option value="pop_in">Pop In</option>
                                                    </select>
                                                </div>
                                                <RangeSlider label="Duration" value={animation.enter_duration || 0.15} min={0.05} max={0.5} step={0.05} unit="s" onChange={v => updateConfig('animation', 'enter_duration', v)} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}



// ─── Keyframe Style Composition Card ────────────────────────────────────────
function KeyframeCompositionCard({ composition, isActive, onSelect, index, captionTemplates, hookTemplates }) {
    const [hovered, setHovered] = useState(false)

    const captionTpl = captionTemplates?.find(c => c.id === composition.caption_template_id)
    const hookTpl = hookTemplates?.find(h => h.id === composition.hook_template_id)

    return (
        <motion.button layout
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            onClick={() => onSelect(composition)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="relative rounded-xl overflow-hidden transition-all group text-left"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                background: 'var(--color-surface-1)',
            }}>
            {/* Preview area */}
            <div className="aspect-[4/3] relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92), rgba(15,8,25,0.95))' }}>
                {/* Static preview text */}
                {!hovered && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3">
                        {captionTpl && (
                            <span className="text-[10px] font-bold" style={{
                                color: captionTpl.config?.colors?.primary || '#FFF',
                                fontFamily: captionTpl.config?.font?.family || 'Inter',
                                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                            }}>Caption</span>
                        )}
                        {hookTpl && (
                            <span className="text-[9px] font-bold uppercase" style={{
                                color: hookTpl.config?.text?.default_font?.color || '#FFD700',
                                fontFamily: hookTpl.config?.text?.default_font?.family || 'Anton',
                                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                            }}>Hook</span>
                        )}
                        {!captionTpl && !hookTpl && (
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Preview</span>
                        )}
                    </div>
                )}
                {/* KeyframePreview on hover */}
                <AnimatePresence>
                    {hovered && hookTpl && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ transform: 'scale(0.42)', transformOrigin: 'center center' }}
                        >
                            <KeyframePreview template={hookTpl} type="hook" text={"Sample Hook\nText Here"} />
                        </motion.div>
                    )}
                    {hovered && !hookTpl && captionTpl && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ transform: 'scale(0.42)', transformOrigin: 'center center' }}
                        >
                            <KeyframePreview template={captionTpl} type="caption" words={['This', 'is', 'a', 'test']} />
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Active check badge */}
                {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg z-10"
                        style={{ background: 'var(--color-accent)' }}>
                        <span className="material-symbols-outlined text-white text-[10px]">check</span>
                    </motion.div>
                )}
                {/* Category badge */}
                {composition.category && composition.category !== 'general' && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase z-10"
                        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}>
                        {composition.category}
                    </div>
                )}
            </div>
            {/* Info footer */}
            <div className="px-2.5 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{composition.name}</p>
                    {composition.is_default && (
                        <span className="text-[7px] px-1 py-0.5 rounded font-bold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>DEFAULT</span>
                    )}
                </div>
                {isActive && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />}
            </div>
        </motion.button>
    )
}

// ─── Keyframe Style Section (compositions + advanced mode) ──────────────────
function KeyframeStyleSection({ compositions, captionTemplates, hookTemplates, selectedComp, selectedCaptionTpl, selectedHookTpl, onSelectComp, onSelectCaptionTpl, onSelectHookTpl, advancedMode, onToggleAdvanced }) {
    const [compSearch, setCompSearch] = useState('')
    const [captionSearch, setCaptionSearch] = useState('')
    const [hookSearch, setHookSearch] = useState('')
    const [compPage, setCompPage] = useState(0)
    const [captionPage, setCaptionPage] = useState(0)
    const [hookPage, setHookPage] = useState(0)

    const PER_PAGE = 6
    const filteredComps = compSearch.trim() ? compositions.filter(c => c.name.toLowerCase().includes(compSearch.toLowerCase())) : compositions
    const compTotalPages = Math.ceil(filteredComps.length / PER_PAGE) || 1
    const visibleComps = filteredComps.slice(compPage * PER_PAGE, (compPage + 1) * PER_PAGE)

    const filteredCaptions = captionSearch.trim() ? captionTemplates.filter(c => c.name.toLowerCase().includes(captionSearch.toLowerCase())) : captionTemplates
    const captionTotalPages = Math.ceil(filteredCaptions.length / PER_PAGE) || 1
    const visibleCaptions = filteredCaptions.slice(captionPage * PER_PAGE, (captionPage + 1) * PER_PAGE)

    const filteredHooks = hookSearch.trim() ? hookTemplates.filter(h => h.name.toLowerCase().includes(hookSearch.toLowerCase())) : hookTemplates
    const hookTotalPages = Math.ceil(filteredHooks.length / PER_PAGE) || 1
    const visibleHooks = filteredHooks.slice(hookPage * PER_PAGE, (hookPage + 1) * PER_PAGE)

    useEffect(() => { setCompPage(0) }, [compSearch])
    useEffect(() => { setCaptionPage(0) }, [captionSearch])
    useEffect(() => { setHookPage(0) }, [hookSearch])

    return (
        <div className="space-y-4">
            {/* Mode toggle: Compositions vs Advanced */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>palette</span>
                    </div>
                    Style
                </h3>
                <button onClick={onToggleAdvanced}
                    className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    style={{
                        background: advancedMode ? 'var(--color-accent-subtle)' : 'transparent',
                        color: advancedMode ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        border: `1px solid ${advancedMode ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                    }}>
                    <span className="material-symbols-outlined text-[12px]">tune</span>
                    Advanced
                </button>
            </div>

            <AnimatePresence mode="wait">
                {!advancedMode ? (
                    <motion.div key="compositions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                        {/* Search + pagination */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                <input value={compSearch} onChange={e => setCompSearch(e.target.value)} placeholder="Search style presets..."
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg outline-none transition-all"
                                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                {compSearch && <button onClick={() => setCompSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}><span className="material-symbols-outlined text-[14px]">close</span></button>}
                            </div>
                            <div className="flex items-center gap-1">
                                <motion.button onClick={() => setCompPage(p => Math.max(0, p - 1))} disabled={compPage === 0}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                                    style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                                </motion.button>
                                <span className="text-[9px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{compPage + 1}/{compTotalPages}</span>
                                <motion.button onClick={() => setCompPage(p => Math.min(compTotalPages - 1, p + 1))} disabled={compPage >= compTotalPages - 1}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                                    style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                    <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                                </motion.button>
                            </div>
                        </div>
                        {/* Composition grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            <AnimatePresence mode="popLayout">
                                {visibleComps.map((comp, i) => (
                                    <KeyframeCompositionCard
                                        key={comp.id}
                                        composition={comp}
                                        isActive={selectedComp?.id === comp.id}
                                        onSelect={onSelectComp}
                                        index={i}
                                        captionTemplates={captionTemplates}
                                        hookTemplates={hookTemplates}
                                    />
                                ))}
                            </AnimatePresence>
                            {filteredComps.length === 0 && (
                                <p className="col-span-3 text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>No style presets found</p>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="advanced" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                        {/* Caption Templates */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
                                    Caption Template
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>{filteredCaptions.length}</span>
                                </h4>
                                <div className="flex items-center gap-1">
                                    <motion.button onClick={() => setCaptionPage(p => Math.max(0, p - 1))} disabled={captionPage === 0}
                                        className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                                    </motion.button>
                                    <span className="text-[9px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{captionPage + 1}/{captionTotalPages}</span>
                                    <motion.button onClick={() => setCaptionPage(p => Math.min(captionTotalPages - 1, p + 1))} disabled={captionPage >= captionTotalPages - 1}
                                        className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                                    </motion.button>
                                </div>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                <input value={captionSearch} onChange={e => setCaptionSearch(e.target.value)} placeholder="Search caption templates..."
                                    className="w-full pl-8 pr-3 py-2 text-[11px] rounded-lg outline-none"
                                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <AnimatePresence mode="popLayout">
                                    {visibleCaptions.map((tpl, i) => (
                                        <motion.button key={tpl.id} layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2, delay: i * 0.03 }}
                                            onClick={() => onSelectCaptionTpl(tpl)}
                                            className="rounded-lg overflow-hidden transition-all text-left"
                                            style={{
                                                border: selectedCaptionTpl?.id === tpl.id ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                                                background: selectedCaptionTpl?.id === tpl.id ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)',
                                            }}>
                                            <div className="aspect-[5/3] flex items-center justify-center p-2" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.9), rgba(15,8,25,0.95))' }}>
                                                <span className="text-[9px] font-bold text-center" style={{
                                                    color: tpl.config?.highlight?.color || tpl.config?.colors?.primary || '#FFF',
                                                    fontFamily: tpl.config?.font?.family || 'Inter',
                                                }}>Aa</span>
                                            </div>
                                            <div className="px-2 py-1.5">
                                                <p className="text-[8px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{tpl.name}</p>
                                                <p className="text-[7px] truncate" style={{ color: 'var(--color-text-muted)' }}>{tpl.style_type}</p>
                                            </div>
                                        </motion.button>
                                    ))}
                                </AnimatePresence>
                                {filteredCaptions.length === 0 && <p className="col-span-3 text-center text-[10px] py-4" style={{ color: 'var(--color-text-muted)' }}>No caption templates</p>}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />

                        {/* Hook Templates */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                    Hook Template
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>{filteredHooks.length}</span>
                                </h4>
                                <div className="flex items-center gap-1">
                                    <motion.button onClick={() => onSelectHookTpl(null)}
                                        className="text-[9px] font-semibold px-2 py-1 rounded-md transition-all"
                                        style={{
                                            background: !selectedHookTpl ? 'var(--color-accent-subtle)' : 'transparent',
                                            color: !selectedHookTpl ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                            border: `1px solid ${!selectedHookTpl ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                                        }}>None</motion.button>
                                    <motion.button onClick={() => setHookPage(p => Math.max(0, p - 1))} disabled={hookPage === 0}
                                        className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                                    </motion.button>
                                    <span className="text-[9px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{hookPage + 1}/{hookTotalPages}</span>
                                    <motion.button onClick={() => setHookPage(p => Math.min(hookTotalPages - 1, p + 1))} disabled={hookPage >= hookTotalPages - 1}
                                        className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                                    </motion.button>
                                </div>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                <input value={hookSearch} onChange={e => setHookSearch(e.target.value)} placeholder="Search hook templates..."
                                    className="w-full pl-8 pr-3 py-2 text-[11px] rounded-lg outline-none"
                                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <AnimatePresence mode="popLayout">
                                    {visibleHooks.map((tpl, i) => (
                                        <motion.button key={tpl.id} layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2, delay: i * 0.03 }}
                                            onClick={() => onSelectHookTpl(tpl)}
                                            className="rounded-lg overflow-hidden transition-all text-left"
                                            style={{
                                                border: selectedHookTpl?.id === tpl.id ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                                                background: selectedHookTpl?.id === tpl.id ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)',
                                            }}>
                                            <div className="aspect-[5/3] flex items-center justify-center p-2" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.9), rgba(12,5,22,0.95))' }}>
                                                <span className="text-[8px] font-bold text-center uppercase" style={{
                                                    color: tpl.config?.text?.default_font?.color || '#FFD700',
                                                    fontFamily: tpl.config?.text?.default_font?.family || 'Anton',
                                                }}>Hook</span>
                                            </div>
                                            <div className="px-2 py-1.5">
                                                <p className="text-[8px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{tpl.name}</p>
                                                <p className="text-[7px] truncate" style={{ color: 'var(--color-text-muted)' }}>{tpl.style_type}</p>
                                            </div>
                                        </motion.button>
                                    ))}
                                </AnimatePresence>
                                {filteredHooks.length === 0 && <p className="col-span-3 text-center text-[10px] py-4" style={{ color: 'var(--color-text-muted)' }}>No hook templates</p>}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}


// --- Review Panel (for analyze mode) ---
function ReviewPanel({ clips, onProcess, onBack, submitting, url, captionStyle, hookStyleId }) {
    const [items, setItems] = useState(() => clips.map(c => ({ ...c, _selected: true })))
    const [previewLoading, setPreviewLoading] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const selectedCount = items.filter(c => c._selected).length
    const toggleClip = (index) => setItems(cs => cs.map(c => c.index === index ? { ...c, _selected: !c._selected } : c))
    const updateHook = (index, hook) => setItems(cs => cs.map(c => c.index === index ? { ...c, hook } : c))

    const handlePreview = async (clip) => {
        setPreviewLoading(clip.index)
        try {
            const data = await api.generatePreview(url, clip.index, clip.start_time, clip.end_time, clip.hook, captionStyle, hookStyleId)
            if (data.preview_url) {
                const blobUrl = await getAuthenticatedMediaUrl(data.preview_url)
                setPreviewUrl(blobUrl)
            }
        } catch { /* ignore */ }
        finally { setPreviewLoading(null) }
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {previewUrl && (
                <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}>
                    <div className="relative max-w-xs w-full" style={{ aspectRatio: '9/16' }} onClick={e => e.stopPropagation()}>
                        <video src={previewUrl} controls autoPlay className="w-full h-full rounded-2xl bg-black shadow-2xl" />
                        <button onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }} className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--color-bg-card)' }}><span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-text-primary)' }}>close</span></button>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg transition-colors" style={{ background: 'transparent' }}><span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-text-muted)' }}>arrow_back</span></button>
                    <div>
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Review Clips</h3>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{selectedCount} of {items.length} selected</p>
                    </div>
                </div>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {items.map(clip => {
                    const scorePct = Math.round((clip.score || 0) * 100)
                    const duration = clip.end_time && clip.start_time ? (clip.end_time - clip.start_time).toFixed(1) : null
                    return (
                        <div key={clip.index} className="p-3 rounded-xl transition-all" style={{
                            border: clip._selected ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border-subtle)',
                            background: clip._selected ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)'
                        }}>
                            <div className="flex items-start gap-3">
                                <input type="checkbox" checked={clip._selected} onChange={() => toggleClip(clip.index)} className="mt-0.5 w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--color-accent)' }} />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>#{clip.index}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded`} style={{
                                            background: scorePct >= 90 ? 'var(--color-success-bg)' : scorePct >= 75 ? 'var(--color-warning-bg)' : 'var(--color-surface-1)',
                                            color: scorePct >= 90 ? 'var(--color-success-text)' : scorePct >= 75 ? 'var(--color-warning-text)' : 'var(--color-text-muted)'
                                        }}>{scorePct}%</span>
                                        {duration && <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{duration}s</span>}
                                        <button onClick={() => handlePreview(clip)} disabled={previewLoading === clip.index}
                                            className="ml-auto text-[10px] font-semibold flex items-center gap-0.5 disabled:opacity-50" style={{ color: 'var(--color-warning-text)' }}>
                                            {previewLoading === clip.index ? <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-warning-text)', borderTopColor: 'transparent' }} /> : <span className="material-symbols-outlined text-[12px]">preview</span>}
                                            Preview
                                        </button>
                                    </div>
                                    <input type="text" value={clip.hook || ''} onChange={e => updateHook(clip.index, e.target.value)}
                                        className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none transition-colors"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
            <button onClick={() => onProcess(items.filter(c => c._selected).map(({ _selected, ...rest }) => rest))}
                disabled={selectedCount === 0 || submitting}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                    background: selectedCount > 0 && !submitting ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                    color: selectedCount > 0 && !submitting ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
                    cursor: selectedCount === 0 || submitting ? 'not-allowed' : 'pointer',
                    boxShadow: selectedCount > 0 && !submitting ? 'var(--btn-primary-shadow)' : 'none'
                }}>
                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</> : <><span className="material-symbols-outlined text-[18px]">rocket_launch</span>Process {selectedCount} Clip{selectedCount !== 1 ? 's' : ''}</>}
            </button>
        </motion.div>
    )
}


// --- Main Page ---
function CreatePage({ onJobStarted }) {
    // mode: 'styled' = apply style upfront (original flow), 'base' = process first style later
    const [mode, setMode] = useState('styled')
    const [url, setUrl] = useState('')
    const [videoInfo, setVideoInfo] = useState(null)
    const [loadingVideo, setLoadingVideo] = useState(false)
    const [styles, setStyles] = useState([])
    const [hookStyles, setHookStyles] = useState([])
    const [compositions, setCompositions] = useState([])
    const [selectedStyle, setSelectedStyle] = useState(null)
    const [selectedHookStyle, setSelectedHookStyle] = useState(null)
    const [selectedComp, setSelectedComp] = useState(null)
    const [editStyle, setEditStyle] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [reviewClips, setReviewClips] = useState(null)
    // For "analyze first" sub-mode within styled mode
    const [analyzeMode, setAnalyzeMode] = useState(false)
    const [styleTab, setStyleTab] = useState('compositions') // 'compositions' | 'custom'
    const [resolution, setResolution] = useState('9:16')
    const isInitialLoad = useRef(true)

    // ─── Keyframe system state ─────────────────────────────────────
    const [kfCompositions, setKfCompositions] = useState([])
    const [kfCaptionTemplates, setKfCaptionTemplates] = useState([])
    const [kfHookTemplates, setKfHookTemplates] = useState([])
    const [selectedKfComp, setSelectedKfComp] = useState(null)
    const [selectedKfCaptionTpl, setSelectedKfCaptionTpl] = useState(null)
    const [selectedKfHookTpl, setSelectedKfHookTpl] = useState(null)
    const [kfAdvancedMode, setKfAdvancedMode] = useState(false)

    useEffect(() => {
        Promise.all([
            api.getFonts(),
            // Keyframe system APIs
            api.getStyleCompositions(),
            api.getCaptionTemplates(),
            api.getHookTemplates(),
        ]).then(([fontsData, kfCompsData, kfCaptionsData, kfHooksData]) => {
            if (Array.isArray(fontsData)) loadGoogleFonts(fontsData)
            // Keyframe compositions
            const kfCompsArr = Array.isArray(kfCompsData?.data) ? kfCompsData.data : Array.isArray(kfCompsData?.items) ? kfCompsData.items : Array.isArray(kfCompsData) ? kfCompsData : []
            const kfCaptionsArr = Array.isArray(kfCaptionsData?.data) ? kfCaptionsData.data : Array.isArray(kfCaptionsData?.items) ? kfCaptionsData.items : Array.isArray(kfCaptionsData) ? kfCaptionsData : []
            const kfHooksArr = Array.isArray(kfHooksData?.data) ? kfHooksData.data : Array.isArray(kfHooksData?.items) ? kfHooksData.items : Array.isArray(kfHooksData) ? kfHooksData : []
            setKfCompositions(kfCompsArr)
            setKfCaptionTemplates(kfCaptionsArr)
            setKfHookTemplates(kfHooksArr)
            // Populate Custom tab styles from keyframe templates (flattened for card rendering)
            const flatCaptions = kfCaptionsArr.map(flattenCaptionConfig).filter(Boolean)
            const flatHooks = kfHooksArr.map(flattenHookConfig).filter(Boolean)
            setStyles(flatCaptions)
            setHookStyles(flatHooks)
            // Auto-select defaults
            if (flatCaptions.length > 0) {
                setSelectedStyle(flatCaptions[0])
                setEditStyle({ ...flatCaptions[0] })
            }
            // Auto-select default keyframe composition
            const defKfComp = kfCompsArr.find(c => c.is_default)
            if (defKfComp) {
                setSelectedKfComp(defKfComp)
                setSelectedKfCaptionTpl(kfCaptionsArr.find(t => t.id === defKfComp.caption_template_id) || null)
                setSelectedKfHookTpl(kfHooksArr.find(t => t.id === defKfComp.hook_template_id) || null)
            }
        })
    }, [])

    useEffect(() => {
        if (!editStyle || !selectedStyle) return
        if (isInitialLoad.current) { isInitialLoad.current = false; return }
        // Auto-save disabled: keyframe templates are managed via the template CRUD API
    }, [editStyle, selectedStyle])

    const handleUrlChange = async (e) => {
        const val = e.target.value
        setUrl(val); setVideoInfo(null)
        if (val.includes('\n')) return
        if (!val.includes('youtube.com') && !val.includes('youtu.be')) return
        setLoadingVideo(true)
        try {
            const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(val)}&format=json`)
            if (res.ok) setVideoInfo(await res.json())
        } catch { } finally { setLoadingVideo(false) }
    }

    const handleSelectStyle = async (style) => {
        setSelectedStyle(style)
        setSelectedComp(null) // deselect composition when manually picking
        isInitialLoad.current = true
        // If the style has the original template data, fetch full detail from keyframe API
        const templateId = style._template?.id || style.id
        try {
            const res = await api.getCaptionTemplate(templateId)
            const tpl = res?.data || res
            if (tpl && tpl.config) {
                const flat = flattenCaptionConfig(tpl)
                setEditStyle({ ...flat })
            } else {
                setEditStyle({ ...style })
            }
        } catch {
            setEditStyle({ ...style })
        }
    }

    const handleSelectComp = (comp) => {
        setSelectedComp(comp)
        if (comp.caption_template) {
            setSelectedStyle(comp.caption_template)
            isInitialLoad.current = true
            setEditStyle({ ...comp.caption_template })
        }
        if (comp.hook_template) {
            setSelectedHookStyle(comp.hook_template)
        } else {
            setSelectedHookStyle(null)
        }
    }

    // ─── Keyframe composition/template selection handlers ─────────────
    const handleSelectKfComp = (comp) => {
        setSelectedKfComp(comp)
        setSelectedKfCaptionTpl(kfCaptionTemplates.find(t => t.id === comp.caption_template_id) || null)
        setSelectedKfHookTpl(kfHookTemplates.find(t => t.id === comp.hook_template_id) || null)
        // Clear advanced selections when picking a composition
        setKfAdvancedMode(false)
    }

    const handleSelectKfCaptionTpl = (tpl) => {
        setSelectedKfCaptionTpl(tpl)
        setSelectedKfComp(null) // Deselect composition when individually picking templates
    }

    const handleSelectKfHookTpl = (tpl) => {
        setSelectedKfHookTpl(tpl)
        setSelectedKfComp(null) // Deselect composition when individually picking templates
    }

    // Resolve effective template IDs for submission
    const getKfSubmitPayload = () => {
        if (selectedKfComp) {
            return {
                caption_template_id: selectedKfComp.caption_template_id || null,
                hook_template_id: selectedKfComp.hook_template_id || null,
                style_composition_id: selectedKfComp.id,
            }
        }
        if (kfAdvancedMode && (selectedKfCaptionTpl || selectedKfHookTpl)) {
            return {
                caption_template_id: selectedKfCaptionTpl?.id || null,
                hook_template_id: selectedKfHookTpl?.id || null,
                style_composition_id: null,
            }
        }
        // No selection — don't pass IDs (backend uses default composition)
        return { caption_template_id: null, hook_template_id: null, style_composition_id: null }
    }

    // --- STYLED MODE: Quick submit (original flow) ---
    const handleStyledSubmit = async () => {
        if (!url || (!selectedStyle && !selectedKfComp && !selectedKfCaptionTpl)) return
        setSubmitting(true)
        try {
            const kfPayload = getKfSubmitPayload()
            const data = await api.createJob(
                url,
                kfPayload.caption_template_id || selectedStyle.id,
                kfPayload.hook_template_id || selectedHookStyle?.id || null,
                resolution,
                kfPayload.style_composition_id
            )
            if (data.detail) { toast.error(data.detail); return }
            if (data.accepted > 0) {
                toast.success(data.total_urls > 1 ? `${data.accepted} of ${data.total_urls} jobs submitted` : 'Job submitted')
                if (data.total_urls === 1 && !url.includes('\n')) {
                    if (onJobStarted) onJobStarted({ jobId: data.job_id, videoInfo, url })
                }
            } else { toast(data.message, { icon: <span className="material-symbols-outlined text-lg text-blue-500">info</span> }) }
            setUrl(''); setVideoInfo(null)
        } catch { toast.error('Failed to submit') }
        finally { setSubmitting(false) }
    }

    // --- STYLED MODE: Analyze first ---
    const handleAnalyze = async () => {
        if (!url || (!selectedStyle && !selectedKfComp && !selectedKfCaptionTpl)) return
        setAnalyzing(true)
        try {
            const kfPayload = getKfSubmitPayload()
            const data = await api.analyzeVideo(
                url,
                kfPayload.caption_template_id || selectedStyle.id,
                kfPayload.hook_template_id || selectedHookStyle?.id || null,
                resolution,
                kfPayload.style_composition_id
            )
            if (data.detail) { toast.error(data.detail); return }
            if (data.clips) { setReviewClips(data.clips); toast.success(`Found ${data.clips.length} clips`) }
        } catch { toast.error('Analysis failed') }
        finally { setAnalyzing(false) }
    }

    const handleProcessSelected = async (clips) => {
        setSubmitting(true)
        try {
            const kfPayload = getKfSubmitPayload()
            const data = await api.processSelected(
                url,
                kfPayload.caption_template_id || selectedStyle.id,
                kfPayload.hook_template_id || selectedHookStyle?.id || null,
                clips,
                resolution,
                kfPayload.style_composition_id
            )
            if (data.detail) { toast.error(data.detail); return }
            toast.success('Processing started')
            if (onJobStarted) onJobStarted({ jobId: null, videoInfo, url })
            setUrl(''); setVideoInfo(null); setReviewClips(null)
        } catch { toast.error('Failed to process') }
        finally { setSubmitting(false) }
    }

    // --- BASE MODE: Process without styling ---
    const handleBaseProcess = async () => {
        if (!url) return
        setSubmitting(true)
        try {
            const data = await api.baseProcess(url, resolution)
            if (data.detail) { toast.error(data.detail); return }
            if (data.status === 'accepted') {
                toast.success('Base processing started — style later!')
                if (onJobStarted) onJobStarted({ jobId: null, videoInfo, url })
            } else {
                toast(data.message, { icon: <span className="material-symbols-outlined text-lg text-blue-500">info</span> })
            }
            setUrl(''); setVideoInfo(null)
        } catch { toast.error('Failed to start base processing') }
        finally { setSubmitting(false) }
    }

    const isReadyStyled = url && (selectedStyle || selectedKfComp || selectedKfCaptionTpl)
    const isReadyBase = !!url

    return (
        <div className="flex-1 overflow-y-auto relative" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] pointer-events-none" style={{ background: 'var(--color-accent-subtle)' }} />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-[100px] pointer-events-none" style={{ background: 'var(--color-accent-subtle)' }} />

            <div className="relative p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto flex flex-col xl:flex-row gap-8">

                    {/* Left Panel */}
                    <div className="flex-1 space-y-5 min-w-0">
                        {/* Mode Toggle: Styled vs Base */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex p-0.5 rounded-xl backdrop-blur-sm" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                {[
                                    { key: 'styled', label: 'Style First', icon: 'palette', desc: 'Choose style before processing' },
                                    { key: 'base', label: 'Process First', icon: 'bolt', desc: 'Process now, style later' },
                                ].map(m => (
                                    <button key={m.key} onClick={() => { setMode(m.key); setReviewClips(null) }}
                                        className="relative flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all"
                                        style={{ color: mode === m.key ? 'var(--btn-primary-text)' : 'var(--color-text-muted)' }}>
                                        {mode === m.key && (
                                            <motion.div layoutId="mode-pill" className="absolute inset-0 rounded-[10px]" style={{ background: 'var(--btn-primary-bg)', boxShadow: 'var(--btn-primary-shadow)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                        )}
                                        <span className="relative material-symbols-outlined text-[15px]">{m.icon}</span>
                                        <span className="relative">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>
                                {mode === 'styled' ? 'Select style upfront — classic workflow' : 'Faster start — preview clips before styling'}
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {reviewClips ? (
                                <ReviewPanel key="review" clips={reviewClips} onProcess={handleProcessSelected} onBack={() => setReviewClips(null)} submitting={submitting}
                                    url={url} captionStyle={selectedStyle?.id} hookStyleId={selectedHookStyle?.id} />
                            ) : (
                                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                                    {/* URL Input */}
                                    <div className="rounded-2xl p-5 shadow-sm backdrop-blur-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>smart_display</span>
                                                Source Video
                                                {mode === 'base' && <span className="text-[10px] font-normal ml-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>No style needed</span>}
                                            </h3>
                                            <ResolutionSelector value={resolution} onChange={setResolution} />
                                        </div>
                                        <div className="relative">
                                            <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                                                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-muted)' }}>link</span>
                                            </div>
                                            <textarea className="block w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all text-sm resize-none min-h-[44px]"
                                                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                                placeholder={mode === 'base' ? "Paste YouTube URL — processing starts immediately" : "Paste YouTube URL(s)... (one per line for batch)"}
                                                rows={url.includes('\n') ? Math.min(url.split('\n').length + 1, 5) : 1}
                                                value={url} onChange={handleUrlChange} />
                                        </div>
                                        {url.includes('\n') && mode === 'styled' && (
                                            <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                                                <span className="material-symbols-outlined text-[12px]">playlist_add</span>
                                                Batch mode: {url.split('\n').filter(u => u.trim()).length} URL(s)
                                            </p>
                                        )}
                                        {videoInfo && !url.includes('\n') && (
                                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                                className="mt-3 flex gap-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                                <div className="w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-2)' }}>
                                                    <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex flex-col justify-center min-w-0">
                                                    <h4 className="text-xs font-semibold line-clamp-2 leading-snug" style={{ color: 'var(--color-text-primary)' }}>{videoInfo.title}</h4>
                                                    <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                                                        <span className="material-symbols-outlined text-[12px]">person</span>{videoInfo.author_name}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* BASE MODE: Simple info + submit */}
                                    {mode === 'base' && (
                                        <>
                                            <div className="rounded-2xl p-5" style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)' }}>
                                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--color-text-primary)' }}>
                                                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-info-text)' }}>info</span>
                                                    How "Process First" works
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {[
                                                        { step: '1', label: 'Download & Transcribe', icon: 'download' },
                                                        { step: '2', label: 'AI Clip Detection', icon: 'psychology' },
                                                        { step: '3', label: 'Preview Base Clips', icon: 'preview' },
                                                        { step: '4', label: 'Apply Style Later', icon: 'palette' },
                                                    ].map(s => (
                                                        <div key={s.step} className="flex flex-col items-center text-center gap-1.5 p-2">
                                                            <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                                                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-info-text)' }}>{s.icon}</span>
                                                            </div>
                                                            <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[11px] mt-3 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                                                    <span className="material-symbols-outlined text-[12px]">lightbulb</span>
                                                    You can change styles unlimited times without re-processing the video
                                                </p>
                                            </div>

                                            <button onClick={handleBaseProcess} disabled={!isReadyBase || submitting}
                                                className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                                                style={{
                                                    background: isReadyBase && !submitting ? 'var(--color-success-text)' : 'var(--color-surface-1)',
                                                    color: isReadyBase && !submitting ? 'white' : 'var(--color-text-muted)',
                                                    cursor: !isReadyBase || submitting ? 'not-allowed' : 'pointer',
                                                    boxShadow: isReadyBase && !submitting ? 'var(--shadow-md)' : 'none'
                                                }}>
                                                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Starting...</> : <><span className="material-symbols-outlined text-[18px]">bolt</span>Start Base Processing</>}
                                            </button>
                                        </>
                                    )}

                                    {/* STYLED MODE: Style selection + submit */}
                                    {mode === 'styled' && (
                                        <>
                                            <div className="rounded-2xl shadow-sm backdrop-blur-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                                {/* Compositions vs Custom tab */}
                                                <div className="px-5 pt-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                                    <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                                        {[
                                                            { key: 'compositions', label: 'Presets', icon: 'layers' },
                                                            { key: 'custom', label: 'Custom', icon: 'tune' },
                                                        ].map(t => (
                                                            <button key={t.key} onClick={() => setStyleTab(t.key)}
                                                                className="relative flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                                                                style={{ color: styleTab === t.key ? 'var(--btn-primary-text)' : 'var(--color-text-muted)' }}>
                                                                {styleTab === t.key && (
                                                                    <motion.div layoutId="style-tab-pill" className="absolute inset-0 rounded-md" style={{ background: 'var(--btn-primary-bg)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                                                )}
                                                                <span className="relative material-symbols-outlined text-[13px]">{t.icon}</span>
                                                                <span className="relative">{t.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                                                        {styleTab === 'compositions' ? `${kfCompositions.length} presets` : `${styles.length} captions · ${hookStyles.length} hooks`}
                                                    </span>
                                                </div>

                                                <div className="p-5 space-y-4">
                                                    <AnimatePresence mode="wait">
                                                        {styleTab === 'compositions' ? (
                                                            <motion.div key="comps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                                                                <KeyframeStyleSection
                                                                    compositions={kfCompositions}
                                                                    captionTemplates={kfCaptionTemplates}
                                                                    hookTemplates={kfHookTemplates}
                                                                    selectedComp={selectedKfComp}
                                                                    selectedCaptionTpl={selectedKfCaptionTpl}
                                                                    selectedHookTpl={selectedKfHookTpl}
                                                                    onSelectComp={handleSelectKfComp}
                                                                    onSelectCaptionTpl={handleSelectKfCaptionTpl}
                                                                    onSelectHookTpl={handleSelectKfHookTpl}
                                                                    advancedMode={kfAdvancedMode}
                                                                    onToggleAdvanced={() => setKfAdvancedMode(m => !m)}
                                                                />
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div key="custom" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                                                                <StyleCarousel styles={styles} selectedStyle={selectedStyle} onSelect={handleSelectStyle} />
                                                                <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />
                                                                <HookCarousel hookStyles={hookStyles} selected={selectedHookStyle} onSelect={setSelectedHookStyle} />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>

                                            <CustomizationPanel editStyle={editStyle} setEditStyle={setEditStyle} />

                                            {/* Sub-mode toggle: Quick vs Analyze */}
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setAnalyzeMode(false)}
                                                    className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
                                                    style={{
                                                        background: !analyzeMode ? 'var(--color-accent-subtle)' : 'transparent',
                                                        color: !analyzeMode ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                        border: `1px solid ${!analyzeMode ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                                                    }}>
                                                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">bolt</span>Quick Process
                                                </button>
                                                <button onClick={() => setAnalyzeMode(true)}
                                                    className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
                                                    style={{
                                                        background: analyzeMode ? 'var(--color-accent-subtle)' : 'transparent',
                                                        color: analyzeMode ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                        border: `1px solid ${analyzeMode ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                                                    }}>
                                                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">search_insights</span>Analyze First
                                                </button>
                                            </div>

                                            <div className="pt-1">
                                                {!analyzeMode ? (
                                                    <button onClick={handleStyledSubmit} disabled={!isReadyStyled || submitting}
                                                        className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                                                        style={{
                                                            background: isReadyStyled && !submitting ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                                                            color: isReadyStyled && !submitting ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
                                                            cursor: !isReadyStyled || submitting ? 'not-allowed' : 'pointer',
                                                            boxShadow: isReadyStyled && !submitting ? 'var(--btn-primary-shadow)' : 'none'
                                                        }}>
                                                        {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</> : <><span className="material-symbols-outlined text-[18px]">rocket_launch</span>Process with Style</>}
                                                    </button>
                                                ) : (
                                                    <button onClick={handleAnalyze} disabled={!isReadyStyled || analyzing}
                                                        className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                                                        style={{
                                                            background: isReadyStyled && !analyzing ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                                                            color: isReadyStyled && !analyzing ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
                                                            cursor: !isReadyStyled || analyzing ? 'not-allowed' : 'pointer',
                                                            boxShadow: isReadyStyled && !analyzing ? 'var(--btn-primary-shadow)' : 'none'
                                                        }}>
                                                        {analyzing ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing...</> : <><span className="material-symbols-outlined text-[18px]">search_insights</span>Analyze Video</>}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right: Preview (only in styled mode) */}
                    {mode === 'styled' && (
                        <div className="xl:w-[360px] flex-shrink-0 hidden xl:flex flex-col items-center">
                            <div className="sticky top-8 space-y-4">
                                {/* Keyframe Animated Preview */}
                                <div className="rounded-2xl overflow-hidden p-6" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92) 0%, rgba(20,10,30,0.95) 100%)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
                                    <KeyframePreview
                                        template={editStyle}
                                        type="caption"
                                        words={['sample', 'caption', 'preview']}
                                        loop={true}
                                    />
                                </div>

                                {/* Style Info Card */}
                                {editStyle && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-xl p-3.5 space-y-2.5"
                                        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Active Style</p>
                                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-success-text)' }} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{editStyle.name}</span>
                                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>·</span>
                                            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{editStyle.font_family}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {[editStyle.color, editStyle.highlight_color, editStyle.outline_color, editStyle.shadow_color].filter(Boolean).map((c, i) => (
                                                <div key={i} className="w-4 h-4 rounded-md shadow-sm" style={{ backgroundColor: c, border: '1.5px solid var(--color-border-default)' }} />
                                            ))}
                                        </div>
                                        {selectedHookStyle && (
                                            <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                                <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                                <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{selectedHookStyle.name}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default CreatePage
