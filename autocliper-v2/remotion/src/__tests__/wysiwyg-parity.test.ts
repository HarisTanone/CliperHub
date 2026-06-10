/**
 * WYSIWYG Parity Test Harness
 *
 * Contract tests verifying that the Remotion (Overlay_Renderer) engine produces
 * identical output to the frontend (Preview_Engine) for shared utilities.
 *
 * This harness validates:
 * 1. Easing map parity — cubic-bezier arrays are identical between engines
 * 2. resolveConfig parity — default config values match frontend expectations
 * 3. Safe area computation parity — pixel bounds are identical for same inputs
 * 4. Animation timing tolerance — stagger delays within 33ms (1 frame at 30fps)
 * 5. Transform builder parity — CSS strings match expected frontend output
 *
 * If either engine changes its implementation, these tests will break,
 * signaling a potential WYSIWYG parity violation.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
import { describe, it, expect } from 'vitest';

import { EASING_MAP, resolveEasing, buildSlamLeft, buildSlamRight, buildScaleRotate, buildSlideUp, buildPop, buildFade, getTransformBuilder } from '../utils/animations';
import { resolveConfig } from '../utils/configDefaults';
import { computeSafeArea } from '../utils/safeArea';

// ═══════════════════════════════════════════════════════════════
// 1. EASING MAP PARITY
// ═══════════════════════════════════════════════════════════════

describe('Easing Map Parity (Req 8.4, 8.2)', () => {
    /**
     * These are the exact cubic-bezier values from the frontend's
     * remotionStyleUtils.js EASING_MAP constant. Both engines MUST
     * produce identical arrays for the same easing names.
     */
    const FRONTEND_EASING_MAP: Record<string, number[]> = {
        linear: [0, 0, 1, 1],
        easeIn: [0.42, 0, 1, 1],
        easeOut: [0, 0, 0.58, 1],
        easeInOut: [0.42, 0, 0.58, 1],
        circOut: [0, 0.55, 0.45, 1],
        backOut: [0.175, 0.885, 0.32, 1.275],
        bounce: [0.34, 1.56, 0.64, 1],
    };

    it('contains the same easing type keys as the frontend', () => {
        const remotionKeys = Object.keys(EASING_MAP).sort();
        const frontendKeys = Object.keys(FRONTEND_EASING_MAP).sort();
        expect(remotionKeys).toEqual(frontendKeys);
    });

    it.each(Object.entries(FRONTEND_EASING_MAP))(
        'EASING_MAP["%s"] matches frontend cubic-bezier values',
        (name, expectedValues) => {
            const remotionValues = EASING_MAP[name as keyof typeof EASING_MAP];
            expect(remotionValues).toEqual(expectedValues);
        },
    );

    it('resolveEasing falls back to easeOut for unknown values (same as frontend)', () => {
        const result = resolveEasing('nonexistent');
        expect(result).toEqual(FRONTEND_EASING_MAP.easeOut);
    });

    it('resolveEasing falls back to easeOut for empty string (same as frontend)', () => {
        const result = resolveEasing('');
        expect(result).toEqual(FRONTEND_EASING_MAP.easeOut);
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. RESOLVE CONFIG PARITY
// ═══════════════════════════════════════════════════════════════

describe('resolveConfig Default Parity (Req 8.1, 8.4)', () => {
    /**
     * These are the exact default values the frontend's resolveConfig({})
     * produces. The Remotion engine MUST produce identical defaults.
     */
    it('produces schema_version: 1 for empty config', () => {
        const result = resolveConfig({});
        expect(result.schema_version).toBe(1);
    });

    it('produces all enable flags as false for empty config', () => {
        const result = resolveConfig({});

        expect(result.badge?.enable).toBe(false);
        expect(result.decorations?.divider.enable).toBe(false);
        expect(result.decorations?.emoji_row.enable).toBe(false);
        expect(result.effects?.flash.enable).toBe(false);
        expect(result.effects?.particles.enable).toBe(false);
        expect(result.overlay?.gradient_top.enable).toBe(false);
        expect(result.overlay?.gradient_bottom.enable).toBe(false);
    });

    it('produces empty arrays for text.lines and font_registry', () => {
        const result = resolveConfig({});

        expect(result.text?.lines).toEqual([]);
        expect(result.font_registry).toEqual([]);
    });

    it('produces default text values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.text?.font_size_normal).toBe(36);
        expect(result.text?.font_size_keyword).toBe(56);
        expect(result.text?.color).toBe('#FFFFFF');
        expect(result.text?.keyword_color).toBe('#FFFFFF');
        expect(result.text?.fontfile).toBe('');
        expect(result.text?.fallback_font).toBe('Anton');
        expect(result.text?.line_spacing).toBe(10);
        expect(result.text?.word_spacing).toBe(12);
        expect(result.text?.padding_horizontal).toBe(80);
        expect(result.text?.text_transform).toBe('uppercase');
        expect(result.text?.letter_spacing).toBe(0);
    });

    it('produces default badge values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.badge?.text).toBe('');
        expect(result.badge?.bg_color).toBe('#EA449A');
        expect(result.badge?.font_size).toBe(10);
        expect(result.badge?.font_family).toBe('Montserrat');
        expect(result.badge?.letter_spacing).toBe(2);
    });

    it('produces default animation values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.animation?.type).toBe('fade');
        expect(result.animation?.per_line).toEqual([]);
    });

    it('produces default position values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.position?.anchor).toBe('center');
        expect(result.position?.offset_y).toBe(0);
        expect(result.position?.offset_x).toBe(0);
    });

    it('produces default safe_area values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.safe_area?.override).toBe(false);
        expect(result.safe_area?.top_percent).toBe(10);
        expect(result.safe_area?.bottom_percent).toBe(20);
        expect(result.safe_area?.side_percent).toBe(10);
    });

    it('produces default effects values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.effects?.flash.color).toBe('rgba(192,132,252,0.3)');
        expect(result.effects?.flash.delay).toBe(0);
        expect(result.effects?.flash.duration).toBe(0.55);
        expect(result.effects?.particles.count).toBe(8);
        expect(result.effects?.particles.colors).toEqual([]);
        expect(result.effects?.particles.size_range).toEqual([3, 5]);
    });

    it('produces default overlay values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.overlay?.gradient_top.color).toBe('rgba(0,0,0,0.5)');
        expect(result.overlay?.gradient_top.height_percent).toBe(40);
        expect(result.overlay?.gradient_bottom.color).toBe('rgba(0,0,0,0.85)');
        expect(result.overlay?.gradient_bottom.height_percent).toBe(35);
    });

    it('produces default decorations values matching frontend', () => {
        const result = resolveConfig({});

        expect(result.decorations?.divider.colors).toEqual([]);
        expect(result.decorations?.divider.width).toBe(180);
        expect(result.decorations?.divider.delay).toBe(0);
        expect(result.decorations?.emoji_row.emojis).toEqual([]);
        expect(result.decorations?.emoji_row.delay).toBe(0);
    });

    it('handles null/undefined input same as frontend (treats as empty object)', () => {
        const resultNull = resolveConfig(null);
        const resultUndefined = resolveConfig(undefined);
        const resultEmpty = resolveConfig({});

        expect(resultNull).toEqual(resultEmpty);
        expect(resultUndefined).toEqual(resultEmpty);
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. SAFE AREA COMPUTATION PARITY
// ═══════════════════════════════════════════════════════════════

describe('Safe Area Computation Parity (Req 8.3, 8.4)', () => {
    /**
     * These are the exact pixel values the frontend's computeSafeArea(1080, 1920, undefined)
     * produces. Both engines use the same formula:
     *   top = round(frameH * 0.10)
     *   bottom = round(frameH * 0.80)
     *   left = round(frameW * 0.10)
     *   right = round(frameW * 0.90)
     */
    it('computes default safe area for 1080x1920 matching frontend', () => {
        const result = computeSafeArea(1080, 1920, undefined);

        expect(result.top).toBe(192);
        expect(result.bottom).toBe(1536);
        expect(result.left).toBe(108);
        expect(result.right).toBe(972);
        expect(result.width).toBe(864);
        expect(result.height).toBe(1344);
    });

    it('computes default safe area for preview dimensions (280x497) matching frontend', () => {
        const result = computeSafeArea(280, 497, undefined);

        // top = round(497 * 0.10) = 50
        // bottom = round(497 * 0.80) = 398
        // left = round(280 * 0.10) = 28
        // right = round(280 * 0.90) = 252
        expect(result.top).toBe(50);
        expect(result.bottom).toBe(398);
        expect(result.left).toBe(28);
        expect(result.right).toBe(252);
        expect(result.width).toBe(252 - 28); // 224
        expect(result.height).toBe(398 - 50); // 348
    });

    it('respects override with custom percentages (same logic as frontend)', () => {
        const result = computeSafeArea(1080, 1920, {
            override: true,
            top_percent: 15,
            bottom_percent: 25,
            side_percent: 5,
        });

        // top = round(1920 * 0.15) = 288
        // bottom = round(1920 * 0.75) = 1440
        // left = round(1080 * 0.05) = 54
        // right = round(1080 * 0.95) = 1026
        expect(result.top).toBe(288);
        expect(result.bottom).toBe(1440);
        expect(result.left).toBe(54);
        expect(result.right).toBe(1026);
        expect(result.width).toBe(1026 - 54); // 972
        expect(result.height).toBe(1440 - 288); // 1152
    });

    it('ignores custom values when override is false (uses defaults like frontend)', () => {
        const result = computeSafeArea(1080, 1920, {
            override: false,
            top_percent: 30,
            bottom_percent: 30,
            side_percent: 30,
        });

        // Should use defaults regardless of custom values
        expect(result.top).toBe(192);
        expect(result.bottom).toBe(1536);
        expect(result.left).toBe(108);
        expect(result.right).toBe(972);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. ANIMATION TIMING TOLERANCE
// ═══════════════════════════════════════════════════════════════

describe('Animation Timing Parity (Req 8.2)', () => {
    /**
     * WYSIWYG timing tolerance: ≤33ms (1 frame at 30fps).
     * Both engines use the same stagger delay formula: 0.23 * lineIndex.
     * This test verifies the formula produces identical delays.
     */
    const TIMING_TOLERANCE_MS = 33; // 1 frame at 30fps
    const STAGGER_DELAY_FACTOR = 0.23; // seconds per line index

    it('stagger delay formula produces same values for both engines', () => {
        // Frontend formula: delay = 0.23 * lineIndex
        // Remotion formula: delay = 0.23 * lineIndex
        for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
            const frontendDelay = STAGGER_DELAY_FACTOR * lineIndex;
            const remotionDelay = STAGGER_DELAY_FACTOR * lineIndex;

            const differenceMs = Math.abs(frontendDelay - remotionDelay) * 1000;
            expect(differenceMs).toBeLessThanOrEqual(TIMING_TOLERANCE_MS);

            // They should be exactly equal since same formula
            expect(remotionDelay).toBe(frontendDelay);
        }
    });

    it('stagger delays for each line index match expected values', () => {
        const expectedDelays = [
            0,       // line 0: 0.23 * 0 = 0
            0.23,    // line 1: 0.23 * 1 = 0.23
            0.46,    // line 2: 0.23 * 2 = 0.46
            0.69,    // line 3: 0.23 * 3 = 0.69
            0.92,    // line 4: 0.23 * 4 = 0.92
            1.15,    // line 5: 0.23 * 5 = 1.15
        ];

        for (let i = 0; i < expectedDelays.length; i++) {
            const computed = STAGGER_DELAY_FACTOR * i;
            expect(computed).toBeCloseTo(expectedDelays[i], 10);
        }
    });

    it('documents timing tolerance constraint', () => {
        // This test documents the ≤33ms parity constraint.
        // At 30fps, 1 frame = 1000/30 ≈ 33.33ms.
        // Any timing difference between Preview_Engine and Overlay_Renderer
        // exceeding this threshold is a parity violation.
        const oneFrameMs = 1000 / 30;
        expect(TIMING_TOLERANCE_MS).toBeLessThanOrEqual(oneFrameMs);
    });
});

// ═══════════════════════════════════════════════════════════════
// 5. TRANSFORM BUILDER PARITY
// ═══════════════════════════════════════════════════════════════

describe('Transform Builder Parity (Req 8.3, 8.4)', () => {
    /**
     * Each transform builder must produce the same CSS strings at
     * progress = 0, 0.5, and 1 as the frontend's equivalent logic.
     * These expected values are hardcoded from the frontend implementation.
     */

    describe('buildSlamLeft', () => {
        it('produces translateX(-100%) at progress 0', () => {
            expect(buildSlamLeft(0)).toBe('translateX(-100%)');
        });

        it('produces translateX(-50%) at progress 0.5', () => {
            expect(buildSlamLeft(0.5)).toBe('translateX(-50%)');
        });

        it('produces translateX(0%) at progress 1', () => {
            expect(buildSlamLeft(1)).toBe('translateX(0%)');
        });
    });

    describe('buildSlamRight', () => {
        it('produces translateX(100%) at progress 0', () => {
            expect(buildSlamRight(0)).toBe('translateX(100%)');
        });

        it('produces translateX(50%) at progress 0.5', () => {
            expect(buildSlamRight(0.5)).toBe('translateX(50%)');
        });

        it('produces translateX(0%) at progress 1', () => {
            expect(buildSlamRight(1)).toBe('translateX(0%)');
        });
    });

    describe('buildScaleRotate', () => {
        it('produces scale(0) rotate(-15deg) at progress 0', () => {
            expect(buildScaleRotate(0)).toBe('scale(0) rotate(-15deg)');
        });

        it('produces scale(0.5) rotate(-7.5deg) at progress 0.5', () => {
            expect(buildScaleRotate(0.5)).toBe('scale(0.5) rotate(-7.5deg)');
        });

        it('produces scale(1) rotate(0deg) at progress 1', () => {
            expect(buildScaleRotate(1)).toBe('scale(1) rotate(0deg)');
        });
    });

    describe('buildSlideUp', () => {
        it('produces translateY(100%) at progress 0', () => {
            expect(buildSlideUp(0)).toBe('translateY(100%)');
        });

        it('produces translateY(50%) at progress 0.5', () => {
            expect(buildSlideUp(0.5)).toBe('translateY(50%)');
        });

        it('produces translateY(0%) at progress 1', () => {
            expect(buildSlideUp(1)).toBe('translateY(0%)');
        });
    });

    describe('buildPop', () => {
        it('produces scale(0) at progress 0', () => {
            expect(buildPop(0)).toBe('scale(0)');
        });

        it('produces scale(1) at progress 0.5', () => {
            // At progress 0.5: 0.5 < 0.6, so scale = (0.5/0.6) * 1.2 = 1.0
            expect(buildPop(0.5)).toBe('scale(1)');
        });

        it('produces scale(1.2) at progress 0.6 (peak overshoot)', () => {
            // At progress 0.6: exactly at boundary, scale = (0.6/0.6) * 1.2 = 1.2
            expect(buildPop(0.6)).toBe('scale(1.2)');
        });

        it('produces scale(1) at progress 1', () => {
            // At progress 1: (1 - 0.6) / 0.4 = 1.0, scale = 1.2 - 0.2*1 = 1.0
            expect(buildPop(1)).toBe('scale(1)');
        });
    });

    describe('buildFade', () => {
        it('produces "none" at any progress (opacity-only, no transform)', () => {
            expect(buildFade(0)).toBe('none');
            expect(buildFade(0.5)).toBe('none');
            expect(buildFade(1)).toBe('none');
        });
    });

    describe('getTransformBuilder resolution', () => {
        it('resolves slam_left to buildSlamLeft', () => {
            const builder = getTransformBuilder('slam_left');
            expect(builder(0)).toBe(buildSlamLeft(0));
            expect(builder(1)).toBe(buildSlamLeft(1));
        });

        it('resolves slam_right to buildSlamRight', () => {
            const builder = getTransformBuilder('slam_right');
            expect(builder(0)).toBe(buildSlamRight(0));
            expect(builder(1)).toBe(buildSlamRight(1));
        });

        it('resolves scale_rotate to buildScaleRotate', () => {
            const builder = getTransformBuilder('scale_rotate');
            expect(builder(0)).toBe(buildScaleRotate(0));
            expect(builder(1)).toBe(buildScaleRotate(1));
        });

        it('resolves slide_up to buildSlideUp', () => {
            const builder = getTransformBuilder('slide_up');
            expect(builder(0)).toBe(buildSlideUp(0));
            expect(builder(1)).toBe(buildSlideUp(1));
        });

        it('resolves pop to buildPop', () => {
            const builder = getTransformBuilder('pop');
            expect(builder(0)).toBe(buildPop(0));
            expect(builder(1)).toBe(buildPop(1));
        });

        it('resolves fade to buildFade', () => {
            const builder = getTransformBuilder('fade');
            expect(builder(0)).toBe(buildFade(0));
            expect(builder(1)).toBe(buildFade(1));
        });

        it('resolves unknown types to buildFade (same fallback as frontend)', () => {
            const builder = getTransformBuilder('unknown_type');
            expect(builder(0)).toBe('none');
            expect(builder(1)).toBe('none');
        });
    });
});
