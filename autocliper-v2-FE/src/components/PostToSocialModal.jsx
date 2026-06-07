import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, getAuthenticatedMediaUrl } from '../utils/api'

// Platform configurations with SVG icons (gradients kept for brand identity)
const PLATFORM_CONFIG = {
    tiktok: {
        name: 'TikTok',
        gradient: 'from-[#00f2ea] to-[#ff0050]',
        maxCaption: 2200,
        defaultHashtags: '#fyp #viral #trending',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
            </svg>
        ),
    },
    instagram: {
        name: 'Instagram Reels',
        gradient: 'from-[#f09433] via-[#e6683c] to-[#dc2743]',
        maxCaption: 2200,
        defaultHashtags: '#reels #viral #explore',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
        ),
    },
    youtube: {
        name: 'YouTube Shorts',
        gradient: 'from-[#ff0000] to-[#cc0000]',
        maxCaption: 100,
        defaultHashtags: '#shorts #viral',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        ),
    },
    facebook: {
        name: 'Facebook Reels',
        gradient: 'from-[#1877f2] to-[#0a5dc2]',
        maxCaption: 2200,
        defaultHashtags: '#reels #viral',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        ),
    },
}

function PostToSocialModal({ isOpen, onClose, clip, jobId, outputFile, thumbnail, platform, isBulk, clips, onSuccess }) {
    const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.tiktok
    const [accounts, setAccounts] = useState([])
    const [selectedAccountId, setSelectedAccountId] = useState(null)
    const [caption, setCaption] = useState('')
    const [hashtags, setHashtags] = useState(config.defaultHashtags)
    const [scheduleType, setScheduleType] = useState('now')
    const [scheduledAt, setScheduledAt] = useState('')
    const [suggestedTimes, setSuggestedTimes] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingAccounts, setLoadingAccounts] = useState(true)
    const [serviceOnline, setServiceOnline] = useState(false)
    const [thumbBlobUrl, setThumbBlobUrl] = useState(null)

    useEffect(() => {
        if (platform && PLATFORM_CONFIG[platform]) {
            setHashtags(PLATFORM_CONFIG[platform].defaultHashtags)
        }
    }, [platform])

    useEffect(() => {
        if (!isOpen) return
        const loadAccounts = async () => {
            setLoadingAccounts(true)
            try {
                const health = await api.getTikTokHealth()
                setServiceOnline(health?.status === 'healthy')
                if (health?.status === 'healthy') {
                    if (platform === 'tiktok') {
                        const data = await api.getTikTokAccountsAvailable()
                        if (Array.isArray(data)) {
                            setAccounts(data)
                            if (data.length > 0) setSelectedAccountId(data[0].id)
                        }
                    } else {
                        const data = await api.getSocialAccounts(platform)
                        if (Array.isArray(data)) {
                            const validAccounts = data.filter(acc => acc.session_valid)
                            setAccounts(validAccounts)
                            if (validAccounts.length > 0) setSelectedAccountId(validAccounts[0].id)
                        }
                    }
                }
            } catch (err) {
                console.error('Load accounts error:', err)
                setServiceOnline(false)
            } finally {
                setLoadingAccounts(false)
            }
        }
        loadAccounts()
    }, [isOpen, platform])

    useEffect(() => {
        if (clip?.hook) setCaption(clip.hook)
    }, [clip])

    useEffect(() => {
        if (!thumbnail) return
        const thumbUrl = api.fileUrl(thumbnail)
        let revoke = null
        getAuthenticatedMediaUrl(thumbUrl)
            .then(blob => { revoke = blob; setThumbBlobUrl(blob) })
            .catch(() => setThumbBlobUrl(thumbUrl))
        return () => { if (revoke) URL.revokeObjectURL(revoke) }
    }, [thumbnail])

    useEffect(() => {
        if (!selectedAccountId || !serviceOnline || platform !== 'tiktok') return
        const loadSuggested = async () => {
            try {
                const data = await api.suggestTikTokSchedule(selectedAccountId, 1)
                if (data?.suggested_times) setSuggestedTimes(data.suggested_times)
            } catch { /* ignore */ }
        }
        loadSuggested()
    }, [selectedAccountId, serviceOnline, platform])

    const handleSubmit = async () => {
        if (!selectedAccountId) {
            toast.error(`Please select a ${config.name} account`)
            return
        }
        setLoading(true)
        try {
            const hashtagArray = hashtags.split(/\s+/).filter(h => h.startsWith('#'))
            if (platform === 'tiktok') {
                const payload = {
                    account_id: selectedAccountId,
                    request_log_id: jobId,
                    clip_index: clip.index,
                    caption: caption,
                    hashtags: hashtagArray,
                    scheduled_at: scheduleType === 'scheduled' && scheduledAt ? scheduledAt : null,
                }
                const result = await api.uploadToTikTok(payload)
                if (result.id) {
                    toast.success('Clip added to upload queue!')
                    onSuccess?.(result)
                    onClose()
                } else {
                    toast.error(result.detail || 'Failed to queue upload')
                }
            } else {
                const payload = {
                    account_id: selectedAccountId,
                    platform: platform,
                    request_log_id: jobId,
                    clip_index: clip.index,
                    caption: caption,
                    hashtags: hashtagArray,
                    scheduled_at: scheduleType === 'scheduled' && scheduledAt ? scheduledAt : null,
                }
                const result = await api.createSocialUpload(payload)
                if (result.id) {
                    toast.success(`Clip added to ${config.name} upload queue!`)
                    onSuccess?.(result)
                    onClose()
                } else {
                    toast.error(result.detail || 'Failed to queue upload')
                }
            }
        } catch (err) {
            console.error('Upload error:', err)
            toast.error('Error queuing upload')
        } finally {
            setLoading(false)
        }
    }

    const selectedAccount = accounts.find(a => a.id === selectedAccountId)
    const duration = (clip?.end_time ?? clip?.end) && (clip?.start_time ?? clip?.start)
        ? Math.round((clip?.end_time ?? clip?.end) - (clip?.start_time ?? clip?.start))
        : null

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="p-5 flex items-center justify-between sticky top-0 z-10"
                        style={{
                            borderBottom: '1px solid var(--color-border-subtle)',
                            background: 'var(--color-bg-card)'
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg text-white`}>
                                {config.icon}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Post to {config.name}</h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                    {isBulk ? `${clips?.length || 0} clips selected` : `Clip #${clip?.index}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="btn btn-ghost p-2"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* Service Offline */}
                    {!serviceOnline && !loadingAccounts && (
                        <div className="p-8 text-center">
                            <div
                                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                                style={{ background: 'var(--color-error-bg)' }}
                            >
                                <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-error-text)' }}>cloud_off</span>
                            </div>
                            <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{config.name} Service Offline</h4>
                            <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                                Start the autocliper-automate server to enable uploads
                            </p>
                            <button onClick={onClose} className="btn btn-secondary mt-6">Close</button>
                        </div>
                    )}

                    {/* Main Content */}
                    {serviceOnline && (
                        <>
                            <div className="p-5 space-y-5">
                                {/* Clip Preview */}
                                <div
                                    className="flex gap-4 p-4 rounded-xl"
                                    style={{
                                        background: 'var(--color-surface-1)',
                                        border: '1px solid var(--color-border-subtle)'
                                    }}
                                >
                                    <div
                                        className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 shadow-md"
                                        style={{ background: 'var(--color-surface-2)' }}
                                    >
                                        {thumbBlobUrl ? (
                                            <img src={thumbBlobUrl} alt="thumb" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>{clip?.hook}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {duration && (
                                                <span
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                                                    style={{ background: 'var(--color-bg-card)' }}
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">timer</span>
                                                    {duration}s
                                                </span>
                                            )}
                                            <span
                                                className="flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
                                                style={{
                                                    background: (clip?.score || 0) >= 0.9 ? 'var(--color-success-bg)' :
                                                        (clip?.score || 0) >= 0.75 ? 'var(--color-warning-bg)' : 'var(--color-surface-1)',
                                                    color: (clip?.score || 0) >= 0.9 ? 'var(--color-success-text)' :
                                                        (clip?.score || 0) >= 0.75 ? 'var(--color-warning-text)' : 'var(--color-text-secondary)'
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[12px]">trending_up</span>
                                                {Math.round((clip?.score || 0) * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Account Selection */}
                                <div>
                                    <label className="form-label uppercase tracking-wider">Select Account</label>
                                    {loadingAccounts ? (
                                        <div
                                            className="h-16 rounded-xl animate-pulse"
                                            style={{ background: 'var(--color-surface-1)' }}
                                        />
                                    ) : accounts.length === 0 ? (
                                        <div className="alert alert-warning text-center">
                                            <span className="material-symbols-outlined text-2xl mb-1">warning</span>
                                            <div>
                                                <p className="text-sm font-medium">No accounts available</p>
                                                <p className="text-xs mt-1" style={{ opacity: 0.8 }}>Add an account in the Account List page first</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {accounts.map(acc => {
                                                const displayName = acc.account_name || acc.channel_name || acc.login_identifier
                                                const username = acc.tiktok_username || acc.channel_id || acc.login_identifier
                                                const initial = displayName?.[0]?.toUpperCase() || platform[0].toUpperCase()

                                                return (
                                                    <button
                                                        key={acc.id}
                                                        onClick={() => setSelectedAccountId(acc.id)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
                                                        style={{
                                                            borderColor: selectedAccountId === acc.id ? 'var(--color-accent)' : 'var(--color-border-default)',
                                                            background: selectedAccountId === acc.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)',
                                                            boxShadow: selectedAccountId === acc.id ? 'var(--shadow-glow)' : 'none'
                                                        }}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md`}>
                                                            {initial}
                                                        </div>
                                                        <div className="flex-1 text-left min-w-0">
                                                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{displayName}</p>
                                                            <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                                {username ? (username.startsWith('@') ? username : `@${username}`) : 'Connected'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                                {acc.uploads_today || 0}/{acc.daily_upload_limit || 3}
                                                            </p>
                                                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>today</p>
                                                        </div>
                                                        {selectedAccountId === acc.id && (
                                                            <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--color-success-text)' }}>check_circle</span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Caption */}
                                <div>
                                    <label className="form-label uppercase tracking-wider">Caption</label>
                                    <textarea
                                        value={caption}
                                        onChange={e => setCaption(e.target.value)}
                                        rows={3}
                                        maxLength={config.maxCaption}
                                        placeholder="Write your caption here..."
                                        className="textarea"
                                    />
                                    <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-text-muted)' }}>{caption.length}/{config.maxCaption}</p>
                                </div>

                                {/* Hashtags */}
                                <div>
                                    <label className="form-label uppercase tracking-wider">Hashtags</label>
                                    <input
                                        type="text"
                                        value={hashtags}
                                        onChange={e => setHashtags(e.target.value)}
                                        placeholder="#fyp #viral #trending"
                                        className="input"
                                    />
                                </div>

                                {/* Schedule Options */}
                                <div>
                                    <label className="form-label uppercase tracking-wider">When to Post</label>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {[
                                            { key: 'now', label: 'Now', icon: 'bolt' },
                                            { key: 'scheduled', label: 'Schedule', icon: 'schedule' },
                                            { key: 'suggested', label: 'Best Time', icon: 'auto_awesome' },
                                        ].map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setScheduleType(opt.key)}
                                                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all"
                                                style={{
                                                    borderColor: scheduleType === opt.key ? 'var(--color-accent)' : 'var(--color-border-default)',
                                                    background: scheduleType === opt.key ? 'var(--color-accent-subtle)' : 'transparent',
                                                    color: scheduleType === opt.key ? 'var(--color-accent)' : 'var(--color-text-secondary)'
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[22px]">{opt.icon}</span>
                                                <span className="text-xs font-semibold">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {scheduleType === 'scheduled' && (
                                        <input
                                            type="datetime-local"
                                            value={scheduledAt}
                                            onChange={e => setScheduledAt(e.target.value)}
                                            min={new Date().toISOString().slice(0, 16)}
                                            className="input"
                                        />
                                    )}

                                    {scheduleType === 'suggested' && suggestedTimes.length > 0 && (
                                        <div className="space-y-2">
                                            {suggestedTimes.slice(0, 3).map((st, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        setScheduledAt(st.datetime)
                                                        setScheduleType('scheduled')
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 rounded-xl hover:shadow-md transition-all"
                                                    style={{
                                                        background: 'var(--color-warning-bg)',
                                                        border: '1px solid var(--color-warning-border)'
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-warning-text)' }}>star</span>
                                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                            {new Date(st.datetime).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-medium" style={{ color: 'var(--color-warning-text)' }}>{st.reason}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {scheduleType === 'suggested' && suggestedTimes.length === 0 && (
                                        <div
                                            className="text-center py-4 rounded-xl"
                                            style={{ background: 'var(--color-surface-1)' }}
                                        >
                                            <span className="material-symbols-outlined text-2xl mb-1" style={{ color: 'var(--color-text-muted)' }}>insights</span>
                                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                Post more videos to get personalized time recommendations.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div
                                className="p-5 flex gap-3 sticky bottom-0"
                                style={{
                                    borderTop: '1px solid var(--color-border-subtle)',
                                    background: 'var(--color-bg-card)'
                                }}
                            >
                                <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !selectedAccountId || accounts.length === 0}
                                    className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold bg-gradient-to-r ${config.gradient} text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl`}
                                >
                                    {loading ? (
                                        <>
                                            <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                                            Queuing...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                                            {scheduleType === 'now' ? 'Post Now' : 'Schedule Post'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

export default PostToSocialModal
