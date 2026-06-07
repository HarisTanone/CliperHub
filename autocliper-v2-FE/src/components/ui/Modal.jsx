import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({
    open,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    className = '',
}) {
    // Handle escape key
    useEffect(() => {
        if (!open) return
        const handler = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onClose])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [open])

    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-4xl',
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className={`w-full rounded-2xl shadow-2xl ${sizes[size]} ${className}`}
                        style={{
                            background: 'var(--color-bg-modal)',
                            border: '1px solid var(--color-border-default)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        {title && (
                            <div
                                className="flex items-center justify-between px-6 py-4"
                                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                            >
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    {title}
                                </h3>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    className="p-1 rounded-lg cursor-pointer"
                                    style={{ color: 'var(--icon-muted)' }}
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </motion.button>
                            </div>
                        )}

                        {/* Body */}
                        <div className="px-6 py-5">
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div
                                className="flex items-center justify-end gap-3 px-6 py-4"
                                style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                            >
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
