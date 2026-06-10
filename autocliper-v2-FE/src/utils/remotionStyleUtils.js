// ═══════════════════════════════════════════════════════════════
// Shared Remotion Style Utilities
// Single source of truth for converting Remotion template fields
// into CSS styles — used by all preview components.
// ═══════════════════════════════════════════════════════════════

/**
 * Build CSS styles for a caption word (normal or highlighted)
 * @param {object} template - Remotion caption template
 * @param {object} options - { isHighlight, scale }
 */
export function buildCaptionWordStyle(template, { isHighlight = false, scale = 1 } = {}) {
    if (!template) return {}

    const fontSize = Math.max(10, Math.round((template.font_size || 48) * scale))
    const outlineW = (template.outline_width || 0) * scale
    const shadowX = (template.shadow_offset_x || 0) * scale
    const shadowY = (template.shadow_offset_y || 0) * scale
    const shadowBlur = (template.shadow_blur || 4) * scale

    // Base shadow — always present for visibility
    const baseShadow = template.shadow_enabled !== false
        ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${template.shadow_color || '#000000'}`
        : '0 1px 3px rgba(0,0,0,0.8)'

    const base = {
        color: isHighlight ? (template.highlight_color || '#FFD700') : (template.color || '#FFFFFF'),
        fontFamily: template.font_family || 'Inter',
        fontSize: `${fontSize}px`,
        fontWeight: template.font_weight || '700',
        lineHeight: template.line_height || 1.3,
        display: 'inline-block',
        textShadow: baseShadow,
        textTransform: template.text_transform || 'none',
    }

    // Outline (only if enabled AND width > 0)
    if (template.outline_enabled && outlineW > 0.5) {
        base.WebkitTextStroke = `${outlineW}px ${template.outline_color || '#000000'}`
    }

    // Highlight-specific effects
    if (isHighlight) {
        const hlStyle = template.highlight_style || 'color'

        if (hlStyle === 'glow') {
            const glowColor = template.highlight_color || '#FFD700'
            base.textShadow = `0 0 ${6 * scale}px ${glowColor}, 0 0 ${14 * scale}px ${glowColor}60, ${baseShadow}`
        }

        if (hlStyle === 'scale') {
            base.transform = 'scale(1.12)'
        }

        if (hlStyle === 'background') {
            base.backgroundColor = `${template.highlight_color || '#FFD700'}30`
            base.padding = `${1 * scale}px ${4 * scale}px`
            base.borderRadius = `${4 * scale}px`
        }
    }

    return base
}

/**
 * Build pill/background container style for caption
 * @param {object} template - Remotion caption template
 * @param {object} options - { scale }
 */
export function buildCaptionPillStyle(template, { scale = 1 } = {}) {
    if (!template) return {}

    const bgEnabled = template.bg_enabled
    if (!bgEnabled) return {}

    const bgColor = template.bg_color || '#000000'
    const bgOpacity = template.bg_opacity ?? 0.7
    const bgPadX = (template.bg_padding_x || 12) * scale
    const bgPadY = (template.bg_padding_y || 6) * scale
    const bgRadius = (template.bg_border_radius || 8) * scale

    // Convert opacity (0-1) to hex alpha
    const alpha = Math.round(bgOpacity * 255).toString(16).padStart(2, '0')

    return {
        background: `${bgColor}${alpha}`,
        padding: `${bgPadY}px ${bgPadX}px`,
        borderRadius: `${bgRadius}px`,
        display: 'inline-block',
    }
}

/**
 * Build CSS styles for hook text (normal or keyword)
 * @param {object} template - Remotion hook template
 * @param {object} options - { isKeyword, scale }
 */
export function buildHookWordStyle(template, { isKeyword = false, scale = 1 } = {}) {
    if (!template) return {}

    const fontSize = isKeyword
        ? Math.round((template.font_size_keyword || 56) * scale)
        : Math.round((template.font_size_normal || 36) * scale)

    // Shadow
    const shadow = template.shadow_enabled !== false
        ? `0 ${(template.shadow_offset_y || 3) * scale}px ${(template.shadow_blur || 12) * scale}px ${template.shadow_color || '#000000'}`
        : '0 1px 3px rgba(0,0,0,0.8)'

    const base = {
        color: isKeyword ? (template.keyword_color || '#FFFFFF') : (template.color || '#FFFFFF'),
        fontFamily: template.font_family || 'Anton',
        fontSize: `${fontSize}px`,
        fontWeight: isKeyword ? '900' : (template.font_weight || '400'),
        textShadow: shadow,
        textTransform: template.text_transform || 'uppercase',
        lineHeight: 1.2,
        margin: 0,
    }

    // Keyword-specific effects
    if (isKeyword) {
        // Glow
        if (template.glow_enabled) {
            const gc = template.glow_color || template.keyword_color || '#FFFFFF'
            const gr = (template.glow_radius || 8) * scale
            base.textShadow = `0 0 ${gr}px ${gc}, 0 0 ${gr * 2}px ${gc}50, ${shadow}`
        }

        // Underline
        if (template.keyword_underline_enabled) {
            base.borderBottom = `${Math.max(1, (template.keyword_underline_thickness || 3) * scale)}px solid ${template.keyword_underline_color || '#FFFFFF'}`
            base.paddingBottom = `${1 * scale}px`
        }

        // Keyword background
        if (template.keyword_bg_enabled) {
            const kbColor = template.keyword_bg_color || '#FF0000'
            const kbOpacity = template.keyword_bg_opacity ?? 0.8
            const alpha = Math.round(kbOpacity * 255).toString(16).padStart(2, '0')
            base.backgroundColor = `${kbColor}${alpha}`
            base.padding = `${(template.keyword_bg_padding_y || 4) * scale}px ${(template.keyword_bg_padding_x || 8) * scale}px`
            base.borderRadius = `${(template.keyword_bg_border_radius || 6) * scale}px`
        }

        // Outline
        if (template.outline_enabled) {
            const ow = (template.outline_width || 2) * scale
            base.WebkitTextStroke = `${ow}px ${template.outline_color || '#000000'}`
        }

        // Gradient text
        if (template.gradient_enabled && template.gradient_colors?.length >= 2) {
            const colors = template.gradient_colors.join(', ')
            base.background = `linear-gradient(${template.gradient_direction || 'to right'}, ${colors})`
            base.WebkitBackgroundClip = 'text'
            base.WebkitTextFillColor = 'transparent'
        }
    }

    return base
}

/**
 * Build hook box container style
 * @param {object} template - Remotion hook template
 * @param {object} options - { scale }
 */
export function buildHookBoxStyle(template, { scale = 1 } = {}) {
    if (!template || !template.box_enabled) return {}

    const color = template.box_color || '#000000'
    const opacity = template.box_opacity ?? 0.6
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0')

    return {
        background: `${color}${alpha}`,
        padding: `${(template.box_padding || 20) * scale}px`,
        borderRadius: `${(template.box_border_radius || 12) * scale}px`,
        ...(template.box_border_width > 0 ? {
            border: `${template.box_border_width * scale}px solid ${template.box_border_color || 'transparent'}`,
        } : {}),
    }
}

// ═══════════════════════════════════════════════════════════════
// CONFIG DEFAULTS, VALIDATION & SCHEMA MIGRATION (Task 1.1)
// Resolves raw Template_Config from API with sensible defaults,
// validates/clamps values, and handles schema version migration.
// ═══════════════════════════════════════════════════════════════

/**
 * Current schema version supported by this codebase.
 */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * Valid easing values (Req 17). Maps to cubic-bezier arrays.
 */
export const EASING_MAP = {
    linear:    [0, 0, 1, 1],
    easeIn:    [0.42, 0, 1, 1],
    easeOut:   [0, 0, 0.58, 1],
    easeInOut: [0.42, 0, 0.58, 1],
    circOut:   [0, 0.55, 0.45, 1],
    backOut:   [0.175, 0.885, 0.32, 1.275],
    bounce:    [0.34, 1.56, 0.64, 1],
}

/**
 * Default Template_Config values. All features disabled by default.
 * Missing keys in user config are filled from here.
 */
const CONFIG_DEFAULTS = {
    schema_version: 1,

    text: {
        lines: [],
        font_size_normal: 36,
        font_size_keyword: 56,
        color: '#FFFFFF',
        keyword_color: '#FFFFFF',
        fontfile: '',
        fallback_font: 'Anton',
        line_spacing: 10,
        word_spacing: 12,
        padding_horizontal: 80,
        text_transform: 'uppercase',
        letter_spacing: 0,
    },

    badge: {
        enable: false,
        text: '',
        bg_color: '#EA449A',
        font_size: 10,
        font_family: 'Montserrat',
        letter_spacing: 2,
        animation: { type: 'fade', delay: 0.15, duration: 0.4 },
    },

    animation: {
        type: 'fade',
        per_line: [],
    },

    decorations: {
        divider: { enable: false, colors: ['#f472b6', '#c084fc', 'transparent'], width: 180, delay: 1.1 },
        emoji_row: { enable: false, emojis: [], delay: 1.25 },
    },

    effects: {
        flash: { enable: false, color: 'rgba(192,132,252,0.3)', delay: 0.25, duration: 0.55 },
        particles: { enable: false, count: 8, colors: ['#f472b6', '#c084fc', '#818cf8', '#fde68a'], size_range: [3, 5] },
    },

    overlay: {
        gradient_top: { enable: false, color: 'rgba(80,10,120,0.5)', height_percent: 40 },
        gradient_bottom: { enable: false, color: 'rgba(0,0,0,0.85)', height_percent: 35 },
    },

    position: {
        anchor: 'center',
        offset_y: 0,
        offset_x: 0,
    },

    font_registry: [],

    safe_area: {
        override: false,
        top_percent: 10,
        bottom_percent: 20,
        side_percent: 10,
    },
}

/**
 * Deep merge two objects. Override values take precedence.
 * Arrays are NOT deep-merged — override replaces entirely.
 * @param {object} base
 * @param {object} override
 * @returns {object}
 */
function deepMerge(base, override) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) return base
    const result = { ...base }
    for (const key of Object.keys(override)) {
        const baseVal = result[key]
        const overVal = override[key]
        if (
            baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal) &&
            overVal && typeof overVal === 'object' && !Array.isArray(overVal)
        ) {
            result[key] = deepMerge(baseVal, overVal)
        } else if (overVal !== undefined) {
            result[key] = overVal
        }
    }
    return result
}

/**
 * Clamp a number to [min, max].
 */
function clamp(value, min, max) {
    if (typeof value !== 'number' || isNaN(value)) return min
    return Math.max(min, Math.min(max, value))
}

/**
 * Validate and clamp config values to their allowed ranges.
 * Invalid values are replaced with defaults (Req 9.10).
 * @param {object} config - Merged config (after deepMerge with defaults)
 * @returns {object} - Validated config
 */
function validateConfig(config) {
    const c = { ...config }

    // text.lines: max 6 entries, each line.text max 100 chars
    if (Array.isArray(c.text?.lines)) {
        c.text = { ...c.text, lines: c.text.lines.slice(0, 6).map(line => {
            if (!line || typeof line !== 'object') return { text: '' }
            return {
                ...line,
                text: typeof line.text === 'string' ? line.text.slice(0, 100) : '',
                font_size: line.font_size ? clamp(line.font_size, 8, 200) : undefined,
                letter_spacing: line.letter_spacing != null ? clamp(line.letter_spacing, -5, 20) : undefined,
            }
        })}
    }

    // badge.text: max 30 chars
    if (c.badge?.text && typeof c.badge.text === 'string' && c.badge.text.length > 30) {
        c.badge = { ...c.badge, text: c.badge.text.slice(0, 30) }
    }

    // position: clamp offsets
    if (c.position) {
        c.position = {
            ...c.position,
            anchor: ['top', 'center', 'bottom'].includes(c.position.anchor) ? c.position.anchor : 'center',
            offset_y: clamp(c.position.offset_y ?? 0, -500, 500),
            offset_x: clamp(c.position.offset_x ?? 0, -500, 500),
        }
    }

    // safe_area: clamp percentages
    if (c.safe_area) {
        c.safe_area = {
            ...c.safe_area,
            top_percent: clamp(c.safe_area.top_percent ?? 10, 0, 40),
            bottom_percent: clamp(c.safe_area.bottom_percent ?? 20, 0, 40),
            side_percent: clamp(c.safe_area.side_percent ?? 10, 0, 40),
        }
    }

    // effects.particles.count: clamp [1, 12]
    if (c.effects?.particles) {
        c.effects = {
            ...c.effects,
            particles: {
                ...c.effects.particles,
                count: clamp(c.effects.particles.count ?? 8, 1, 12),
            },
        }
    }

    // overlay height_percent: clamp [10, 80]
    if (c.overlay?.gradient_top) {
        c.overlay = {
            ...c.overlay,
            gradient_top: {
                ...c.overlay.gradient_top,
                height_percent: clamp(c.overlay.gradient_top.height_percent ?? 40, 10, 80),
            },
        }
    }
    if (c.overlay?.gradient_bottom) {
        c.overlay = {
            ...c.overlay,
            gradient_bottom: {
                ...c.overlay.gradient_bottom,
                height_percent: clamp(c.overlay.gradient_bottom.height_percent ?? 35, 10, 80),
            },
        }
    }

    return c
}

/**
 * Migrate a legacy config (schema_version 0 or absent) to v1.
 * Maps the old flat structure into the new nested format.
 * @param {object|null|undefined} rawConfig
 * @returns {object} Migrated config (schema_version = 1)
 * @throws {Error} If schema_version > CURRENT_SCHEMA_VERSION
 */
export function migrateConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        // Null/empty → return defaults (version 1, all disabled)
        return { ...CONFIG_DEFAULTS }
    }

    const version = rawConfig.schema_version ?? 0

    if (version > CURRENT_SCHEMA_VERSION) {
        throw new Error(
            `Unsupported schema_version: ${version}. ` +
            `This system supports up to version ${CURRENT_SCHEMA_VERSION}.`
        )
    }

    if (version === 0) {
        // Legacy config: may have partial nested keys from old system
        // Treat as user overrides and merge with defaults
        return { schema_version: 1, ...rawConfig }
    }

    // Version 1 — current, no migration needed
    return rawConfig
}

/**
 * Resolve a raw Template_Config from the API into a fully-populated,
 * validated config with all defaults filled in.
 *
 * Steps:
 * 1. Migrate schema version (v0 → v1)
 * 2. Deep merge with defaults (missing keys → disabled features)
 * 3. Validate and clamp values to allowed ranges
 *
 * @param {object|null|undefined} rawConfig - The `config` field from API response
 * @returns {object} Fully resolved and validated Template_Config
 * @throws {Error} If schema_version > supported
 */
export function resolveConfig(rawConfig) {
    // Step 1: Schema migration
    const migrated = migrateConfig(rawConfig)

    // Step 2: Deep merge with defaults
    const merged = deepMerge(CONFIG_DEFAULTS, migrated)

    // Step 3: Validate and clamp
    return validateConfig(merged)
}

/**
 * Resolve an easing string to a cubic-bezier array (Req 17).
 * Falls back to "easeOut" for unknown values.
 *
 * @param {string} easingString - One of: linear, easeIn, easeOut, easeInOut, circOut, backOut, bounce
 * @returns {number[]} Cubic-bezier array [x1, y1, x2, y2]
 */
export function resolveEasing(easingString) {
    if (!easingString || typeof easingString !== 'string') {
        return EASING_MAP.easeOut
    }
    return EASING_MAP[easingString] || EASING_MAP.easeOut
}


// ═══════════════════════════════════════════════════════════════
// POSITIONING, SAFE AREA & FONT RESOLUTION (Task 1.2)
// ═══════════════════════════════════════════════════════════════

/**
 * Compute safe area pixel bounds for a given frame size.
 * Default: top 10%, bottom 20%, side 10% excluded.
 *
 * @param {number} frameW - Frame width in pixels (e.g. 1080 or 280 for preview)
 * @param {number} frameH - Frame height in pixels (e.g. 1920 or 497 for preview)
 * @param {object|null} safeAreaConfig - config.safe_area object
 * @returns {{ top: number, bottom: number, left: number, right: number, width: number, height: number }}
 */
export function computeSafeArea(frameW, frameH, safeAreaConfig) {
    const cfg = safeAreaConfig || {}
    const topPct = (cfg.override ? clamp(cfg.top_percent ?? 10, 0, 40) : 10) / 100
    const bottomPct = (cfg.override ? clamp(cfg.bottom_percent ?? 20, 0, 40) : 20) / 100
    const sidePct = (cfg.override ? clamp(cfg.side_percent ?? 10, 0, 40) : 10) / 100

    const top = Math.round(frameH * topPct)
    const bottom = Math.round(frameH * (1 - bottomPct))
    const left = Math.round(frameW * sidePct)
    const right = Math.round(frameW * (1 - sidePct))

    return {
        top,
        bottom,
        left,
        right,
        width: right - left,
        height: bottom - top,
    }
}

/**
 * Compute absolute pixel position for hook overlay within safe area.
 *
 * @param {object|null} positionConfig - config.position object { anchor, offset_y, offset_x }
 * @param {{ top: number, bottom: number, left: number, right: number, width: number, height: number }} safeArea
 * @returns {{ top: number|undefined, bottom: number|undefined, left: number, transform: string }}
 */
export function computePosition(positionConfig, safeArea) {
    const cfg = positionConfig || {}
    const anchor = ['top', 'center', 'bottom'].includes(cfg.anchor) ? cfg.anchor : 'center'
    const offsetY = clamp(cfg.offset_y ?? 0, -500, 500)
    const offsetX = clamp(cfg.offset_x ?? 0, -500, 500)

    const baseLeft = safeArea.left + offsetX

    if (anchor === 'top') {
        return {
            top: safeArea.top + offsetY,
            bottom: undefined,
            left: baseLeft,
            transform: '',
        }
    }

    if (anchor === 'bottom') {
        return {
            top: undefined,
            bottom: (safeArea.bottom ? undefined : 0),
            // Use top calculated from bottom of safe area
            top: safeArea.bottom - offsetY,
            left: baseLeft,
            transform: 'translateY(-100%)',
        }
    }

    // center (default)
    const centerY = safeArea.top + Math.round(safeArea.height / 2) + offsetY
    return {
        top: centerY,
        bottom: undefined,
        left: baseLeft,
        transform: 'translateY(-50%)',
    }
}

/**
 * Resolve a font family name using the font registry.
 * Returns the registry entry if found, otherwise logs a warning and returns null.
 *
 * @param {string} fontFamily - The font-family name to resolve
 * @param {Array} fontRegistry - config.font_registry array
 * @returns {{ family: string, source: string, path: string }|null}
 */
export function resolveFont(fontFamily, fontRegistry) {
    if (!fontFamily || !Array.isArray(fontRegistry) || fontRegistry.length === 0) {
        return null
    }

    const entry = fontRegistry.find(
        e => e && e.family && e.family.toLowerCase() === fontFamily.toLowerCase()
    )

    if (!entry) {
        console.warn(`[FontRegistry] Font "${fontFamily}" not found in registry. Falling back to Inter.`)
        return null
    }

    return entry
}

/**
 * Build CSS style for a gradient overlay (top or bottom).
 *
 * @param {object} config - gradient_top or gradient_bottom config { enable, color, height_percent }
 * @param {'top'|'bottom'} position - Which edge the gradient starts from
 * @returns {object} CSS style object
 */
export function buildGradientOverlayStyle(config, position) {
    if (!config?.enable) return {}

    const heightPercent = clamp(config.height_percent ?? (position === 'top' ? 40 : 35), 10, 80)
    const color = config.color || (position === 'top' ? 'rgba(80,10,120,0.5)' : 'rgba(0,0,0,0.85)')
    const direction = position === 'top' ? '180deg' : '0deg'

    return {
        position: 'absolute',
        [position]: 0,
        left: 0,
        right: 0,
        height: `${heightPercent}%`,
        background: `linear-gradient(${direction}, ${color} 0%, transparent 100%)`,
        pointerEvents: 'none',
    }
}


// ═══════════════════════════════════════════════════════════════
// PER-LINE STYLE BUILDERS & ANIMATION VARIANTS (Task 1.3)
// ═══════════════════════════════════════════════════════════════

/**
 * Supported entrance animation types for per-line animations.
 */
const SUPPORTED_ANIM_TYPES = ['slam_left', 'slam_right', 'scale_rotate', 'slide_up', 'pop', 'fade']

/**
 * Supported highlight styles for captions.
 */
const SUPPORTED_HIGHLIGHT_STYLES = ['glow', 'background', 'underline', 'fill', 'scale']

/**
 * Build CSS style for a specific hook text line.
 * Reads per-line config from text.lines[lineIndex], falling back to top-level fields.
 *
 * @param {object} hookStyle - Hook template object (from API)
 * @param {number} lineIndex - 0-based index into config.text.lines
 * @param {number} scale - Viewport scale factor (e.g. 280/1080 for phone preview)
 * @returns {object} CSS style object
 */
export function buildLineStyle(hookStyle, lineIndex, scale = 1) {
    if (!hookStyle) return {}

    const config = hookStyle.config ? resolveConfig(hookStyle.config) : resolveConfig(null)
    const lines = config.text?.lines || []
    const lineConfig = lines[lineIndex] || {}

    // Per-line overrides with top-level fallbacks
    const fontSize = lineConfig.font_size || config.text.font_size_normal || hookStyle.font_size_normal || 36
    const color = lineConfig.color || config.text.color || hookStyle.color || '#FFFFFF'
    const fontFamily = lineConfig.font || config.text.fallback_font || hookStyle.font_family || 'Anton'
    const fontWeight = lineConfig.font_weight || '900'
    const letterSpacing = lineConfig.letter_spacing || config.text.letter_spacing || 0

    // Shadow from hook style top-level
    const shadowEnabled = hookStyle.shadow_enabled !== false
    const shadowColor = hookStyle.shadow_color || '#000000'
    const shadowBlur = (hookStyle.shadow_blur || 12) * scale
    const shadowOffsetY = (hookStyle.shadow_offset_y || 3) * scale
    const baseShadow = shadowEnabled
        ? `0px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`
        : '0 1px 3px rgba(0,0,0,0.8)'

    // Glow (if enabled)
    let textShadow = baseShadow
    if (hookStyle.glow_enabled) {
        const gc = hookStyle.glow_color || color
        const gr = (hookStyle.glow_radius || 8) * scale
        textShadow = `0 0 ${gr}px ${gc}, 0 0 ${gr * 2}px ${gc}50, ${baseShadow}`
    }

    return {
        fontFamily,
        fontSize: `${Math.round(fontSize * scale)}px`,
        fontWeight,
        color,
        letterSpacing: letterSpacing ? `${letterSpacing * scale}px` : undefined,
        lineHeight: 0.95,
        textShadow,
        textTransform: config.text.text_transform || hookStyle.text_transform || 'uppercase',
        margin: 0,
    }
}

/**
 * Get Framer Motion enter animation variant for a specific hook line.
 * Reads from config.animation.per_line[lineIndex] or falls back to top-level animation_type.
 *
 * @param {object} hookStyle - Hook template object
 * @param {number} lineIndex - 0-based line index
 * @returns {{ initial: object, animate: object, transition: object }}
 */
export function getLineEnterVariant(hookStyle, lineIndex) {
    const config = hookStyle?.config ? resolveConfig(hookStyle.config) : resolveConfig(null)
    const perLine = config.animation?.per_line || []
    const anim = perLine[lineIndex] || null

    // Determine animation type
    const type = anim?.type && SUPPORTED_ANIM_TYPES.includes(anim.type)
        ? anim.type
        : (hookStyle?.animation_type && SUPPORTED_ANIM_TYPES.includes(hookStyle.animation_type)
            ? hookStyle.animation_type
            : 'fade')

    // Determine delay
    const delay = anim?.delay ?? (0.35 + lineIndex * 0.23)

    // Determine easing
    const easingArr = resolveEasing(anim?.easing || 'backOut')

    // Idle animation config
    const idle = anim?.idle || null
    const idleDelay = anim?.idle_delay ?? 0

    // Animation variants
    const variants = {
        slam_left: {
            initial: { opacity: 0, x: -40, skewX: 8 },
            animate: { opacity: 1, x: 0, skewX: 0 },
        },
        slam_right: {
            initial: { opacity: 0, x: 40, skewX: -6 },
            animate: { opacity: 1, x: 0, skewX: 0 },
        },
        scale_rotate: {
            initial: { opacity: 0, scale: 0.4, rotate: -4 },
            animate: { opacity: 1, scale: 1, rotate: 0 },
        },
        slide_up: {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
        },
        pop: {
            initial: { opacity: 0, scale: 0.6 },
            animate: { opacity: 1, scale: 1 },
        },
        fade: {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
        },
    }

    const variant = variants[type] || variants.fade

    return {
        initial: variant.initial,
        animate: variant.animate,
        transition: {
            delay,
            duration: 0.5,
            ease: easingArr,
        },
        idle,
        idleDelay: delay + 0.5 + idleDelay,
    }
}

/**
 * Build CSS style for a badge element.
 *
 * @param {object} badgeConfig - config.badge object
 * @param {number} scale - Viewport scale factor
 * @returns {object} CSS style object for the badge container
 */
export function buildBadgeStyle(badgeConfig, scale = 1) {
    if (!badgeConfig?.enable) return {}

    return {
        display: 'inline-block',
        background: badgeConfig.bg_color || 'rgba(234,68,154,0.9)',
        borderRadius: `${4 * scale}px`,
        padding: `${2 * scale}px ${7 * scale}px`,
        marginBottom: `${7 * scale}px`,
    }
}

/**
 * Build highlight effect properties for a caption word.
 * Returns Framer Motion props: style (base CSS), animate (keyframes), transition (timing config).
 *
 * Supports: "glow", "background", "underline", "fill", "scale".
 * Unsupported/unknown values fall back to "glow".
 *
 * @param {string} highlightStyle - One of: 'glow', 'background', 'underline', 'fill', 'scale'
 * @param {boolean} isActive - Whether this word is currently highlighted
 * @param {object} captionConfig - Caption template config object
 * @returns {{ style: object, animate: object, transition: object }} Framer Motion props
 */
export function buildHighlightEffect(highlightStyle, isActive, captionConfig) {
    if (!isActive) {
        return { style: {}, animate: {}, transition: {} }
    }

    const resolvedStyle = SUPPORTED_HIGHLIGHT_STYLES.includes(highlightStyle) ? highlightStyle : 'glow'
    const hlColor = captionConfig?.highlight_color || captionConfig?.highlightColor || '#FFD700'
    const baseColor = captionConfig?.color || '#FFFFFF'

    switch (resolvedStyle) {
        case 'glow':
            return {
                style: {
                    textShadow: `0 0 8px ${hlColor}, 0 0 16px ${hlColor}60`,
                },
                animate: {
                    textShadow: [
                        `0 0 8px ${hlColor}, 0 0 16px ${hlColor}60`,
                        `0 0 12px ${hlColor}, 0 0 24px ${hlColor}90`,
                        `0 0 8px ${hlColor}, 0 0 16px ${hlColor}60`,
                    ],
                    scale: [1, 1.12, 1.05, 1],
                },
                transition: {
                    textShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
                    scale: { duration: 0.15, ease: 'easeOut' },
                },
            }

        case 'background':
            return {
                style: {
                    backgroundColor: `${hlColor}40`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                },
                animate: {
                    scale: [1, 1.05, 1],
                },
                transition: {
                    scale: { duration: 0.2, ease: 'easeOut' },
                },
            }

        case 'underline':
            return {
                style: {
                    borderBottom: `2px solid ${hlColor}`,
                    textUnderlineOffset: '4px',
                    transformOrigin: 'left',
                },
                animate: {
                    scaleX: [0, 1],
                },
                transition: {
                    scaleX: { duration: 0.2, ease: 'easeOut' },
                },
            }

        case 'fill':
            return {
                style: {
                    backgroundImage: `linear-gradient(90deg, ${hlColor} 50%, ${baseColor} 50%)`,
                    backgroundSize: '200% 100%',
                    backgroundPosition: '100% 0',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                },
                animate: {
                    backgroundPosition: ['100% 0', '0% 0'],
                },
                transition: {
                    backgroundPosition: { duration: 0.3, ease: 'linear' },
                },
            }

        case 'scale':
            return {
                style: {
                    display: 'inline-block',
                },
                animate: {
                    scale: [1, 1.15, 1.0],
                },
                transition: {
                    scale: { duration: 0.2, ease: 'easeOut' },
                },
            }

        default:
            // Fallback to glow (should not reach here due to resolvedStyle check above)
            return {
                style: {
                    textShadow: `0 0 8px ${hlColor}, 0 0 16px ${hlColor}60`,
                },
                animate: {
                    textShadow: [
                        `0 0 8px ${hlColor}, 0 0 16px ${hlColor}60`,
                        `0 0 12px ${hlColor}, 0 0 24px ${hlColor}90`,
                        `0 0 8px ${hlColor}, 0 0 16px ${hlColor}60`,
                    ],
                    scale: [1, 1.12, 1.05, 1],
                },
                transition: {
                    textShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
                    scale: { duration: 0.15, ease: 'easeOut' },
                },
            }
    }
}
