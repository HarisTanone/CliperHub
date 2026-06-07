import { motion } from 'framer-motion'

function ProgressRing({ progress = 0, size = 80, strokeWidth = 6, className = '' }) {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (progress / 100) * circumference

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} className="-rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    style={{ stroke: 'var(--color-border-default)' }}
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
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    strokeDasharray={circumference}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span
                    className="text-sm font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                >{Math.round(progress)}%</span>
            </div>
        </div>
    )
}

export default ProgressRing
