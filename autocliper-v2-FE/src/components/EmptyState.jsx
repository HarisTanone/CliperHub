import { motion } from 'framer-motion'

const illustrations = {
    noJobs: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" className="fill-slate-100 dark:fill-slate-800/50" />
            <rect x="35" y="40" width="50" height="35" rx="4" className="fill-slate-200 dark:fill-slate-700" />
            <rect x="40" y="45" width="20" height="3" rx="1.5" className="fill-slate-300 dark:fill-slate-600" />
            <rect x="40" y="52" width="35" height="2" rx="1" className="fill-slate-300 dark:fill-slate-600" />
            <rect x="40" y="58" width="28" height="2" rx="1" className="fill-slate-300 dark:fill-slate-600" />
            <circle cx="72" cy="68" r="12" className="fill-primary/20" />
            <path d="M68 68L71 71L77 65" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    noHistory: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" className="fill-slate-100 dark:fill-slate-800/50" />
            <path d="M60 30V60L75 75" className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="3" strokeLinecap="round" />
            <circle cx="60" cy="60" r="28" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="3" />
            <circle cx="60" cy="60" r="3" className="fill-primary" />
        </svg>
    ),
    noUsers: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" className="fill-slate-100 dark:fill-slate-800/50" />
            <circle cx="50" cy="48" r="10" className="fill-slate-200 dark:fill-slate-700" />
            <path d="M35 78C35 68 42 62 50 62S65 68 65 78" className="fill-slate-200 dark:fill-slate-700" />
            <circle cx="75" cy="48" r="8" className="fill-primary/20" />
            <path d="M63 78C63 70 68 65 75 65S87 70 87 78" className="fill-primary/20" />
            <path d="M72 48H78M75 45V51" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    noStyles: (
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
            <circle cx="60" cy="60" r="50" className="fill-slate-100 dark:fill-slate-800/50" />
            <rect x="30" y="35" width="60" height="50" rx="6" className="fill-slate-200 dark:fill-slate-700" />
            <circle cx="50" cy="55" r="8" className="fill-primary/30" />
            <circle cx="70" cy="55" r="8" className="fill-amber-300/30" />
            <circle cx="60" cy="70" r="8" className="fill-emerald-300/30" />
            <text x="55" y="90" className="fill-slate-400 dark:fill-slate-500" fontSize="8" fontWeight="bold">Aa</text>
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
                    <div className="w-full h-full rounded-2xl bg-slate-100 dark:bg-[#1e2e40] flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300">{icon || 'inbox'}</span>
                    </div>
                )}
            </motion.div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">{description}</p>
            {action && (
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={action}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-primary/20"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {actionLabel || 'Get Started'}
                </motion.button>
            )}
        </motion.div>
    )
}

export default EmptyState
