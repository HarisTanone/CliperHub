import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import type { TextLineEntry, PerLineAnimation, TemplateConfig } from '../types';
import { getTransformBuilder } from '../utils/animations';

interface AnimatedLineProps {
    lineConfig: TextLineEntry;
    lineIndex: number;
    animationConfig: PerLineAnimation | undefined;
    fallbackType: string;
    config: TemplateConfig;
    fps: number;
}

/**
 * AnimatedLine — renders a single text line with per-line styling and
 * entrance/idle animations using Remotion spring() and interpolate().
 *
 * Entrance animations: slam_left, slam_right, scale_rotate, slide_up, pop, fade
 * Idle animations: shake (oscillating rotation), pulse (scale oscillation)
 */
export const AnimatedLine: React.FC<AnimatedLineProps> = ({
    lineConfig,
    lineIndex,
    animationConfig,
    fallbackType,
    config,
    fps,
}) => {
    const frame = useCurrentFrame();
    const { fps: videoFps } = useVideoConfig();
    const effectiveFps = fps || videoFps || 30;

    // 1. Determine entrance animation type and delay
    const entranceType = animationConfig?.type ?? fallbackType ?? 'fade';
    const entranceDelay = animationConfig?.delay ?? 0.23 * lineIndex;

    // Validate entrance type — fallback to "fade" if unsupported
    const supportedTypes = ['slam_left', 'slam_right', 'scale_rotate', 'slide_up', 'pop', 'fade'];
    const resolvedType = supportedTypes.includes(entranceType) ? entranceType : 'fade';

    // 2. Calculate delay in frames and spring progress
    const delayFrames = Math.round(entranceDelay * effectiveFps);
    const adjustedFrame = Math.max(0, frame - delayFrames);

    const progress = spring({
        fps: effectiveFps,
        frame: adjustedFrame,
        config: { damping: 200 },
    });

    // 3. Compute entrance transform and opacity
    const transformBuilder = getTransformBuilder(resolvedType);
    const entranceTransform = transformBuilder(progress);
    const opacity = resolvedType === 'fade'
        ? interpolate(progress, [0, 1], [0, 1])
        : progress > 0 ? 1 : 0;

    // 4. Idle animations after entrance completes
    let idleTransform = '';
    const entranceComplete = progress >= 0.99;

    if (entranceComplete && animationConfig?.idle) {
        const idleDelay = animationConfig.idle_delay ?? 0;
        const idleDelayFrames = Math.round(idleDelay * effectiveFps);

        // Frames since entrance completed (approximation: entrance takes ~delayFrames + spring settle)
        const entranceEndFrame = delayFrames + Math.round(effectiveFps * 0.5); // ~0.5s for spring settle
        const idleStartFrame = entranceEndFrame + idleDelayFrames;

        if (frame >= idleStartFrame) {
            const idleFrame = frame - idleStartFrame;
            const idleProgress = idleFrame / effectiveFps; // time in seconds

            if (animationConfig.idle === 'shake') {
                // Subtle oscillating rotation between -1deg and 1deg
                const rotation = Math.sin(idleProgress * Math.PI * 4) * 1;
                idleTransform = `rotate(${rotation}deg)`;
            } else if (animationConfig.idle === 'pulse') {
                // Subtle scale oscillation between 0.98 and 1.02
                const scale = 1 + Math.sin(idleProgress * Math.PI * 3) * 0.02;
                idleTransform = `scale(${scale})`;
            }
        }
    }

    // 5. Compose final transform
    const finalTransform = [
        entranceTransform !== 'none' ? entranceTransform : '',
        idleTransform,
    ]
        .filter(Boolean)
        .join(' ') || 'none';

    // 6. Resolve styling with fallback to top-level config.text values
    const textConfig = config.text;
    const fontSize = lineConfig.font_size || textConfig?.font_size_normal || 36;
    const fontFamily = lineConfig.font || textConfig?.fallback_font || 'Anton';
    const color = lineConfig.color || textConfig?.color || '#FFFFFF';
    const fontWeight = lineConfig.font_weight || '900';
    const letterSpacing = lineConfig.letter_spacing ?? textConfig?.letter_spacing ?? 0;
    const textTransform = (textConfig?.text_transform as React.CSSProperties['textTransform']) || 'uppercase';

    const style: React.CSSProperties = {
        fontSize: `${fontSize}px`,
        fontFamily,
        color,
        fontWeight,
        letterSpacing: `${letterSpacing}px`,
        textTransform,
        transform: finalTransform,
        opacity,
        textAlign: 'center',
        lineHeight: 1.2,
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        whiteSpace: 'nowrap',
        willChange: 'transform, opacity',
    };

    return (
        <div
            data-testid={`animated-line-${lineIndex}`}
            style={style}
        >
            {lineConfig.text}
        </div>
    );
};
