/**
 * Benchmark Configuration for Remotion Render Pipeline
 *
 * Defines the two benchmark scenarios and their performance thresholds:
 * - fullFeatures: All overlay features enabled (badge, particles, flash, gradients, decorations, multi-line text)
 * - minimal: Only basic text, all effects disabled
 */

/**
 * Performance thresholds in seconds.
 * Based on reference hardware: 4 CPU cores, 8GB RAM.
 *
 * Validates: Requirements 18.1, 18.2
 */
export const PERFORMANCE_THRESHOLDS = {
    /** 60s video with all features → must complete within 300s */
    fullFeatures60s: 300,
    /** <30s video with minimal overlays → must complete within 120s */
    minimal30s: 120,
};

/**
 * Full features benchmark configuration.
 * Enables all overlay features: badge, particles, flash, gradients,
 * decorations, 3 text lines with per_line animations.
 *
 * Validates: Requirement 18.1
 */
export const FULL_FEATURES_CONFIG = {
    schema_version: 1,
    text: {
        lines: [
            { text: "BENCHMARK LINE 1", color: "#FFFFFF", font_size: 46, font: "Bebas Neue", font_weight: "900", letter_spacing: 1 },
            { text: "BENCHMARK LINE 2", color: "#FDE68A", font_size: 52, font: "Bebas Neue", font_weight: "900", letter_spacing: 0 },
            { text: "BENCHMARK LINE 3", color: "#F0ABFC", font_size: 34, font: "Bebas Neue", font_weight: "900", letter_spacing: 4 },
        ],
        font_size_normal: 36,
        font_size_keyword: 56,
        color: "#FFFFFF",
        keyword_color: "#FFFFFF",
        fontfile: "",
        fallback_font: "Anton",
        line_spacing: 10,
        word_spacing: 12,
        padding_horizontal: 80,
        text_transform: "uppercase",
        letter_spacing: 0,
    },
    badge: {
        enable: true,
        text: "BENCHMARK TEST 🔥",
        bg_color: "#EA449A",
        font_size: 10,
        font_family: "Montserrat",
        letter_spacing: 2,
        animation: { type: "slide_left", delay: 0.15, duration: 0.4 },
    },
    animation: {
        type: "stagger_composition",
        per_line: [
            { type: "slam_left", delay: 0.35, easing: "backOut", idle: null, idle_delay: 0 },
            { type: "slam_right", delay: 0.58, easing: "backOut", idle: null, idle_delay: 0 },
            { type: "scale_rotate", delay: 0.82, easing: "backOut", idle: "shake", idle_delay: 0.73 },
        ],
    },
    decorations: {
        divider: { enable: true, colors: ["#f472b6", "#c084fc", "transparent"], width: 180, delay: 1.1 },
        emoji_row: { enable: true, emojis: ["😱", "💔", "😭"], delay: 1.25 },
    },
    effects: {
        flash: { enable: true, color: "rgba(192,132,252,0.3)", delay: 0.25, duration: 0.55 },
        particles: { enable: true, count: 8, colors: ["#f472b6", "#c084fc", "#818cf8", "#fde68a"], size_range: [3, 5] },
    },
    overlay: {
        gradient_top: { enable: true, color: "rgba(80,10,120,0.5)", height_percent: 40 },
        gradient_bottom: { enable: true, color: "rgba(0,0,0,0.85)", height_percent: 35 },
    },
    position: {
        anchor: "top",
        offset_y: 0,
        offset_x: 0,
    },
    font_registry: [
        { family: "Bebas Neue", source: "google", path: "Bebas Neue" },
        { family: "Montserrat", source: "google", path: "Montserrat" },
    ],
    safe_area: {
        override: false,
        top_percent: 10,
        bottom_percent: 20,
        side_percent: 10,
    },
};

/**
 * Minimal benchmark configuration.
 * Only basic text (1 line), all effects and decorations disabled.
 *
 * Validates: Requirement 18.2
 */
export const MINIMAL_CONFIG = {
    schema_version: 1,
    text: {
        lines: [
            { text: "MINIMAL BENCHMARK", color: "#FFFFFF", font_size: 46, font: "Bebas Neue", font_weight: "900", letter_spacing: 1 },
        ],
        font_size_normal: 36,
        font_size_keyword: 56,
        color: "#FFFFFF",
        keyword_color: "#FFFFFF",
        fontfile: "",
        fallback_font: "Anton",
        line_spacing: 10,
        word_spacing: 12,
        padding_horizontal: 80,
        text_transform: "uppercase",
        letter_spacing: 0,
    },
    badge: {
        enable: false,
        text: "",
        bg_color: "#000000",
        font_size: 10,
        font_family: "Montserrat",
        letter_spacing: 0,
        animation: { type: "fade", delay: 0, duration: 0.4 },
    },
    animation: {
        type: "fade",
        per_line: [
            { type: "fade", delay: 0.3, easing: "easeOut", idle: null, idle_delay: 0 },
        ],
    },
    decorations: {
        divider: { enable: false, colors: [], width: 0, delay: 0 },
        emoji_row: { enable: false, emojis: [], delay: 0 },
    },
    effects: {
        flash: { enable: false, color: "rgba(0,0,0,0)", delay: 0, duration: 0 },
        particles: { enable: false, count: 0, colors: [], size_range: [3, 5] },
    },
    overlay: {
        gradient_top: { enable: false, color: "rgba(0,0,0,0)", height_percent: 0 },
        gradient_bottom: { enable: false, color: "rgba(0,0,0,0)", height_percent: 0 },
    },
    position: {
        anchor: "center",
        offset_y: 0,
        offset_x: 0,
    },
    font_registry: [
        { family: "Bebas Neue", source: "google", path: "Bebas Neue" },
    ],
    safe_area: {
        override: false,
        top_percent: 10,
        bottom_percent: 20,
        side_percent: 10,
    },
};
