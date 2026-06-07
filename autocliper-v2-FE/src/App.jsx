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
import TikTokPage from './pages/TikTokPage'
import AccountsPage from './pages/AccountsPage'
import HealthBadge from './components/HealthBadge'
import ThemeToggle from './components/ThemeToggle'
import { PageTransition } from './components/PageTransition'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { api } from './utils/api'

const Logo = () => (
    <motion.div
        className="size-9 rounded-xl flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--crimson-wine), var(--burgundy))' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
    >
        <span className="material-symbols-outlined text-[22px] text-white drop-shadow-sm">movie_filter</span>
        <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
    </motion.div>
)

const navItems = [
    { key: 'dashboard', icon: 'space_dashboard', label: 'Dashboard' },
    { key: 'create', icon: 'add_circle', label: 'Create' },
    { key: 'queue', icon: 'queue', label: 'Queue' },
    { key: 'library', icon: 'video_library', label: 'Library' },
    { key: 'accounts', icon: 'group', label: 'Account List' },
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
    accounts: 'Account List',
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
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef(null)

    const searchItems = [
        { key: 'dashboard', icon: 'space_dashboard', label: 'Dashboard', desc: 'Overview & statistics', gradient: 'from-[var(--crimson-wine)] to-[var(--burgundy)]' },
        { key: 'create', icon: 'add_circle', label: 'Create New Clip', desc: 'Process YouTube video', gradient: 'from-[var(--dark-plum)] to-[var(--burgundy)]', keywords: 'new video youtube url process' },
        { key: 'queue', icon: 'queue', label: 'Queue & Progress', desc: 'View active jobs', gradient: 'from-[var(--deep-indigo)] to-[var(--dark-plum)]', keywords: 'processing pending jobs active' },
        { key: 'library', icon: 'video_library', label: 'Library / History', desc: 'Browse completed clips', gradient: 'from-[var(--burgundy)] to-[var(--crimson-wine)]', keywords: 'history output download clips completed' },
        { key: 'accounts', icon: 'group', label: 'Account List', desc: 'Manage social accounts', gradient: 'from-[var(--crimson-wine)] to-[var(--dark-plum)]', keywords: 'tiktok youtube facebook instagram x upload post schedule accounts social' },
        { key: 'analytics', icon: 'analytics', label: 'Analytics', desc: 'Performance insights', gradient: 'from-[var(--dark-navy)] to-[var(--deep-indigo)]', keywords: 'stats performance score engagement' },
        { key: 'styles', icon: 'palette', label: 'Styles & Fonts', desc: 'Customize captions', gradient: 'from-[var(--dark-plum)] to-[var(--crimson-wine)]', keywords: 'caption hook font color theme design' },
        { key: 'users', icon: 'manage_accounts', label: 'User Management', desc: 'Admin controls', gradient: 'from-[var(--deep-indigo)] to-[var(--dark-navy)]', keywords: 'admin users accounts roles' },
        { key: 'settings', icon: 'settings', label: 'Settings', desc: 'App configuration', gradient: 'from-[var(--burgundy)] to-[var(--deep-indigo)]', keywords: 'config profile password pipeline storage' },
    ]

    const filtered = query.trim()
        ? searchItems.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            item.desc.toLowerCase().includes(query.toLowerCase()) ||
            (item.keywords && item.keywords.includes(query.toLowerCase()))
        )
        : searchItems

    useEffect(() => {
        setSelectedIndex(0)
    }, [query])

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

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(i => (i + 1) % filtered.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
        } else if (e.key === 'Enter' && filtered.length > 0) {
            e.preventDefault()
            onNavigate(filtered[selectedIndex].key)
            setOpen(false)
            setQuery('')
        }
    }

    return (
        <>
            <button onClick={() => setOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] rounded-xl transition-colors cursor-pointer"
                style={{ color: 'var(--color-text-muted)' }}>
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span className="text-xs">Search...</span>
                <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>⌘K</kbd>
            </button>
            <button onClick={() => setOpen(true)} className="sm:hidden p-2 rounded-lg transition-colors cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="material-symbols-outlined text-[20px]">search</span>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-start justify-center pt-[12vh]"
                        onClick={() => setOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                            style={{
                                background: 'var(--color-bg-modal)',
                                border: '1px solid var(--color-border-default)'
                            }}
                            onClick={e => e.stopPropagation()}>

                            {/* Search Input */}
                            <div className="p-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <div
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                                    style={{
                                        background: 'var(--color-surface-1)',
                                        border: '1px solid var(--color-border-default)'
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>search</span>
                                    <input
                                        ref={inputRef}
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Search pages, actions..."
                                        className="flex-1 bg-transparent text-sm outline-none"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    />
                                    <kbd
                                        className="text-[10px] font-mono px-2 py-1 rounded-md shadow-sm"
                                        style={{
                                            background: 'var(--color-bg-card)',
                                            color: 'var(--color-text-muted)',
                                            border: '1px solid var(--color-border-default)'
                                        }}
                                    >ESC</kbd>
                                </div>
                            </div>

                            {/* Results */}
                            <div className="max-h-[360px] overflow-y-auto p-3">
                                <div className="space-y-1">
                                    {filtered.map((item, index) => (
                                        <motion.button
                                            key={item.key}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => { onNavigate(item.key); setOpen(false); setQuery('') }}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all group ${selectedIndex === index
                                                ? 'border'
                                                : 'border border-transparent'
                                                }`}
                                            style={{
                                                background: selectedIndex === index
                                                    ? 'var(--color-accent-subtle)'
                                                    : 'transparent',
                                                borderColor: selectedIndex === index
                                                    ? 'var(--color-accent-border)'
                                                    : 'transparent'
                                            }}
                                            onMouseEnter={(e) => {
                                                setSelectedIndex(index)
                                                if (selectedIndex !== index) {
                                                    e.currentTarget.style.background = 'var(--color-surface-1)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedIndex !== index) {
                                                    e.currentTarget.style.background = 'transparent'
                                                }
                                            }}
                                        >
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all`}>
                                                <span className="material-symbols-outlined text-[20px] text-white">{item.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className="text-sm font-semibold"
                                                    style={{ color: selectedIndex === index ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                                                >
                                                    {item.label}
                                                </p>
                                                <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</p>
                                            </div>
                                            <span
                                                className={`material-symbols-outlined text-[18px] transition-all ${selectedIndex === index
                                                    ? 'opacity-100 translate-x-0'
                                                    : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                                                    }`}
                                                style={{ color: selectedIndex === index ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                                            >
                                                arrow_forward
                                            </span>
                                        </motion.button>
                                    ))}
                                </div>
                                {filtered.length === 0 && (
                                    <div className="text-center py-10">
                                        <span className="material-symbols-outlined text-4xl mb-2" style={{ color: 'var(--color-text-muted)' }}>search_off</span>
                                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No results for "{query}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer hints */}
                            <div
                                className="px-4 py-3 flex items-center justify-between"
                                style={{
                                    borderTop: '1px solid var(--color-border-subtle)',
                                    background: 'var(--color-surface-1)'
                                }}
                            >
                                <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                    <span className="flex items-center gap-1">
                                        <kbd
                                            className="px-1.5 py-0.5 rounded font-mono"
                                            style={{
                                                background: 'var(--color-bg-card)',
                                                border: '1px solid var(--color-border-default)'
                                            }}
                                        >↑</kbd>
                                        <kbd
                                            className="px-1.5 py-0.5 rounded font-mono"
                                            style={{
                                                background: 'var(--color-bg-card)',
                                                border: '1px solid var(--color-border-default)'
                                            }}
                                        >↓</kbd>
                                        <span className="ml-1">Navigate</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd
                                            className="px-1.5 py-0.5 rounded font-mono"
                                            style={{
                                                background: 'var(--color-bg-card)',
                                                border: '1px solid var(--color-border-default)'
                                            }}
                                        >↵</kbd>
                                        <span className="ml-1">Select</span>
                                    </span>
                                </div>
                                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar_collapsed')
        return saved === 'true'
    })
    const username = localStorage.getItem('username') || 'User'
    const role = localStorage.getItem('role') || 'user'

    const toggleSidebar = () => {
        const next = !sidebarCollapsed
        setSidebarCollapsed(next)
        localStorage.setItem('sidebar_collapsed', String(next))
    }

    const NOTIF_COLOR = { success: 'text-emerald-500', error: 'text-red-500', info: 'text-blue-500' }

    return (
        <div className="flex h-screen overflow-hidden font-display" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
            {/* Mobile overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                animate={{ width: sidebarCollapsed ? 68 : 240 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex-shrink-0 flex flex-col fixed md:relative inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:flex overflow-hidden`}
                style={{ background: 'var(--color-bg-card)', borderRight: '1px solid var(--color-border-subtle)' }}>

                {/* Logo */}
                <div className="flex items-center gap-2.5 px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <Logo />
                    <AnimatePresence>
                        {!sidebarCollapsed && (
                            <motion.h1
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.15 }}
                                className="text-lg font-bold tracking-tight gradient-text whitespace-nowrap">
                                ClipForge
                            </motion.h1>
                        )}
                    </AnimatePresence>
                </div>

                {/* Collapse button */}
                <div className="px-3 pt-3 flex-shrink-0 hidden md:block">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleSidebar}
                        className="w-full flex items-center justify-center p-1.5 rounded-lg transition-colors cursor-pointer"
                        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}
                    >
                        <motion.span
                            animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
                            transition={{ duration: 0.25 }}
                            className="material-symbols-outlined text-[16px]"
                            style={{ color: 'var(--icon-muted)' }}>
                            chevron_left
                        </motion.span>
                    </motion.button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
                    {navItems.filter(item => !item.adminOnly || role === 'admin').map(item => (
                        <motion.a key={item.key} whileHover={{ x: sidebarCollapsed ? 0 : 2 }} whileTap={{ scale: 0.98 }}
                            onClick={() => { setPage(item.key); setSidebarOpen(false) }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all cursor-pointer relative ${page === item.key ? '' : 'hover:bg-[var(--color-surface-1)]'}`}
                            style={{
                                background: page === item.key ? 'var(--color-accent-subtle)' : 'transparent',
                                color: page === item.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
                            }}
                            title={sidebarCollapsed ? item.label : undefined}>
                            {page === item.key && (
                                <motion.div layoutId="nav-pill" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                                    style={{ background: 'var(--color-accent)' }}
                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                            )}
                            <span className="material-symbols-outlined text-[20px] flex-shrink-0" style={{ color: page === item.key ? 'var(--icon-accent)' : 'var(--icon-muted)' }}>{item.icon}</span>
                            <AnimatePresence>
                                {!sidebarCollapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        exit={{ opacity: 0, width: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex-1 text-sm whitespace-nowrap overflow-hidden">
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {item.key === 'dashboard' && activeJobCount > 0 && !sidebarCollapsed && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                                    style={{ background: 'var(--color-warning-text)' }}>
                                    {activeJobCount}
                                </motion.span>
                            )}
                        </motion.a>
                    ))}
                </nav>

                {/* User Profile */}
                <div className="p-2.5 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <motion.div whileHover={{ scale: 1.02 }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all hover:bg-[var(--color-surface-1)] ${sidebarCollapsed ? 'justify-center' : ''}`} onClick={onLogout}
                        title={sidebarCollapsed ? `${username} — Logout` : undefined}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                            style={{ background: 'var(--color-accent)', color: 'white' }}>
                            {username[0].toUpperCase()}
                        </div>
                        <AnimatePresence>
                            {!sidebarCollapsed && (
                                <motion.div
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex-1 min-w-0 overflow-hidden">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{username}</p>
                                    <p className="text-[11px] capitalize" style={{ color: 'var(--color-text-muted)' }}>{role}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {!sidebarCollapsed && (
                            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--icon-muted)' }}>logout</span>
                        )}
                    </motion.div>
                </div>
            </motion.aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-14 flex items-center justify-between px-5 md:px-7 flex-shrink-0"
                    style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <div className="flex items-center gap-3">
                        <button className="md:hidden p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-1)]"
                            style={{ color: 'var(--color-text-secondary)' }}
                            onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <span className="material-symbols-outlined text-[22px]">menu</span>
                        </button>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{pageTitles[page] || ''}</h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Search */}
                        <SearchBar onNavigate={setPage} />
                        <HealthBadge />
                        <ThemeToggle />
                        {/* Notifications */}
                        <div className="relative">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => { setShowNotifs(v => !v); markAllRead() }}
                                className="relative p-2 rounded-lg transition-colors cursor-pointer"
                                style={{ color: 'var(--icon-secondary)' }}>
                                <span className="material-symbols-outlined text-[20px]">notifications</span>
                                {unreadCount > 0 && (
                                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        className="absolute top-1 right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                                        style={{ background: 'var(--color-error-text)' }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </motion.span>
                                )}
                            </motion.button>
                            <AnimatePresence>
                                {showNotifs && (
                                    <motion.div initial={{ opacity: 0, y: -6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 top-11 w-72 rounded-xl shadow-xl z-50 overflow-hidden"
                                        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}>
                                        <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notifications</p>
                                            <button onClick={() => setShowNotifs(false)} className="cursor-pointer" style={{ color: 'var(--icon-muted)' }}>
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-5 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>No notifications</div>
                                            ) : notifications.map(n => (
                                                <div key={n.id} className="flex gap-2.5 p-3"
                                                    style={{
                                                        borderBottom: '1px solid var(--color-border-subtle)',
                                                        background: !n.read ? 'var(--color-accent-subtle)' : 'transparent'
                                                    }}>
                                                    <span className={`material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5 ${NOTIF_COLOR[n.type] || ''}`}
                                                        style={{ color: NOTIF_COLOR[n.type] ? undefined : 'var(--icon-muted)' }}>{n.icon}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{n.text}</p>
                                                        <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{n.sub}</p>
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
        toast('Logged out', { icon: <span className="material-symbols-outlined text-lg">waving_hand</span> })
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
                {page === 'accounts' && <AccountsPage />}
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
