import type { TemplateConfig } from '../types';

/**
 * Clamps a number to the specified range.
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Deep merges source into target, returning a new object.
 * Arrays are replaced (not merged). Nested objects are recursively merged.
 */
function deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Record<string, unknown> | undefined | null,
): T {
    if (!source) return { ...target };

    const result: Record<string, unknown> = { ...target };

    for (const key of Object.keys(source)) {
        const sourceVal = source[key];
        const targetVal = (target as Record<string, unknown>)[key];

        if (
            sourceVal !== null &&
            sourceVal !== undefined &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            targetVal !== null &&
            targetVal !== undefined &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal)
        ) {
            result[key] = deepMerge(
                targetVal as Record<string, unknown>,
                sourceVal as Record<string, unknown>,
            );
        } else if (sourceVal !== undefined) {
            result[key] = sourceVal;
        }
    }

    return result as T;
}

/**
 * Default TemplateConfig values. All enable fields default to false,
 * arrays default to empty, schema_version defaults to 1.
 */
const DEFAULT_CONFIG: TemplateConfig = {
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
    },
    animation: {
        type: 'fade',
        per_line: [],
    },
    decorations: {
        divider: { enable: false, colors: [], width: 180, delay: 0 },
        emoji_row: { enable: false, emojis: [], delay: 0 },
    },
    effects: {
        flash: { enable: false, color: 'rgba(192,132,252,0.3)', delay: 0, duration: 0.55 },
        particles: { enable: false, count: 8, colors: [], size_range: [3, 5] },
    },
    overlay: {
        gradient_top: { enable: false, color: 'rgba(0,0,0,0.5)', height_percent: 40 },
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
};

/**
 * Validates and clamps config values to their allowed ranges.
 */
function validateConfig(config: TemplateConfig): TemplateConfig {
    const result = { ...config };

    // text.lines max 6
    if (result.text && result.text.lines.length > 6) {
        result.text = { ...result.text, lines: result.text.lines.slice(0, 6) };
    }

    // badge.text max 30 chars
    if (result.badge && result.badge.text && result.badge.text.length > 30) {
        result.badge = { ...result.badge, text: result.badge.text.slice(0, 30) };
    }

    // position.offset_y/x clamped to [-500, 500]
    if (result.position) {
        result.position = {
            ...result.position,
            offset_y: clamp(result.position.offset_y, -500, 500),
            offset_x: clamp(result.position.offset_x, -500, 500),
        };
    }

    // safe_area.*_percent clamped to [0, 40]
    if (result.safe_area) {
        result.safe_area = {
            ...result.safe_area,
            top_percent: clamp(result.safe_area.top_percent, 0, 40),
            bottom_percent: clamp(result.safe_area.bottom_percent, 0, 40),
            side_percent: clamp(result.safe_area.side_percent, 0, 40),
        };
    }

    // effects.particles.count clamped to [1, 12]
    if (result.effects && result.effects.particles) {
        result.effects = {
            ...result.effects,
            particles: {
                ...result.effects.particles,
                count: clamp(result.effects.particles.count, 1, 12),
            },
        };
    }

    return result;
}

/**
 * Resolves a raw config object into a fully-populated TemplateConfig
 * by deep-merging with defaults and applying validation/clamping.
 */
export function resolveConfig(rawConfig: unknown): TemplateConfig {
    const raw = (rawConfig && typeof rawConfig === 'object' ? rawConfig : {}) as Record<string, unknown>;
    const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, raw) as unknown as TemplateConfig;
    return validateConfig(merged);
}

export { DEFAULT_CONFIG, deepMerge, clamp };
