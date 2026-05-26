import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'react-hot-toast'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CreatePage from './pages/CreatePage'
import ProcessingPage from './pages/ProcessingPage'
import LibraryPage from './pages/LibraryPage'
import StylesPage from './pages/StylesPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import QueuePage from './pages/QueuePage'
import AnalyticsPage from './pages/AnalyticsPage'
import StyleApplyPage from './pages/StyleApplyPage'
import HealthBadge from './components/HealthBadge'
import ThemeToggle from './components/ThemeToggle'
import { PageTransition } from './components/PageTransition'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { api } from './utils/api'

const Logo = () => (
    <div className="size-8 text-primary flex items-center justify-center">
        <span className="material-symbols-outlined text-[28px]">movie_filter</span>
    </div>
)

const navItems = [
    { key: 'dashboard', icon: 'space_dashboard', label: 'Dashboard' },
    { key: 'create', icon: 'add_circle', label: 'Create' },
    { key: 'queue', icon: 'queue', label: 'Queue' },
    { key: 'library', icon: 'video_library', label: 'Library' },
    { key: 'analytics', icon: 'analytics', label: 'Analytics' },
    { key: 'styles', icon: 'palette', label: 'Styles' },
    { key: 'users', icon: 'group', label: 'Users', adminOnly: true },
    { key: 'settings', icon: 'settings', label: 'Settings' },
]

const pageTitles = {
    dashboard: 'Dashboard',
    create: 'Create Clip',
    queue: 'Queue & Progress',
    library: 'Library',
    analytics: 'Analytics',
    styles: 'Styles',
    users: 'Users',
    settings: 'Settings',
    processing: 'Processing',
    'style-apply': 'Apply Style',
}

function SearchBar({ onNavigate }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const inputRef = useRef(null)

    const searchItems = [
        { key: 'dashboard', icon: 'space_dashboard', label: 'Dashboard', keywords: 'home overview stats' },
        { key: 'create', icon: 'add_circle', label: 'Create New Clip', keywords: 'new video youtube url process' },
        { key: 'queue', icon: 'queue', label: 'Queue & Progress', keywords: 'processing pending jobs active' },
        { key: 'library', icon: 'video_library', label: 'Library / History', keywords: 'history output download clips completed' },
        { key: 'analytics', icon: 'analytics', label: 'Analytics', keywords: 'stats performance score engagement' },
        { key: 'styles', icon: 'palette', label: 'Styles & Fonts', keywords: 'caption hook font color theme design' },
        { key: 'users', icon: 'group', label: 'User Management', keywords: 'admin users accounts roles' },
        { key: 'settings', icon: 'settings', label: 'Settings', keywords: 'config profile password pipeline storage' },
    ]

    const filtered = query.trim()
        ? searchItems.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            item.keywords.includes(query.toLowerCase())
        )
        : searchItems

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setOpen(o => !o)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus()
    }, [open])

    return (
        <>
            <button onClick={() => setOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-[#324d67] hover:border-slate-300 dark:hover:border-[#4a6a8a] rounded-xl transition-colors">
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span className="text-xs">Search...</span>
                <kbd className="hidden md:inline text-[10px] font-mono bg-slate-100 dark:bg-[#1e2e40] px-1.5 py-0.5 rounded text-slate-400">⌘K</kbd>
            </button>
            <button onClick={() => setOpen(true)} className="sm:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] transition-colors">
                <span className="material-symbols-outlined text-[20px]">search</span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
                        onClick={() => setOpen(false)}>
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="w-full max-w-md bg-white dark:bg-[#152230] border border-slate-200 dark:border-[#233648] rounded-2xl shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-[#233648]">
                                <span className="material-symbols-outlined text-[20px] text-slate-400">search</span>
                                <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                                    placeholder="Search pages, actions..."
                                    className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none" />
                                <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-[#1e2e40] px-1.5 py-0.5 rounded text-slate-400">ESC</kbd>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2">
                                {filtered.map(item => (
                                    <button key={item.key}
                                        onClick={() => { onNavigate(item.key); setOpen(false); setQuery('') }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-[#1e2e40] transition-colors">
                                        <span className="material-symbols-outlined text-[18px] text-slate-400">{item.icon}</span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                                    </button>
                                ))}
                                {filtered.length === 0 && (
                                    <p className="text-center text-xs text-slate-400 py-6">No results for "{query}"</p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

function Layout({ page, setPage, onLogout, children, activeJobCount = 0, notifications = [], unreadCount = 0, showNotifs, setShowNotifs, markAllRead }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const username = localStorage.getItem('username') || 'User'
    const role = localStorage.getItem('role') || 'user'

    const NOTIF_COLOR = { success: 'text-emerald-500', error: 'text-red-500', info: 'text-blue-500' }

    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
            {/* Mobile overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className={`w-60 flex-shrink-0 bg-white dark:bg-[#152230] border-r border-slate-200 dark:border-[#233648] flex flex-col fixed md:relative inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:flex`}>
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200 dark:border-[#233648]">
                    <Logo />
                    <h1 className="text-lg font-bold tracking-tight">ClipForge</h1>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                    {navItems.filter(item => !item.adminOnly || role === 'admin').map(item => (
                        <motion.a key={item.key} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
                            onClick={() => { setPage(item.key); setSidebarOpen(false) }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors cursor-pointer relative ${page === item.key ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1e2e40]'}`}>
                            {page === item.key && (
                                <motion.div layoutId="nav-pill" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-full"
                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                            )}
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            <span className="flex-1 text-sm">{item.label}</span>
                            {item.key === 'dashboard' && activeJobCount > 0 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center">
                                    {activeJobCount}
                                </motion.span>
                            )}
                        </motion.a>
                    ))}
                </nav>
                <div className="p-3 border-t border-slate-200 dark:border-[#233648]">
                    <motion.div whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer" onClick={onLogout}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{username}</p>
                            <p className="text-[11px] text-slate-400 capitalize">{role}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">logout</span>
                    </motion.div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-14 flex items-center justify-between px-5 md:px-7 border-b border-slate-200 dark:border-[#233648] bg-white dark:bg-[#152230] flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button className="md:hidden p-1.5 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40]" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <span className="material-symbols-outlined text-[22px]">menu</span>
                        </button>
                        <h2 className="text-lg font-semibold">{pageTitles[page] || ''}</h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Search */}
                        <SearchBar onNavigate={setPage} />
                        <HealthBadge />
                        <ThemeToggle />
                        {/* Notifications */}
                        <div className="relative">
                            <button onClick={() => { setShowNotifs(v => !v); markAllRead() }}
                                className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] transition-colors">
                                <span className="material-symbols-outlined text-[20px]">notifications</span>
                                {unreadCount > 0 && (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </motion.span>
                                )}
                            </button>
                            <AnimatePresence>
                                {showNotifs && (
                                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 top-11 w-72 bg-white dark:bg-[#152230] border border-slate-200 dark:border-[#233648] rounded-xl shadow-xl z-50 overflow-hidden">
                                        <div className="p-3 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
                                            <p className="text-sm font-semibold">Notifications</p>
                                            <button onClick={() => setShowNotifs(false)} className="text-slate-400 hover:text-slate-600">
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-[#233648]">
                                            {notifications.length === 0 ? (
                                                <div className="p-5 text-center text-slate-400 text-xs">No notifications</div>
                                            ) : notifications.map(n => (
                                                <div key={n.id} className={`flex gap-2.5 p-3 ${!n.read ? 'bg-primary/[0.02]' : ''}`}>
                                                    <span className={`material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5 ${NOTIF_COLOR[n.type] || 'text-slate-400'}`}>{n.icon}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-slate-900 dark:text-white">{n.text}</p>
                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{n.sub}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>
                <PageTransition pageKey={page}>
                    {children}
                </PageTransition>
            </main>
        </div>
    )
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('access_token'))
    const [page, setPage] = useState(() => localStorage.getItem('last_page') || 'dashboard')
    const [processingJob, setProcessingJob] = useState(null)
    const [prevPage, setPrevPage] = useState('dashboard')
    const [activeJobCount, setActiveJobCount] = useState(0)
    const [notifications, setNotifications] = useState([])
    const [showNotifs, setShowNotifs] = useState(false)
    const [styleApplyJobId, setStyleApplyJobId] = useState(null)
    const prevJobStatuses = useRef({})

    // Theme init
    useEffect(() => {
        const saved = localStorage.getItem('theme')
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark')
        }
    }, [])

    // Poll jobs for notifications
    useEffect(() => {
        if (!isAuthenticated) return
        const check = async () => {
            try {
                const data = await api.getJobs()
                if (!Array.isArray(data)) return
                setActiveJobCount(data.filter(j => !['completed', 'failed'].includes(j.status)).length)
                data.forEach(job => {
                    const prev = prevJobStatuses.current[job.id]
                    if (prev && prev !== job.status) {
                        if (job.status === 'completed') {
                            toast.success('Video processing completed!')
                            setNotifications(n => [{ id: Date.now() + Math.random(), type: 'success', icon: 'check_circle', text: 'Processing completed', sub: job.youtube_url, read: false }, ...n].slice(0, 20))
                        } else if (job.status === 'failed') {
                            toast.error('Processing failed')
                            setNotifications(n => [{ id: Date.now() + Math.random(), type: 'error', icon: 'error', text: 'Processing failed', sub: job.youtube_url, read: false }, ...n].slice(0, 20))
                        }
                    }
                    prevJobStatuses.current[job.id] = job.status
                })
            } catch { /* ignore */ }
        }
        check()
        const t = setInterval(check, 10000)
        return () => clearInterval(t)
    }, [isAuthenticated])

    const unreadCount = notifications.filter(n => !n.read).length
    const markAllRead = () => setNotifications(n => n.map(x => ({ ...x, read: true })))

    const handleLogout = () => {
        api.logout()  // Revoke refresh token on server
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('username')
        localStorage.removeItem('role')
        localStorage.removeItem('last_page')
        setIsAuthenticated(false)
        toast('Logged out', { icon: '\u{1F44B}' })
    }

    const navigateTo = (p) => { setPage(p); localStorage.setItem('last_page', p) }
    useKeyboardShortcuts(navigateTo)

    const handleJobStarted = ({ jobId, videoInfo, url }) => {
        setProcessingJob({ jobId, videoInfo, url })
        setPrevPage('create')
        setPage('processing')
    }

    const handleViewProgress = (job) => {
        setProcessingJob({ jobId: job.id, videoInfo: null, url: job.youtube_url })
        setPrevPage(page)
        setPage('processing')
    }

    const handleApplyStyle = (jobId) => {
        setStyleApplyJobId(jobId)
        setPrevPage(page)
        setPage('style-apply')
    }

    if (!isAuthenticated) {
        return (
            <>
                <Toaster position="top-right" toastOptions={{ className: 'font-display text-sm', style: { borderRadius: '12px', padding: '12px 16px' } }} />
                <LoginPage onLoginSuccess={() => { setIsAuthenticated(true); toast.success('Welcome back!') }} />
            </>
        )
    }

    return (
        <>
            <Toaster position="top-right" toastOptions={{
                className: 'font-display text-sm',
                style: { borderRadius: '12px', padding: '12px 16px', background: 'var(--toast-bg, #fff)', color: 'var(--toast-color, #1e293b)' },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }} />
            <Layout page={page} setPage={navigateTo} onLogout={handleLogout} activeJobCount={activeJobCount}
                notifications={notifications} unreadCount={unreadCount} showNotifs={showNotifs} setShowNotifs={setShowNotifs} markAllRead={markAllRead}>
                {page === 'dashboard' && <DashboardPage onNavigate={navigateTo} onViewProgress={handleViewProgress} />}
                {page === 'create' && <CreatePage onJobStarted={handleJobStarted} />}
                {page === 'queue' && <QueuePage />}
                {page === 'library' && <LibraryPage onViewProgress={handleViewProgress} onApplyStyle={handleApplyStyle} />}
                {page === 'analytics' && <AnalyticsPage />}
                {page === 'styles' && <StylesPage />}
                {page === 'users' && <UsersPage />}
                {page === 'settings' && <SettingsPage />}
                {page === 'processing' && processingJob && (
                    <ProcessingPage jobId={processingJob.jobId} videoInfo={processingJob.videoInfo} videoUrl={processingJob.url}
                        onBack={() => { setProcessingJob(null); navigateTo(prevPage) }}
                        onApplyStyle={(jobId) => handleApplyStyle(jobId)} />
                )}
                {page === 'style-apply' && styleApplyJobId && (
                    <StyleApplyPage jobId={styleApplyJobId}
                        onBack={() => { setStyleApplyJobId(null); navigateTo(prevPage) }}
                        onDone={() => { setStyleApplyJobId(null); navigateTo('library') }} />
                )}
            </Layout>
        </>
    )
}

export default App
