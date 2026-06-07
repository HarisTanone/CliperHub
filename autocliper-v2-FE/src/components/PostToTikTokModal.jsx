import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, getAuthenticatedMediaUrl } from '../utils/api'

function PostToTikTokModal({ isOpen, onClose, clip, jobId, outputFile, thumbnail, onSuccess }) {
    const [accounts, setAccounts] = useState([])
    const [selectedAccountId, setSelectedAccountId] = useState(null)
    const [caption, setCaption] = useState('')
    const [hashtags, setHashtags] = useState('#fyp #viral')
    const [scheduleType, setScheduleType] = useState('now')
    const [scheduledAt, setScheduledAt] = useState('')
    const [suggestedTimes, setSuggestedTimes] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingAccounts, setLoadingAccounts] = useState(true)
    const [tiktokOnline, setTiktokOnline] = useState(false)
    const [thumbBlobUrl, setThumbBlobUrl] = useState(null)

    useEffect(() => {
        if (!isOpen) return
        const loadAccounts = async () => {
            setLoadingAccounts(true)
            try {
                const health = await api.getTikTokHealth()
                setTiktokOnline(health?.status === 'healthy')
                if (health?.status === 'healthy') {
                    const data = await api.getTikTokAccountsAvailable()
                    if (Array.isArray(data)) {
                        setAccounts(data)
                        if (data.length > 0) setSelectedAccountId(data[0].id)
                    }
                }
            } catch (err) {
                console.error('Load accounts error:', err)
                setTiktokOnline(false)
            } finally {
                setLoadingAccounts(false)
            }
        }
        loadAccounts()
    }, [isOpen])

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
        if (!selectedAccountId || !tiktokOnline) return
        const loadSuggested = async () => {
            try {
                const data = await api.suggestTikTokSchedule(selectedAccountId, 1)
                if (data?.suggested_times) setSuggestedTimes(data.suggested_times)
            } catch { /* ignore */ }
        }
        loadSuggested()
    }, [selectedAccountId, tiktokOnline])

    const handleSubmit = async () => {
        if (!selectedAccountId) {
            toast.error('Please select a TikTok account')
            return
        }
        setLoading(true)
        try {
            const hashtagArray = hashtags.split(/\s+/).filter(h => h.startsWith('#'))
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
        } catch (err) {
            toast.error('Error queuing upload')
        } finally {
            setLoading(false)
        }
    }

    const selectedAccount = accounts.find(a => a.id === selectedAccountId)
    const duration = clip?.end_time && clip?.start_time
        ? Math.round(clip.end_time - clip.start_time) : null

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
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
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">smart_display</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Post to TikTok</h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Clip #{clip?.index}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn btn-ghost p-1.5">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* TikTok Service Offline */}
                    {!tiktokOnline && !loadingAccounts && (
                        <div className="p-5">
                            <div className="alert alert-error text-center">
                                <span className="material-symbols-outlined text-3xl mb-2">cloud_off</span>
                                <div>
                                    <p className="text-sm font-medium">TikTok Service Offline</p>
                                    <p className="text-xs mt-1" style={{ opacity: 0.8 }}>Start the autocliper-automate server to enable uploads</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    {tiktokOnline && (
                        <div className="p-5 space-y-5">
                            {/* Clip Preview */}
                            <div
                                className="flex gap-4 p-3 rounded-xl"
                                style={{ background: 'var(--color-surface-1)' }}
                            >
                                <div
                                    className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0"
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
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{clip?.hook}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {duration && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">timer</span>
                                                {duration}s
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">trending_up</span>
                                            Score: {Math.round((clip?.score || 0) * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Selection */}
                            <div>
                                <label className="form-label">Select TikTok Account</label>
                                {loadingAccounts ? (
                                    <div
                                        className="h-12 rounded-xl animate-pulse"
                                        style={{ background: 'var(--color-surface-1)' }}
                                    />
                                ) : accounts.length === 0 ? (
                                    <div className="alert alert-warning text-center">
                                        <p className="text-sm font-medium">No TikTok accounts available</p>
                                        <p className="text-xs mt-1" style={{ opacity: 0.8 }}>Add an account in TikTok page first</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {accounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                onClick={() => setSelectedAccountId(acc.id)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all"
                                                style={{
                                                    borderColor: selectedAccountId === acc.id ? 'var(--color-accent)' : 'var(--color-border-default)',
                                                    background: selectedAccountId === acc.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)'
                                                }}
                                            >
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                    {acc.account_name?.[0]?.toUpperCase() || 'T'}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{acc.account_name}</p>
                                                    <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {acc.tiktok_username ? `@${acc.tiktok_username}` : acc.login_identifier}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        {acc.uploads_today || 0}/{acc.daily_upload_limit || 3}
                                                    </p>
                                                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>today</p>
                                                </div>
                                                {selectedAccountId === acc.id && (
                                                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>check_circle</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Caption */}
                            <div>
                                <label className="form-label">Caption</label>
                                <textarea
                                    value={caption}
                                    onChange={e => setCaption(e.target.value)}
                                    rows={3}
                                    placeholder="Write your caption here..."
                                    className="textarea"
                                />
                                <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-text-muted)' }}>{caption.length}/2200</p>
                            </div>

                            {/* Hashtags */}
                            <div>
                                <label className="form-label">Hashtags</label>
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
                                <label className="form-label">When to Post</label>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {[
                                        { key: 'now', label: 'Now', icon: 'play_arrow' },
                                        { key: 'scheduled', label: 'Schedule', icon: 'schedule' },
                                        { key: 'suggested', label: 'Best Time', icon: 'auto_awesome' },
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setScheduleType(opt.key)}
                                            className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all"
                                            style={{
                                                borderColor: scheduleType === opt.key ? 'var(--color-accent)' : 'var(--color-border-default)',
                                                background: scheduleType === opt.key ? 'var(--color-accent-subtle)' : 'transparent',
                                                color: scheduleType === opt.key ? 'var(--color-accent)' : 'var(--color-text-secondary)'
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
                                            <span className="text-xs font-medium">{opt.label}</span>
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
                                                className="w-full flex items-center justify-between p-3 rounded-xl transition-colors"
                                                style={{
                                                    background: 'var(--color-surface-1)'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface-1)'}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-warning-text)' }}>star</span>
                                                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                        {new Date(st.datetime).toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{st.reason}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {scheduleType === 'suggested' && suggestedTimes.length === 0 && (
                                    <p className="text-xs text-center py-3" style={{ color: 'var(--color-text-secondary)' }}>
                                        No suggested times available. Post more videos to get personalized recommendations.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    {tiktokOnline && (
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
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                                        Queuing...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                                        {scheduleType === 'now' ? 'Post Now' : 'Schedule'}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

export default PostToTikTokModal
