import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, loadGoogleFonts, flattenHookStyle, getAuthenticatedMediaUrl } from '../utils/api'

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

    const STYLES_PER_PAGE = 3
    const HOOKS_PER_PAGE = 3

    useEffect(() => { loadData() }, [jobId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [baseClips, stylesData, fontsData, hookData] = await Promise.all([
                api.getBaseClips(jobId),
                api.getStyles(),
                api.getFonts(),
                api.getHookStyles(),
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
            if (Array.isArray(hookData)) setHookStyles(hookData.map(flattenHookStyle))
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

    const styleTotalPages = Math.ceil(styles.length / STYLES_PER_PAGE) || 1
    const hookTotalPages = Math.ceil(hookStyles.length / HOOKS_PER_PAGE) || 1
    const visibleStyles = styles.slice(stylePage * STYLES_PER_PAGE, (stylePage + 1) * STYLES_PER_PAGE)
    const visibleHooks = hookStyles.slice(hookPage * HOOKS_PER_PAGE, (hookPage + 1) * HOOKS_PER_PAGE)
    const currentClip = jobData?.clips?.[clipIndex]
    const totalClips = jobData?.clips?.length || 0

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading clips...</p>
                </div>
            </div>
        )
    }

    if (!jobData || !jobData.clips?.length) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                    <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-1)' }}>
                        <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-text-muted)' }}>movie_filter</span>
                    </div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>No base clips found</p>
                    <button onClick={onBack} className="btn btn-primary btn-sm">Go Back</button>
                </div>
            </div>
        )
    }

    // Caption style rendering for overlay - scaled from 1080x1920 video to preview size
    const renderCaptionOverlay = () => {
        if (!selectedStyle) return null
        const s = selectedStyle
        const config = s.config || {}
        const bgPill = config.background_pill || {}
        const hlConfig = config.highlight || {}

        // Preview container is 300px wide (9:16 = 300x533)
        const PW = 300
        const scale = PW / 1080  // 0.278

        const fontSize = Math.max(10, Math.round((s.font_size || 20) * scale * 3))
        const outlineW = (s.outline_width || 0) * scale * 2
        const shadowX = (s.shadow_offset_x || 0) * scale * 2
        const shadowY = (s.shadow_offset_y || 0) * scale * 2
        const bottomMargin = Math.max(8, Math.round((s.caption_bottom_margin || 70) * scale))

        const pillStyle = bgPill.enable ? {
            background: `${bgPill.color || '#1A0A2E'}${Math.round(((bgPill.opacity || 200) / 255) * 255).toString(16).padStart(2, '0')}`,
            padding: `${(bgPill.padding_y || 8) * scale * 1.5}px ${(bgPill.padding_x || 16) * scale * 1.5}px`,
            borderRadius: `${(bgPill.border_radius || 12) * scale * 1.5}px`,
            display: 'inline-block',
        } : {}

        const baseTextStyle = {
            color: s.color || '#FFF',
            fontFamily: s.font_family || 'Arial',
            fontSize: `${fontSize}px`,
            fontWeight: s.font_weight || 'bold',
            lineHeight: s.line_spacing || 1.2,
            display: 'inline',
            textShadow: `${shadowX}px ${shadowY}px 0px ${s.shadow_color || '#000'}`,
            ...(outlineW > 0 ? { WebkitTextStroke: `${outlineW}px ${s.outline_color || '#000'}` } : {}),
        }

        const hlTextStyle = {
            ...baseTextStyle,
            color: s.highlight_color || '#FF69B4',
            textShadow: hlConfig.style === 'glow' && hlConfig.glow_color
                ? `0 0 ${(hlConfig.glow_radius || 8) * scale * 2}px ${hlConfig.glow_color}, 0 0 ${(hlConfig.glow_radius || 8) * scale * 4}px ${hlConfig.glow_color}40, ${shadowX}px ${shadowY}px 0px ${s.shadow_color || '#000'}`
                : baseTextStyle.textShadow,
        }

        return (
            <div className="absolute left-2 right-2 text-center" style={{ bottom: `${bottomMargin}px`, ...pillStyle }}>
                <span style={baseTextStyle}>sample </span>
                <span style={hlTextStyle}>caption</span>
                <span style={baseTextStyle}> text</span>
            </div>
        )
    }

    // Hook overlay - scaled from 1080x1920
    const renderHookOverlay = () => {
        if (!selectedHookStyle) return null
        const hs = selectedHookStyle
        const PW = 300
        const scale = PW / 1080 * 2.2
        const normalSize = Math.round((hs.font_size_normal || 48) * scale)
        const keywordSize = Math.round((hs.font_size_keyword || 68) * scale)
        const shadow = hs.shadow_enable
            ? `0 0 ${(hs.shadow_blur || 10) * (PW / 1080)}px rgba(0,0,0,${((hs.shadow_opacity || 180) / 255).toFixed(2)})`
            : 'none'
        const font = hs.fallback_font || 'inherit'

        return (
            <div className="absolute left-2 right-2 text-center" style={{ top: '20%' }}>
                <p style={{ color: hs.text_color, fontSize: `${normalSize}px`, textShadow: shadow, lineHeight: 1.2, margin: 0, fontFamily: font }}>Sample</p>
                <p style={{ color: hs.keyword_color, fontSize: `${keywordSize}px`, textShadow: shadow, fontWeight: 900, lineHeight: 1.1, margin: 0, fontFamily: font, borderBottom: hs.keyword_underline_opacity > 0 ? `2px solid ${hs.keyword_underline_color}` : 'none' }}>HOOK</p>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="max-w-5xl mx-auto p-5 md:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-xl transition-colors hover:bg-[var(--color-surface-1)]" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Re-Style Clips</h1>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{totalClips} clips ready for styling</p>
                    </div>
                </div>

                {/* Main Layout */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Style Selection */}
                    <div className="flex-1 space-y-5">
                        {/* Caption Style */}
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>palette</span>
                                    Caption Style
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setStylePage(p => Math.max(0, p - 1))} disabled={stylePage === 0}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all" style={{ border: '1px solid var(--color-border-default)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                    </button>
                                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{stylePage + 1}/{styleTotalPages}</span>
                                    <button onClick={() => setStylePage(p => Math.min(styleTotalPages - 1, p + 1))} disabled={stylePage >= styleTotalPages - 1}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all" style={{ border: '1px solid var(--color-border-default)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2.5">
                                <AnimatePresence mode="popLayout">
                                    {visibleStyles.map(style => {
                                        const isActive = selectedStyle?.id === style.id
                                        return (
                                            <motion.button key={style.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                                onClick={() => setSelectedStyle(style)}
                                                className={`relative rounded-xl overflow-hidden transition-all ${isActive ? 'ring-2 ring-offset-2' : ''}`}
                                                style={{ border: isActive ? 'none' : '1px solid var(--color-border-subtle)', '--tw-ring-color': 'var(--color-accent)', '--tw-ring-offset-color': 'var(--color-bg-card)' }}>
                                                <div className="aspect-[5/3] flex items-center justify-center p-2 relative" style={{ background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-surface-1))' }}>
                                                    <span className="font-black text-[11px] text-center leading-tight" style={{ color: style.color, fontFamily: style.font_family }}>{style.name}</span>
                                                    {isActive && (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                                                            <span className="material-symbols-outlined text-white text-[10px]">check</span>
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <div className="px-2 py-1" style={{ background: 'var(--color-surface-1)' }}>
                                                    <p className="text-[9px] font-medium truncate" style={{ color: 'var(--color-text-muted)' }}>{style.font_family}</p>
                                                </div>
                                            </motion.button>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Hook Style */}
                        {hookStyles.length > 0 && (
                            <div className="rounded-2xl border p-5" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                        Hook Style
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setSelectedHookStyle(null)}
                                            className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                                            style={{ background: !selectedHookStyle ? 'var(--color-accent-subtle)' : 'transparent', color: !selectedHookStyle ? 'var(--color-accent)' : 'var(--color-text-muted)', border: `1px solid ${!selectedHookStyle ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}` }}>
                                            None
                                        </button>
                                        <button onClick={() => setHookPage(p => Math.max(0, p - 1))} disabled={hookPage === 0}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--color-border-default)' }}>
                                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                        </button>
                                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{hookPage + 1}/{hookTotalPages}</span>
                                        <button onClick={() => setHookPage(p => Math.min(hookTotalPages - 1, p + 1))} disabled={hookPage >= hookTotalPages - 1}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--color-border-default)' }}>
                                            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <AnimatePresence mode="popLayout">
                                        {visibleHooks.map(hs => {
                                            const isActive = selectedHookStyle?.id === hs.id
                                            return (
                                                <motion.button key={hs.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                                    onClick={() => setSelectedHookStyle(hs)}
                                                    className={`relative rounded-xl overflow-hidden transition-all ${isActive ? 'ring-2 ring-offset-2' : ''}`}
                                                    style={{ border: isActive ? 'none' : '1px solid var(--color-border-subtle)', '--tw-ring-color': 'var(--color-accent)', '--tw-ring-offset-color': 'var(--color-bg-card)' }}>
                                                    <div className="aspect-video flex items-center justify-center p-2" style={{ background: 'rgba(0,0,0,0.85)' }}>
                                                        <div className="text-center">
                                                            <p style={{ color: hs.keyword_color, fontSize: '11px', fontWeight: 900 }}>HOOK</p>
                                                            <p className="text-[8px] mt-0.5" style={{ color: hs.text_color }}>{hs.name}</p>
                                                        </div>
                                                        {isActive && (
                                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                                                                <span className="material-symbols-outlined text-white text-[9px]">check</span>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                </motion.button>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {/* Apply Button */}
                        <button onClick={handleApplyStyle} disabled={!selectedStyle || applying}
                            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                            style={{
                                background: selectedStyle && !applying ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                                color: selectedStyle && !applying ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
                                boxShadow: selectedStyle && !applying ? 'var(--btn-primary-shadow)' : 'none',
                                cursor: !selectedStyle || applying ? 'not-allowed' : 'pointer'
                            }}>
                            {applying ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Rendering {totalClips} clips...</>
                            ) : (
                                <><span className="material-symbols-outlined text-[18px]">auto_awesome</span>Apply Style to {totalClips} Clips</>
                            )}
                        </button>
                    </div>

                    {/* Right: Live Preview with clip thumbnail + style overlay */}
                    <div className="lg:w-[300px] flex-shrink-0">
                        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
                            {/* Clip navigation */}
                            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Preview</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setClipIndex(i => Math.max(0, i - 1))} disabled={clipIndex === 0}
                                        className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--color-border-default)' }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                    </button>
                                    <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--color-text-secondary)' }}>Clip {clipIndex + 1}/{totalClips}</span>
                                    <button onClick={() => setClipIndex(i => Math.min(totalClips - 1, i + 1))} disabled={clipIndex >= totalClips - 1}
                                        className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30" style={{ border: '1px solid var(--color-border-default)' }}>
                                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            {/* Clip thumbnail with style overlay */}
                            <div className="relative" style={{ aspectRatio: '9/16' }}>
                                <AnimatePresence mode="wait">
                                    <motion.div key={clipIndex} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="absolute inset-0">
                                        {thumbnailUrls[currentClip?.index] ? (
                                            <img src={thumbnailUrls[currentClip.index]} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-surface-2), var(--color-surface-3))' }}>
                                                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>

                                {/* Caption style overlay */}
                                {renderCaptionOverlay()}

                                {/* Hook overlay */}
                                {renderHookOverlay()}

                                {/* Clip badge */}
                                <div className="absolute top-2 left-2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent)' }}>
                                    #{currentClip?.index}
                                </div>

                                {/* Duration */}
                                <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)' }}>
                                    {currentClip?.duration?.toFixed(0)}s
                                </div>
                            </div>

                            {/* Clip hook text */}
                            {currentClip?.hook && (
                                <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                    <p className="text-[11px] font-semibold line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>{currentClip.hook}</p>
                                </div>
                            )}
                        </div>

                        {/* Hook note */}
                        {selectedHookStyle && (
                            <div className="mt-3 rounded-xl p-2.5 flex items-start gap-2" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)' }}>
                                <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning-text)' }}>info</span>
                                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning-text)' }}>
                                    Hook overlay hanya akan muncul di 3 detik awal video.
                                </p>
                            </div>
                        )}

                        {/* Info */}
                        <div className="mt-3 rounded-xl p-2.5 flex items-start gap-2" style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)' }}>
                            <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-info-text)' }}>tips_and_updates</span>
                            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-info-text)' }}>
                                Non-destructive: raw clips tetap tersimpan, bisa re-apply style kapan saja.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StyleApplyPage
