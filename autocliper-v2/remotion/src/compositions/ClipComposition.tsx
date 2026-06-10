import React from 'react';
import { AbsoluteFill, Video, useVideoConfig } from 'remotion';
import type { ClipCompositionProps } from '../types';
import { resolveConfig } from '../utils/configDefaults';
import { migrateConfig } from '../utils/schemaVersion';
import { computeSafeArea } from '../utils/safeArea';
import { useFontLoader } from '../utils/fontRegistry';
import { HookOverlay } from '../components/HookOverlay';
import { KaraokeCaption } from '../components/KaraokeCaption';

/**
 * Main Remotion composition component.
 *
 * Renders a base video with overlay layers in fixed z-order:
 *   1. Base Video
 *   2-6, 8. HookOverlay (gradient, particles, hook text, badge, decorations, flash)
 *   7. Karaoke Caption (placeholder)
 *
 * Validates required props at render time — missing videoSrc or subtitles
 * throws an Error, causing Remotion CLI to exit with non-zero code + stderr message.
 */
export const ClipComposition: React.FC<ClipCompositionProps> = (props) => {
    const { videoSrc, hookText, subtitles, hookStyle, captionStyle } = props;
    const { fps } = useVideoConfig();

    // Validate required props — Error causes non-zero exit in Remotion CLI
    if (!videoSrc) {
        throw new Error('Missing required prop: videoSrc');
    }
    if (!subtitles || (Array.isArray(subtitles) && subtitles.length === 0)) {
        throw new Error('Missing required prop: subtitles');
    }

    // Resolve and migrate hookStyle config
    const resolvedConfig = (() => {
        try {
            const migrated = migrateConfig(hookStyle?.config);
            return migrated;
        } catch {
            return resolveConfig({});
        }
    })();

    // Load fonts from registry before rendering
    useFontLoader(resolvedConfig.font_registry ?? []);

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* Layer 1: Base Video */}
            <AbsoluteFill style={{ zIndex: 1 }}>
                <Video
                    src={videoSrc}
                    style={{
                        width: 1080,
                        height: 1920,
                        objectFit: 'cover',
                    }}
                />
            </AbsoluteFill>

            {/* Layers 2-6, 8: Hook Overlay (gradient, particles, text, badge, decorations, flash) */}
            <HookOverlay
                hookStyle={hookStyle}
                hookText={hookText}
                config={resolvedConfig}
            />

            {/* Layer 7: Karaoke Caption */}
            <AbsoluteFill style={{ zIndex: 7 }}>
                <KaraokeCaption
                    subtitles={subtitles}
                    captionStyle={captionStyle}
                    safeArea={computeSafeArea(1080, 1920, resolvedConfig.safe_area)}
                    fps={fps}
                />
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
