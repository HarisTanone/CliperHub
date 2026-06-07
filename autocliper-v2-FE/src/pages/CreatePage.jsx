import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, loadGoogleFonts, flattenHookStyle, getAuthenticatedMediaUrl } from '../utils/api'

const PREVIEW_BG = "https://lh3.googleusercontent.com/aida-public/AB6AXuBR8v7XkC5vNu8cT77RaDOH4JfdHz-jjqDZnXfNWnC1yftxffImbLrXQnp0Wc7uCVKDdmFIGTKf4i0uR3BneXMYGm4g0sURS6lQWj20A_od6g5NVwaRH39JjwGctm7e8L_ixngiEO7COOxJdLZp0AJg0K2Xay6coqna9CtqsDt92xch-THdSapYp4bQ9Nq_WQmkhDhFv_qS3ft45j18zz402xoje1TvphZHMvgRNUwa2hMhsJoIORa3iCMC9UUNE_TWVNWgtkTEXgRi"

function hookShadow(hs) {
    if (!hs.shadow_enable) return 'none'
    return hs.shadow_blur === 0
        ? `2px 4px 0px rgba(0,0,0,${(hs.shadow_opacity / 255).toFixed(2)})`
        : `0px 0px ${hs.shadow_blur}px rgba(0,0,0,${(hs.shadow_opacity / 255).toFixed(2)})`
}

function hookBoxBg(hs) {
    if (!hs.box_enable) return 'transparent'
    const r = parseInt(hs.box_color.slice(1, 3), 16)
    const g = parseInt(hs.box_color.slice(3, 5), 16)
    const b = parseInt(hs.box_color.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${(hs.box_opacity / 255).toFixed(2)})`
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


// --- Carousel for styles ---
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
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>style</span>
                    Caption Style
                    <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>{filtered.length}/{styles.length}</span>
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                    </button>
                    <span className="text-[10px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{page + 1}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                    </button>
                </div>
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search caption styles..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}><span className="material-symbols-outlined text-[14px]">close</span></button>}
            </div>
            <div className="grid grid-cols-3 gap-2">
                <AnimatePresence mode="popLayout">
                    {visible.map(style => {
                        const isActive = selectedStyle?.id === style.id
                        return (
                            <motion.button key={style.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }} onClick={() => onSelect(style)}
                                className={`relative rounded-xl overflow-hidden transition-all group ${isActive ? 'ring-2 ring-offset-2' : ''}`}
                                style={{
                                    border: isActive ? 'none' : '1px solid var(--color-border-subtle)',
                                    '--tw-ring-color': 'var(--color-accent)',
                                    '--tw-ring-offset-color': 'var(--color-bg-primary)'
                                }}>
                                <div className="aspect-[5/3] flex items-center justify-center relative" style={{ background: 'linear-gradient(to bottom, var(--color-surface-2), var(--color-surface-1))' }}>
                                    <span className="relative font-black text-[11px] drop-shadow-lg px-2 text-center leading-tight" style={{ color: style.color, fontFamily: style.font_family }}>{style.name}</span>
                                    {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--color-accent)' }}><span className="material-symbols-outlined text-white text-[10px]">check</span></motion.div>}
                                </div>
                                <div className="px-2 py-1" style={{ background: 'var(--color-surface-1)' }}><p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>{style.font_family}</p></div>
                            </motion.button>
                        )
                    })}
                </AnimatePresence>
                {filtered.length === 0 && <p className="col-span-3 text-center text-xs py-4" style={{ color: 'var(--color-text-muted)' }}>No styles found</p>}
            </div>
        </div>
    )
}

// --- Hook Carousel ---
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
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                    Hook Overlay
                    <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>{filtered.length}/{hookStyles.length}</span>
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => onSelect(null)}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                        style={{
                            background: !selected ? 'var(--color-accent-subtle)' : 'transparent',
                            color: !selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            border: `1px solid ${!selected ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                        }}>None</button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_left</span>
                    </button>
                    <span className="text-[10px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{page + 1}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>chevron_right</span>
                    </button>
                </div>
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hook styles..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
                    style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
                <AnimatePresence mode="popLayout">
                    {visible.map(hs => {
                        const isActive = selected?.id === hs.id
                        const shadow = hookShadow(hs)
                        const font = hs.fallback_font || 'inherit'
                        return (
                            <motion.button key={hs.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => onSelect(hs)}
                                className={`relative rounded-xl overflow-hidden transition-all ${isActive ? 'ring-2 ring-offset-2' : ''}`}
                                style={{
                                    border: isActive ? 'none' : '1px solid var(--color-border-subtle)',
                                    '--tw-ring-color': 'var(--color-accent)',
                                    '--tw-ring-offset-color': 'var(--color-bg-primary)'
                                }}>
                                <div className="aspect-video flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
                                    <div className="text-center">
                                        <p style={{ color: hs.keyword_color, fontSize: '11px', fontWeight: 900, textShadow: shadow, fontFamily: font }}>HOOK</p>
                                        <p style={{ color: hs.text_color, fontSize: '8px', textShadow: shadow, fontFamily: font }}>preview</p>
                                    </div>
                                    {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}><span className="material-symbols-outlined text-white text-[9px]">check</span></motion.div>}
                                </div>
                                <div className="px-2 py-1" style={{ background: 'var(--color-surface-1)' }}><p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-muted)' }}>{hs.name}</p></div>
                            </motion.button>
                        )
                    })}
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
                                    <RangeSlider label="Line Spacing" value={editStyle.line_spacing} min={1} max={3} step={0.1} onChange={v => setEditStyle(s => ({ ...s, line_spacing: v }))} />
                                </div>
                            </div>
                            {/* Effects */}
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Effects</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <RangeSlider label="Outline Width" value={editStyle.outline_width} min={0} max={10} onChange={v => setEditStyle(s => ({ ...s, outline_width: v }))} unit="px" />
                                    <RangeSlider label="Bottom Margin" value={editStyle.caption_bottom_margin} min={0} max={300} onChange={v => setEditStyle(s => ({ ...s, caption_bottom_margin: v }))} unit="px" />
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

// --- Phone Preview (Animated - simulates actual video output) ---
function PhonePreview({ editStyle, selectedHookStyle }) {
    const [captionLine, setCaptionLine] = useState(0)
    const [hookVisible, setHookVisible] = useState(true)
    const [animCycle, setAnimCycle] = useState(0)

    const CAPTION_WORDS = [
        { normal: ['inget', 'banget'], highlight: 'usahain', after: ['salam'] },
        { normal: ['yang', 'paling'], highlight: 'penting', after: ['itu'] },
        { normal: ['harus', 'bisa'], highlight: 'konsisten', after: [] },
    ]

    // Caption animation cycle
    useEffect(() => {
        if (!editStyle) return
        const interval = setInterval(() => {
            setCaptionLine(prev => {
                if (prev >= CAPTION_WORDS.length - 1) {
                    setTimeout(() => setAnimCycle(c => c + 1), 500)
                    return 0
                }
                return prev + 1
            })
        }, 1400)
        return () => clearInterval(interval)
    }, [editStyle, animCycle])

    // Hook animation cycle
    useEffect(() => {
        if (!selectedHookStyle) return
        const interval = setInterval(() => {
            setHookVisible(false)
            setTimeout(() => setHookVisible(true), 400)
        }, 4500)
        return () => clearInterval(interval)
    }, [selectedHookStyle])

    if (!editStyle) return null

    // Video is 1080x1920, phone preview scales to fit
    const PHONE_W = 300, PHONE_H = 534
    const scale = PHONE_W / 1080 // 0.278

    // Read config for advanced styling
    const config = editStyle.config || {}
    const bgPill = config.background_pill || {}
    const hlConfig = config.highlight || {}
    const textTransform = config.text_transform || 'none'

    // Font size scaled to preview
    const fontSize = Math.max(13, Math.round((editStyle.font_size || 20) * scale * 3))
    const outlineW = (editStyle.outline_width || 0) * scale * 2
    const shadowX = (editStyle.shadow_offset_x || 0) * scale * 2
    const shadowY = (editStyle.shadow_offset_y || 0) * scale * 2
    const bottomMargin = Math.max(16, Math.round((editStyle.caption_bottom_margin || 70) * scale))

    // Build background pill style
    const pillStyle = bgPill.enable ? {
        background: bgPill.color ? `${bgPill.color}${Math.round((bgPill.opacity || 200) / 255 * 255).toString(16).padStart(2, '0')}` : 'rgba(26,10,46,0.78)',
        padding: `${(bgPill.padding_y || 8) * scale * 1.5}px ${(bgPill.padding_x || 16) * scale * 1.5}px`,
        borderRadius: `${(bgPill.border_radius || 12) * scale * 1.5}px`,
        display: 'inline-block',
    } : {}

    // Build highlight glow style
    const getHighlightStyle = () => {
        const base = {
            color: editStyle.highlight_color || '#FF69B4',
            fontFamily: editStyle.font_family || 'Poppins',
            fontSize: `${fontSize}px`,
            fontWeight: editStyle.font_weight || 'bold',
            lineHeight: editStyle.line_spacing || 1.2,
            display: 'inline',
        }
        if (hlConfig.style === 'glow' && hlConfig.glow_color) {
            base.textShadow = `0 0 ${(hlConfig.glow_radius || 8) * scale * 2}px ${hlConfig.glow_color}, 0 0 ${(hlConfig.glow_radius || 8) * scale * 4}px ${hlConfig.glow_color}40, ${shadowX}px ${shadowY}px 0px ${editStyle.shadow_color || '#000'}`
        } else {
            base.textShadow = `${shadowX}px ${shadowY}px 0px ${editStyle.shadow_color || '#000'}`
        }
        if (outlineW > 0) base.WebkitTextStroke = `${outlineW}px ${editStyle.outline_color || '#000'}`
        return base
    }

    const normalStyle = {
        color: editStyle.color || '#FFFFFF',
        fontFamily: editStyle.font_family || 'Poppins',
        fontSize: `${fontSize}px`,
        fontWeight: editStyle.font_weight || 'bold',
        lineHeight: editStyle.line_spacing || 1.2,
        display: 'inline',
        textShadow: `${shadowX}px ${shadowY}px 0px ${editStyle.shadow_color || '#000'}`,
        ...(outlineW > 0 ? { WebkitTextStroke: `${outlineW}px ${editStyle.outline_color || '#000'}` } : {}),
    }

    const applyTransform = (text) => {
        if (textTransform === 'uppercase') return text.toUpperCase()
        if (textTransform === 'lowercase') return text.toLowerCase()
        return text
    }

    const currentLine = CAPTION_WORDS[captionLine]

    return (
        <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-b from-primary/10 via-accent/5 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="relative bg-black rounded-[32px] overflow-hidden shadow-2xl shadow-black/50" style={{ width: PHONE_W, height: PHONE_H, border: '2.5px solid rgba(255,255,255,0.1)' }}>
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />

                {/* Video background */}
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />

                {/* Animated Hook (top area) */}
                {selectedHookStyle && (() => {
                    const hs = selectedHookStyle
                    const hookScale = scale * 2.2
                    const shadow = hs.shadow_enable
                        ? `0px 0px ${(hs.shadow_blur || 10) * scale}px rgba(0,0,0,${((hs.shadow_opacity || 180) / 255).toFixed(2)})`
                        : 'none'
                    const font = hs.fallback_font || 'inherit'
                    const normalSize = Math.round((hs.font_size_normal || 48) * hookScale)
                    const keywordSize = Math.round((hs.font_size_keyword || 68) * hookScale)

                    return (
                        <div className="absolute left-0 right-0 flex flex-col items-center px-4 text-center" style={{ top: '22%' }}>
                            <AnimatePresence>
                                {hookVisible && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.7, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                                        transition={{ duration: hs.fade_in || 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                                    >
                                        <p style={{ color: hs.text_color, fontSize: `${normalSize}px`, textShadow: shadow, lineHeight: 1.2, margin: 0, fontFamily: font }}>Sample</p>
                                        <p style={{ color: hs.keyword_color, fontSize: `${keywordSize}px`, textShadow: shadow, fontWeight: 900, lineHeight: 1.1, margin: 0, fontFamily: font, borderBottom: hs.keyword_underline_opacity > 0 ? `2px solid ${hs.keyword_underline_color}` : 'none' }}>HOOK</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })()}

                {/* Animated Caption (bottom area) - matches actual video output */}
                <div className="absolute left-0 right-0 px-3 text-center" style={{ bottom: bottomMargin }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${animCycle}-${captionLine}`}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                            style={pillStyle}
                        >
                            <span style={normalStyle}>{applyTransform(currentLine.normal.join(' '))} </span>
                            <span style={getHighlightStyle()}>{applyTransform(currentLine.highlight)}</span>
                            {currentLine.after.length > 0 && <span style={normalStyle}> {applyTransform(currentLine.after.join(' '))}</span>}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* PREVIEW badge */}
                <div className="absolute top-6 right-3 text-white text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--color-accent)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />PREVIEW
                </div>
            </div>
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
    const [selectedStyle, setSelectedStyle] = useState(null)
    const [selectedHookStyle, setSelectedHookStyle] = useState(null)
    const [editStyle, setEditStyle] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [reviewClips, setReviewClips] = useState(null)
    // For "analyze first" sub-mode within styled mode
    const [analyzeMode, setAnalyzeMode] = useState(false)
    const isInitialLoad = useRef(true)

    useEffect(() => {
        Promise.all([api.getStyles(), api.getFonts(), api.getHookStyles()]).then(([stylesData, fontsData, hookData]) => {
            if (Array.isArray(stylesData)) {
                setStyles(stylesData)
                if (stylesData.length > 0) { setSelectedStyle(stylesData[0]); setEditStyle({ ...stylesData[0] }) }
            }
            if (Array.isArray(fontsData)) loadGoogleFonts(fontsData)
            if (Array.isArray(hookData)) setHookStyles(hookData.map(flattenHookStyle))
        })
    }, [])

    useEffect(() => {
        if (!editStyle || !selectedStyle) return
        if (isInitialLoad.current) { isInitialLoad.current = false; return }
        const timer = setTimeout(() => {
            const { font_family, id, user_id, ...editable } = editStyle
            api.updateStyle(selectedStyle.id, editable)
        }, 600)
        return () => clearTimeout(timer)
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
        isInitialLoad.current = true
        const detail = await api.getStyle(style.id)
        setEditStyle({ ...detail })
    }

    // --- STYLED MODE: Quick submit (original flow) ---
    const handleStyledSubmit = async () => {
        if (!url || !selectedStyle) return
        setSubmitting(true)
        try {
            const data = await api.createJob(url, selectedStyle.id, selectedHookStyle?.id || null)
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
        if (!url || !selectedStyle) return
        setAnalyzing(true)
        try {
            const data = await api.analyzeVideo(url, selectedStyle.id, selectedHookStyle?.id || null)
            if (data.detail) { toast.error(data.detail); return }
            if (data.clips) { setReviewClips(data.clips); toast.success(`Found ${data.clips.length} clips`) }
        } catch { toast.error('Analysis failed') }
        finally { setAnalyzing(false) }
    }

    const handleProcessSelected = async (clips) => {
        setSubmitting(true)
        try {
            const data = await api.processSelected(url, selectedStyle.id, selectedHookStyle?.id || null, clips)
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
            const data = await api.baseProcess(url)
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

    const isReadyStyled = url && selectedStyle
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
                                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--color-text-primary)' }}>
                                            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>smart_display</span>
                                            Source Video
                                            {mode === 'base' && <span className="text-[10px] font-normal ml-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>No style needed</span>}
                                        </h3>
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
                                            <div className="rounded-2xl p-5 shadow-sm backdrop-blur-sm space-y-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                                <StyleCarousel styles={styles} selectedStyle={selectedStyle} onSelect={handleSelectStyle} />
                                                <div style={{ borderTop: '1px solid var(--color-border-subtle)' }} />
                                                <HookCarousel hookStyles={hookStyles} selected={selectedHookStyle} onSelect={setSelectedHookStyle} />
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
                        <div className="xl:w-[340px] flex-shrink-0 hidden xl:flex flex-col items-center">
                            <div className="sticky top-8">
                                <PhonePreview editStyle={editStyle} selectedHookStyle={selectedHookStyle} />
                                {editStyle && (
                                    <div className="mt-4 w-full px-2">
                                        <div className="flex items-center justify-center gap-2">
                                            {[editStyle.color, editStyle.highlight_color, editStyle.outline_color, editStyle.shadow_color].map((c, i) => (
                                                <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c, border: '1px solid var(--color-border-default)' }} />
                                            ))}
                                            <span className="text-[10px] ml-2" style={{ color: 'var(--color-text-muted)' }}>{editStyle.name}</span>
                                        </div>
                                    </div>
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
