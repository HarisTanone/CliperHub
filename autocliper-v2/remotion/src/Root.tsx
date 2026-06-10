import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ClipComposition } from './compositions/ClipComposition';
import type { ClipCompositionProps } from './types';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="ClipComposition"
                component={ClipComposition as unknown as React.FC<Record<string, unknown>>}
                durationInFrames={30 * 60}
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{
                    videoSrc: '',
                    hookText: '',
                    subtitles: [],
                    hookStyle: {
                        fontFamily: 'Anton',
                        fontSize: 56,
                        color: '#FFFFFF',
                        keywordColor: '#FFFFFF',
                        shadow: '',
                        glow: '',
                        animationType: 'fade',
                        displayDurationSeconds: 3,
                        config: { schema_version: 1 },
                    },
                    captionStyle: {
                        fontFamily: 'Inter',
                        fontSize: 36,
                        color: '#FFFFFF',
                        highlightColor: '#FFFF00',
                        highlightBgColor: '',
                        highlightStyle: 'glow',
                        highlightTransition: 'ease',
                        shadow: '',
                        config: { schema_version: 1 },
                    },
                } satisfies ClipCompositionProps}
            />
        </>
    );
};

registerRoot(RemotionRoot);
