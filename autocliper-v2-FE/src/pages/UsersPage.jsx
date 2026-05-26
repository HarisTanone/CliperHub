import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../utils/api'
import { FadeInUp, StaggerContainer, StaggerItem } from '../components/PageTransition'
import { TableRowSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const EMPTY_FORM = { username: '', password: '', email: '', role: 'user' }

const AVATAR_COLORS = [
  'bg-primary/20 text-primary',
  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
]

function avatarColor(username) {
  let hash = 0
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Stats */}
        {users.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Users', value: users.length, icon: 'group', color: 'bg-primary' },
              { label: 'Active', value: activeCount, icon: 'check_circle', color: 'bg-emerald-500' },
              { label: 'Admins', value: adminCount, icon: 'admin_panel_settings', color: 'bg-violet-500' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] p-4 shadow-sm flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <span className="material-symbols-outlined text-white text-[20px]">{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Users list */}
        <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <span className="material-symbols-outlined text-primary text-[20px]">group</span>
              Users
              <span className="text-xs font-normal text-slate-400 ml-1">{users.length} total</span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-400">search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
                  className="w-40 pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 transition-colors" />
              </div>
              <button onClick={openCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-primary/20">
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Add User
              </button>
            </div>
          </div>

          {loading ? (
            <TableRowSkeleton rows={4} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState type="noUsers" title={search ? `No users match "${search}"` : "No users found"} description={search ? "Try a different search" : "Add users to manage access to ClipForge"} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1e2e40]">
              {filteredUsers.map(user => (
                <div key={user.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/80 dark:hover:bg-[#192633]/60 transition-colors group">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base flex-shrink-0 ${avatarColor(user.username)}`}>
                    {user.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 dark:text-white">{user.username}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-[#1e2e40] text-slate-500 dark:text-slate-400'}`}>
                        {user.role}
                      </span>
                      {!user.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          inactive
                        </span>
                      )}
                      {user.username === currentUsername && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                          you
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {user.email || 'No email'} · Joined {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(user)}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2e40] rounded-xl transition-colors">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    {user.username !== currentUsername && (
                      <button onClick={() => handleDelete(user)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-2xl w-full max-w-md"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
                <h4 className="text-lg font-semibold">{modal === 'create' ? 'Add User' : `Edit: ${modal.username}`}</h4>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-[16px]">error</span>{error}
                  </div>
                )}
                {modal === 'create' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Username *</label>
                    <input value={form.username} onChange={e => set('username', e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Password {modal !== 'create' && <span className="font-normal text-slate-400">(leave blank to keep)</span>}
                  </label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Role</label>
                  <div className="flex gap-2">
                    {['user', 'admin'].map(r => (
                      <button key={r} type="button" onClick={() => set('role', r)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${form.role === r ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-[#324d67] text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {modal !== 'create' && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-[#324d67] cursor-pointer hover:border-slate-300 transition-colors">
                    <input type="checkbox" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active Account</p>
                      <p className="text-xs text-slate-400">Inactive users cannot log in</p>
                    </div>
                  </label>
                )}
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#192633] transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-colors">
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
