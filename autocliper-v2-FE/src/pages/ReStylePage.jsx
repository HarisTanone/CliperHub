import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, getAuthenticatedMediaUrl } from '../utils/api'
import KeyframePreview from '../components/KeyframePreview'

// ═══════════════════════════════════════════════════════════════
// RE-STYLE PAGE — Apply new keyframe styles to completed clips
// Uses hook_text_raw from request_log (does NOT re-call Gemini)
// ═══════════════════════════════════════════════════════════════

export default function ReStylePage() {
    // Completed clips from history
    const [completedJobs, setCompletedJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedJob, setSelectedJob] = useState(null)
    const [thumbnailUrls, setThumbnailUrls] = useState({})

    // Style selection
    const [compositions, setCompositions] = useState([])
    const [captionTemplates, setCaptionTemplates] = useState([])
    const [hookTemplates, setHookTemplates] = useState([])
    const [selectedComp, setSelectedComp] = useState(null)
    const [selectedCaptionTpl, setSelectedCaptionTpl] = useState(null)
    const [selectedHookTpl, setSelectedHookTpl] = useState(null)
    const [advancedMode, setAdvancedMode] = useState(false)

    // UI state
    const [applying, setApplying] = useState(false)
    const [searchJobs, setSearchJobs] = useState('')
    const [styleSearch, setStyleSearch] = useState('')
    const [stylePage, setStylePage] = useState(0)

    const STYLES_PER_PAGE = 6

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [historyData, compsData, captionsData, hooksData] = await Promise.all([
                api.getJobHistory(),
                api.getStyleCompositions(),
                api.getCaptionTemplates(),
                api.getHookTemplates(),
            ])

            // Filter to only completed jobs
            const completed = (Array.isArray(historyData) ? historyData : [])
                .filter(j => j.status === 'completed')
            setCompletedJobs(completed)

            if (Array.isArray(compsData)) setCompositions(compsData)
            if (Array.isArray(captionsData)) setCaptionTemplates(captionsData)
            if (Array.isArray(hooksData)) setHookTemplates(hooksData)

            // Load thumbnails for first few jobs
            const thumbs = {}
            for (const job of completed.slice(0, 20)) {
                try {
                    const url = await getAuthenticatedMediaUrl(`/api/v1/jobs/${job.id}/thumbnail/0`)
                    thumbs[job.id] = url
                } catch { /* ignore */ }
            }
            setThumbnailUrls(thumbs)
        } catch {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    // Filter completed jobs
    const filteredJobs = useMemo(() => {
        if (!searchJobs.trim()) return completedJobs
        const q = searchJobs.toLowerCase()
        return completedJobs.filter(j =>
            (j.video_title || '').toLowerCase().includes(q) ||
            (j.youtube_url || '').toLowerCase().includes(q)
        )
    }, [completedJobs, searchJobs])

    // Filter styles
    const filteredStyles = useMemo(() => {
        const items = advancedMode ? captionTemplates : compositions
        if (!styleSearch.trim()) return items
        const q = styleSearch.toLowerCase()
        return items.filter(s => (s.name || '').toLowerCase().includes(q))
    }, [compositions, captionTemplates, advancedMode, styleSearch])

    const styleTotalPages = Math.ceil(filteredStyles.length / STYLES_PER_PAGE) || 1
    const visibleStyles = filteredStyles.slice(stylePage * STYLES_PER_PAGE, (stylePage + 1) * STYLES_PER_PAGE)

    useEffect(() => { setStylePage(0) }, [styleSearch, advancedMode])

    // Resolve selected template for preview
    const previewHookTemplate = useMemo(() => {
        if (selectedHookTpl) return selectedHookTpl
        if (selectedComp && !advancedMode) {
            return hookTemplates.find(h => h.id === selectedComp.hook_template_id) || null
        }
        return null
    }, [selectedComp, selectedHookTpl, hookTemplates, advancedMode])

    const previewCaptionTemplate = useMemo(() => {
        if (selectedCaptionTpl) return selectedCaptionTpl
        if (selectedComp && !advancedMode) {
            return captionTemplates.find(c => c.id === selectedComp.caption_template_id) || null
        }
        return null
    }, [selectedComp, selectedCaptionTpl, captionTemplates, advancedMode])

    const handleSelectComposition = (comp) => {
        setSelectedComp(comp)
        setSelectedCaptionTpl(null)
        setSelectedHookTpl(null)
    }

    const handleRestyle = async () => {
        if (!selectedJob) {
            toast.error('Select a clip to re-style')
            return
        }

        const captionId = advancedMode ? selectedCaptionTpl?.id : (selectedComp ? captionTemplates.find(c => c.id === selectedComp.caption_template_id)?.id : null)
        const hookId = advancedMode ? selectedHookTpl?.id : (selectedComp ? hookTemplates.find(h => h.id === selectedComp.hook_template_id)?.id : null)
        const compId = advancedMode ? null : selectedComp?.id

        if (!captionId && !hookId && !compId) {
            toast.error('Select a style to apply')
            return
        }

        setApplying(true)
        try {
            const result = await api.restyleJob(selectedJob.id, {
                captionTemplateId: captionId,
                hookTemplateId: hookId,
                styleCompositionId: compId,
            })

            if (result.detail) {
                toast.error(result.detail)
                return
            }

            toast.success(result.message || `Re-styled ${result.clips_restyled} clips!`)
        } catch (e) {
            const msg = e?.message || 'Re-style failed'
            toast.error(msg)
        } finally {
            setApplying(false)
        }
    }

    // Get hook text for selected job (from first clip)
    const selectedJobHookText = useMemo(() => {
        if (!selectedJob?.clips?.length) return 'Sample hook text'
        return selectedJob.clips[0]?.hook || 'Sample hook text'
    }, [selectedJob])

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
                        <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--color-accent)' }}>style</span>
                    </motion.div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loading re-style editor...</p>
                </div>
            </div>
        )
    }

    if (!completedJobs.length) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="text-center space-y-4 p-8">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                        <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>movie_filter</span>
                    </div>
                    <p className="font-semibold text-lg" style={{ color: 'var(--color-text-primary)' }}>No completed clips</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Process a video first, then you can re-style the clips here.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
            {/* ─── Left Column: Scrollable content (clips + styles) ─── */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8">
                {/* Header */}
                <motion.div
                    className="flex items-center gap-3 mb-6"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}>
                        <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--color-accent)' }}>style</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Re-Style Clips</h1>
                        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            Apply new visual styles to completed clips without re-processing video
                        </p>
                    </div>
                </motion.div>

                {/* Clip Selection */}
                <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                            Completed Clips ({filteredJobs.length})
                        </h2>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                        <input value={searchJobs} onChange={e => setSearchJobs(e.target.value)}
                            placeholder="Search by title or URL..."
                            className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl outline-none"
                            style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                            aria-label="Search completed clips" />
                    </div>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                        <AnimatePresence>
                            {filteredJobs.map((job, i) => (
                                <ClipListItem key={job.id} job={job} thumbnail={thumbnailUrls[job.id]}
                                    isSelected={selectedJob?.id === job.id} onClick={() => setSelectedJob(job)} delay={i * 0.03} />
                            ))}
                        </AnimatePresence>
                        {filteredJobs.length === 0 && (
                            <p className="text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>No clips match your search</p>
                        )}
                    </div>
                </div>

                {/* Style Selection */}
                {selectedJob && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        {/* Style card */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <h3 className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                    <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>palette</span>
                                    {advancedMode ? 'Select Templates' : 'Style Presets'}
                                </h3>
                                <button onClick={() => setAdvancedMode(!advancedMode)}
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

                            <div className="px-4 pt-3 flex items-center gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                                    <input value={styleSearch} onChange={e => setStyleSearch(e.target.value)}
                                        placeholder={advancedMode ? "Search templates..." : "Search presets..."}
                                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg outline-none"
                                        style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setStylePage(p => Math.max(0, p - 1))} disabled={stylePage === 0}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                                        style={{ border: '1px solid var(--color-border-subtle)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                                    </button>
                                    <span className="text-[9px] tabular-nums min-w-[28px] text-center" style={{ color: 'var(--color-text-muted)' }}>{stylePage + 1}/{styleTotalPages}</span>
                                    <button onClick={() => setStylePage(p => Math.min(styleTotalPages - 1, p + 1))} disabled={stylePage >= styleTotalPages - 1}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                                        style={{ border: '1px solid var(--color-border-subtle)' }}>
                                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                <AnimatePresence mode="wait">
                                    {!advancedMode ? (
                                        <motion.div key="compositions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                                {visibleStyles.map((comp, i) => (
                                                    <StyleCompositionCard key={comp.id} composition={comp} isActive={selectedComp?.id === comp.id}
                                                        onClick={() => handleSelectComposition(comp)} delay={i * 0.03}
                                                        captionTemplates={captionTemplates} hookTemplates={hookTemplates} />
                                                ))}
                                            </div>
                                            {filteredStyles.length === 0 && (
                                                <p className="text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>No style presets found</p>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div key="advanced" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                            <div>
                                                <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                    <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
                                                    Caption Template
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {visibleStyles.map((tpl, i) => (
                                                        <TemplateCard key={tpl.id} template={tpl} isActive={selectedCaptionTpl?.id === tpl.id}
                                                            onClick={() => { setSelectedCaptionTpl(tpl); setSelectedComp(null) }} delay={i * 0.03} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                    <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                                                    Hook Template
                                                    <button onClick={() => setSelectedHookTpl(null)}
                                                        className="ml-auto text-[9px] px-2 py-0.5 rounded"
                                                        style={{ background: !selectedHookTpl ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)', color: !selectedHookTpl ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                                                        None
                                                    </button>
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {hookTemplates.slice(0, 6).map((tpl, i) => (
                                                        <TemplateCard key={tpl.id} template={tpl} isActive={selectedHookTpl?.id === tpl.id}
                                                            onClick={() => { setSelectedHookTpl(tpl); setSelectedComp(null) }} delay={i * 0.03} />
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Apply Button */}
                        <motion.button onClick={handleRestyle}
                            disabled={applying || (!selectedComp && !selectedCaptionTpl && !selectedHookTpl)}
                            className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all"
                            style={{
                                background: (selectedComp || selectedCaptionTpl || selectedHookTpl) && !applying ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                                color: (selectedComp || selectedCaptionTpl || selectedHookTpl) && !applying ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
                                boxShadow: (selectedComp || selectedCaptionTpl || selectedHookTpl) && !applying ? 'var(--btn-primary-shadow)' : 'none',
                                cursor: applying || (!selectedComp && !selectedCaptionTpl && !selectedHookTpl) ? 'not-allowed' : 'pointer',
                            }}
                            whileHover={(selectedComp || selectedCaptionTpl || selectedHookTpl) && !applying ? { scale: 1.01 } : {}}>
                            {applying ? (
                                <><motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />Re-styling...</>
                            ) : (
                                <><span className="material-symbols-outlined text-[18px]">auto_awesome</span>Apply Re-Style</>
                            )}
                        </motion.button>

                        {/* Info note */}
                        <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)' }}>
                            <span className="material-symbols-outlined text-[13px] mt-0.5 flex-shrink-0" style={{ color: 'var(--color-info-text)' }}>tips_and_updates</span>
                            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-info-text)' }}>
                                Re-style menggunakan teks hook yang sudah ada — tidak memanggil AI ulang.
                                Output baru disimpan terpisah tanpa menimpa file asli.
                            </p>
                        </div>
                    </motion.div>
                )}

                {!selectedJob && (
                    <div className="flex items-center justify-center h-[200px] rounded-2xl" style={{ background: 'var(--color-surface-1)', border: '1px dashed var(--color-border-subtle)' }}>
                        <div className="text-center space-y-2">
                            <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-text-muted)' }}>touch_app</span>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Select a clip above to re-style</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Right Column: Sticky Device Preview (Google Pixel 7 Pro) ─── */}
            <div className="hidden lg:flex w-[340px] xl:w-[380px] flex-shrink-0 items-start justify-center p-6"
                style={{ borderLeft: '1px solid var(--color-border-subtle)' }}>
                <div className="sticky top-6 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>phone_android</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Google Pixel 7 Pro</span>
                    </div>

                    {/* Device Frame */}
                    <div className="relative">
                        <div className="rounded-[2.5rem] p-[3px]"
                            style={{ background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset' }}>
                            <div className="rounded-[2.3rem] overflow-hidden relative"
                                style={{ width: 280, height: 600, background: 'linear-gradient(180deg, #1a1025 0%, #0d0a14 50%, #1a0f20 100%)' }}>
                                <div className="absolute top-0 left-0 right-0 h-7 flex items-center justify-between px-5 z-30">
                                    <span className="text-[9px] font-medium text-white/50">9:41</span>
                                    <div className="flex items-center gap-1"><span className="text-[8px] text-white/50">●●●</span></div>
                                </div>
                                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full z-30"
                                    style={{ background: 'radial-gradient(circle, #111 40%, #000 70%)' }} />

                                <div className="absolute inset-0 z-10">
                                    {previewHookTemplate ? (
                                        <KeyframePreview template={previewHookTemplate} type="hook"
                                            text={selectedJobHookText} loop={true} />
                                    ) : previewCaptionTemplate ? (
                                        <KeyframePreview template={previewCaptionTemplate} type="caption"
                                            words={selectedJobHookText.split(' ').slice(0, 5)} loop={true} />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-center space-y-3 px-6">
                                                <span className="material-symbols-outlined text-3xl" style={{ color: 'rgba(255,255,255,0.2)' }}>touch_app</span>
                                                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Select a style to preview</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-white/20 z-20" />
                            </div>
                        </div>
                        <div className="absolute right-[-2px] top-[120px] w-[3px] h-[40px] rounded-r-full" style={{ background: '#333' }} />
                        <div className="absolute left-[-2px] top-[100px] w-[3px] h-[25px] rounded-l-full" style={{ background: '#333' }} />
                        <div className="absolute left-[-2px] top-[140px] w-[3px] h-[50px] rounded-l-full" style={{ background: '#333' }} />
                    </div>

                    {/* Selected info */}
                    {(selectedComp || selectedCaptionTpl || selectedHookTpl) && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="w-full rounded-xl p-3 space-y-1.5"
                            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>New Style</p>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-success-text)' }} />
                            </div>
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {selectedComp?.name || selectedCaptionTpl?.name || selectedHookTpl?.name}
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    )
}


// ─── Clip List Item ──────────────────────────────────────────────────────────
function ClipListItem({ job, thumbnail, isSelected, onClick, delay = 0 }) {
    const clipCount = job.clips?.length || job.hook_count || 0
    const title = job.video_title || 'Untitled Video'

    return (
        <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ delay }}
            onClick={onClick}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all group"
            style={{
                background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)',
                border: `1px solid ${isSelected ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
            }}
        >
            {/* Thumbnail */}
            <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: 'var(--color-surface-2)' }}>
                {thumbnail ? (
                    <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                    </div>
                )}
                {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(var(--color-accent-rgb, 99, 102, 241), 0.3)' }}>
                        <span className="material-symbols-outlined text-white text-[14px]">check_circle</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] flex items-center gap-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="material-symbols-outlined text-[10px]">movie</span>
                        {clipCount} clips
                    </span>
                    {job.clips?.[0]?.hook && (
                        <span className="text-[9px] truncate max-w-[120px]" style={{ color: 'var(--color-text-muted)' }}>
                            "{job.clips[0].hook.slice(0, 30)}..."
                        </span>
                    )}
                </div>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {job.created_at ? new Date(job.created_at).toLocaleDateString() : ''}
                </p>
            </div>
        </motion.button>
    )
}


// ─── Style Composition Card ──────────────────────────────────────────────────
function StyleCompositionCard({ composition, isActive, onClick, delay = 0, captionTemplates, hookTemplates }) {
    const captionTpl = captionTemplates.find(c => c.id === composition.caption_template_id)
    const hookTpl = hookTemplates.find(h => h.id === composition.hook_template_id)

    return (
        <motion.button
            layout
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay }}
            onClick={onClick}
            className="relative rounded-xl overflow-hidden transition-all group text-left"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
            }}
        >
            <div className="aspect-[4/3] flex flex-col items-center justify-center p-3 relative"
                style={{ background: 'linear-gradient(145deg, #0a0812 0%, #1a0f24 100%)' }}>
                {/* Mini preview of caption + hook style */}
                <div className="text-center relative z-10 space-y-1">
                    {hookTpl && (
                        <p className="text-[8px] font-bold uppercase tracking-wide" style={{ color: hookTpl.config?.text?.default_font?.color || '#FFD700' }}>
                            HOOK
                        </p>
                    )}
                    {captionTpl && (
                        <p className="text-[10px] font-semibold" style={{ color: captionTpl.config?.colors?.primary || '#FFFFFF' }}>
                            caption <span style={{ color: captionTpl.config?.highlight?.color || '#FFD700' }}>text</span>
                        </p>
                    )}
                </div>

                {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: 'var(--color-accent)' }}>
                        <span className="material-symbols-outlined text-white text-[11px]">check</span>
                    </motion.div>
                )}
                <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="px-3 py-2 flex items-center justify-between gap-1" style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--color-text-secondary)' }}>{composition.name}</p>
                {composition.category && composition.category !== 'general' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                        {composition.category}
                    </span>
                )}
            </div>
        </motion.button>
    )
}


// ─── Template Card (for Advanced mode) ───────────────────────────────────────
function TemplateCard({ template, isActive, onClick, delay = 0 }) {
    return (
        <motion.button
            layout
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay }}
            onClick={onClick}
            className="relative rounded-xl overflow-hidden transition-all group text-left"
            style={{
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                boxShadow: isActive ? 'var(--shadow-glow)' : 'none',
            }}
        >
            <div className="aspect-[4/3] flex items-center justify-center p-2 relative"
                style={{ background: 'linear-gradient(145deg, #0a0812 0%, #1a0f24 100%)' }}>
                <p className="text-[10px] font-bold text-center" style={{ color: '#FFFFFF' }}>
                    {template.name?.slice(0, 20)}
                </p>
                {template.style_type === 'animated' && (
                    <span className="absolute top-1.5 left-1.5 text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                        ✨
                    </span>
                )}
                {isActive && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-accent)' }}>
                        <span className="material-symbols-outlined text-white text-[10px]">check</span>
                    </motion.div>
                )}
            </div>
            <div className="px-2 py-1.5" style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border-subtle)' }}>
                <p className="text-[9px] font-semibold truncate" style={{ color: 'var(--color-text-secondary)' }}>{template.name}</p>
            </div>
        </motion.button>
    )
}
