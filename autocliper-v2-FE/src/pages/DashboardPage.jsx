import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { api } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import { StatsSkeleton, CardSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const ACTIVE_STATUSES = ['processing', 'downloading', 'analyzing', 'pending']

function useVideoInfo(url) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    if (!url) return
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setInfo(d)).catch(() => { })
  }, [url])
  return info
}

function timeAgo(d) {
  const diff = Math.floor((new Date() - new Date(d)) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// --- Widgets ---

function QuickActions({ onNavigate }) {
  const actions = [
    { key: 'create', icon: 'add_circle', label: 'New Clip', desc: 'Process a video', color: 'bg-primary' },
    { key: 'library', icon: 'video_library', label: 'Library', desc: 'View outputs', color: 'bg-emerald-500' },
    { key: 'styles', icon: 'palette', label: 'Styles', desc: 'Edit presets', color: 'bg-violet-500' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map(a => (
        <motion.button key={a.key} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate(a.key)}
          className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm text-left hover:shadow-md transition-shadow">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${a.color}`}>
            <span className="material-symbols-outlined text-white text-[18px]">{a.icon}</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{a.desc}</p>
        </motion.button>
      ))}
    </div>
  )
}

function ActiveJobCard({ job, onViewProgress }) {
  const videoInfo = useVideoInfo(job.youtube_url)
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl">
      <div className="w-14 aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 relative">
        {videoInfo?.thumbnail_url ? (
          <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[14px] text-slate-300">smart_display</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{videoInfo?.title || 'Processing...'}</p>
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 capitalize">{job.status}</p>
      </div>
      <button onClick={() => onViewProgress(job)}
        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-[11px] font-semibold transition-colors flex-shrink-0">
        View
      </button>
    </motion.div>
  )
}

function RecentJobRow({ job, onDelete }) {
  const videoInfo = useVideoInfo(job.youtube_url)
  const isCompleted = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-[#192633]/60 rounded-xl transition-colors group">
      <div className="w-12 aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
        {videoInfo?.thumbnail_url ? (
          <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[12px] text-slate-300">smart_display</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{videoInfo?.title || job.youtube_url}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(job.requested_at)} -- {job.clips_count || 0} clips</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
        <button onClick={() => onDelete(job.id)}
          className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100">
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
    </div>
  )
}

function SystemHealth() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => { })
  }, [])
  if (!health) return null

  const isHealthy = health.status === 'healthy'
  const diskFree = health.disk?.free_gb
  const diskStatus = health.disk?.status || 'ok'

  return (
    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">System</h4>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-300">Server</span>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${isHealthy ? 'text-emerald-600' : 'text-red-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>
        {diskFree != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-300">Disk</span>
            <span className={`text-xs font-medium ${diskStatus === 'ok' ? 'text-slate-600 dark:text-slate-300' : diskStatus === 'warning' ? 'text-amber-600' : 'text-red-500'}`}>
              {diskFree.toFixed(1)} GB free
            </span>
          </div>
        )}
        {health.queue && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-300">Queue</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{health.queue.pending || 0} pending</span>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main Dashboard ---

function DashboardPage({ onNavigate, onViewProgress }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const loadJobs = useCallback(async () => {
    try {
      const data = await api.getJobs()
      if (Array.isArray(data)) setJobs(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  useEffect(() => {
    const hasActive = jobs.some(j => ACTIVE_STATUSES.includes(j.status))
    if (!hasActive) return
    const t = setInterval(loadJobs, 8000)
    return () => clearInterval(t)
  }, [jobs, loadJobs])

  const handleDelete = async (id) => {
    await api.deleteJob(id)
    loadJobs()
  }

  const totalJobs = jobs.length
  const clipsGenerated = jobs.reduce((sum, j) => sum + (j.clips_count || 0), 0)
  const activeJobs = jobs.filter(j => ACTIVE_STATUSES.includes(j.status))
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const recentJobs = jobs.slice(0, 8)

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8 bg-slate-50/50 dark:bg-transparent">
      <div className="max-w-6xl mx-auto">

        {/* Welcome + Stats Row */}
        {loading ? <StatsSkeleton /> : (
          <FadeInUp>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              {/* Welcome card */}
              <div className="lg:col-span-2 bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative">
                  <p className="text-white/70 text-sm">Welcome back,</p>
                  <h2 className="text-2xl font-bold mt-0.5">{localStorage.getItem('username') || 'User'}</h2>
                  <p className="text-white/60 text-sm mt-2">
                    {activeJobs.length > 0
                      ? `${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''} currently processing`
                      : `${completedJobs.length} videos processed so far`}
                  </p>
                  <button onClick={() => onNavigate('create')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-semibold transition-colors">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Create New Clip
                  </button>
                </div>
              </div>

              {/* Stat cards */}
              <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-white text-[18px]">movie_filter</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{clipsGenerated}</p>
                <p className="text-xs text-slate-500 mt-0.5">Clips Generated</p>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-white text-[18px]">work_history</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalJobs}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Jobs</p>
              </motion.div>
            </div>
          </FadeInUp>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Active Jobs */}
            {activeJobs.length > 0 && (
              <FadeInUp delay={0.1}>
                <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Jobs</h3>
                    <span className="text-[10px] text-slate-400 ml-auto">Auto-refreshing</span>
                  </div>
                  <div className="space-y-2">
                    {activeJobs.map(job => (
                      <ActiveJobCard key={job.id} job={job} onViewProgress={onViewProgress} />
                    ))}
                  </div>
                </div>
              </FadeInUp>
            )}

            {/* Quick Actions */}
            <FadeInUp delay={0.15}>
              <QuickActions onNavigate={onNavigate} />
            </FadeInUp>

            {/* Recent Activity */}
            <FadeInUp delay={0.2}>
              <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                  <button onClick={() => onNavigate('library')} className="text-[11px] text-primary font-semibold hover:underline">View All</button>
                </div>
                {loading ? (
                  <><CardSkeleton /><CardSkeleton /></>
                ) : recentJobs.length === 0 ? (
                  <EmptyState type="noJobs" title="No activity yet" description="Create your first clip to get started" />
                ) : (
                  <div className="p-2">
                    <StaggerContainer staggerDelay={0.04}>
                      {recentJobs.map(job => (
                        <StaggerItem key={job.id}>
                          <RecentJobRow job={job} onDelete={handleDelete} />
                        </StaggerItem>
                      ))}
                    </StaggerContainer>
                  </div>
                )}
              </div>
            </FadeInUp>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <FadeInUp delay={0.25}>
              <SystemHealth />
            </FadeInUp>

            {/* Tips */}
            <FadeInUp delay={0.3}>
              <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tips</h4>
                <div className="space-y-3">
                  {[
                    { icon: 'bolt', text: 'Use Quick Process for fast results with AI-selected clips' },
                    { icon: 'search_insights', text: 'Use Analyze mode to hand-pick the best moments' },
                    { icon: 'keyboard', text: 'Cmd+N to quickly create a new clip from anywhere' },
                  ].map((tip, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="material-symbols-outlined text-[14px] text-primary mt-0.5 flex-shrink-0">{tip.icon}</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInUp>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
