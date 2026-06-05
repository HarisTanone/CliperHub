import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import ProgressRing from '../components/ProgressRing'

const STATUS_COLORS = {
    processing: 'bg-amber-500',
    pending: 'bg-slate-400',
    downloading: 'bg-blue-500',
    analyzing: 'bg-purple-500',
    completed: 'bg-emerald-500',
    failed: 'bg-red-500',
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
            <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Currently Processing</h3>
                    {totalClips > 0 && (
                        <span className="ml-auto text-xs text-slate-400 font-mono bg-slate-100 dark:bg-[#1e2e40] px-2 py-0.5 rounded-lg">
                            {clipsCompleted}/{totalClips} clips
                        </span>
                    )}
                </div>

                <div className="flex gap-4 items-center mb-4">
                    <div className="w-24 aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 relative">
                        {videoInfo?.thumbnail_url ? (
                            <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-slate-400">smart_display</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {videoInfo?.title || logs?.youtube_url || 'Processing...'}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{logs?.youtube_url}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 capitalize">
                            {logs?.current_stage || status}
                        </p>
                    </div>
                    <ProgressRing progress={progress} size={52} strokeWidth={4} />
                </div>

                {/* Stage progress */}
                <div className="flex items-center gap-1">
                    {stages.map((stage, i) => (
                        <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                            <div className={`h-1.5 w-full rounded-full transition-all ${stage.status === 'done' ? 'bg-primary' :
                                stage.status === 'active' ? 'bg-primary/50 animate-pulse' :
                                    'bg-slate-200 dark:bg-[#1e2e40]'
                                }`} />
                            <span className={`text-[9px] font-medium ${stage.status === 'active' ? 'text-primary' :
                                stage.status === 'done' ? 'text-slate-600 dark:text-slate-300' :
                                    'text-slate-400'
                                }`}>{stage.label}</span>
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
            className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-[#192633]/60 rounded-xl transition-colors"
        >
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1e2e40] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-500">#{position}</span>
            </div>
            <div className="w-14 aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
                {videoInfo?.thumbnail_url ? (
                    <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px] text-slate-300">smart_display</span>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {videoInfo?.title || job.url}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                    Queued {new Date(job.queued_at).toLocaleTimeString()}
                </p>
            </div>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#1e2e40] text-slate-500 text-[10px] font-semibold rounded-full">
                Waiting
            </span>
        </motion.div>
    )
}

function RecentJobItem({ job }) {
    const videoInfo = useVideoInfo(job.youtube_url)
    const statusColor = STATUS_COLORS[job.status] || STATUS_COLORS.pending

    return (
        <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-[#192633]/60 rounded-xl transition-colors">
            <div className="w-12 aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
                {videoInfo?.thumbnail_url ? (
                    <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px] text-slate-300">smart_display</span>
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {videoInfo?.title || job.youtube_url}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                    {job.clips_count} clips · {new Date(job.requested_at).toLocaleString()}
                </p>
            </div>
            <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                <span className="text-[10px] font-medium text-slate-500 capitalize">
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
            // Immediately clear local state, then reload data
            setQueue(prev => ({ ...prev, processing_url: null }))
            // Wait a bit for backend to fully clear, then reload
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
                    } else if (msg.type === 'job_completed' || msg.type === 'job_failed') {
                        loadData() // Refresh all data
                    }
                } catch { /* ignore */ }
            }

            ws.onclose = () => {
                if (active) {
                    // Reconnect after 3 seconds
                    reconnectRef.current = setTimeout(connect, 3000)
                }
            }

            ws.onerror = () => ws.close()
        }

        // Initial load + start WebSocket
        loadData()
        connect()

        // Fallback polling (in case WebSocket fails)
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
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
            <div className="max-w-4xl mx-auto space-y-5">

                {/* Active Processing */}
                {isProcessing && <ActiveJobCard logs={logs} />}

                {/* Queue */}
                <FadeInUp delay={0.1}>
                    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">queue</span>
                                Processing Queue
                                {hasQueue && (
                                    <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-full">
                                        {queue.pending.length} waiting
                                    </span>
                                )}
                            </h3>
                            <button onClick={loadData}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-primary border border-slate-200 dark:border-[#324d67] hover:border-primary/40 rounded-xl transition-colors">
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                            </button>
                        </div>

                        {!isProcessing && !hasQueue ? (
                            <div className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-3xl text-emerald-500">check_circle</span>
                                </div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Queue is empty</p>
                                <p className="text-xs text-slate-400 mt-1">All jobs have been processed</p>
                                {queue.processing_url && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                                            <span className="material-symbols-outlined text-sm align-middle mr-1">warning</span>
                                            Stuck processing detected: {queue.processing_url.substring(0, 50)}...
                                        </p>
                                        <button
                                            onClick={handleClearStuck}
                                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-white border border-red-200 dark:border-red-800 hover:bg-red-500 rounded-lg transition-colors"
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
                                    <p className="text-center text-xs text-slate-400 py-4">No other jobs in queue</p>
                                )}
                            </div>
                        )}
                    </div>
                </FadeInUp>

                {/* Recent Jobs */}
                <FadeInUp delay={0.2}>
                    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648]">
                            <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                                Recent Jobs
                            </h3>
                        </div>
                        {recentJobs.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-400">No jobs yet</div>
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
