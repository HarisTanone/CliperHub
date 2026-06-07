import { motion } from 'framer-motion'

export default function Progress({
    value = 0,
    max = 100,
    showLabel = false,
    size = 'md',
    variant = 'default',
    indeterminate = false,
    className = '',
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))

    const sizes = {
        sm: 'h-1',
        md: 'h-1.5',
        lg: 'h-2',
    }

    const variants = {
        default: 'linear-gradient(90deg, var(--burgundy), var(--color-accent))',
        success: 'var(--color-success-text)',
        warning: 'var(--color-warning-text)',
        error: 'var(--color-error-text)',
    }

    return (
        <div className={`w-full ${className}`}>
            <div
                className={`w-full ${sizes[size]} rounded-full overflow-hidden`}
                style={{ background: 'var(--color-border-subtle)' }}
            >
                {indeterminate ? (
                    <motion.div
                        className={`h-full w-1/3 rounded-full`}
                        style={{ background: variants[variant] }}
                        animate={{ x: ['0%', '200%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                ) : (
                    <motion.div
                        className={`h-full rounded-full`}
                        style={{ background: variants[variant] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                )}
            </div>
            {showLabel && !indeterminate && (
                <div className="flex justify-between mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{value}</span>
                    <span>{percentage.toFixed(0)}%</span>
                </div>
            )}
        </div>
    )
}

// Circular progress variant
export function CircularProgress({
    value = 0,
    max = 100,
    size = 60,
    strokeWidth = 4,
    showLabel = true,
    className = '',
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100))
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (percentage / 100) * circumference

    return (
        <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    style={{ stroke: 'var(--color-border-subtle)' }}
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ stroke: 'var(--color-accent)' }}
                    initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </svg>
            {showLabel && (
                <div
                    className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {percentage.toFixed(0)}%
                </div>
            )}
        </div>
    )
}
