import { describe, it, expect } from 'vitest'
import {
    resolveConfig,
    resolveEasing,
    computeSafeArea,
    buildLineStyle,
    migrateConfig,
    EASING_MAP,
    CURRENT_SCHEMA_VERSION,
} from '../remotionStyleUtils.js'

// ═══════════════════════════════════════════════════════════════
// resolveConfig — deep merge, defaults, clamping
// ═══════════════════════════════════════════════════════════════

describe('resolveConfig', () => {
    it('returns all defaults for null input', () => {
        const result = resolveConfig(null)
        expect(result.schema_version).toBe(1)
        expect(result.text.font_size_normal).toBe(36)
        expect(result.text.font_size_keyword).toBe(56)
        expect(result.badge.enable).toBe(false)
        expect(result.effects.particles.enable).toBe(false)
        expect(result.position.anchor).toBe('center')
        expect(result.safe_area.top_percent).toBe(10)
    })

    it('returns all defaults for undefined input', () => {
        const result = resolveConfig(undefined)
        expect(result.schema_version).toBe(1)
        expect(result.text.lines).toEqual([])
        expect(result.overlay.gradient_top.enable).toBe(false)
    })

    it('returns all defaults for empty object', () => {
        const result = resolveConfig({})
        expect(result.schema_version).toBe(1)
        expect(result.text.color).toBe('#FFFFFF')
        expect(result.decorations.divider.enable).toBe(false)
    })

    it('deep merges partial config, filling missing keys with defaults', () => {
        const partial = {
            text: { font_size_normal: 48 },
            badge: { enable: true, text: 'VIRAL' },
        }
        const result = resolveConfig(partial)

        // Overridden values
        expect(result.text.font_size_normal).toBe(48)
        expect(result.badge.enable).toBe(true)
        expect(result.badge.text).toBe('VIRAL')

        // Defaults preserved
        expect(result.text.font_size_keyword).toBe(56)
        expect(result.badge.bg_color).toBe('#EA449A')
        expect(result.effects.flash.enable).toBe(false)
    })

    it('clamps text.lines to max 6 entries', () => {
        const config = {
            text: {
                lines: [
                    { text: 'Line 1' },
                    { text: 'Line 2' },
                    { text: 'Line 3' },
                    { text: 'Line 4' },
                    { text: 'Line 5' },
                    { text: 'Line 6' },
                    { text: 'Line 7 - should be dropped' },
                    { text: 'Line 8 - should be dropped' },
                ],
            },
        }
        const result = resolveConfig(config)
        expect(result.text.lines).toHaveLength(6)
        expect(result.text.lines[5].text).toBe('Line 6')
    })

    it('clamps badge.text to max 30 characters', () => {
        const config = {
            badge: { enable: true, text: 'A'.repeat(50) },
        }
        const result = resolveConfig(config)
        expect(result.badge.text).toHaveLength(30)
    })

    it('clamps position offset_y to [-500, 500]', () => {
        const config = { position: { offset_y: 999 } }
        const result = resolveConfig(config)
        expect(result.position.offset_y).toBe(500)

        const config2 = { position: { offset_y: -800 } }
        const result2 = resolveConfig(config2)
        expect(result2.position.offset_y).toBe(-500)
    })

    it('clamps position offset_x to [-500, 500]', () => {
        const config = { position: { offset_x: 600 } }
        const result = resolveConfig(config)
        expect(result.position.offset_x).toBe(500)

        const config2 = { position: { offset_x: -700 } }
        const result2 = resolveConfig(config2)
        expect(result2.position.offset_x).toBe(-500)
    })

    it('clamps safe_area percents to [0, 40]', () => {
        const config = {
            safe_area: { override: true, top_percent: 50, bottom_percent: -5, side_percent: 45 },
        }
        const result = resolveConfig(config)
        expect(result.safe_area.top_percent).toBe(40)
        expect(result.safe_area.bottom_percent).toBe(0)
        expect(result.safe_area.side_percent).toBe(40)
    })

    it('clamps effects.particles.count to [1, 12]', () => {
        const config = { effects: { particles: { enable: true, count: 50 } } }
        const result = resolveConfig(config)
        expect(result.effects.particles.count).toBe(12)

        const config2 = { effects: { particles: { enable: true, count: 0 } } }
        const result2 = resolveConfig(config2)
        expect(result2.effects.particles.count).toBe(1)
    })
})

// ═══════════════════════════════════════════════════════════════
// resolveEasing — easing string to cubic-bezier array
// ═══════════════════════════════════════════════════════════════

describe('resolveEasing', () => {
    it('returns correct array for "linear"', () => {
        expect(resolveEasing('linear')).toEqual([0, 0, 1, 1])
    })

    it('returns correct array for "easeIn"', () => {
        expect(resolveEasing('easeIn')).toEqual([0.42, 0, 1, 1])
    })

    it('returns correct array for "easeOut"', () => {
        expect(resolveEasing('easeOut')).toEqual([0, 0, 0.58, 1])
    })

    it('returns correct array for "easeInOut"', () => {
        expect(resolveEasing('easeInOut')).toEqual([0.42, 0, 0.58, 1])
    })

    it('returns correct array for "circOut"', () => {
        expect(resolveEasing('circOut')).toEqual([0, 0.55, 0.45, 1])
    })

    it('returns correct array for "backOut"', () => {
        expect(resolveEasing('backOut')).toEqual([0.175, 0.885, 0.32, 1.275])
    })

    it('returns correct array for "bounce"', () => {
        expect(resolveEasing('bounce')).toEqual([0.34, 1.56, 0.64, 1])
    })

    it('returns easeOut fallback for invalid string', () => {
        expect(resolveEasing('unknownEasing')).toEqual(EASING_MAP.easeOut)
    })

    it('returns easeOut fallback for null', () => {
        expect(resolveEasing(null)).toEqual(EASING_MAP.easeOut)
    })

    it('returns easeOut fallback for undefined', () => {
        expect(resolveEasing(undefined)).toEqual(EASING_MAP.easeOut)
    })

    it('returns easeOut fallback for empty string', () => {
        expect(resolveEasing('')).toEqual(EASING_MAP.easeOut)
    })

    it('returns easeOut fallback for non-string types', () => {
        expect(resolveEasing(123)).toEqual(EASING_MAP.easeOut)
        expect(resolveEasing({})).toEqual(EASING_MAP.easeOut)
    })
})

// ═══════════════════════════════════════════════════════════════
// computeSafeArea — pixel bounds calculation
// ═══════════════════════════════════════════════════════════════

describe('computeSafeArea', () => {
    it('returns default safe area for 1080x1920 with no override', () => {
        const result = computeSafeArea(1080, 1920, null)
        // top 10% of 1920 = 192
        expect(result.top).toBe(192)
        // bottom = 1920 * (1 - 0.20) = 1536
        expect(result.bottom).toBe(1536)
        // left = 1080 * 0.10 = 108
        expect(result.left).toBe(108)
        // right = 1080 * (1 - 0.10) = 972
        expect(result.right).toBe(972)
        // width = 972 - 108 = 864
        expect(result.width).toBe(864)
        // height = 1536 - 192 = 1344
        expect(result.height).toBe(1344)
    })

    it('uses default percentages when override is false', () => {
        const config = { override: false, top_percent: 5, bottom_percent: 15, side_percent: 5 }
        const result = computeSafeArea(1080, 1920, config)
        // Should ignore custom values since override is false
        expect(result.top).toBe(192)   // still 10%
        expect(result.bottom).toBe(1536) // still 1 - 20%
        expect(result.left).toBe(108)  // still 10%
    })

    it('uses custom percentages when override is true', () => {
        const config = { override: true, top_percent: 5, bottom_percent: 15, side_percent: 5 }
        const result = computeSafeArea(1080, 1920, config)
        // top 5% of 1920 = 96
        expect(result.top).toBe(96)
        // bottom = 1920 * (1 - 0.15) = 1632
        expect(result.bottom).toBe(1632)
        // left = 1080 * 0.05 = 54
        expect(result.left).toBe(54)
        // right = 1080 * 0.95 = 1026
        expect(result.right).toBe(1026)
        expect(result.width).toBe(1026 - 54) // 972
        expect(result.height).toBe(1632 - 96) // 1536
    })

    it('returns default safe area when config is empty object', () => {
        const result = computeSafeArea(1080, 1920, {})
        expect(result.top).toBe(192)
        expect(result.bottom).toBe(1536)
        expect(result.left).toBe(108)
        expect(result.right).toBe(972)
    })
})

// ═══════════════════════════════════════════════════════════════
// buildLineStyle — per-line style with fallback
// ═══════════════════════════════════════════════════════════════

describe('buildLineStyle', () => {
    it('returns empty object for null hookStyle', () => {
        expect(buildLineStyle(null, 0, 1)).toEqual({})
    })

    it('uses per-line font_size when provided', () => {
        const hookStyle = {
            config: {
                text: {
                    lines: [{ text: 'Hello', font_size: 72 }],
                    font_size_normal: 36,
                },
            },
        }
        const result = buildLineStyle(hookStyle, 0, 1)
        expect(result.fontSize).toBe('72px')
    })

    it('falls back to top-level text.font_size_normal when line omits font_size', () => {
        const hookStyle = {
            config: {
                text: {
                    lines: [{ text: 'No size here' }],
                    font_size_normal: 48,
                },
            },
        }
        const result = buildLineStyle(hookStyle, 0, 1)
        expect(result.fontSize).toBe('48px')
    })

    it('falls back to top-level text properties when lineIndex is out of bounds', () => {
        const hookStyle = {
            font_size_normal: 40,
            color: '#FF0000',
            font_family: 'Roboto',
            config: {
                text: {
                    lines: [{ text: 'Only one line', font_size: 60 }],
                    font_size_normal: 36,
                    color: '#00FF00',
                },
            },
        }
        // Index 5 is out of bounds (only 1 line)
        const result = buildLineStyle(hookStyle, 5, 1)
        // Falls back to config.text.font_size_normal
        expect(result.fontSize).toBe('36px')
        expect(result.color).toBe('#00FF00')
    })

    it('applies scale factor to font size', () => {
        const hookStyle = {
            config: {
                text: {
                    lines: [{ text: 'Scaled', font_size: 80 }],
                },
            },
        }
        const result = buildLineStyle(hookStyle, 0, 0.5)
        expect(result.fontSize).toBe('40px')
    })

    it('uses resolved config default font_size_normal when hookStyle has no config', () => {
        const hookStyle = {
            font_size_normal: 44,
            color: '#AABBCC',
            font_family: 'Poppins',
        }
        const result = buildLineStyle(hookStyle, 0, 1)
        // No config → resolveConfig(null) provides default font_size_normal: 36
        // which takes precedence over hookStyle.font_size_normal in the fallback chain
        expect(result.fontSize).toBe('36px')
    })
})

// ═══════════════════════════════════════════════════════════════
// migrateConfig — schema version migration
// ═══════════════════════════════════════════════════════════════

describe('migrateConfig', () => {
    it('returns defaults with schema_version: 1 for null input', () => {
        const result = migrateConfig(null)
        expect(result.schema_version).toBe(1)
        expect(result.text).toBeDefined()
        expect(result.badge).toBeDefined()
    })

    it('returns defaults with schema_version: 1 for undefined input', () => {
        const result = migrateConfig(undefined)
        expect(result.schema_version).toBe(1)
    })

    it('migrates v0 (no schema_version) by adding schema_version: 1', () => {
        const legacy = { text: { font_size_normal: 50 }, badge: { enable: true } }
        const result = migrateConfig(legacy)
        expect(result.schema_version).toBe(1)
        // Original fields preserved
        expect(result.text.font_size_normal).toBe(50)
        expect(result.badge.enable).toBe(true)
    })

    it('returns v1 config as-is', () => {
        const v1 = { schema_version: 1, text: { lines: [{ text: 'Hello' }] } }
        const result = migrateConfig(v1)
        expect(result).toBe(v1) // Same reference
        expect(result.schema_version).toBe(1)
    })

    it('throws Error for schema_version > 1', () => {
        const future = { schema_version: 2, text: { lines: [] } }
        expect(() => migrateConfig(future)).toThrow('Unsupported schema_version')
    })

    it('throws Error with version number in message for version 5', () => {
        const future = { schema_version: 5 }
        expect(() => migrateConfig(future)).toThrow('Unsupported schema_version: 5')
    })

    it('treats non-object values (string, number) as null → returns defaults', () => {
        expect(migrateConfig('hello').schema_version).toBe(1)
        expect(migrateConfig(42).schema_version).toBe(1)
    })
})
