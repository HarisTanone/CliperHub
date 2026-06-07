import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import ProgressRing from '../components/ProgressRing'

const STATUS_COLORS = {
    processing: 'var(--color-warning-text)',
    pending: 'var(--color-text-muted)',
    downloading: 'var(--color-info-text)',
    analyzing: 'var(--color-accent)',
    completed: 'var(--color-success-text)',
    failed: 'var(--color-error-text)',
}

const STATUS_LABELS = {
    processing: 'Processing',
    pending: 'Queued',
    downloading: 'Downloading',
    analyzing: 'Analyzing',
    completed: 'Completed',
    failed: 'Failed',
}

function useVideoInfo(url) {
    const [info, setInfo] = useState(null)
    useEffect(() => {
        if (!url) return
        fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
            .then(r => r.ok ? r.json() : null).then(d => d && setInfo(d)).catch(() => { })
    }, [url])
    return info
}


function ActiveJobCard({ logs }) {
    const videoInfo = useVideoInfo(logs?.youtube_url)
    const stages = logs?.stages || []
    const totalClips = logs?.total_clips || 0
    const clipsCompleted = logs?.clips_completed || 0
    const status = logs?.status || 'idle'

    const doneStages = stages.filter(s => s.status === 'done').length
    const progress = status === 'completed' ? 100 :
        stages.length > 0 ? Math.round((doneStages / stages.length) * 100) : 0

    if (status === 'idle') return null

    return (
        <FadeInUp>
            <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--color-warning-text)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Currently Processing</h3>
                    {totalClips > 0 && (
                        <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-lg"
                            style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                            {clipsCompleted}/{totalClips} clips
                        </span>
                    )}
                </div>

                <div className="flex gap-4 items-center mb-4">
                    <div className="w-24 aspect-video rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: 'var(--color-surface-1)' }}>
                        {videoInfo?.thumbnail_url ? (
                            <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--icon-muted)' }}>smart_display</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {videoInfo?.title || logs?.youtube_url || 'Processing...'}
                        </h4>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{logs?.youtube_url}</p>
                        <p className="text-xs font-medium mt-1 capitalize" style={{ color: 'var(--color-warning-text)' }}>
                            {logs?.current_stage || status}
                        </p>
                    </div>
                    <ProgressRing progress={progress} size={52} strokeWidth={4} />
                </div>

                {/* Stage progress */}
                <div className="flex items-center gap-1">
                    {stages.map((stage, i) => (
                        <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                            <div className="h-1.5 w-full rounded-full transition-all"
                                style={{
                                    background: stage.status === 'done' ? 'var(--color-accent)' :
                                        stage.status === 'active' ? 'var(--color-accent-subtle)' :
                                            'var(--color-surface-1)'
                                }} />
                            <span className="text-[9px] font-medium" style={{
                                color: stage.status === 'active' ? 'var(--color-accent)' :
                                    stage.status === 'done' ? 'var(--color-text-secondary)' :
                                        'var(--color-text-muted)'
                            }}>{stage.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </FadeInUp>
    )
}


function QueueItem({ job, position }) {
    const videoInfo = useVideoInfo(job.url)

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-surface-1)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>#{position}</span>
            </div>
            <div className="w-14 aspect-video rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-1)' }}>
                {videoInfo?.thumbnail_url ? (
                    <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--icon-muted)' }}>smart_display</span>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {videoInfo?.title || job.url}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Queued {new Date(job.queued_at).toLocaleTimeString()}
                </p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full"
                style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                Waiting
            </span>
        </motion.div>
    )
}

function RecentJobItem({ job }) {
    const videoInfo = useVideoInfo(job.youtube_url)
    const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.pending

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <div className="w-12 aspect-video rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-1)' }}>
                {videoInfo?.thumbnail_url ? (
                    <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--icon-muted)' }}>smart_display</span>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {videoInfo?.title || job.youtube_url}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {job.clips_count} clips · {new Date(job.requested_at).toLocaleString()}
                </p>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                <span className="text-[10px] font-medium capitalize" style={{ color: 'var(--color-text-muted)' }}>
                    {STATUS_LABELS[job.status] || job.status}
                </span>
            </div>
        </div>
    )
}


function QueuePage() {
    const [logs, setLogs] = useState(null)
    const [queue, setQueue] = useState({ processing_url: null, queue_length: 0, pending: [] })
    const [recentJobs, setRecentJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const wsRef = useRef(null)
    const reconnectRef = useRef(null)

    const loadData = useCallback(async () => {
        try {
            const [logsData, queueData, jobsData] = await Promise.all([
                api.getJobLogs(),
                api.getJobQueue(),
                api.getJobs(),
            ])
            setLogs(logsData)
            setQueue(queueData)
            if (Array.isArray(jobsData)) setRecentJobs(jobsData.slice(0, 10))
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    const handleClearStuck = async () => {
        try {
            const result = await api.clearStuckQueue()
            toast.success(result.message || 'Stuck state cleared')
            setQueue(prev => ({ ...prev, processing_url: null }))
            setTimeout(loadData, 500)
        } catch (e) {
            toast.error(e.message || 'Failed to clear stuck state')
        }
    }

    // WebSocket connection for real-time updates
    useEffect(() => {
        let active = true

        const connect = () => {
            const token = localStorage.getItem('access_token')
            if (!token) return

            const wsUrl = api.getWebSocketUrl()
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'auth', token }))
            }

            ws.onmessage = (event) => {
                if (!active) return
                try {
                    const msg = JSON.parse(event.data)
                    if (msg.type === 'job_progress') {
                        setLogs(msg.data)
                    } else if (msg.type === 'queue_status' || msg.type === 'queue_update') {
                        if (msg.data.pending) setQueue(msg.data)
                    } else if (msg.type === 'job_completed') {
                        toast.success(`✅ Video selesai diproses!`)
                        loadData()
                    } else if (msg.type === 'job_failed') {
                        const errorMsg = msg.data?.error || 'Processing failed'
                        toast.error(`❌ ${errorMsg}`, { duration: 8000 })
                        loadData()
                    }
                } catch { /* ignore */ }
            }

            ws.onclose = () => {
                if (active) {
                    reconnectRef.current = setTimeout(connect, 3000)
                }
            }

            ws.onerror = () => ws.close()
        }

        loadData()
        connect()

        const pollInterval = setInterval(loadData, 5000)

        return () => {
            active = false
            clearInterval(pollInterval)
            if (reconnectRef.current) clearTimeout(reconnectRef.current)
            if (wsRef.current) wsRef.current.close()
        }
    }, [loadData])

    const isProcessing = logs?.status === 'processing'
    const hasQueue = queue.pending?.length > 0


    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Active Processing */}
                {isProcessing && <ActiveJobCard logs={logs} />}

                {/* Queue */}
                <FadeInUp delay={0.1}>
                    <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--icon-accent)' }}>queue</span>
                                Processing Queue
                                {hasQueue && (
                                    <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full"
                                        style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
                                        {queue.pending.length} waiting
                                    </span>
                                )}
                            </h3>
                            <button onClick={loadData}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-colors cursor-pointer"
                                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border-default)' }}>
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                            </button>
                        </div>

                        {!isProcessing && !hasQueue ? (
                            <div className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                                    style={{ background: 'var(--color-success-bg)' }}>
                                    <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-success-text)' }}>check_circle</span>
                                </div>
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Queue is empty</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>All jobs have been processed</p>
                                {queue.processing_url && (
                                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                        <p className="text-xs mb-2" style={{ color: 'var(--color-warning-text)' }}>
                                            <span className="material-symbols-outlined text-sm align-middle mr-1">warning</span>
                                            Stuck processing detected: {queue.processing_url.substring(0, 50)}...
                                        </p>
                                        <button
                                            onClick={handleClearStuck}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                                            style={{ color: 'var(--color-error-text)', border: '1px solid var(--color-error-border)' }}
                                        >
                                            <span className="material-symbols-outlined text-sm align-middle mr-1">refresh</span>
                                            Clear Stuck State
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-3">
                                <AnimatePresence>
                                    {queue.pending?.map((job, i) => (
                                        <QueueItem key={job.url} job={job} position={i + 1} />
                                    ))}
                                </AnimatePresence>
                                {!hasQueue && isProcessing && (
                                    <p className="text-center text-xs py-4" style={{ color: 'var(--color-text-muted)' }}>No other jobs in queue</p>
                                )}
                            </div>
                        )}
                    </div>
                </FadeInUp>

                {/* Recent Jobs */}
                <FadeInUp delay={0.2}>
                    <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--icon-accent)' }}>history</span>
                                Recent Jobs
                            </h3>
                        </div>
                        {recentJobs.length === 0 ? (
                            <div className="p-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No jobs yet</div>
                        ) : (
                            <div className="p-2">
                                <StaggerContainer staggerDelay={0.03}>
                                    {recentJobs.map(job => (
                                        <StaggerItem key={job.id}>
                                            <RecentJobItem job={job} />
                                        </StaggerItem>
                                    ))}
                                </StaggerContainer>
                            </div>
                        )}
                    </div>
                </FadeInUp>
            </div>
        </div>
    )
}

export default QueuePage
