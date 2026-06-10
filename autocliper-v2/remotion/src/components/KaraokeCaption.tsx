import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { SubtitleEntry, CaptionStyleProps } from '../types';
import type { SafeAreaBounds } from '../utils/safeArea';
import { HighlightWord } from './HighlightWord';

interface KaraokeCaptionProps {
    subtitles: SubtitleEntry[];
    captionStyle: CaptionStyleProps;
    safeArea: SafeAreaBounds;
    fps?: number;
}

/**
 * KaraokeCaption — renders word-level subtitles with highlight effects.
 *
 * At each frame, determines the current time and which word is active.
 * Renders visible words (within a time window) as a flowing text line.
 * Active word receives highlight styling; inactive words use base color.
 *
 * Positioned at bottom of safe area (above bottom exclusion zone),
 * centered horizontally within safe area bounds.
 */
export const KaraokeCaption: React.FC<KaraokeCaptionProps> = ({
    subtitles,
    captionStyle,
    safeArea,
    fps = 30,
}) => {
    const frame = useCurrentFrame();
    const currentTime = frame / fps;

    if (!subtitles || subtitles.length === 0) {
        return null;
    }

    // Find the index of the currently active word
    const activeWordIndex = subtitles.findIndex(
        (entry) => currentTime >= entry.start && currentTime < entry.end,
    );

    // Determine visible words: show a window of words around the active word
    // Show words that are within a reasonable time window (~3 seconds)
    const TIME_WINDOW = 3;
    const visibleWords = subtitles.filter((entry) => {
        // Show words that overlap with the current time window
        return entry.end > currentTime - 0.5 && entry.start < currentTime + TIME_WINDOW;
    });

    // Group visible words into lines (~6-8 words per line)
    const WORDS_PER_LINE = 7;
    const lines: SubtitleEntry[][] = [];
    for (let i = 0; i < visibleWords.length; i += WORDS_PER_LINE) {
        lines.push(visibleWords.slice(i, i + WORDS_PER_LINE));
    }

    // Only show the line containing the active word (or the first line if no active word)
    const activeEntry = activeWordIndex >= 0 ? subtitles[activeWordIndex] : null;
    const currentLine = lines.find((line) =>
        line.some((entry) => entry === activeEntry),
    ) || lines[0];

    if (!currentLine || currentLine.length === 0) {
        return null;
    }

    // Resolve highlight style with fallback to "glow"
    const highlightStyle = captionStyle.highlightStyle || 'glow';

    // Caption positioning: bottom of safe area, centered horizontally
    // Position above the bottom exclusion zone
    const captionBottom = 20; // pixels above the safe area bottom edge
    const horizontalPadding = 20;

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: captionBottom,
        left: safeArea.left + horizontalPadding,
        width: safeArea.width - horizontalPadding * 2,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '4px',
    };

    const textBaseStyle: React.CSSProperties = {
        fontFamily: captionStyle.fontFamily || 'Inter',
        fontSize: `${captionStyle.fontSize || 32}px`,
        fontWeight: '700',
        color: captionStyle.color || '#FFFFFF',
        textShadow: captionStyle.shadow || '2px 2px 4px rgba(0,0,0,0.7)',
        lineHeight: 1.4,
    };

    return (
        <div data-component="karaoke-caption" style={containerStyle}>
            <div
                style={{
                    ...textBaseStyle,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '4px',
                }}
            >
                {currentLine.map((entry, index) => {
                    const isActive =
                        currentTime >= entry.start && currentTime < entry.end;

                    // Calculate progress through the word's duration
                    let wordProgress = 0;
                    if (isActive) {
                        const wordDuration = entry.end - entry.start;
                        if (wordDuration > 0) {
                            wordProgress = (currentTime - entry.start) / wordDuration;
                        }
                    }

                    return (
                        <HighlightWord
                            key={`${entry.word}-${entry.start}-${index}`}
                            word={entry.word}
                            isActive={isActive}
                            highlightStyle={highlightStyle}
                            highlightColor={captionStyle.highlightColor || '#FFDD00'}
                            highlightBgColor={captionStyle.highlightBgColor || ''}
                            progress={wordProgress}
                            fps={fps}
                        />
                    );
                })}
            </div>
        </div>
    );
};
