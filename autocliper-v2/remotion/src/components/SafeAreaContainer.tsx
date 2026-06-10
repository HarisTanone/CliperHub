import React from 'react';
import type { TemplateConfig } from '../types';
import { computeSafeArea } from '../utils/safeArea';

interface SafeAreaContainerProps {
    children: React.ReactNode;
    config: TemplateConfig;
    frameWidth?: number;
    frameHeight?: number;
}

/**
 * Constrains children within the computed safe area bounds.
 *
 * Uses `computeSafeArea()` to calculate pixel bounds based on the config's
 * safe_area settings. Applies positioning within the safe area based on
 * config.position anchor + offsets.
 *
 * Default frame: 1080×1920 (TikTok/Reels vertical)
 * Default safe area: top 10%, bottom 20%, sides 10% → central 80% × 70%
 */
export const SafeAreaContainer: React.FC<SafeAreaContainerProps> = ({
    children,
    config,
    frameWidth = 1080,
    frameHeight = 1920,
}) => {
    const safeArea = computeSafeArea(frameWidth, frameHeight, config.safe_area);
    const position = config.position ?? { anchor: 'center', offset_y: 0, offset_x: 0 };

    // Compute vertical alignment within safe area based on anchor
    const offsetY = position.offset_y ?? 0;
    const offsetX = position.offset_x ?? 0;

    const computeVerticalPosition = (): {
        top: number;
        justifyContent: string;
    } => {
        switch (position.anchor) {
            case 'top':
                return {
                    top: safeArea.top + offsetY,
                    justifyContent: 'flex-start',
                };
            case 'bottom':
                return {
                    top: safeArea.top + offsetY,
                    justifyContent: 'flex-end',
                };
            case 'center':
            default:
                return {
                    top: safeArea.top + offsetY,
                    justifyContent: 'center',
                };
        }
    };

    const { top, justifyContent } = computeVerticalPosition();

    return (
        <div
            data-component="safe-area-container"
            style={{
                position: 'absolute',
                top: top,
                left: safeArea.left + offsetX,
                width: safeArea.width,
                height: safeArea.height,
                display: 'flex',
                flexDirection: 'column',
                justifyContent,
                alignItems: 'center',
                overflow: 'hidden',
            }}
        >
            {children}
        </div>
    );
};
