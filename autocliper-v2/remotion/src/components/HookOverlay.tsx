import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import type { HookStyleProps, TemplateConfig, TextLineEntry } from '../types';
import { SafeAreaContainer } from './SafeAreaContainer';
import { AnimatedLine } from './AnimatedLine';
import { Particles } from './Particles';
import { FlashOverlay } from './FlashOverlay';

interface HookOverlayProps {
    hookStyle: HookStyleProps;
    hookText: string;
    config: TemplateConfig;
}

/**
 * LegacyHookText — fallback rendering when text.lines is empty/absent.
 * Renders hookText as a single animated line using top-level text config.
 */
const LegacyHookText: React.FC<{
    hookText: string;
    config: TemplateConfig;
    fps: number;
}> = ({ hookText, config, fps }) => {
    const textConfig = config.text;
    const fallbackType = config.animation?.type ?? 'fade';

    // Build a synthetic TextLineEntry from top-level config
    const syntheticLine: TextLineEntry = {
        text: hookText,
        color: textConfig?.color ?? '#FFFFFF',
        font_size: textConfig?.font_size_normal ?? 36,
        font: textConfig?.fallback_font ?? 'Anton',
        font_weight: '900',
        letter_spacing: textConfig?.letter_spacing ?? 0,
    };

    return (
        <AnimatedLine
            lineConfig={syntheticLine}
            lineIndex={0}
            animationConfig={undefined}
            fallbackType={fallbackType}
            config={config}
            fps={fps}
        />
    );
};

/**
 * HookOverlay — container managing layers 2-6 and 8.
 *
 * Renders overlay layers in fixed z-order:
 *   z-2: Gradient Overlay (top and bottom)
 *   z-3: Particles
 *   z-4: Hook Text Lines (wrapped in SafeAreaContainer)
 *   z-5: Badge
 *   z-6: Decorations (divider, emoji row)
 *   z-8: Flash Effect
 *
 * Each layer only renders when its respective `enable` flag is true.
 */
export const HookOverlay: React.FC<HookOverlayProps> = ({
    hookStyle: _hookStyle,
    hookText,
    config,
}) => {
    const { overlay, effects, badge, decorations, text, animation } = config;
    const { fps } = useVideoConfig();

    const gradientTopEnabled = overlay?.gradient_top?.enable ?? false;
    const gradientBottomEnabled = overlay?.gradient_bottom?.enable ?? false;
    const particlesEnabled = effects?.particles?.enable ?? false;
    const badgeEnabled = badge?.enable ?? false;
    const dividerEnabled = decorations?.divider?.enable ?? false;
    const emojiRowEnabled = decorations?.emoji_row?.enable ?? false;
    const flashEnabled = effects?.flash?.enable ?? false;

    // Determine which text lines to render
    const lines = text?.lines ?? [];
    const hasLines = lines.length > 0;
    const fallbackAnimationType = animation?.type ?? 'fade';
    const perLineAnimations = animation?.per_line ?? [];

    return (
        <>
            {/* z-2: Gradient Overlay (top and bottom) */}
            {(gradientTopEnabled || gradientBottomEnabled) && (
                <AbsoluteFill style={{ zIndex: 2 }}>
                    {/* GradientOverlay component — placeholder, implemented in task 6.3 */}
                    {gradientTopEnabled && (
                        <div
                            data-layer="gradient-top"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${overlay!.gradient_top.height_percent}%`,
                                background: `linear-gradient(to bottom, ${overlay!.gradient_top.color}, transparent)`,
                            }}
                        />
                    )}
                    {gradientBottomEnabled && (
                        <div
                            data-layer="gradient-bottom"
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                width: '100%',
                                height: `${overlay!.gradient_bottom.height_percent}%`,
                                background: `linear-gradient(to top, ${overlay!.gradient_bottom.color}, transparent)`,
                            }}
                        />
                    )}
                </AbsoluteFill>
            )}

            {/* z-3: Particles */}
            {particlesEnabled && (
                <AbsoluteFill style={{ zIndex: 3 }}>
                    <Particles config={effects!.particles} fps={fps} />
                </AbsoluteFill>
            )}

            {/* z-4: Hook Text Lines (wrapped in SafeAreaContainer) */}
            <AbsoluteFill style={{ zIndex: 4 }}>
                <SafeAreaContainer
                    config={config}
                    frameWidth={1080}
                    frameHeight={1920}
                >
                    <div
                        data-layer="hook-text"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: `${text?.line_spacing ?? 10}px`,
                        }}
                    >
                        {hasLines ? (
                            lines.slice(0, 6).map((lineEntry, index) => (
                                <AnimatedLine
                                    key={index}
                                    lineConfig={lineEntry}
                                    lineIndex={index}
                                    animationConfig={perLineAnimations[index] ?? undefined}
                                    fallbackType={fallbackAnimationType}
                                    config={config}
                                    fps={fps}
                                />
                            ))
                        ) : (
                            /* Legacy two-tier rendering: normal + keyword from hookText */
                            <LegacyHookText hookText={hookText} config={config} fps={fps} />
                        )}
                    </div>
                </SafeAreaContainer>
            </AbsoluteFill>

            {/* z-5: Badge */}
            {badgeEnabled && (
                <AbsoluteFill style={{ zIndex: 5 }}>
                    {/* Badge component — placeholder, implemented in task 6.3 */}
                    <div data-layer="badge" />
                </AbsoluteFill>
            )}

            {/* z-6: Decorations (divider, emoji row) */}
            {(dividerEnabled || emojiRowEnabled) && (
                <AbsoluteFill style={{ zIndex: 6 }}>
                    {/* Divider and EmojiRow components — placeholder, implemented in task 6.3 */}
                    {dividerEnabled && <div data-layer="divider" />}
                    {emojiRowEnabled && <div data-layer="emoji-row" />}
                </AbsoluteFill>
            )}

            {/* z-8: Flash Effect */}
            {flashEnabled && (
                <AbsoluteFill style={{ zIndex: 8 }}>
                    <FlashOverlay config={effects!.flash} fps={fps} />
                </AbsoluteFill>
            )}
        </>
    );
};
