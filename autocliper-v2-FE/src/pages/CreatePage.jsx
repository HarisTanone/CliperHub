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
                <span className="text-[11px] font-medium text-slate-400">{label}</span>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">{value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
                className="w-full h-1 rounded-full cursor-pointer" />
        </div>
    )
}

function ColorDot({ color, onChange, label }) {
    return (
        <label className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className="w-7 h-7 rounded-lg overflow-hidden border-2 border-slate-300 dark:border-slate-700 group-hover:border-primary/60 transition-colors shadow-sm">
                <input type="color" value={color} onChange={e => onChange(e.target.value)} className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-[1.6]" />
            </div>
            <span className="text-[9px] text-slate-500">{label}</span>
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
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary-light">style</span>
                    Caption Style
                    <span className="text-[10px] font-normal text-slate-400 ml-1">{filtered.length}/{styles.length}</span>
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center disabled:opacity-30 hover:border-primary/30 transition-all">
                        <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-300">chevron_left</span>
                    </button>
                    <span className="text-[10px] text-slate-500 tabular-nums min-w-[28px] text-center">{page + 1}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center disabled:opacity-30 hover:border-primary/30 transition-all">
                        <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-300">chevron_right</span>
                    </button>
                </div>
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search caption styles..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-[14px]">close</span></button>}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
                <AnimatePresence mode="popLayout">
                    {visible.map(style => {
                        const isActive = selectedStyle?.id === style.id
                        return (
                            <motion.button key={style.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }} onClick={() => onSelect(style)}
                                className={`relative rounded-xl overflow-hidden transition-all group ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-[#0a0e1a]' : 'border border-slate-200 dark:border-slate-700/60 hover:border-primary/40'}`}>
                                <div className="aspect-[4/3] bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center relative">
                                    <span className="relative font-black text-xs drop-shadow-lg px-2 text-center leading-tight" style={{ color: style.color, fontFamily: style.font_family }}>{style.name}</span>
                                    {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30"><span className="material-symbols-outlined text-white text-[12px]">check</span></motion.div>}
                                </div>
                                <div className="px-2 py-1.5 bg-slate-100 dark:bg-slate-900/80"><p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate">{style.font_family}</p></div>
                            </motion.button>
                        )
                    })}
                </AnimatePresence>
                {filtered.length === 0 && <p className="col-span-3 text-center text-xs text-slate-400 py-4">No styles found</p>}
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
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-accent">format_quote</span>
                    Hook Overlay
                    <span className="text-[10px] font-normal text-slate-400 ml-1">{filtered.length}/{hookStyles.length}</span>
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => onSelect(null)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all ${!selected ? 'bg-primary/20 text-primary-light border border-primary/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700/50'}`}>None</button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">chevron_left</span></button>
                    <span className="text-[10px] text-slate-500 tabular-nums min-w-[28px] text-center">{page + 1}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center disabled:opacity-30"><span className="material-symbols-outlined text-[14px]">chevron_right</span></button>
                </div>
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hook styles..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
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
                                className={`relative rounded-xl overflow-hidden transition-all ${isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-[#0a0e1a]' : 'border border-slate-200 dark:border-slate-700/60 hover:border-accent/40'}`}>
                                <div className="aspect-video bg-black/80 flex items-center justify-center">
                                    <div className="text-center">
                                        <p style={{ color: hs.keyword_color, fontSize: '11px', fontWeight: 900, textShadow: shadow, fontFamily: font }}>HOOK</p>
                                        <p style={{ color: hs.text_color, fontSize: '8px', textShadow: shadow, fontFamily: font }}>preview</p>
                                    </div>
                                    {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white text-[9px]">check</span></motion.div>}
                                </div>
                                <div className="px-2 py-1 bg-slate-100 dark:bg-slate-900/80"><p className="text-[9px] font-medium text-slate-400 truncate">{hs.name}</p></div>
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
    if (!editStyle) return null
    return (
        <div className="space-y-3">
            <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40 hover:border-primary/30 transition-all group">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary-light">tune</span>Customize Caption
                </span>
                <span className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-5">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Colors</p>
                                <div className="flex items-center gap-4">
                                    <ColorDot color={editStyle.color} onChange={v => setEditStyle(s => ({ ...s, color: v }))} label="Text" />
                                    <ColorDot color={editStyle.highlight_color} onChange={v => setEditStyle(s => ({ ...s, highlight_color: v }))} label="Highlight" />
                                    <ColorDot color={editStyle.outline_color} onChange={v => setEditStyle(s => ({ ...s, outline_color: v }))} label="Stroke" />
                                    <ColorDot color={editStyle.shadow_color} onChange={v => setEditStyle(s => ({ ...s, shadow_color: v }))} label="Shadow" />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Typography</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <RangeSlider label="Font Size" value={editStyle.font_size} min={8} max={100} onChange={v => setEditStyle(s => ({ ...s, font_size: v }))} unit="px" />
                                    <RangeSlider label="Line Spacing" value={editStyle.line_spacing} min={1} max={3} step={0.1} onChange={v => setEditStyle(s => ({ ...s, line_spacing: v }))} />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Effects</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <RangeSlider label="Outline" value={editStyle.outline_width} min={0} max={10} onChange={v => setEditStyle(s => ({ ...s, outline_width: v }))} unit="px" />
                                    <RangeSlider label="Position" value={editStyle.caption_bottom_margin} min={0} max={300} onChange={v => setEditStyle(s => ({ ...s, caption_bottom_margin: v }))} unit="px" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// --- Phone Preview ---
function PhonePreview({ editStyle, selectedHookStyle }) {
    if (!editStyle) return null
    const VIDEO_W = 608, PHONE_W = 280, PHONE_H = 500
    const scaleX = PHONE_W / VIDEO_W
    const scaleY = PHONE_H / 1080
    const scaledFontSize = Math.max(22, Math.floor(editStyle.font_size * (VIDEO_W / 400)) * scaleX)
    const textStyle = {
        color: editStyle.color, fontFamily: editStyle.font_family,
        fontSize: `${scaledFontSize}px`, fontWeight: editStyle.font_weight,
        lineHeight: editStyle.line_spacing, margin: 0,
        WebkitTextStroke: `${editStyle.outline_width * scaleX}px ${editStyle.outline_color}`,
        textShadow: `${editStyle.shadow_offset_x * scaleX}px ${editStyle.shadow_offset_y * scaleX}px 0px ${editStyle.shadow_color}`,
    }
    const hlStyle = { ...textStyle, color: editStyle.highlight_color }
    const bottom = Math.round(editStyle.caption_bottom_margin * scaleY)

    return (
        <div className="relative">
            <div className="absolute -inset-8 bg-gradient-to-b from-primary/10 via-accent/5 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="relative bg-black rounded-[36px] overflow-hidden shadow-2xl shadow-black/50 border-2 border-slate-800/80" style={{ width: PHONE_W, height: PHONE_H }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-10" />
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
                <div className="absolute left-0 right-0 px-4 text-center" style={{ bottom }}>
                    <p style={textStyle}>YOUR CAPTIONS</p>
                    <p style={hlStyle}>LOOK LIKE THIS</p>
                </div>
                {selectedHookStyle && (() => {
                    const hs = selectedHookStyle
                    const scale = PHONE_W / 608
                    const shadow = hookShadow(hs)
                    const font = hs.fallback_font || 'inherit'
                    return (
                        <div className="absolute left-0 right-0 flex flex-col items-center px-4 text-center" style={{ top: '18%' }}>
                            <div>
                                <p style={{ color: hs.text_color, fontSize: hs.font_size_normal * scale, textShadow: shadow, lineHeight: 1.2, margin: 0, fontFamily: font }}>Sample</p>
                                <p style={{ color: hs.keyword_color, fontSize: hs.font_size_keyword * scale, textShadow: shadow, fontWeight: 900, lineHeight: 1.1, margin: 0, fontFamily: font }}>HOOK</p>
                            </div>
                        </div>
                    )
                })()}
                <div className="absolute top-7 right-3 bg-primary/80 backdrop-blur-sm text-white text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}>
                    <div className="relative max-w-xs w-full" style={{ aspectRatio: '9/16' }} onClick={e => e.stopPropagation()}>
                        <video src={previewUrl} controls autoPlay className="w-full h-full rounded-2xl bg-black shadow-2xl" />
                        <button onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }} className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg"><span className="material-symbols-outlined text-[18px]">close</span></button>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"><span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span></button>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Review Clips</h3>
                        <p className="text-[11px] text-slate-500">{selectedCount} of {items.length} selected</p>
                    </div>
                </div>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {items.map(clip => {
                    const scorePct = Math.round((clip.score || 0) * 100)
                    const duration = clip.end_time && clip.start_time ? (clip.end_time - clip.start_time).toFixed(1) : null
                    return (
                        <div key={clip.index} className={`p-3 rounded-xl border transition-all ${clip._selected ? 'border-primary/40 bg-primary/[0.03]' : 'border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30'}`}>
                            <div className="flex items-start gap-3">
                                <input type="checkbox" checked={clip._selected} onChange={() => toggleClip(clip.index)} className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold bg-primary/15 text-primary-light px-1.5 py-0.5 rounded">#{clip.index}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scorePct >= 90 ? 'bg-emerald-500/15 text-emerald-400' : scorePct >= 75 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700/50 text-slate-400'}`}>{scorePct}%</span>
                                        {duration && <span className="text-[10px] text-slate-500">{duration}s</span>}
                                        <button onClick={() => handlePreview(clip)} disabled={previewLoading === clip.index}
                                            className="ml-auto text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 disabled:opacity-50">
                                            {previewLoading === clip.index ? <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[12px]">preview</span>}
                                            Preview
                                        </button>
                                    </div>
                                    <input type="text" value={clip.hook || ''} onChange={e => updateHook(clip.index, e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700/50 rounded-lg bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white focus:border-primary/50 outline-none transition-colors" />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
            <button onClick={() => onProcess(items.filter(c => c._selected).map(({ _selected, ...rest }) => rest))}
                disabled={selectedCount === 0 || submitting}
                className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${selectedCount > 0 && !submitting ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
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
            } else { toast(data.message, { icon: 'ℹ️' }) }
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
                toast(data.message, { icon: 'ℹ️' })
            }
            setUrl(''); setVideoInfo(null)
        } catch { toast.error('Failed to start base processing') }
        finally { setSubmitting(false) }
    }

    const isReadyStyled = url && selectedStyle
    const isReadyBase = !!url

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-gradient-to-br dark:from-[#0a0e1a] dark:via-[#0f1629] dark:to-[#0a0e1a] relative">
            <div className="hidden dark:block absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="hidden dark:block absolute bottom-0 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1400px] mx-auto flex flex-col xl:flex-row gap-8">

                    {/* Left Panel */}
                    <div className="flex-1 space-y-5 min-w-0">
                        {/* Mode Toggle: Styled vs Base */}
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/60 rounded-xl backdrop-blur-sm">
                                {[
                                    { key: 'styled', label: 'Style First', icon: 'palette', desc: 'Choose style before processing' },
                                    { key: 'base', label: 'Process First', icon: 'bolt', desc: 'Process now, style later' },
                                ].map(m => (
                                    <button key={m.key} onClick={() => { setMode(m.key); setReviewClips(null) }}
                                        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all ${mode === m.key ? 'text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                        {mode === m.key && (
                                            <motion.div layoutId="mode-pill" className="absolute inset-0 bg-gradient-to-r from-primary to-primary-dark rounded-[10px] shadow-lg shadow-primary/20" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                        )}
                                        <span className="relative material-symbols-outlined text-[15px]">{m.icon}</span>
                                        <span className="relative">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-500 hidden sm:block">
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
                                    <div className="rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 p-5 shadow-sm dark:shadow-none backdrop-blur-sm">
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-[18px] text-primary-light">smart_display</span>
                                            Source Video
                                            {mode === 'base' && <span className="text-[10px] font-normal text-emerald-500 ml-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">No style needed</span>}
                                        </h3>
                                        <div className="relative">
                                            <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                                                <span className="material-symbols-outlined text-[16px] text-slate-500">link</span>
                                            </div>
                                            <textarea className="block w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all text-sm resize-none min-h-[44px]"
                                                placeholder={mode === 'base' ? "Paste YouTube URL — processing starts immediately" : "Paste YouTube URL(s)... (one per line for batch)"}
                                                rows={url.includes('\n') ? Math.min(url.split('\n').length + 1, 5) : 1}
                                                value={url} onChange={handleUrlChange} />
                                        </div>
                                        {url.includes('\n') && mode === 'styled' && (
                                            <p className="text-[10px] text-primary-light mt-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">playlist_add</span>
                                                Batch mode: {url.split('\n').filter(u => u.trim()).length} URL(s)
                                            </p>
                                        )}
                                        {videoInfo && !url.includes('\n') && (
                                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                                className="mt-3 flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/30">
                                                <div className="w-24 aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
                                                    <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex flex-col justify-center min-w-0">
                                                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">{videoInfo.title}</h4>
                                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[12px]">person</span>{videoInfo.author_name}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* BASE MODE: Simple info + submit */}
                                    {mode === 'base' && (
                                        <>
                                            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10 border border-emerald-200 dark:border-emerald-800/30 p-5">
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                                                    <span className="material-symbols-outlined text-[18px] text-emerald-500">info</span>
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
                                                            <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                                                                <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">{s.icon}</span>
                                                            </div>
                                                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">{s.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">lightbulb</span>
                                                    You can change styles unlimited times without re-processing the video
                                                </p>
                                            </div>

                                            <button onClick={handleBaseProcess} disabled={!isReadyBase || submitting}
                                                className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isReadyBase && !submitting ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01]' : 'bg-slate-200 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed'}`}>
                                                {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Starting...</> : <><span className="material-symbols-outlined text-[18px]">bolt</span>Start Base Processing</>}
                                            </button>
                                        </>
                                    )}

                                    {/* STYLED MODE: Style selection + submit */}
                                    {mode === 'styled' && (
                                        <>
                                            <div className="rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 p-5 shadow-sm dark:shadow-none backdrop-blur-sm space-y-5">
                                                <StyleCarousel styles={styles} selectedStyle={selectedStyle} onSelect={handleSelectStyle} />
                                                <div className="border-t border-slate-200 dark:border-slate-800/40" />
                                                <HookCarousel hookStyles={hookStyles} selected={selectedHookStyle} onSelect={setSelectedHookStyle} />
                                            </div>

                                            <CustomizationPanel editStyle={editStyle} setEditStyle={setEditStyle} />

                                            {/* Sub-mode toggle: Quick vs Analyze */}
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setAnalyzeMode(false)}
                                                    className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-all ${!analyzeMode ? 'bg-primary/10 text-primary border-primary/30' : 'border-slate-200 dark:border-slate-700/50 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">bolt</span>Quick Process
                                                </button>
                                                <button onClick={() => setAnalyzeMode(true)}
                                                    className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-all ${analyzeMode ? 'bg-primary/10 text-primary border-primary/30' : 'border-slate-200 dark:border-slate-700/50 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">search_insights</span>Analyze First
                                                </button>
                                            </div>

                                            <div className="pt-1">
                                                {!analyzeMode ? (
                                                    <button onClick={handleStyledSubmit} disabled={!isReadyStyled || submitting}
                                                        className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isReadyStyled && !submitting ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01]' : 'bg-slate-200 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed'}`}>
                                                        {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</> : <><span className="material-symbols-outlined text-[18px]">rocket_launch</span>Process with Style</>}
                                                    </button>
                                                ) : (
                                                    <button onClick={handleAnalyze} disabled={!isReadyStyled || analyzing}
                                                        className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isReadyStyled && !analyzing ? 'bg-gradient-to-r from-accent to-primary text-white shadow-xl shadow-accent/15 hover:shadow-accent/25 hover:scale-[1.01]' : 'bg-slate-200 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed'}`}>
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
                        <div className="xl:w-[320px] flex-shrink-0 hidden xl:flex flex-col items-center">
                            <div className="sticky top-8">
                                <PhonePreview editStyle={editStyle} selectedHookStyle={selectedHookStyle} />
                                {editStyle && (
                                    <div className="mt-4 w-full px-2">
                                        <div className="flex items-center justify-center gap-2">
                                            {[editStyle.color, editStyle.highlight_color, editStyle.outline_color, editStyle.shadow_color].map((c, i) => (
                                                <div key={i} className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-700" style={{ backgroundColor: c }} />
                                            ))}
                                            <span className="text-[10px] text-slate-500 ml-2">{editStyle.name}</span>
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
