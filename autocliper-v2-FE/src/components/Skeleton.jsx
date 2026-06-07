import { motion } from 'framer-motion'

// Base skeleton pulse using design system
function Skeleton({ className = '', rounded = 'rounded-lg' }) {
    return (
        <motion.div
            className={`${rounded} ${className}`}
            style={{
                background: 'linear-gradient(90deg, var(--color-border-subtle) 25%, var(--color-surface-1) 50%, var(--color-border-subtle) 75%)',
                backgroundSize: '400px 100%'
            }}
            animate={{
                backgroundPosition: ['-400px 0', '400px 0']
            }}
            transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeInOut'
            }}
        />
    )
}

// Card skeleton for dashboard/history
export function CardSkeleton() {
    return (
        <div className="p-5 flex gap-4">
            <Skeleton className="w-28 h-16 flex-shrink-0" rounded="rounded-xl" />
            <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2 pt-1">
                    <Skeleton className="h-6 w-20" rounded="rounded-full" />
                    <Skeleton className="h-6 w-16" rounded="rounded-full" />
                </div>
            </div>
        </div>
    )
}

// Stats skeleton
export function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-40 mb-4" />
                <Skeleton className="h-4 w-56 mb-4" />
                <Skeleton className="h-10 w-36" rounded="rounded-xl" />
            </div>
            {[1, 2].map(i => (
                <div key={i} className="rounded-2xl p-5" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                    <Skeleton className="w-10 h-10 mb-3" rounded="rounded-xl" />
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                </div>
            ))}
        </div>
    )
}

// Grid skeleton for styles
export function GridSkeleton({ count = 6 }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
                    <Skeleton className="aspect-video w-full" rounded="rounded-none" />
                    <div className="p-3 space-y-2" style={{ background: 'var(--color-bg-card)' }}>
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// Table row skeleton
export function TableRowSkeleton({ rows = 5 }) {
    return (
        <div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <Skeleton className="w-11 h-11 flex-shrink-0" rounded="rounded-2xl" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16" rounded="rounded-full" />
                </div>
            ))}
        </div>
    )
}

export default Skeleton
