import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { FlashConfig } from '../types';

interface FlashOverlayProps {
    config: FlashConfig;
    fps?: number;
}

/**
 * FlashOverlay — full-frame flash effect that fades from a specified color
 * to transparent over a configurable duration, triggered after a configurable delay.
 *
 * Behavior:
 * - Before delay: opacity 0 (invisible)
 * - At delay: opacity 1 (full flash)
 * - At delay + duration: opacity 0 (faded out)
 *
 * Uses Remotion interpolate() for smooth opacity animation.
 */
export const FlashOverlay: React.FC<FlashOverlayProps> = ({ config, fps = 30 }) => {
    const frame = useCurrentFrame();

    if (!config.enable) {
        return null;
    }

    const delayFrames = Math.round(config.delay * fps);
    const durationFrames = Math.round(config.duration * fps);

    // Interpolate opacity:
    // Before delay → 0
    // At delay → 1
    // At delay + duration → 0
    const opacity = interpolate(
        frame,
        [delayFrames, delayFrames + 1, delayFrames + durationFrames],
        [0, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    if (opacity <= 0) {
        return null;
    }

    return (
        <AbsoluteFill
            data-layer="flash"
            data-testid="flash-overlay"
            style={{
                backgroundColor: config.color,
                opacity,
                pointerEvents: 'none',
            }}
        />
    );
};
