/**
 * Integration tests for the Remotion render pipeline.
 *
 * Validates that ClipComposition renders correctly at the composition level
 * without requiring actual video files or `npx remotion render`.
 *
 * Tests cover:
 * - Valid props produce no errors (composition renders at 1080×1920)
 * - Missing videoSrc throws appropriate Error
 * - Missing/empty subtitles throws appropriate Error
 * - All features enabled doesn't crash
 *
 * Validates: Requirements 7.5, 7.8, 18.3
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createElement } from 'react';

// ─── Mock Remotion ────────────────────────────────────────────────────────────
vi.mock('remotion', () => ({
    AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
        createElement('div', { 'data-testid': 'absolute-fill', style }, children),
    Video: ({ src }: { src: string }) =>
        createElement('div', { 'data-testid': 'video', 'data-src': src }),
    useCurrentFrame: () => 30,
    useVideoConfig: () => ({
        fps: 30,
        durationInFrames: 1800,
        width: 1080,
        height: 1920,
    }),
    spring: () => 1,
    interpolate: (_frame: number, _inputRange: number[], outputRange: number[]) => {
        if (outputRange.length >= 2) return outputRange[outputRange.length - 1];
        return 0;
    },
    Easing: {
        bezier: () => (t: number) => t,
    },
}));

// ─── Mock fontRegistry (useFontLoader uses useEffect which needs full React rendering) ──
vi.mock('../utils/fontRegistry', () => ({
    useFontLoader: () => { },
    loadFontsFromRegistry: async () => { },
    FALLBACK_FONT: 'Inter',
    GOOGLE_FONTS_MAP: {},
    FONTS_CACHE_DIR: './cache/fonts',
    ASSETS_CACHE_DIR: './cache/assets',
}));

import { ClipComposition } from '../compositions/ClipComposition';
import type { ClipCompositionProps, SubtitleEntry, HookStyleProps, CaptionStyleProps, TemplateConfig } from '../types';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const makeSubtitles = (): SubtitleEntry[] => [
    { word: 'Hello', start: 0, end: 0.5 },
    { word: 'world', start: 0.5, end: 1.0 },
    { word: 'this', start: 1.0, end: 1.3 },
    { word: 'is', start: 1.3, end: 1.5 },
    { word: 'a', start: 1.5, end: 1.6 },
    { word: 'test', start: 1.6, end: 2.0 },
];

const makeMinimalConfig = (): TemplateConfig => ({
    schema_version: 1,
});

const makeFullConfig = (): TemplateConfig => ({
    schema_version: 1,
    text: {
        lines: [
            { text: 'LINE 1', color: '#FFFFFF', font_size: 46, font: 'Bebas Neue', font_weight: '900', letter_spacing: 1 },
            { text: 'LINE 2', color: '#FDE68A', font_size: 52, font: 'Bebas Neue', font_weight: '900', letter_spacing: 0 },
            { text: 'LINE 3', color: '#F0ABFC', font_size: 34, font: 'Bebas Neue', font_weight: '900', letter_spacing: 4 },
        ],
        font_size_normal: 36,
        font_size_keyword: 56,
        color: '#FFFFFF',
        keyword_color: '#FFFFFF',
        fontfile: '',
        fallback_font: 'Anton',
        line_spacing: 10,
        word_spacing: 12,
        padding_horizontal: 80,
        text_transform: 'uppercase',
        letter_spacing: 0,
    },
    badge: {
        enable: true,
        text: 'CERITA NYATA 🔥',
        bg_color: '#EA449A',
        font_size: 10,
        font_family: 'Montserrat',
        letter_spacing: 2,
        animation: { type: 'slide_left', delay: 0.15, duration: 0.4 },
    },
    animation: {
        type: 'stagger_composition',
        per_line: [
            { type: 'slam_left', delay: 0.35, easing: 'backOut', idle: null, idle_delay: 0 },
            { type: 'slam_right', delay: 0.58, easing: 'backOut', idle: null, idle_delay: 0 },
            { type: 'scale_rotate', delay: 0.82, easing: 'backOut', idle: 'shake', idle_delay: 0.73 },
        ],
    },
    decorations: {
        divider: { enable: true, colors: ['#f472b6', '#c084fc', 'transparent'], width: 180, delay: 1.1 },
        emoji_row: { enable: true, emojis: ['😱', '💔', '😭'], delay: 1.25 },
    },
    effects: {
        flash: { enable: true, color: 'rgba(192,132,252,0.3)', delay: 0.25, duration: 0.55 },
        particles: { enable: true, count: 8, colors: ['#f472b6', '#c084fc', '#818cf8', '#fde68a'], size_range: [3, 5] },
    },
    overlay: {
        gradient_top: { enable: true, color: 'rgba(80,10,120,0.5)', height_percent: 40 },
        gradient_bottom: { enable: true, color: 'rgba(0,0,0,0.85)', height_percent: 35 },
    },
    position: {
        anchor: 'top',
        offset_y: 0,
        offset_x: 0,
    },
    font_registry: [
        { family: 'Bebas Neue', source: 'google', path: 'Bebas Neue' },
        { family: 'Montserrat', source: 'google', path: 'Montserrat' },
    ],
    safe_area: {
        override: false,
        top_percent: 10,
        bottom_percent: 20,
        side_percent: 10,
    },
});

const makeHookStyle = (config?: TemplateConfig): HookStyleProps => ({
    fontFamily: 'Bebas Neue',
    fontSize: 46,
    color: '#FFFFFF',
    keywordColor: '#FDE68A',
    shadow: '2px 2px 4px rgba(0,0,0,0.7)',
    glow: '',
    animationType: 'stagger_composition',
    displayDurationSeconds: 4,
    config: config ?? makeMinimalConfig(),
});

const makeCaptionStyle = (): CaptionStyleProps => ({
    fontFamily: 'Inter',
    fontSize: 32,
    color: '#FFFFFF',
    highlightColor: '#FFDD00',
    highlightBgColor: '',
    highlightStyle: 'glow',
    highlightTransition: 'ease',
    shadow: '2px 2px 4px rgba(0,0,0,0.7)',
    config: makeMinimalConfig(),
});

const makeValidProps = (overrides?: Partial<ClipCompositionProps>): ClipCompositionProps => ({
    videoSrc: 'https://example.com/video.mp4',
    hookText: 'DIA TERNYATA BOHONG',
    subtitles: makeSubtitles(),
    hookStyle: makeHookStyle(),
    captionStyle: makeCaptionStyle(),
    ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Render Pipeline Integration: ClipComposition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Valid props rendering (Req 7.5)', () => {
        it('renders without errors when given valid props at 1080×1920', () => {
            const props = makeValidProps();

            // Should not throw when called with valid props
            expect(() => {
                ClipComposition(props);
            }).not.toThrow();
        });

        it('renders successfully with minimal valid props', () => {
            const props = makeValidProps({
                hookText: 'Simple hook',
                subtitles: [{ word: 'test', start: 0, end: 1 }],
            });

            expect(() => {
                ClipComposition(props);
            }).not.toThrow();
        });

        it('returns a valid React element', () => {
            const props = makeValidProps();
            const result = ClipComposition(props);

            // ClipComposition returns JSX (React element)
            expect(result).not.toBeNull();
            expect(result).toBeDefined();
        });
    });

    describe('Missing videoSrc validation (Req 7.8)', () => {
        it('throws Error with message when videoSrc is empty string', () => {
            const props = makeValidProps({ videoSrc: '' });

            expect(() => {
                ClipComposition(props);
            }).toThrow('Missing required prop: videoSrc');
        });

        it('throws an Error instance for missing videoSrc', () => {
            const props = makeValidProps({ videoSrc: '' });

            expect(() => {
                ClipComposition(props);
            }).toThrow(Error);
        });
    });

    describe('Missing subtitles validation (Req 7.8)', () => {
        it('throws Error with message when subtitles is empty array', () => {
            const props = makeValidProps({ subtitles: [] });

            expect(() => {
                ClipComposition(props);
            }).toThrow('Missing required prop: subtitles');
        });

        it('throws an Error instance for empty subtitles', () => {
            const props = makeValidProps({ subtitles: [] });

            expect(() => {
                ClipComposition(props);
            }).toThrow(Error);
        });
    });

    describe('All features enabled — no crash (Req 18.3)', () => {
        it('renders without errors when all features are enabled', () => {
            const fullConfig = makeFullConfig();
            const props = makeValidProps({
                hookStyle: makeHookStyle(fullConfig),
            });

            expect(() => {
                ClipComposition(props);
            }).not.toThrow();
        });

        it('renders with badge, particles, flash, gradients, and decorations enabled', () => {
            const fullConfig = makeFullConfig();

            // Verify all feature flags are enabled in the config
            expect(fullConfig.badge?.enable).toBe(true);
            expect(fullConfig.effects?.particles.enable).toBe(true);
            expect(fullConfig.effects?.flash.enable).toBe(true);
            expect(fullConfig.overlay?.gradient_top.enable).toBe(true);
            expect(fullConfig.overlay?.gradient_bottom.enable).toBe(true);
            expect(fullConfig.decorations?.divider.enable).toBe(true);
            expect(fullConfig.decorations?.emoji_row.enable).toBe(true);

            const props = makeValidProps({
                hookStyle: makeHookStyle(fullConfig),
            });

            expect(() => {
                ClipComposition(props);
            }).not.toThrow();
        });

        it('renders with full text.lines and per_line animations without crash', () => {
            const fullConfig = makeFullConfig();

            // Verify multi-line and per-line animations are set
            expect(fullConfig.text?.lines.length).toBe(3);
            expect(fullConfig.animation?.per_line.length).toBe(3);

            const props = makeValidProps({
                hookStyle: makeHookStyle(fullConfig),
            });

            const result = ClipComposition(props);
            expect(result).not.toBeNull();
        });

        it('renders with 6 text lines (max) without crash', () => {
            const fullConfig = makeFullConfig();
            // Add up to 6 lines (max supported)
            fullConfig.text!.lines = [
                { text: 'LINE 1', color: '#FFFFFF', font_size: 46, font: 'Bebas Neue', font_weight: '900', letter_spacing: 1 },
                { text: 'LINE 2', color: '#FDE68A', font_size: 52, font: 'Bebas Neue', font_weight: '900', letter_spacing: 0 },
                { text: 'LINE 3', color: '#F0ABFC', font_size: 34, font: 'Bebas Neue', font_weight: '900', letter_spacing: 4 },
                { text: 'LINE 4', color: '#FF6B6B', font_size: 40, font: 'Bebas Neue', font_weight: '700', letter_spacing: 2 },
                { text: 'LINE 5', color: '#4ECDC4', font_size: 38, font: 'Bebas Neue', font_weight: '800', letter_spacing: 1 },
                { text: 'LINE 6', color: '#FFE66D', font_size: 36, font: 'Bebas Neue', font_weight: '900', letter_spacing: 0 },
            ];
            fullConfig.animation!.per_line = [
                { type: 'slam_left', delay: 0.2, easing: 'backOut', idle: null, idle_delay: 0 },
                { type: 'slam_right', delay: 0.4, easing: 'backOut', idle: null, idle_delay: 0 },
                { type: 'scale_rotate', delay: 0.6, easing: 'circOut', idle: 'shake', idle_delay: 0.5 },
                { type: 'slide_up', delay: 0.8, easing: 'easeOut', idle: 'pulse', idle_delay: 0.3 },
                { type: 'pop', delay: 1.0, easing: 'bounce', idle: null, idle_delay: 0 },
                { type: 'fade', delay: 1.2, easing: 'linear', idle: null, idle_delay: 0 },
            ];

            const props = makeValidProps({
                hookStyle: makeHookStyle(fullConfig),
            });

            expect(() => {
                ClipComposition(props);
            }).not.toThrow();
        });
    });
});
