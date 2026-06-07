import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, loadGoogleFonts, flattenHookStyle, buildHookStylePayload } from '../utils/api'

const PREVIEW_BG = "https://lh3.googleusercontent.com/aida-public/AB6AXuBR8v7XkC5vNu8cT77RaDOH4JfdHz-jjqDZnXfNWnC1yftxffImbLrXQnp0Wc7uCVKDdmFIGTKf4i0uR3BneXMYGm4g0sURS6lQWj20A_od6g5NVwaRH39JjwGctm7e8L_ixngiEO7COOxJdLZp0AJg0K2Xay6coqna9CtqsDt92xch-THdSapYp4bQ9Nq_WQmkhDhFv_qS3ft45j18zz402xoje1TvphZHMvgRNUwa2hMhsJoIORa3iCMC9UUNE_TWVNWgtkTEXgRi"

const COLOR_FIELDS = [
  { key: 'color', label: 'Text' },
  { key: 'highlight_color', label: 'Highlight' },
  { key: 'outline_color', label: 'Outline' },
  { key: 'shadow_color', label: 'Shadow' },
]

const PHONE_W = 270, PHONE_H = 480, VIDEO_W = 608

function Slider({ label, value, min, max, step = 1, unit = 'px', onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <label className="font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
        <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: 'var(--color-border-default)', accentColor: 'var(--color-accent)' }} />
    </div>
  )
}

function PhonePreview({ form }) {
  if (!form) return null
  const scaleX = PHONE_W / VIDEO_W
  const scaledFont = Math.max(10, Math.floor(form.font_size * (VIDEO_W / 400)) * scaleX)
  const bottom = Math.round((form.caption_bottom_margin || 70) * (PHONE_H / 1080))
  const baseStyle = {
    color: form.color, fontFamily: form.font_family,
    fontSize: `${scaledFont}px`, fontWeight: form.font_weight,
    lineHeight: form.line_spacing, margin: 0,
    WebkitTextStroke: `${(form.outline_width || 0) * scaleX}px ${form.outline_color}`,
    textShadow: `${(form.shadow_offset_x || 0) * scaleX}px ${(form.shadow_offset_y || 0) * scaleX}px 0px ${form.shadow_color}`,
  }
  const highlightStyle = { ...baseStyle, color: form.highlight_color }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative rounded-[28px] overflow-hidden border-4 shadow-2xl" style={{ width: PHONE_W, height: PHONE_H, borderColor: 'var(--color-border-strong)' }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute top-3 left-0 right-0 flex items-center justify-center gap-6 text-white text-xs font-semibold">
          <span className="opacity-60">Following</span>
          <span className="border-b-2 border-white pb-0.5">For You</span>
        </div>
        <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4">
          {['favorite', 'chat_bubble', 'share'].map(icon => (
            <div key={icon} className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[16px]">{icon}</span>
            </div>
          ))}
        </div>
        <div className="absolute bottom-3 left-3 right-12">
          <p className="text-white text-[10px] font-bold">@clipforge</p>
          <p className="text-white/60 text-[9px] truncate">ClipForge ✨</p>
        </div>
        <div className="absolute left-0 right-0 px-3 text-center" style={{ bottom }}>
          <p style={baseStyle}>THIS IS HOW YOUR</p>
          <p style={highlightStyle}>CAPTIONS WILL</p>
          <p style={baseStyle}>LOOK ON TIKTOK</p>
        </div>
        <div className="absolute top-3 right-3 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'var(--color-accent)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />LIVE
        </div>
      </div>
      <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
        <span className="material-symbols-outlined text-[13px]">preview</span>Live Preview
      </p>
    </div>
  )
}

// Animated phone preview that simulates caption appearance like actual video output
const CAPTION_WORDS_PREVIEW = [
  { normal: ['inget', 'banget'], highlight: 'usahain', after: ['salam'] },
  { normal: ['yang', 'paling'], highlight: 'penting', after: ['itu'] },
  { normal: ['harus', 'bisa'], highlight: 'konsisten', after: [] },
]

function AnimatedPhonePreview({ style: s }) {
  const [lineIndex, setLineIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setLineIndex(prev => {
        if (prev >= CAPTION_WORDS_PREVIEW.length - 1) {
          setTimeout(() => setAnimKey(k => k + 1), 500)
          return 0
        }
        return prev + 1
      })
    }, 1400)
    return () => clearInterval(interval)
  }, [animKey])

  if (!s) return null

  // Scale: video is 1080x1920, preview phone is 280x498
  const PW = 280, PH = 498
  const scale = PW / 1080

  // Read config for advanced styling
  const config = s.config || {}
  const bgPill = config.background_pill || {}
  const hlConfig = config.highlight || {}
  const textTransform = config.text_transform || 'none'

  const fontSize = Math.max(12, Math.round((s.font_size || 20) * scale * 3))
  const outlineW = (s.outline_width || 0) * scale * 2
  const shadowX = (s.shadow_offset_x || 0) * scale * 2
  const shadowY = (s.shadow_offset_y || 0) * scale * 2
  const bottomMargin = Math.max(16, Math.round((s.caption_bottom_margin || 70) * scale))

  // Background pill style from config
  const pillStyle = bgPill.enable ? {
    background: bgPill.color ? `${bgPill.color}${Math.round((bgPill.opacity || 200) / 255 * 255).toString(16).padStart(2, '0')}` : 'rgba(26,10,46,0.78)',
    padding: `${(bgPill.padding_y || 8) * scale * 1.5}px ${(bgPill.padding_x || 16) * scale * 1.5}px`,
    borderRadius: `${(bgPill.border_radius || 12) * scale * 1.5}px`,
    display: 'inline-block',
  } : {}

  // Highlight with glow from config
  const getHighlightStyle = () => {
    const base = {
      color: s.highlight_color || '#FF69B4',
      fontFamily: s.font_family || 'Poppins',
      fontSize: `${fontSize}px`,
      fontWeight: s.font_weight || 'bold',
      lineHeight: s.line_spacing || 1.2,
      display: 'inline',
    }
    if (hlConfig.style === 'glow' && hlConfig.glow_color) {
      base.textShadow = `0 0 ${(hlConfig.glow_radius || 8) * scale * 2}px ${hlConfig.glow_color}, 0 0 ${(hlConfig.glow_radius || 8) * scale * 4}px ${hlConfig.glow_color}40, ${shadowX}px ${shadowY}px 0px ${s.shadow_color || '#000'}`
    } else {
      base.textShadow = `${shadowX}px ${shadowY}px 0px ${s.shadow_color || '#000'}`
    }
    if (outlineW > 0) base.WebkitTextStroke = `${outlineW}px ${s.outline_color || '#000'}`
    return base
  }

  const normalStyle = {
    color: s.color || '#FFFFFF',
    fontFamily: s.font_family || 'Poppins',
    fontSize: `${fontSize}px`,
    fontWeight: s.font_weight || 'bold',
    lineHeight: s.line_spacing || 1.2,
    display: 'inline',
    textShadow: `${shadowX}px ${shadowY}px 0px ${s.shadow_color || '#000'}`,
    ...(outlineW > 0 ? { WebkitTextStroke: `${outlineW}px ${s.outline_color || '#000'}` } : {}),
  }

  const applyTransform = (text) => {
    if (textTransform === 'uppercase') return text.toUpperCase()
    if (textTransform === 'lowercase') return text.toLowerCase()
    return text
  }

  const currentLine = CAPTION_WORDS_PREVIEW[lineIndex]

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative rounded-[28px] overflow-hidden shadow-2xl" style={{ width: PW, height: PH, border: '2.5px solid rgba(255,255,255,0.1)', background: '#000' }}>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-black rounded-b-xl z-10" />

        {/* Video background */}
        <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />

        {/* Side icons */}
        <div className="absolute right-2.5 bottom-24 flex flex-col items-center gap-3">
          {['favorite', 'chat_bubble', 'share'].map(icon => (
            <div key={icon} className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[16px]">{icon}</span>
            </div>
          ))}
        </div>

        {/* Username */}
        <div className="absolute bottom-3 left-3 right-12">
          <p className="text-white text-[10px] font-bold">@clipforge</p>
          <p className="text-white/50 text-[8px]">#viral #shorts</p>
        </div>

        {/* Animated Caption with config styling */}
        <div className="absolute left-0 right-0 px-3 text-center" style={{ bottom: bottomMargin }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${animKey}-${lineIndex}`}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={pillStyle}
            >
              <span style={normalStyle}>{applyTransform(currentLine.normal.join(' '))} </span>
              <span style={getHighlightStyle()}>{applyTransform(currentLine.highlight)}</span>
              {currentLine.after.length > 0 && <span style={normalStyle}> {applyTransform(currentLine.after.join(' '))}</span>}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* LIVE badge */}
        <div className="absolute top-4 right-3 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--color-accent)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
        </div>
      </div>

      {/* Replay */}
      <button onClick={() => { setAnimKey(k => k + 1); setLineIndex(0) }}
        className="text-[10px] font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors"
        style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)' }}>
        <span className="material-symbols-outlined text-[12px]">replay</span>Replay
      </button>
    </div>
  )
}

// Config Editor for advanced caption style settings (background pill, highlight glow, animation)
function ConfigEditor({ config, onChange }) {
  const [expanded, setExpanded] = useState(false)

  const bgPill = config.background_pill || {}
  const highlight = config.highlight || {}
  const animation = config.animation || {}

  const updateConfig = (section, key, value) => {
    const updated = { ...config }
    if (!updated[section]) updated[section] = {}
    updated[section] = { ...updated[section], [key]: value }
    onChange(updated)
  }

  return (
    <div className="pt-2">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
        <span className="text-[11px] font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>tune</span>
          Advanced Config
          {Object.keys(config).length > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-success-text)' }} />}
        </span>
        <span className={`material-symbols-outlined text-[14px] transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }}>expand_more</span>
      </button>

      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-4 overflow-hidden">
          {/* Background Pill */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Background Pill</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={bgPill.enable || false}
                  onChange={e => updateConfig('background_pill', 'enable', e.target.checked)}
                  className="w-3.5 h-3.5 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>Enable</span>
              </label>
            </div>
            {bgPill.enable && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-[9px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={bgPill.color || '#1A0A2E'}
                      onChange={e => updateConfig('background_pill', 'color', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0" />
                    <span className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{bgPill.color || '#1A0A2E'}</span>
                  </div>
                </div>
                <Slider label="Opacity" value={bgPill.opacity || 200} min={0} max={255} unit="" onChange={v => updateConfig('background_pill', 'opacity', v)} />
                <Slider label="Padding X" value={bgPill.padding_x || 20} min={0} max={60} onChange={v => updateConfig('background_pill', 'padding_x', v)} />
                <Slider label="Padding Y" value={bgPill.padding_y || 10} min={0} max={30} onChange={v => updateConfig('background_pill', 'padding_y', v)} />
                <Slider label="Border Radius" value={bgPill.border_radius || 16} min={0} max={40} onChange={v => updateConfig('background_pill', 'border_radius', v)} />
              </div>
            )}
          </div>

          {/* Highlight Glow */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Highlight Effect</span>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[9px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Style</label>
                <select value={highlight.style || 'none'}
                  onChange={e => updateConfig('highlight', 'style', e.target.value)}
                  className="select mt-1 text-xs py-1.5">
                  <option value="none">None</option>
                  <option value="glow">Glow</option>
                  <option value="underline">Underline</option>
                </select>
              </div>
              {highlight.style === 'glow' && (
                <>
                  <div>
                    <label className="text-[9px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Glow Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={highlight.glow_color || '#FF69B4'}
                        onChange={e => updateConfig('highlight', 'glow_color', e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0" />
                      <span className="text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{highlight.glow_color || '#FF69B4'}</span>
                    </div>
                  </div>
                  <Slider label="Glow Radius" value={highlight.glow_radius || 10} min={0} max={30} onChange={v => updateConfig('highlight', 'glow_radius', v)} />
                  <Slider label="Glow Opacity" value={highlight.glow_opacity || 200} min={0} max={255} unit="" onChange={v => updateConfig('highlight', 'glow_opacity', v)} />
                </>
              )}
            </div>
          </div>

          {/* Animation */}
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-subtle)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Animation</span>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[9px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Enter Type</label>
                <select value={animation.chunk_enter || 'fade_up'}
                  onChange={e => updateConfig('animation', 'chunk_enter', e.target.value)}
                  className="select mt-1 text-xs py-1.5">
                  <option value="fade_up">Fade Up</option>
                  <option value="fade_in">Fade In</option>
                  <option value="scale_up">Scale Up</option>
                  <option value="pop_in">Pop In</option>
                </select>
              </div>
              <Slider label="Duration" value={animation.enter_duration || 0.15} min={0.05} max={0.5} step={0.05} unit="s" onChange={v => updateConfig('animation', 'enter_duration', v)} />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function CaptionStylesTab() {
  const [styles, setStyles] = useState([])
  const [fonts, setFonts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', font_id: '', font_family: 'Arial', font_weight: 'bold', font_size: 48, color: '#FFFFFF', highlight_color: '#FFF45C', outline_color: '#000000', outline_width: 2, shadow_color: '#000000', shadow_offset_x: 2, shadow_offset_y: 2, line_spacing: 1.2, caption_bottom_margin: 70, config: {} })
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const role = localStorage.getItem('role')
  const PER_PAGE = 6

  const filteredStyles = search.trim()
    ? styles.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.font_family?.toLowerCase().includes(search.toLowerCase()))
    : styles

  const totalPages = Math.ceil(filteredStyles.length / PER_PAGE) || 1
  const paginatedStyles = filteredStyles.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  useEffect(() => { setPage(0) }, [search])

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [s, f] = await Promise.all([api.getStyles(), api.getFonts()])
      if (Array.isArray(s)) setStyles(s)
      if (Array.isArray(f)) { setFonts(f); loadGoogleFonts(f) }
    } finally { setLoading(false) }
  }

  const handleEdit = async (style) => {
    const detail = await api.getStyle(style.id)
    setEditing(detail); setForm({ ...detail }); setError('')
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const { font_family, id, user_id, ...editable } = form
      const result = await api.updateStyle(editing.id, editable)
      if (result.detail) { setError(result.detail); return }
      setStyles(s => s.map(st => st.id === editing.id ? result : st))
      setEditing(null)
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async (style) => {
    if (!confirm(`Delete style "${style.name}"?`)) return
    setDeleting(style.id)
    try {
      const result = await api.deleteStyle(style.id)
      if (result.detail) { alert(result.detail); return }
      setStyles(s => s.filter(st => st.id !== style.id))
      if (editing?.id === style.id) setEditing(null)
    } finally { setDeleting(null) }
  }

  const handleCreate = async () => {
    setCreating(true); setError('')
    try {
      const payload = { ...createForm }
      if (!payload.font_id) delete payload.font_id
      else payload.font_id = Number(payload.font_id)
      const result = await api.createStyle(payload)
      if (result.detail) { setError(result.detail); return }
      setStyles(s => [...s, result])
      setShowCreate(false)
      setCreateForm({ name: '', font_id: '', font_family: 'Arial', font_weight: 'bold', font_size: 48, color: '#FFFFFF', highlight_color: '#FFF45C', outline_color: '#000000', outline_width: 2, shadow_color: '#000000', shadow_offset_x: 2, shadow_offset_y: 2, line_spacing: 1.2, caption_bottom_margin: 70, config: {} })
    } catch { setError('Failed to create') }
    finally { setCreating(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setC = (key, val) => setCreateForm(f => ({ ...f, [key]: val }))
  const canEdit = (style) => role === 'admin' || style.user_id !== null
  const isGlobal = (style) => style.user_id === null
  const [selectedPreview, setSelectedPreview] = useState(null)

  const handleCardClick = (style) => {
    setSelectedPreview(selectedPreview?.id === style.id ? null : style)
  }

  return (
    <div className="flex gap-5">
      {/* Left: Cards + Pagination */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="rounded-2xl border shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col"
              style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}
              onClick={e => e.stopPropagation()}>
              {/* Header - fixed */}
              <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>tune</span>
                  Edit Style: <span style={{ color: 'var(--color-accent)' }}>{editing.name}</span>
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
              {error && <div className="mx-6 mt-4 p-3 rounded-xl text-sm flex-shrink-0" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>{error}</div>}
              {/* Body - two panels */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                {/* Left: scrollable settings */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Name</label>
                      <input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Style name"
                        className="input" />
                    </div>
                    <div>
                      <label className="form-label">Font</label>
                      <select value={form.font_id || ''} onChange={e => {
                        const id = e.target.value ? Number(e.target.value) : ''
                        const fontName = id ? (fonts.find(f => f.id === id)?.name || form.font_family) : 'Arial'
                        setForm(f => ({ ...f, font_id: id, font_family: fontName }))
                      }}
                        className="select">
                        <option value="">Default (Arial)</option>
                        {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Font Weight</label>
                    <div className="flex gap-2">
                      {['bold', 'normal'].map(w => (
                        <button key={w} onClick={() => set('font_weight', w)}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all capitalize"
                          style={{
                            background: form.font_weight === w ? 'var(--btn-primary-bg)' : 'transparent',
                            color: form.font_weight === w ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                            borderColor: form.font_weight === w ? 'var(--btn-primary-bg)' : 'var(--color-border-default)'
                          }}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Colors</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {COLOR_FIELDS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-input)' }}>
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--color-border-subtle)' }}>
                            <input type="color" value={form[key] || '#000000'} onChange={e => set(key, e.target.value)}
                              className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-150" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
                            <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{form[key]}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Slider label="Font Size" value={form.font_size || 48} min={8} max={100} onChange={v => set('font_size', v)} />
                    <Slider label="Line Spacing" value={form.line_spacing || 1} min={1} max={3} step={0.1} unit="" onChange={v => set('line_spacing', v)} />
                    <Slider label="Outline Width" value={form.outline_width || 0} min={0} max={10} onChange={v => set('outline_width', v)} />
                    <Slider label="Bottom Margin" value={form.caption_bottom_margin || 70} min={0} max={300} onChange={v => set('caption_bottom_margin', v)} />
                    <Slider label="Shadow X" value={form.shadow_offset_x || 0} min={0} max={20} onChange={v => set('shadow_offset_x', v)} />
                    <Slider label="Shadow Y" value={form.shadow_offset_y || 0} min={0} max={20} onChange={v => set('shadow_offset_y', v)} />
                  </div>
                  {/* Advanced Config */}
                  <ConfigEditor config={form.config || {}} onChange={c => set('config', c)} />
                </div>
                {/* Right: fixed preview (no scroll) */}
                <div className="w-[300px] flex-shrink-0 hidden lg:flex items-center justify-center p-4" style={{ borderLeft: '1px solid var(--color-border-subtle)' }}>
                  <AnimatedPhonePreview style={form} />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Styles Grid */}
        <div className="rounded-2xl border shadow-sm" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>palette</span>
              Caption Styles
              <span className="text-[10px] font-normal ml-1 px-2 py-0.5 rounded-full" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-1)' }}>{filteredStyles.length}</span>
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] transition-colors group-focus-within:text-[var(--icon-accent)]" style={{ color: 'var(--icon-muted)' }}>search</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search styles..."
                  className="w-44 pl-9 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
                  style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
              <button onClick={() => { setShowCreate(true); setError('') }}
                className="btn btn-primary btn-sm">
                <span className="material-symbols-outlined text-[16px]">add</span>
                New Style
              </button>
            </div>
          </div>

          {showCreate && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="rounded-2xl border shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}
                onClick={e => e.stopPropagation()}>
                {/* Header - fixed */}
                <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <h4 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>add_circle</span>
                    Create New Style
                  </h4>
                  <div className="flex gap-2">
                    <button onClick={() => setShowCreate(false)} className="btn btn-secondary btn-sm">Cancel</button>
                    <button onClick={handleCreate} disabled={creating || !createForm.name}
                      className="btn btn-primary btn-sm">
                      {creating ? 'Creating...' : 'Create Style'}
                    </button>
                  </div>
                </div>
                {error && <div className="mx-6 mt-4 p-3 rounded-xl text-sm flex-shrink-0" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>{error}</div>}
                {/* Body - two panels */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                  {/* Left: scrollable settings */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Name *</label>
                        <input value={createForm.name} onChange={e => setC('name', e.target.value)}
                          placeholder="My Caption Style" className="input" />
                      </div>
                      <div>
                        <label className="form-label">Font</label>
                        <select value={createForm.font_id} onChange={e => {
                          const id = e.target.value
                          const fontName = id ? (fonts.find(f => f.id === Number(id))?.name || 'Arial') : 'Arial'
                          setCreateForm(f => ({ ...f, font_id: id, font_family: fontName }))
                        }}
                          className="select">
                          <option value="">Default (Arial)</option>
                          {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Font Weight</label>
                      <div className="flex gap-2">
                        {['bold', 'normal'].map(w => (
                          <button key={w} onClick={() => setC('font_weight', w)}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all capitalize"
                            style={{
                              background: createForm.font_weight === w ? 'var(--btn-primary-bg)' : 'transparent',
                              color: createForm.font_weight === w ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                              borderColor: createForm.font_weight === w ? 'var(--btn-primary-bg)' : 'var(--color-border-default)'
                            }}>
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Colors</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {COLOR_FIELDS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-input)' }}>
                            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--color-border-subtle)' }}>
                              <input type="color" value={createForm[key] || '#000000'} onChange={e => setC(key, e.target.value)}
                                className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-150" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
                              <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{createForm[key]}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Slider label="Font Size" value={createForm.font_size || 48} min={8} max={100} onChange={v => setC('font_size', v)} />
                      <Slider label="Line Spacing" value={createForm.line_spacing || 1.2} min={1} max={3} step={0.1} unit="" onChange={v => setC('line_spacing', v)} />
                      <Slider label="Outline Width" value={createForm.outline_width || 0} min={0} max={10} onChange={v => setC('outline_width', v)} />
                      <Slider label="Bottom Margin" value={createForm.caption_bottom_margin || 70} min={0} max={300} onChange={v => setC('caption_bottom_margin', v)} />
                      <Slider label="Shadow X" value={createForm.shadow_offset_x || 0} min={0} max={20} onChange={v => setC('shadow_offset_x', v)} />
                      <Slider label="Shadow Y" value={createForm.shadow_offset_y || 0} min={0} max={20} onChange={v => setC('shadow_offset_y', v)} />
                    </div>
                    {/* Advanced Config */}
                    <ConfigEditor config={createForm.config || {}} onChange={c => setC('config', c)} />
                  </div>
                  {/* Right: fixed preview (no scroll) */}
                  <div className="w-[300px] flex-shrink-0 hidden lg:flex items-center justify-center p-4" style={{ borderLeft: '1px solid var(--color-border-subtle)' }}>
                    <AnimatedPhonePreview style={createForm} />
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading styles...</p>
            </div>
          ) : (
            <>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginatedStyles.map(style => (
                  <div key={style.id}
                    onClick={() => handleCardClick(style)}
                    className="rounded-2xl border-2 overflow-hidden transition-all cursor-pointer hover:scale-[1.02]"
                    style={{
                      borderColor: selectedPreview?.id === style.id ? 'var(--color-accent)' : editing?.id === style.id ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                      boxShadow: selectedPreview?.id === style.id ? 'var(--shadow-glow)' : editing?.id === style.id ? 'var(--shadow-glow)' : 'none'
                    }}>
                    {/* Card preview */}
                    <div className="aspect-video flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, var(--color-surface-2), var(--color-bg-primary))' }} />
                      <div className="relative text-center px-3">
                        <p className="font-black text-base drop-shadow-lg leading-tight"
                          style={{ color: style.color, fontFamily: style.font_family }}>
                          {style.name}
                        </p>
                        <p className="text-xs mt-0.5 font-bold drop-shadow"
                          style={{ color: style.highlight_color, fontFamily: style.font_family }}>
                          HIGHLIGHT TEXT
                        </p>
                      </div>
                      {isGlobal(style) && (
                        <div className="absolute top-2 left-2 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          GLOBAL
                        </div>
                      )}
                      {editing?.id === style.id && (
                        <div className="absolute top-2 right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'var(--color-accent)' }}>
                          <span className="material-symbols-outlined text-[11px]">edit</span>EDITING
                        </div>
                      )}
                    </div>
                    {/* Card footer */}
                    <div className="px-2.5 py-2" style={{ background: 'var(--color-bg-card)' }}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{style.name}</p>
                          <p className="text-[9px] truncate" style={{ color: 'var(--color-text-muted)' }}>{style.font_family} · {style.font_size}px</p>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                          {[style.color, style.highlight_color, style.outline_color].map((c, i) => (
                            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, border: '1px solid var(--color-border-subtle)' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filteredStyles.length)} of {filteredStyles.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                      style={{ border: '1px solid var(--color-border-default)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                    </button>
                    <span className="text-xs font-medium tabular-nums px-2" style={{ color: 'var(--color-text-secondary)' }}>{page + 1} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                      style={{ border: '1px solid var(--color-border-default)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Live Preview Panel */}
      {selectedPreview && (
        <motion.div
          key={selectedPreview.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-[340px] flex-shrink-0 hidden lg:block"
        >
          <div className="sticky top-4">
            <div className="rounded-2xl border overflow-hidden shadow-lg" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>preview</span>
                  Live Preview
                </p>
                <button onClick={() => setSelectedPreview(null)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-1)]" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
              <div className="p-4 flex justify-center">
                <AnimatedPhonePreview style={selectedPreview} />
              </div>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{selectedPreview.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{selectedPreview.font_family} · {selectedPreview.font_weight} · {selectedPreview.font_size}px</p>
                <div className="flex items-center gap-1.5 pt-1">
                  {[selectedPreview.color, selectedPreview.highlight_color, selectedPreview.outline_color, selectedPreview.shadow_color].map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-md" style={{ backgroundColor: c, border: '1px solid var(--color-border-subtle)' }} />
                  ))}
                </div>
                {canEdit(selectedPreview) && (
                  <button onClick={() => handleEdit(selectedPreview)} className="btn btn-primary btn-sm w-full mt-3">
                    <span className="material-symbols-outlined text-[14px]">edit</span>Edit Style
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

const HOOK_COLOR_FIELDS = [
  { key: 'text_color', label: 'Text' },
  { key: 'keyword_color', label: 'Keyword' },
  { key: 'shadow_color', label: 'Shadow' },
  { key: 'keyword_underline_color', label: 'Underline' },
]

function HookPreview({ form }) {
  if (!form) return null
  const [animKey, setAnimKey] = useState(0)
  const scale = 270 / 608
  const shadowStyle = form.shadow_enable
    ? `${form.shadow_blur === 0 ? '2px' : '0px'} ${form.shadow_blur === 0 ? '4px' : '0px'} ${form.shadow_blur || 0}px rgba(0,0,0,${((form.shadow_opacity || 0) / 255).toFixed(2)})`
    : 'none'
  const font = form.fallback_font || 'inherit'
  const underlineColor = form.keyword_underline_opacity > 0 ? form.keyword_underline_color : 'transparent'
  const boxBg = form.box_enable
    ? `rgba(${parseInt(form.box_color.slice(1, 3), 16)},${parseInt(form.box_color.slice(3, 5), 16)},${parseInt(form.box_color.slice(5, 7), 16)},${((form.box_opacity || 0) / 255).toFixed(2)})`
    : 'transparent'

  // Glow effect CSS
  const glowEnable = form._raw?.config?.glow?.enable
  const glowColor = form._raw?.config?.glow?.color || form.keyword_color
  const glowRadius = (form._raw?.config?.glow?.radius || 8) * scale
  const glowStyle = glowEnable ? `0 0 ${glowRadius}px ${glowColor}, 0 0 ${glowRadius * 2}px ${glowColor}40` : ''

  // Outline
  const outlineEnable = form._raw?.config?.outline?.enable
  const outlineColor = form._raw?.config?.outline?.color || '#000000'
  const outlineWidth = (form._raw?.config?.outline?.width || 2) * scale
  const outlineStyle = outlineEnable ? `${outlineWidth}px ${outlineColor}` : 'unset'

  // Keyword background pill
  const kwBgEnable = form._raw?.config?.keyword?.background?.enable
  const kwBgColor = form._raw?.config?.keyword?.background?.color || '#E84545'
  const kwBgOpacity = (form._raw?.config?.keyword?.background?.opacity || 200) / 255

  // Animation type
  const animType = form._raw?.config?.animation?.type || form.fade_in > 0 ? 'fade' : 'fade'
  const animDuration = (form.fade_in || 0.3) + 's'

  // Map animation type to framer-motion variants
  const getAnimVariants = () => {
    const t = form._raw?.config?.animation?.type || 'fade'
    switch (t) {
      case 'scale_up': return { initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1 } }
      case 'pop_in': case 'bounce': return { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: [0.5, 1.15, 1] } }
      case 'elastic': return { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: [0.6, 1.2, 0.95, 1.05, 1] } }
      case 'slide_up': return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } }
      case 'slide_down': return { initial: { opacity: 0, y: -40 }, animate: { opacity: 1, y: 0 } }
      case 'slide_left': return { initial: { opacity: 0, x: -50 }, animate: { opacity: 1, x: 0 } }
      case 'slide_right': return { initial: { opacity: 0, x: 50 }, animate: { opacity: 1, x: 0 } }
      case 'zoom_burst': return { initial: { opacity: 0, scale: 2 }, animate: { opacity: 1, scale: 1 } }
      case 'glitch': return { initial: { opacity: 0, x: -5 }, animate: { opacity: 1, x: [5, -3, 2, 0] } }
      case 'shake': return { initial: { opacity: 0 }, animate: { opacity: 1, x: [0, -4, 4, -2, 2, 0] } }
      case 'kinetic': return { initial: { opacity: 0, scale: 0.5, y: 30 }, animate: { opacity: 1, scale: 1, y: 0 } }
      case 'rotation_intro': return { initial: { opacity: 0, rotate: -10, scale: 0.8 }, animate: { opacity: 1, rotate: 0, scale: 1 } }
      case 'cinematic_slow': return { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } }
      case 'typewriter': return { initial: { opacity: 0 }, animate: { opacity: 1 } }
      case 'stagger_words': return { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } }
      default: return { initial: { opacity: 0 }, animate: { opacity: 1 } }
    }
  }

  const variants = getAnimVariants()
  const transition = {
    duration: form.fade_in || 0.4,
    ease: form._raw?.config?.animation?.type === 'elastic' ? [0.68, -0.55, 0.27, 1.55] :
      form._raw?.config?.animation?.type === 'bounce' ? [0.34, 1.56, 0.64, 1] : [0.25, 0.46, 0.45, 0.94]
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative rounded-[28px] overflow-hidden border-4 shadow-2xl" style={{ width: 270, height: 480, borderColor: 'var(--color-border-strong)' }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
        <div className="absolute inset-0 bg-black/40" />
        <motion.div
          key={animKey}
          initial={variants.initial}
          animate={variants.animate}
          transition={transition}
          className="absolute left-0 right-0 flex flex-col items-center justify-center" style={{ top: '30%', padding: '0 16px' }}
        >
          <div style={{ background: boxBg, padding: form.box_enable ? '8px 12px' : 0, borderRadius: form.box_enable ? (form._raw?.config?.box?.border_radius || 4) : 0, textAlign: 'center' }}>
            <p style={{ color: form.text_color, fontSize: (form.font_size_normal || 48) * scale, textShadow: shadowStyle, lineHeight: 1.25, margin: 0, fontFamily: font, WebkitTextStroke: outlineStyle }}>
              This is a sample
            </p>
            <p style={{
              color: form.keyword_color,
              fontSize: (form.font_size_keyword || 68) * scale,
              textShadow: glowEnable ? `${shadowStyle}, ${glowStyle}` : shadowStyle,
              fontWeight: 900, lineHeight: 1.15, margin: 0, fontFamily: font,
              borderBottom: underlineColor !== 'transparent' ? `2px solid ${underlineColor}` : 'none',
              WebkitTextStroke: outlineStyle,
              background: kwBgEnable ? `rgba(${parseInt(kwBgColor.slice(1, 3), 16)},${parseInt(kwBgColor.slice(3, 5), 16)},${parseInt(kwBgColor.slice(5, 7), 16)},${kwBgOpacity})` : 'transparent',
              padding: kwBgEnable ? '2px 6px' : 0,
              borderRadius: kwBgEnable ? '4px' : 0,
            }}>
              HOOK TEXT
            </p>
            <p style={{ color: form.text_color, fontSize: (form.font_size_normal || 48) * scale, textShadow: shadowStyle, lineHeight: 1.25, margin: 0, fontFamily: font, WebkitTextStroke: outlineStyle }}>
              for your video
            </p>
          </div>
        </motion.div>
        {/* Animation type badge */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center">
          <span className="bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 rounded-full">
            {form._raw?.config?.animation?.type || 'fade'}
          </span>
        </div>
        {/* Replay button */}
        <button onClick={() => setAnimKey(k => k + 1)}
          className="absolute top-3 left-3 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors">
          <span className="material-symbols-outlined text-white text-[14px]">replay</span>
        </button>
        <div className="absolute top-3 right-3 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'var(--color-accent)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />LIVE
        </div>
      </div>
      <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
        <span className="material-symbols-outlined text-[13px]">preview</span>Hook Preview
        <button onClick={() => setAnimKey(k => k + 1)} className="ml-2 text-primary text-[10px] font-semibold hover:underline">Replay</button>
      </p>
    </div>
  )
}

function HookStylesTab() {
  const [hookStyles, setHookStyles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [hookPage, setHookPage] = useState(0)
  const role = localStorage.getItem('role')
  const isAdmin = role === 'admin'
  const HOOK_PER_PAGE = 6

  const filteredHookStyles = search.trim()
    ? hookStyles.filter(hs => hs.name.toLowerCase().includes(search.toLowerCase()) || hs.fallback_font?.toLowerCase().includes(search.toLowerCase()))
    : hookStyles

  const hookTotalPages = Math.ceil(filteredHookStyles.length / HOOK_PER_PAGE) || 1
  const paginatedHookStyles = filteredHookStyles.slice(hookPage * HOOK_PER_PAGE, (hookPage + 1) * HOOK_PER_PAGE)

  useEffect(() => { setHookPage(0) }, [search])

  const EMPTY = { name: '', text_color: '#FFFFFF', keyword_color: '#FFD700', shadow_color: '#000000', shadow_opacity: 180, shadow_blur: 10, shadow_enable: true, keyword_underline_color: '#FFD700', keyword_underline_opacity: 200, font_size_normal: 48, font_size_keyword: 68, fallback_font: '', box_enable: false, box_color: '#000000', box_opacity: 0, fade_in: 0.4, fade_out: 0.4 }

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getHookStyles()
      if (Array.isArray(data)) setHookStyles(data.map(flattenHookStyle))
    } finally { setLoading(false) }
  }

  const openCreate = () => { setForm({ ...EMPTY }); setError(''); setModal('create') }
  const openEdit = (hs) => { setForm({ ...hs }); setError(''); setModal(hs) }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      let result
      const payload = buildHookStylePayload(form)
      if (modal === 'create') {
        result = await api.createHookStyle(payload)
      } else {
        result = await api.updateHookStyle(modal.id, payload)
      }
      if (result.detail) { setError(result.detail); return }
      setModal(null); load()
    } catch { setError('Request failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (hs) => {
    if (!confirm(`Delete hook style "${hs.name}"?`)) return
    const result = await api.deleteHookStyle(hs.id)
    if (result.detail) { alert(result.detail); return }
    setHookStyles(s => s.filter(h => h.id !== hs.id))
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
          Hook Styles
          <span className="text-[10px] font-normal ml-1 px-2 py-0.5 rounded-full" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-1)' }}>{filteredHookStyles.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] transition-colors group-focus-within:text-[var(--icon-accent)]" style={{ color: 'var(--icon-muted)' }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hooks..."
              className="w-44 pl-9 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
              style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
          </div>
          {isAdmin && (
            <button onClick={openCreate} className="btn btn-primary btn-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Hook Style
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
        </div>
      ) : hookStyles.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--color-surface-1)' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-text-muted)' }}>format_quote</span>
          </div>
          <p className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>No hook styles yet</p>
          {isAdmin && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Create one to add hook overlays to your clips</p>}
        </div>
      ) : (
        <>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginatedHookStyles.map(hs => {
              const scale = 0.22
              const shadowStyle = hs.shadow_enable
                ? `${hs.shadow_blur === 0 ? '2px' : '0px'} ${hs.shadow_blur === 0 ? '4px' : '0px'} ${hs.shadow_blur}px rgba(0,0,0,${(hs.shadow_opacity / 255).toFixed(2)})`
                : 'none'
              const font = hs.fallback_font || 'inherit'
              const underlineColor = hs.keyword_underline_opacity > 0 ? hs.keyword_underline_color : 'transparent'
              const boxBg = hs.box_enable
                ? `rgba(${parseInt(hs.box_color.slice(1, 3), 16)},${parseInt(hs.box_color.slice(3, 5), 16)},${parseInt(hs.box_color.slice(5, 7), 16)},${(hs.box_opacity / 255).toFixed(2)})`
                : 'transparent'
              return (
                <div key={hs.id} className="rounded-2xl border-2 overflow-hidden transition-all" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {/* Realistic preview */}
                  <div className="aspect-video flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                    <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="relative text-center px-3" style={{ background: boxBg, padding: hs.box_enable ? '6px 10px' : 0, borderRadius: hs.box_enable ? 4 : 0 }}>
                      <p style={{ color: hs.text_color, fontSize: hs.font_size_normal * scale, textShadow: shadowStyle, lineHeight: 1.2, margin: 0, fontFamily: font }}>This is a</p>
                      <p style={{ color: hs.keyword_color, fontSize: hs.font_size_keyword * scale, textShadow: shadowStyle, fontWeight: 900, lineHeight: 1.1, margin: 0, fontFamily: font, borderBottom: `2px solid ${underlineColor}` }}>HOOK TEXT</p>
                      <p style={{ color: hs.text_color, fontSize: hs.font_size_normal * scale, textShadow: shadowStyle, lineHeight: 1.2, margin: 0, fontFamily: font }}>preview</p>
                    </div>
                  </div>
                  <div className="p-3" style={{ background: 'var(--color-bg-card)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{hs.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          {hs.fallback_font || 'Default'} · {hs.font_size_normal}/{hs.font_size_keyword}px
                          {hs.box_enable && ' · Box'}
                          {hs.shadow_enable && ' · Shadow'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {[hs.text_color, hs.keyword_color, hs.keyword_underline_color].map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c, border: '1px solid var(--color-border-subtle)' }} />
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(hs)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                          <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                        </button>
                        <button onClick={() => handleDelete(hs)}
                          className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--color-error-text)' }}>
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Hook Pagination */}
          {hookTotalPages > 1 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {hookPage * HOOK_PER_PAGE + 1}–{Math.min((hookPage + 1) * HOOK_PER_PAGE, filteredHookStyles.length)} of {filteredHookStyles.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setHookPage(p => Math.max(0, p - 1))} disabled={hookPage === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                  style={{ border: '1px solid var(--color-border-default)' }}>
                  <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_left</span>
                </button>
                <span className="text-xs font-medium tabular-nums px-2" style={{ color: 'var(--color-text-secondary)' }}>{hookPage + 1} / {hookTotalPages}</span>
                <button onClick={() => setHookPage(p => Math.min(hookTotalPages - 1, p + 1))} disabled={hookPage >= hookTotalPages - 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all"
                  style={{ border: '1px solid var(--color-border-default)' }}>
                  <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-text-muted)' }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{modal === 'create' ? 'New Hook Style' : `Edit: ${modal.name}`}</h4>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-6">
              {error && <p className="text-sm mb-4 p-3 rounded-xl" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>{error}</p>}
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="form-label">Name *</label>
                    <input value={form.name || ''} onChange={e => set('name', e.target.value)}
                      className="input" />
                  </div>
                  <div>
                    <label className="form-label">Fallback Font</label>
                    <input value={form.fallback_font || ''} onChange={e => set('fallback_font', e.target.value)}
                      placeholder="e.g. Anton, Bebas Neue"
                      className="input" />
                  </div>
                  <div>
                    <label className="form-label">Colors</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {HOOK_COLOR_FIELDS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 p-2.5 rounded-xl border-2 cursor-pointer transition-colors" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-input)' }}>
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--color-border-subtle)' }}>
                            <input type="color" value={form[key] || '#000000'} onChange={e => set(key, e.target.value)}
                              className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-150" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
                            <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{form[key]}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Slider label="Normal Font Size" value={form.font_size_normal || 48} min={12} max={80} onChange={v => set('font_size_normal', v)} />
                    <Slider label="Keyword Font Size" value={form.font_size_keyword || 68} min={12} max={100} onChange={v => set('font_size_keyword', v)} />
                    <Slider label="Shadow Blur" value={form.shadow_blur || 10} min={0} max={40} onChange={v => set('shadow_blur', v)} />
                    <Slider label="Shadow Opacity" value={form.shadow_opacity || 180} min={0} max={255} unit="" onChange={v => set('shadow_opacity', v)} />
                    <Slider label="Underline Opacity" value={form.keyword_underline_opacity || 200} min={0} max={255} unit="" onChange={v => set('keyword_underline_opacity', v)} />
                    <Slider label="Fade In" value={form.fade_in ?? 0.4} min={0} max={1} step={0.05} unit="s" onChange={v => set('fade_in', v)} />
                    <Slider label="Fade Out" value={form.fade_out ?? 0.4} min={0} max={1} step={0.05} unit="s" onChange={v => set('fade_out', v)} />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.shadow_enable ?? true} onChange={e => set('shadow_enable', e.target.checked)}
                        className="w-4 h-4 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Shadow</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.box_enable ?? false} onChange={e => set('box_enable', e.target.checked)}
                        className="w-4 h-4 rounded" style={{ accentColor: 'var(--color-accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Box Background</span>
                    </label>
                    {form.box_enable && (
                      <label className="flex items-center gap-2 cursor-pointer ml-2">
                        <div className="w-6 h-6 rounded overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
                          <input type="color" value={form.box_color || '#000000'} onChange={e => set('box_color', e.target.value)}
                            className="w-full h-full cursor-pointer border-0 p-0 scale-150" />
                        </div>
                        <Slider label="Box Opacity" value={form.box_opacity || 160} min={0} max={255} unit="" onChange={v => set('box_opacity', v)} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex justify-center">
                  <HookPreview form={form} />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <button onClick={() => setModal(null)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name}
                  className="btn btn-primary flex-1">
                  {saving ? 'Saving...' : modal === 'create' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FontsTab() {
  const [fonts, setFonts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', file_name: '', download_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const role = localStorage.getItem('role')
  const isAdmin = role === 'admin'

  const filteredFonts = search.trim()
    ? fonts.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.file_name.toLowerCase().includes(search.toLowerCase()))
    : fonts

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getFonts()
      if (Array.isArray(data)) { setFonts(data); loadGoogleFonts(data) }
    } finally { setLoading(false) }
  }

  const openCreate = () => { setForm({ name: '', file_name: '', download_url: '' }); setError(''); setModal('create') }
  const openEdit = (f) => { setForm({ name: f.name, file_name: f.file_name, download_url: f.download_url }); setError(''); setModal(f) }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const result = modal === 'create' ? await api.createFont(form) : await api.updateFont(modal.id, form)
      if (result.detail) { setError(result.detail); return }
      setModal(null); load()
    } catch { setError('Request failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (font) => {
    if (!confirm(`Delete font "${font.name}"?`)) return
    const result = await api.deleteFont(font.id)
    if (result.detail) { alert(result.detail); return }
    setFonts(f => f.filter(x => x.id !== font.id))
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-accent)' }}>font_download</span>
          Fonts
          <span className="text-[10px] font-normal ml-1 px-2 py-0.5 rounded-full" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface-1)' }}>{fonts.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] transition-colors group-focus-within:text-[var(--icon-accent)]" style={{ color: 'var(--icon-muted)' }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fonts..."
              className="w-44 pl-9 pr-3 py-2 text-xs rounded-xl outline-none transition-all"
              style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }} />
          </div>
          {isAdmin && (
            <button onClick={openCreate} className="btn btn-primary btn-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Font
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading fonts...</p>
        </div>
      ) : fonts.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--color-surface-1)' }}>
            <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--color-text-muted)' }}>font_download</span>
          </div>
          <p className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>No fonts added yet</p>
          {isAdmin && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Add Google Fonts to use in caption styles</p>}
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {filteredFonts.map(font => (
            <div key={font.id} className="px-5 py-4 flex items-center gap-4 transition-colors group" style={{ background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent-border)' }}>
                <span className="text-xl font-black" style={{ fontFamily: font.name, color: 'var(--color-accent)' }}>Aa</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ fontFamily: font.name, color: 'var(--color-text-primary)' }}>{font.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{font.file_name}</p>
                <p className="text-[10px] mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>{font.download_url}</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(font)}
                    className="p-2 rounded-xl transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button onClick={() => handleDelete(font)}
                    className="p-2 rounded-xl transition-colors" style={{ color: 'var(--color-error-text)' }}>
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border shadow-2xl w-full max-w-md" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-subtle)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
              <h4 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{modal === 'create' ? 'Add Font' : `Edit: ${modal.name}`}</h4>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-sm p-3 rounded-xl" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error-text)' }}>{error}</p>}
              {[
                { key: 'name', label: 'Font Name *', placeholder: 'e.g. Anton' },
                { key: 'file_name', label: 'File Name *', placeholder: 'e.g. Anton-Regular.ttf' },
                { key: 'download_url', label: 'Download URL *', placeholder: 'https://github.com/google/fonts/...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
                    className="input" />
                </div>
              ))}
              {form.name && (
                <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Preview</p>
                  <p className="text-lg font-black" style={{ fontFamily: form.name, color: 'var(--color-text-primary)' }}>The quick brown fox</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.file_name || !form.download_url}
                className="btn btn-primary flex-1">
                {saving ? 'Saving...' : modal === 'create' ? 'Add Font' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { key: 'captions', label: 'Caption Styles', icon: 'palette' },
  { key: 'hooks', label: 'Hook Styles', icon: 'format_quote' },
  { key: 'fonts', label: 'Fonts', icon: 'font_download' },
]

function StylesPage() {
  const [tab, setTab] = useState('captions')

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex gap-1 p-1 rounded-2xl w-fit shadow-sm" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === t.key ? 'var(--btn-primary-bg)' : 'transparent',
                color: tab === t.key ? 'var(--btn-primary-text)' : 'var(--color-text-secondary)',
                boxShadow: tab === t.key ? 'var(--btn-primary-shadow)' : 'none'
              }}>
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'captions' && <CaptionStylesTab />}
        {tab === 'hooks' && <HookStylesTab />}
        {tab === 'fonts' && <FontsTab />}
      </div>
    </div>
  )
}

export default StylesPage
