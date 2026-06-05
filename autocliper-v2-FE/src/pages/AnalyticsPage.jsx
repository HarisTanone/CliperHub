import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../utils/api'
import { FadeInUp } from '../components/PageTransition'

function StatCard({ icon, label, value, sub, color = 'bg-primary' }) {
    return (
        <motion.div whileHover={{ y: -2 }}
            className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <span className="material-symbols-outlined text-white text-[20px]">{icon}</span>
                </div>
                <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                    {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
                </div>
            </div>
        </motion.div>
    )
}

function ScoreDistribution({ data }) {
    if (!data) return null
    const total = Object.values(data).reduce((s, v) => s + v, 0) || 1
    const bars = [
        { key: 'excellent', label: '90%+', color: 'bg-emerald-500', count: data.excellent || 0 },
        { key: 'good', label: '75-89%', color: 'bg-primary', count: data.good || 0 },
        { key: 'average', label: '60-74%', color: 'bg-amber-500', count: data.average || 0 },
        { key: 'low', label: '<60%', color: 'bg-slate-400', count: data.low || 0 },
    ]

    return (
        <div className="space-y-2.5">
            {bars.map(bar => (
                <div key={bar.key} className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 w-12 text-right">{bar.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-[#1e2e40] rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(bar.count / total) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className={`h-full rounded-full ${bar.color}`}
                        />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 w-8">{bar.count}</span>
                </div>
            ))}
        </div>
    )
}

function TopClipRow({ clip, rank }) {
    const scorePct = Math.round((clip.score || 0) * 100)
    return (
        <div className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-[#192633]/60 rounded-xl transition-colors">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${rank <= 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-[#1e2e40] text-slate-500'
                }`}>
                {rank}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{clip.hook}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{clip.duration}s</p>
            </div>
            <span className={`text-xs font-bold tabular-nums ${scorePct >= 90 ? 'text-emerald-500' : scorePct >= 75 ? 'text-primary' : 'text-slate-400'
                }`}>
                {scorePct}%
            </span>
        </div>
    )
}

function UsageChart({ data }) {
    if (!data?.length) return <p className="text-xs text-slate-400 text-center py-8">No data yet</p>
    const maxJobs = Math.max(...data.map(d => d.jobs), 1)

    return (
        <div className="flex items-end gap-1 h-32">
            {data.map((day, i) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(day.jobs / maxJobs) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.02 }}
                        className="w-full bg-primary/20 hover:bg-primary/40 rounded-t transition-colors min-h-[2px]"
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {day.date.slice(5)}: {day.jobs} jobs ({day.completed} done, {day.failed} failed)
                    </div>
                </div>
            ))}
        </div>
    )
}

function AnalyticsPage() {
    const [overview, setOverview] = useState(null)
    const [usage, setUsage] = useState(null)
    const [clips, setClips] = useState([])
    const [period, setPeriod] = useState('7d')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        const days = parseInt(period) || 7
        Promise.all([
            api.getAnalyticsOverview(),
            api.getUsageStats(period),
            api.getClipsAnalytics(days),
        ]).then(([ov, us, cl]) => {
            if (!ov.detail) setOverview(ov)
            if (!us.detail) setUsage(us)
            if (!cl.detail && cl.clips) setClips(cl.clips)
        }).catch(() => { }).finally(() => setLoading(false))
    }, [period])

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    // Build summary from overview response
    const summary = {
        total_jobs: overview?.total_videos_processed || 0,
        total_clips: overview?.total_clips_generated || 0,
        avg_score: clips.length > 0
            ? clips.reduce((sum, c) => sum + (c.score || 0), 0) / clips.length
            : 0,
        success_rate: overview?.total_videos_processed > 0 ? 100 : 0,
        total_failed: 0,
    }

    // Build score distribution from clips data
    const scoreDistribution = clips.reduce((acc, c) => {
        const pct = Math.round((c.score || 0) * 100)
        if (pct >= 90) acc.excellent++
        else if (pct >= 75) acc.good++
        else if (pct >= 60) acc.average++
        else acc.low++
        return acc
    }, { excellent: 0, good: 0, average: 0, low: 0 })

    // Get top clips sorted by score
    const topClips = [...clips]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 10)

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Stats Grid */}
                <FadeInUp>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon="work_history" label="Total Jobs" value={summary.total_jobs || 0} color="bg-primary" />
                        <StatCard icon="movie_filter" label="Clips Generated" value={summary.total_clips || 0} color="bg-emerald-500" />
                        <StatCard icon="trending_up" label="Avg Score" value={`${Math.round((summary.avg_score || 0) * 100)}%`} color="bg-violet-500" />
                        <StatCard icon="check_circle" label="Success Rate" value={`${summary.success_rate || 0}%`}
                            sub={`${summary.total_failed || 0} failed`} color="bg-amber-500" />
                    </div>
                </FadeInUp>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Usage Chart */}
                    <FadeInUp delay={0.1}>
                        <div className="lg:col-span-2 bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Activity</h3>
                                <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-[#1e2e40] rounded-lg">
                                    {['7d', '30d', '90d'].map(p => (
                                        <button key={p} onClick={() => setPeriod(p)}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${period === p ? 'bg-white dark:bg-[#152230] text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                }`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <UsageChart data={usage?.daily_stats} />
                            <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
                                <span>{usage?.daily_stats?.[0]?.date}</span>
                                <span>{usage?.daily_stats?.[usage?.daily_stats?.length - 1]?.date}</span>
                            </div>
                        </div>
                    </FadeInUp>

                    {/* Score Distribution */}
                    <FadeInUp delay={0.15}>
                        <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-5 shadow-sm">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Score Distribution</h3>
                            <ScoreDistribution data={scoreDistribution} />
                        </div>
                    </FadeInUp>
                </div>

                {/* Top Clips */}
                <FadeInUp delay={0.2}>
                    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648]">
                            <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-amber-500 text-[20px]">emoji_events</span>
                                Top Performing Clips
                            </h3>
                        </div>
                        <div className="p-2">
                            {topClips.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-8">No clips data yet</p>
                            ) : (
                                topClips.map((clip, i) => (
                                    <TopClipRow key={`${clip.job_id}-${clip.clip_index}`} clip={clip} rank={i + 1} />
                                ))
                            )}
                        </div>
                    </div>
                </FadeInUp>
            </div>
        </div>
    )
}

export default AnalyticsPage
