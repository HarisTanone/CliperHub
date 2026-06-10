// ─── Easing Enum (Req 17) ────────────────────────────────────────────────────
export type EasingType =
    | 'linear'
    | 'easeIn'
    | 'easeOut'
    | 'easeInOut'
    | 'circOut'
    | 'backOut'
    | 'bounce';

// ─── Caption Highlight Styles (Req 20) ───────────────────────────────────────
export type HighlightStyle = 'glow' | 'background' | 'underline' | 'fill' | 'scale';

// ─── Text Config (Req 9.2) ───────────────────────────────────────────────────
export interface TextLineEntry {
    text: string;
    color: string;
    font_size: number;
    font: string;
    font_weight: string;
    letter_spacing: number;
}

export interface TextConfig {
    lines: TextLineEntry[];
    font_size_normal: number;
    font_size_keyword: number;
    color: string;
    keyword_color: string;
    fontfile: string;
    fallback_font: string;
    line_spacing: number;
    word_spacing: number;
    padding_horizontal: number;
    text_transform: string;
    letter_spacing: number;
}

// ─── Badge Config (Req 9.3) ──────────────────────────────────────────────────
export interface BadgeAnimationConfig {
    type: string;
    delay: number;
    duration: number;
}

export interface BadgeConfig {
    enable: boolean;
    text: string;
    bg_color: string;
    font_size: number;
    font_family: string;
    letter_spacing: number;
    animation?: BadgeAnimationConfig;
}

// ─── Per-Line Animation (Req 9.4) ────────────────────────────────────────────
export interface PerLineAnimation {
    type: 'slam_left' | 'slam_right' | 'scale_rotate' | 'slide_up' | 'pop' | 'fade';
    delay: number;
    easing: EasingType;
    idle?: 'shake' | 'pulse' | null;
    idle_delay?: number;
}

export interface AnimationConfig {
    type: string;
    per_line: PerLineAnimation[];
}

// ─── Decorations Config (Req 9.5) ────────────────────────────────────────────
export interface DividerConfig {
    enable: boolean;
    colors: string[];
    width: number;
    delay: number;
}

export interface EmojiRowConfig {
    enable: boolean;
    emojis: string[];
    delay: number;
}

export interface DecorationsConfig {
    divider: DividerConfig;
    emoji_row: EmojiRowConfig;
}

// ─── Effects Config (Req 9.6) ────────────────────────────────────────────────
export interface FlashConfig {
    enable: boolean;
    color: string;
    delay: number;
    duration: number;
}

export interface ParticlesConfig {
    enable: boolean;
    count: number;
    colors: string[];
    size_range: [number, number];
}

export interface EffectsConfig {
    flash: FlashConfig;
    particles: ParticlesConfig;
}

// ─── Overlay Config (Req 9.7) ────────────────────────────────────────────────
export interface GradientConfig {
    enable: boolean;
    color: string;
    height_percent: number;
}

export interface OverlayConfig {
    gradient_top: GradientConfig;
    gradient_bottom: GradientConfig;
}

// ─── Positioning (Req 12.1) ──────────────────────────────────────────────────
export interface PositionConfig {
    anchor: 'top' | 'center' | 'bottom';
    offset_y: number;
    offset_x: number;
}

// ─── Font Registry (Req 14) ─────────────────────────────────────────────────
export interface FontEntry {
    family: string;
    source: 'google' | 'local' | 'url';
    path: string;
}

// ─── Safe Area (Req 15) ─────────────────────────────────────────────────────
export interface SafeAreaConfig {
    override: boolean;
    top_percent: number;
    bottom_percent: number;
    side_percent: number;
}

// ─── Template Config (Req 9.1, Schema Version Req 16) ────────────────────────
export interface TemplateConfig {
    schema_version: number;
    text?: TextConfig;
    badge?: BadgeConfig;
    animation?: AnimationConfig;
    decorations?: DecorationsConfig;
    effects?: EffectsConfig;
    overlay?: OverlayConfig;
    position?: PositionConfig;
    font_registry?: FontEntry[];
    safe_area?: SafeAreaConfig;
}

// ─── Subtitle Entry ──────────────────────────────────────────────────────────
export interface SubtitleEntry {
    word: string;
    start: number;
    end: number;
}

// ─── Hook Style Props ────────────────────────────────────────────────────────
export interface HookStyleProps {
    fontFamily: string;
    fontSize: number;
    color: string;
    keywordColor: string;
    shadow: string;
    glow: string;
    animationType: string;
    displayDurationSeconds: number;
    config: TemplateConfig;
}

// ─── Caption Style Props ─────────────────────────────────────────────────────
export interface CaptionStyleProps {
    fontFamily: string;
    fontSize: number;
    color: string;
    highlightColor: string;
    highlightBgColor: string;
    highlightStyle: HighlightStyle;
    highlightTransition: string;
    shadow: string;
    config: TemplateConfig;
}

// ─── Clip Composition Props (Req 7.1) ────────────────────────────────────────
export interface ClipCompositionProps {
    videoSrc: string;
    hookText: string;
    subtitles: SubtitleEntry[];
    hookStyle: HookStyleProps;
    captionStyle: CaptionStyleProps;
}
