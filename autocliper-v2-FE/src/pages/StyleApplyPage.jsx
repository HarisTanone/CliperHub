import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, loadGoogleFonts, getAuthenticatedMediaUrl } from '../utils/api'
import KeyframePreview from '../components/KeyframePreview'
import ResolutionSelector from '../components/ResolutionSelector'

// ═══════════════════════════════════════════════════════════════
// STYLE APPLY PAGE (Re-Style) — Premium UI with Live Preview
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
    const [previewMode, setPreviewMode] = useState('remotion')
    const [activeTab, setActiveTab] = useState('caption') // 'caption' | 'hook'
    const [resolution, setResolution] = useState('9:16')

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
            const data = await api.applyStyle(jobId, selectedStyle.id, selectedHookStyle?.id || null, resolution)
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
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="flex flex-col items-center gap-4">
                    <motion.div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--color-accent)' }}>palette</span>
                    </motion.div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading style editor...</p>
                </div>
            </div>
        )
    }

    if (!jobData || !jobData.clips?.length) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-center space-y-4 p-8">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>movie_filter</span>
                    </div>
                    <p className="font-semibold text-lg" style={{ color: 'var(--color-text-primary)' }}>No base clips found</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Process a video first to create base clips.</p>
                    <button onClick={onBack}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}>
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="relative max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                {/* Header */}
                <motion.div
                    className="flex items-center gap-3 mb-6"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <motion.button
                        onClick={onBack}
                        className="p-2 rounded-xl transition-colors"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
                        whileHover={{ scale: 1.05, x: -2 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Go back"
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </motion.button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Re-Style Clips</h1>
                        <p className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">movie</span>
                                {totalClips} clips
                            </span>
                            <span className="w-0.5 h-0.5 rounded-full" style={{ background: 'var(--color-text-muted)' }} />
                            <span>Non-destructive</span>
                        </p>
                    </div>
                    {/* Clip navigator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <button onClick={() => setClipIndex(i => Math.max(0, i - 1))} disabled={clipIndex === 0}
                            className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30 transition-colors hover:bg-[var(--color-surface-2)]">
                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                        </button>
                        <span className="text-[11px] tabular-nums font-semibold min-w-[56px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
                            Clip {clipIndex + 1}/{totalClips}
                        </span>
                        <button onClick={() => setClipIndex(i => Math.min(totalClips - 1, i + 1))} disabled={clipIndex >= totalClips - 1}
                            className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30 transition-colors hover:bg-[var(--color-surface-2)]">
                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                        </button>
                    </div>
                </motion.div>

                {/* Main Layout */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Style Selection Panel */}
                    <motion.div
                        className="flex-1 min-w-0 space-y-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        {/* Unified Style Card */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                            {/* Tab navigation */}
                            <div className="px-4 pt-4 pb-0 flex items-center gap-1">
                                <button
                                    onClick={() => setActiveTab('caption')}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all relative"
                                    style={{
                                        background: activeTab === 'caption' ? 'var(--color-surface-1)' : 'transparent',
                                        color: activeTab === 'caption' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[16px]">subtitles</span>
                                    Caption Style
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: activeTab === 'caption' ? 'var(--color-accent-subtle)' : 'var(--color-surface-2)', color: activeTab === 'caption' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                        {filteredStyles.length}
                                    </span>
                                </button>
                                {hookStyles.length > 0 && (
                                    <button
                                        onClick={() => setActiveTab('hook')}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-all relative"
                                        style={{
                                            background: activeTab === 'hook' ? 'var(--color-surface-1)' : 'transparent',
                                            color: activeTab === 'hook' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">format_quote</span>
                                        Hook Overlay
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                            style={{ background: activeTab === 'hook' ? 'var(--color-accent-subtle)' : 'var(--color-surface-2)', color: activeTab === 'hook' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                            {filteredHooks.length}
                                        </span>
                                        {selectedHookStyle && (
                                            <span className="w-2 h-2 rounded-full absolute top-2 right-2" style={{ background: 'var(--color-accent)' }} />
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Tab content */}
                            <div className="rounded-t-xl" style={{ background: 'var(--color-surface-1)' }}>
                                <AnimatePresence mode="wait">
                                    {activeTab === 'caption' ? (
                                        <motion.div key="caption" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                            {/* Search + Pagination */}
                                            <div className="px-4 pt-4 flex items-center gap-3">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                                    <input
                                                        value={searchStyle}
                                                        onChange={e => setSearchStyle(e.target.value)}
                                                        placeholder="Search by name or font..."
                                                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none transition-all focus:ring-1"
                                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
                                                        aria-label="Search caption styles"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setStylePage(p => Math.max(0, p - 1))} disabled={stylePage === 0}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all hover:bg-[var(--color-surface-2)]"
                                                        style={{ border: '1px solid var(--color-border-subtle)' }}>
                                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                                    </button>
                                                    <span className="text-[10px] tabular-nums w-8 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                                        {stylePage + 1}/{styleTotalPages}
                                                    </span>
                                                    <button onClick={() => setStylePage(p => Math.min(styleTotalPages - 1, p + 1))} disabled={stylePage >= styleTotalPages - 1}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all hover:bg-[var(--color-surface-2)]"
                                                        style={{ border: '1px solid var(--color-border-subtle)' }}>
                                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Style grid */}
                                            <div className="p-4">
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    <AnimatePresence mode="popLayout">
                                                        {visibleStyles.map((style, i) => (
                                                            <StyleCard key={style.id} style={style} isActive={selectedStyle?.id === style.id}
                                                                onClick={() => setSelectedStyle(style)} delay={i * 0.03} />
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                                {filteredStyles.length === 0 && (
                                                    <p className="text-center text-xs py-8" style={{ color: 'var(--color-text-muted)' }}>No caption styles match your search</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="hook" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                                            {/* Search + None + Pagination */}
                                            <div className="px-4 pt-4 flex items-center gap-3">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                                    <input
                                                        value={searchHook}
                                                        onChange={e => setSearchHook(e.target.value)}
                                                        placeholder="Search hook styles..."
                                                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg outline-none transition-all"
                                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
                                                        aria-label="Search hook styles"
                                                    />
                                                </div>
                                                <button onClick={() => setSelectedHookStyle(null)}
                                                    className="text-[10px] font-semibold px-3 py-2 rounded-lg transition-all flex-shrink-0"
                                                    style={{
                                                        background: !selectedHookStyle ? 'var(--color-accent-subtle)' : 'var(--color-bg-input)',
                                                        color: !selectedHookStyle ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                        border: `1px solid ${!selectedHookStyle ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`
                                                    }}>
                                                    No Hook
                                                </button>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setHookPage(p => Math.max(0, p - 1))} disabled={hookPage === 0}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                                                        style={{ border: '1px solid var(--color-border-subtle)' }}>
                                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                                    </button>
                                                    <span className="text-[10px] tabular-nums w-8 text-center" style={{ color: 'var(--color-text-muted)' }}>{hookPage + 1}/{hookTotalPages}</span>
                                                    <button onClick={() => setHookPage(p => Math.min(hookTotalPages - 1, p + 1))} disabled={hookPage >= hookTotalPages - 1}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                                                        style={{ border: '1px solid var(--color-border-subtle)' }}>
                                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Hook grid */}
                                            <div className="p-4">
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    <AnimatePresence mode="popLayout">
                                                        {visibleHooks.map((hs, i) => (
                                                            <HookCard key={hs.id} hook={hs} isActive={selectedHookStyle?.id === hs.id}
                                                                onClick={() => setSelectedHookStyle(hs)} delay={i * 0.03} />
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                                {filteredHooks.length === 0 && (
                                                    <p className="text-center text-xs py-8" style={{ color: 'var(--color-text-muted)' }}>No hook styles match your search</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Resolution Selector */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Output:</span>
                            <ResolutionSelector value={resolution} onChange={setResolution} />
                        </div>

                        {/* Apply Button */}
                        <motion.button
                            onClick={handleApplyStyle}
                            disabled={!selectedStyle || applying}
                            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all"
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

                    {/* Right: Preview Panel */}
                    <motion.div
                        className="lg:w-[320px] xl:w-[360px] flex-shrink-0 space-y-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {/* Preview header */}
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>Live Preview</p>
                            <div className="flex rounded-lg overflow-hidden" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                                {[
                                    { key: 'remotion', icon: 'movie_filter', label: 'Animated' },
                                    { key: 'thumbnail', icon: 'image', label: 'Static' },
                                ].map(m => (
                                    <button
                                        key={m.key}
                                        onClick={() => setPreviewMode(m.key)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold transition-colors"
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

                        {/* Preview Container — Phone mockup */}
                        <div className="rounded-2xl overflow-hidden relative" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
                            {/* Notch */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full z-20" style={{ background: 'rgba(0,0,0,0.5)' }} />

                            <AnimatePresence mode="wait">
                                {previewMode === 'remotion' ? (
                                    <motion.div
                                        key="remotion"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center justify-center p-5 pt-8"
                                        style={{ background: 'linear-gradient(160deg, rgba(8,5,15,0.95), rgba(20,10,35,0.98))' }}
                                    >
                                        <KeyframePreview
                                            template={selectedStyle}
                                            type="caption"
                                            words={['sample', 'style', 'preview']}
                                            loop={true}
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
                                            <img src={thumbnailUrls[currentClip.index]} alt="Clip preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-surface-3))' }}>
                                                <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                                            </div>
                                        )}

                                        {/* Caption overlay preview */}
                                        {selectedStyle && (
                                            <div className="absolute left-3 right-3 text-center" style={{ bottom: '20px' }}>
                                                <span style={{ color: selectedStyle.color, fontFamily: selectedStyle.font_family, fontSize: '14px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>sample </span>
                                                <span style={{ color: selectedStyle.highlight_color, fontFamily: selectedStyle.font_family, fontSize: '14px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>caption</span>
                                                <span style={{ color: selectedStyle.color, fontFamily: selectedStyle.font_family, fontSize: '14px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}> text</span>
                                            </div>
                                        )}

                                        {/* Hook overlay preview */}
                                        {selectedHookStyle && (
                                            <div className="absolute left-3 right-3 text-center" style={{ top: '18%' }}>
                                                <p style={{ color: selectedHookStyle.color, fontSize: '11px', fontFamily: selectedHookStyle.font_family || 'inherit', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>Sample</p>
                                                <p style={{ color: selectedHookStyle.keyword_color, fontSize: '18px', fontWeight: 900, fontFamily: selectedHookStyle.font_family || 'inherit', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>HOOK TEXT</p>
                                            </div>
                                        )}

                                        {/* Badges */}
                                        <div className="absolute top-3 left-3 text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent)' }}>
                                            Clip #{currentClip?.index}
                                        </div>
                                        {currentClip?.duration && (
                                            <div className="absolute bottom-3 right-3 text-[10px] font-mono text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
                                                {currentClip.duration.toFixed(0)}s
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Hook text */}
                            {currentClip?.hook && (
                                <div className="px-4 py-3 flex items-start gap-2" style={{ borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}>
                                    <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                    <p className="text-[11px] font-medium line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                                        {currentClip.hook}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Selection summary */}
                        <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Selection</p>
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent-subtle)' }}>
                                    <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{selectedStyle?.name || 'None selected'}</p>
                                    {selectedStyle?.font_family && <p className="text-[9px] truncate" style={{ color: 'var(--color-text-muted)' }}>{selectedStyle.font_family}</p>}
                                </div>
                            </div>
                            {selectedHookStyle && (
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-accent-subtle)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{selectedHookStyle.name}</p>
                                        <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>3s hook overlay</p>
                                    </div>
                                    <button onClick={() => setSelectedHookStyle(null)} className="p-1 rounded-md transition-colors hover:bg-[var(--color-surface-2)]">
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>close</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Info note */}
                        <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)' }}>
                            <span className="material-symbols-outlined text-[13px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-info-text)' }}>tips_and_updates</span>
                            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-info-text)' }}>
                                Raw clips tetap tersimpan. Kamu bisa re-apply style kapan saja tanpa re-process video.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

// ─── Style Card Component ────────────────────────────────────────────────────
function StyleCard({ style, isActive, onClick, delay = 0 }) {
    const previewOutline = style.outline_enabled && style.outline_width > 0
        ? { WebkitTextStroke: `${Math.min(style.outline_width, 2)}px ${style.outline_color || '#000'}` }
        : {}
    const previewShadow = style.shadow_enabled
        ? `${style.shadow_offset_x || 0}px ${style.shadow_offset_y || 2}px ${style.shadow_blur || 4}px ${style.shadow_color || '#000'}`
        : 'none'

    return (
        <motion.button
            layout
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.2, delay }}
            onClick={onClick}
            className="relative rounded-xl overflow-hidden transition-all group text-left"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
            }}
        >
            {/* Preview area */}
            <div className="aspect-[4/3] flex items-center justify-center p-3 relative"
                style={{ background: 'linear-gradient(145deg, #0a0812 0%, #1a0f24 100%)' }}>
                <div className="text-center relative z-10 flex flex-wrap justify-center gap-x-1 items-baseline">
                    <span style={{ color: style.color || '#FFF', fontFamily: style.font_family, fontSize: '12px', fontWeight: style.font_weight || '700', textShadow: previewShadow, ...previewOutline }}>
                        sample
                    </span>
                    <span style={{ color: style.highlight_color || '#FFD700', fontFamily: style.font_family, fontSize: '13px', fontWeight: style.font_weight || '700', textShadow: style.highlight_style === 'glow' ? `0 0 6px ${style.highlight_color}` : previewShadow, ...previewOutline }}>
                        caption
                    </span>
                    <span style={{ color: style.color || '#FFF', fontFamily: style.font_family, fontSize: '12px', fontWeight: style.font_weight || '700', textShadow: previewShadow, ...previewOutline }}>
                        text
                    </span>
                </div>

                {/* Selection indicator */}
                {isActive && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--color-accent)' }}
                    >
                        <span className="material-symbols-outlined text-white text-[11px]">check</span>
                    </motion.div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Meta bar */}
            <div className="px-3 py-2 flex items-center justify-between gap-1" style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--color-text-secondary)' }}>{style.name}</p>
                <p className="text-[9px] truncate flex-shrink-0 ml-1 px-1.5 py-0.5 rounded" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-1)' }}>{style.font_family}</p>
            </div>
        </motion.button>
    )
}

// ─── Hook Card Component ─────────────────────────────────────────────────────
function HookCard({ hook, isActive, onClick, delay = 0 }) {
    const font = hook.font_family || 'inherit'
    const shadow = hook.shadow_enabled
        ? `0 0 ${hook.shadow_blur || 8}px ${hook.shadow_color || 'rgba(0,0,0,0.7)'}`
        : 'none'
    const kwUnderline = hook.keyword_underline_enabled
        ? { borderBottom: `2px solid ${hook.keyword_underline_color || '#FFF'}`, paddingBottom: '1px' }
        : {}
    const glowShadow = hook.glow_enabled
        ? `0 0 ${hook.glow_radius || 6}px ${hook.glow_color || '#FFF'}, ${shadow}`
        : shadow

    return (
        <motion.button
            layout
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.2, delay }}
            onClick={onClick}
            className="relative rounded-xl overflow-hidden transition-all group text-left"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
            }}
        >
            <div className="aspect-[4/3] flex items-center justify-center relative p-3"
                style={{ background: 'linear-gradient(145deg, #0a0812 0%, #12081e 100%)' }}>
                <div className="text-center relative z-10 space-y-0.5">
                    <p style={{ color: hook.color || '#FFF', fontSize: '9px', fontWeight: hook.font_weight || '400', textShadow: shadow, fontFamily: font, textTransform: hook.text_transform || 'uppercase', margin: 0 }}>Did you know</p>
                    <p style={{ color: hook.keyword_color || '#FFF', fontSize: '15px', fontWeight: 900, textShadow: glowShadow, fontFamily: font, textTransform: hook.text_transform || 'uppercase', margin: '2px 0', ...kwUnderline }}>THIS</p>
                    <p style={{ color: hook.color || '#FFF', fontSize: '9px', fontWeight: hook.font_weight || '400', textShadow: shadow, fontFamily: font, textTransform: hook.text_transform || 'uppercase', margin: 0 }}>trick?</p>
                </div>
                {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--color-accent)' }}>
                        <span className="material-symbols-outlined text-white text-[10px]">check</span>
                    </motion.div>
                )}
                <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="px-3 py-2" style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--color-text-secondary)' }}>{hook.name}</p>
            </div>
        </motion.button>
    )
}

export default StyleApplyPage
