import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, loadGoogleFonts, getAuthenticatedMediaUrl } from '../utils/api'
import RemotionPreview from '../components/RemotionPreview'

// ═══════════════════════════════════════════════════════════════
// STYLE APPLY PAGE (Re-Style) — Pro-level UI with Remotion Preview
// ═══════════════════════════════════════════════════════════════

function StyleApplyPage({ jobId, onBack, onDone }) {
    const [loading, setLoading] = useState(true)
    const [jobData, setJobData] = useState(null)
    const [styles, setStyles] = useState([])
    const [hookStyles, setHookStyles] = useState([])
    const [selectedStyle, setSelectedStyle] = useState(null)
    const [selectedHookStyle, setSelectedHookStyle] = useState(null)
    const [applying, setApplying] = useState(false)
    const [thumbnailUrls, setThumbnailUrls] = useState({})
    const [clipIndex, setClipIndex] = useState(0)
    const [stylePage, setStylePage] = useState(0)
    const [hookPage, setHookPage] = useState(0)
    const [searchStyle, setSearchStyle] = useState('')
    const [searchHook, setSearchHook] = useState('')
    const [previewMode, setPreviewMode] = useState('remotion') // 'remotion' | 'thumbnail'

    const STYLES_PER_PAGE = 6
    const HOOKS_PER_PAGE = 6

    useEffect(() => { loadData() }, [jobId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [baseClips, stylesData, fontsData, hookData] = await Promise.all([
                api.getBaseClips(jobId),
                api.getRemotionCaptionTemplates(),
                api.getFonts(),
                api.getRemotionHookTemplates(),
            ])
            setJobData(baseClips)
            if (baseClips?.clips) {
                const thumbs = {}
                for (const clip of baseClips.clips) {
                    try {
                        const url = await getAuthenticatedMediaUrl(api.getBaseThumbnailUrl(jobId, clip.index))
                        thumbs[clip.index] = url
                    } catch { }
                }
                setThumbnailUrls(thumbs)
            }
            if (Array.isArray(stylesData)) {
                setStyles(stylesData)
                if (stylesData.length > 0) setSelectedStyle(stylesData[0])
            }
            if (Array.isArray(fontsData)) loadGoogleFonts(fontsData)
            if (Array.isArray(hookData)) setHookStyles(hookData)
        } catch { toast.error('Failed to load data') }
        finally { setLoading(false) }
    }

    const handleApplyStyle = async () => {
        if (!selectedStyle) { toast.error('Select a caption style'); return }
        setApplying(true)
        try {
            const data = await api.applyStyle(jobId, selectedStyle.id, selectedHookStyle?.id || null)
            if (data.detail) { toast.error(data.detail); return }
            toast.success(`Style applied to ${data.clips_rendered || data.clips_to_style} clips!`)
            if (onDone) onDone()
        } catch (e) { toast.error('Rendering failed') }
        finally { setApplying(false) }
    }

    // Filtered styles
    const filteredStyles = searchStyle.trim()
        ? styles.filter(s => s.name.toLowerCase().includes(searchStyle.toLowerCase()) || s.font_family?.toLowerCase().includes(searchStyle.toLowerCase()))
        : styles
    const filteredHooks = searchHook.trim()
        ? hookStyles.filter(h => h.name.toLowerCase().includes(searchHook.toLowerCase()))
        : hookStyles

    const styleTotalPages = Math.ceil(filteredStyles.length / STYLES_PER_PAGE) || 1
    const hookTotalPages = Math.ceil(filteredHooks.length / HOOKS_PER_PAGE) || 1
    const visibleStyles = filteredStyles.slice(stylePage * STYLES_PER_PAGE, (stylePage + 1) * STYLES_PER_PAGE)
    const visibleHooks = filteredHooks.slice(hookPage * HOOKS_PER_PAGE, (hookPage + 1) * HOOKS_PER_PAGE)
    const currentClip = jobData?.clips?.[clipIndex]
    const totalClips = jobData?.clips?.length || 0

    useEffect(() => { setStylePage(0) }, [searchStyle])
    useEffect(() => { setHookPage(0) }, [searchHook])

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <motion.div
                        className="w-12 h-12 rounded-full"
                        style={{ border: '3px solid var(--color-accent)', borderTopColor: 'transparent' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading clips...</p>
                </div>
            </div>
        )
    }

    if (!jobData || !jobData.clips?.length) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>movie_filter</span>
                    </div>
                    <p className="font-semibold text-lg" style={{ color: 'var(--color-text-primary)' }}>No base clips found</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Process a video first to create base clips.</p>
                    <button onClick={onBack} className="btn btn-primary">Go Back</button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-bg-primary)' }}>
            {/* Background glow */}
            <div className="absolute top-0 left-1/3 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'var(--color-accent-subtle)', opacity: 0.4 }} />

            <div className="relative max-w-6xl mx-auto p-5 md:p-8 space-y-6">
                {/* Header */}
                <motion.div
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.button
                        onClick={onBack}
                        className="p-2.5 rounded-xl transition-colors"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
                        whileHover={{ scale: 1.05, x: -2 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </motion.button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Re-Style Clips</h1>
                        <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">movie</span>
                                {totalClips} clips
                            </span>
                            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-border-default)' }} />
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-success-text)' }}>fiber_manual_record</span>
                                Non-destructive
                            </span>
                        </p>
                    </div>
                    {/* Clip navigator mini */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <button onClick={() => setClipIndex(i => Math.max(0, i - 1))} disabled={clipIndex === 0}
                            className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30 transition-colors" style={{ border: '1px solid var(--color-border-default)' }}>
                            <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                        </button>
                        <span className="text-[11px] tabular-nums font-semibold min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            Clip {clipIndex + 1}/{totalClips}
                        </span>
                        <button onClick={() => setClipIndex(i => Math.min(totalClips - 1, i + 1))} disabled={clipIndex >= totalClips - 1}
                            className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30 transition-colors" style={{ border: '1px solid var(--color-border-default)' }}>
                            <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                        </button>
                    </div>
                </motion.div>

                {/* Main Layout */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Style Selection */}
                    <motion.div
                        className="flex-1 space-y-5 min-w-0"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        {/* Caption Style Section */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>palette</span>
                                    Caption Style
                                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                                        {filteredStyles.length}
                                    </span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setStylePage(p => Math.max(0, p - 1))} disabled={stylePage === 0}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                    </button>
                                    <span className="text-[10px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>
                                        {stylePage + 1}/{styleTotalPages}
                                    </span>
                                    <button onClick={() => setStylePage(p => Math.min(styleTotalPages - 1, p + 1))} disabled={stylePage >= styleTotalPages - 1}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="px-5 pt-3">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                    <input
                                        value={searchStyle}
                                        onChange={e => setSearchStyle(e.target.value)}
                                        placeholder="Search caption styles..."
                                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none transition-all"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
                                    />
                                </div>
                            </div>

                            {/* Style grid */}
                            <div className="p-5">
                                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5">
                                    <AnimatePresence mode="popLayout">
                                        {visibleStyles.map((style, i) => {
                                            const isActive = selectedStyle?.id === style.id
                                            const previewOutline = style.outline_enabled && style.outline_width > 0
                                                ? { WebkitTextStroke: `${Math.min(style.outline_width, 2)}px ${style.outline_color || '#000'}` }
                                                : {}
                                            const previewShadow = style.shadow_enabled
                                                ? `${style.shadow_offset_x || 0}px ${style.shadow_offset_y || 2}px ${style.shadow_blur || 4}px ${style.shadow_color || '#000'}`
                                                : 'none'
                                            return (
                                                <motion.button
                                                    key={style.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2, delay: i * 0.03 }}
                                                    onClick={() => setSelectedStyle(style)}
                                                    className="relative rounded-xl overflow-hidden transition-all group"
                                                    style={{
                                                        border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                                                        boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                                                    }}
                                                >
                                                    <div
                                                        className="aspect-[5/4] flex items-center justify-center p-2 relative"
                                                        style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,10,30,0.95))' }}
                                                    >
                                                        <div className="text-center relative z-10 flex flex-wrap justify-center gap-x-0.5">
                                                            <span style={{ color: style.color || '#FFF', fontFamily: style.font_family, fontSize: '11px', fontWeight: style.font_weight || '700', textShadow: previewShadow, ...previewOutline }}>sample </span>
                                                            <span style={{ color: style.highlight_color || '#FFD700', fontFamily: style.font_family, fontSize: '11px', fontWeight: style.font_weight || '700', textShadow: style.highlight_style === 'glow' ? `0 0 5px ${style.highlight_color}` : previewShadow, ...previewOutline }}>caption</span>
                                                            <span style={{ color: style.color || '#FFF', fontFamily: style.font_family, fontSize: '11px', fontWeight: style.font_weight || '700', textShadow: previewShadow, ...previewOutline }}> text</span>
                                                        </div>
                                                        {isActive && (
                                                            <motion.div
                                                                initial={{ scale: 0 }}
                                                                animate={{ scale: 1 }}
                                                                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                                                                style={{ background: 'var(--color-accent)' }}
                                                            >
                                                                <span className="material-symbols-outlined text-white text-[11px]">check</span>
                                                            </motion.div>
                                                        )}
                                                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: 'var(--color-surface-1)', borderTop: '1px solid var(--color-border-subtle)' }}>
                                                        <p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>{style.name}</p>
                                                        <p className="text-[8px] truncate ml-1" style={{ color: 'var(--color-text-muted)' }}>{style.font_family}</p>
                                                    </div>
                                                </motion.button>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                                {filteredStyles.length === 0 && (
                                    <p className="text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>No styles found</p>
                                )}
                            </div>
                        </div>

                        {/* Hook Style Section */}
                        {hookStyles.length > 0 && (
                            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                        Hook Overlay
                                        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                                            {filteredHooks.length}
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelectedHookStyle(null)}
                                            className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                                            style={{
                                                background: !selectedHookStyle ? 'var(--color-accent-subtle)' : 'transparent',
                                                color: !selectedHookStyle ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                border: `1px solid ${!selectedHookStyle ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                                            }}>
                                            None
                                        </button>
                                        <button onClick={() => setHookPage(p => Math.max(0, p - 1))} disabled={hookPage === 0}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                                            style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                        </button>
                                        <span className="text-[10px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{hookPage + 1}/{hookTotalPages}</span>
                                        <button onClick={() => setHookPage(p => Math.min(hookTotalPages - 1, p + 1))} disabled={hookPage >= hookTotalPages - 1}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                                            style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="px-5 pt-3">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                        <input
                                            value={searchHook}
                                            onChange={e => setSearchHook(e.target.value)}
                                            placeholder="Search hook styles..."
                                            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none transition-all"
                                            style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="grid grid-cols-3 gap-2.5">
                                        <AnimatePresence mode="popLayout">
                                            {visibleHooks.map((hs, i) => {
                                                const isActive = selectedHookStyle?.id === hs.id
                                                const font = hs.font_family || 'inherit'
                                                const shadow = hs.shadow_enabled
                                                    ? `0 0 ${hs.shadow_blur || 8}px ${hs.shadow_color || 'rgba(0,0,0,0.7)'}`
                                                    : 'none'
                                                const kwUnderline = hs.keyword_underline_enabled
                                                    ? { borderBottom: `2px solid ${hs.keyword_underline_color || '#FFF'}`, paddingBottom: '1px' }
                                                    : {}
                                                const glowShadow = hs.glow_enabled
                                                    ? `0 0 ${hs.glow_radius || 6}px ${hs.glow_color || '#FFF'}, ${shadow}`
                                                    : shadow
                                                return (
                                                    <motion.button
                                                        key={hs.id}
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.9 }}
                                                        transition={{ duration: 0.2, delay: i * 0.03 }}
                                                        onClick={() => setSelectedHookStyle(hs)}
                                                        className="relative rounded-xl overflow-hidden transition-all group"
                                                        style={{
                                                            border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                                                            boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
                                                        }}
                                                    >
                                                        <div className="aspect-[5/4] flex items-center justify-center relative p-2" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(15,5,25,0.95))' }}>
                                                            <div className="text-center relative z-10">
                                                                <p style={{ color: hs.color || '#FFF', fontSize: '9px', fontWeight: hs.font_weight || '400', textShadow: shadow, fontFamily: font, textTransform: hs.text_transform || 'uppercase', margin: 0 }}>Did you know</p>
                                                                <p style={{ color: hs.keyword_color || '#FFF', fontSize: '14px', fontWeight: 900, textShadow: glowShadow, fontFamily: font, textTransform: hs.text_transform || 'uppercase', margin: '2px 0', ...kwUnderline }}>THIS</p>
                                                                <p style={{ color: hs.color || '#FFF', fontSize: '9px', fontWeight: hs.font_weight || '400', textShadow: shadow, fontFamily: font, textTransform: hs.text_transform || 'uppercase', margin: 0 }}>trick?</p>
                                                            </div>
                                                            {isActive && (
                                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                                                                    style={{ background: 'var(--color-accent)' }}>
                                                                    <span className="material-symbols-outlined text-white text-[10px]">check</span>
                                                                </motion.div>
                                                            )}
                                                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <div className="px-2.5 py-1.5" style={{ background: 'var(--color-surface-1)', borderTop: '1px solid var(--color-border-subtle)' }}>
                                                            <p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>{hs.name}</p>
                                                        </div>
                                                    </motion.button>
                                                )
                                            })}
                                        </AnimatePresence>
                                    </div>
                                    {filteredHooks.length === 0 && (
                                        <p className="text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>No hooks found</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Apply Button */}
                        <motion.button
                            onClick={handleApplyStyle}
                            disabled={!selectedStyle || applying}
                            className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all"
                            style={{
                                background: selectedStyle && !applying ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                                color: selectedStyle && !applying ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
                                boxShadow: selectedStyle && !applying ? 'var(--btn-primary-shadow)' : 'none',
                                cursor: !selectedStyle || applying ? 'not-allowed' : 'pointer',
                                border: selectedStyle && !applying ? 'none' : '1px solid var(--color-border-subtle)',
                            }}
                            whileHover={selectedStyle && !applying ? { scale: 1.01, y: -1 } : {}}
                            whileTap={selectedStyle && !applying ? { scale: 0.99 } : {}}
                        >
                            {applying ? (
                                <>
                                    <motion.div
                                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                    />
                                    Rendering {totalClips} clips...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                    Apply Style to {totalClips} Clips
                                </>
                            )}
                        </motion.button>
                    </motion.div>

                    {/* Right: Live Preview */}
                    <motion.div
                        className="lg:w-[340px] flex-shrink-0 space-y-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {/* Preview Mode Toggle */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Preview</p>
                            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
                                {[
                                    { key: 'remotion', icon: 'movie_filter', label: 'Animated' },
                                    { key: 'thumbnail', icon: 'image', label: 'Thumbnail' },
                                ].map(m => (
                                    <button
                                        key={m.key}
                                        onClick={() => setPreviewMode(m.key)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium transition-colors"
                                        style={{
                                            background: previewMode === m.key ? 'var(--color-accent-subtle)' : 'transparent',
                                            color: previewMode === m.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[12px]">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview Container */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)' }}>
                            <AnimatePresence mode="wait">
                                {previewMode === 'remotion' ? (
                                    <motion.div
                                        key="remotion"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="p-6 flex items-center justify-center"
                                        style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92) 0%, rgba(20,10,30,0.95) 100%)' }}
                                    >
                                        <RemotionPreview
                                            captionStyle={selectedStyle}
                                            hookStyle={selectedHookStyle}
                                            thumbnailUrl={thumbnailUrls[currentClip?.index]}
                                            size="md"
                                            showPlayback={true}
                                            showBadge={true}
                                            showParticles={true}
                                            showGlow={true}
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="thumbnail"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="relative"
                                        style={{ aspectRatio: '9/16' }}
                                    >
                                        {thumbnailUrls[currentClip?.index] ? (
                                            <img src={thumbnailUrls[currentClip.index]} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-surface-3))' }}>
                                                <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                                            </div>
                                        )}

                                        {/* Static overlays on thumbnail */}
                                        {selectedStyle && (
                                            <div className="absolute left-2 right-2 text-center" style={{ bottom: '16px' }}>
                                                <span style={{ color: selectedStyle.color, fontFamily: selectedStyle.font_family, fontSize: '14px', fontWeight: 'bold' }}>sample </span>
                                                <span style={{ color: selectedStyle.highlight_color, fontFamily: selectedStyle.font_family, fontSize: '14px', fontWeight: 'bold' }}>caption</span>
                                                <span style={{ color: selectedStyle.color, fontFamily: selectedStyle.font_family, fontSize: '14px', fontWeight: 'bold' }}> text</span>
                                            </div>
                                        )}

                                        {selectedHookStyle && (
                                            <div className="absolute left-2 right-2 text-center" style={{ top: '20%' }}>
                                                <p style={{ color: selectedHookStyle.color, fontSize: '12px', fontFamily: selectedHookStyle.font_family || 'inherit' }}>Sample</p>
                                                <p style={{ color: selectedHookStyle.keyword_color, fontSize: '18px', fontWeight: 900, fontFamily: selectedHookStyle.font_family || 'inherit' }}>HOOK</p>
                                            </div>
                                        )}

                                        {/* Clip badge */}
                                        <div className="absolute top-2 left-2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent)' }}>
                                            #{currentClip?.index}
                                        </div>
                                        <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)' }}>
                                            {currentClip?.duration?.toFixed(0)}s
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Clip info */}
                            {currentClip?.hook && (
                                <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                    <p className="text-[11px] font-semibold line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                                        <span className="material-symbols-outlined text-[12px] align-middle mr-1" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                        {currentClip.hook}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Info cards */}
                        {selectedHookStyle && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl p-3 flex items-start gap-2"
                                style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)' }}
                            >
                                <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning-text)' }}>info</span>
                                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning-text)' }}>
                                    Hook overlay hanya akan muncul di 3 detik awal video.
                                </p>
                            </motion.div>
                        )}

                        <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)' }}>
                            <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-info-text)' }}>tips_and_updates</span>
                            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-info-text)' }}>
                                Non-destructive: raw clips tetap tersimpan, bisa re-apply style kapan saja.
                            </p>
                        </div>

                        {/* Style summary */}
                        {selectedStyle && (
                            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Current Selection</p>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
                                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{selectedStyle.name}</span>
                                    <span className="text-[9px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>{selectedStyle.font_family}</span>
                                </div>
                                {selectedHookStyle && (
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{selectedHookStyle.name}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

export default StyleApplyPage
