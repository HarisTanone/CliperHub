import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, getAuthenticatedMediaUrl } from '../utils/api'
import { FadeInUp } from '../components/PageTransition'
import { CardSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import PostToSocialModal from '../components/PostToSocialModal'

// Social media platforms config with SVG icons
const SOCIAL_PLATFORMS = [
  {
    id: 'tiktok',
    name: 'TikTok',
    color: 'from-[#00f2ea] to-[#ff0050]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    )
  },
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'from-[#f09433] via-[#e6683c] to-[#dc2743]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    )
  },
  {
    id: 'youtube',
    name: 'YouTube Shorts',
    color: 'from-[#ff0000] to-[#cc0000]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    )
  },
  {
    id: 'facebook',
    name: 'Facebook Reels',
    color: 'from-[#1877f2] to-[#0a5dc2]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    )
  },
]

const STATUS_BADGE = {
  completed: 'badge-success',
  processing: 'badge-warning',
  failed: 'badge-error',
  pending: 'badge-neutral',
  downloading: 'badge-info',
  analyzing: 'badge-info',
}
const STATUS_ICON = {
  completed: 'check_circle', processing: 'pending', failed: 'error',
  pending: 'schedule', downloading: 'download', analyzing: 'analytics',
}

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-1)' }}>
        <div className="h-full rounded-full" style={{
          width: `${pct}%`,
          background: pct >= 90 ? 'var(--color-success-text)' : pct >= 75 ? 'var(--color-warning-text)' : 'var(--color-text-muted)'
        }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{
        color: pct >= 90 ? 'var(--color-success-text)' : pct >= 75 ? 'var(--color-warning-text)' : 'var(--color-text-muted)'
      }}>
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
        className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        style={{ background: 'rgba(0,0,0,0.8)' }}
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
            <div className="w-full h-full rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
              <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <video
              src={blobUrl || url} controls autoPlay
              className="w-full h-full rounded-2xl bg-black shadow-2xl"
            />
          )}
          <button onClick={onClose}
            className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function CopyButton({ text, keywords }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    // Build copy text with hook + hashtags from keywords
    let copyText = text || ''
    if (keywords && keywords.length > 0) {
      const hashtags = keywords.map(kw => `#${kw.replace(/\s+/g, '')}`).join(' ')
      copyText = `${text}\n\n${hashtags}`
    }
    navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleCopy}
      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
      style={{
        background: copied ? 'var(--color-success-bg)' : 'var(--color-surface-1)',
        color: copied ? 'var(--color-success-text)' : 'var(--color-text-secondary)',
        border: copied ? '1px solid var(--color-success-border)' : '1px solid transparent'
      }}>
      <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// Custom styled checkbox component
function StyledCheckbox({ checked, onChange, className = '' }) {
  return (
    <label className={`relative inline-flex items-center cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-5 h-5 rounded-md transition-all duration-200 flex items-center justify-center"
        style={{
          background: checked ? 'var(--btn-primary-bg)' : 'rgba(255,255,255,0.1)',
          border: checked ? 'none' : '2px solid var(--color-border-default)',
          boxShadow: checked ? 'var(--btn-primary-shadow)' : 'none'
        }}>
        {checked && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="material-symbols-outlined text-white text-[14px] font-bold"
          >
            check
          </motion.span>
        )}
      </div>
    </label>
  )
}

// Social media dropdown for posting
function SocialPostDropdown({ onSelect, disabled }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
        style={{
          background: disabled ? 'var(--color-surface-1)' : 'var(--color-info-bg)',
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-info-text)',
          border: `1px solid ${disabled ? 'var(--color-border-subtle)' : 'var(--color-info-border)'}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1
        }}
      >
        <span className="material-symbols-outlined text-[14px]">share</span>
        Post
        <span className="material-symbols-outlined text-[12px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-1 w-48 rounded-xl shadow-xl overflow-hidden z-50"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
          >
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => { onSelect(platform.id); setOpen(false) }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors text-left"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-white`}>
                  {platform.icon}
                </div>
                <span className="text-sm font-medium">{platform.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ClipCard({ clip, outputFile, thumbnail, isSelected, onSelectChange }) {
  const [playing, setPlaying] = useState(false)
  const [thumbBlobUrl, setThumbBlobUrl] = useState(null)
  const [thumbLoading, setThumbLoading] = useState(true)
  const [thumbError, setThumbError] = useState(false)

  // Backend returns start/end, handle both naming conventions
  const startTime = clip.start_time ?? clip.start ?? 0
  const endTime = clip.end_time ?? clip.end ?? 0
  const duration = endTime && startTime ? Math.round(endTime - startTime) : null
  const videoUrl = outputFile ? api.fileUrl(outputFile) : null
  const thumbUrl = thumbnail ? api.fileUrl(thumbnail) : null

  // Load thumbnail with auth
  useEffect(() => {
    if (!thumbUrl) {
      setThumbLoading(false)
      setThumbError(true)
      return
    }
    let revoke = null
    let cancelled = false
    setThumbLoading(true)
    setThumbError(false)

    getAuthenticatedMediaUrl(thumbUrl)
      .then(blob => {
        if (cancelled) return
        revoke = blob
        setThumbBlobUrl(blob)
        setThumbLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setThumbError(true)
        setThumbLoading(false)
      })
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke) }
  }, [thumbUrl])

  return (
    <>
      {playing && videoUrl && <VideoModal url={videoUrl} onClose={() => setPlaying(false)} />}
      <motion.div
        whileHover={{ y: -2 }}
        className="rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col"
        style={{
          background: 'var(--color-bg-card)',
          border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
          boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-sm)'
        }}
      >
        {/* Thumbnail — 9:16 */}
        <div className="relative w-full cursor-pointer group" style={{ paddingBottom: '177.78%', background: 'linear-gradient(to bottom right, var(--color-surface-2), var(--color-surface-1))' }} onClick={() => videoUrl && setPlaying(true)}>
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {/* Thumbnail display with loading/error states */}
            {thumbLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'transparent' }} />
              </div>
            ) : thumbBlobUrl && !thumbError ? (
              <img src={thumbBlobUrl} alt={`Clip ${clip.index}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(to bottom right, var(--color-surface-2), var(--color-surface-1))' }}>
                <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>No preview</span>
              </div>
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

            {/* Selection checkbox */}
            {onSelectChange && (
              <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                <StyledCheckbox checked={isSelected} onChange={(e) => onSelectChange(e.target.checked)} />
              </div>
            )}

            {/* Clip badge */}
            <div className="absolute top-2 left-2 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg" style={{ background: 'var(--btn-primary-bg)' }}>
              #{clip.index}
            </div>

            {/* Duration */}
            {duration && (
              <div className="absolute top-2 right-10 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-lg" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                <span className="material-symbols-outlined text-[12px]">timer</span>
                {duration}s
              </div>
            )}

            {/* Play button */}
            {videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center group-hover:opacity-100 transition-all shadow-xl"
                  style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}
                >
                  <span className="material-symbols-outlined text-white text-3xl drop-shadow-lg">play_arrow</span>
                </motion.div>
              </div>
            )}

            {/* Score badge at bottom */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="text-white/70 text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                {startTime?.toFixed(1)}s – {endTime?.toFixed(1)}s
              </div>
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg"
                style={{
                  background: (clip.score || 0) >= 0.9 ? 'var(--color-success-text)' : (clip.score || 0) >= 0.75 ? 'var(--color-warning-text)' : 'var(--color-text-muted)',
                  color: 'white'
                }}
              >
                {Math.round((clip.score || 0) * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          {/* Hook */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-accent)', opacity: 0.7 }}>Hook</p>
            <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>{clip.hook}</p>
          </div>

          {/* Keywords */}
          {clip.keywords?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {clip.keywords.slice(0, 3).map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info-text)', border: '1px solid var(--color-info-border)' }}>
                  {kw}
                </span>
              ))}
              {clip.keywords.length > 3 && (
                <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>+{clip.keywords.length - 3}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-1">
            <CopyButton text={clip.hook} keywords={clip.keywords} />
            {videoUrl && (
              <button onClick={async (e) => {
                e.stopPropagation()
                try {
                  const blob = await getAuthenticatedMediaUrl(videoUrl)
                  const a = document.createElement('a')
                  a.href = blob
                  a.download = `clip_${clip.index}.mp4`
                  a.click()
                  URL.revokeObjectURL(blob)
                  toast.success('Download started')
                } catch { window.open(videoUrl) }
              }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                <span className="material-symbols-outlined text-[14px]">download</span>
                Save
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

function JobRow({ job, onDelete, onViewProgress, onApplyStyle, onPostToSocial }) {
  const [expanded, setExpanded] = useState(false)
  const [videoInfo, setVideoInfo] = useState(null)
  const [selectedClips, setSelectedClips] = useState(new Set())

  useEffect(() => {
    if (!job.youtube_url) return
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(job.youtube_url)}&format=json`)
      .then(r => r.ok ? r.json() : null).then(d => d && setVideoInfo(d)).catch(() => { })
  }, [job.youtube_url])

  const isActive = !['completed', 'failed'].includes(job.status)
  const hasClips = job.clips?.length > 0
  const avgScore = hasClips ? job.clips.reduce((s, c) => s + (c.score || 0), 0) / job.clips.length : 0

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedClips(new Set(job.clips.map(c => c.index)))
    } else {
      setSelectedClips(new Set())
    }
  }

  const handleClipSelect = (clipIndex, checked) => {
    const newSet = new Set(selectedClips)
    if (checked) {
      newSet.add(clipIndex)
    } else {
      newSet.delete(clipIndex)
    }
    setSelectedClips(newSet)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }} className="last:border-0">
      <div className="p-5 transition-colors" style={{ background: 'transparent' }}>
        <div className="flex gap-4">
          <div className="w-28 sm:w-36 aspect-video rounded-xl overflow-hidden flex-shrink-0 relative shadow-md" style={{ background: 'var(--color-surface-1)' }}>
            {videoInfo?.thumbnail_url
              ? <img src={videoInfo.thumbnail_url} alt="thumb" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-text-muted)' }}>smart_display</span></div>
            }
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <span className="material-symbols-outlined text-white text-2xl animate-pulse">pending</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {videoInfo?.title || job.youtube_url}
                </h4>
                {videoInfo?.author_name && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{videoInfo.author_name}</p>}
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_BADGE[job.status] || STATUS_BADGE.pending}`}>
                <span className="material-symbols-outlined text-[13px]">{STATUS_ICON[job.status] || 'circle'}</span>
                {job.status}
              </span>
            </div>

            <p className="text-xs truncate mb-2" style={{ color: 'var(--color-text-muted)' }}>{job.youtube_url}</p>

            <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {new Date(job.created_at || job.requested_at).toLocaleString()}
              </span>
              {hasClips && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">movie</span>
                  {job.clips.length} clips
                </span>
              )}
              {hasClips && (
                <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-success-text)' }}>
                  <span className="material-symbols-outlined text-[13px]">trending_up</span>
                  avg {Math.round(avgScore * 100)}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              {job.status === 'failed' && job.error_message && (
                <div className="w-full mb-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)', border: '1px solid var(--color-error-border)' }}>
                  <span className="material-symbols-outlined text-[13px] align-middle mr-1">error</span>
                  {job.error_message}
                </div>
              )}
              {isActive && (
                <button onClick={() => onViewProgress(job)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                  <span className="material-symbols-outlined text-[15px]">monitoring</span>
                  View Progress
                </button>
              )}
              {hasClips && (
                <button onClick={() => setExpanded(e => !e)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    border: expanded ? '1px solid var(--color-accent)' : '1px solid var(--color-border-default)',
                    background: expanded ? 'var(--color-accent-subtle)' : 'transparent',
                    color: expanded ? 'var(--color-accent)' : 'var(--color-text-secondary)'
                  }}>
                  <span className="material-symbols-outlined text-[15px]">{expanded ? 'expand_less' : 'expand_more'}</span>
                  {expanded ? 'Hide Clips' : `Show ${job.clips.length} Clips`}
                </button>
              )}
              {job.status === 'completed' && onApplyStyle && (
                <button onClick={() => onApplyStyle(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--color-info-bg)', color: 'var(--color-info-text)' }}>
                  <span className="material-symbols-outlined text-[15px]">palette</span>
                  Re-Style
                </button>
              )}
              <button onClick={() => onDelete(job.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ml-auto"
                style={{ color: 'var(--color-error-text)' }}>
                <span className="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasClips && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5" style={{ background: 'var(--color-surface-1)' }}>
              {/* Bulk Actions Bar */}
              <div className="flex items-center justify-between py-3 mb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
                    <StyledCheckbox
                      checked={selectedClips.size === job.clips.length && job.clips.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                    <span className="font-medium">Select All</span>
                  </label>
                  {selectedClips.size > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                      {selectedClips.size} selected
                    </span>
                  )}
                </div>
                {selectedClips.size > 0 && onPostToSocial && (
                  <div className="flex items-center gap-2">
                    <SocialPostDropdown
                      onSelect={(platform) => {
                        const clips = job.clips.filter(c => selectedClips.has(c.index))
                        onPostToSocial(clips, job.id, job.output_files, job.thumbnails, platform, true)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Clips Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...job.clips].sort((a, b) => (b.score || 0) - (a.score || 0)).map((clip) => {
                  const origIdx = job.clips.findIndex(c => c.index === clip.index)
                  return (
                    <ClipCard
                      key={clip.index}
                      clip={clip}
                      outputFile={job.output_files?.[origIdx] || null}
                      thumbnail={job.thumbnails?.[origIdx] || null}
                      isSelected={selectedClips.has(clip.index)}
                      onSelectChange={(checked) => handleClipSelect(clip.index, checked)}
                    />
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LibraryPage({ onViewProgress, onApplyStyle }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Social post modal state
  const [socialModal, setSocialModal] = useState({
    open: false,
    clip: null,
    jobId: null,
    outputFile: null,
    thumbnail: null,
    platform: null,
    isBulk: false,
    clips: []
  })

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

  // Handler for posting to social media
  const handlePostToSocial = (clips, jobId, outputFiles, thumbnails, platform, isBulk) => {
    if (isBulk && clips.length > 1) {
      toast.success(`Selected ${clips.length} clips for ${platform}`)
      // For bulk post, open modal with first clip
      const firstClip = clips[0]
      const job = jobs.find(j => j.id === jobId)
      const origIdx = job?.clips.findIndex(c => c.index === firstClip.index) ?? 0
      setSocialModal({
        open: true,
        clip: firstClip,
        jobId,
        outputFile: outputFiles?.[origIdx] || job?.output_files?.[origIdx],
        thumbnail: thumbnails?.[origIdx] || job?.thumbnails?.[origIdx],
        platform,
        isBulk: true,
        clips
      })
    } else {
      // Single clip post
      const clip = clips[0]
      const job = jobs.find(j => j.id === jobId)
      const origIdx = job?.clips.findIndex(c => c.index === clip.index) ?? 0
      setSocialModal({
        open: true,
        clip,
        jobId,
        outputFile: outputFiles?.[0] || job?.output_files?.[origIdx],
        thumbnail: thumbnails?.[0] || job?.thumbnails?.[origIdx],
        platform,
        isBulk: false,
        clips: [clip]
      })
    }
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
    <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-6xl mx-auto space-y-5">

        {jobs.length > 0 && (
          <FadeInUp>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Jobs', value: jobs.length, icon: 'history', gradient: 'from-primary to-blue-600' },
                { label: 'Completed', value: completedCount, icon: 'check_circle', gradient: 'from-emerald-500 to-green-600' },
                { label: 'Total Clips', value: totalClips, icon: 'movie_filter', gradient: 'from-amber-500 to-orange-600' },
              ].map(s => (
                <motion.div key={s.label} whileHover={{ y: -2, scale: 1.02 }}
                  className="rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all flex items-center gap-3"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <span className="material-symbols-outlined text-white text-[22px]">{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </FadeInUp>
        )}

        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>history</span>
                Job History
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Jobs with output files still on disk</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search URL or hook..."
                  className="w-48 pl-8 pr-3 py-1.5 text-xs rounded-xl outline-none transition-all"
                  style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
              </div>
              <motion.button
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
                onClick={loadHistory}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border-default)' }}>
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </motion.button>
            </div>
          </div>

          {loading ? (
            <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
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
                <JobRow key={job.id} job={job} onDelete={handleDelete} onViewProgress={onViewProgress} onApplyStyle={onApplyStyle} onPostToSocial={handlePostToSocial} />
              ))}
              {/* Pagination */}
              {totalLibPages > 1 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Showing {libPage * JOBS_PER_PAGE + 1}-{Math.min((libPage + 1) * JOBS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setLibPage(0)} disabled={libPage === 0}
                      className="px-2 py-1 text-xs disabled:opacity-30 rounded-lg transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}>First</button>
                    <button onClick={() => setLibPage(p => p - 1)} disabled={libPage === 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                      style={{ border: '1px solid var(--color-border-default)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                    </button>
                    <span className="text-xs font-medium tabular-nums px-2" style={{ color: 'var(--color-text-secondary)' }}>{libPage + 1} / {totalLibPages}</span>
                    <button onClick={() => setLibPage(p => p + 1)} disabled={libPage >= totalLibPages - 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                      style={{ border: '1px solid var(--color-border-default)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                    </button>
                    <button onClick={() => setLibPage(totalLibPages - 1)} disabled={libPage >= totalLibPages - 1}
                      className="px-2 py-1 text-xs disabled:opacity-30 rounded-lg transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}>Last</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Social Post Modal */}
      <PostToSocialModal
        isOpen={socialModal.open}
        onClose={() => setSocialModal({ open: false, clip: null, jobId: null, outputFile: null, thumbnail: null, platform: null, isBulk: false, clips: [] })}
        clip={socialModal.clip}
        jobId={socialModal.jobId}
        outputFile={socialModal.outputFile}
        thumbnail={socialModal.thumbnail}
        platform={socialModal.platform}
        isBulk={socialModal.isBulk}
        clips={socialModal.clips}
        onSuccess={() => {
          setSocialModal({ open: false, clip: null, jobId: null, outputFile: null, thumbnail: null, platform: null, isBulk: false, clips: [] })
          toast.success('Added to upload queue!')
        }}
      />
    </div>
  )
}

export default LibraryPage
