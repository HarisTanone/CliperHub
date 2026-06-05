import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import { CardSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
//  Status Badges
// ─────────────────────────────────────────────────────────────────────────────
const ACCOUNT_STATUS = {
    active: { color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: 'check_circle' },
    suspended: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: 'block' },
    needs_verification: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: 'warning' },
    needs_captcha: { color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', icon: 'smart_toy' },
    inactive: { color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400', icon: 'pause_circle' },
}

const UPLOAD_STATUS = {
    pending: { color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400', icon: 'schedule' },
    processing: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: 'pending' },
    uploading: { color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', icon: 'cloud_upload' },
    published: { color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: 'check_circle' },
    failed: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: 'error' },
    cancelled: { color: 'bg-slate-100 dark:bg-slate-700 text-slate-500', icon: 'cancel' },
}

// ─────────────────────────────────────────────────────────────────────────────
//  Add Account Modal
// ─────────────────────────────────────────────────────────────────────────────
function AddAccountModal({ isOpen, onClose, onSave }) {
    const [form, setForm] = useState({
        account_name: '',
        login_type: 'manual',  // Default to manual login
        login_identifier: '',
        password: '',
        proxy_url: '',
        daily_upload_limit: 3,
        notes: '',
    })
    const [saving, setSaving] = useState(false)
    const [loginStatus, setLoginStatus] = useState(null) // null | 'logging_in' | 'verifying' | 'success' | 'failed' | 'verification'
    const [showPassword, setShowPassword] = useState(false)

    const isManualLogin = form.login_type === 'manual'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setLoginStatus('logging_in')

        try {
            const payload = {
                ...form,
                auto_login: true,
                // For manual login, don't send empty credentials
                login_identifier: isManualLogin ? '' : form.login_identifier,
                password: isManualLogin ? '' : form.password,
            }

            const result = await api.createTikTokAccount(payload)

            if (result.id) {
                // Check login result
                if (result.login_result?.success) {
                    setLoginStatus('success')
                    toast.success(isManualLogin ? 'Account added! Login captured successfully.' : 'Account added and logged in successfully!')
                } else if (result.login_result?.needs_verification) {
                    setLoginStatus('verification')
                    toast.error('Verification timeout. Account saved, complete login manually.')
                } else if (result.login_result?.needs_captcha) {
                    setLoginStatus('verification')
                    toast.error('CAPTCHA timeout. Account saved, complete login manually.')
                } else if (result.login_result?.verification_completed) {
                    setLoginStatus('success')
                    toast.success('Verification completed! Account added successfully.')
                } else {
                    setLoginStatus('success')
                    toast.success('Account added successfully')
                }

                onSave(result)

                // Close modal after short delay so user sees the status
                setTimeout(() => {
                    onClose()
                    setForm({
                        account_name: '',
                        login_type: 'manual',
                        login_identifier: '',
                        password: '',
                        proxy_url: '',
                        daily_upload_limit: 3,
                        notes: '',
                    })
                    setLoginStatus(null)
                }, 1500)
            } else {
                // Login failed - account NOT saved
                setLoginStatus('failed')
                toast.error(result.detail || 'Login failed. Check your credentials.')
                setSaving(false)
            }
        } catch (err) {
            // Login failed - account NOT saved
            setLoginStatus('failed')
            toast.error(err.message || 'Login failed. Please try again.')
            setSaving(false)
        }
    }

    if (!isOpen) return null

    const statusConfig = {
        logging_in: {
            icon: 'sync',
            text: isManualLogin
                ? 'Opening browser... Login manually in the browser window.'
                : 'Logging in to TikTok... Browser will open for verification.',
            color: 'text-blue-500',
            spin: true
        },
        verifying: { icon: 'hourglass_top', text: 'Complete verification in browser window...', color: 'text-amber-500', spin: true },
        success: { icon: 'check_circle', text: 'Login successful!', color: 'text-green-500', spin: false },
        failed: { icon: 'error', text: 'Login failed. Account not saved.', color: 'text-red-500', spin: false },
        verification: { icon: 'warning', text: 'Verification timeout. Try manual login.', color: 'text-yellow-500', spin: false },
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between sticky top-0 bg-white dark:bg-[#152230] z-10">
                    <h3 className="text-lg font-semibold">Add TikTok Account</h3>
                    <button onClick={onClose} disabled={saving} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-50">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Login Status Banner */}
                {loginStatus && (
                    <div className={`mx-5 mt-4 p-3 rounded-xl flex items-center gap-3 ${loginStatus === 'logging_in' ? 'bg-blue-50 dark:bg-blue-900/20' :
                        loginStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                            loginStatus === 'verification' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                                'bg-red-50 dark:bg-red-900/20'
                        }`}>
                        <span className={`material-symbols-outlined text-[20px] ${statusConfig[loginStatus].color} ${statusConfig[loginStatus].spin ? 'animate-spin' : ''}`}>
                            {statusConfig[loginStatus].icon}
                        </span>
                        <span className={`text-sm font-medium ${statusConfig[loginStatus].color}`}>
                            {statusConfig[loginStatus].text}
                        </span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Account Name</label>
                        <input
                            type="text"
                            value={form.account_name}
                            onChange={e => setForm({ ...form, account_name: e.target.value })}
                            placeholder="My Main Account"
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            required
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Login Method</label>
                        <select
                            value={form.login_type}
                            onChange={e => setForm({ ...form, login_type: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            disabled={saving}
                        >
                            <option value="manual">Manual Login (Recommended)</option>
                            <option value="email">Auto Login with Email</option>
                            <option value="username">Auto Login with Username</option>
                            <option value="phone">Auto Login with Phone</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">{isManualLogin ? 'lock_open' : 'warning'}</span>
                            {isManualLogin
                                ? 'Browser will open, you login manually. No credentials stored.'
                                : 'Credentials will be encrypted and stored for auto-login.'}
                        </p>
                    </div>

                    {/* Only show credentials for auto-login */}
                    {!isManualLogin && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    {form.login_type === 'email' ? 'Email' : form.login_type === 'phone' ? 'Phone Number' : 'Username'}
                                </label>
                                <input
                                    type={form.login_type === 'email' ? 'email' : 'text'}
                                    value={form.login_identifier}
                                    onChange={e => setForm({ ...form, login_identifier: e.target.value })}
                                    placeholder={form.login_type === 'email' ? 'email@example.com' : form.login_type === 'phone' ? '812345678' : 'username'}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                                    required={!isManualLogin}
                                    disabled={saving}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                                        required={!isManualLogin}
                                        disabled={saving}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                        disabled={saving}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Proxy URL (optional)</label>
                        <input
                            type="text"
                            value={form.proxy_url}
                            onChange={e => setForm({ ...form, proxy_url: e.target.value })}
                            placeholder="http://user:pass@host:port"
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Daily Upload Limit</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={form.daily_upload_limit}
                            onChange={e => setForm({ ...form, daily_upload_limit: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            disabled={saving}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-[#324d67] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e2e40] transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                    {loginStatus === 'logging_in' ? (isManualLogin ? 'Opening browser...' : 'Logging in...') : 'Adding...'}
                                </>
                            ) : (
                                isManualLogin ? 'Add & Open Browser' : 'Add & Login'
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Account Card
// ─────────────────────────────────────────────────────────────────────────────
function AccountCard({ account, onLogin, onDelete, onRefresh }) {
    const [loggingIn, setLoggingIn] = useState(false)
    const status = ACCOUNT_STATUS[account.status] || ACCOUNT_STATUS.inactive

    const handleLogin = async () => {
        setLoggingIn(true)
        try {
            const result = await api.triggerTikTokLogin(account.id)
            if (result.success) {
                toast.success('Login successful!')
                onRefresh()
            } else if (result.needs_verification) {
                toast.error(`Verification required: ${result.verification_type}`)
            } else {
                toast.error(result.message || 'Login failed')
            }
        } catch (err) {
            toast.error('Login error')
        } finally {
            setLoggingIn(false)
        }
    }

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                        {account.account_name?.[0]?.toUpperCase() || 'T'}
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{account.account_name}</h4>
                        <p className="text-xs text-slate-500">
                            {account.tiktok_username ? `@${account.tiktok_username}` : account.login_identifier}
                        </p>
                    </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                    <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                    {account.status}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-slate-50 dark:bg-[#192633] rounded-lg">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{account.uploads_today || 0}</p>
                    <p className="text-[10px] text-slate-500">Today</p>
                </div>
                <div className="text-center p-2 bg-slate-50 dark:bg-[#192633] rounded-lg">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{account.daily_upload_limit || 3}</p>
                    <p className="text-[10px] text-slate-500">Limit</p>
                </div>
                <div className="text-center p-2 bg-slate-50 dark:bg-[#192633] rounded-lg">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{account.health_score || 100}</p>
                    <p className="text-[10px] text-slate-500">Health</p>
                </div>
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                <span className={`w-2 h-2 rounded-full ${account.session_valid ? 'bg-green-500' : 'bg-red-500'}`}></span>
                Session: {account.session_valid ? 'Valid' : 'Invalid'}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleLogin}
                    disabled={loggingIn}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50"
                >
                    <span className="material-symbols-outlined text-[14px]">{loggingIn ? 'sync' : 'login'}</span>
                    {loggingIn ? 'Logging in...' : 'Login'}
                </button>
                <button
                    onClick={() => onDelete(account.id)}
                    className="px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
            </div>
        </motion.div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Upload Queue Item
// ─────────────────────────────────────────────────────────────────────────────
function UploadQueueItem({ upload, onCancel, onRetry }) {
    const status = UPLOAD_STATUS[upload.status] || UPLOAD_STATUS.pending

    return (
        <div className="p-4 border-b border-slate-100 dark:border-[#233648] last:border-0 hover:bg-slate-50 dark:hover:bg-[#192633] transition-colors">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-slate-400">movie</span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            Clip #{upload.clip_index || 1}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            <span className="material-symbols-outlined text-[11px]">{status.icon}</span>
                            {upload.status}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{upload.account_name || `Account #${upload.account_id}`}</p>
                    {upload.progress_percent > 0 && upload.status === 'uploading' && (
                        <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${upload.progress_percent}%` }}
                            />
                        </div>
                    )}
                    {upload.error_message && (
                        <p className="text-xs text-red-500 mt-1 truncate">{upload.error_message}</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {upload.tiktok_url && (
                        <a
                            href={upload.tiktok_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </a>
                    )}
                    {upload.status === 'failed' && (
                        <button
                            onClick={() => onRetry(upload.id)}
                            className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                        </button>
                    )}
                    {['pending', 'processing'].includes(upload.status) && (
                        <button
                            onClick={() => onCancel(upload.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">cancel</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────
function TikTokPage() {
    const [tab, setTab] = useState('accounts')
    const [accounts, setAccounts] = useState([])
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [tiktokOnline, setTiktokOnline] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            // Check if TikTok service is online
            const health = await api.getTikTokHealth()
            setTiktokOnline(health?.status === 'healthy')

            if (health?.status === 'healthy') {
                const [accountsData, queueData] = await Promise.all([
                    api.getTikTokAccounts(),
                    api.getTikTokQueue(),
                ])
                if (Array.isArray(accountsData)) setAccounts(accountsData)
                if (Array.isArray(queueData)) setQueue(queueData)
            }
        } catch (err) {
            console.error('Load TikTok data error:', err)
            setTiktokOnline(false)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
        const interval = setInterval(loadData, 30000) // Refresh every 30s
        return () => clearInterval(interval)
    }, [loadData])

    const handleDeleteAccount = async (id) => {
        if (!confirm('Delete this TikTok account?')) return
        await api.deleteTikTokAccount(id)
        loadData()
        toast.success('Account deleted')
    }

    const handleCancelUpload = async (id) => {
        await api.cancelTikTokUpload(id)
        loadData()
        toast.success('Upload cancelled')
    }

    const handleRetryUpload = async (id) => {
        await api.retryTikTokUpload(id)
        loadData()
        toast.success('Upload queued for retry')
    }

    const stats = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.status === 'active').length,
        pendingUploads: queue.filter(u => u.status === 'pending').length,
        publishedToday: queue.filter(u => u.status === 'published').length,
    }

    if (!tiktokOnline && !loading) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
                <div className="max-w-4xl mx-auto">
                    <EmptyState
                        type="error"
                        title="TikTok Service Offline"
                        description="The TikTok Automate service is not running. Start it with 'python main.py' in the autocliper-automate folder."
                    />
                    <div className="mt-4 text-center">
                        <button
                            onClick={loadData}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                            Retry Connection
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
            <div className="max-w-6xl mx-auto space-y-5">
                {/* Stats */}
                <FadeInUp>
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: 'Total Accounts', value: stats.totalAccounts, icon: 'group', bg: 'bg-primary' },
                            { label: 'Active', value: stats.activeAccounts, icon: 'check_circle', bg: 'bg-emerald-500' },
                            { label: 'Pending', value: stats.pendingUploads, icon: 'schedule', bg: 'bg-amber-500' },
                            { label: 'Published', value: stats.publishedToday, icon: 'cloud_done', bg: 'bg-violet-500' },
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

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#233648]">
                    {[
                        { key: 'accounts', label: 'Accounts', icon: 'group' },
                        { key: 'queue', label: 'Upload Queue', icon: 'cloud_upload' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={loadData}
                            className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-[#1e2e40] rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                        </button>
                        {tab === 'accounts' && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Add Account
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                ) : tab === 'accounts' ? (
                    accounts.length === 0 ? (
                        <EmptyState
                            type="empty"
                            title="No TikTok Accounts"
                            description="Add your first TikTok account to start uploading videos automatically"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {accounts.map(account => (
                                <AccountCard
                                    key={account.id}
                                    account={account}
                                    onLogin={() => { }}
                                    onDelete={handleDeleteAccount}
                                    onRefresh={loadData}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648]">
                            <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">cloud_upload</span>
                                Upload Queue
                            </h3>
                        </div>
                        {queue.length === 0 ? (
                            <EmptyState
                                type="empty"
                                title="No Uploads"
                                description="Upload clips from the Library page to see them here"
                            />
                        ) : (
                            <div>
                                {queue.map(upload => (
                                    <UploadQueueItem
                                        key={upload.id}
                                        upload={upload}
                                        onCancel={handleCancelUpload}
                                        onRetry={handleRetryUpload}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Add Account Modal */}
                <AnimatePresence>
                    {showAddModal && (
                        <AddAccountModal
                            isOpen={showAddModal}
                            onClose={() => setShowAddModal(false)}
                            onSave={(account) => setAccounts([account, ...accounts])}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

export default TikTokPage
