import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import { TableRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const EMPTY_FORM = { username: '', password: '', email: '', role: 'user' }

function avatarColor(username) {
  let hash = 0
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  const colors = [
    { bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)' },
    { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
    { bg: 'var(--color-info-bg)', color: 'var(--color-info-text)' },
    { bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
    { bg: 'var(--color-error-bg)', color: 'var(--color-error-text)' },
  ]
  return colors[Math.abs(hash) % colors.length]
}

function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [search, setSearch] = useState('')
  const currentUsername = localStorage.getItem('username')

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await api.getUsers()
      if (Array.isArray(data)) setUsers(data)
    } finally { setLoading(false) }
  }

  const filteredUsers = search.trim()
    ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.role.includes(search.toLowerCase()))
    : users

  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setShowPass(false); setModal('create') }

  const openEdit = async (user) => {
    const detail = await api.getUser(user.id)
    setForm({ username: detail.username, email: detail.email || '', role: detail.role, is_active: detail.is_active, password: '' })
    setError(''); setShowPass(false); setModal(detail)
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        if (!form.username || !form.password) { setError('Username and password are required'); setSaving(false); return }
        const result = await api.createUser(form)
        if (result.detail) { setError(result.detail); return }
      } else {
        const { username, ...editable } = form
        const payload = Object.fromEntries(Object.entries(editable).filter(([, v]) => v !== '' && v !== undefined))
        const result = await api.updateUser(modal.id, payload)
        if (result.detail) { setError(result.detail); return }
      }
      setModal(null); loadUsers()
    } catch { setError('Request failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (user) => {
    if (!confirm(`Delete user "${user.username}"?`)) return
    const result = await api.deleteUser(user.id)
    if (result.detail) { alert(result.detail); return }
    loadUsers()
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const adminCount = users.filter(u => u.role === 'admin').length
  const activeCount = users.filter(u => u.is_active).length

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Stats */}
        {users.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: users.length, icon: 'group', gradient: 'linear-gradient(135deg, var(--crimson-wine), var(--burgundy))' },
              { label: 'Active', value: activeCount, icon: 'check_circle', gradient: 'linear-gradient(135deg, var(--color-success-text), #059669)' },
              { label: 'Admins', value: adminCount, icon: 'admin_panel_settings', gradient: 'linear-gradient(135deg, var(--deep-indigo), var(--dark-plum))' },
            ].map(s => (
              <motion.div
                key={s.label}
                whileHover={{ y: -2 }}
                className="rounded-2xl p-4 shadow-sm flex items-center gap-3"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.gradient }}>
                  <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Users list */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--icon-accent)' }}>group</span>
              Users
              <span className="text-xs font-normal ml-1" style={{ color: 'var(--color-text-muted)' }}>{users.length} total</span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px]" style={{ color: 'var(--icon-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
                  className="w-40 pl-8 pr-3 py-1.5 text-xs rounded-xl outline-none transition-colors"
                  style={{
                    background: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)'
                  }} />
              </div>
              <motion.button
                onClick={openCreate}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  boxShadow: 'var(--btn-primary-shadow)'
                }}
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Add User
              </motion.button>
            </div>
          </div>

          {loading ? (
            <TableRowSkeleton rows={4} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState type="noUsers" title={search ? `No users match "${search}"` : "No users found"} description={search ? "Try a different search" : "Add users to manage access to ClipForge"} />
          ) : (
            <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              {filteredUsers.map((user, i) => {
                const avatarStyle = avatarColor(user.username)
                return (
                  <div
                    key={user.id}
                    className="px-5 py-4 flex items-center gap-4 transition-colors group cursor-pointer"
                    style={{
                      borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base flex-shrink-0"
                      style={{ background: avatarStyle.bg, color: avatarStyle.color }}
                    >
                      {user.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{user.username}</p>
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            background: user.role === 'admin' ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)',
                            color: user.role === 'admin' ? 'var(--color-accent)' : 'var(--color-text-muted)'
                          }}
                        >
                          {user.role}
                        </span>
                        {!user.is_active && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}
                          >
                            inactive
                          </span>
                        )}
                        {user.username === currentUsername && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}
                          >
                            you
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {user.email || 'No email'} · Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(user)}
                        className="p-2 rounded-xl transition-colors cursor-pointer"
                        style={{ color: 'var(--icon-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--icon-muted)' }}
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      {user.username !== currentUsername && (
                        <button onClick={() => handleDelete(user)}
                          className="p-2 rounded-xl transition-colors cursor-pointer"
                          style={{ color: 'var(--color-error-text)' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            style={{ background: 'var(--color-bg-overlay)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="rounded-2xl shadow-2xl w-full max-w-md"
              style={{ background: 'var(--color-bg-modal)', border: '1px solid var(--color-border-default)' }}
            >
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {modal === 'create' ? 'Add User' : `Edit: ${modal.username}`}
                </h4>
                <button onClick={() => setModal(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  style={{ color: 'var(--icon-muted)' }}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {error && (
                  <div
                    className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', color: 'var(--color-error-text)' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">error</span>{error}
                  </div>
                )}
                {modal === 'create' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Username *</label>
                    <input value={form.username} onChange={e => set('username', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                      style={{
                        background: 'var(--color-bg-input)',
                        border: '2px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Password {modal !== 'create' && <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>(leave blank to keep)</span>}
                  </label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none transition-colors"
                      style={{
                        background: 'var(--color-bg-input)',
                        border: '2px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }} />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                      style={{ color: 'var(--icon-muted)' }}
                    >
                      <span className="material-symbols-outlined text-[16px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                    style={{
                      background: 'var(--color-bg-input)',
                      border: '2px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)'
                    }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Role</label>
                  <div className="flex gap-2">
                    {['user', 'admin'].map(r => (
                      <button key={r} type="button" onClick={() => set('role', r)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize cursor-pointer"
                        style={{
                          background: form.role === r ? 'var(--btn-primary-bg)' : 'transparent',
                          color: form.role === r ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                          border: form.role === r ? '2px solid var(--btn-primary-bg)' : '2px solid var(--color-border-default)'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {modal !== 'create' && (
                  <label
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{ border: '2px solid var(--color-border-default)' }}
                  >
                    <input type="checkbox" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)}
                      className="w-4 h-4 rounded accent-[var(--color-accent)]" />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Active Account</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Inactive users cannot log in</p>
                    </div>
                  </label>
                )}
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                  style={{
                    background: 'var(--btn-secondary-bg)',
                    color: 'var(--btn-secondary-text)',
                    border: '1px solid var(--btn-secondary-border)'
                  }}
                >
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)'
                  }}
                >
                  {saving ? 'Saving...' : modal === 'create' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default UsersPage
