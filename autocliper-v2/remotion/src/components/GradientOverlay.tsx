import React from 'react';
import type { GradientConfig } from '../types';

interface GradientOverlayProps {
    config: GradientConfig;
    position: 'top' | 'bottom';
}

/**
 * GradientOverlay — top or bottom gradient overlay with configurable color and height.
 *
 * Renders an absolute-positioned gradient div:
 * - 'top' position: gradient from config.color → transparent (direction: to bottom)
 * - 'bottom' position: gradient from config.color → transparent (direction: to top)
 *
 * Height is set to config.height_percent% of the container.
 * Width is always 100%.
 */
export const GradientOverlay: React.FC<GradientOverlayProps> = ({
    config,
    position,
}) => {
    if (!config.enable) {
        return null;
    }

    const isTop = position === 'top';
    const gradientDirection = isTop ? 'to bottom' : 'to top';
    const gradient = `linear-gradient(${gradientDirection}, ${config.color}, transparent)`;

    return (
        <div
            data-component={`gradient-${position}`}
            data-layer={`gradient-${position}`}
            style={{
                position: 'absolute',
                [isTop ? 'top' : 'bottom']: 0,
                left: 0,
                width: '100%',
                height: `${config.height_percent}%`,
                background: gradient,
            }}
        />
    );
};
