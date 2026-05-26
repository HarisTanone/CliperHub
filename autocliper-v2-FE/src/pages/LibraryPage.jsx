import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, getAuthenticatedMediaUrl } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import { CardSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const STATUS_BADGE = {
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  processing: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  pending: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  downloading: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  analyzing: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
}
const STATUS_ICON = {
  completed: 'check_circle', processing: 'pending', failed: 'error',
  pending: 'schedule', downloading: 'download', analyzing: 'analytics',
}

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100)
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-yellow-400' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${pct >= 90 ? 'text-green-500' : pct >= 75 ? 'text-yellow-500' : 'text-slate-400'}`}>
        {pct}%
      </span>
    </div>
  )
}

function VideoModal({ url, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!url) return
    let revoke = null
    let cancelled = false
    setLoading(true)
    getAuthenticatedMediaUrl(url)
      .then(blob => {
        if (cancelled) { URL.revokeObjectURL(blob); return }
        revoke = blob
        setBlobUrl(blob)
      })
      .catch(() => { if (!cancelled) setBlobUrl(url) }) // fallback to direct URL
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke) }
  }, [url])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm"
          style={{ aspectRatio: '9/16' }}
          onClick={e => e.stopPropagation()}
        >
          {loading ? (
            <div className="w-full h-full rounded-2xl bg-black flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <video
              src={blobUrl || url} controls autoPlay
              className="w-full h-full rounded-2xl bg-black shadow-2xl"
            />
          )}
          <button onClick={onClose}
            className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-slate-100 dark:bg-[#233648] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2a3f55]'}`}>
      <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied!' : 'Copy Hook'}
    </button>
  )
}

function ClipCard({ clip, outputFile, thumbnail }) {
  const [playing, setPlaying] = useState(false)
  const [thumbBlobUrl, setThumbBlobUrl] = useState(null)
  const duration = clip.end_time && clip.start_time ? Math.round(clip.end_time - clip.start_time) : null
  const videoUrl = outputFile ? api.fileUrl(outputFile) : null
  const thumbUrl = thumbnail ? api.fileUrl(thumbnail) : null

  // Load thumbnail with auth
  useEffect(() => {
    if (!thumbUrl) return
    let revoke = null
    getAuthenticatedMediaUrl(thumbUrl)
      .then(blob => { revoke = blob; setThumbBlobUrl(blob) })
      .catch(() => setThumbBlobUrl(thumbUrl)) // fallback
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [thumbUrl])

  return (
    <>
      {playing && videoUrl && <VideoModal url={videoUrl} onClose={() => setPlaying(false)} />}
      <div className="bg-white dark:bg-[#152230] rounded-xl border border-slate-200 dark:border-[#233648] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
        {/* Thumbnail — 9:16 */}
        <div className="relative w-full bg-slate-900 cursor-pointer group" style={{ paddingBottom: '177.78%' }} onClick={() => videoUrl && setPlaying(true)}>
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {thumbBlobUrl
              ? <img src={thumbBlobUrl} alt="thumb" className="w-full h-full object-cover" />
              : <span className="material-symbols-outlined text-5xl text-slate-600">movie</span>
            }
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            {/* Clip badge */}
            <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              #{clip.index}
            </div>
            {/* Duration */}
            {duration && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">timer</span>{duration}s
              </div>
            )}
            {/* Play button */}
            {videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all">
                  <span className="material-symbols-outlined text-white text-3xl">play_arrow</span>
                </div>
              </div>
            )}
            {/* Timecode */}
            <div className="absolute bottom-2 left-2 text-white/60 text-[9px] font-mono">
              {clip.start_time?.toFixed(1)}s – {clip.end_time?.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-2.5 flex-1">
          {/* Score bar */}
          <ScoreBar score={clip.score} />

          {/* Hook */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Hook</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug line-clamp-3">{clip.hook}</p>
          </div>

          {/* Keywords */}
          {clip.keywords?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {clip.keywords.map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-[9px] font-semibold">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Reason */}
          {clip.reason && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2">{clip.reason}</p>
          )}

          {/* Actions — 2 buttons */}
          <div className="flex gap-2 mt-auto pt-1">
            <CopyButton text={clip.hook} />
            {videoUrl && (
              <button onClick={async () => {
                try {
                  const blob = await getAuthenticatedMediaUrl(videoUrl)
                  const a = document.createElement('a')
                  a.href = blob
                  a.download = `clip_${clip.index}.mp4`
                  a.click()
                  URL.revokeObjectURL(blob)
                } catch { window.open(videoUrl) }
              }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                <span className="material-symbols-outlined text-[14px]">download</span>
                Download
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function JobRow({ job, onDelete, onViewProgress, onApplyStyle }) {
  const [expanded, setExpanded] = useState(false)
  const [videoInfo, setVideoInfo] = useState(null)

  useEffect(() => {
    if (!job.youtube_url) return
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(job.youtube_url)}&format=json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setVideoInfo(d)).catch(() => { })
  }, [job.youtube_url])

  const isActive = !['completed', 'failed'].includes(job.status)
  const hasClips = job.clips?.length > 0
  const avgScore = hasClips ? job.clips.reduce((s, c) => s + (c.score || 0), 0) / job.clips.length : 0

  return (
    <div className="border-b border-slate-200 dark:border-[#233648] last:border-0">
      <div className="p-5 hover:bg-slate-50 dark:hover:bg-[#192633] transition-colors">
        <div className="flex gap-4">
          <div className="w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 relative">
            {videoInfo?.thumbnail_url
              ? <img src={videoInfo.thumbnail_url} alt="thumb" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-3xl text-slate-400">smart_display</span></div>
            }
            {isActive && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl animate-pulse">pending</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {videoInfo?.title || job.youtube_url}
                </h4>
                {videoInfo?.author_name && <p className="text-xs text-slate-500 truncate">{videoInfo.author_name}</p>}
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_BADGE[job.status] || STATUS_BADGE.pending}`}>
                <span className="material-symbols-outlined text-[13px]">{STATUS_ICON[job.status] || 'circle'}</span>
                {job.status}
              </span>
            </div>

            <p className="text-xs text-slate-400 truncate mb-2">{job.youtube_url}</p>

            <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {new Date(job.requested_at).toLocaleString()}
              </span>
              {hasClips && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">movie</span>
                  {job.clips.length} clips
                </span>
              )}
              {hasClips && (
                <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined text-[13px]">trending_up</span>
                  avg {Math.round(avgScore * 100)}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              {isActive && (
                <button onClick={() => onViewProgress(job)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors">
                  <span className="material-symbols-outlined text-[15px]">monitoring</span>
                  View Progress
                </button>
              )}
              {hasClips && (
                <button onClick={() => setExpanded(e => !e)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-[#324d67] hover:bg-slate-100 dark:hover:bg-[#1e2e40] rounded-lg text-xs font-medium transition-colors">
                  <span className="material-symbols-outlined text-[15px]">{expanded ? 'expand_less' : 'expand_more'}</span>
                  {expanded ? 'Hide Clips' : `Show ${job.clips.length} Clips`}
                </button>
              )}
              {job.status === 'completed' && onApplyStyle && (
                <button onClick={() => onApplyStyle(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-medium transition-colors">
                  <span className="material-symbols-outlined text-[15px]">palette</span>
                  Re-Style
                </button>
              )}
              <button onClick={() => onDelete(job.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs transition-colors ml-auto">
                <span className="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && hasClips && (
        <div className="px-5 pb-5 bg-slate-50 dark:bg-[#111d2b]">
          {/* Sort by score desc */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-4">
            {[...job.clips].sort((a, b) => (b.score || 0) - (a.score || 0)).map((clip) => {
              const origIdx = job.clips.findIndex(c => c.index === clip.index)
              return (
                <ClipCard
                  key={clip.index}
                  clip={clip}
                  outputFile={job.output_files?.[origIdx] || null}
                  thumbnail={job.thumbnails?.[origIdx] || null}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function LibraryPage({ onViewProgress, onApplyStyle }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getJobHistory()
      if (Array.isArray(data)) setJobs(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleDelete = async (id) => {
    if (!confirm('Delete this job and its output files?')) return
    await api.deleteJob(id)
    loadHistory()
  }

  const filteredJobs = search.trim()
    ? jobs.filter(j => j.youtube_url?.toLowerCase().includes(search.toLowerCase()) || j.clips?.some(c => c.hook?.toLowerCase().includes(search.toLowerCase())))
    : jobs
  const completedCount = filteredJobs.filter(j => j.status === 'completed').length
  const totalClips = filteredJobs.reduce((sum, j) => sum + (j.clips?.length || 0), 0)

  // Pagination
  const [libPage, setLibPage] = useState(0)
  const JOBS_PER_PAGE = 5
  const totalLibPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE) || 1
  const paginatedJobs = filteredJobs.slice(libPage * JOBS_PER_PAGE, (libPage + 1) * JOBS_PER_PAGE)

  useEffect(() => { setLibPage(0) }, [search])

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
      <div className="max-w-6xl mx-auto space-y-5">

        {jobs.length > 0 && (
          <FadeInUp>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Jobs', value: jobs.length, icon: 'history', bg: 'bg-primary' },
                { label: 'Completed', value: completedCount, icon: 'check_circle', bg: 'bg-emerald-500' },
                { label: 'Total Clips', value: totalClips, icon: 'movie_filter', bg: 'bg-amber-500' },
              ].map(s => (
                <motion.div key={s.label} whileHover={{ y: -2 }} className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                    <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </FadeInUp>
        )}

        <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                Job History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Jobs with output files still on disk</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-400">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search URL or hook..."
                  className="w-48 pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 transition-colors" />
              </div>
              <button onClick={loadHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-primary border border-slate-200 dark:border-[#324d67] hover:border-primary/40 rounded-xl transition-colors">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100 dark:divide-[#233648]">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              type="noHistory"
              title={search ? `No results for "${search}"` : "No completed jobs found"}
              description={search ? "Try a different search term" : "Processed videos will appear here with their clips ready to download"}
            />
          ) : (
            <div>
              {paginatedJobs.map(job => (
                <JobRow key={job.id} job={job} onDelete={handleDelete} onViewProgress={onViewProgress} onApplyStyle={onApplyStyle} />
              ))}
              {/* Pagination */}
              {totalLibPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-[#233648] flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Showing {libPage * JOBS_PER_PAGE + 1}-{Math.min((libPage + 1) * JOBS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setLibPage(0)} disabled={libPage === 0}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-primary disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] transition-colors">First</button>
                    <button onClick={() => setLibPage(p => p - 1)} disabled={libPage === 0}
                      className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#324d67] flex items-center justify-center disabled:opacity-30 hover:border-primary/40 transition-all">
                      <span className="material-symbols-outlined text-[14px] text-slate-500">chevron_left</span>
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium tabular-nums px-2">{libPage + 1} / {totalLibPages}</span>
                    <button onClick={() => setLibPage(p => p + 1)} disabled={libPage >= totalLibPages - 1}
                      className="w-7 h-7 rounded-lg border border-slate-200 dark:border-[#324d67] flex items-center justify-center disabled:opacity-30 hover:border-primary/40 transition-all">
                      <span className="material-symbols-outlined text-[14px] text-slate-500">chevron_right</span>
                    </button>
                    <button onClick={() => setLibPage(totalLibPages - 1)} disabled={libPage >= totalLibPages - 1}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-primary disabled:opacity-30 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] transition-colors">Last</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LibraryPage
