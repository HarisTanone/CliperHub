import type { SafeAreaConfig } from '../types';
import { clamp } from './configDefaults';

export interface SafeAreaBounds {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

/** Default safe area percentages for TikTok/Reels format */
const DEFAULTS: { top_percent: number; bottom_percent: number; side_percent: number } = {
    top_percent: 10,
    bottom_percent: 20,
    side_percent: 10,
};

/**
 * Computes the safe area bounds in pixels for a given frame size.
 *
 * Default safe area: top 10%, bottom 20%, sides 10% — resulting in
 * a central region of 80% width and 70% height.
 *
 * If safeAreaConfig.override is true, custom percent values are used
 * (clamped to [0, 40] range). Otherwise, defaults apply.
 */
export function computeSafeArea(
    frameW: number,
    frameH: number,
    safeAreaConfig?: SafeAreaConfig,
): SafeAreaBounds {
    let topPercent = DEFAULTS.top_percent;
    let bottomPercent = DEFAULTS.bottom_percent;
    let sidePercent = DEFAULTS.side_percent;

    if (safeAreaConfig?.override) {
        topPercent = clamp(safeAreaConfig.top_percent ?? DEFAULTS.top_percent, 0, 40);
        bottomPercent = clamp(safeAreaConfig.bottom_percent ?? DEFAULTS.bottom_percent, 0, 40);
        sidePercent = clamp(safeAreaConfig.side_percent ?? DEFAULTS.side_percent, 0, 40);
    }

    const top = Math.round(frameH * (topPercent / 100));
    const bottom = Math.round(frameH * (1 - bottomPercent / 100));
    const left = Math.round(frameW * (sidePercent / 100));
    const right = Math.round(frameW * (1 - sidePercent / 100));

    return {
        top,
        bottom,
        left,
        right,
        width: right - left,
        height: bottom - top,
    };
}
