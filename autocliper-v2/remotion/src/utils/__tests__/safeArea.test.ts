import { describe, it, expect } from 'vitest';
import { computeSafeArea } from '../safeArea';

describe('computeSafeArea', () => {
    it('returns correct default bounds for 1080×1920 frame', () => {
        const result = computeSafeArea(1080, 1920);

        // top 10% of 1920 = 192
        expect(result.top).toBe(192);
        // bottom = 1920 * (1 - 20/100) = 1920 * 0.8 = 1536
        expect(result.bottom).toBe(1536);
        // left = 1080 * (10/100) = 108
        expect(result.left).toBe(108);
        // right = 1080 * (1 - 10/100) = 1080 * 0.9 = 972
        expect(result.right).toBe(972);
        // width = right - left = 972 - 108 = 864
        expect(result.width).toBe(864);
        // height = bottom - top = 1536 - 192 = 1344
        expect(result.height).toBe(1344);
    });

    it('uses defaults when safeAreaConfig is undefined', () => {
        const result = computeSafeArea(1080, 1920, undefined);
        expect(result.top).toBe(192);
        expect(result.bottom).toBe(1536);
    });

    it('uses defaults when safeAreaConfig.override is false', () => {
        const result = computeSafeArea(1080, 1920, {
            override: false,
            top_percent: 5,
            bottom_percent: 5,
            side_percent: 5,
        });
        // Should still use defaults, not the custom values
        expect(result.top).toBe(192);
        expect(result.bottom).toBe(1536);
        expect(result.left).toBe(108);
        expect(result.right).toBe(972);
    });

    it('applies custom override percentages', () => {
        const result = computeSafeArea(1080, 1920, {
            override: true,
            top_percent: 5,
            bottom_percent: 15,
            side_percent: 5,
        });

        // top = 1920 * 5/100 = 96
        expect(result.top).toBe(96);
        // bottom = 1920 * (1 - 15/100) = 1920 * 0.85 = 1632
        expect(result.bottom).toBe(1632);
        // left = 1080 * 5/100 = 54
        expect(result.left).toBe(54);
        // right = 1080 * (1 - 5/100) = 1080 * 0.95 = 1026
        expect(result.right).toBe(1026);
        // width = 1026 - 54 = 972
        expect(result.width).toBe(972);
        // height = 1632 - 96 = 1536
        expect(result.height).toBe(1536);
    });

    it('clamps override values beyond 40 to 40', () => {
        const result = computeSafeArea(1080, 1920, {
            override: true,
            top_percent: 60,
            bottom_percent: 50,
            side_percent: 45,
        });

        // All clamped to 40
        // top = 1920 * 40/100 = 768
        expect(result.top).toBe(768);
        // bottom = 1920 * (1 - 40/100) = 1920 * 0.6 = 1152
        expect(result.bottom).toBe(1152);
        // left = 1080 * 40/100 = 432
        expect(result.left).toBe(432);
        // right = 1080 * (1 - 40/100) = 1080 * 0.6 = 648
        expect(result.right).toBe(648);
    });

    it('clamps negative override values to 0', () => {
        const result = computeSafeArea(1080, 1920, {
            override: true,
            top_percent: -10,
            bottom_percent: -5,
            side_percent: -1,
        });

        // All clamped to 0
        expect(result.top).toBe(0);
        expect(result.bottom).toBe(1920);
        expect(result.left).toBe(0);
        expect(result.right).toBe(1080);
        expect(result.width).toBe(1080);
        expect(result.height).toBe(1920);
    });
});
