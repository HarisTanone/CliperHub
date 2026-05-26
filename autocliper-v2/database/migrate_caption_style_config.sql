-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Add config JSON column to caption_styles
-- This enables extended styling features (highlight style, animations, pills)
-- while keeping backward compatibility with existing column-based styles.
-- ═══════════════════════════════════════════════════════════════════════════════

USE autocliper;

-- Add config column (JSON) for extended style options
ALTER TABLE caption_styles
ADD COLUMN IF NOT EXISTS config JSON DEFAULT NULL
AFTER caption_bottom_margin;

-- Update existing styles with rich configs

-- Default Yellow → background highlight style
UPDATE caption_styles SET config = '{
  "highlight": {
    "style": "background",
    "background_color": "#FFF45C",
    "background_opacity": 220,
    "background_padding_x": 6,
    "background_padding_y": 3,
    "background_radius": 4,
    "transition": "instant"
  },
  "text_transform": "uppercase",
  "animation": {
    "chunk_enter": "fade_up",
    "enter_duration": 0.12
  }
}' WHERE name = 'Default Yellow' AND user_id IS NULL;

-- White Clean → scale highlight
UPDATE caption_styles SET config = '{
  "highlight": {
    "style": "scale",
    "scale_factor": 1.12,
    "transition": "smooth"
  },
  "text_transform": "uppercase",
  "shadow_blur": 4,
  "animation": {
    "chunk_enter": "pop",
    "enter_duration": 0.1
  }
}' WHERE name = 'White Clean' AND user_id IS NULL;

-- Red Bold → glow highlight
UPDATE caption_styles SET config = '{
  "highlight": {
    "style": "glow",
    "glow_color": "#FF6666",
    "glow_radius": 8,
    "glow_opacity": 180,
    "transition": "smooth"
  },
  "text_transform": "uppercase",
  "animation": {
    "chunk_enter": "slide_left",
    "enter_duration": 0.15
  }
}' WHERE name = 'Red Bold' AND user_id IS NULL;

-- Neon Purple Glow → background pill + glow
UPDATE caption_styles SET config = '{
  "highlight": {
    "style": "glow",
    "glow_color": "#FF69B4",
    "glow_radius": 10,
    "glow_opacity": 200,
    "transition": "smooth"
  },
  "text_transform": "none",
  "background_pill": {
    "enable": true,
    "color": "#1A0A2E",
    "opacity": 200,
    "padding_x": 20,
    "padding_y": 10,
    "border_radius": 16,
    "per_line": true
  },
  "animation": {
    "chunk_enter": "fade_up",
    "enter_duration": 0.15
  }
}' WHERE name = 'Neon Purple Glow' AND user_id IS NULL;

-- Add new premium styles

INSERT INTO caption_styles (name, font_family, font_weight, font_size, color, highlight_color, outline_color, outline_width, shadow_color, shadow_offset_x, shadow_offset_y, line_spacing, caption_bottom_margin, config) VALUES
('TikTok Native', 'Poppins Bold', 'bold', 22, '#FFFFFF', '#FFFFFF', '#000000', 0, '#000000', 0, 0, 1.3, 80, '{
  "highlight": {
    "style": "background",
    "background_color": "#FFFFFF",
    "background_opacity": 240,
    "background_padding_x": 8,
    "background_padding_y": 5,
    "background_radius": 6,
    "transition": "instant"
  },
  "text_transform": "none",
  "background_pill": {
    "enable": true,
    "color": "#000000",
    "opacity": 180,
    "padding_x": 14,
    "padding_y": 8,
    "border_radius": 10,
    "per_line": true
  },
  "animation": {
    "chunk_enter": "pop",
    "enter_duration": 0.08
  }
}'),
('Gradient Glow', 'Anton', 'bold', 28, '#E0E0E0', '#00D4FF', '#000000', 2, '#000000', 2, 3, 1.2, 75, '{
  "highlight": {
    "style": "glow",
    "glow_color": "#00D4FF",
    "glow_radius": 12,
    "glow_opacity": 200,
    "transition": "smooth"
  },
  "text_transform": "uppercase",
  "shadow_blur": 6,
  "animation": {
    "chunk_enter": "fade_up",
    "enter_duration": 0.12
  }
}'),
('Minimal Pill', 'Inter Bold', 'bold', 20, '#1A1A1A', '#1A1A1A', '#000000', 0, '#000000', 0, 0, 1.4, 90, '{
  "highlight": {
    "style": "color",
    "transition": "instant"
  },
  "text_transform": "none",
  "background_pill": {
    "enable": true,
    "color": "#FFFFFF",
    "opacity": 240,
    "padding_x": 16,
    "padding_y": 10,
    "border_radius": 14,
    "per_line": true
  },
  "animation": {
    "chunk_enter": "pop",
    "enter_duration": 0.1
  }
}')
ON DUPLICATE KEY UPDATE name=name;
