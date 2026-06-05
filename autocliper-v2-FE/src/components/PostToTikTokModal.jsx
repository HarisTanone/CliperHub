import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api, getAuthenticatedMediaUrl } from '../utils/api'

function PostToTikTokModal({ isOpen, onClose, clip, jobId, outputFile, thumbnail, onSuccess }) {
    const [accounts, setAccounts] = useState([])
    const [selectedAccountId, setSelectedAccountId] = useState(null)
    const [caption, setCaption] = useState('')
    const [hashtags, setHashtags] = useState('#fyp #viral')
    const [scheduleType, setScheduleType] = useState('now') // 'now' | 'scheduled' | 'suggested'
    const [scheduledAt, setScheduledAt] = useState('')
    const [suggestedTimes, setSuggestedTimes] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingAccounts, setLoadingAccounts] = useState(true)
    const [tiktokOnline, setTiktokOnline] = useState(false)
    const [thumbBlobUrl, setThumbBlobUrl] = useState(null)

    // Load accounts on mount
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

    // Set default caption from hook
    useEffect(() => {
        if (clip?.hook) {
            setCaption(clip.hook)
        }
    }, [clip])

    // Load thumbnail with auth
    useEffect(() => {
        if (!thumbnail) return
        const thumbUrl = api.fileUrl(thumbnail)
        let revoke = null
        getAuthenticatedMediaUrl(thumbUrl)
            .then(blob => { revoke = blob; setThumbBlobUrl(blob) })
            .catch(() => setThumbBlobUrl(thumbUrl))
        return () => { if (revoke) URL.revokeObjectURL(revoke) }
    }, [thumbnail])

    // Load suggested times when account selected
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
                    className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between sticky top-0 bg-white dark:bg-[#152230] z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">smart_display</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Post to TikTok</h3>
                                <p className="text-xs text-slate-500">Clip #{clip?.index}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40]">
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* TikTok Service Offline */}
                    {!tiktokOnline && !loadingAccounts && (
                        <div className="p-5">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                                <span className="material-symbols-outlined text-red-500 text-3xl mb-2">cloud_off</span>
                                <p className="text-sm font-medium text-red-700 dark:text-red-400">TikTok Service Offline</p>
                                <p className="text-xs text-red-600 dark:text-red-500 mt-1">Start the autocliper-automate server to enable uploads</p>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    {tiktokOnline && (
                        <div className="p-5 space-y-5">
                            {/* Clip Preview */}
                            <div className="flex gap-4 p-3 bg-slate-50 dark:bg-[#192633] rounded-xl">
                                <div className="w-20 h-28 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                                    {thumbBlobUrl ? (
                                        <img src={thumbBlobUrl} alt="thumb" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl text-slate-400">movie</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{clip?.hook}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
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
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Select TikTok Account
                                </label>
                                {loadingAccounts ? (
                                    <div className="h-12 bg-slate-100 dark:bg-[#192633] rounded-xl animate-pulse" />
                                ) : accounts.length === 0 ? (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                                        <p className="text-sm text-amber-700 dark:text-amber-400">No TikTok accounts available</p>
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Add an account in TikTok page first</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {accounts.map(acc => (
                                            <button
                                                key={acc.id}
                                                onClick={() => setSelectedAccountId(acc.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedAccountId === acc.id
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-slate-200 dark:border-[#324d67] hover:border-slate-300 dark:hover:border-[#4a6a8a]'
                                                    }`}
                                            >
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                    {acc.account_name?.[0]?.toUpperCase() || 'T'}
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{acc.account_name}</p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {acc.tiktok_username ? `@${acc.tiktok_username}` : acc.login_identifier}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        {acc.uploads_today || 0}/{acc.daily_upload_limit || 3}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">today</p>
                                                </div>
                                                {selectedAccountId === acc.id && (
                                                    <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Caption */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Caption
                                </label>
                                <textarea
                                    value={caption}
                                    onChange={e => setCaption(e.target.value)}
                                    rows={3}
                                    placeholder="Write your caption here..."
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none resize-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 text-right">{caption.length}/2200</p>
                            </div>

                            {/* Hashtags */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    Hashtags
                                </label>
                                <input
                                    type="text"
                                    value={hashtags}
                                    onChange={e => setHashtags(e.target.value)}
                                    placeholder="#fyp #viral #trending"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                                />
                            </div>

                            {/* Schedule Options */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                                    When to Post
                                </label>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {[
                                        { key: 'now', label: 'Now', icon: 'play_arrow' },
                                        { key: 'scheduled', label: 'Schedule', icon: 'schedule' },
                                        { key: 'suggested', label: 'Best Time', icon: 'auto_awesome' },
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => setScheduleType(opt.key)}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${scheduleType === opt.key
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-200 dark:border-[#324d67] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                                }`}
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
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
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
                                                className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-[#192633] rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e2e40] transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-amber-500 text-[18px]">star</span>
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                                        {new Date(st.datetime).toLocaleString()}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-slate-500">{st.reason}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {scheduleType === 'suggested' && suggestedTimes.length === 0 && (
                                    <p className="text-xs text-slate-500 text-center py-3">
                                        No suggested times available. Post more videos to get personalized recommendations.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    {tiktokOnline && (
                        <div className="p-5 border-t border-slate-100 dark:border-[#233648] flex gap-3 sticky bottom-0 bg-white dark:bg-[#152230]">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-[#324d67] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e2e40] transition-colors"
                            >
                                Cancel
                            </button>
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
