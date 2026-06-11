import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import toast from 'react-hot-toast'
import { api } from '../utils/api'
import KeyframePreview from '../components/KeyframePreview'

// ═══════════════════════════════════════════════════════════════
// KEYFRAME STYLES PAGE — Unified style management with
// Compositions, Caption Templates, and Hook Templates tabs.
// ═══════════════════════════════════════════════════════════════

const TABS = [
    { key: 'compositions', label: 'Compositions', icon: 'layers' },
    { key: 'captions', label: 'Caption Templates', icon: 'subtitles' },
    { key: 'hooks', label: 'Hook Templates', icon: 'format_quote' },
]

const CATEGORIES = ['all', 'general', 'viral', 'professional', 'cinematic', 'minimal', 'playful']
const STYLE_TYPES = ['all', 'animated', 'static']

const categoryConfig = {
    viral: { color: 'var(--color-error-text)', bg: 'var(--color-error-bg)', border: 'var(--color-error-border)', icon: 'local_fire_department' },
    professional: { color: 'var(--color-info-text)', bg: 'var(--color-info-bg)', border: 'var(--color-info-border)', icon: 'business_center' },
    cinematic: { color: 'var(--color-warning-text)', bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)', icon: 'movie' },
    minimal: { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-1)', border: 'var(--color-border-default)', icon: 'remove' },
    playful: { color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.25)', icon: 'mood' },
    general: { color: 'var(--color-text-muted)', bg: 'var(--color-surface-1)', border: 'var(--color-border-subtle)', icon: 'category' },
}

// ─── Category Badge ─────────────────────────────────────────────────────────
function CategoryBadge({ category }) {
    const cfg = categoryConfig[category] || categoryConfig.general
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
            <span className="material-symbols-outlined text-[10px]">{cfg.icon}</span>
            {category}
        </span>
    )
}

// ─── Style Type Badge ───────────────────────────────────────────────────────
function StyleTypeBadge({ styleType }) {
    const isAnimated = styleType === 'animated'
    return (
        <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
            style={{
                color: isAnimated ? 'var(--color-accent)' : 'var(--color-text-muted)',
                background: isAnimated ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)',
                border: `1px solid ${isAnimated ? 'var(--color-accent-border)' : 'var(--color-border-subtle)'}`,
            }}
        >
            <span className="material-symbols-outlined text-[9px]">{isAnimated ? 'animation' : 'image'}</span>
            {styleType}
        </span>
    )
}

// ─── Skeleton Card ──────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}>
            <motion.div
                className="aspect-[9/11] w-full"
                style={{
                    background: 'linear-gradient(90deg, var(--color-border-subtle) 25%, var(--color-surface-1) 50%, var(--color-border-subtle) 75%)',
                    backgroundSize: '400px 100%',
                }}
                animate={{ backgroundPosition: ['-400px 0', '400px 0'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="p-3 space-y-2">
                <motion.div
                    className="h-4 w-2/3 rounded"
                    style={{ background: 'linear-gradient(90deg, var(--color-border-subtle) 25%, var(--color-surface-1) 50%, var(--color-border-subtle) 75%)', backgroundSize: '400px 100%' }}
                    animate={{ backgroundPosition: ['-400px 0', '400px 0'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="h-3 w-1/2 rounded"
                    style={{ background: 'linear-gradient(90deg, var(--color-border-subtle) 25%, var(--color-surface-1) 50%, var(--color-border-subtle) 75%)', backgroundSize: '400px 100%' }}
                    animate={{ backgroundPosition: ['-400px 0', '400px 0'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>
        </div>
    )
}

// ─── Delete Confirmation Modal ──────────────────────────────────────────────
function DeleteModal({ item, onConfirm, onCancel }) {
    if (!item) return null
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
                style={{ background: 'var(--color-bg-modal)', border: '1px solid var(--color-border-default)' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-error-bg)' }}>
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-error-text)' }}>delete</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Delete Style</h3>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This action can be undone by admin</p>
                    </div>
                </div>
                <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                    Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>{item.name}</strong>?
                    The style will be hidden but existing clips using it will not be affected.
                </p>
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        style={{ background: 'var(--color-error-text)', color: 'white' }}
                    >
                        Delete
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Style Card ─────────────────────────────────────────────────────────────
function StyleCard({ item, type, index, onEdit, onCustomize, onDelete, templateLookup }) {
    const [hovered, setHovered] = useState(false)
    const isPreset = item.user_id === null

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="relative rounded-2xl overflow-hidden transition-all group"
            style={{
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-card)',
                boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                transform: hovered ? 'translateY(-2px)' : 'none',
            }}
        >
            {/* Preview Area */}
            <div
                className="aspect-[9/11] flex items-center justify-center overflow-hidden relative"
                style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.9) 0%, rgba(20,10,30,0.95) 100%)' }}
            >
                {/* Animated background gradient */}
                <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at 50% 80%, ${type === 'captions' ? 'rgba(201,74,110,0.15)' : 'rgba(129,140,248,0.15)'} 0%, transparent 60%)`,
                    }}
                    animate={hovered ? { opacity: 1 } : { opacity: 0.4 }}
                />

                {/* KeyframePreview on hover */}
                {hovered && type !== 'compositions' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <KeyframePreview
                            template={item}
                            type={type === 'captions' ? 'caption' : 'hook'}
                            text={type === 'hooks' ? 'Sample\nHook Text' : undefined}
                            words={type === 'captions' ? ['This', 'is', 'a', 'sample'] : undefined}
                        />
                    </div>
                )}

                {/* Static preview when not hovered */}
                {(!hovered || type === 'compositions') && (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
                        <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                            {type === 'compositions' ? 'layers' : type === 'captions' ? 'subtitles' : 'format_quote'}
                        </span>
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
                            {hovered ? '' : 'Hover to preview'}
                        </span>
                    </div>
                )}

                {/* Preset badge */}
                {isPreset && (
                    <div className="absolute top-2 left-2 z-20">
                        <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase"
                            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(4px)' }}
                        >
                            <span className="material-symbols-outlined text-[8px]">verified</span>
                            Preset
                        </span>
                    </div>
                )}

                {/* Action buttons overlay on hover */}
                <AnimatePresence>
                    {hovered && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute bottom-2 right-2 z-20 flex items-center gap-1"
                        >
                            {isPreset ? (
                                <button
                                    onClick={e => { e.stopPropagation(); onCustomize(item) }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors"
                                    style={{ background: 'var(--btn-primary-bg)', color: 'white', backdropFilter: 'blur(4px)' }}
                                    title="Duplicate to your account"
                                >
                                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                    Customize
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={e => { e.stopPropagation(); onEdit(item) }}
                                        className="p-1.5 rounded-lg cursor-pointer transition-colors"
                                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(4px)' }}
                                        title="Edit"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                    </button>
                                    <button
                                        onClick={e => { e.stopPropagation(); onDelete(item) }}
                                        className="p-1.5 rounded-lg cursor-pointer transition-colors"
                                        style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5', backdropFilter: 'blur(4px)' }}
                                        title="Delete"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Card Info */}
            <div className="p-3 space-y-1.5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>
                        {item.name}
                    </span>
                    {item.is_default && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}>
                            DEFAULT
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <CategoryBadge category={item.category} />
                    {item.style_type && <StyleTypeBadge styleType={item.style_type} />}
                </div>
                {item.description && (
                    <p className="text-[10px] line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        {item.description}
                    </p>
                )}
                {type === 'compositions' && (
                    <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                            <span className="material-symbols-outlined text-[11px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
                            {item.caption_template?.name || templateLookup?.caption?.[item.caption_template_id] || '—'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                            <span className="material-symbols-outlined text-[11px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
                            {item.hook_template?.name || templateLookup?.hook?.[item.hook_template_id] || '—'}
                        </div>
                        {item.use_count > 0 && (
                            <div className="ml-auto flex items-center gap-0.5 text-[10px] font-medium" style={{ color: 'var(--color-success-text)' }}>
                                <span className="material-symbols-outlined text-[10px]">trending_up</span>
                                {item.use_count}×
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function KeyframeStylesPage() {
    const [activeTab, setActiveTab] = useState('compositions')
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [styleTypeFilter, setStyleTypeFilter] = useState('all')
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [templateLookup, setTemplateLookup] = useState({ caption: {}, hook: {} })
    const searchDebounceRef = useRef(null)
    const PER_PAGE = 20

    // Load template names for composition display
    useEffect(() => {
        async function loadTemplateLookup() {
            try {
                const [captionsRes, hooksRes] = await Promise.all([
                    api._req('/api/v1/caption-templates?per_page=100'),
                    api._req('/api/v1/hook-templates?per_page=100'),
                ])
                const captions = captionsRes?.data || captionsRes?.items || (Array.isArray(captionsRes) ? captionsRes : [])
                const hooks = hooksRes?.data || hooksRes?.items || (Array.isArray(hooksRes) ? hooksRes : [])
                const captionMap = {}
                const hookMap = {}
                captions.forEach(t => { captionMap[t.id] = t.name })
                hooks.forEach(t => { hookMap[t.id] = t.name })
                setTemplateLookup({ caption: captionMap, hook: hookMap })
            } catch { /* ignore */ }
        }
        loadTemplateLookup()
    }, [])

    // ─── Fetch Data ─────────────────────────────────────────────────────────
    const fetchData = useCallback(async (tab, pageNum = 1) => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (categoryFilter !== 'all') params.set('category', categoryFilter)
            if (styleTypeFilter !== 'all' && tab !== 'compositions') params.set('style_type', styleTypeFilter)
            params.set('page', pageNum)
            params.set('per_page', PER_PAGE)
            params.set('is_active', 'true')

            let endpoint = ''
            switch (tab) {
                case 'compositions':
                    endpoint = '/api/v1/style-compositions'
                    break
                case 'captions':
                    endpoint = '/api/v1/caption-templates'
                    break
                case 'hooks':
                    endpoint = '/api/v1/hook-templates'
                    break
            }

            const data = await api._req(`${endpoint}?${params.toString()}`)

            // Handle paginated response: { success, data, total, page, per_page, total_pages }
            const results = Array.isArray(data) ? data : (data.data || data.items || data.results || [])
            const total = data.total || data.count || results.length
            const pages = data.total_pages || Math.ceil(total / PER_PAGE) || 1

            setItems(results)
            setTotalCount(total)
            setTotalPages(pages)
        } catch (err) {
            toast.error('Failed to load styles')
            console.error('Fetch styles error:', err)
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [categoryFilter, styleTypeFilter])

    // Fetch on tab/filter change
    useEffect(() => {
        setPage(1)
        fetchData(activeTab, 1)
    }, [activeTab, categoryFilter, styleTypeFilter, fetchData])

    // ─── Filtered Items (client-side search) ────────────────────────────────
    const filteredItems = useMemo(() => {
        if (!search.trim()) return items
        const q = search.toLowerCase()
        return items.filter(item =>
            item.name?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q) ||
            item.category?.toLowerCase().includes(q)
        )
    }, [items, search])

    // Separate presets (user_id=null) from user items
    const presets = useMemo(() => filteredItems.filter(i => i.user_id === null), [filteredItems])
    const userItems = useMemo(() => filteredItems.filter(i => i.user_id !== null), [filteredItems])

    // ─── Page Navigation ────────────────────────────────────────────────────
    const handlePageChange = useCallback((newPage) => {
        if (newPage < 1 || newPage > totalPages) return
        setPage(newPage)
        fetchData(activeTab, newPage)
    }, [totalPages, activeTab, fetchData])

    // ─── Actions ────────────────────────────────────────────────────────────
    const handleEdit = useCallback(() => {
        // Navigate to style editor (placeholder — will be implemented in task 6.2)
        toast('Edit: Style editor coming soon', { icon: '✏️' })
    }, [])

    const handleCustomize = useCallback(async (item) => {
        try {
            // Duplicate preset to user's account — strip server-only fields
            const { id: _id, user_id: _uid, is_default: _def, use_count: _uc, created_at: _ca, updated_at: _ua, ...payload } = item
            payload.user_id = 'current' // Backend resolves to current user
            payload.is_default = false
            payload.name = `${item.name} (Custom)`

            let endpoint = ''
            switch (activeTab) {
                case 'compositions':
                    endpoint = '/api/v1/style-compositions'
                    break
                case 'captions':
                    endpoint = '/api/v1/caption-templates'
                    break
                case 'hooks':
                    endpoint = '/api/v1/hook-templates'
                    break
            }

            await api._req(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload),
            })

            toast.success(`"${item.name}" duplicated to your styles`)
            fetchData(activeTab, 1)
        } catch (err) {
            toast.error('Failed to customize style')
            console.error('Customize error:', err)
        }
    }, [activeTab, fetchData])

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return
        try {
            let endpoint = ''
            switch (activeTab) {
                case 'compositions':
                    endpoint = `/api/v1/style-compositions/${deleteTarget.id}`
                    break
                case 'captions':
                    endpoint = `/api/v1/caption-templates/${deleteTarget.id}`
                    break
                case 'hooks':
                    endpoint = `/api/v1/hook-templates/${deleteTarget.id}`
                    break
            }

            await api._req(endpoint, { method: 'DELETE' })
            toast.success(`"${deleteTarget.name}" deleted`)
            setDeleteTarget(null)
            fetchData(activeTab, 1)
        } catch (err) {
            toast.error('Failed to delete style')
            console.error('Delete error:', err)
        }
    }, [deleteTarget, activeTab, fetchData])

    const handleCreateNew = useCallback(() => {
        // Navigate to style editor (placeholder — will be implemented in task 6.2)
        toast('Create: Style editor coming soon', { icon: '🎨' })
    }, [])

    // ─── Debounced Search ───────────────────────────────────────────────────
    const handleSearchChange = useCallback((e) => {
        const value = e.target.value
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = setTimeout(() => {
            setSearch(value)
        }, 300)
    }, [])

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto p-5 md:p-7">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Keyframe Styles</h1>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Manage compositions, caption templates, and hook templates
                    </p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Create New
                </motion.button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        style={{
                            background: activeTab === tab.key ? 'var(--color-bg-card)' : 'transparent',
                            color: activeTab === tab.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                        }}
                    >
                        <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
                {/* Category Dropdown */}
                <div className="relative">
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-medium cursor-pointer outline-none"
                        style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                        aria-label="Filter by category"
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined text-[14px] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }}>expand_more</span>
                </div>

                {/* Style Type Dropdown (not for compositions) */}
                {activeTab !== 'compositions' && (
                    <div className="relative">
                        <select
                            value={styleTypeFilter}
                            onChange={e => setStyleTypeFilter(e.target.value)}
                            className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-medium cursor-pointer outline-none"
                            style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                            aria-label="Filter by style type"
                        >
                            {STYLE_TYPES.map(st => (
                                <option key={st} value={st}>{st === 'all' ? 'All Types' : st.charAt(0).toUpperCase() + st.slice(1)}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined text-[14px] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }}>expand_more</span>
                    </div>
                )}

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <span className="material-symbols-outlined text-[16px] absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>search</span>
                    <input
                        type="text"
                        placeholder="Search styles..."
                        onChange={handleSearchChange}
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none transition-all"
                        style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                        aria-label="Search styles"
                    />
                </div>

                {/* Results count */}
                <span className="text-[10px] font-medium ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                    {filteredItems.length} style{filteredItems.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            )}

            {/* Content */}
            {!loading && (
                <>
                    {/* Presets Section */}
                    {presets.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>verified</span>
                                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Presets</h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                                    {presets.length}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {presets.map((item, i) => (
                                        <StyleCard
                                            key={item.id}
                                            item={item}
                                            type={activeTab}
                                            index={i}
                                            onEdit={handleEdit}
                                            onCustomize={handleCustomize}
                                            onDelete={setDeleteTarget}
                                            templateLookup={templateLookup}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* User Styles Section */}
                    {userItems.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-secondary)' }}>person</span>
                                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Your Styles</h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' }}>
                                    {userItems.length}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {userItems.map((item, i) => (
                                        <StyleCard
                                            key={item.id}
                                            item={item}
                                            type={activeTab}
                                            index={i}
                                            onEdit={handleEdit}
                                            onCustomize={handleCustomize}
                                            onDelete={setDeleteTarget}
                                            templateLookup={templateLookup}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {filteredItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <span className="material-symbols-outlined text-5xl mb-3" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>
                                {activeTab === 'compositions' ? 'layers' : activeTab === 'captions' ? 'subtitles' : 'format_quote'}
                            </span>
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                {search ? 'No styles match your search' : 'No styles found'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {search ? 'Try adjusting your filters or search query' : 'Create your first style to get started'}
                            </p>
                            {!search && (
                                <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleCreateNew}
                                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
                                >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    Create New
                                </motion.button>
                            )}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && filteredItems.length > 0 && !search && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
                                aria-label="Previous page"
                            >
                                <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                                Prev
                            </button>

                            {/* Page number buttons */}
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum
                                if (totalPages <= 5) {
                                    pageNum = i + 1
                                } else if (page <= 3) {
                                    pageNum = i + 1
                                } else if (page >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                } else {
                                    pageNum = page - 2 + i
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className="w-8 h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                        style={{
                                            background: pageNum === page ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
                                            color: pageNum === page ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                                            border: `1px solid ${pageNum === page ? 'transparent' : 'var(--color-border-default)'}`,
                                        }}
                                        aria-label={`Page ${pageNum}`}
                                        aria-current={pageNum === page ? 'page' : undefined}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}

                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= totalPages}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
                                aria-label="Next page"
                            >
                                Next
                                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                            </button>

                            <span className="text-[10px] ml-2" style={{ color: 'var(--color-text-muted)' }}>
                                Page {page} of {totalPages} ({totalCount} total)
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteTarget && (
                    <DeleteModal
                        item={deleteTarget}
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => setDeleteTarget(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
