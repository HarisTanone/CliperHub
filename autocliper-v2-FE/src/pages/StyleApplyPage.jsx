import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
    const [previewClip, setPreviewClip] = useState(null)
    const [previewBlobUrl, setPreviewBlobUrl] = useState(null)
    const [thumbnailUrls, setThumbnailUrls] = useState({})
    const [currentStep, setCurrentStep] = useState(1)

    useEffect(() => {
        loadData()
    }, [jobId])

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

            // Load thumbnails
            if (baseClips?.clips) {
                const thumbs = {}
                for (const clip of baseClips.clips) {
                    if (clip.thumbnail_path) {
                        try {
                            const url = await getAuthenticatedMediaUrl(api.getClipThumbnailUrl(jobId, clip.index))
                            thumbs[clip.index] = url
                        } catch {
                            // Thumbnail not available
                        }
                    }
                }
                setThumbnailUrls(thumbs)
            }

            if (Array.isArray(stylesData)) {
                setStyles(stylesData)
                if (stylesData.length > 0) setSelectedStyle(stylesData[0])
            }
            if (Array.isArray(fontsData)) loadGoogleFonts(fontsData)
            if (Array.isArray(hookData)) setHookStyles(hookData.map(flattenHookStyle))
        } catch (e) {
            toast.error('Failed to load job data')
        } finally {
            setLoading(false)
        }
    }

    const handlePreviewClip = async (clip) => {
        try {
            const blobUrl = await getAuthenticatedMediaUrl(api.getBaseClipUrl(jobId, clip.index))
            setPreviewClip(clip)
            setPreviewBlobUrl(blobUrl)
        } catch {
            toast.error('Failed to load preview')
        }
    }

    const handleApplyStyle = async () => {
        if (!selectedStyle) { toast.error('Please select a caption style'); return }
        setApplying(true)
        try {
            const data = await api.applyStyle(jobId, selectedStyle.id, selectedHookStyle?.id || null)
            if (data.detail) { toast.error(data.detail); return }
            toast.success(`Style applied to ${data.clips_rendered || data.clips_to_style} clips!`)
            if (onDone) onDone()
        } catch (e) {
            toast.error('Style rendering failed: ' + (e.message || 'Unknown error'))
        } finally {
            setApplying(false)
        }
    }

    const closePreview = () => {
        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
        setPreviewBlobUrl(null)
        setPreviewClip(null)
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading clips...</p>
                </div>
            </div>
        )
    }

    if (!jobData || !jobData.clips?.length) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4 p-8">
                    <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-slate-400">movie_filter</span>
                    </div>
                    <div>
                        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No base clips found</p>
                        <p className="text-sm text-slate-500 mt-1">This job may need to be processed first</p>
                    </div>
                    <button onClick={onBack} className="px-4 py-2 text-sm text-primary font-semibold hover:bg-primary/10 rounded-lg transition-colors">
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Video Preview Modal */}
            {previewBlobUrl && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={closePreview}>
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative w-full max-w-sm"
                        style={{ aspectRatio: '9/16' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <video
                            src={previewBlobUrl}
                            controls
                            autoPlay
                            className="w-full h-full rounded-2xl bg-black shadow-2xl object-contain"
                        />
                        <button
                            onClick={closePreview}
                            className="absolute -top-3 -right-3 w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                        >
                            <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                        <div className="absolute top-4 left-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            RAW CLIP (no style)
                        </div>
                        {previewClip && (
                            <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md rounded-xl p-3">
                                <p className="text-white text-sm font-bold line-clamp-2">{previewClip.hook}</p>
                                <div className="flex items-center gap-3 mt-2 text-white/70 text-xs">
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">timer</span>
                                        {previewClip.duration?.toFixed(1)}s
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">trending_up</span>
                                        {Math.round((previewClip.score || 0) * 100)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}

            <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <button onClick={onBack} className="self-start p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined text-xl text-slate-500">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Re-Style Clips</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Choose caption and hook styles, then apply to generate final videos
                        </p>
                    </div>
                    {jobData.has_styled_clips && (
                        <span className="self-start sm:self-center text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Previously styled
                        </span>
                    )}
                </div>

                {/* Step Progress */}
                <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4">
                    <div className="flex items-center justify-between">
                        {[
                            { num: 1, label: 'Preview Clips', icon: 'movie' },
                            { num: 2, label: 'Choose Style', icon: 'palette' },
                            { num: 3, label: 'Apply & Export', icon: 'auto_awesome' }
                        ].map((step, i) => (
                            <div key={i} className="flex items-center flex-1">
                                <button
                                    onClick={() => setCurrentStep(step.num)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${currentStep === step.num
                                        ? 'bg-primary/10 text-primary'
                                        : currentStep > step.num
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-slate-400'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentStep === step.num
                                        ? 'bg-primary text-white'
                                        : currentStep > step.num
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }`}>
                                        {currentStep > step.num ? (
                                            <span className="material-symbols-outlined text-lg">check</span>
                                        ) : (
                                            step.num
                                        )}
                                    </div>
                                    <span className="hidden sm:block text-sm font-medium">{step.label}</span>
                                </button>
                                {i < 2 && <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-700 mx-2" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Clips Grid */}
                <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-xl text-amber-500">movie</span>
                            Raw Clips ({jobData.clips.length})
                        </h2>
                        <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                            Click to preview
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {jobData.clips.map(clip => (
                            <motion.button
                                key={clip.index}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handlePreviewClip(clip)}
                                className="text-left rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all group bg-white dark:bg-[#1a2d3d]"
                            >
                                {/* Thumbnail */}
                                <div className="relative" style={{ aspectRatio: '9/16' }}>
                                    {thumbnailUrls[clip.index] ? (
                                        <img
                                            src={thumbnailUrls[clip.index]}
                                            alt={`Clip ${clip.index}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-600">movie</span>
                                        </div>
                                    )}

                                    {/* Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
                                            play_circle
                                        </span>
                                    </div>

                                    {/* Badges */}
                                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                                        <span className="text-[10px] font-bold bg-gradient-to-r from-primary to-accent text-white px-2 py-0.5 rounded-full shadow">
                                            #{clip.index}
                                        </span>
                                    </div>
                                    <div className="absolute top-2 right-2">
                                        <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow">
                                            {Math.round((clip.score || 0) * 100)}%
                                        </span>
                                    </div>
                                    <div className="absolute bottom-2 right-2">
                                        <span className="text-[10px] font-mono bg-black/70 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                            {clip.duration?.toFixed(1)}s
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-2.5">
                                    <p className="text-[11px] font-semibold text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                        {clip.hook}
                                    </p>
                                    {clip.keywords?.length > 0 && (
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                            {clip.keywords.slice(0, 2).map((kw, i) => (
                                                <span key={i} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold uppercase">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Style Selection */}
                <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 space-y-6">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-xl text-primary">palette</span>
                        Choose Style
                    </h2>

                    {/* Caption Style */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Caption Style</p>
                            {selectedStyle && (
                                <span className="text-xs text-primary font-medium">{selectedStyle.name}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                            {styles.map(style => (
                                <button
                                    key={style.id}
                                    onClick={() => setSelectedStyle(style)}
                                    className={`rounded-xl overflow-hidden transition-all ${selectedStyle?.id === style.id
                                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-[#152230] shadow-lg'
                                        : 'border border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                        }`}
                                >
                                    <div className="aspect-[3/4] bg-gradient-to-br from-slate-800 to-slate-900 flex items-end justify-center p-2 relative">
                                        <span
                                            className="font-black text-xs text-center leading-tight"
                                            style={{
                                                color: style.color,
                                                textShadow: `1px 1px 0 ${style.outline_color || '#000'}`
                                            }}
                                        >
                                            {style.name}
                                        </span>
                                        {selectedStyle?.id === style.id && (
                                            <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-sm">check</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hook Style */}
                    {hookStyles.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hook Style</p>
                                <button
                                    onClick={() => setSelectedHookStyle(null)}
                                    className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${!selectedHookStyle
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    No Hook
                                </button>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                {hookStyles.map(hs => (
                                    <button
                                        key={hs.id}
                                        onClick={() => setSelectedHookStyle(hs)}
                                        className={`rounded-xl overflow-hidden transition-all ${selectedHookStyle?.id === hs.id
                                            ? 'ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-[#152230] shadow-lg'
                                            : 'border border-slate-200 dark:border-slate-700 hover:border-accent/50'
                                            }`}
                                    >
                                        <div className="aspect-video bg-black flex items-center justify-center p-2 relative">
                                            <span
                                                className="text-[10px] font-black text-center"
                                                style={{ color: hs.keyword_color || '#fff' }}
                                            >
                                                {hs.name}
                                            </span>
                                            {selectedHookStyle?.id === hs.id && (
                                                <div className="absolute top-1 right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-white text-xs">check</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onBack}
                        className="px-6 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApplyStyle}
                        disabled={!selectedStyle || applying}
                        className={`flex-1 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${selectedStyle && !applying
                            ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {applying ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Rendering {jobData.clips.length} clips...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                Apply Style to {jobData.clips.length} Clips
                            </>
                        )}
                    </button>
                </div>

                {/* Info Banner */}
                {!jobData.has_raw_clips && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                        <span className="material-symbols-outlined text-xl text-amber-500 mt-0.5">warning</span>
                        <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Legacy job detected</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                This job was processed before re-styling was available. For best results, consider re-processing the video to generate raw clips.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
                    <span className="material-symbols-outlined text-xl text-blue-500 mt-0.5">tips_and_updates</span>
                    <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Non-destructive editing</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                            Raw clips are preserved. You can re-apply different styles anytime without re-processing the video.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StyleApplyPage
