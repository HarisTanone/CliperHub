import { describe, it, expect } from 'vitest';
import {
    EASING_MAP,
    resolveEasing,
    buildSlamLeft,
    buildSlamRight,
    buildScaleRotate,
    buildSlideUp,
    buildPop,
    buildFade,
} from '../animations';

describe('resolveEasing', () => {
    it('maps "linear" to [0, 0, 1, 1]', () => {
        expect(resolveEasing('linear')).toEqual([0, 0, 1, 1]);
    });

    it('maps "easeIn" to [0.42, 0, 1, 1]', () => {
        expect(resolveEasing('easeIn')).toEqual([0.42, 0, 1, 1]);
    });

    it('maps "easeOut" to [0, 0, 0.58, 1]', () => {
        expect(resolveEasing('easeOut')).toEqual([0, 0, 0.58, 1]);
    });

    it('maps "easeInOut" to [0.42, 0, 0.58, 1]', () => {
        expect(resolveEasing('easeInOut')).toEqual([0.42, 0, 0.58, 1]);
    });

    it('maps "circOut" to [0, 0.55, 0.45, 1]', () => {
        expect(resolveEasing('circOut')).toEqual([0, 0.55, 0.45, 1]);
    });

    it('maps "backOut" to [0.175, 0.885, 0.32, 1.275]', () => {
        expect(resolveEasing('backOut')).toEqual([0.175, 0.885, 0.32, 1.275]);
    });

    it('maps "bounce" to [0.34, 1.56, 0.64, 1]', () => {
        expect(resolveEasing('bounce')).toEqual([0.34, 1.56, 0.64, 1]);
    });

    it('returns easeOut fallback [0, 0, 0.58, 1] for invalid string', () => {
        expect(resolveEasing('invalidEasing')).toEqual([0, 0, 0.58, 1]);
    });

    it('returns easeOut fallback for empty string', () => {
        expect(resolveEasing('')).toEqual([0, 0, 0.58, 1]);
    });

    it('EASING_MAP contains exactly 7 entries', () => {
        expect(Object.keys(EASING_MAP)).toHaveLength(7);
    });
});

describe('transform builders', () => {
    describe('buildSlamLeft', () => {
        it('returns translateX(-100%) at progress 0', () => {
            expect(buildSlamLeft(0)).toBe('translateX(-100%)');
        });

        it('returns translateX(-50%) at progress 0.5', () => {
            expect(buildSlamLeft(0.5)).toBe('translateX(-50%)');
        });

        it('returns translateX(0%) at progress 1', () => {
            expect(buildSlamLeft(1)).toBe('translateX(0%)');
        });
    });

    describe('buildSlamRight', () => {
        it('returns translateX(100%) at progress 0', () => {
            expect(buildSlamRight(0)).toBe('translateX(100%)');
        });

        it('returns translateX(50%) at progress 0.5', () => {
            expect(buildSlamRight(0.5)).toBe('translateX(50%)');
        });

        it('returns translateX(0%) at progress 1', () => {
            expect(buildSlamRight(1)).toBe('translateX(0%)');
        });
    });

    describe('buildScaleRotate', () => {
        it('returns scale(0) rotate(-15deg) at progress 0', () => {
            expect(buildScaleRotate(0)).toBe('scale(0) rotate(-15deg)');
        });

        it('returns scale(0.5) rotate(-7.5deg) at progress 0.5', () => {
            expect(buildScaleRotate(0.5)).toBe('scale(0.5) rotate(-7.5deg)');
        });

        it('returns scale(1) rotate(0deg) at progress 1', () => {
            expect(buildScaleRotate(1)).toBe('scale(1) rotate(0deg)');
        });
    });

    describe('buildSlideUp', () => {
        it('returns translateY(100%) at progress 0', () => {
            expect(buildSlideUp(0)).toBe('translateY(100%)');
        });

        it('returns translateY(50%) at progress 0.5', () => {
            expect(buildSlideUp(0.5)).toBe('translateY(50%)');
        });

        it('returns translateY(0%) at progress 1', () => {
            expect(buildSlideUp(1)).toBe('translateY(0%)');
        });
    });

    describe('buildPop', () => {
        it('returns scale(0) at progress 0', () => {
            expect(buildPop(0)).toBe('scale(0)');
        });

        it('returns scale(1.2) at progress 0.6', () => {
            expect(buildPop(0.6)).toBe('scale(1.2)');
        });

        it('returns scale(1) at progress 1', () => {
            expect(buildPop(1)).toBe('scale(1)');
        });
    });

    describe('buildFade', () => {
        it('returns "none" at progress 0', () => {
            expect(buildFade(0)).toBe('none');
        });

        it('returns "none" at progress 0.5', () => {
            expect(buildFade(0.5)).toBe('none');
        });

        it('returns "none" at progress 1', () => {
            expect(buildFade(1)).toBe('none');
        });
    });
});
