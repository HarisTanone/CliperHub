import { describe, it, expect } from 'vitest';
import { migrateConfig } from '../schemaVersion';

describe('migrateConfig', () => {
    it('returns resolved config with schema_version 1 for null input', () => {
        const result = migrateConfig(null);
        expect(result.schema_version).toBe(1);
        expect(result.text?.font_size_normal).toBe(36);
        expect(result.position?.anchor).toBe('center');
    });

    it('returns resolved config with schema_version 1 for undefined input', () => {
        const result = migrateConfig(undefined);
        expect(result.schema_version).toBe(1);
        expect(result.text?.lines).toEqual([]);
    });

    it('maps v0 (legacy) flat fields to v1 nested structure', () => {
        const legacyConfig = {
            font_size_normal: 42,
            font_size_keyword: 64,
            color: '#FF0000',
            keyword_color: '#00FF00',
            animation_type: 'slam_left',
            anchor: 'top',
            offset_y: 50,
        };

        const result = migrateConfig(legacyConfig);
        expect(result.schema_version).toBe(1);
        expect(result.text?.font_size_normal).toBe(42);
        expect(result.text?.font_size_keyword).toBe(64);
        expect(result.text?.color).toBe('#FF0000');
        expect(result.text?.keyword_color).toBe('#00FF00');
        expect(result.animation?.type).toBe('slam_left');
        expect(result.position?.anchor).toBe('top');
        expect(result.position?.offset_y).toBe(50);
    });

    it('returns resolved config for version 1 input (no migration)', () => {
        const v1Config = {
            schema_version: 1,
            text: {
                lines: [],
                font_size_normal: 40,
                font_size_keyword: 60,
                color: '#AABBCC',
                keyword_color: '#DDEEFF',
                fontfile: '',
                fallback_font: 'Inter',
                line_spacing: 12,
                word_spacing: 14,
                padding_horizontal: 60,
                text_transform: 'none',
                letter_spacing: 1,
            },
            position: {
                anchor: 'bottom',
                offset_y: 100,
                offset_x: -50,
            },
        };

        const result = migrateConfig(v1Config);
        expect(result.schema_version).toBe(1);
        expect(result.text?.font_size_normal).toBe(40);
        expect(result.text?.fallback_font).toBe('Inter');
        expect(result.position?.anchor).toBe('bottom');
        expect(result.position?.offset_y).toBe(100);
        expect(result.position?.offset_x).toBe(-50);
    });

    it('throws Error with "Unsupported schema_version" for version > 1', () => {
        const futureConfig = { schema_version: 2 };
        expect(() => migrateConfig(futureConfig)).toThrow('Unsupported schema_version');
    });

    it('throws Error for version 3', () => {
        const futureConfig = { schema_version: 3 };
        expect(() => migrateConfig(futureConfig)).toThrow('Unsupported schema_version: 3');
    });
});
