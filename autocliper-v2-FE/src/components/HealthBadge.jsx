import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../utils/api'

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

    const diskStatusColor = {
        ok: 'var(--color-success-text)',
        warning: 'var(--color-warning-text)',
        critical: 'var(--color-error-text)',
    }

    return (
        <div className="hidden lg:flex items-center gap-3 text-xs">
            {/* Health dot */}
            <motion.div
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: isHealthy ? 'var(--color-success-text)' : 'var(--color-error-text)' }}
                />
                <span style={{ color: 'var(--color-text-muted)' }}>{isHealthy ? 'Healthy' : 'Unhealthy'}</span>
            </motion.div>

            {/* Processing status */}
            {isProcessing && (
                <motion.div
                    className="flex items-center gap-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ color: 'var(--color-warning-text)' }}
                >
                    <div
                        className="w-3 h-3 border-[1.5px] border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: 'var(--color-warning-text)', borderTopColor: 'transparent' }}
                    />
                    <span>Processing</span>
                </motion.div>
            )}

            {/* Queue */}
            {queuePending > 0 && (
                <div className="flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="material-symbols-outlined text-[14px]">queue</span>
                    <span>Queue: {queuePending}</span>
                </div>
            )}

            {/* Disk */}
            {diskFree != null && (
                <div className="flex items-center gap-1" style={{ color: diskStatusColor[diskStatus] }}>
                    <span className="material-symbols-outlined text-[14px]">storage</span>
                    <span>{diskFree.toFixed(1)} GB</span>
                    {diskStatus === 'critical' && (
                        <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-error-text)' }}>warning</span>
                    )}
                </div>
            )}
        </div>
    )
}

export default HealthBadge
