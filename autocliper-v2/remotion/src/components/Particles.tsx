import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { ParticlesConfig } from '../types';

interface ParticlesProps {
    config: ParticlesConfig;
    fps?: number;
}

/**
 * Particles — renders rising particle dots using Remotion interpolate().
 *
 * Each dot:
 * - Deterministic position/size (based on index, NOT Math.random())
 * - Color cycling from config.colors array
 * - Animates from bottom to top with varying speed per particle
 * - Opacity fades in at start, fades out at top
 * - Staggered delay based on index
 */
export const Particles: React.FC<ParticlesProps> = ({ config, fps = 30 }) => {
    const frame = useCurrentFrame();

    if (!config.enable) {
        return null;
    }

    // Clamp particle count to max 12
    const count = Math.min(Math.max(config.count, 1), 12);
    const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
    const [minSize, maxSize] = config.size_range;

    const particles = Array.from({ length: count }, (_, index) => {
        // Deterministic horizontal position: distribute across width using golden ratio
        const goldenRatio = 0.618033988749895;
        const horizontalPosition = ((index * goldenRatio) % 1) * 100;

        // Color cycling by index
        const color = colors[index % colors.length];

        // Size interpolated between size_range based on index
        const sizeRange = maxSize - minSize;
        const size = minSize + (sizeRange * (index / Math.max(count - 1, 1)));

        // Varying speed per particle (frames to complete journey)
        // Base speed: 2 seconds, varies by ±0.5s based on index
        const speedVariation = ((index % 5) - 2) * 0.25;
        const journeyDuration = (2 + speedVariation) * fps;

        // Staggered delay: each particle starts at a different time
        const staggerDelay = (index * 0.3) * fps;

        // Calculate effective frame for this particle (looping)
        const totalCycle = journeyDuration + staggerDelay;
        const effectiveFrame = ((frame - staggerDelay) % totalCycle + totalCycle) % totalCycle;

        // Y position: bottom (100%) to top (−10%) over journeyDuration
        const yPosition = interpolate(
            effectiveFrame,
            [0, journeyDuration],
            [110, -10],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        // Opacity: fade in during first 20%, fade out during last 20%
        const opacity = interpolate(
            effectiveFrame,
            [0, journeyDuration * 0.2, journeyDuration * 0.8, journeyDuration],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        // Only render if the particle has started (frame >= staggerDelay)
        const hasStarted = frame >= staggerDelay;

        if (!hasStarted) {
            return null;
        }

        const style: React.CSSProperties = {
            position: 'absolute',
            left: `${horizontalPosition}%`,
            top: `${yPosition}%`,
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: color,
            opacity,
            pointerEvents: 'none',
        };

        return (
            <div
                key={`particle-${index}`}
                data-testid={`particle-${index}`}
                style={style}
            />
        );
    });

    return (
        <div
            data-layer="particles"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                pointerEvents: 'none',
            }}
        >
            {particles}
        </div>
    );
};
