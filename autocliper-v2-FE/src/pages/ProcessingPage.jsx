import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { api } from '../utils/api'
import { FadeInUp } from '../components/PageTransition'
import ProgressRing from '../components/ProgressRing'

const STEP_ICONS = {
  fetching_video: 'download',
  analyzing_content: 'psychology',
  generating_clips: 'movie_filter',
  applying_captions: 'subtitles',
}

function ProcessingPage({ jobId, videoInfo: initialVideoInfo, videoUrl, onBack, onApplyStyle }) {
  const [data, setData] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [cancelled, setCancelled] = useState(false)
  const [videoInfo, setVideoInfo] = useState(initialVideoInfo || null)
  const [isStreaming, setIsStreaming] = useState(false)
  const logRef = useRef(null)
  const pollingRef = useRef(null)
  const abortRef = useRef(null)
  const fallbackActive = useRef(false)

  // Fetch video info if not provided
  useEffect(() => {
    if (videoInfo || !videoUrl) return
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setVideoInfo(d)).catch(() => { })
  }, [videoUrl])

  // SSE stream with polling fallback
  useEffect(() => {
    let active = true
    const token = localStorage.getItem('access_token')

    async function startSSE() {
      try {
        abortRef.current = new AbortController()
        setIsStreaming(true)

        const response = await fetch(api.getJobLogsStreamUrl(), {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortRef.current.signal,
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done || !active) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (!active) break
                setData(parsed)
                if (parsed.stages) {
                  const flat = parsed.stages.flatMap(stage =>
                    (stage.logs || []).map(log => ({ stageLabel: stage.label, message: log.message, timestamp: log.timestamp }))
                  )
                  setAllLogs(flat)
                }
                const s = (parsed.status || '').toLowerCase()
                if (s === 'completed' || s === 'failed') {
                  setIsStreaming(false)
                  return
                }
              } catch { }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError' && active) {
          console.warn('SSE failed, falling back to polling:', err.message)
          setIsStreaming(false)
          startPolling()
        }
      }
    }

    function startPolling() {
      if (fallbackActive.current) return
      fallbackActive.current = true

      const poll = async () => {
        try {
          const res = await api.getJobLogs()
          if (!active) return
          setData(res)
          if (res.stages) {
            const flat = res.stages.flatMap(stage =>
              (stage.logs || []).map(log => ({ stageLabel: stage.label, message: log.message, timestamp: log.timestamp }))
            )
            setAllLogs(flat)
          }
          const s = (res.status || '').toLowerCase()
          if (s === 'completed' || s === 'failed') clearInterval(pollingRef.current)
        } catch { }
      }
      poll()
      pollingRef.current = setInterval(poll, 3000)
    }

    startSSE()

    return () => {
      active = false
      if (abortRef.current) abortRef.current.abort()
      if (pollingRef.current) clearInterval(pollingRef.current)
      fallbackActive.current = false
    }
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [allLogs])

  const handleCancel = async () => {
    if (!jobId) return
    try { await api.deleteJob(jobId); setCancelled(true); if (abortRef.current) abortRef.current.abort(); clearInterval(pollingRef.current) }
    catch { alert('Failed to cancel job') }
  }

  const status = (data?.status || 'processing').toLowerCase()
  const isDone = status === 'completed'
  const isFailed = status === 'failed'
  const stages = data?.stages || []
  const totalClips = data?.total_clips || 0
  const clipsCompleted = data?.clips_completed || 0

  const doneStages = stages.filter(s => s.status === 'done').length
  const activeIdx = stages.findIndex(s => s.status === 'active')
  let progressPercent = isDone ? 100 : stages.length > 0
    ? Math.round((doneStages / stages.length) * 100 + (activeIdx >= 0 && totalClips > 0 ? (clipsCompleted / totalClips) * (100 / stages.length) : activeIdx >= 0 ? (100 / stages.length) * 0.3 : 0))
    : 5

  const formatTs = (ts) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleTimeString('en-GB', { hour12: false }) } catch { return '' }
  }

  const logColor = (msg) => {
    if (msg.includes('✅') || msg.includes('complete')) return 'text-emerald-400'
    if (msg.includes('❌') || msg.includes('error') || msg.includes('fail')) return 'text-red-400'
    if (msg.includes('Starting') || msg.includes('Clip ')) return 'text-amber-400'
    return 'text-slate-300'
  }

  const fallbackStages = [
    { key: 'fetching_video', label: 'Fetching Video', status: 'active' },
    { key: 'analyzing_content', label: 'Analyzing', status: 'pending' },
    { key: 'generating_clips', label: 'Generating', status: 'pending' },
    { key: 'applying_captions', label: 'Captions', status: 'pending' },
  ]
  const displayStages = stages.length > 0 ? stages : fallbackStages

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Video card */}
        <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm flex gap-4 items-center">
          <div className="w-28 aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
            {videoInfo?.thumbnail_url
              ? <img src={videoInfo.thumbnail_url} alt="thumb" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-3xl text-slate-400">smart_display</span></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white truncate">{videoInfo?.title || 'Processing Video...'}</h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">{videoUrl || data?.youtube_url}</p>
            <div className="flex items-center gap-2 mt-2">
              {!isDone && !isFailed && !cancelled && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  {isStreaming ? 'Live Stream' : 'Processing...'}
                </div>
              )}
              {isDone && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span>Completed</span>}
              {isFailed && <span className="text-xs text-red-500 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span>Failed</span>}
            </div>
          </div>
        </div>

        {/* Progress */}
        <FadeInUp delay={0.1}>
          <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <ProgressRing progress={progressPercent} size={64} strokeWidth={5} />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Overall Progress</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isDone ? 'All stages complete' : isFailed ? 'Processing failed' : 'Processing your video...'}
                  </p>
                </div>
              </div>
              {totalClips > 0 && !isDone && (
                <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-[#1e2e40] px-2 py-1 rounded-lg">{clipsCompleted}/{totalClips} clips</span>
              )}
            </div>

            <div className="h-2 bg-slate-100 dark:bg-[#1e2e40] rounded-full overflow-hidden mb-6">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>

            {/* Steps */}
            <div className="flex items-start justify-between relative">
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-100 dark:bg-[#1e2e40]" />
              <div className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-700"
                style={{ width: `calc(${progressPercent}% - 20px)` }} />

              {displayStages.map((stage) => {
                const icon = STEP_ICONS[stage.key] || 'circle'
                const isDoneStage = stage.status === 'done'
                const isActive = stage.status === 'active'
                return (
                  <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all duration-500 ${isDoneStage ? 'bg-primary text-white' :
                      isActive ? 'bg-white dark:bg-[#152230] border-2 border-primary text-primary' :
                        isFailed && !isDoneStage ? 'bg-red-500 text-white' :
                          'bg-slate-100 dark:bg-[#1e2e40] text-slate-400'
                      }`}>
                      {isDoneStage
                        ? <span className="material-symbols-outlined text-[18px]">check</span>
                        : isActive
                          ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          : <span className="material-symbols-outlined text-[18px]">{icon}</span>
                      }
                    </div>
                    <span className={`text-[11px] font-semibold text-center leading-tight ${isActive ? 'text-primary' : isDoneStage ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'
                      }`}>
                      {stage.label}
                    </span>
                    {isActive && stage.key === 'generating_clips' && totalClips > 0 && (
                      <span className="text-[10px] text-primary font-bold">{clipsCompleted}/{totalClips}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </FadeInUp>

        {/* Status banners */}
        {isDone && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">check_circle</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Processing Complete!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Generated {totalClips} clips — check History to download</p>
            </div>
            {onApplyStyle && data?.request_id && (
              <button onClick={() => onApplyStyle(data.request_id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[14px]">palette</span>
                Apply Style
              </button>
            )}
          </div>
        )}
        {isFailed && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl">
            <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400">{data?.error || 'Job processing failed.'}</p>
          </div>
        )}
        {cancelled && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
            <span className="material-symbols-outlined text-amber-500 text-[20px]">cancel</span>
            <p className="text-sm text-amber-700 dark:text-amber-400">Job has been cancelled.</p>
          </div>
        )}

        {/* Terminal log */}
        <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <span className="text-xs text-slate-500 font-mono ml-1">process.log</span>
              {isStreaming && (
                <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded-full flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            {totalClips > 0 && !isDone && (
              <span className="text-xs text-slate-400 font-mono">{clipsCompleted}/{totalClips} clips</span>
            )}
          </div>
          <div ref={logRef} className="bg-[#0d1117] p-4 h-56 overflow-y-auto font-mono text-[12px] leading-relaxed flex flex-col gap-1">
            {allLogs.length === 0 && !isDone && !isFailed && !cancelled && (
              <p className="text-slate-600 animate-pulse">Waiting for logs...</p>
            )}
            {allLogs.map((log, i) => (
              <p key={i} className={logColor(log.message)}>
                <span className="text-slate-600">[{formatTs(log.timestamp)}]</span>{' '}
                <span className="text-slate-500">{log.stageLabel}</span>
                <span className="text-slate-600"> › </span>
                {log.message}
              </p>
            ))}
            {!isDone && !isFailed && !cancelled && (
              <span className="text-primary animate-pulse">▋</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          {(isDone || isFailed || cancelled) ? (
            <button onClick={onBack}
              className="flex items-center gap-2 py-2.5 px-5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-primary/25">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to New Job
            </button>
          ) : <div />}
          {!isDone && !cancelled && (
            <button onClick={handleCancel}
              className="flex items-center gap-2 py-2.5 px-5 border-2 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-semibold text-sm transition-colors">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Cancel Job
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

export default ProcessingPage
