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
    const [previewClip, setPreviewClip] = useState(null)
    const [previewBlobUrl, setPreviewBlobUrl] = useState(null)

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
            toast.success(`Style applied to ${data.clips_rendered} clips!`)
            if (onDone) onDone()
        } catch {
            toast.error('Style rendering failed')
        } finally {
            setApplying(false)
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading clips...</p>
                </div>
            </div>
        )
    }

    if (!jobData || !jobData.clips?.length) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                    <span className="material-symbols-outlined text-4xl text-slate-400">movie_filter</span>
                    <p className="text-sm text-slate-500">No base clips found for this job</p>
                    <button onClick={onBack} className="text-sm text-primary font-medium">Go Back</button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-transparent">
            {/* Preview Modal */}
            {previewBlobUrl && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); setPreviewClip(null) }}>
                    <div className="relative max-w-xs w-full" style={{ aspectRatio: '9/16' }} onClick={e => e.stopPropagation()}>
                        <video src={previewBlobUrl} controls autoPlay className="w-full h-full rounded-2xl bg-black shadow-2xl" />
                        <button onClick={() => { URL.revokeObjectURL(previewBlobUrl); setPreviewBlobUrl(null); setPreviewClip(null) }}
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                        <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                            BASE CLIP (no style)
                        </div>
                        {previewClip && (
                            <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm rounded-xl p-2">
                                <p className="text-white text-[10px] font-bold truncate">{previewClip.hook}</p>
                                <p className="text-white/60 text-[9px]">{previewClip.duration?.toFixed(1)}s • Score: {Math.round((previewClip.score || 0) * 100)}%</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                        <span className="material-symbols-outlined text-[20px] text-slate-400">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Apply Style</h2>
                        <p className="text-xs text-slate-500">Preview base clips, then choose your style for final render</p>
                    </div>
                    {jobData.has_styled_clips && (
                        <span className="ml-auto text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>Previously styled
                        </span>
                    )}
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648]">
                    {['Preview Clips', 'Choose Style', 'Apply & Export'].map((step, i) => (
                        <div key={i} className="flex items-center gap-2 flex-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-emerald-500 text-white' : i === 1 ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>{i + 1}</div>
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hidden sm:block">{step}</span>
                            {i < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700 mx-1" />}
                        </div>
                    ))}
                </div>

                {/* Clips Grid */}
                <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-500">movie_filter</span>
                        Base Clips ({jobData.clips.length})
                        <span className="text-[10px] font-normal text-slate-400 ml-1">Click to preview</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {jobData.clips.map(clip => (
                            <motion.button key={clip.index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => handlePreviewClip(clip)}
                                className="text-left rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden hover:border-primary/40 transition-all group">
                                <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
                                    <span className="material-symbols-outlined text-3xl text-slate-600 group-hover:text-primary transition-colors">play_circle</span>
                                    <div className="absolute top-2 left-2 flex gap-1">
                                        <span className="text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">#{clip.index}</span>
                                        <span className="text-[9px] font-bold bg-emerald-500/80 text-white px-1.5 py-0.5 rounded">{Math.round((clip.score || 0) * 100)}%</span>
                                    </div>
                                    <div className="absolute bottom-2 right-2 text-[9px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
                                        {clip.duration?.toFixed(1)}s
                                    </div>
                                </div>
                                <div className="p-2.5">
                                    <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">{clip.hook}</p>
                                    {clip.keywords?.length > 0 && (
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            {clip.keywords.slice(0, 3).map((kw, i) => (
                                                <span key={i} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{kw}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Style Selection */}
                <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 space-y-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">palette</span>
                        Choose Style for Final Render
                    </h3>

                    {/* Caption Style */}
                    <div>
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Caption Style</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                            {styles.map(style => (
                                <button key={style.id} onClick={() => setSelectedStyle(style)}
                                    className={`rounded-xl overflow-hidden transition-all ${selectedStyle?.id === style.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-[#152230]' : 'border border-slate-200 dark:border-slate-700/60 hover:border-primary/40'}`}>
                                    <div className="aspect-[4/3] bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center">
                                        <span className="font-black text-[10px] px-1 text-center" style={{ color: style.color }}>{style.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hook Style */}
                    {hookStyles.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hook Style</p>
                                <button onClick={() => setSelectedHookStyle(null)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${!selectedHookStyle ? 'bg-primary/20 text-primary' : 'text-slate-500 border border-slate-200 dark:border-slate-700/50'}`}>
                                    None
                                </button>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                {hookStyles.map(hs => (
                                    <button key={hs.id} onClick={() => setSelectedHookStyle(hs)}
                                        className={`rounded-xl overflow-hidden transition-all ${selectedHookStyle?.id === hs.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-[#152230]' : 'border border-slate-200 dark:border-slate-700/60 hover:border-accent/40'}`}>
                                        <div className="aspect-video bg-black/80 flex items-center justify-center">
                                            <p style={{ color: hs.keyword_color, fontSize: '9px', fontWeight: 900 }}>{hs.name}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Apply Button */}
                <div className="flex gap-3">
                    <button onClick={onBack}
                        className="px-5 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        Back
                    </button>
                    <button onClick={handleApplyStyle} disabled={!selectedStyle || applying}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${selectedStyle && !applying ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-xl shadow-primary/20 hover:shadow-primary/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                        {applying ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Rendering with style...</>
                        ) : (
                            <><span className="material-symbols-outlined text-[18px]">auto_awesome</span>Apply Style & Render Final</>
                        )}
                    </button>
                </div>

                {/* Re-render info */}
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
                    <span className="material-symbols-outlined text-[16px] text-blue-500">tips_and_updates</span>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                        You can come back and apply a different style anytime — base clips are cached and won't be re-processed.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default StyleApplyPage
