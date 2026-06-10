import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

const RESOLUTIONS = {
    portrait: [
        { value: '9:16', width: 1080, height: 1920, label: '9:16', desc: 'TikTok / Reels' },
        { value: '4:5', width: 1080, height: 1350, label: '4:5', desc: 'Instagram Feed' },
        { value: '3:4', width: 1080, height: 1440, label: '3:4', desc: 'Mobile friendly' },
        { value: '2:3', width: 1080, height: 1620, label: '2:3', desc: 'Alternatif vertikal' },
    ],
    landscape: [
        { value: '16:9', width: 1920, height: 1080, label: '16:9', desc: 'YouTube' },
        { value: '21:9', width: 2560, height: 1080, label: '21:9', desc: 'Cinematic' },
        { value: '18:9', width: 2160, height: 1080, label: '18:9', desc: 'Smartphone wide' },
    ],
}

function ResolutionIcon({ width, height, size = 28 }) {
    const maxDim = Math.max(width, height)
    const w = (width / maxDim) * size * 0.75
    const h = (height / maxDim) * size * 0.75
    return (
        <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <div className="rounded-[3px]" style={{
                width: `${w}px`,
                height: `${h}px`,
                border: '1.5px solid currentColor',
                opacity: 0.8,
            }} />
        </div>
    )
}

export default function ResolutionSelector({ value = '9:16', onChange }) {
    const [expanded, setExpanded] = useState(false)
    const [pos, setPos] = useState({ top: 0, right: 0 })
    const btnRef = useRef(null)

    const allResolutions = [...RESOLUTIONS.portrait, ...RESOLUTIONS.landscape]
    const selected = allResolutions.find(r => r.value === value) || allResolutions[0]

    useEffect(() => {
        if (expanded && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setPos({
                top: rect.bottom + 6,
                right: window.innerWidth - rect.right,
            })
        }
    }, [expanded])

    return (
        <div className="relative">
            {/* Compact trigger button */}
            <button
                ref={btnRef}
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
                style={{
                    background: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-primary)',
                }}
                aria-label="Select video resolution"
            >
                <ResolutionIcon width={selected.width} height={selected.height} size={22} />
                <span className="font-semibold">{selected.label}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{selected.width}×{selected.height}</span>
                <span className="material-symbols-outlined text-[14px] ml-0.5 transition-transform" style={{
                    color: 'var(--color-text-muted)',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>expand_more</span>
            </button>

            {/* Dropdown rendered via Portal to escape overflow:hidden parents */}
            {createPortal(
                <AnimatePresence>
                    {expanded && (
                        <>
                            {/* Backdrop */}
                            <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setExpanded(false)} />

                            {/* Menu */}
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                transition={{ duration: 0.15 }}
                                className="fixed w-72 rounded-xl overflow-hidden"
                                style={{
                                    top: pos.top,
                                    right: pos.right,
                                    zIndex: 9999,
                                    background: 'var(--color-bg-card)',
                                    border: '1px solid var(--color-border-subtle)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                                }}
                            >
                                {/* Portrait section */}
                                <div className="px-3 pt-3 pb-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                                        style={{ color: 'var(--color-text-muted)' }}>
                                        <span className="material-symbols-outlined text-[12px]">stay_current_portrait</span>
                                        Portrait (Vertikal)
                                    </p>
                                </div>
                                <div className="px-2 pb-2">
                                    {RESOLUTIONS.portrait.map(r => (
                                        <ResolutionOption
                                            key={r.value}
                                            resolution={r}
                                            isActive={value === r.value}
                                            onSelect={() => { onChange(r.value); setExpanded(false) }}
                                        />
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="mx-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }} />

                                {/* Landscape section */}
                                <div className="px-3 pt-2 pb-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                                        style={{ color: 'var(--color-text-muted)' }}>
                                        <span className="material-symbols-outlined text-[12px]">stay_current_landscape</span>
                                        Landscape (Horizontal)
                                    </p>
                                </div>
                                <div className="px-2 pb-2">
                                    {RESOLUTIONS.landscape.map(r => (
                                        <ResolutionOption
                                            key={r.value}
                                            resolution={r}
                                            isActive={value === r.value}
                                            onSelect={() => { onChange(r.value); setExpanded(false) }}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}

function ResolutionOption({ resolution, isActive, onSelect }) {
    return (
        <button
            onClick={onSelect}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer"
            style={{
                background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                color: 'var(--color-text-primary)',
            }}
        >
            <ResolutionIcon width={resolution.width} height={resolution.height} size={24} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{resolution.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {resolution.width}×{resolution.height}
                    </span>
                </div>
                <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {resolution.desc}
                </p>
            </div>
            {isActive && (
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>
                    check_circle
                </span>
            )}
        </button>
    )
}
