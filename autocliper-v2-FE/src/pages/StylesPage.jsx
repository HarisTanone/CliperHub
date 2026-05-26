import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
        <label className="font-medium text-slate-500">{label}</label>
        <span className="text-slate-700 dark:text-slate-300 font-mono tabular-nums">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-[#324d67] rounded-full appearance-none cursor-pointer accent-primary" />
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
      <div className="relative rounded-[28px] overflow-hidden border-4 border-slate-800 shadow-2xl" style={{ width: PHONE_W, height: PHONE_H }}>
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
        <div className="absolute top-3 right-3 bg-primary/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />LIVE
        </div>
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <span className="material-symbols-outlined text-[13px]">preview</span>Live Preview
      </p>
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
  const [createForm, setCreateForm] = useState({ name: '', font_id: '', font_weight: 'bold', font_size: 48, color: '#FFFFFF', highlight_color: '#FFF45C', outline_color: '#000000', outline_width: 2, shadow_color: '#000000', shadow_offset_x: 2, shadow_offset_y: 2, line_spacing: 1.2, caption_bottom_margin: 70 })
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const role = localStorage.getItem('role')

  const filteredStyles = search.trim()
    ? styles.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.font_family?.toLowerCase().includes(search.toLowerCase()))
    : styles

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
      setCreateForm({ name: '', font_id: '', font_weight: 'bold', font_size: 48, color: '#FFFFFF', highlight_color: '#FFF45C', outline_color: '#000000', outline_width: 2, shadow_color: '#000000', shadow_offset_x: 2, shadow_offset_y: 2, line_spacing: 1.2, caption_bottom_margin: 70 })
    } catch { setError('Failed to create') }
    finally { setCreating(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const setC = (key, val) => setCreateForm(f => ({ ...f, [key]: val }))
  const canEdit = (style) => role === 'admin' || style.user_id !== null
  const isGlobal = (style) => style.user_id === null

  return (
    <div className="space-y-5">
      {/* Edit Panel */}
      {editing && (
        <div className="bg-white dark:bg-[#152230] rounded-2xl border-2 border-primary/30 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
              Editing: <span className="text-primary">{editing.name}</span>
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl hover:bg-slate-50 dark:hover:bg-[#192633] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl transition-colors font-semibold">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
          {error && <div className="mx-5 mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">{error}</div>}
          <div className="p-5 flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Name</label>
                  <input value={form.name || ''} onChange={e => set('name', e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Font</label>
                  <select value={form.font_id || ''} onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : ''
                    const fontName = id ? (fonts.find(f => f.id === id)?.name || form.font_family) : 'Arial'
                    setForm(f => ({ ...f, font_id: id, font_family: fontName }))
                  }}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors">
                    <option value="">Default (Arial)</option>
                    {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Font Weight</label>
                <div className="flex gap-2">
                  {['bold', 'normal'].map(w => (
                    <button key={w} onClick={() => set('font_weight', w)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${form.font_weight === w ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-[#324d67] text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Colors</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {COLOR_FIELDS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#324d67] cursor-pointer hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 flex-shrink-0">
                        <input type="color" value={form[key] || '#000000'} onChange={e => set(key, e.target.value)}
                          className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-150" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{form[key]}</p>
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
            </div>
            <div className="flex-shrink-0 flex justify-center lg:justify-start">
              <PhonePreview form={form} />
            </div>
          </div>
        </div>
      )}

      {/* Styles Grid */}
      <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-primary text-[20px]">palette</span>
            Caption Styles
            <span className="text-xs font-normal text-slate-400 ml-1">{styles.length} styles</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-400">search</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search styles..."
                className="w-40 pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 transition-colors" />
            </div>
            <button onClick={() => { setShowCreate(true); setError('') }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-primary/20">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Style
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="p-5 border-b border-slate-100 dark:border-[#233648] bg-slate-50/80 dark:bg-[#111d2b]">
            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">add_circle</span>
              Create New Style
            </h4>
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
                <input value={createForm.name} onChange={e => setC('name', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Font</label>
                <select value={createForm.font_id} onChange={e => setC('font_id', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors">
                  <option value="">Default (Arial)</option>
                  {fonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#324d67] cursor-pointer bg-white dark:bg-[#192633] hover:border-slate-300 transition-colors">
                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                    <input type="color" value={createForm[key] || '#000000'} onChange={e => setC(key, e.target.value)}
                      className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-150" />
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-slate-200 dark:border-[#324d67] rounded-xl hover:bg-slate-100 dark:hover:bg-[#192633] transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !createForm.name}
                className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl font-semibold transition-colors">
                {creating ? 'Creating...' : 'Create Style'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading styles...</p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStyles.map(style => (
              <div key={style.id}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${editing?.id === style.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-slate-200 dark:border-[#233648] hover:border-slate-300 dark:hover:border-[#324d67]'}`}>
                {/* Card preview */}
                <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950" />
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
                    <div className="absolute top-2 right-2 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[11px]">edit</span>EDITING
                    </div>
                  )}
                </div>
                {/* Card footer */}
                <div className="p-3 bg-white dark:bg-[#1a2d3f]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{style.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{style.font_family} · {style.font_weight} · {style.font_size}px</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {[style.color, style.highlight_color, style.outline_color].map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-600" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  {canEdit(style) && (
                    <div className="flex gap-2">
                      <button onClick={() => editing?.id === style.id ? setEditing(null) : handleEdit(style)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${editing?.id === style.id ? 'bg-slate-100 dark:bg-[#233648] text-slate-600 dark:text-slate-300' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`}>
                        <span className="material-symbols-outlined text-[14px]">{editing?.id === style.id ? 'close' : 'edit'}</span>
                        {editing?.id === style.id ? 'Close' : 'Edit'}
                      </button>
                      {!isGlobal(style) && (
                        <button onClick={() => handleDelete(style)} disabled={deleting === style.id}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <span className="material-symbols-outlined text-[16px]">{deleting === style.id ? 'hourglass_empty' : 'delete'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
      <div className="relative rounded-[28px] overflow-hidden border-4 border-slate-800 shadow-2xl" style={{ width: 270, height: 480 }}>
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
        <div className="absolute top-3 right-3 bg-primary/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />LIVE
        </div>
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1">
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
  const role = localStorage.getItem('role')
  const isAdmin = role === 'admin'

  const filteredHookStyles = search.trim()
    ? hookStyles.filter(hs => hs.name.toLowerCase().includes(search.toLowerCase()) || hs.fallback_font?.toLowerCase().includes(search.toLowerCase()))
    : hookStyles

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
    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined text-primary text-[20px]">format_quote</span>
          Hook Styles
          <span className="text-xs font-normal text-slate-400 ml-1">{hookStyles.length} styles</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-400">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hooks..."
              className="w-40 pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 transition-colors" />
          </div>
          {isAdmin && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-primary/20">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Hook Style
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      ) : hookStyles.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1e2e40] flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl text-slate-300">format_quote</span>
          </div>
          <p className="text-slate-500 font-medium">No hook styles yet</p>
          {isAdmin && <p className="text-xs text-slate-400 mt-1">Create one to add hook overlays to your clips</p>}
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHookStyles.map(hs => {
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
              <div key={hs.id} className="rounded-2xl border-2 border-slate-200 dark:border-[#233648] overflow-hidden hover:border-slate-300 dark:hover:border-[#324d67] transition-all">
                {/* Realistic preview */}
                <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url('${PREVIEW_BG}')` }} />
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="relative text-center px-3" style={{ background: boxBg, padding: hs.box_enable ? '6px 10px' : 0, borderRadius: hs.box_enable ? 4 : 0 }}>
                    <p style={{ color: hs.text_color, fontSize: hs.font_size_normal * scale, textShadow: shadowStyle, lineHeight: 1.2, margin: 0, fontFamily: font }}>This is a</p>
                    <p style={{ color: hs.keyword_color, fontSize: hs.font_size_keyword * scale, textShadow: shadowStyle, fontWeight: 900, lineHeight: 1.1, margin: 0, fontFamily: font, borderBottom: `2px solid ${underlineColor}` }}>HOOK TEXT</p>
                    <p style={{ color: hs.text_color, fontSize: hs.font_size_normal * scale, textShadow: shadowStyle, lineHeight: 1.2, margin: 0, fontFamily: font }}>preview</p>
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-[#1a2d3f]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{hs.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {hs.fallback_font || 'Default'} · {hs.font_size_normal}/{hs.font_size_keyword}px
                        {hs.box_enable && ' · Box'}
                        {hs.shadow_enable && ' · Shadow'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {[hs.text_color, hs.keyword_color, hs.keyword_underline_color].map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-600" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(hs)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                        <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                      </button>
                      <button onClick={() => handleDelete(hs)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
              <h4 className="text-lg font-semibold">{modal === 'create' ? 'New Hook Style' : `Edit: ${modal.name}`}</h4>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[18px] text-slate-400">close</span>
              </button>
            </div>
            <div className="p-6">
              {error && <p className="text-sm text-red-500 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">{error}</p>}
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Name *</label>
                    <input value={form.name || ''} onChange={e => set('name', e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Fallback Font</label>
                    <input value={form.fallback_font || ''} onChange={e => set('fallback_font', e.target.value)}
                      placeholder="e.g. Anton, Bebas Neue"
                      className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Colors</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {HOOK_COLOR_FIELDS.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-3 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#324d67] cursor-pointer hover:border-slate-300 transition-colors">
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                            <input type="color" value={form[key] || '#000000'} onChange={e => set(key, e.target.value)}
                              className="w-full h-full cursor-pointer border-0 p-0 bg-transparent scale-150" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{form[key]}</p>
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
                        className="w-4 h-4 rounded accent-primary" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Shadow</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.box_enable ?? false} onChange={e => set('box_enable', e.target.checked)}
                        className="w-4 h-4 rounded accent-primary" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Box Background</span>
                    </label>
                    {form.box_enable && (
                      <label className="flex items-center gap-2 cursor-pointer ml-2">
                        <div className="w-6 h-6 rounded overflow-hidden border border-slate-200">
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
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-[#233648]">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#192633] transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-colors">
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
    <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined text-primary text-[20px]">font_download</span>
          Fonts
          <span className="text-xs font-normal text-slate-400 ml-1">{fonts.length} fonts</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-slate-400">search</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fonts..."
              className="w-40 pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#324d67] rounded-xl bg-white dark:bg-[#192633] text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-primary/50 transition-colors" />
          </div>
          {isAdmin && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-primary/20">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Font
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading fonts...</p>
        </div>
      ) : fonts.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1e2e40] flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl text-slate-300">font_download</span>
          </div>
          <p className="text-slate-500 font-medium">No fonts added yet</p>
          {isAdmin && <p className="text-xs text-slate-400 mt-1">Add Google Fonts to use in caption styles</p>}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-[#1e2e40]">
          {filteredFonts.map(font => (
            <div key={font.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/80 dark:hover:bg-[#192633]/60 transition-colors group">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                <span className="text-xl font-black text-primary" style={{ fontFamily: font.name }}>Aa</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white" style={{ fontFamily: font.name }}>{font.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{font.file_name}</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5 truncate max-w-xs">{font.download_url}</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(font)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2e40] rounded-xl transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button onClick={() => handleDelete(font)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
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
          <div className="bg-white dark:bg-[#152230] rounded-2xl border border-slate-200 dark:border-[#233648] shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#233648] flex items-center justify-between">
              <h4 className="text-lg font-semibold">{modal === 'create' ? 'Add Font' : `Edit: ${modal.name}`}</h4>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e2e40] flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[18px] text-slate-400">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-sm text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">{error}</p>}
              {[
                { key: 'name', label: 'Font Name *', placeholder: 'e.g. Anton' },
                { key: 'file_name', label: 'File Name *', placeholder: 'e.g. Anton-Regular.ttf' },
                { key: 'download_url', label: 'Download URL *', placeholder: 'https://github.com/google/fonts/...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
                  <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl bg-slate-50 dark:bg-[#192633] text-sm focus:border-primary outline-none transition-colors" />
                </div>
              ))}
              {form.name && (
                <div className="p-3 bg-slate-50 dark:bg-[#192633] rounded-xl border border-slate-200 dark:border-[#324d67]">
                  <p className="text-xs text-slate-400 mb-1">Preview</p>
                  <p className="text-lg font-black" style={{ fontFamily: form.name }}>The quick brown fox</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border-2 border-slate-200 dark:border-[#324d67] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#192633] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.file_name || !form.download_url}
                className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-colors">
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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-transparent">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex gap-1 p-1 bg-white dark:bg-[#152230] border border-slate-200 dark:border-[#233648] rounded-2xl w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'bg-primary text-white shadow-sm shadow-primary/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e2e40]'}`}>
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
