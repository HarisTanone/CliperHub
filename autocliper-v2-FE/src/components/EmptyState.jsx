import { motion } from 'framer-motion'

const illustrations = {
    noJobs: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" style={{ fill: 'var(--color-surface-1)' }} />
            <rect x="35" y="40" width="50" height="35" rx="4" style={{ fill: 'var(--color-surface-2)' }} />
            <rect x="40" y="45" width="20" height="3" rx="1.5" style={{ fill: 'var(--color-border-default)' }} />
            <rect x="40" y="52" width="35" height="2" rx="1" style={{ fill: 'var(--color-border-default)' }} />
            <rect x="40" y="58" width="28" height="2" rx="1" style={{ fill: 'var(--color-border-default)' }} />
            <circle cx="72" cy="68" r="12" style={{ fill: 'var(--color-accent-subtle)' }} />
            <path d="M68 68L71 71L77 65" style={{ stroke: 'var(--color-accent)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    noHistory: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" style={{ fill: 'var(--color-surface-1)' }} />
            <path d="M60 30V60L75 75" style={{ stroke: 'var(--color-border-default)' }} strokeWidth="3" strokeLinecap="round" />
            <circle cx="60" cy="60" r="28" style={{ stroke: 'var(--color-surface-2)' }} strokeWidth="3" fill="none" />
            <circle cx="60" cy="60" r="3" style={{ fill: 'var(--color-accent)' }} />
        </svg>
    ),
    noUsers: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" style={{ fill: 'var(--color-surface-1)' }} />
            <circle cx="50" cy="48" r="10" style={{ fill: 'var(--color-surface-2)' }} />
            <path d="M35 78C35 68 42 62 50 62S65 68 65 78" style={{ fill: 'var(--color-surface-2)' }} />
            <circle cx="75" cy="48" r="8" style={{ fill: 'var(--color-accent-subtle)' }} />
            <path d="M63 78C63 70 68 65 75 65S87 70 87 78" style={{ fill: 'var(--color-accent-subtle)' }} />
            <path d="M72 48H78M75 45V51" style={{ stroke: 'var(--color-accent)' }} strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    noStyles: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" style={{ fill: 'var(--color-surface-1)' }} />
            <rect x="30" y="35" width="60" height="50" rx="6" style={{ fill: 'var(--color-surface-2)' }} />
            <circle cx="50" cy="55" r="8" style={{ fill: 'var(--color-accent-subtle)' }} />
            <circle cx="70" cy="55" r="8" style={{ fill: 'var(--color-warning-bg)' }} />
            <circle cx="60" cy="70" r="8" style={{ fill: 'var(--color-success-bg)' }} />
            <text x="55" y="90" style={{ fill: 'var(--color-text-muted)' }} fontSize="8" fontWeight="bold">Aa</text>
        </svg>
    ),
}

function EmptyState({ type = 'noJobs', title, description, action, actionLabel, icon }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="p-12 sm:p-16 text-center"
        >
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
                className="w-28 h-28 mx-auto mb-6"
            >
                {illustrations[type] || (
                    <div className="w-full h-full rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-1)' }}>
                        <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--icon-muted)' }}>{icon || 'inbox'}</span>
                    </div>
                )}
            </motion.div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
            <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
            {action && (
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={action}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                    style={{
                        background: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        boxShadow: 'var(--btn-primary-shadow)'
                    }}
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {actionLabel || 'Get Started'}
                </motion.button>
            )}
        </motion.div>
    )
}

export default EmptyState
