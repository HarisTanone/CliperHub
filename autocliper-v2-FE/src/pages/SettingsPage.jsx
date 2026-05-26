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

    if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

    return (
        <div className="space-y-6">
            {/* Profile card */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-[#192633] rounded-xl border border-slate-200 dark:border-[#324d67]">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{user?.username}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role} -- Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>

            {/* Email */}
            <form onSubmit={handleSaveProfile} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                    className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                {profileError && <p className="text-xs text-red-500">{profileError}</p>}
                <button type="submit" disabled={savingProfile}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-colors">
                    {savingProfile ? 'Saving...' : 'Save'}
                </button>
            </form>

            {/* Password */}
            <div className="pt-4 border-t border-slate-200 dark:border-[#233648]">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Change Password</h4>
                <form onSubmit={handleChangePassword} className="space-y-3">
                    <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Current password"
                        className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                    <div className="grid grid-cols-2 gap-3">
                        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="New password"
                            className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                        <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Confirm"
                            className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                    </div>
                    {passError && <p className="text-xs text-red-500">{passError}</p>}
                    <button type="submit" disabled={changingPass || !currentPass || !newPass}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-colors">
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

    if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
    if (!config) return <p className="text-sm text-slate-400 py-8 text-center">Failed to load configuration</p>

    return (
        <div className="space-y-6">
            {CONFIG_FIELDS.map(section => (
                <div key={section.section}>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{section.section}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {section.fields.map(field => field.type === 'toggle' ? (
                            <label key={field.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#324d67] cursor-pointer">
                                <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
                                <div className="relative">
                                    <input type="checkbox" checked={config[field.key] ?? false} onChange={e => set(field.key, e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer-checked:bg-primary transition-colors" />
                                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
                                </div>
                            </label>
                        ) : (
                            <div key={field.key}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">{field.label}</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">{config[field.key]}{field.unit}</span>
                                </div>
                                <input type="range" min={field.min} max={field.max} step={field.step} value={config[field.key] ?? field.min}
                                    onChange={e => set(field.key, Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 dark:bg-[#324d67] rounded-full appearance-none cursor-pointer accent-primary" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <div className="flex items-center gap-3 pt-2">
                <button onClick={handleSave} disabled={saving || !hasChanges}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${hasChanges ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {hasChanges && (
                    <button onClick={() => setConfig({ ...original })} className="text-xs text-slate-500 hover:text-slate-700">Reset</button>
                )}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
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

    const handleCleanup = async () => {
        setLoading(true); setResult(null)
        try {
            const data = await api.adminCleanup(days)
            if (data.detail) { toast.error(data.detail) } else { setResult(data); toast.success('Cleanup complete') }
        } catch { toast.error('Cleanup failed') }
        finally { setLoading(false) }
    }

    return (
        <div className="space-y-5">
            <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Disk Cleanup</h4>
                <p className="text-xs text-slate-400 mb-4">Remove old output files to free up disk space.</p>
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Delete outputs older than</span>
                    <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))}
                        className="w-20 px-2 py-1.5 border-2 border-slate-200 dark:border-[#324d67] rounded-lg bg-white dark:bg-[#192633] text-sm text-center font-mono focus:border-primary outline-none" />
                    <span className="text-sm text-slate-400">days</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl mb-4">
                    <span className="material-symbols-outlined text-amber-500 text-[16px]">warning</span>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">This action is irreversible.</p>
                </div>
                <button onClick={handleCleanup} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-colors">
                    {loading ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Cleaning...</> :
                        <><span className="material-symbols-outlined text-[16px]">delete_sweep</span>Run Cleanup</>}
                </button>
            </div>
            {result && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">Cleanup Complete</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-2 bg-white dark:bg-[#192633] rounded-lg">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{result.deleted}</p>
                            <p className="text-[10px] text-slate-500">Folders</p>
                        </div>
                        <div className="text-center p-2 bg-white dark:bg-[#192633] rounded-lg">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{(result.freed_mb / 1024).toFixed(2)} GB</p>
                            <p className="text-[10px] text-slate-500">Freed</p>
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
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Tab bar */}
                <div className="flex gap-1 p-1 bg-white dark:bg-[#152230] border border-slate-200 dark:border-[#233648] rounded-xl w-fit shadow-sm">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2e40]'}`}>
                            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <FadeInUp>
                    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-6 shadow-sm">
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
