import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../utils/api'
import { buildCaptionWordStyle, buildCaptionPillStyle, buildHookWordStyle, buildHookBoxStyle } from '../utils/remotionStyleUtils'
import RemotionPreview from '../components/RemotionPreview'

// ═══════════════════════════════════════════════════════════════
// REMOTION STYLES PAGE — Pro-level UI with animated previews
// ═══════════════════════════════════════════════════════════════

// ─── Category Badge ─────────────────────────────────────────────────────────
const categoryConfig = {
  viral: { color: 'var(--color-error-text)', bg: 'var(--color-error-bg)', border: 'var(--color-error-border)', icon: 'local_fire_department' },
  minimal: { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-1)', border: 'var(--color-border-default)', icon: 'remove' },
  gaming: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', icon: 'sports_esports' },
  edu: { color: 'var(--color-info-text)', bg: 'var(--color-info-bg)', border: 'var(--color-info-border)', icon: 'school' },
  aesthetic: { color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.25)', icon: 'spa' },
  cinematic: { color: 'var(--color-warning-text)', bg: 'var(--color-warning-bg)', border: 'var(--color-warning-border)', icon: 'movie' },
  hype: { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)', icon: 'bolt' },
  general: { color: 'var(--color-text-muted)', bg: 'var(--color-surface-1)', border: 'var(--color-border-subtle)', icon: 'category' },
}

function CategoryBadge({ category }) {
  const cfg = categoryConfig[category] || categoryConfig.general
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span className="material-symbols-outlined text-[10px]">{cfg.icon}</span>
      {category}
    </span>
  )
}

// ─── CSS-based Live Caption Preview ─────────────────────────────────────────
function CaptionPreview({ template }) {
  const words = ['This', 'is', 'how', 'your', 'caption', 'will', 'look']
  const [activeIdx, setActiveIdx] = useState(4)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % words.length)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  const wordStyle = (i) => {
    const isActive = i === activeIdx
    const base = {
      fontFamily: template.font_family || 'Inter',
      fontWeight: template.font_weight || '700',
      fontSize: `${Math.min(template.font_size || 48, 28)}px`,
      color: isActive ? (template.highlight_color || '#FFD700') : (template.color || '#FFFFFF'),
      textTransform: template.text_transform || 'none',
      display: 'inline-block',
      margin: '0 2px',
      transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }

    if (template.outline_enabled) {
      const oc = template.outline_color || '#000000'
      const ow = Math.min(template.outline_width || 2, 2)
      base.WebkitTextStroke = `${ow}px ${oc}`
    }

    if (template.shadow_enabled) {
      const sc = template.shadow_color || '#000000'
      const sb = template.shadow_blur || 4
      base.textShadow = `0 ${template.shadow_offset_y || 2}px ${sb}px ${sc}`
    }

    if (template.bg_enabled && template.bg_per_word) {
      base.backgroundColor = template.bg_color || '#000000'
      base.padding = '1px 5px'
      base.borderRadius = `${Math.min(template.bg_border_radius || 8, 10)}px`
      base.opacity = template.bg_opacity || 0.7
    }

    if (isActive && template.highlight_style === 'scale') {
      base.transform = 'scale(1.15)'
    }
    if (isActive && template.highlight_style === 'glow') {
      base.textShadow = `0 0 8px ${template.highlight_color || '#FFD700'}, 0 0 16px ${template.highlight_color || '#FFD700'}`
    }

    return base
  }

  const lineStyle = {}
  if (template.bg_enabled && !template.bg_per_word) {
    lineStyle.backgroundColor = template.bg_color || '#000000'
    lineStyle.padding = '3px 10px'
    lineStyle.borderRadius = `${template.bg_border_radius || 8}px`
    lineStyle.opacity = template.bg_opacity || 0.7
  }

  return (
    <div className="flex flex-wrap justify-center items-center gap-0.5 p-2 min-h-[60px]">
      <div style={lineStyle} className="flex flex-wrap justify-center gap-0.5">
        {words.map((w, i) => (
          <motion.span
            key={i}
            style={wordStyle(i)}
            animate={i === activeIdx ? { scale: 1.05 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {w}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

// ─── CSS-based Live Hook Preview ────────────────────────────────────────────
function HookPreview({ template }) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => !p)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  const normalStyle = {
    fontFamily: template.font_family || 'Anton',
    fontWeight: template.font_weight || '400',
    fontSize: `${Math.min(template.font_size_normal || 36, 18)}px`,
    color: template.color || '#FFFFFF',
    textTransform: template.text_transform || 'uppercase',
  }

  const keywordStyle = {
    ...normalStyle,
    fontSize: `${Math.min(template.font_size_keyword || 56, 26)}px`,
    color: template.keyword_color || '#FFFFFF',
    fontWeight: 900,
  }

  if (template.shadow_enabled) {
    const shadow = `0 ${template.shadow_offset_y || 3}px ${template.shadow_blur || 12}px ${template.shadow_color || '#000000'}`
    normalStyle.textShadow = shadow
    keywordStyle.textShadow = shadow
  }

  if (template.glow_enabled) {
    const gc = template.glow_color || '#FFFFFF'
    const gr = template.glow_radius || 8
    keywordStyle.textShadow = `0 0 ${gr}px ${gc}, 0 0 ${gr * 2}px ${gc}`
  }

  if (template.keyword_underline_enabled) {
    keywordStyle.borderBottom = `${template.keyword_underline_thickness || 3}px solid ${template.keyword_underline_color || '#FFFFFF'}`
    keywordStyle.paddingBottom = '2px'
  }

  if (template.keyword_bg_enabled) {
    keywordStyle.backgroundColor = template.keyword_bg_color || '#FF0000'
    keywordStyle.padding = '2px 6px'
    keywordStyle.borderRadius = '4px'
  }

  if (template.gradient_enabled && template.gradient_colors?.length >= 2) {
    const colors = template.gradient_colors.join(', ')
    keywordStyle.background = `linear-gradient(${template.gradient_direction || 'to right'}, ${colors})`
    keywordStyle.WebkitBackgroundClip = 'text'
    keywordStyle.WebkitTextFillColor = 'transparent'
  }

  const boxStyle = {}
  if (template.box_enabled) {
    boxStyle.backgroundColor = template.box_color || '#000000'
    boxStyle.opacity = template.box_opacity || 0.6
    boxStyle.padding = `${Math.min(template.box_padding || 20, 12)}px`
    boxStyle.borderRadius = `${Math.min(template.box_border_radius || 12, 10)}px`
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 min-h-[60px] p-2" style={boxStyle}>
      <span style={normalStyle}>Did you know</span>
      <motion.span
        style={keywordStyle}
        animate={pulse ? { scale: 1.08 } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
      >
        THIS
      </motion.span>
      <span style={normalStyle}>trick?</span>
    </div>
  )
}

// ─── Template Card with Animated Preview ────────────────────────────────────
function TemplateCard({ template, type, selected, onSelect, index }) {
  const isSelected = selected?.id === template.id
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={() => onSelect(template)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer rounded-2xl overflow-hidden transition-all group"
      style={{
        border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
        background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)',
        boxShadow: isSelected ? 'var(--shadow-glow)' : hovered ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: hovered && !isSelected ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Preview Area */}
      <div
        className="aspect-[9/11] flex items-center justify-center overflow-hidden relative"
        style={{
          background: 'linear-gradient(160deg, rgba(0,0,0,0.9) 0%, rgba(20,10,30,0.95) 100%)',
        }}
      >
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 80%, ${type === 'caption' ? 'rgba(201,74,110,0.15)' : 'rgba(129,140,248,0.15)'} 0%, transparent 60%)`,
          }}
          animate={hovered ? { opacity: 1 } : { opacity: 0.4 }}
        />

        {type === 'caption'
          ? <CaptionPreview template={template} />
          : <HookPreview template={template} />
        }

        {/* Hover overlay */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered && !isSelected ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'var(--btn-primary-bg)', color: 'white' }}
            initial={{ scale: 0.8 }}
            animate={{ scale: hovered ? 1 : 0.8 }}
          >
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Select
          </motion.div>
        </motion.div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--color-text-primary)' }}>
            {template.name}
          </span>
          {template.is_default && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}>
              DEFAULT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={template.category} />
          <span className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
            {template.remotion_component || template.animation_type || template.font_family}
          </span>
        </div>
        {template.description && (
          <p className="text-[10px] line-clamp-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {template.description}
          </p>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-10"
          style={{ background: 'var(--color-accent)' }}
        >
          <span className="material-symbols-outlined text-white text-[14px]">check</span>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Composition Card ───────────────────────────────────────────────────────
function CompositionCard({ comp, selected, onSelect, index }) {
  const isSelected = selected?.id === comp.id
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => onSelect(comp)}
      className="cursor-pointer rounded-2xl border p-5 transition-all group"
      style={{
        border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
        background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)',
        boxShadow: isSelected ? 'var(--shadow-glow)' : 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{comp.name}</h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{comp.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {comp.is_default && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid var(--color-accent-border)' }}>
              DEFAULT
            </span>
          )}
          {isSelected && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-accent)' }}>
              <span className="material-symbols-outlined text-white text-[12px]">check</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Templates used */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <CategoryBadge category={comp.category} />
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
          {comp.caption_template?.name || '—'}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="material-symbols-outlined text-[12px]" style={{ color: 'var(--color-accent)' }}>format_quote</span>
          {comp.hook_template?.name || '—'}
        </div>
      </div>

      {/* Technical specs */}
      <div className="flex items-center gap-3 mt-3">
        {[
          { icon: 'aspect_ratio', value: `${comp.width}×${comp.height}` },
          { icon: 'speed', value: `${comp.fps}fps` },
          { icon: 'movie_filter', value: comp.codec },
          { icon: 'tune', value: `CRF ${comp.crf}` },
        ].map((spec, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            <span className="material-symbols-outlined text-[11px]">{spec.icon}</span>
            {spec.value}
          </div>
        ))}
        {comp.use_count > 0 && (
          <div className="ml-auto flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--color-success-text)' }}>
            <span className="material-symbols-outlined text-[11px]">trending_up</span>
            {comp.use_count}×
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Filter Tabs ────────────────────────────────────────────────────────────
function FilterTabs({ categories, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <motion.button
        onClick={() => onChange(null)}
        className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all relative"
        style={{
          background: !active ? 'var(--btn-primary-bg)' : 'var(--color-surface-1)',
          color: !active ? 'var(--btn-primary-text)' : 'var(--color-text-muted)',
          border: !active ? 'none' : '1px solid var(--color-border-subtle)',
        }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        All
      </motion.button>
      {categories.map(cat => {
        const cfg = categoryConfig[cat] || categoryConfig.general
        return (
          <motion.button
            key={cat}
            onClick={() => onChange(cat)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
            style={{
              background: active === cat ? cfg.bg : 'var(--color-surface-1)',
              color: active === cat ? cfg.color : 'var(--color-text-muted)',
              border: active === cat ? `1px solid ${cfg.border}` : '1px solid var(--color-border-subtle)',
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="material-symbols-outlined text-[11px]">{cfg.icon}</span>
            {cat}
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Detail Panel (shows when a template is selected) ───────────────────────
function DetailPanel({ template, type, onClose, onEdit, onDelete }) {
  if (!template) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="rounded-2xl overflow-hidden sticky top-6"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-lg)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{template.name}</h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {type === 'caption' ? 'Caption Template' : 'Hook Template'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit && onEdit(template, type)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-1)]" style={{ color: 'var(--color-accent)' }} title="Edit">
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button onClick={() => onDelete && onDelete(template, type)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-error-bg)]" style={{ color: 'var(--color-error-text)' }} title="Delete">
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-1)]" style={{ color: 'var(--color-text-muted)' }}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-6 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92), rgba(20,10,30,0.95))' }}>
        <RemotionPreview
          captionStyle={type === 'caption' ? template : null}
          hookStyle={type === 'hook' ? template : null}
          size="sm"
          showPlayback={true}
          showBadge={true}
          showParticles={true}
          showGlow={true}
        />
      </div>

      {/* Meta info */}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={template.category} />
          {template.is_default && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
              DEFAULT
            </span>
          )}
        </div>
        {template.description && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{template.description}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {type === 'caption' ? (
            <>
              <InfoChip icon="text_fields" label="Font" value={template.font_family || 'Default'} />
              <InfoChip icon="format_size" label="Size" value={`${template.font_size || 48}px`} />
              <InfoChip icon="palette" label="Color" value={template.color || '#FFF'} isColor />
              <InfoChip icon="highlight" label="Highlight" value={template.highlight_color || '#FFD700'} isColor />
            </>
          ) : (
            <>
              <InfoChip icon="text_fields" label="Font" value={template.font_family || 'Default'} />
              <InfoChip icon="format_size" label="Normal" value={`${template.font_size_normal || 36}px`} />
              <InfoChip icon="format_size" label="Keyword" value={`${template.font_size_keyword || 56}px`} />
              <InfoChip icon="palette" label="Keyword Color" value={template.keyword_color || '#FFF'} isColor />
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function InfoChip({ icon, label, value, isColor }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-accent)' }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <div className="flex items-center gap-1.5">
          {isColor && <div className="w-3 h-3 rounded-sm border" style={{ background: value, borderColor: 'var(--color-border-default)' }} />}
          <p className="text-[11px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Create/Edit Form — Full-featured ────────────────────────────────────────
const GOOGLE_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Anton', 'Bebas Neue', 'Oswald', 'Roboto', 'Lato', 'Raleway', 'DM Sans', 'Space Grotesk', 'Archivo Black', 'Bangers', 'Permanent Marker', 'Bungee', 'Righteous', 'Pacifico', 'Fredoka One', 'Lilita One', 'Titan One', 'Black Ops One', 'Rubik Mono One', 'Staatliches', 'Teko', 'Barlow Condensed']
const HIGHLIGHT_STYLES = ['color', 'glow', 'scale', 'background', 'underline', 'box_jump', 'gradient_sweep']
const ANIMATION_TYPES = ['fade', 'pop', 'slide_up', 'slide_left', 'typewriter', 'bounce', 'stomp', 'flip_in', 'none']
const CATEGORIES = ['general', 'viral', 'minimal', 'gaming', 'edu', 'aesthetic', 'cinematic', 'hype']

function CreateEditForm({ type, initialData, captionTemplates, hookTemplates, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    if (initialData) return { ...initialData }
    if (type === 'caption') return {
      name: '', description: '', category: 'general',
      font_family: 'Inter', font_weight: '700', font_size: 48, letter_spacing: 0, text_transform: 'none', line_height: 1.3,
      color: '#FFFFFF', highlight_color: '#FFD700', highlight_style: 'color',
      bg_enabled: false, bg_color: '#000000', bg_opacity: 0.7, bg_padding_x: 12, bg_padding_y: 6, bg_border_radius: 8, bg_per_word: false,
      outline_enabled: true, outline_color: '#000000', outline_width: 2,
      shadow_enabled: true, shadow_color: '#000000', shadow_blur: 4, shadow_offset_x: 0, shadow_offset_y: 2,
      position_y: 'bottom', position_y_offset: 80, max_words_per_line: 4, max_lines: 2,
      animation_in: 'fade', animation_out: 'fade', animation_in_duration: 200, animation_out_duration: 150,
      highlight_transition: 'instant', highlight_transition_duration: 100,
    }
    if (type === 'hook') return {
      name: '', description: '', category: 'general',
      font_family: 'Anton', font_weight: '400', font_size_normal: 36, font_size_keyword: 56, letter_spacing: 0, text_transform: 'uppercase',
      color: '#FFFFFF', keyword_color: '#FFD700',
      box_enabled: false, box_color: '#000000', box_opacity: 0.6, box_padding: 20, box_border_radius: 12,
      keyword_bg_enabled: false, keyword_bg_color: '#FF0000', keyword_bg_opacity: 0.8, keyword_bg_padding_x: 8, keyword_bg_padding_y: 4, keyword_bg_border_radius: 6,
      keyword_underline_enabled: false, keyword_underline_color: '#FFFFFF', keyword_underline_thickness: 3,
      shadow_enabled: true, shadow_color: '#000000', shadow_blur: 12, shadow_offset_y: 3,
      glow_enabled: false, glow_color: '#FFFFFF', glow_radius: 8,
      outline_enabled: false, outline_color: '#000000', outline_width: 2,
      gradient_enabled: false, gradient_colors: ['#FF0080', '#7928CA'], gradient_direction: 'to right',
      animation_type: 'fade', animation_in_duration: 400, animation_out_duration: 400,
      position_x: 'center', position_y: 'center',
    }
    return {
      name: '', description: '', category: 'general',
      caption_template_id: captionTemplates[0]?.id || null, hook_template_id: hookTemplates[0]?.id || null,
      fps: 30, width: 1080, height: 1920, codec: 'h264', crf: 18,
    }
  })

  const [activeSection, setActiveSection] = useState('basic')
  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // Shared input styles
  const inputCls = "w-full px-3 py-2 rounded-lg text-xs outline-none transition-all"
  const inputStyle = { background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }
  const labelCls = "text-[9px] font-semibold uppercase tracking-wider mb-1 block"
  const labelStyle = { color: 'var(--color-text-muted)' }

  const ColorInput = ({ label, value, field }) => (
    <div>
      <label className={labelCls} style={labelStyle}>{label}</label>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)' }}>
        <input type="color" value={value || '#FFFFFF'} onChange={e => update(field, e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 p-0" />
        <input value={value || '#FFFFFF'} onChange={e => update(field, e.target.value)} className="flex-1 bg-transparent text-[10px] font-mono outline-none" style={{ color: 'var(--color-text-primary)' }} />
      </div>
    </div>
  )

  const RangeInput = ({ label, value, field, min, max, step = 1, unit = '' }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[9px] font-semibold uppercase tracking-wider" style={labelStyle}>{label}</label>
        <span className="text-[9px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => update(field, parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full cursor-pointer appearance-none" style={{ background: 'var(--color-border-default)', accentColor: 'var(--color-accent)' }} />
    </div>
  )

  const Toggle = ({ label, value, field }) => (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="relative w-9 h-5 rounded-full transition-colors" style={{ background: value ? 'var(--color-accent)' : 'var(--color-border-default)' }}
        onClick={() => update(field, !value)}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform" style={{ left: value ? '18px' : '2px' }} />
      </div>
    </label>
  )

  // Sections for caption
  const captionSections = [
    { key: 'basic', label: 'Basic', icon: 'text_fields' },
    { key: 'colors', label: 'Colors', icon: 'palette' },
    { key: 'effects', label: 'Effects', icon: 'auto_awesome' },
    { key: 'background', label: 'Background', icon: 'crop_square' },
    { key: 'animation', label: 'Animation', icon: 'animation' },
    { key: 'position', label: 'Position', icon: 'space_bar' },
  ]

  // Sections for hook
  const hookSections = [
    { key: 'basic', label: 'Basic', icon: 'text_fields' },
    { key: 'colors', label: 'Colors', icon: 'palette' },
    { key: 'keyword', label: 'Keyword', icon: 'star' },
    { key: 'effects', label: 'Effects', icon: 'auto_awesome' },
    { key: 'animation', label: 'Animation', icon: 'animation' },
  ]

  const sections = type === 'caption' ? captionSections : type === 'hook' ? hookSections : []

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(80vh - 60px)' }}>
      {/* Top: Live Preview */}
      {(type === 'caption' || type === 'hook') && (
        <div className="px-6 py-4 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, rgba(0,0,0,0.92), rgba(15,8,25,0.95))', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="text-center py-3 px-4 rounded-xl" style={type === 'hook' ? buildHookBoxStyle(form, { scale: 0.4 }) : buildCaptionPillStyle(form, { scale: 0.5 })}>
            {type === 'caption' && (
              <div className="flex flex-wrap justify-center gap-x-2">
                <span style={buildCaptionWordStyle(form, { isHighlight: false, scale: 0.35 })}>sample</span>
                <span style={buildCaptionWordStyle(form, { isHighlight: true, scale: 0.35 })}>caption</span>
                <span style={buildCaptionWordStyle(form, { isHighlight: false, scale: 0.35 })}>text</span>
              </div>
            )}
            {type === 'hook' && (
              <div className="space-y-0.5">
                <p style={buildHookWordStyle(form, { isKeyword: false, scale: 0.35 })}>Did you know</p>
                <p style={buildHookWordStyle(form, { isKeyword: true, scale: 0.35 })}>THIS</p>
                <p style={buildHookWordStyle(form, { isKeyword: false, scale: 0.35 })}>trick?</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section tabs (caption/hook only) */}
      {sections.length > 0 && (
        <div className="px-4 py-2 flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: activeSection === s.key ? 'var(--color-accent-subtle)' : 'transparent',
                color: activeSection === s.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                border: activeSection === s.key ? '1px solid var(--color-accent-border)' : '1px solid transparent',
              }}>
              <span className="material-symbols-outlined text-[12px]">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Basic info (always shown for compositions, or when section=basic) */}
        {(type === 'composition' || activeSection === 'basic') && (
          <div className="space-y-3">
            <div>
              <label className={labelCls} style={labelStyle}>Name *</label>
              <input value={form.name || ''} onChange={e => update('name', e.target.value)} placeholder="Template name..."
                className={inputCls} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Category</label>
                <select value={form.category || 'general'} onChange={e => update('category', e.target.value)} className={inputCls} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(type === 'caption' || type === 'hook') && (
                <div>
                  <label className={labelCls} style={labelStyle}>Font Family</label>
                  <select value={form.font_family || 'Inter'} onChange={e => update('font_family', e.target.value)} className={inputCls} style={{ ...inputStyle, fontFamily: form.font_family }}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Description</label>
              <textarea value={form.description || ''} onChange={e => update('description', e.target.value)} placeholder="Optional..."
                className={inputCls + ' resize-none'} rows={2} style={inputStyle} />
            </div>
            {type === 'caption' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Font Weight</label>
                  <select value={form.font_weight || '700'} onChange={e => update('font_weight', e.target.value)} className={inputCls} style={inputStyle}>
                    <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extrabold</option><option value="900">Black</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Font Size</label>
                  <input type="number" value={form.font_size || 48} onChange={e => update('font_size', parseInt(e.target.value) || 48)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Transform</label>
                  <select value={form.text_transform || 'none'} onChange={e => update('text_transform', e.target.value)} className={inputCls} style={inputStyle}>
                    <option value="none">None</option><option value="uppercase">UPPER</option><option value="lowercase">lower</option><option value="capitalize">Capital</option>
                  </select>
                </div>
              </div>
            )}
            {type === 'hook' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Weight</label>
                  <select value={form.font_weight || '400'} onChange={e => update('font_weight', e.target.value)} className={inputCls} style={inputStyle}>
                    <option value="400">Regular</option><option value="700">Bold</option><option value="900">Black</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Normal Size</label>
                  <input type="number" value={form.font_size_normal || 36} onChange={e => update('font_size_normal', parseInt(e.target.value) || 36)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Keyword Size</label>
                  <input type="number" value={form.font_size_keyword || 56} onChange={e => update('font_size_keyword', parseInt(e.target.value) || 56)} className={inputCls} style={inputStyle} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Colors section */}
        {activeSection === 'colors' && (
          <div className="space-y-3">
            {type === 'caption' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="Text Color" value={form.color} field="color" />
                  <ColorInput label="Highlight Color" value={form.highlight_color} field="highlight_color" />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Highlight Style</label>
                  <select value={form.highlight_style || 'color'} onChange={e => update('highlight_style', e.target.value)} className={inputCls} style={inputStyle}>
                    {HIGHLIGHT_STYLES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </>
            )}
            {type === 'hook' && (
              <div className="grid grid-cols-2 gap-3">
                <ColorInput label="Normal Color" value={form.color} field="color" />
                <ColorInput label="Keyword Color" value={form.keyword_color} field="keyword_color" />
              </div>
            )}
          </div>
        )}

        {/* Effects section */}
        {activeSection === 'effects' && (
          <div className="space-y-4">
            {/* Outline */}
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Outline / Stroke" value={form.outline_enabled} field="outline_enabled" />
              {form.outline_enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ColorInput label="Color" value={form.outline_color} field="outline_color" />
                  <RangeInput label="Width" value={form.outline_width || 2} field="outline_width" min={0} max={8} unit="px" />
                </div>
              )}
            </div>
            {/* Shadow */}
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Shadow" value={form.shadow_enabled} field="shadow_enabled" />
              {form.shadow_enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ColorInput label="Color" value={form.shadow_color} field="shadow_color" />
                  <RangeInput label="Blur" value={form.shadow_blur || 4} field="shadow_blur" min={0} max={30} unit="px" />
                  {type === 'caption' && <RangeInput label="Offset X" value={form.shadow_offset_x || 0} field="shadow_offset_x" min={0} max={20} unit="px" />}
                  <RangeInput label="Offset Y" value={form.shadow_offset_y || 2} field="shadow_offset_y" min={0} max={20} unit="px" />
                </div>
              )}
            </div>
            {/* Glow (hook only) */}
            {type === 'hook' && (
              <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                <Toggle label="Glow Effect" value={form.glow_enabled} field="glow_enabled" />
                {form.glow_enabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <ColorInput label="Glow Color" value={form.glow_color} field="glow_color" />
                    <RangeInput label="Radius" value={form.glow_radius || 8} field="glow_radius" min={2} max={30} unit="px" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Background section (caption) */}
        {activeSection === 'background' && type === 'caption' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Background Pill" value={form.bg_enabled} field="bg_enabled" />
              {form.bg_enabled && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <ColorInput label="BG Color" value={form.bg_color} field="bg_color" />
                    <RangeInput label="Opacity" value={form.bg_opacity ?? 0.7} field="bg_opacity" min={0} max={1} step={0.05} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <RangeInput label="Pad X" value={form.bg_padding_x || 12} field="bg_padding_x" min={0} max={40} unit="px" />
                    <RangeInput label="Pad Y" value={form.bg_padding_y || 6} field="bg_padding_y" min={0} max={20} unit="px" />
                    <RangeInput label="Radius" value={form.bg_border_radius || 8} field="bg_border_radius" min={0} max={24} unit="px" />
                  </div>
                  <Toggle label="Per-word pills" value={form.bg_per_word} field="bg_per_word" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Keyword section (hook) */}
        {activeSection === 'keyword' && type === 'hook' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Keyword Underline" value={form.keyword_underline_enabled} field="keyword_underline_enabled" />
              {form.keyword_underline_enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ColorInput label="Color" value={form.keyword_underline_color} field="keyword_underline_color" />
                  <RangeInput label="Thickness" value={form.keyword_underline_thickness || 3} field="keyword_underline_thickness" min={1} max={8} unit="px" />
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Keyword Background" value={form.keyword_bg_enabled} field="keyword_bg_enabled" />
              {form.keyword_bg_enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ColorInput label="Color" value={form.keyword_bg_color} field="keyword_bg_color" />
                  <RangeInput label="Opacity" value={form.keyword_bg_opacity ?? 0.8} field="keyword_bg_opacity" min={0} max={1} step={0.05} />
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Box Container" value={form.box_enabled} field="box_enabled" />
              {form.box_enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ColorInput label="Color" value={form.box_color} field="box_color" />
                  <RangeInput label="Opacity" value={form.box_opacity ?? 0.6} field="box_opacity" min={0} max={1} step={0.05} />
                  <RangeInput label="Padding" value={form.box_padding || 20} field="box_padding" min={0} max={40} unit="px" />
                  <RangeInput label="Radius" value={form.box_border_radius || 12} field="box_border_radius" min={0} max={30} unit="px" />
                </div>
              )}
            </div>
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <Toggle label="Gradient Text" value={form.gradient_enabled} field="gradient_enabled" />
              {form.gradient_enabled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ColorInput label="Color 1" value={form.gradient_colors?.[0] || '#FF0080'} field="_gc0" />
                  <ColorInput label="Color 2" value={form.gradient_colors?.[1] || '#7928CA'} field="_gc1" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Animation section */}
        {activeSection === 'animation' && (
          <div className="space-y-3">
            {type === 'caption' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} style={labelStyle}>Enter Animation</label>
                    <select value={form.animation_in || 'fade'} onChange={e => update('animation_in', e.target.value)} className={inputCls} style={inputStyle}>
                      {ANIMATION_TYPES.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>Exit Animation</label>
                    <select value={form.animation_out || 'fade'} onChange={e => update('animation_out', e.target.value)} className={inputCls} style={inputStyle}>
                      {['fade', 'pop', 'slide_down', 'blur_out', 'none'].map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <RangeInput label="Enter Duration" value={form.animation_in_duration || 200} field="animation_in_duration" min={50} max={800} unit="ms" />
                  <RangeInput label="Exit Duration" value={form.animation_out_duration || 150} field="animation_out_duration" min={50} max={500} unit="ms" />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Highlight Transition</label>
                  <select value={form.highlight_transition || 'instant'} onChange={e => update('highlight_transition', e.target.value)} className={inputCls} style={inputStyle}>
                    {['instant', 'smooth', 'bounce', 'spring', 'scale_bounce'].map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </>
            )}
            {type === 'hook' && (
              <>
                <div>
                  <label className={labelCls} style={labelStyle}>Animation Type</label>
                  <select value={form.animation_type || 'fade'} onChange={e => update('animation_type', e.target.value)} className={inputCls} style={inputStyle}>
                    {['fade', 'scale', 'slide_up', 'bounce', 'stomp', 'word_by_word', 'glitch', 'none'].map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <RangeInput label="Fade In" value={form.animation_in_duration || 400} field="animation_in_duration" min={100} max={1500} unit="ms" />
                  <RangeInput label="Fade Out" value={form.animation_out_duration || 400} field="animation_out_duration" min={100} max={1500} unit="ms" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Position section (caption) */}
        {activeSection === 'position' && type === 'caption' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Vertical Position</label>
                <select value={form.position_y || 'bottom'} onChange={e => update('position_y', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
                </select>
              </div>
              <RangeInput label="Y Offset" value={form.position_y_offset || 80} field="position_y_offset" min={0} max={300} unit="px" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <RangeInput label="Max Words/Line" value={form.max_words_per_line || 4} field="max_words_per_line" min={2} max={8} />
              <RangeInput label="Max Lines" value={form.max_lines || 2} field="max_lines" min={1} max={4} />
            </div>
            <RangeInput label="Line Height" value={form.line_height || 1.3} field="line_height" min={1} max={2.5} step={0.1} />
          </div>
        )}

        {/* Composition-specific fields */}
        {type === 'composition' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <label className={labelCls} style={labelStyle}>Caption Template</label>
              <select value={form.caption_template_id || ''} onChange={e => update('caption_template_id', parseInt(e.target.value) || null)} className={inputCls} style={inputStyle}>
                <option value="">— None —</option>
                {captionTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.font_family})</option>)}
              </select>
            </div>
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
              <label className={labelCls} style={labelStyle}>Hook Template</label>
              <select value={form.hook_template_id || ''} onChange={e => update('hook_template_id', parseInt(e.target.value) || null)} className={inputCls} style={inputStyle}>
                <option value="">— None —</option>
                {hookTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls} style={labelStyle}>FPS</label><input type="number" value={form.fps || 30} onChange={e => update('fps', parseInt(e.target.value))} className={inputCls} style={inputStyle} /></div>
              <div><label className={labelCls} style={labelStyle}>CRF</label><input type="number" value={form.crf || 18} onChange={e => update('crf', parseInt(e.target.value))} className={inputCls} style={inputStyle} /></div>
              <div>
                <label className={labelCls} style={labelStyle}>Codec</label>
                <select value={form.codec || 'h264'} onChange={e => update('codec', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="h264">H.264</option><option value="h265">H.265</option><option value="vp9">VP9</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions (sticky bottom) */}
      <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
          Batal
        </button>
        <button onClick={() => onSave(form)} disabled={!form.name?.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: form.name?.trim() ? 'var(--btn-primary-shadow)' : 'none' }}>
          {initialData ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function RemotionStylesPage() {
  const [tab, setTab] = useState('compositions')
  const [captionTemplates, setCaptionTemplates] = useState([])
  const [hookTemplates, setHookTemplates] = useState([])
  const [compositions, setCompositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCaption, setSelectedCaption] = useState(null)
  const [selectedHook, setSelectedHook] = useState(null)
  const [selectedComp, setSelectedComp] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid | list
  const [detailTemplate, setDetailTemplate] = useState(null)
  const [detailType, setDetailType] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState(null) // 'caption' | 'hook' | 'composition'
  const [editingItem, setEditingItem] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [caps, hooks, comps] = await Promise.all([
        api.getRemotionCaptionTemplates(),
        api.getRemotionHookTemplates(),
        api.getRemotionCompositions(),
      ])
      setCaptionTemplates(Array.isArray(caps) ? caps : [])
      setHookTemplates(Array.isArray(hooks) ? hooks : [])
      setCompositions(Array.isArray(comps) ? comps : [])

      const defCap = (Array.isArray(caps) ? caps : []).find(c => c.is_default)
      const defHook = (Array.isArray(hooks) ? hooks : []).find(h => h.is_default)
      const defComp = (Array.isArray(comps) ? comps : []).find(c => c.is_default)
      if (defCap) setSelectedCaption(defCap)
      if (defHook) setSelectedHook(defHook)
      if (defComp) setSelectedComp(defComp)
    } catch (e) {
      console.error('Failed to load remotion templates:', e)
    }
    setLoading(false)
  }

  // ─── CRUD Handlers ──────────────────────────────────────────────────────
  const handleDelete = async (item, type) => {
    try {
      if (type === 'caption') await api.deleteRemotionCaptionTemplate(item.id)
      else if (type === 'hook') await api.deleteRemotionHookTemplate(item.id)
      else if (type === 'composition') await api.deleteRemotionComposition(item.id)
      setDeleteConfirm(null)
      setDetailTemplate(null)
      loadAll()
    } catch (e) { console.error('Delete failed:', e) }
  }

  const handleCreate = () => {
    const type = tab === 'compositions' ? 'composition' : tab === 'captions' ? 'caption' : 'hook'
    setCreateType(type)
    setEditingItem(null)
    setShowCreateModal(true)
  }

  const handleEdit = (item, type) => {
    setCreateType(type)
    setEditingItem(item)
    setShowCreateModal(true)
  }

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        if (createType === 'caption') await api.updateRemotionCaptionTemplate(editingItem.id, data)
        else if (createType === 'hook') await api.updateRemotionHookTemplate(editingItem.id, data)
        else if (createType === 'composition') await api.updateRemotionComposition(editingItem.id, data)
      } else {
        if (createType === 'caption') await api.createRemotionCaptionTemplate(data)
        else if (createType === 'hook') await api.createRemotionHookTemplate(data)
        else if (createType === 'composition') await api.createRemotionComposition(data)
      }
      setShowCreateModal(false)
      setEditingItem(null)
      loadAll()
    } catch (e) { console.error('Save failed:', e) }
  }

  const captionCategories = useMemo(() =>
    [...new Set(captionTemplates.map(t => t.category))].sort(),
    [captionTemplates]
  )
  const hookCategories = useMemo(() =>
    [...new Set(hookTemplates.map(t => t.category))].sort(),
    [hookTemplates]
  )

  const filteredCaptions = useMemo(() => {
    let list = captionTemplates
    if (categoryFilter) list = list.filter(t => t.category === categoryFilter)
    if (searchQuery) list = list.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.font_family?.toLowerCase().includes(searchQuery.toLowerCase()))
    return list
  }, [captionTemplates, categoryFilter, searchQuery])

  const filteredHooks = useMemo(() => {
    let list = hookTemplates
    if (categoryFilter) list = list.filter(t => t.category === categoryFilter)
    if (searchQuery) list = list.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return list
  }, [hookTemplates, categoryFilter, searchQuery])

  const handleSelectCaption = (tpl) => {
    setSelectedCaption(tpl)
    setDetailTemplate(tpl)
    setDetailType('caption')
  }

  const handleSelectHook = (tpl) => {
    setSelectedHook(tpl)
    setDetailTemplate(tpl)
    setDetailType('hook')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 rounded-full"
            style={{ border: '3px solid var(--color-accent)', borderTopColor: 'transparent' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none" style={{ background: 'var(--color-accent-subtle)', opacity: 0.5 }} />

      <div className="relative max-w-[1600px] mx-auto p-5 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <motion.h1
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Remotion Styles
            </motion.h1>
            <motion.p
              className="text-sm mt-1 flex items-center gap-3"
              style={{ color: 'var(--color-text-muted)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">subtitles</span>
                {captionTemplates.length} captions
              </span>
              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-border-default)' }} />
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">title</span>
                {hookTemplates.length} hooks
              </span>
              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-border-default)' }} />
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">layers</span>
                {compositions.length} compositions
              </span>
            </motion.p>
          </div>

          {/* View toggle + Create */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create
            </motion.button>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-default)' }}>
              {[
                { key: 'grid', icon: 'grid_view' },
                { key: 'list', icon: 'view_list' },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className="p-2 transition-colors"
                  style={{
                    background: viewMode === v.key ? 'var(--color-accent-subtle)' : 'transparent',
                    color: viewMode === v.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">{v.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
            {[
              { key: 'compositions', label: 'Compositions', icon: 'layers', count: compositions.length },
              { key: 'captions', label: 'Captions', icon: 'subtitles', count: captionTemplates.length },
              { key: 'hooks', label: 'Hooks', icon: 'title', count: hookTemplates.length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setCategoryFilter(null); setSearchQuery(''); setDetailTemplate(null) }}
                className="relative flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ color: tab === t.key ? 'var(--btn-primary-text)' : 'var(--color-text-muted)' }}
              >
                {tab === t.key && (
                  <motion.div
                    layoutId="tab-bg"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'var(--btn-primary-bg)', boxShadow: 'var(--btn-primary-shadow)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative material-symbols-outlined text-[18px]">{t.icon}</span>
                <span className="relative hidden sm:inline">{t.label}</span>
                <span className="relative text-[10px] font-bold opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Search (for captions/hooks) */}
          {tab !== 'compositions' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative flex-1 max-w-xs"
            >
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px]" style={{ color: 'var(--color-text-muted)' }}>search</span>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl outline-none transition-all"
                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* Content + Detail Panel */}
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {tab === 'compositions' && (
                <motion.div
                  key="compositions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Compositions menggabungkan caption + hook template menjadi satu preset yang siap pakai.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {compositions.map((comp, i) => (
                      <CompositionCard
                        key={comp.id}
                        comp={comp}
                        selected={selectedComp}
                        onSelect={setSelectedComp}
                        index={i}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'captions' && (
                <motion.div
                  key="captions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <FilterTabs
                    categories={captionCategories}
                    active={categoryFilter}
                    onChange={setCategoryFilter}
                  />
                  <div className={viewMode === 'grid'
                    ? "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    : "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  }>
                    {filteredCaptions.map((tpl, i) => (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        type="caption"
                        selected={selectedCaption}
                        onSelect={handleSelectCaption}
                        index={i}
                      />
                    ))}
                  </div>
                  {filteredCaptions.length === 0 && (
                    <div className="text-center py-12">
                      <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>search_off</span>
                      <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>No caption templates found</p>
                    </div>
                  )}
                </motion.div>
              )}

              {tab === 'hooks' && (
                <motion.div
                  key="hooks"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <FilterTabs
                    categories={hookCategories}
                    active={categoryFilter}
                    onChange={setCategoryFilter}
                  />
                  <div className={viewMode === 'grid'
                    ? "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    : "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  }>
                    {filteredHooks.map((tpl, i) => (
                      <TemplateCard
                        key={tpl.id}
                        template={tpl}
                        type="hook"
                        selected={selectedHook}
                        onSelect={handleSelectHook}
                        index={i}
                      />
                    ))}
                  </div>
                  {filteredHooks.length === 0 && (
                    <div className="text-center py-12">
                      <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-text-muted)' }}>search_off</span>
                      <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>No hook templates found</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Detail panel (side panel when a template is selected) */}
          <AnimatePresence>
            {detailTemplate && tab !== 'compositions' && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 320 }}
                exit={{ opacity: 0, width: 0 }}
                className="hidden lg:block flex-shrink-0 overflow-hidden"
              >
                <DetailPanel
                  template={detailTemplate}
                  type={detailType}
                  onClose={() => setDetailTemplate(null)}
                  onEdit={handleEdit}
                  onDelete={(item, type) => setDeleteConfirm({ item, type })}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selection Summary (sticky bottom) */}
        <AnimatePresence>
          {(selectedCaption || selectedHook) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="sticky bottom-4 p-4 rounded-2xl backdrop-blur-xl z-30"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  {selectedCaption && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                      <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>subtitles</span>
                      <span className="font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{selectedCaption.name}</span>
                    </div>
                  )}
                  {selectedHook && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border-subtle)' }}>
                      <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-accent)' }}>title</span>
                      <span className="font-medium text-xs" style={{ color: 'var(--color-text-primary)' }}>{selectedHook.name}</span>
                    </div>
                  )}
                </div>
                <motion.button
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
                  style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', boxShadow: 'var(--btn-primary-shadow)' }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Apply to Clips
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="rounded-2xl p-6 max-w-sm w-full space-y-4"
                style={{ background: 'var(--color-bg-modal)', border: '1px solid var(--color-border-default)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--color-error-bg)' }}>
                  <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--color-error-text)' }}>delete</span>
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Delete Template?</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    "{deleteConfirm.item.name}" akan dihapus permanen.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
                    Batal
                  </button>
                  <button onClick={() => handleDelete(deleteConfirm.item, deleteConfirm.type)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--btn-danger-bg)', color: 'var(--btn-danger-text)' }}>
                    Hapus
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
                style={{ background: 'var(--color-bg-modal)', border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-xl)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--color-bg-modal)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {editingItem ? 'Edit' : 'Create'} {createType === 'caption' ? 'Caption Template' : createType === 'hook' ? 'Hook Template' : 'Composition'}
                  </h3>
                  <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <CreateEditForm
                  type={createType}
                  initialData={editingItem}
                  captionTemplates={captionTemplates}
                  hookTemplates={hookTemplates}
                  onSave={handleSave}
                  onCancel={() => setShowCreateModal(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
