-- ============================================================================
-- Seed: Additional Hook Templates (v2) — Fresh & Attractive
-- Date: 2026-06-12
-- Description: 6 new hook templates with varied alignment (left/center),
--              NO background box, NO highlight behind text, clean minimal look.
--              All positioned vertically center. Mix of serif, sans, display fonts.
--
-- Run AFTER: seed_keyframe_styles.sql
-- ============================================================================

USE autocliper;

-- ─── 9. Street Left Slam (viral, animated, 3 lines, left-aligned, no bg) ────
INSERT INTO hook_templates (name, description, category, thumbnail_url, style_type, config, user_id, is_active, is_default, sort_order)
VALUES (
  'Street Left Slam',
  'Raw street-style 3-line hook, left-aligned, no background, bold white & electric blue with slam entrance',
  'viral',
  NULL,
  'animated',
  '{
    "text": {
      "lines": [
        { "font_family": "Impact", "font_size": 68, "font_weight": "900", "color": "#FFFFFF", "letter_spacing": 2.0, "text_transform": "uppercase" },
        { "font_family": "Impact", "font_size": 58, "font_weight": "900", "color": "#00D4FF", "letter_spacing": 1.5, "text_transform": "uppercase" },
        { "font_family": null, "font_size": 44, "font_weight": "700", "color": "#FFFFFF", "letter_spacing": 0.5, "text_transform": "none" }
      ],
      "default_font": { "family": "Impact", "weight": "900", "size": 58, "color": "#FFFFFF", "letter_spacing": 1.5 }
    },
    "box": { "enabled": false, "color": "#000000", "opacity": 0, "padding": 0, "border_radius": 0, "border_color": null, "border_width": 0 },
    "position": { "anchor": "center", "y_offset": 0, "x_offset": -80 },
    "animation": {
      "entrance_keyframe_id": 8,
      "transform_origin": "center left",
      "per_line": [
        { "keyframe_id": 8, "delay_ms": 0, "transform_origin": "center left" },
        { "keyframe_id": 8, "delay_ms": 120, "transform_origin": "center left" },
        { "keyframe_id": 5, "delay_ms": 280, "transform_origin": "center left" }
      ]
    },
    "decorations": { "divider": { "enable": false }, "emoji_row": { "enable": false }, "badge": { "enable": false } },
    "effects": { "flash": { "enable": false }, "particles": { "enable": false } },
    "overlay": { "gradient_top": { "enable": false }, "gradient_bottom": { "enable": false } },
    "timing": { "display_duration_seconds": 3.5, "delay_before_seconds": 0.2 }
  }',
  NULL,
  1,
  0,
  90
);

-- ─── 10. Elegant Serif Flow (cinematic, animated, 3 lines, center, no bg) ───
INSERT INTO hook_templates (name, description, category, thumbnail_url, style_type, config, user_id, is_active, is_default, sort_order)
VALUES (
  'Elegant Serif Flow',
  'Cinematic serif hook with warm gold accent, center-aligned, no background, graceful fade-in per line',
  'cinematic',
  NULL,
  'animated',
  '{
    "text": {
      "lines": [
        { "font_family": "Georgia", "font_size": 52, "font_weight": "400", "color": "#E8D5B7", "letter_spacing": 1.8, "text_transform": "none" },
        { "font_family": "Georgia", "font_size": 62, "font_weight": "700", "color": "#FFD700", "letter_spacing": 0.8, "text_transform": "none" },
        { "font_family": "Georgia", "font_size": 42, "font_weight": "400", "color": "#B8A080", "letter_spacing": 2.0, "text_transform": "uppercase" }
      ],
      "default_font": { "family": "Georgia", "weight": "400", "size": 52, "color": "#E8D5B7", "letter_spacing": 1.5 }
    },
    "box": { "enabled": false, "color": "#000000", "opacity": 0, "padding": 0, "border_radius": 0, "border_color": null, "border_width": 0 },
    "position": { "anchor": "center", "y_offset": 0, "x_offset": 0 },
    "animation": {
      "entrance_keyframe_id": 1,
      "transform_origin": "center center",
      "per_line": [
        { "keyframe_id": 1, "delay_ms": 0, "transform_origin": null },
        { "keyframe_id": 2, "delay_ms": 400, "transform_origin": null },
        { "keyframe_id": 1, "delay_ms": 700, "transform_origin": null }
      ]
    },
    "decorations": { "divider": { "enable": false }, "emoji_row": { "enable": false }, "badge": { "enable": false } },
    "effects": { "flash": { "enable": false }, "particles": { "enable": false } },
    "overlay": { "gradient_top": { "enable": false }, "gradient_bottom": { "enable": false } },
    "timing": { "display_duration_seconds": 4.5, "delay_before_seconds": 0.4 }
  }',
  NULL,
  1,
  0,
  100
);

-- ─── 11. Gradient Text Left (playful, animated, 3 lines, left-aligned, no bg)
INSERT INTO hook_templates (name, description, category, thumbnail_url, style_type, config, user_id, is_active, is_default, sort_order)
VALUES (
  'Gradient Text Left',
  'Playful left-aligned hook with pink-to-purple color gradient across lines, no background, slide-left entrance',
  'playful',
  NULL,
  'animated',
  '{
    "text": {
      "lines": [
        { "font_family": "Helvetica", "font_size": 56, "font_weight": "800", "color": "#FF6B9D", "letter_spacing": 1.0, "text_transform": "none" },
        { "font_family": "Helvetica", "font_size": 64, "font_weight": "900", "color": "#C44DFF", "letter_spacing": 0.5, "text_transform": "uppercase" },
        { "font_family": "Helvetica", "font_size": 48, "font_weight": "600", "color": "#7B68EE", "letter_spacing": 1.5, "text_transform": "none" }
      ],
      "default_font": { "family": "Helvetica", "weight": "800", "size": 56, "color": "#FF6B9D", "letter_spacing": 1.0 }
    },
    "box": { "enabled": false, "color": "#000000", "opacity": 0, "padding": 0, "border_radius": 0, "border_color": null, "border_width": 0 },
    "position": { "anchor": "center", "y_offset": 0, "x_offset": -60 },
    "animation": {
      "entrance_keyframe_id": 5,
      "transform_origin": "center left",
      "per_line": [
        { "keyframe_id": 5, "delay_ms": 0, "transform_origin": "center left" },
        { "keyframe_id": 5, "delay_ms": 150, "transform_origin": "center left" },
        { "keyframe_id": 5, "delay_ms": 300, "transform_origin": "center left" }
      ]
    },
    "decorations": { "divider": { "enable": false }, "emoji_row": { "enable": false }, "badge": { "enable": false } },
    "effects": { "flash": { "enable": false }, "particles": { "enable": false } },
    "overlay": { "gradient_top": { "enable": false }, "gradient_bottom": { "enable": false } },
    "timing": { "display_duration_seconds": 3.5, "delay_before_seconds": 0.15 }
  }',
  NULL,
  1,
  0,
  110
);

-- ─── 12. Mono Typewriter (minimal, animated, 2 lines, left-aligned, no bg) ──
INSERT INTO hook_templates (name, description, category, thumbnail_url, style_type, config, user_id, is_active, is_default, sort_order)
VALUES (
  'Mono Typewriter',
  'Minimal monospace left-aligned hook with green terminal accent, typewriter entrance animation, no background',
  'minimal',
  NULL,
  'animated',
  '{
    "text": {
      "lines": [
        { "font_family": "Courier New", "font_size": 48, "font_weight": "700", "color": "#00FF88", "letter_spacing": 2.5, "text_transform": "none" },
        { "font_family": "Courier New", "font_size": 40, "font_weight": "400", "color": "#CCCCCC", "letter_spacing": 2.0, "text_transform": "none" }
      ],
      "default_font": { "family": "Courier New", "weight": "700", "size": 44, "color": "#00FF88", "letter_spacing": 2.0 }
    },
    "box": { "enabled": false, "color": "#000000", "opacity": 0, "padding": 0, "border_radius": 0, "border_color": null, "border_width": 0 },
    "position": { "anchor": "center", "y_offset": 0, "x_offset": -70 },
    "animation": {
      "entrance_keyframe_id": 9,
      "transform_origin": "center left",
      "per_line": [
        { "keyframe_id": 9, "delay_ms": 0, "transform_origin": "center left" },
        { "keyframe_id": 9, "delay_ms": 350, "transform_origin": "center left" }
      ]
    },
    "decorations": { "divider": { "enable": false }, "emoji_row": { "enable": false }, "badge": { "enable": false } },
    "effects": { "flash": { "enable": false }, "particles": { "enable": false } },
    "overlay": { "gradient_top": { "enable": false }, "gradient_bottom": { "enable": false } },
    "timing": { "display_duration_seconds": 4.0, "delay_before_seconds": 0.3 }
  }',
  NULL,
  1,
  0,
  120
);

-- ─── 13. Fire Gradient Center (viral, animated, 3 lines, center, no bg) ─────
INSERT INTO hook_templates (name, description, category, thumbnail_url, style_type, config, user_id, is_active, is_default, sort_order)
VALUES (
  'Fire Gradient Center',
  'High-energy fire gradient hook (red→orange→yellow) center-aligned, no background, scale bounce per line',
  'viral',
  NULL,
  'animated',
  '{
    "text": {
      "lines": [
        { "font_family": "Arial Black", "font_size": 62, "font_weight": "900", "color": "#FF4444", "letter_spacing": 1.5, "text_transform": "uppercase" },
        { "font_family": "Arial Black", "font_size": 70, "font_weight": "900", "color": "#FF8C00", "letter_spacing": 1.0, "text_transform": "uppercase" },
        { "font_family": "Arial Black", "font_size": 52, "font_weight": "700", "color": "#FFD700", "letter_spacing": 2.0, "text_transform": "none" }
      ],
      "default_font": { "family": "Arial Black", "weight": "900", "size": 62, "color": "#FF4444", "letter_spacing": 1.5 }
    },
    "box": { "enabled": false, "color": "#000000", "opacity": 0, "padding": 0, "border_radius": 0, "border_color": null, "border_width": 0 },
    "position": { "anchor": "center", "y_offset": 0, "x_offset": 0 },
    "animation": {
      "entrance_keyframe_id": 2,
      "transform_origin": "center center",
      "per_line": [
        { "keyframe_id": 2, "delay_ms": 0, "transform_origin": null },
        { "keyframe_id": 2, "delay_ms": 180, "transform_origin": null },
        { "keyframe_id": 2, "delay_ms": 360, "transform_origin": null }
      ]
    },
    "decorations": { "divider": { "enable": false }, "emoji_row": { "enable": false }, "badge": { "enable": false } },
    "effects": { "flash": { "enable": false }, "particles": { "enable": false } },
    "overlay": { "gradient_top": { "enable": false }, "gradient_bottom": { "enable": false } },
    "timing": { "display_duration_seconds": 3.0, "delay_before_seconds": 0.1 }
  }',
  NULL,
  1,
  0,
  130
);

-- ─── 14. Arctic Whisper Left (minimal, animated, 3 lines, left-aligned, no bg)
INSERT INTO hook_templates (name, description, category, thumbnail_url, style_type, config, user_id, is_active, is_default, sort_order)
VALUES (
  'Arctic Whisper Left',
  'Cool-toned minimal left-aligned hook with ice blue palette, thin modern font, slide-up stagger, no background',
  'minimal',
  NULL,
  'animated',
  '{
    "text": {
      "lines": [
        { "font_family": "Helvetica Neue", "font_size": 50, "font_weight": "300", "color": "#E0F7FA", "letter_spacing": 3.0, "text_transform": "uppercase" },
        { "font_family": "Helvetica Neue", "font_size": 60, "font_weight": "700", "color": "#80DEEA", "letter_spacing": 1.0, "text_transform": "none" },
        { "font_family": "Helvetica Neue", "font_size": 42, "font_weight": "300", "color": "#4DD0E1", "letter_spacing": 2.5, "text_transform": "uppercase" }
      ],
      "default_font": { "family": "Helvetica Neue", "weight": "300", "size": 50, "color": "#E0F7FA", "letter_spacing": 2.5 }
    },
    "box": { "enabled": false, "color": "#000000", "opacity": 0, "padding": 0, "border_radius": 0, "border_color": null, "border_width": 0 },
    "position": { "anchor": "center", "y_offset": 0, "x_offset": -50 },
    "animation": {
      "entrance_keyframe_id": 3,
      "transform_origin": "center left",
      "per_line": [
        { "keyframe_id": 3, "delay_ms": 0, "transform_origin": "center left" },
        { "keyframe_id": 3, "delay_ms": 200, "transform_origin": "center left" },
        { "keyframe_id": 3, "delay_ms": 400, "transform_origin": "center left" }
      ]
    },
    "decorations": { "divider": { "enable": false }, "emoji_row": { "enable": false }, "badge": { "enable": false } },
    "effects": { "flash": { "enable": false }, "particles": { "enable": false } },
    "overlay": { "gradient_top": { "enable": false }, "gradient_bottom": { "enable": false } },
    "timing": { "display_duration_seconds": 4.0, "delay_before_seconds": 0.3 }
  }',
  NULL,
  1,
  0,
  140
);
