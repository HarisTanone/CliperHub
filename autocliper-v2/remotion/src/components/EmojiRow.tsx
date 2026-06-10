import React from 'react';
import { useCurrentFrame, spring, interpolate } from 'remotion';
import type { EmojiRowConfig } from '../types';

interface EmojiRowProps {
    config: EmojiRowConfig;
    fps?: number;
}

/**
 * EmojiRow — row of emojis with staggered vertical bounce animation.
 *
 * Renders emojis from config.emojis array (max 10) in a flex row with gap: 6px.
 * Each emoji has a staggered bounce: translateY from 10px to 0 with spring,
 * delayed by config.delay + (index * 0.08) seconds.
 *
 * Positioned below divider/text with ~8px margin-top.
 */
export const EmojiRow: React.FC<EmojiRowProps> = ({ config, fps = 30 }) => {
    const frame = useCurrentFrame();

    if (!config.enable) {
        return null;
    }

    // Limit to max 10 emojis
    const emojis = config.emojis.slice(0, 10);

    return (
        <div
            data-component="emoji-row"
            style={{
                display: 'flex',
                gap: 6,
                marginTop: 8,
                justifyContent: 'center',
            }}
        >
            {emojis.map((emoji, index) => {
                const emojiDelay = config.delay + index * 0.08;
                const delayFrames = Math.round(emojiDelay * fps);

                const bounceProgress = spring({
                    frame: frame - delayFrames,
                    fps,
                    config: {
                        damping: 10,
                        stiffness: 150,
                        mass: 0.6,
                    },
                });

                const translateY = interpolate(
                    bounceProgress,
                    [0, 1],
                    [10, 0],
                );

                return (
                    <span
                        key={`${emoji}-${index}`}
                        style={{
                            display: 'inline-block',
                            fontSize: 24,
                            transform: `translateY(${translateY}px)`,
                            opacity: bounceProgress,
                        }}
                    >
                        {emoji}
                    </span>
                );
            })}
        </div>
    );
};
