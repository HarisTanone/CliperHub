import { describe, it, expect } from 'vitest';
import { resolveConfig, DEFAULT_CONFIG, clamp } from '../configDefaults';

describe('resolveConfig', () => {
    it('returns all defaults for empty object', () => {
        const result = resolveConfig({});
        expect(result.schema_version).toBe(1);
        expect(result.text?.font_size_normal).toBe(36);
        expect(result.text?.font_size_keyword).toBe(56);
        expect(result.badge?.enable).toBe(false);
        expect(result.position?.anchor).toBe('center');
        expect(result.safe_area?.top_percent).toBe(10);
    });

    it('returns all defaults for null input', () => {
        const result = resolveConfig(null);
        expect(result.schema_version).toBe(1);
        expect(result.text?.lines).toEqual([]);
        expect(result.effects?.particles.count).toBe(8);
    });

    it('returns all defaults for undefined input', () => {
        const result = resolveConfig(undefined);
        expect(result.schema_version).toBe(1);
        expect(result.position?.offset_y).toBe(0);
    });

    it('merges partial config and fills missing with defaults', () => {
        const partial = {
            text: { font_size_normal: 48 },
            badge: { enable: true, text: 'NEW' },
        };
        const result = resolveConfig(partial);

        // Overridden values
        expect(result.text?.font_size_normal).toBe(48);
        expect(result.badge?.enable).toBe(true);
        expect(result.badge?.text).toBe('NEW');

        // Defaults filled in
        expect(result.text?.font_size_keyword).toBe(56);
        expect(result.text?.color).toBe('#FFFFFF');
        expect(result.badge?.bg_color).toBe('#EA449A');
        expect(result.position?.anchor).toBe('center');
    });

    it('caps text.lines array at 6 entries', () => {
        const lines = Array.from({ length: 10 }, (_, i) => ({
            text: `Line ${i}`,
            color: '#FFF',
            font_size: 36,
            font: 'Anton',
            font_weight: 'bold',
            letter_spacing: 0,
        }));
        const result = resolveConfig({ text: { lines } });
        expect(result.text?.lines.length).toBe(6);
    });

    it('truncates badge.text at 30 characters', () => {
        const longText = 'A'.repeat(50);
        const result = resolveConfig({ badge: { text: longText } });
        expect(result.badge?.text.length).toBe(30);
    });

    it('clamps position.offset_y to [-500, 500]', () => {
        const resultHigh = resolveConfig({ position: { offset_y: 999 } });
        expect(resultHigh.position?.offset_y).toBe(500);

        const resultLow = resolveConfig({ position: { offset_y: -999 } });
        expect(resultLow.position?.offset_y).toBe(-500);
    });

    it('clamps position.offset_x to [-500, 500]', () => {
        const resultHigh = resolveConfig({ position: { offset_x: 700 } });
        expect(resultHigh.position?.offset_x).toBe(500);

        const resultLow = resolveConfig({ position: { offset_x: -700 } });
        expect(resultLow.position?.offset_x).toBe(-500);
    });

    it('clamps safe_area.*_percent to [0, 40]', () => {
        const result = resolveConfig({
            safe_area: { top_percent: 60, bottom_percent: -5, side_percent: 50 },
        });
        expect(result.safe_area?.top_percent).toBe(40);
        expect(result.safe_area?.bottom_percent).toBe(0);
        expect(result.safe_area?.side_percent).toBe(40);
    });

    it('clamps effects.particles.count to [1, 12]', () => {
        const resultHigh = resolveConfig({ effects: { particles: { count: 99 } } });
        expect(resultHigh.effects?.particles.count).toBe(12);

        const resultLow = resolveConfig({ effects: { particles: { count: 0 } } });
        expect(resultLow.effects?.particles.count).toBe(1);
    });
});

describe('clamp', () => {
    it('returns value when within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it('returns min when value is below range', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('returns max when value is above range', () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });
});
