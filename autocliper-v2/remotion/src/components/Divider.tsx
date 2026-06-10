import React from 'react';
import { useCurrentFrame, spring, interpolate } from 'remotion';
import type { DividerConfig } from '../types';

interface DividerProps {
    config: DividerConfig;
    fps?: number;
}

/**
 * Divider — animated gradient line that expands from 0 width to target width.
 *
 * Renders a thin (2px) gradient line using the config.colors array (max 5 colors)
 * for the linear-gradient. The line expands from 0 to config.width pixels using
 * a spring animation triggered after config.delay seconds.
 *
 * Positioned below hook text with ~8px margin-top.
 */
export const Divider: React.FC<DividerProps> = ({ config, fps = 30 }) => {
    const frame = useCurrentFrame();

    if (!config.enable) {
        return null;
    }

    const delayFrames = Math.round(config.delay * fps);

    // Spring for width expansion
    const springProgress = spring({
        frame: frame - delayFrames,
        fps,
        config: {
            damping: 16,
            stiffness: 100,
            mass: 0.8,
        },
    });

    const currentWidth = interpolate(
        springProgress,
        [0, 1],
        [0, config.width],
    );

    // Build gradient from colors array (max 5)
    const colors = config.colors.slice(0, 5);
    const gradient =
        colors.length > 1
            ? `linear-gradient(to right, ${colors.join(', ')})`
            : colors[0] ?? '#FFFFFF';

    return (
        <div
            data-component="divider"
            style={{
                marginTop: 8,
                display: 'flex',
                justifyContent: 'center',
            }}
        >
            <div
                style={{
                    width: currentWidth,
                    height: 2,
                    borderRadius: 2,
                    background: gradient,
                    opacity: springProgress,
                }}
            />
        </div>
    );
};
