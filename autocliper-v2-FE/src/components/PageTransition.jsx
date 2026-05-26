import { motion, AnimatePresence } from 'framer-motion'

const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
}

const pageTransition = {
    type: 'tween',
    ease: [0.25, 0.46, 0.45, 0.94],
    duration: 0.3,
}

export function PageTransition({ children, pageKey }) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pageKey}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="flex-1 flex flex-col overflow-hidden"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}

// Fade in from bottom — for cards and sections
export function FadeInUp({ children, delay = 0, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// Stagger children animation
export function StaggerContainer({ children, className = '', staggerDelay = 0.06 }) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                hidden: {},
                visible: { transition: { staggerChildren: staggerDelay } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

export function StaggerItem({ children, className = '' }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// Scale in — for modals and popups
export function ScaleIn({ children, className = '' }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// Slide in from right — for sidebars
export function SlideInRight({ children, className = '' }) {
    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
