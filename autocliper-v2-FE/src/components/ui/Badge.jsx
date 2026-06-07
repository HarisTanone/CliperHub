import { motion } from 'framer-motion'

const variants = {
    success: {
        background: 'var(--color-success-bg)',
        color: 'var(--color-success-text)',
        border: '1px solid var(--color-success-border)',
    },
    warning: {
        background: 'var(--color-warning-bg)',
        color: 'var(--color-warning-text)',
        border: '1px solid var(--color-warning-border)',
    },
    error: {
        background: 'var(--color-error-bg)',
        color: 'var(--color-error-text)',
        border: '1px solid var(--color-error-border)',
    },
    info: {
        background: 'var(--color-info-bg)',
        color: 'var(--color-info-text)',
        border: '1px solid var(--color-info-border)',
    },
    neutral: {
        background: 'var(--color-accent-subtle)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
    },
    accent: {
        background: 'var(--color-accent)',
        color: 'var(--btn-primary-text)',
        border: '1px solid var(--color-accent)',
    },
}

export default function Badge({
    children,
    variant = 'neutral',
    icon,
    pulse = false,
    className = '',
    ...props
}) {
    return (
        <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1 rounded-full
        text-[11px] font-semibold
        ${className}
      `}
            style={variants[variant]}
            {...props}
        >
            {pulse && (
                <span className="relative flex h-2 w-2">
                    <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ background: 'currentColor' }}
                    />
                    <span
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ background: 'currentColor' }}
                    />
                </span>
            )}
            {icon && <span className="material-symbols-outlined text-[12px]">{icon}</span>}
            {children}
        </motion.span>
    )
}
