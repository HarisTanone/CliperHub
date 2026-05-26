import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api } from '../utils/api'

const Logo = () => (
  <div className="size-10 text-white flex items-center justify-center">
    <span className="material-symbols-outlined text-[36px]">movie_filter</span>
  </div>
)

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginDisabled, setLoginDisabled] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  // Countdown timer for rate limit cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const t = setInterval(() => {
      setCooldownSeconds(s => {
        if (s <= 1) {
          setLoginDisabled(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [cooldownSeconds])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (loginDisabled) return
    setError(''); setLoading(true)
    try {
      const { status, data } = await api.loginRaw(username, password)

      if (status === 429) {
        setError('Terlalu banyak percobaan login. Coba lagi dalam 5 menit.')
        setLoginDisabled(true)
        setCooldownSeconds(300)
        return
      }

      if (status === 403) {
        setError('Akun dinonaktifkan. Hubungi admin.')
        return
      }

      if (status === 401) {
        setError('Username atau password salah.')
        return
      }

      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
        localStorage.setItem('username', data.username)
        localStorage.setItem('role', data.role)
        onLoginSuccess()
      } else {
        setError(data.detail || 'Login failed')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-display bg-slate-50 dark:bg-[#0d1b2a]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-[#0a3d62] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.03]" />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Logo />
            <h1 className="text-3xl font-black text-white tracking-tight">ClipForge</h1>
          </div>
          <p className="text-white/70 text-lg leading-relaxed max-w-sm">
            AI-powered video clipping tool. Turn long YouTube videos into viral short clips automatically.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6 text-center">
            {[
              { icon: 'smart_display', label: 'Auto Clip' },
              { icon: 'subtitles', label: 'AI Captions' },
              { icon: 'trending_up', label: 'Viral Score' },
            ].map(f => (
              <div key={f.label} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[24px]">{f.icon}</span>
                </div>
                <span className="text-white/70 text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">movie_filter</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">ClipForge</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-400">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">person</span>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">lock</span>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:outline-none transition-colors text-sm"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || loginDisabled || !username || !password}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 mt-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
              ) : loginDisabled ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">timer</span>
                  Try again in {Math.floor(cooldownSeconds / 60)}:{String(cooldownSeconds % 60).padStart(2, '0')}
                </>
              ) : (
                <>Sign In<span className="material-symbols-outlined text-[18px]">arrow_forward</span></>
              )}
            </button>
          </form>


        </motion.div>
      </div>
    </div >
  )
}

export default LoginPage
