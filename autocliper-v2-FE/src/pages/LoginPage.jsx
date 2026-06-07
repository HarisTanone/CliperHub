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
        setError('Account disabled. Contact admin.')
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
    <div className="min-h-screen flex font-display" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Left panel - Gradient branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--crimson-wine), var(--burgundy), var(--dark-plum))' }}>
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.03]" />

        <div className="relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            <Logo />
            <h1 className="text-3xl font-black text-white tracking-tight">ClipForge</h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/70 text-lg leading-relaxed max-w-sm"
          >
            AI-powered video clipping tool. Turn long YouTube videos into viral short clips automatically.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 grid grid-cols-3 gap-6 text-center"
          >
            {[
              { icon: 'smart_display', label: 'Auto Clip' },
              { icon: 'subtitles', label: 'AI Captions' },
              { icon: 'trending_up', label: 'Viral Score' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <span className="material-symbols-outlined text-white text-[24px]">{f.icon}</span>
                </div>
                <span className="text-white/70 text-sm font-medium">{f.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--color-bg-primary)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--crimson-wine), var(--burgundy))' }}>
              <span className="material-symbols-outlined text-white text-xl">movie_filter</span>
            </div>
            <h1 className="text-xl font-black gradient-text">ClipForge</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Welcome back</h2>
            <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>Sign in to your account</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl text-sm"
              style={{
                background: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-border)',
                color: 'var(--color-error-text)'
              }}
            >
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]"
                  style={{ color: 'var(--icon-muted)' }}>person</span>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all outline-none"
                  style={{
                    background: 'var(--color-bg-input)',
                    border: '2px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-border-focus)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--color-border-default)'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px]"
                  style={{ color: 'var(--icon-muted)' }}>lock</span>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl text-sm transition-all outline-none"
                  style={{
                    background: 'var(--color-bg-input)',
                    border: '2px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-border-focus)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--color-border-default)'}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                  style={{ color: 'var(--icon-muted)' }}>
                  <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading || loginDisabled || !username || !password}
              whileHover={{ scale: loading || loginDisabled ? 1 : 1.02 }}
              whileTap={{ scale: loading || loginDisabled ? 1 : 0.98 }}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: loading || loginDisabled || !username || !password
                  ? 'var(--color-border-default)'
                  : 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                boxShadow: loading || loginDisabled || !username || !password ? 'none' : 'var(--btn-primary-shadow)'
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : loginDisabled ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">timer</span>
                  Try again in {Math.floor(cooldownSeconds / 60)}:{String(cooldownSeconds % 60).padStart(2, '0')}
                </>
              ) : (
                <>
                  Sign In
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

export default LoginPage
