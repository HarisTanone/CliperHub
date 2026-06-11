import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ═══════════════════════════════════════════════════════════════
// KEYFRAME PREVIEW — Animated Phone Preview Component
// Uses Framer Motion for real-time animated previews of
// hook and caption overlay templates (keyframe-based system).
// ═══════════════════════════════════════════════════════════════

// ─── Animation Entrance Variants ───────────────────────────────────────────
const ENTRANCE_VARIANTS = {
    fade_in: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    scale_bounce: { initial: { opacity: 0, scale: 0 }, animate: { opacity: 1, scale: 1 } },
    slide_up: { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } },
    slide_down: { initial: { opacity: 0, y: -40 }, animate: { opacity: 1, y: 0 } },
    slide_left: { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 } },
    slide_right: { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 } },
    pop_in: { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: 1 } },
    slam_in: { initial: { opacity: 0, scale: 2.5 }, animate: { opacity: 1, scale: 1 } },
    typewriter_reveal: { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 } },
    pulse: { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
}

// Map keyframe_id to animation name for preview purposes
// In production this would be fetched from the registry
const KEYFRAME_ID_MAP = {
    1: 'fade_in',
    2: 'scale_bounce',
    3: 'slide_up',
    4: 'slide_down',
    5: 'slide_left',
    6: 'slide_right',
    7: 'pop_in',
    8: 'slam_in',
    9: 'typewriter_reveal',
    10: 'pulse',
}

function getEntranceVariant(keyframeId) {
    const name = KEYFRAME_ID_MAP[keyframeId] || 'fade_in'
    return ENTRANCE_VARIANTS[name] || ENTRANCE_VARIANTS.fade_in
}

// ─── HookPreview Sub-Component ─────────────────────────────────────────────
export function HookPreview({ template, text }) {
    const [animKey, setAnimKey] = useState(0)
    const [isPlaying, setIsPlaying] = useState(true)
    const timeoutRef = useRef(null)

    const config = template?.config || {}
    const textConfig = config.text || {}
    const animConfig = config.animation || {}
    const boxConfig = config.box || {}
    const defaultFont = textConfig.default_font || {}

    // Split text by newline into lines
    const lines = useMemo(() => {
        if (!text) return ['Sample Hook', 'Text Here']
        return text.split('\n').filter(Boolean)
    }, [text])

    // Per-line delays from template config
    const perLineDelays = useMemo(() => {
        const perLine = animConfig.per_line || []
        return lines.map((_, i) => {
            const lineConfig = perLine[i]
            return lineConfig?.delay_ms ? lineConfig.delay_ms / 1000 : i * 0.15
        })
    }, [animConfig.per_line, lines.length])

    // Get entrance variant from keyframe ID
    const entranceVariant = useMemo(() => {
        return getEntranceVariant(animConfig.entrance_keyframe_id)
    }, [animConfig.entrance_keyframe_id])

    // Animation loop: play → pause 2s → restart
    const handleAnimationComplete = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            setIsPlaying(false)
            setTimeout(() => {
                setAnimKey(k => k + 1)
                setIsPlaying(true)
            }, 50)
        }, 2000)
    }, [])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    // Build per-line styles from template config
    const getLineStyle = useCallback((lineIndex) => {
        const lineConfig = textConfig.lines?.[lineIndex] || {}
        return {
            fontFamily: lineConfig.font_family || defaultFont.family || 'Inter, sans-serif',
            fontSize: `${(lineConfig.font_size || defaultFont.size || 48) * 0.45}px`,
            fontWeight: lineConfig.font_weight || defaultFont.weight || 'bold',
            color: lineConfig.color || defaultFont.color || '#FFFFFF',
            letterSpacing: `${(lineConfig.letter_spacing ?? defaultFont.letter_spacing ?? 0) * 0.45}px`,
            textTransform: lineConfig.text_transform || 'none',
            lineHeight: 1.2,
        }
    }, [textConfig.lines, defaultFont])

    return (
        <div className="absolute inset-0 flex items-center justify-center px-4">
            {/* Box background */}
            {boxConfig.enabled && (
                <div
                    className="absolute"
                    style={{
                        background: boxConfig.color || '#000000',
                        opacity: boxConfig.opacity ?? 0.7,
                        borderRadius: `${(boxConfig.border_radius || 12) * 0.45}px`,
                        inset: '25% 8%',
                    }}
                />
            )}

            {/* Lines container */}
            <div className="relative flex flex-col items-center gap-1 text-center z-10">
                <AnimatePresence>
                    {isPlaying && lines.map((line, i) => {
                        const perLine = animConfig.per_line?.[i]
                        const lineVariant = perLine?.keyframe_id
                            ? getEntranceVariant(perLine.keyframe_id)
                            : entranceVariant

                        return (
                            <motion.div
                                key={`${animKey}-${i}`}
                                initial={lineVariant.initial}
                                animate={lineVariant.animate}
                                transition={{
                                    duration: 0.5,
                                    delay: perLineDelays[i],
                                    ease: [0.34, 1.56, 0.64, 1],
                                }}
                                onAnimationComplete={i === lines.length - 1 ? handleAnimationComplete : undefined}
                                style={getLineStyle(i)}
                            >
                                {line}
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )
}

// ─── CaptionPreview Sub-Component ──────────────────────────────────────────
export function CaptionPreview({ template, words }) {
    const [activeIndex, setActiveIndex] = useState(0)
    const [animKey, setAnimKey] = useState(0)
    const intervalRef = useRef(null)
    const pauseTimeoutRef = useRef(null)

    const config = template?.config || {}
    const fontConfig = config.font || {}
    const highlightConfig = config.highlight || {}
    const colorsConfig = config.colors || {}

    const wordList = useMemo(() => {
        if (!words || words.length === 0) return ['This', 'is', 'a', 'test']
        return words
    }, [words])

    const cycleDuration = highlightConfig.transition_duration_ms || 200

    // Karaoke cycling — advance through words, loop with 2s pause
    useEffect(() => {
        const startCycle = () => {
            intervalRef.current = setInterval(() => {
                setActiveIndex(prev => {
                    const next = prev + 1
                    if (next >= wordList.length) {
                        // End of words — pause 2s then restart
                        clearInterval(intervalRef.current)
                        pauseTimeoutRef.current = setTimeout(() => {
                            setActiveIndex(0)
                            setAnimKey(k => k + 1)
                            startCycle()
                        }, 2000)
                        return prev
                    }
                    return next
                })
            }, cycleDuration + 100)
        }

        startCycle()

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
        }
    }, [wordList.length, cycleDuration, animKey])

    // Build word styles
    const baseWordStyle = useMemo(() => ({
        fontFamily: fontConfig.family || 'Impact, sans-serif',
        fontSize: `${(fontConfig.size || 72) * 0.35}px`,
        fontWeight: fontConfig.weight || 'bold',
        color: colorsConfig.primary || '#FFFFFF',
        letterSpacing: `${(fontConfig.letter_spacing || 0) * 0.35}px`,
        textTransform: fontConfig.text_transform || 'none',
        lineHeight: 1.3,
        display: 'inline',
    }), [fontConfig, colorsConfig])

    // Highlight styles based on highlight.style
    const getHighlightStyle = useCallback((isActive) => {
        if (!isActive) return {}

        const hlColor = highlightConfig.color || '#FFFF00'
        const hlStyle = highlightConfig.style || 'color'

        switch (hlStyle) {
            case 'color':
                return { color: hlColor }
            case 'background':
                return {
                    backgroundColor: hlColor,
                    color: '#000',
                    padding: '0 3px',
                    borderRadius: '3px',
                }
            case 'glow':
                return {
                    color: hlColor,
                    textShadow: `0 0 8px ${hlColor}, 0 0 16px ${hlColor}`,
                }
            case 'scale':
                return { color: hlColor }
            case 'underline':
                return {
                    color: hlColor,
                    textDecoration: 'underline',
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '3px',
                }
            default:
                return { color: hlColor }
        }
    }, [highlightConfig])

    const transitionType = highlightConfig.transition || 'smooth'
    const transitionDuration = transitionType === 'instant' ? 0 :
        transitionType === 'bounce' ? 0.3 : 0.15

    return (
        <div className="absolute bottom-8 left-0 right-0 px-4 text-center z-10">
            <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                {wordList.map((word, i) => {
                    const isActive = i === activeIndex
                    const shouldScale = isActive && highlightConfig.style === 'scale'

                    return (
                        <motion.span
                            key={`${animKey}-${i}`}
                            style={{
                                ...baseWordStyle,
                                ...getHighlightStyle(isActive),
                                transition: `color ${transitionDuration}s, background-color ${transitionDuration}s`,
                            }}
                            animate={shouldScale ? { scale: 1.2 } : { scale: 1 }}
                            transition={
                                transitionType === 'bounce'
                                    ? { type: 'spring', stiffness: 500, damping: 15 }
                                    : { duration: transitionDuration }
                            }
                        >
                            {word}
                        </motion.span>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Main KeyframePreview Component ────────────────────────────────────────
export default function KeyframePreview({
    template,
    type = 'hook',
    text,
    words,
    loop = true,
}) {
    const [resetKey, setResetKey] = useState(0)
    const lastChangeRef = useRef(Date.now())
    const debounceRef = useRef(null)

    // Prop change responsiveness:
    // <100ms since last → immediate restart (new key)
    // mid-animation rapid changes → 150ms debounce
    const templateKey = useMemo(() => {
        return JSON.stringify({ template, type, text, words })
    }, [template, type, text, words])

    useEffect(() => {
        const now = Date.now()
        const elapsed = now - lastChangeRef.current
        lastChangeRef.current = now

        if (elapsed < 100) {
            // Immediate restart for rapid successive changes
            setResetKey(k => k + 1)
        } else {
            // Debounce 150ms for mid-animation updates
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                setResetKey(k => k + 1)
            }, 150)
        }

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [templateKey])

    return (
        <div className="relative flex flex-col items-center">
            {/* Phone-shaped container: 9:16 aspect ratio */}
            <div
                className="relative overflow-hidden rounded-2xl shadow-lg"
                style={{
                    width: 270,
                    height: 480,
                    background: 'linear-gradient(180deg, #1a1025 0%, #0d0a14 50%, #1a0f20 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04) inset',
                }}
            >
                {/* Dynamic Island */}
                <div
                    className="absolute top-2 left-1/2 -translate-x-1/2 bg-black rounded-full z-20"
                    style={{ width: 50, height: 12 }}
                />

                {/* Subtle gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 z-[1]" />

                {/* Preview content */}
                <div key={resetKey} className="absolute inset-0 z-10">
                    {type === 'hook' && (
                        <HookPreview template={template} text={text} />
                    )}
                    {type === 'caption' && (
                        <CaptionPreview template={template} words={words} />
                    )}
                </div>

                {/* Bottom status bar mock */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-white/20 z-20" />
            </div>
        </div>
    )
}
