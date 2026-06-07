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
    { key: 'create', icon: 'add_circle', label: 'New Clip', desc: 'Process a video', gradient: 'linear-gradient(135deg, var(--crimson-wine), var(--burgundy))' },
    { key: 'library', icon: 'video_library', label: 'Library', desc: 'View outputs', gradient: 'linear-gradient(135deg, var(--deep-indigo), var(--dark-plum))' },
    { key: 'styles', icon: 'palette', label: 'Styles', desc: 'Edit presets', gradient: 'linear-gradient(135deg, var(--dark-plum), var(--crimson-wine))' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map(a => (
        <motion.button key={a.key} whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate(a.key)}
          className="rounded-2xl p-4 shadow-sm text-left hover:shadow-lg transition-all cursor-pointer"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-md" style={{ background: a.gradient }}>
            <span className="material-symbols-outlined text-white text-[20px]">{a.icon}</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{a.label}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{a.desc}</p>
        </motion.button>
      ))}
    </div>
  )
}

function ActiveJobCard({ job, onViewProgress }) {
  const videoInfo = useVideoInfo(job.youtube_url)
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: 'var(--color-warning-bg)',
        border: '1px solid var(--color-warning-border)'
      }}>
      <div className="w-14 aspect-video rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: 'var(--color-surface-1)' }}>
        {videoInfo?.thumbnail_url ? (
          <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--icon-muted)' }}>smart_display</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{videoInfo?.title || 'Processing...'}</p>
        <p className="text-[10px] font-medium mt-0.5 capitalize" style={{ color: 'var(--color-warning-text)' }}>{job.status}</p>
      </div>
      <button onClick={() => onViewProgress(job)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
        style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
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
    <div className="flex items-center gap-3 p-3 rounded-xl transition-colors group cursor-pointer"
      style={{ ':hover': { background: 'var(--color-surface-1)' } }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
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
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{videoInfo?.title || job.youtube_url}</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(job.requested_at)} -- {job.clips_count || 0} clips</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCompleted ? '' : isFailed ? '' : 'animate-pulse'}`}
          style={{ background: isCompleted ? 'var(--color-success-text)' : isFailed ? 'var(--color-error-text)' : 'var(--color-warning-text)' }} />
        <button onClick={() => onDelete(job.id)}
          className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
          style={{ color: 'var(--color-error-text)' }}>
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
    <div className="rounded-2xl p-4 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
      <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>System</h4>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Server</span>
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: isHealthy ? 'var(--color-success-text)' : 'var(--color-error-text)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isHealthy ? 'var(--color-success-text)' : 'var(--color-error-text)' }} />
            {isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>
        {diskFree != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Disk</span>
            <span className="text-xs font-medium" style={{ color: diskStatus === 'ok' ? 'var(--color-text-secondary)' : diskStatus === 'warning' ? 'var(--color-warning-text)' : 'var(--color-error-text)' }}>
              {diskFree.toFixed(1)} GB free
            </span>
          </div>
        )}
        {health.queue && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Queue</span>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{health.queue.pending || 0} pending</span>
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
    <div className="flex-1 overflow-y-auto p-5 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-6xl mx-auto">

        {/* Welcome + Stats Row */}
        {loading ? <StatsSkeleton /> : (
          <FadeInUp>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              {/* Welcome card */}
              <div className="lg:col-span-2 rounded-2xl p-6 text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--crimson-wine), var(--burgundy), var(--dark-plum))' }}>
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
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onNavigate('create')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-semibold transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Create New Clip
                  </motion.button>
                </div>
              </div>

              {/* Stat cards */}
              <motion.div whileHover={{ y: -4 }} className="rounded-2xl p-5 shadow-sm cursor-pointer"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, var(--color-success-text), #059669)' }}>
                  <span className="material-symbols-outlined text-white text-[20px]">movie_filter</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{clipsGenerated}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Clips Generated</p>
              </motion.div>

              <motion.div whileHover={{ y: -4 }} className="rounded-2xl p-5 shadow-sm cursor-pointer"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, var(--deep-indigo), var(--dark-plum))' }}>
                  <span className="material-symbols-outlined text-white text-[20px]">work_history</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{totalJobs}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Total Jobs</p>
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
                <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-warning-text)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Active Jobs</h3>
                    <span className="text-[10px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>Auto-refreshing</span>
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
              <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Activity</h3>
                  <button onClick={() => onNavigate('library')} className="text-[11px] font-semibold hover:underline cursor-pointer" style={{ color: 'var(--color-accent)' }}>View All</button>
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
              <div className="rounded-2xl p-4 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>Tips</h4>
                <div className="space-y-3">
                  {[
                    { icon: 'bolt', text: 'Use Quick Process for fast results with AI-selected clips' },
                    { icon: 'search_insights', text: 'Use Analyze mode to hand-pick the best moments' },
                    { icon: 'keyboard', text: 'Cmd+N to quickly create a new clip from anywhere' },
                  ].map((tip, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="material-symbols-outlined text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'var(--icon-accent)' }}>{tip.icon}</span>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>{tip.text}</p>
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
