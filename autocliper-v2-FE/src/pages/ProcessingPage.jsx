import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../utils/api'
import { FadeInUp } from '../components/PageTransition'
import ProgressRing from '../components/ProgressRing'

const STEP_META = {
  fetching_video: { icon: 'cloud_download', label: 'Fetching Video', desc: 'Downloading from YouTube' },
  analyzing_content: { icon: 'psychology', label: 'AI Analysis', desc: 'Finding viral moments' },
  generating_clips: { icon: 'movie_filter', label: 'Generating Clips', desc: 'Cutting & tracking' },
  applying_captions: { icon: 'subtitles', label: 'Applying Style', desc: 'Captions & overlays' },
}

function ProcessingPage({ jobId, videoInfo: initialVideoInfo, videoUrl, onBack, onApplyStyle }) {
  const [data, setData] = useState(null)
  const [allLogs, setAllLogs] = useState([])
  const [cancelled, setCancelled] = useState(false)
  const [videoInfo, setVideoInfo] = useState(initialVideoInfo || null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [logFilter, setLogFilter] = useState('all') // all, errors, success
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const logRef = useRef(null)
  const pollingRef = useRef(null)
  const abortRef = useRef(null)
  const fallbackActive = useRef(false)

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 1000)
    return () => clearInterval(timer)
  }, [startTime])

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

  const formatElapsed = (ms) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const formatTs = (ts) => {
    if (!ts) return ''
    try { return new Date(ts).toLocaleTimeString('en-GB', { hour12: false }) } catch { return '' }
  }

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return allLogs
    if (logFilter === 'errors') return allLogs.filter(l => l.message.includes('❌') || l.message.toLowerCase().includes('error') || l.message.toLowerCase().includes('fail'))
    if (logFilter === 'success') return allLogs.filter(l => l.message.includes('✅') || l.message.toLowerCase().includes('complete'))
    return allLogs
  }, [allLogs, logFilter])

  const errorCount = useMemo(() => allLogs.filter(l => l.message.includes('❌') || l.message.toLowerCase().includes('error') || l.message.toLowerCase().includes('fail')).length, [allLogs])

  const fallbackStages = [
    { key: 'fetching_video', label: 'Fetching Video', status: 'active' },
    { key: 'analyzing_content', label: 'Analyzing', status: 'pending' },
    { key: 'generating_clips', label: 'Generating', status: 'pending' },
    { key: 'applying_captions', label: 'Captions', status: 'pending' },
  ]
  const displayStages = stages.length > 0 ? stages : fallbackStages

  const activeStage = displayStages.find(s => s.status === 'active')
  const activeStageInfo = activeStage ? (STEP_META[activeStage.key] || { desc: 'Processing...' }) : null

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ═══ Hero Header: Video + Progress Ring ═══ */}
        <FadeInUp>
          <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
            {/* Top gradient accent bar */}
            <div className="h-1" style={{ background: isDone ? 'var(--color-success-text)' : isFailed ? 'var(--color-error-text)' : 'linear-gradient(90deg, var(--burgundy), var(--color-accent))' }} />

            <div className="p-5 flex gap-5 items-center">
              {/* Thumbnail with overlay */}
              <div className="w-32 aspect-video rounded-xl overflow-hidden flex-shrink-0 relative shadow-sm" style={{ background: 'var(--color-surface-1)' }}>
                {videoInfo?.thumbnail_url
                  ? <img src={videoInfo.thumbnail_url} alt="Video thumbnail" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-3xl" style={{ color: 'var(--icon-muted)' }}>smart_display</span></div>
                }
                {!isDone && !isFailed && !cancelled && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="w-7 h-7 border-[2.5px] border-white/80 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {isDone && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl drop-shadow-lg">check_circle</span>
                  </div>
                )}
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-base leading-snug line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                  {videoInfo?.title || 'Processing Video...'}
                </h2>
                <p className="text-xs truncate mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {videoUrl || data?.youtube_url}
                </p>
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  {/* Status badge */}
                  {!isDone && !isFailed && !cancelled && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-accent)' }} />
                      {isStreaming ? 'Live' : 'Processing'}
                    </span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      Completed
                    </span>
                  )}
                  {isFailed && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>
                      <span className="material-symbols-outlined text-[12px]">error</span>
                      Failed
                    </span>
                  )}
                  {/* Elapsed time */}
                  <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="material-symbols-outlined text-[13px]">timer</span>
                    {formatElapsed(elapsed)}
                  </span>
                  {/* Clips counter */}
                  {totalClips > 0 && (
                    <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="material-symbols-outlined text-[13px]">movie_filter</span>
                      {clipsCompleted}/{totalClips} clips
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Ring (right side) */}
              <div className="flex-shrink-0 hidden sm:block">
                <ProgressRing progress={progressPercent} size={72} strokeWidth={5} />
              </div>
            </div>
          </div>
        </FadeInUp>

        {/* ═══ Pipeline Steps ═══ */}
        <FadeInUp delay={0.08}>
          <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: 'var(--color-surface-1)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--burgundy), var(--color-accent))' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>

            {/* Step cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {displayStages.map((stage, idx) => {
                const meta = STEP_META[stage.key] || { icon: 'circle', label: stage.label, desc: '' }
                const isDoneStage = stage.status === 'done'
                const isActive = stage.status === 'active'
                const isPending = stage.status === 'pending'

                return (
                  <motion.div
                    key={stage.key}
                    className="relative rounded-xl p-3 flex flex-col items-center gap-2 text-center transition-all"
                    style={{
                      background: isActive ? 'var(--color-accent-subtle)' : isDoneStage ? 'var(--color-success-bg)' : 'var(--color-surface-1)',
                      border: isActive ? '1px solid var(--color-accent-border)' : '1px solid transparent',
                    }}
                    animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                    transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                  >
                    {/* Step number badge */}
                    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        background: isDoneStage ? 'var(--color-success-text)' : isActive ? 'var(--color-accent)' : 'var(--color-surface-2)',
                        color: isDoneStage || isActive ? 'white' : 'var(--color-text-muted)',
                      }}>
                      {isDoneStage ? '✓' : idx + 1}
                    </div>

                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: isDoneStage ? 'var(--color-success-bg)' : isActive ? 'var(--color-bg-card)' : 'var(--color-bg-card)',
                        color: isDoneStage ? 'var(--color-success-text)' : isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}>
                      {isActive
                        ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                        : <span className="material-symbols-outlined text-[20px]">{isDoneStage ? 'check_circle' : meta.icon}</span>
                      }
                    </div>

                    {/* Label */}
                    <span className="text-[11px] font-semibold leading-tight"
                      style={{ color: isActive ? 'var(--color-accent)' : isDoneStage ? 'var(--color-success-text)' : 'var(--color-text-muted)' }}>
                      {meta.label}
                    </span>

                    {/* Active detail */}
                    {isActive && stage.key === 'generating_clips' && totalClips > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--color-accent)', color: 'white' }}>
                        {clipsCompleted}/{totalClips}
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Active stage description */}
            {activeStageInfo && !isDone && !isFailed && (
              <motion.div
                className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--color-surface-1)' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={activeStage?.key}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>info</span>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{activeStageInfo.desc}</span>
              </motion.div>
            )}
          </div>
        </FadeInUp>

        {/* ═══ Status Banners ═══ */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-success-text)' }}>
                <span className="material-symbols-outlined text-[22px] text-white">celebration</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--color-success-text)' }}>Processing Complete!</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-success-text)', opacity: 0.8 }}>
                  Generated {totalClips} clips in {formatElapsed(elapsed)} — check Library to download
                </p>
              </div>
              {onApplyStyle && data?.request_id && (
                <button onClick={() => onApplyStyle(data.request_id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105 shadow-sm"
                  style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}>
                  <span className="material-symbols-outlined text-[15px]">palette</span>
                  Apply Style
                </button>
              )}
            </motion.div>
          )}
          {isFailed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-error-text)' }}>
                <span className="material-symbols-outlined text-[22px] text-white">error</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--color-error-text)' }}>Processing Failed</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-error-text)', opacity: 0.8 }}>{data?.error || 'An unexpected error occurred. Check logs for details.'}</p>
              </div>
            </motion.div>
          )}
          {cancelled && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)' }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--color-warning-text)' }}>cancel</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-warning-text)' }}>Job has been cancelled.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ Terminal Log ═══ */}
        <FadeInUp delay={0.16}>
          <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
            {/* Log header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--icon-muted)' }}>terminal</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Process Log</span>
                {isStreaming && (
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-1"
                    style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-success-text)' }} />
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Filter tabs */}
                {[
                  { key: 'all', label: 'All', count: allLogs.length },
                  { key: 'errors', label: 'Errors', count: errorCount },
                ].map(f => (
                  <button key={f.key} onClick={() => setLogFilter(f.key)}
                    className="px-2 py-1 rounded-md text-[10px] font-semibold transition-colors"
                    style={{
                      background: logFilter === f.key ? 'var(--color-accent-subtle)' : 'transparent',
                      color: logFilter === f.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}>
                    {f.label}{f.count > 0 && f.key !== 'all' ? ` (${f.count})` : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Log content */}
            <div ref={logRef} className="p-4 h-64 overflow-y-auto font-mono text-[11.5px] leading-[1.7] flex flex-col gap-0.5"
              style={{ background: 'var(--color-bg-primary)' }}>
              {filteredLogs.length === 0 && !isDone && !isFailed && !cancelled && (
                <div className="flex items-center gap-2 animate-pulse" style={{ color: 'var(--color-text-muted)' }}>
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-muted)', borderTopColor: 'transparent' }} />
                  <span>Waiting for logs...</span>
                </div>
              )}
              {filteredLogs.length === 0 && logFilter !== 'all' && (
                <p style={{ color: 'var(--color-text-muted)' }}>No matching logs.</p>
              )}
              {filteredLogs.map((log, i) => {
                const isError = log.message.includes('❌') || log.message.toLowerCase().includes('error') || log.message.toLowerCase().includes('fail')
                const isSuccess = log.message.includes('✅') || log.message.toLowerCase().includes('complete')
                const isHighlight = log.message.includes('Starting') || log.message.includes('Clip ')

                return (
                  <div key={i} className="flex gap-0 hover:rounded-md hover:px-1 hover:-mx-1 transition-all"
                    style={{ background: isError ? 'rgba(248,113,113,0.04)' : 'transparent' }}>
                    <span className="select-none flex-shrink-0 w-[70px]" style={{ color: 'var(--color-text-muted)' }}>
                      [{formatTs(log.timestamp)}]
                    </span>
                    <span className="flex-shrink-0 w-[100px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {log.stageLabel}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}> › </span>
                    <span style={{ color: isError ? 'var(--color-error-text)' : isSuccess ? 'var(--color-success-text)' : isHighlight ? 'var(--color-warning-text)' : 'var(--color-text-secondary)' }}>
                      {log.message}
                    </span>
                  </div>
                )
              })}
              {!isDone && !isFailed && !cancelled && (
                <span className="animate-pulse inline-block w-2" style={{ color: 'var(--color-accent)' }}>▋</span>
              )}
            </div>

            {/* Log footer */}
            <div className="px-4 py-2 flex items-center justify-between text-[10px]" style={{ borderTop: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
              <span>{allLogs.length} entries</span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1" style={{ color: 'var(--color-error-text)' }}>
                  <span className="material-symbols-outlined text-[11px]">warning</span>
                  {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                </span>
              )}
            </div>
          </div>
        </FadeInUp>

        {/* ═══ Actions ═══ */}
        <FadeInUp delay={0.2}>
          <div className="flex items-center justify-between gap-3 pb-4">
            {(isDone || isFailed || cancelled) ? (
              <button onClick={onBack}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}>
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                New Job
              </button>
            ) : <div />}
            {!isDone && !cancelled && (
              <button onClick={handleCancel}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] group"
                style={{ border: '1.5px solid var(--color-border-default)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-1)' }}>
                <span className="material-symbols-outlined text-[16px] transition-colors group-hover:text-[var(--color-error-text)]">stop_circle</span>
                Cancel
              </button>
            )}
          </div>
        </FadeInUp>

      </div>
    </div>
  )
}

export default ProcessingPage
