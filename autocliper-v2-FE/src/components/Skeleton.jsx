import { motion } from 'framer-motion'

// Base skeleton pulse
function Skeleton({ className = '', rounded = 'rounded-lg' }) {
    return (
        <motion.div
            className={`bg-slate-200 dark:bg-slate-700/50 ${rounded} ${className}`}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-6">
                    <div className="flex items-start justify-between mb-4">
                        <Skeleton className="w-10 h-10" rounded="rounded-xl" />
                    </div>
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
                <div key={i} className="rounded-2xl border border-slate-200 dark:border-[#233648] overflow-hidden">
                    <Skeleton className="aspect-video w-full" rounded="rounded-none" />
                    <div className="p-3 space-y-2">
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
        <div className="divide-y divide-slate-100 dark:divide-[#1e2e40]">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
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
