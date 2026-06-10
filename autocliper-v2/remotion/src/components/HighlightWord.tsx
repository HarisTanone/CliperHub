import React from 'react';
import type { HighlightStyle } from '../types';

interface HighlightWordProps {
    word: string;
    isActive: boolean;
    highlightStyle: HighlightStyle;
    highlightColor: string;
    highlightBgColor: string;
    progress: number;
    fps: number;
}

const VALID_STYLES: HighlightStyle[] = ['glow', 'background', 'underline', 'fill', 'scale'];

/**
 * HighlightWord — renders a single word with highlight effects.
 *
 * Supports 5 highlight styles:
 *   - "glow": text-shadow pulse + scale bounce
 *   - "background": colored bg rectangle + slight scale
 *   - "underline": animated left-to-right underline reveal
 *   - "fill": left-to-right color wipe via gradient
 *   - "scale": scale bounce 1 → 1.15 → 1.0
 *
 * Falls back to "glow" for unknown highlight_style values.
 * Smooth 80ms color transition when going active → inactive.
 */
export const HighlightWord: React.FC<HighlightWordProps> = ({
    word,
    isActive,
    highlightStyle,
    highlightColor,
    highlightBgColor,
    progress,
    fps,
}) => {
    const effectiveFps = fps || 30;

    // Fallback unknown highlight_style to "glow"
    const resolvedStyle: HighlightStyle = VALID_STYLES.includes(highlightStyle)
        ? highlightStyle
        : 'glow';

    // Scale bounce animation for "glow" style: 1 → 1.12 → 1.05 → 1 over ~5 frames (150ms at 30fps)
    const getGlowScaleBounce = (): number => {
        if (!isActive) return 1;
        // progress goes 0→1 over word duration; bounce happens at start
        // 5 frames at 30fps = ~166ms
        const bounceFrames = 5;
        const bounceDuration = bounceFrames / effectiveFps;
        const bounceProgress = Math.min(progress / bounceDuration, 1);

        if (bounceProgress < 0.33) {
            // 1 → 1.12
            return 1 + 0.12 * (bounceProgress / 0.33);
        } else if (bounceProgress < 0.66) {
            // 1.12 → 1.05
            const t = (bounceProgress - 0.33) / 0.33;
            return 1.12 - 0.07 * t;
        } else {
            // 1.05 → 1
            const t = (bounceProgress - 0.66) / 0.34;
            return 1.05 - 0.05 * t;
        }
    };

    // Scale bounce for "scale" style: 1 → 1.15 → 1.0 over ~6 frames (200ms at 30fps)
    const getScaleBounce = (): number => {
        if (!isActive) return 1;
        const bounceFrames = 6;
        const bounceDuration = bounceFrames / effectiveFps;
        const bounceProgress = Math.min(progress / bounceDuration, 1);

        if (bounceProgress < 0.5) {
            // 1 → 1.15
            return 1 + 0.15 * (bounceProgress / 0.5);
        } else {
            // 1.15 → 1.0
            const t = (bounceProgress - 0.5) / 0.5;
            return 1.15 - 0.15 * t;
        }
    };

    // Background scale bounce: 1 → 1.05 → 1 over 6 frames
    const getBackgroundScale = (): number => {
        if (!isActive) return 1;
        const bounceFrames = 6;
        const bounceDuration = bounceFrames / effectiveFps;
        const bounceProgress = Math.min(progress / bounceDuration, 1);

        if (bounceProgress < 0.5) {
            return 1 + 0.05 * (bounceProgress / 0.5);
        } else {
            const t = (bounceProgress - 0.5) / 0.5;
            return 1.05 - 0.05 * t;
        }
    };

    // Build styles based on resolved highlight style
    const buildStyles = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            display: 'inline-block',
            position: 'relative',
            transition: 'color 80ms ease',
            whiteSpace: 'pre',
        };

        if (!isActive) {
            return {
                ...baseStyle,
                transform: 'scale(1)',
            };
        }

        switch (resolvedStyle) {
            case 'glow': {
                const scale = getGlowScaleBounce();
                // Pulsing glow intensity based on progress
                const glowIntensity = 0.7 + 0.3 * Math.sin(progress * Math.PI * 2);
                const glow8 = Math.round(8 * glowIntensity);
                const glow16 = Math.round(16 * glowIntensity);
                return {
                    ...baseStyle,
                    color: highlightColor,
                    textShadow: `0 0 ${glow8}px ${highlightColor}, 0 0 ${glow16}px ${highlightColor}`,
                    transform: `scale(${scale})`,
                };
            }

            case 'background': {
                const scale = getBackgroundScale();
                // highlightColor at 40% opacity for background
                return {
                    ...baseStyle,
                    color: highlightColor,
                    backgroundColor: highlightBgColor || `${highlightColor}66`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    transform: `scale(${scale})`,
                };
            }

            case 'underline': {
                // scaleX from 0 to 1 matching word progress (left-to-right reveal)
                return {
                    ...baseStyle,
                    color: highlightColor,
                    borderBottom: `2px solid ${highlightColor}`,
                    transformOrigin: 'left',
                    // Use a clip approach for the underline via pseudo-like behavior
                    // We'll use a wrapper approach with the underline as a separate element
                    transform: 'scale(1)',
                };
            }

            case 'fill': {
                // Left-to-right color wipe using background-clip: text
                const fillPercent = Math.min(progress * 100, 100);
                return {
                    ...baseStyle,
                    background: `linear-gradient(to right, ${highlightColor} ${fillPercent}%, currentColor ${fillPercent}%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    transform: 'scale(1)',
                };
            }

            case 'scale': {
                const scale = getScaleBounce();
                return {
                    ...baseStyle,
                    color: highlightColor,
                    transform: `scale(${scale})`,
                };
            }

            default: {
                // Fallback to glow (should not reach here due to resolvedStyle)
                const scale = getGlowScaleBounce();
                return {
                    ...baseStyle,
                    color: highlightColor,
                    textShadow: `0 0 8px ${highlightColor}, 0 0 16px ${highlightColor}`,
                    transform: `scale(${scale})`,
                };
            }
        }
    };

    const wordStyle = buildStyles();

    // For "underline" style, render with a separate underline element
    if (resolvedStyle === 'underline' && isActive) {
        return (
            <span
                data-testid="highlight-word"
                style={{
                    ...wordStyle,
                    borderBottom: 'none',
                    position: 'relative',
                }}
            >
                {word}
                <span
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: '2px',
                        backgroundColor: highlightColor,
                        transformOrigin: 'left',
                        transform: `scaleX(${Math.min(progress, 1)})`,
                    }}
                />
            </span>
        );
    }

    return (
        <span data-testid="highlight-word" style={wordStyle}>
            {word}
        </span>
    );
};
