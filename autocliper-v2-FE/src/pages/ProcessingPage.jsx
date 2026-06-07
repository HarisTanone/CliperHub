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

  const fallbackStages = [
    { key: 'fetching_video', label: 'Fetching Video', status: 'active' },
    { key: 'analyzing_content', label: 'Analyzing', status: 'pending' },
    { key: 'generating_clips', label: 'Generating', status: 'pending' },
    { key: 'applying_captions', label: 'Captions', status: 'pending' },
  ]
  const displayStages = stages.length > 0 ? stages : fallbackStages

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Video card */}
        <div className="rounded-2xl p-4 shadow-sm flex gap-4 items-center" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="w-28 aspect-video rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--color-surface-1)' }}>
            {videoInfo?.thumbnail_url
              ? <img src={videoInfo.thumbnail_url} alt="thumb" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-3xl" style={{ color: 'var(--icon-muted)' }}>smart_display</span></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{videoInfo?.title || 'Processing Video...'}</h3>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{videoUrl || data?.youtube_url}</p>
            <div className="flex items-center gap-2 mt-2">
              {!isDone && !isFailed && !cancelled && (
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-warning-text)' }}>
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-warning-text)', borderTopColor: 'transparent' }} />
                  {isStreaming ? 'Live Stream' : 'Processing...'}
                </div>
              )}
              {isDone && <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--color-success-text)' }}><span className="material-symbols-outlined text-[14px]">check_circle</span>Completed</span>}
              {isFailed && <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--color-error-text)' }}><span className="material-symbols-outlined text-[14px]">error</span>Failed</span>}
            </div>
          </div>
        </div>

        {/* Progress */}
        <FadeInUp delay={0.1}>
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <ProgressRing progress={progressPercent} size={64} strokeWidth={5} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Overall Progress</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {isDone ? 'All stages complete' : isFailed ? 'Processing failed' : 'Processing your video...'}
                  </p>
                </div>
              </div>
              {totalClips > 0 && !isDone && (
                <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>{clipsCompleted}/{totalClips} clips</span>
              )}
            </div>

            <div className="h-2 rounded-full overflow-hidden mb-6" style={{ background: 'var(--color-surface-1)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--color-accent)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>

            {/* Steps */}
            <div className="flex items-start justify-between relative">
              <div className="absolute top-5 left-5 right-5 h-0.5" style={{ background: 'var(--color-surface-1)' }} />
              <div className="absolute top-5 left-5 h-0.5 transition-all duration-700"
                style={{ width: `calc(${progressPercent}% - 20px)`, background: 'var(--color-accent)' }} />

              {displayStages.map((stage) => {
                const icon = STEP_ICONS[stage.key] || 'circle'
                const isDoneStage = stage.status === 'done'
                const isActive = stage.status === 'active'
                return (
                  <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all duration-500"
                      style={{
                        background: isDoneStage ? 'var(--color-accent)' : isActive ? 'var(--color-bg-card)' : isFailed && !isDoneStage ? 'var(--color-error-text)' : 'var(--color-surface-1)',
                        border: isActive ? '2px solid var(--color-accent)' : 'none',
                        color: isDoneStage || (isFailed && !isDoneStage) ? 'white' : isActive ? 'var(--color-accent)' : 'var(--color-text-muted)'
                      }}>
                      {isDoneStage
                        ? <span className="material-symbols-outlined text-[18px]">check</span>
                        : isActive
                          ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                          : <span className="material-symbols-outlined text-[18px]">{icon}</span>
                      }
                    </div>
                    <span className="text-[11px] font-semibold text-center leading-tight"
                      style={{ color: isActive ? 'var(--color-accent)' : isDoneStage ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                      {stage.label}
                    </span>
                    {isActive && stage.key === 'generating_clips' && totalClips > 0 && (
                      <span className="text-[10px] font-bold" style={{ color: 'var(--color-accent)' }}>{clipsCompleted}/{totalClips}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </FadeInUp>

        {/* Status banners */}
        {isDone && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-success-bg)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-success-text)' }}>check_circle</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-success-text)' }}>Processing Complete!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-success-text)', opacity: 0.8 }}>Generated {totalClips} clips — check History to download</p>
            </div>
            {onApplyStyle && data?.request_id && (
              <button onClick={() => onApplyStyle(data.request_id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
                <span className="material-symbols-outlined text-[14px]">palette</span>
                Apply Style
              </button>
            )}
          </div>
        )}
        {isFailed && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-error-bg)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-error-text)' }}>error</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-error-text)' }}>{data?.error || 'Job processing failed.'}</p>
          </div>
        )}
        {cancelled && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)' }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-warning-text)' }}>cancel</span>
            <p className="text-sm" style={{ color: 'var(--color-warning-text)' }}>Job has been cancelled.</p>
          </div>
        )}

        {/* Terminal log */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--color-error-text)' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--color-warning-text)' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--color-success-text)' }} />
              </div>
              <span className="text-xs font-mono ml-1" style={{ color: 'var(--color-text-muted)' }}>process.log</span>
              {isStreaming && (
                <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-0.5"
                  style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-success-text)' }} />
                  LIVE
                </span>
              )}
            </div>
            {totalClips > 0 && !isDone && (
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{clipsCompleted}/{totalClips} clips</span>
            )}
          </div>
          <div ref={logRef} className="p-4 h-56 overflow-y-auto font-mono text-[12px] leading-relaxed flex flex-col gap-1" style={{ background: 'var(--color-bg-primary)' }}>
            {allLogs.length === 0 && !isDone && !isFailed && !cancelled && (
              <p className="animate-pulse" style={{ color: 'var(--color-text-muted)' }}>Waiting for logs...</p>
            )}
            {allLogs.map((log, i) => (
              <p key={i} style={{ color: log.message.includes('✅') || log.message.includes('complete') ? 'var(--color-success-text)' : log.message.includes('❌') || log.message.includes('error') || log.message.includes('fail') ? 'var(--color-error-text)' : log.message.includes('Starting') || log.message.includes('Clip ') ? 'var(--color-warning-text)' : 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>[{formatTs(log.timestamp)}]</span>{' '}
                <span style={{ color: 'var(--color-text-tertiary)' }}>{log.stageLabel}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> › </span>
                {log.message}
              </p>
            ))}
            {!isDone && !isFailed && !cancelled && (
              <span className="animate-pulse" style={{ color: 'var(--color-accent)' }}>▋</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          {(isDone || isFailed || cancelled) ? (
            <button onClick={onBack}
              className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm transition-colors"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to New Job
            </button>
          ) : <div />}
          {!isDone && !cancelled && (
            <button onClick={handleCancel}
              className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm transition-colors"
              style={{ border: '2px solid var(--color-error-border)', color: 'var(--color-error-text)', background: 'transparent' }}>
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
