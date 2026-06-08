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
