import { motion } from 'framer-motion'

export default function Toggle({
    checked,
    onChange,
    label,
    disabled = false,
    size = 'md',
    className = '',
}) {
    const sizes = {
        sm: { track: 'w-8 h-5', thumb: 'w-3.5 h-3.5', translate: 12 },
        md: { track: 'w-11 h-6', thumb: 'w-4.5 h-4.5', translate: 18 },
        lg: { track: 'w-14 h-8', thumb: 'w-6 h-6', translate: 22 },
    }

    const s = sizes[size]

    return (
        <label className={`flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
            <div className={`relative ${s.track} rounded-full transition-colors`}
                style={{ background: checked ? 'var(--color-accent)' : 'var(--color-border-default)' }}>
                <motion.div
                    animate={{
                        x: checked ? s.translate : 3,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`absolute top-1/2 -translate-y-1/2 ${s.thumb} rounded-full bg-white shadow-md`}
                />
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => !disabled && onChange(e.target.checked)}
                    className="sr-only"
                />
            </div>
            {label && (
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {label}
                </span>
            )}
        </label>
    )
}
