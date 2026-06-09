import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { buildCaptionWordStyle, buildCaptionPillStyle, buildHookWordStyle, buildHookBoxStyle } from '../utils/remotionStyleUtils'

// ═══════════════════════════════════════════════════════════════
// REMOTION PREVIEW — Animated Phone Preview Component
// Pro-level animated preview that simulates Remotion output
// Used across: CreatePage, StyleApplyPage, RemotionStylesPage
// ═══════════════════════════════════════════════════════════════

const CAPTION_LINES = [
    { normal: ['inget', 'banget'], highlight: 'usahain', after: ['salam'] },
    { normal: ['yang', 'paling'], highlight: 'penting', after: ['itu'] },
    { normal: ['harus', 'bisa'], highlight: 'konsisten', after: [] },
    { normal: ['ini', 'cara'], highlight: 'terbaik', after: ['guys'] },
]

const HOOK_LINES = [
    { before: 'Did you know', keyword: 'THIS', after: 'trick?' },
    { before: 'Watch till', keyword: 'THE END', after: '' },
    { before: 'Nobody talks', keyword: 'ABOUT', after: 'this' },
]

// ─── Animated Caption Overlay ──────────────────────────────────────────────
function AnimatedCaption({ style, cycle }) {
    const [lineIdx, setLineIdx] = useState(0)
    const [wordAnim, setWordAnim] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setLineIdx(prev => (prev + 1) % CAPTION_LINES.length)
            setWordAnim(w => w + 1)
        }, 1800)
        return () => clearInterval(interval)
    }, [cycle])

    if (!style) return null

    const PHONE_W = 280
    const scale = PHONE_W / 360 // match backend render_scale (width / 360)

    const normalWordStyle = buildCaptionWordStyle(style, { isHighlight: false, scale })
    const highlightWordStyle = buildCaptionWordStyle(style, { isHighlight: true, scale })
    const pillStyle = buildCaptionPillStyle(style, { scale })
    const bottomMargin = Math.max(16, Math.round((style.position_y_offset || 80) * (PHONE_W / 1080)))

    const line = CAPTION_LINES[lineIdx]
    const config = style.config || {}
    const enterAnim = style.animation_in || config.animation?.chunk_enter || 'fade'

    const variants = {
        fade: { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } },
        pop: { initial: { opacity: 0, scale: 0.6, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.8 } },
        slide_up: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } },
        bounce: { initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 } },
        stomp: { initial: { opacity: 0, scale: 1.5 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.8 } },
    }

    const v = variants[enterAnim] || variants.fade

    return (
        <div className="absolute left-0 right-0 px-3 text-center z-10" style={{ bottom: `${bottomMargin}px` }}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={`${cycle}-${lineIdx}-${wordAnim}`}
                    initial={v.initial}
                    animate={v.animate}
                    exit={v.exit}
                    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={pillStyle}
                >
                    <span style={normalWordStyle}>{line.normal.join(' ')} </span>
                    <motion.span
                        style={highlightWordStyle}
                        animate={(style.highlight_style === 'glow') ? { opacity: [1, 0.85, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        {line.highlight}
                    </motion.span>
                    {line.after.length > 0 && <span style={normalWordStyle}> {line.after.join(' ')}</span>}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

// ─── Animated Hook Overlay ─────────────────────────────────────────────────
function AnimatedHook({ hookStyle }) {
    const [visible, setVisible] = useState(true)
    const [lineIdx, setLineIdx] = useState(0)

    useEffect(() => {
        if (!hookStyle) return
        const interval = setInterval(() => {
            setVisible(false)
            setTimeout(() => {
                setLineIdx(prev => (prev + 1) % HOOK_LINES.length)
                setVisible(true)
            }, 400)
        }, 3500)
        return () => clearInterval(interval)
    }, [hookStyle])

    if (!hookStyle) return null

    const hs = hookStyle
    const PHONE_W = 280
    const scale = PHONE_W / 360 // match backend render_scale (width / 360)

    const normalWordStyle = buildHookWordStyle(hs, { isKeyword: false, scale })
    const keywordWordStyle = buildHookWordStyle(hs, { isKeyword: true, scale })
    const boxStyle = buildHookBoxStyle(hs, { scale })

    const line = HOOK_LINES[lineIdx]

    return (
        <div className="absolute left-0 right-0 flex flex-col items-center px-3 text-center z-10" style={{ top: '20%' }}>
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.7, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ duration: hs.fade_in || 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        style={boxStyle}
                    >
                        <p style={normalWordStyle}>{line.before}</p>
                        <motion.p
                            style={keywordWordStyle}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            {line.keyword}
                        </motion.p>
                        {line.after && (
                            <p style={normalWordStyle}>{line.after}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Playback Progress Bar ─────────────────────────────────────────────────
function PlaybackBar({ duration = 6 }) {
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const start = Date.now()
        const interval = setInterval(() => {
            const elapsed = (Date.now() - start) / 1000
            setProgress((elapsed % duration) / duration * 100)
        }, 50)
        return () => clearInterval(interval)
    }, [duration])

    return (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] z-20" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <motion.div
                className="h-full rounded-r-full"
                style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-hover))',
                }}
            />
        </div>
    )
}

// ─── Floating Particles (decorative) ───────────────────────────────────────
function FloatingParticles() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(5)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full"
                    style={{
                        background: 'var(--color-accent)',
                        opacity: 0.3,
                        left: `${15 + i * 18}%`,
                        top: `${20 + i * 12}%`,
                    }}
                    animate={{
                        y: [-10, 10, -10],
                        opacity: [0.2, 0.5, 0.2],
                        scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                        duration: 3 + i * 0.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.4,
                    }}
                />
            ))}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT: RemotionPreview
// ═══════════════════════════════════════════════════════════════
export default function RemotionPreview({
    captionStyle,
    hookStyle,
    backgroundImage,
    thumbnailUrl,
    size = 'md', // 'sm' | 'md' | 'lg'
    showPlayback = true,
    showBadge = true,
    showParticles = true,
    showGlow = true,
    className = '',
    label,
}) {
    const [cycle, setCycle] = useState(0)
    const containerRef = useRef(null)

    useEffect(() => {
        const interval = setInterval(() => setCycle(c => c + 1), 12000)
        return () => clearInterval(interval)
    }, [])

    const sizes = {
        sm: { w: 200, h: 356, radius: 24, notchW: 14, notchH: 4 },
        md: { w: 280, h: 498, radius: 30, notchW: 18, notchH: 5 },
        lg: { w: 340, h: 604, radius: 34, notchW: 22, notchH: 6 },
    }

    const s = sizes[size] || sizes.md
    const bgSrc = thumbnailUrl || backgroundImage || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR8v7XkC5vNu8cT77RaDOH4JfdHz-jjqDZnXfNWnC1yftxffImbLrXQnp0Wc7uCVKDdmFIGTKf4i0uR3BneXMYGm4g0sURS6lQWj20A_od6g5NVwaRH39JjwGctm7e8L_ixngiEO7COOxJdLZp0AJg0K2Xay6coqna9CtqsDt92xch-THdSapYp4bQ9Nq_WQmkhDhFv_qS3ft45j18zz402xoje1TvphZHMvgRNUwa2hMhsJoIORa3iCMC9UUNE_TWVNWgtkTEXgRi'

    return (
        <div className={`relative flex flex-col items-center ${className}`} ref={containerRef}>
            {/* Outer glow */}
            {showGlow && (
                <motion.div
                    className="absolute -inset-6 rounded-full pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at center, var(--color-accent-subtle) 0%, transparent 70%)',
                        filter: 'blur(20px)',
                    }}
                    animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.02, 0.95] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
            )}

            {/* Phone frame */}
            <motion.div
                className="relative overflow-hidden shadow-2xl"
                style={{
                    width: s.w,
                    height: s.h,
                    borderRadius: `${s.radius}px`,
                    border: '2.5px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
                }}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
                {/* Dynamic Island / Notch */}
                <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 bg-black rounded-full z-30"
                    style={{ width: s.notchW * 3, height: s.notchH * 2.5 }}
                />

                {/* Background image/video */}
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${bgSrc}')` }} />

                {/* Gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/60" />

                {/* Floating particles */}
                {showParticles && <FloatingParticles />}

                {/* Hook overlay */}
                <AnimatedHook hookStyle={hookStyle} />

                {/* Caption overlay */}
                <AnimatedCaption style={captionStyle} cycle={cycle} />

                {/* Playback progress */}
                {showPlayback && <PlaybackBar duration={7.2} />}

                {/* PREVIEW badge */}
                {showBadge && (
                    <motion.div
                        className="absolute top-7 right-2 text-white text-[7px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-20 backdrop-blur-sm"
                        style={{ background: 'rgba(201, 74, 110, 0.85)' }}
                        animate={{ opacity: [1, 0.7, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                    </motion.div>
                )}

                {/* Frame shine effect */}
                <motion.div
                    className="absolute inset-0 pointer-events-none z-20"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(255,255,255,0.03) 100%)',
                    }}
                />
            </motion.div>

            {/* Label */}
            {label && (
                <motion.p
                    className="mt-3 text-xs font-medium text-center"
                    style={{ color: 'var(--color-text-secondary)' }}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    {label}
                </motion.p>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// MINI PREVIEW — For grid/card view (smaller, no particles)
// ═══════════════════════════════════════════════════════════════
export function MiniRemotionPreview({ captionStyle, hookStyle, className = '' }) {
    return (
        <RemotionPreview
            captionStyle={captionStyle}
            hookStyle={hookStyle}
            size="sm"
            showPlayback={false}
            showBadge={false}
            showParticles={false}
            showGlow={false}
            className={className}
        />
    )
}
