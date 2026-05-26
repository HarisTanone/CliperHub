import { useState, useEffect } from 'react'
import { api } from '../utils/api'

const DISK_STATUS_COLORS = {
    ok: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
}

function HealthBadge() {
    const [health, setHealth] = useState(null)

    useEffect(() => {
        const check = async () => {
            try {
                const data = await api.getHealth()
                setHealth(data)
            } catch {
                setHealth(null)
            }
        }
        check()
        const t = setInterval(check, 30000) // Check every 30s
        return () => clearInterval(t)
    }, [])

    if (!health) return null

    const isHealthy = health.status === 'healthy'
    const diskStatus = health.disk?.status || 'ok'
    const diskFree = health.disk?.free_gb
    const queuePending = health.queue?.pending || 0
    const isProcessing = health.queue?.processing

    return (
        <div className="hidden lg:flex items-center gap-3 text-xs">
            {/* Health dot */}
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                <span className="text-slate-500 dark:text-slate-400">{isHealthy ? 'Healthy' : 'Unhealthy'}</span>
            </div>

            {/* Processing status */}
            {isProcessing && (
                <div className="flex items-center gap-1 text-amber-500">
                    <div className="w-3 h-3 border-[1.5px] border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span>Processing</span>
                </div>
            )}

            {/* Queue */}
            {queuePending > 0 && (
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-[14px]">queue</span>
                    <span>Queue: {queuePending}</span>
                </div>
            )}

            {/* Disk */}
            {diskFree != null && (
                <div className={`flex items-center gap-1 ${DISK_STATUS_COLORS[diskStatus]}`}>
                    <span className="material-symbols-outlined text-[14px]">storage</span>
                    <span>{diskFree.toFixed(1)} GB</span>
                    {diskStatus === 'critical' && (
                        <span className="material-symbols-outlined text-[12px] text-red-500">warning</span>
                    )}
                </div>
            )}
        </div>
    )
}

export default HealthBadge
