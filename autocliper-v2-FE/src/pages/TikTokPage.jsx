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
    active: { color: 'badge-success', icon: 'check_circle' },
    suspended: { color: 'badge-error', icon: 'block' },
    needs_verification: { color: 'badge-warning', icon: 'warning' },
    needs_captcha: { color: 'badge-warning', icon: 'smart_toy' },
    inactive: { color: 'badge-neutral', icon: 'pause_circle' },
}

const UPLOAD_STATUS = {
    pending: { color: 'badge-neutral', icon: 'schedule' },
    processing: { color: 'badge-info', icon: 'pending' },
    uploading: { color: 'badge-info', icon: 'cloud_upload' },
    published: { color: 'badge-success', icon: 'check_circle' },
    failed: { color: 'badge-error', icon: 'error' },
    cancelled: { color: 'badge-neutral', icon: 'cancel' },
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
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ background: 'var(--color-bg-overlay)' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="rounded-2xl border shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 flex items-center justify-between sticky top-0 z-10" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Add TikTok Account</h3>
                    <button onClick={onClose} disabled={saving} className="p-1 rounded-lg disabled:opacity-50" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Login Status Banner */}
                {loginStatus && (
                    <div className="mx-5 mt-4 p-3 rounded-xl flex items-center gap-3"
                        style={{
                            background: loginStatus === 'logging_in' ? 'var(--color-info-bg)' :
                                loginStatus === 'success' ? 'var(--color-success-bg)' :
                                    loginStatus === 'verification' ? 'var(--color-warning-bg)' :
                                        'var(--color-error-bg)',
                            color: loginStatus === 'logging_in' ? 'var(--color-info-text)' :
                                loginStatus === 'success' ? 'var(--color-success-text)' :
                                    loginStatus === 'verification' ? 'var(--color-warning-text)' :
                                        'var(--color-error-text)'
                        }}>
                        <span className={`material-symbols-outlined text-[20px] ${statusConfig[loginStatus].spin ? 'animate-spin' : ''}`}>
                            {statusConfig[loginStatus].icon}
                        </span>
                        <span className="text-sm font-medium">
                            {statusConfig[loginStatus].text}
                        </span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="form-label">Account Name</label>
                        <input
                            type="text"
                            value={form.account_name}
                            onChange={e => setForm({ ...form, account_name: e.target.value })}
                            placeholder="My Main Account"
                            className="input"
                            required
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label className="form-label">Login Method</label>
                        <select
                            value={form.login_type}
                            onChange={e => setForm({ ...form, login_type: e.target.value })}
                            className="select"
                            disabled={saving}
                        >
                            <option value="manual">Manual Login (Recommended)</option>
                            <option value="email">Auto Login with Email</option>
                            <option value="username">Auto Login with Username</option>
                            <option value="phone">Auto Login with Phone</option>
                        </select>
                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
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
                                <label className="form-label">
                                    {form.login_type === 'email' ? 'Email' : form.login_type === 'phone' ? 'Phone Number' : 'Username'}
                                </label>
                                <input
                                    type={form.login_type === 'email' ? 'email' : 'text'}
                                    value={form.login_identifier}
                                    onChange={e => setForm({ ...form, login_identifier: e.target.value })}
                                    placeholder={form.login_type === 'email' ? 'email@example.com' : form.login_type === 'phone' ? '812345678' : 'username'}
                                    className="input"
                                    required={!isManualLogin}
                                    disabled={saving}
                                />
                            </div>

                            <div>
                                <label className="form-label">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="input pr-10"
                                        required={!isManualLogin}
                                        disabled={saving}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors"
                                        style={{ color: 'var(--color-text-muted)' }}
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
                        <label className="form-label">Proxy URL (optional)</label>
                        <input
                            type="text"
                            value={form.proxy_url}
                            onChange={e => setForm({ ...form, proxy_url: e.target.value })}
                            placeholder="http://user:pass@host:port"
                            className="input"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label className="form-label">Daily Upload Limit</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={form.daily_upload_limit}
                            onChange={e => setForm({ ...form, daily_upload_limit: parseInt(e.target.value) })}
                            className="input"
                            disabled={saving}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="btn btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary flex-1"
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
            className="card card-hover"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                        {account.account_name?.[0]?.toUpperCase() || 'T'}
                    </div>
                    <div>
                        <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{account.account_name}</h4>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {account.tiktok_username ? `@${account.tiktok_username}` : account.login_identifier}
                        </p>
                    </div>
                </div>
                <span className={`badge ${status.color}`}>
                    <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                    {account.status}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-surface-1)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{account.uploads_today || 0}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Today</p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-surface-1)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{account.daily_upload_limit || 3}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Limit</p>
                </div>
                <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-surface-1)' }}>
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{account.health_score || 100}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Health</p>
                </div>
            </div>

            <div className="flex items-center gap-1 text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: account.session_valid ? 'var(--color-success-text)' : 'var(--color-error-text)' }}></span>
                Session: {account.session_valid ? 'Valid' : 'Invalid'}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleLogin}
                    disabled={loggingIn}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
                >
                    <span className="material-symbols-outlined text-[14px]">{loggingIn ? 'sync' : 'login'}</span>
                    {loggingIn ? 'Logging in...' : 'Login'}
                </button>
                <button
                    onClick={() => onDelete(account.id)}
                    className="px-3 py-2 text-xs rounded-lg transition-colors"
                    style={{ color: 'var(--color-error-text)' }}
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
        <div className="p-4 last:border-0 transition-colors" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-surface-1)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>movie</span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            Clip #{upload.clip_index || 1}
                        </span>
                        <span className={`badge ${status.color}`}>
                            <span className="material-symbols-outlined text-[11px]">{status.icon}</span>
                            {upload.status}
                        </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{upload.account_name || `Account #${upload.account_id}`}</p>
                    {upload.progress_percent > 0 && upload.status === 'uploading' && (
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-1)' }}>
                            <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${upload.progress_percent}%`, background: 'var(--color-accent)' }}
                            />
                        </div>
                    )}
                    {upload.error_message && (
                        <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-error-text)' }}>{upload.error_message}</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {upload.tiktok_url && (
                        <a
                            href={upload.tiktok_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--color-accent)' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </a>
                    )}
                    {upload.status === 'failed' && (
                        <button
                            onClick={() => onRetry(upload.id)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--color-warning-text)' }}
                        >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                        </button>
                    )}
                    {['pending', 'processing'].includes(upload.status) && (
                        <button
                            onClick={() => onCancel(upload.id)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--color-error-text)' }}
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
        try {
            const res = await api.deleteTikTokAccount(id)
            if (res.detail) {
                toast.error(res.detail)
                return
            }
            toast.success('Account deleted')
            loadData()
        } catch (e) {
            toast.error('Failed to delete account')
        }
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
            <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
                <div className="max-w-4xl mx-auto">
                    <EmptyState
                        type="error"
                        title="TikTok Service Offline"
                        description="The TikTok Automate service is not running. Start it with 'python main.py' in the autocliper-automate folder."
                    />
                    <div className="mt-4 text-center">
                        <button
                            onClick={loadData}
                            className="btn btn-primary"
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
        <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="max-w-6xl mx-auto space-y-5">
                {/* Stats */}
                <FadeInUp>
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: 'Total Accounts', value: stats.totalAccounts, icon: 'group', color: 'var(--color-accent)' },
                            { label: 'Active', value: stats.activeAccounts, icon: 'check_circle', color: 'var(--color-success-text)' },
                            { label: 'Pending', value: stats.pendingUploads, icon: 'schedule', color: 'var(--color-warning-text)' },
                            { label: 'Published', value: stats.publishedToday, icon: 'cloud_done', color: 'var(--color-info-text)' },
                        ].map(s => (
                            <motion.div key={s.label} whileHover={{ y: -2 }} className="card card-hover flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.color }}>
                                    <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </FadeInUp>

                {/* Tabs */}
                <div className="flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {[
                        { key: 'accounts', label: 'Accounts', icon: 'group' },
                        { key: 'queue', label: 'Upload Queue', icon: 'cloud_upload' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                            style={{
                                borderColor: tab === t.key ? 'var(--color-accent)' : 'transparent',
                                color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)'
                            }}
                        >
                            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={loadData}
                            className="btn btn-ghost btn-icon"
                        >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                        </button>
                        {tab === 'accounts' && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="btn btn-primary btn-sm"
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
                    <div className="card shadow-sm overflow-hidden">
                        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>cloud_upload</span>
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
