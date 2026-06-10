import React from 'react';
import { useCurrentFrame, spring, interpolate } from 'remotion';
import type { BadgeConfig } from '../types';

interface BadgeProps {
    config: BadgeConfig;
    fps?: number;
}

/**
 * Badge — pill-shaped badge with spring-based entrance animation.
 *
 * Renders a pill-shaped badge element (border-radius = half height) with
 * configurable background color, font styling, and entrance animation.
 *
 * Animation types supported: slide_left, slide_right, fade, pop, scale_rotate.
 * If no animation config is provided, defaults to fade with delay 0.15s, duration 0.4s.
 *
 * Badge text is truncated at 30 characters.
 */
export const Badge: React.FC<BadgeProps> = ({ config, fps = 30 }) => {
    const frame = useCurrentFrame();

    if (!config.enable) {
        return null;
    }

    // Truncate text at 30 characters
    const displayText =
        config.text.length > 30 ? config.text.slice(0, 30) : config.text;

    // Resolve animation config or use defaults
    const animConfig = config.animation ?? {
        type: 'fade',
        delay: 0.15,
        duration: 0.4,
    };

    const delayFrames = Math.round(animConfig.delay * fps);
    const durationFrames = Math.round(animConfig.duration * fps);

    // Spring for smooth entrance
    const springProgress = spring({
        frame: frame - delayFrames,
        fps,
        config: {
            damping: 14,
            stiffness: 120,
            mass: 0.8,
        },
        durationInFrames: durationFrames,
    });

    // Compute animation styles based on type
    const getAnimationStyle = (): React.CSSProperties => {
        const type = animConfig.type;

        switch (type) {
            case 'slide_left': {
                const translateX = interpolate(
                    springProgress,
                    [0, 1],
                    [-100, 0],
                );
                return {
                    transform: `translateX(${translateX}%)`,
                    opacity: springProgress,
                };
            }
            case 'slide_right': {
                const translateX = interpolate(
                    springProgress,
                    [0, 1],
                    [100, 0],
                );
                return {
                    transform: `translateX(${translateX}%)`,
                    opacity: springProgress,
                };
            }
            case 'pop': {
                const scale = interpolate(
                    springProgress,
                    [0, 0.6, 1],
                    [0, 1.2, 1],
                );
                return {
                    transform: `scale(${scale})`,
                    opacity: springProgress,
                };
            }
            case 'scale_rotate': {
                const scale = interpolate(springProgress, [0, 1], [0, 1]);
                const rotate = interpolate(springProgress, [0, 1], [-15, 0]);
                return {
                    transform: `scale(${scale}) rotate(${rotate}deg)`,
                    opacity: springProgress,
                };
            }
            case 'fade':
            default: {
                return {
                    opacity: springProgress,
                };
            }
        }
    };

    const animationStyle = getAnimationStyle();

    return (
        <div
            data-component="badge"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: config.bg_color,
                borderRadius: 50,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 8,
                paddingBottom: 8,
                marginBottom: 8,
                ...animationStyle,
            }}
        >
            <span
                style={{
                    color: '#FFFFFF',
                    fontSize: config.font_size,
                    fontFamily: config.font_family,
                    letterSpacing: config.letter_spacing,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                }}
            >
                {displayText}
            </span>
        </div>
    );
};
