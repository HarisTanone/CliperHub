import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Tooltip({
    children,
    content,
    position = 'top',
    delay = 0.3,
}) {
    const [show, setShow] = useState(false)
    let timeout = null

    const handleMouseEnter = () => {
        timeout = setTimeout(() => setShow(true), delay * 1000)
    }

    const handleMouseLeave = () => {
        clearTimeout(timeout)
        setShow(false)
    }

    const positions = {
        top: {
            initial: { opacity: 0, y: 5 },
            animate: { opacity: 1, y: 0 },
            style: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' }
        },
        bottom: {
            initial: { opacity: 0, y: -5 },
            animate: { opacity: 1, y: 0 },
            style: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' }
        },
        left: {
            initial: { opacity: 0, x: 5 },
            animate: { opacity: 1, x: 0 },
            style: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' }
        },
        right: {
            initial: { opacity: 0, x: -5 },
            animate: { opacity: 1, x: 0 },
            style: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' }
        },
    }

    const pos = positions[position]

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            <AnimatePresence>
                {show && (
                    <motion.div
                        initial={pos.initial}
                        animate={pos.animate}
                        exit={pos.initial}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none"
                        style={{
                            background: 'var(--color-bg-tooltip)',
                            color: 'var(--pale-blush)',
                            boxShadow: 'var(--shadow-md)',
                            ...pos.style
                        }}
                    >
                        {content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
