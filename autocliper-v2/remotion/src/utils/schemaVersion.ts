import type { TemplateConfig } from '../types';
import { resolveConfig } from './configDefaults';

/**
 * Maps legacy v0 flat config fields to the v1 nested structure.
 * Legacy configs have no schema_version field and store values at the top level.
 */
function mapLegacyToV1(config: Record<string, unknown>): Record<string, unknown> {
    const v1: Record<string, unknown> = {};

    // Map legacy text fields
    if (
        config.font_size_normal ||
        config.font_size_keyword ||
        config.color ||
        config.keyword_color ||
        config.fontfile ||
        config.fallback_font ||
        config.text_transform ||
        config.letter_spacing
    ) {
        v1.text = {
            lines: [],
            font_size_normal: config.font_size_normal ?? 36,
            font_size_keyword: config.font_size_keyword ?? 56,
            color: config.color ?? '#FFFFFF',
            keyword_color: config.keyword_color ?? '#FFFFFF',
            fontfile: config.fontfile ?? '',
            fallback_font: config.fallback_font ?? 'Anton',
            line_spacing: config.line_spacing ?? 10,
            word_spacing: config.word_spacing ?? 12,
            padding_horizontal: config.padding_horizontal ?? 80,
            text_transform: config.text_transform ?? 'uppercase',
            letter_spacing: config.letter_spacing ?? 0,
        };
    }

    // Map legacy animation type
    if (config.animation_type) {
        v1.animation = {
            type: config.animation_type,
            per_line: [],
        };
    }

    // Map legacy position fields
    if (config.anchor || config.offset_y !== undefined || config.offset_x !== undefined) {
        v1.position = {
            anchor: config.anchor ?? 'center',
            offset_y: config.offset_y ?? 0,
            offset_x: config.offset_x ?? 0,
        };
    }

    // Pass through any fields that already match v1 structure
    if (config.text) v1.text = config.text;
    if (config.badge) v1.badge = config.badge;
    if (config.animation) v1.animation = config.animation;
    if (config.decorations) v1.decorations = config.decorations;
    if (config.effects) v1.effects = config.effects;
    if (config.overlay) v1.overlay = config.overlay;
    if (config.position && typeof config.position === 'object') v1.position = config.position;
    if (config.font_registry) v1.font_registry = config.font_registry;
    if (config.safe_area) v1.safe_area = config.safe_area;

    return v1;
}

/**
 * Detects the schema version of a config and migrates it to the current version (v1).
 *
 * - Version 0 (legacy, no schema_version): maps old flat fields to v1 nested structure
 * - Version 1: returns as-is (current version)
 * - Version > 1: throws Error with unsupported version message
 */
export function migrateConfig(config: unknown): TemplateConfig {
    const raw = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
    const version = (typeof raw.schema_version === 'number' ? raw.schema_version : 0);

    if (version === 0) {
        // Legacy config — map to v1 structure
        const migrated = mapLegacyToV1(raw);
        return resolveConfig({ schema_version: 1, ...migrated });
    }

    if (version === 1) {
        // Current version — resolve with defaults applied
        return resolveConfig(raw);
    }

    // Future version — reject
    throw new Error(`Unsupported schema_version: ${version}`);
}
