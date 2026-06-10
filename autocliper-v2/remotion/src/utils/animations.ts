import type { EasingType } from '../types';

/**
 * Mapping of easing type names to cubic-bezier control point arrays [x1, y1, x2, y2].
 */
export const EASING_MAP: Record<EasingType, number[]> = {
    linear: [0, 0, 1, 1],
    easeIn: [0.42, 0, 1, 1],
    easeOut: [0, 0, 0.58, 1],
    easeInOut: [0.42, 0, 0.58, 1],
    circOut: [0, 0.55, 0.45, 1],
    backOut: [0.175, 0.885, 0.32, 1.275],
    bounce: [0.34, 1.56, 0.64, 1],
};

/**
 * Resolves an easing string to a cubic-bezier array.
 * Falls back to easeOut for invalid/unknown values.
 */
export function resolveEasing(value: string): number[] {
    const key = value as EasingType;
    return EASING_MAP[key] ?? EASING_MAP.easeOut;
}

// ─── Transform Builders ──────────────────────────────────────────────────────
// Each builder takes progress (0-1) and returns a CSS transform string.

/**
 * Slam from the left: translates from -100% to 0.
 */
export function buildSlamLeft(progress: number): string {
    const translateX = -100 * (1 - progress);
    return `translateX(${translateX}%)`;
}

/**
 * Slam from the right: translates from +100% to 0.
 */
export function buildSlamRight(progress: number): string {
    const translateX = 100 * (1 - progress);
    return `translateX(${translateX}%)`;
}

/**
 * Scale and rotate: scales from 0 to 1, rotates from -15deg to 0deg.
 */
export function buildScaleRotate(progress: number): string {
    const scale = progress;
    const rotate = -15 * (1 - progress);
    return `scale(${scale}) rotate(${rotate}deg)`;
}

/**
 * Slide up: translates from +100% to 0 vertically.
 */
export function buildSlideUp(progress: number): string {
    const translateY = 100 * (1 - progress);
    return `translateY(${translateY}%)`;
}

/**
 * Pop: scales from 0 to 1.2 to 1 (overshoot at midpoint).
 */
export function buildPop(progress: number): string {
    let scale: number;
    if (progress < 0.6) {
        // Scale from 0 to 1.2 over first 60% of progress
        scale = (progress / 0.6) * 1.2;
    } else {
        // Scale from 1.2 to 1.0 over remaining 40%
        const t = (progress - 0.6) / 0.4;
        scale = 1.2 - 0.2 * t;
    }
    return `scale(${scale})`;
}

/**
 * Fade: only opacity change, no transform needed. Returns empty transform.
 */
export function buildFade(_progress: number): string {
    return 'none';
}

/**
 * Resolves an animation type string to its corresponding transform builder function.
 */
export function getTransformBuilder(
    type: string,
): (progress: number) => string {
    switch (type) {
        case 'slam_left':
            return buildSlamLeft;
        case 'slam_right':
            return buildSlamRight;
        case 'scale_rotate':
            return buildScaleRotate;
        case 'slide_up':
            return buildSlideUp;
        case 'pop':
            return buildPop;
        case 'fade':
        default:
            return buildFade;
    }
}
