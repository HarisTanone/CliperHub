import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'
import { FadeInUp } from '../components/PageTransition'
import EmptyState from '../components/EmptyState'

// Platform Icons (SVG)
const PlatformIcons = {
    youtube: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
    ),
    facebook: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    ),
    instagram: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
    ),
    x: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    ),
    tiktok: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
    ),
}

const PLATFORM_COLORS = {
    youtube: { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-100 dark:bg-red-900/30' },
    facebook: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-100 dark:bg-blue-900/30' },
    instagram: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', text: 'text-pink-500', light: 'bg-pink-100 dark:bg-pink-900/30' },
    x: { bg: 'bg-black dark:bg-white', text: 'text-black dark:text-white', light: 'bg-slate-100 dark:bg-slate-700' },
    tiktok: { bg: 'bg-black', text: 'text-black dark:text-white', light: 'bg-slate-100 dark:bg-slate-700' },
}

const ACCOUNT_STATUS = {
    active: { color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: 'check_circle' },
    suspended: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: 'block' },
    needs_verification: { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: 'warning' },
    inactive: { color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400', icon: 'pause_circle' },
}


// Add Account Modal
function AddAccountModal({ isOpen, onClose, onSave, platforms }) {
    const [form, setForm] = useState({
        platform: 'youtube',
        account_name: '',
        login_type: 'manual',
        login_identifier: '',
        password: '',
        proxy_url: '',
        daily_upload_limit: 3,
    })
    const [saving, setSaving] = useState(false)
    const [loginStatus, setLoginStatus] = useState(null)
    const [showPassword, setShowPassword] = useState(false)

    const currentPlatform = platforms.find(p => p.id === form.platform)
    const isManualLogin = form.login_type === 'manual' || form.login_type === 'google'

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setLoginStatus('logging_in')

        try {
            const payload = {
                ...form,
                auto_login: true,
                login_identifier: isManualLogin ? '' : form.login_identifier,
                password: isManualLogin ? '' : form.password,
            }

            const result = await api.createSocialAccount(payload)

            if (result.id) {
                if (result.login_result?.success) {
                    setLoginStatus('success')
                    toast.success('Account added successfully!')
                } else if (result.login_result?.needs_verification) {
                    setLoginStatus('verification')
                    toast.error('Verification timeout. Complete login manually.')
                } else {
                    setLoginStatus('success')
                    toast.success('Account added!')
                }

                onSave(result)
                setTimeout(() => {
                    onClose()
                    setForm({ platform: 'youtube', account_name: '', login_type: 'manual', login_identifier: '', password: '', proxy_url: '', daily_upload_limit: 3 })
                    setLoginStatus(null)
                }, 1500)
            } else {
                setLoginStatus('failed')
                toast.error(result.detail || 'Login failed')
                setSaving(false)
            }
        } catch (err) {
            setLoginStatus('failed')
            toast.error(err.message || 'Login failed')
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between sticky top-0 bg-white dark:bg-[#152230] z-10">
                    <h3 className="text-lg font-semibold">Add Social Account</h3>
                    <button onClick={onClose} disabled={saving} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {loginStatus && (
                    <div className={`mx-5 mt-4 p-3 rounded-xl flex items-center gap-3 ${loginStatus === 'logging_in' ? 'bg-blue-50 dark:bg-blue-900/20' :
                        loginStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
                            'bg-red-50 dark:bg-red-900/20'
                        }`}>
                        <span className={`material-symbols-outlined text-[20px] ${loginStatus === 'logging_in' ? 'text-blue-500 animate-spin' :
                            loginStatus === 'success' ? 'text-green-500' : 'text-red-500'
                            }`}>
                            {loginStatus === 'logging_in' ? 'sync' : loginStatus === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span className="text-sm font-medium">
                            {loginStatus === 'logging_in' ? 'Opening browser for login...' :
                                loginStatus === 'success' ? 'Login successful!' : 'Login failed'}
                        </span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Platform Selection */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Platform</label>
                        <div className="grid grid-cols-5 gap-2">
                            {platforms.map(p => (
                                <button key={p.id} type="button"
                                    onClick={() => setForm({ ...form, platform: p.id, login_type: p.supported_login.includes('google') ? 'google' : 'manual' })}
                                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${form.platform === p.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-[#324d67] hover:border-slate-300'
                                        }`}>
                                    <span className={PLATFORM_COLORS[p.id]?.text}>{PlatformIcons[p.id]}</span>
                                    <span className="text-[10px] font-medium truncate w-full text-center">{p.id === 'x' ? 'X' : p.id.charAt(0).toUpperCase() + p.id.slice(1)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Account Name */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Account Name</label>
                        <input type="text" value={form.account_name}
                            onChange={e => setForm({ ...form, account_name: e.target.value })}
                            placeholder="My Channel"
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            required disabled={saving} />
                    </div>

                    {/* Login Type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Login Method</label>
                        <select value={form.login_type}
                            onChange={e => setForm({ ...form, login_type: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            disabled={saving}>
                            {currentPlatform?.supported_login.includes('google') && <option value="google">Google Login (Recommended)</option>}
                            {currentPlatform?.supported_login.includes('manual') && <option value="manual">Manual Login</option>}
                            {currentPlatform?.supported_login.includes('email') && <option value="email">Auto Login with Email</option>}
                            {currentPlatform?.supported_login.includes('phone') && <option value="phone">Auto Login with Phone</option>}
                        </select>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">{isManualLogin ? 'lock_open' : 'warning'}</span>
                            {isManualLogin ? 'Browser opens, you login manually.' : 'Credentials encrypted and stored.'}
                        </p>
                    </div>

                    {/* Credentials for auto-login */}
                    {!isManualLogin && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                    {form.login_type === 'email' ? 'Email' : form.login_type === 'phone' ? 'Phone' : 'Username'}
                                </label>
                                <input type={form.login_type === 'email' ? 'email' : 'text'}
                                    value={form.login_identifier}
                                    onChange={e => setForm({ ...form, login_identifier: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                                    required disabled={saving} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"}
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                                        required disabled={saving} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400">
                                        <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Daily Limit */}
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Daily Upload Limit</label>
                        <input type="number" min="1" max="10" value={form.daily_upload_limit}
                            onChange={e => setForm({ ...form, daily_upload_limit: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] focus:border-primary/50 outline-none"
                            disabled={saving} />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={saving}
                            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 dark:border-[#324d67] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e2e40] disabled:opacity-50">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> Opening...</> : 'Add & Login'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    )
}


// Account Card Component
function AccountCard({ account, onLogin, onDelete, onRefresh, onImportCookies }) {
    const [loggingIn, setLoggingIn] = useState(false)
    const platform = account.platform
    const status = ACCOUNT_STATUS[account.status] || ACCOUNT_STATUS.inactive
    const colors = PLATFORM_COLORS[platform] || PLATFORM_COLORS.tiktok

    const handleLogin = async () => {
        setLoggingIn(true)
        try {
            const result = await api.triggerSocialLogin(account.id, true)
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
        <motion.div whileHover={{ y: -2 }}
            className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center text-white`}>
                        {PlatformIcons[platform]}
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{account.account_name}</h4>
                        <p className="text-xs text-slate-500">
                            {account.platform_username ? `@${account.platform_username}` : account.login_identifier || platform}
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
                {!account.session_valid && (
                    <>
                        <button onClick={handleLogin} disabled={loggingIn}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors disabled:opacity-50">
                            <span className="material-symbols-outlined text-[14px]">{loggingIn ? 'sync' : 'login'}</span>
                            {loggingIn ? 'Logging in...' : 'Login'}
                        </button>
                        <button onClick={() => onImportCookies(account)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[14px]">cookie</span>
                            Import Cookies
                        </button>
                    </>
                )}
                <button onClick={() => onDelete(account.id)}
                    className={`${account.session_valid ? 'flex-1' : ''} px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5`}>
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    {account.session_valid && 'Delete'}
                </button>
            </div>
        </motion.div>
    )
}


// Import Cookies Modal Component
function ImportCookiesModal({ account, onClose, onSuccess }) {
    const [cookiesJson, setCookiesJson] = useState('')
    const [username, setUsername] = useState('')
    const [importing, setImporting] = useState(false)
    const [error, setError] = useState('')

    const handleImport = async () => {
        setError('')

        // Parse cookies JSON
        let cookies
        try {
            cookies = JSON.parse(cookiesJson)
            if (!Array.isArray(cookies)) {
                throw new Error('Cookies must be an array')
            }
        } catch (e) {
            setError('Invalid JSON format. Please paste the exported cookies array.')
            return
        }

        setImporting(true)
        try {
            const result = await api.importSocialCookies(account.id, cookies, username || null)
            if (result.success) {
                toast.success(`Cookies imported successfully! (${result.cookies_count} cookies)`)
                onSuccess()
                onClose()
            } else {
                setError(result.message || 'Failed to import cookies')
            }
        } catch (err) {
            setError(err.message || 'Failed to import cookies')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#152230] rounded-2xl w-full max-w-lg shadow-xl"
            >
                <div className="p-5 border-b border-slate-200 dark:border-[#233648]">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Import Cookies - {account.account_name}
                        </h3>
                        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">How to export cookies:</h4>
                        <ol className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside">
                            <li>Install "Cookie-Editor" extension in Chrome</li>
                            <li>Login to YouTube in your browser</li>
                            <li>Go to youtube.com</li>
                            <li>Click the Cookie-Editor extension icon</li>
                            <li>Click "Export" then "Export as JSON"</li>
                            <li>Paste the JSON below</li>
                        </ol>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            YouTube Channel Name (optional)
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. MyChannel"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#192633] text-slate-900 dark:text-white text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Cookies JSON
                        </label>
                        <textarea
                            value={cookiesJson}
                            onChange={(e) => setCookiesJson(e.target.value)}
                            placeholder='[{"name": "SID", "value": "...", ...}, ...]'
                            rows={8}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#192633] text-slate-900 dark:text-white text-sm font-mono"
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-200 dark:border-[#233648] flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        Cancel
                    </button>
                    <button onClick={handleImport} disabled={importing || !cookiesJson.trim()}
                        className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2">
                        {importing && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
                        {importing ? 'Importing...' : 'Import Cookies'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}


// Main Page Component
function AccountsPage() {
    const [tab, setTab] = useState('accounts')
    const [platformFilter, setPlatformFilter] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [queue, setQueue] = useState([])
    const [platforms, setPlatforms] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [importAccount, setImportAccount] = useState(null)
    const [serviceOnline, setServiceOnline] = useState(false)

    const handleImportCookies = (account) => {
        setImportAccount(account)
        setShowImportModal(true)
    }

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const health = await api.getTikTokHealth()
            setServiceOnline(health?.status === 'healthy')

            if (health?.status === 'healthy') {
                const [platformsData, accountsData, queueData] = await Promise.all([
                    api.getSocialPlatforms(),
                    api.getSocialAccounts(platformFilter),
                    api.getSocialQueue(platformFilter),
                ])
                if (Array.isArray(platformsData)) setPlatforms(platformsData)
                if (Array.isArray(accountsData)) setAccounts(accountsData)
                if (Array.isArray(queueData)) setQueue(queueData)
            }
        } catch (err) {
            console.error('Load data error:', err)
            setServiceOnline(false)
        } finally {
            setLoading(false)
        }
    }, [platformFilter])

    useEffect(() => {
        loadData()
        const interval = setInterval(loadData, 30000)
        return () => clearInterval(interval)
    }, [loadData])

    const handleDeleteAccount = async (id) => {
        if (!confirm('Delete this account?')) return
        await api.deleteSocialAccount(id)
        loadData()
        toast.success('Account deleted')
    }

    const stats = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.status === 'active').length,
        pendingUploads: queue.filter(u => u.status === 'pending').length,
        publishedToday: queue.filter(u => u.status === 'published').length,
    }

    const accountsByPlatform = platforms.map(p => ({
        ...p,
        count: accounts.filter(a => a.platform === p.id).length,
    }))

    if (!serviceOnline && !loading) {
        return (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
                <div className="max-w-4xl mx-auto">
                    <EmptyState type="error" title="Social Service Offline"
                        description="The social media automation service is not running. Start it with 'python main.py' in the autocliper-automate folder." />
                    <div className="mt-4 text-center">
                        <button onClick={loadData}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
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
                            <motion.div key={s.label} whileHover={{ y: -2 }}
                                className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                                    <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                                    <p className="text-xs text-slate-500">{s.label}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </FadeInUp>

                {/* Platform Filter */}
                <FadeInUp delay={0.1}>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        <button onClick={() => setPlatformFilter(null)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${!platformFilter ? 'bg-primary text-white' : 'bg-white dark:bg-[#152230] border border-slate-200 dark:border-[#233648] hover:bg-slate-50 dark:hover:bg-[#1e2e40]'
                                }`}>
                            All Platforms ({accounts.length})
                        </button>
                        {accountsByPlatform.map(p => (
                            <button key={p.id} onClick={() => setPlatformFilter(p.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${platformFilter === p.id ? 'bg-primary text-white' : 'bg-white dark:bg-[#152230] border border-slate-200 dark:border-[#233648] hover:bg-slate-50 dark:hover:bg-[#1e2e40]'
                                    }`}>
                                <span className={platformFilter === p.id ? 'text-white' : PLATFORM_COLORS[p.id]?.text}>{PlatformIcons[p.id]}</span>
                                {p.name} ({p.count})
                            </button>
                        ))}
                    </div>
                </FadeInUp>

                {/* Tabs and Add Button */}
                <FadeInUp delay={0.2}>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2 bg-slate-100 dark:bg-[#192633] rounded-xl p-1">
                            {['accounts', 'queue'].map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-[#152230] shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                        }`}>
                                    {t === 'accounts' ? 'Accounts' : 'Upload Queue'}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Add Account
                        </button>
                    </div>
                </FadeInUp>

                {/* Accounts Grid */}
                {tab === 'accounts' && (
                    <FadeInUp delay={0.3}>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 animate-pulse">
                                        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg mb-3"></div>
                                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                                    </div>
                                ))}
                            </div>
                        ) : accounts.length === 0 ? (
                            <EmptyState type="empty" title="No Accounts" description="Add your first social media account to start uploading." />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {accounts.map(acc => (
                                    <AccountCard key={acc.id} account={acc} onDelete={handleDeleteAccount} onRefresh={loadData} onImportCookies={handleImportCookies} />
                                ))}
                            </div>
                        )}
                    </FadeInUp>
                )}

                {/* Upload Queue */}
                {tab === 'queue' && (
                    <FadeInUp delay={0.3}>
                        {queue.length === 0 ? (
                            <EmptyState type="empty" title="No Uploads" description="Queue a video upload from the Library page." />
                        ) : (
                            <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] divide-y divide-slate-100 dark:divide-[#233648]">
                                {queue.map(u => (
                                    <div key={u.id} className="p-4 flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg ${PLATFORM_COLORS[u.platform]?.bg} flex items-center justify-center text-white`}>
                                            {PlatformIcons[u.platform]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 dark:text-white truncate">{u.title || `Clip #${u.clip_index || 1}`}</p>
                                            <p className="text-xs text-slate-500">{u.account_name} - {u.status}</p>
                                        </div>
                                        {u.platform_url && (
                                            <a href={u.platform_url} target="_blank" rel="noopener noreferrer"
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg">
                                                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </FadeInUp>
                )}
            </div>

            {/* Add Account Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <AddAccountModal isOpen={showAddModal} onClose={() => setShowAddModal(false)}
                        onSave={() => loadData()} platforms={platforms} />
                )}
            </AnimatePresence>

            {/* Import Cookies Modal */}
            {showImportModal && importAccount && (
                <ImportCookiesModal
                    account={importAccount}
                    onClose={() => { setShowImportModal(false); setImportAccount(null); }}
                    onSuccess={loadData}
                />
            )}
        </div>
    )
}

export default AccountsPage
