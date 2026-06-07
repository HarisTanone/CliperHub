import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'
import { FadeInUp } from '../components/PageTransition'

const CONFIG_FIELDS = [
    {
        section: 'Hook Duration', fields: [
            { key: 'hook_duration_min', label: 'Min Duration', unit: 's', min: 0.5, max: 10, step: 0.1 },
            { key: 'hook_duration_max', label: 'Max Duration', unit: 's', min: 1, max: 15, step: 0.1 },
            { key: 'hook_reading_speed', label: 'Reading Speed', unit: 'w/s', min: 1, max: 8, step: 0.1 },
            { key: 'hook_padding', label: 'Padding', unit: 's', min: 0, max: 3, step: 0.1 },
        ]
    },
    {
        section: 'Output', fields: [
            { key: 'parallel_clips', label: 'Parallel Clips', type: 'toggle' },
            { key: 'audio_normalize', label: 'Audio Normalize', type: 'toggle' },
            { key: 'smart_thumbnail', label: 'Smart Thumbnail', type: 'toggle' },
            { key: 'words_per_chunk', label: 'Words per Chunk', unit: '', min: 1, max: 10, step: 1 },
        ]
    },
]

function ProfileTab() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [currentPass, setCurrentPass] = useState('')
    const [newPass, setNewPass] = useState('')
    const [confirmPass, setConfirmPass] = useState('')
    const [passError, setPassError] = useState('')
    const [changingPass, setChangingPass] = useState(false)
    const [email, setEmail] = useState('')
    const [profileError, setProfileError] = useState('')
    const [savingProfile, setSavingProfile] = useState(false)

    useEffect(() => {
        api.getMe().then(data => {
            if (data.id) { setUser(data); setEmail(data.email || '') }
        }).catch(() => { }).finally(() => setLoading(false))
    }, [])


    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPassError('')
        if (newPass.length < 6) { setPassError('Minimum 6 characters'); return }
        if (newPass !== confirmPass) { setPassError('Passwords do not match'); return }
        setChangingPass(true)
        try {
            const res = await api.changePassword(currentPass, newPass)
            if (res.detail) { setPassError(res.detail) } else {
                toast.success('Password changed successfully')
                setCurrentPass(''); setNewPass(''); setConfirmPass('')
            }
        } catch { setPassError('Failed to change password') }
        finally { setChangingPass(false) }
    }

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        setProfileError('')
        setSavingProfile(true)
        try {
            const res = await api.updateProfile({ email: email || null })
            if (res.detail) { setProfileError(res.detail) } else { toast.success('Profile updated') }
        } catch { setProfileError('Failed to save') }
        finally { setSavingProfile(false) }
    }

    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Profile card */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg"
                    style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{user?.username}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                        {user?.role} -- Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                </div>
            </div>

            {/* Email */}
            <form onSubmit={handleSaveProfile} className="space-y-3">
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                    style={{ background: 'var(--color-bg-input)', border: '2px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                {profileError && <p className="text-xs" style={{ color: 'var(--color-error-text)' }}>{profileError}</p>}
                <button type="submit" disabled={savingProfile}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
                    {savingProfile ? 'Saving...' : 'Save'}
                </button>
            </form>


            {/* Password */}
            <div className="pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>Change Password</h4>
                <form onSubmit={handleChangePassword} className="space-y-3">
                    <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Current password"
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                        style={{ background: 'var(--color-bg-input)', border: '2px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password"
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                            style={{ background: 'var(--color-bg-input)', border: '2px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                        <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Confirm"
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                            style={{ background: 'var(--color-bg-input)', border: '2px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                    </div>
                    {passError && <p className="text-xs" style={{ color: 'var(--color-error-text)' }}>{passError}</p>}
                    <button type="submit" disabled={changingPass || !currentPass || !newPass}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
                        {changingPass ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </div>
    )
}

function PipelineTab() {
    const [config, setConfig] = useState(null)
    const [original, setOriginal] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.getAdminConfig().then(data => {
            if (!data.detail) { setConfig(data); setOriginal(data) }
        }).catch(() => { }).finally(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const changes = {}
            for (const [key, val] of Object.entries(config)) { if (val !== original[key]) changes[key] = val }
            if (Object.keys(changes).length === 0) { toast.success('No changes'); setSaving(false); return }
            const data = await api.updateAdminConfig(changes)
            if (data.detail) { toast.error(data.detail) } else { setOriginal(config); toast.success('Config saved') }
        } catch { toast.error('Failed to save') }
        finally { setSaving(false) }
    }

    const set = (key, val) => setConfig(c => ({ ...c, [key]: val }))
    const hasChanges = config && original && JSON.stringify(config) !== JSON.stringify(original)

    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
    )
    if (!config) return <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Failed to load configuration</p>


    return (
        <div className="space-y-6">
            {CONFIG_FIELDS.map(section => (
                <div key={section.section}>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>{section.section}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {section.fields.map(field => field.type === 'toggle' ? (
                            <label key={field.key} className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
                                style={{ border: '1px solid var(--color-border-default)' }}>
                                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{field.label}</span>
                                <div className="relative">
                                    <input type="checkbox" checked={config[field.key] ?? false} onChange={e => set(field.key, e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 rounded-full transition-colors" style={{ background: config[field.key] ? 'var(--color-accent)' : 'var(--color-border-default)' }} />
                                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: config[field.key] ? 'translateX(16px)' : 'translateX(0)' }} />
                                </div>
                            </label>
                        ) : (
                            <div key={field.key}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span style={{ color: 'var(--color-text-muted)' }}>{field.label}</span>
                                    <span className="font-mono" style={{ color: 'var(--color-text-secondary)' }}>{config[field.key]}{field.unit}</span>
                                </div>
                                <input type="range" min={field.min} max={field.max} step={field.step} value={config[field.key] ?? field.min}
                                    onChange={e => set(field.key, Number(e.target.value))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{ background: 'var(--color-border-default)', accentColor: 'var(--color-accent)' }} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <div className="flex items-center gap-3 pt-2">
                <button onClick={handleSave} disabled={saving || !hasChanges}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: hasChanges ? 'var(--btn-primary-bg)' : 'var(--color-border-default)',
                        color: hasChanges ? 'var(--btn-primary-text)' : 'var(--color-text-muted)'
                    }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {hasChanges && (
                    <button onClick={() => setConfig({ ...original })} className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>Reset</button>
                )}
            </div>
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <span className="material-symbols-outlined text-[13px]">info</span>
                Changes apply to next job only. Not persisted after server restart.
            </p>
        </div>
    )
}


function StorageTab() {
    const [days, setDays] = useState(30)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [clearLoading, setClearLoading] = useState(false)
    const [clearResult, setClearResult] = useState(null)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [confirmText, setConfirmText] = useState('')

    const handleCleanup = async () => {
        setLoading(true); setResult(null)
        try {
            const data = await api.adminCleanup(days)
            if (data.detail) { toast.error(data.detail) } else { setResult(data); toast.success('Cleanup complete') }
        } catch { toast.error('Cleanup failed') }
        finally { setLoading(false) }
    }

    const handleClearAllData = async () => {
        if (confirmText !== 'DELETE ALL') return
        setClearLoading(true); setClearResult(null)
        try {
            const data = await api.adminClearAllData()
            if (data.detail) { toast.error(data.detail) } else { setClearResult(data); toast.success('All data cleared successfully') }
        } catch { toast.error('Clear data failed') }
        finally { setClearLoading(false); setShowClearConfirm(false); setConfirmText('') }
    }

    return (
        <div className="space-y-5">
            <div>
                <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Disk Cleanup</h4>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Remove old output files to free up disk space.</p>
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Delete outputs older than</span>
                    <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))}
                        className="w-20 px-2 py-1.5 rounded-lg text-sm text-center font-mono outline-none"
                        style={{ background: 'var(--color-bg-input)', border: '2px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>days</span>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)' }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-warning-text)' }}>warning</span>
                    <p className="text-[11px]" style={{ color: 'var(--color-warning-text)' }}>This action is irreversible.</p>
                </div>
                <button onClick={handleCleanup} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--btn-danger-bg)', color: 'var(--btn-danger-text)' }}>
                    {loading ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Cleaning...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                            Run Cleanup
                        </>
                    )}
                </button>
            </div>
            {result && (
                <div className="p-4 rounded-xl" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-success-text)' }}>Cleanup Complete</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-card)' }}>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{result.deleted}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Folders</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-card)' }}>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{(result.freed_mb / 1024).toFixed(2)} GB</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Freed</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Clear All Data (Danger Zone) ─── */}
            <div className="pt-5 mt-5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <h4 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--color-error-text)' }}>
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    Danger Zone — Clear All Data
                </h4>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    Removes all non-essential data: history, queue, cache, Redis, sessions, social accounts, all output files (clips, original videos, thumbnails), and tmp files.
                    <br />Tables preserved: <strong>users, caption_styles, caption_templates, fonts, hook_styles, browser_fingerprints</strong>
                </p>

                <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[20px] mt-0.5" style={{ color: 'var(--color-error-text)' }}>error</span>
                        <div>
                            <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--color-error-text)' }}>
                                <span className="material-symbols-outlined text-[14px]">priority_high</span>
                                WARNING
                            </p>
                            <ul className="text-[11px] space-y-0.5 list-disc pl-3" style={{ color: 'var(--color-text-secondary)' }}>
                                <li>All video files (original, clips, thumbnails) will be permanently deleted</li>
                                <li>All processing history and upload records will be lost</li>
                                <li>Redis queue and cache will be flushed</li>
                                <li>All social accounts, sessions, and upload queue will be removed</li>
                                <li>This action <strong>CANNOT BE UNDONE</strong></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <button onClick={() => setShowClearConfirm(true)} disabled={clearLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    style={{ background: 'var(--btn-danger-bg)', color: 'var(--btn-danger-text)' }}>
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                    Clear All Data
                </button>
            </div>

            {/* Clear result */}
            {clearResult && (
                <div className="p-4 rounded-xl" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)' }}>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-success-text)' }}>
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Clear All Data Complete
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-card)' }}>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{clearResult.database?.tables_cleared?.length || 0}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Tables Cleared</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-card)' }}>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{clearResult.files?.directories_deleted || 0}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Dirs Deleted</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--color-bg-card)' }}>
                            <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{((clearResult.files?.freed_mb || 0) / 1024).toFixed(2)} GB</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Freed</p>
                        </div>
                    </div>
                    {clearResult.redis?.flushed && (
                        <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: 'var(--color-success-text)' }}>
                            <span className="material-symbols-outlined text-[12px]">check</span>
                            Redis cache flushed
                        </p>
                    )}
                </div>
            )}

            {/* Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                                <span className="material-symbols-outlined text-[24px]" style={{ color: 'var(--color-error-text)' }}>delete_forever</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Confirm Clear All Data</h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                All history, queue, sessions, social accounts, video files, clips, thumbnails, and Redis cache will be <strong>PERMANENTLY DELETED</strong>.
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                Type <strong className="font-mono" style={{ color: 'var(--color-error-text)' }}>DELETE ALL</strong> to confirm:
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                placeholder="DELETE ALL"
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                                style={{ background: 'var(--color-bg-input)', border: '2px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleClearAllData}
                                disabled={confirmText !== 'DELETE ALL' || clearLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: confirmText === 'DELETE ALL' ? 'var(--btn-danger-bg)' : 'var(--color-border-default)', color: confirmText === 'DELETE ALL' ? 'var(--btn-danger-text)' : 'var(--color-text-muted)' }}>
                                {clearLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                                        Clear All Data
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => { setShowClearConfirm(false); setConfirmText('') }}
                                className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors"
                                style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


// --- Main Settings ---

function SettingsPage() {
    const [tab, setTab] = useState('profile')
    const role = localStorage.getItem('role')
    const isAdmin = role === 'admin'

    const tabs = [
        { key: 'profile', label: 'Profile', icon: 'person' },
        ...(isAdmin ? [
            { key: 'pipeline', label: 'Pipeline', icon: 'tune' },
            { key: 'storage', label: 'Storage', icon: 'storage' },
        ] : []),
    ]

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Tab bar */}
                <div className="flex gap-1 p-1 rounded-xl w-fit shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                            style={{
                                background: tab === t.key ? 'var(--btn-primary-bg)' : 'transparent',
                                color: tab === t.key ? 'var(--btn-primary-text)' : 'var(--color-text-muted)'
                            }}>
                            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <FadeInUp>
                    <div className="rounded-2xl p-6 shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                        {tab === 'profile' && <ProfileTab />}
                        {tab === 'pipeline' && <PipelineTab />}
                        {tab === 'storage' && <StorageTab />}
                    </div>
                </FadeInUp>
            </div>
        </div>
    )
}

export default SettingsPage
