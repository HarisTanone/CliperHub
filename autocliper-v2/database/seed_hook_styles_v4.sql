-- ═══════════════════════════════════════════════════════════════════════════════
-- Hook Styles v4 — Premium styles with new features:
--   ✓ Glow effects (keyword glow, full text glow)
--   ✓ Text outline/stroke
--   ✓ Keyword background pills
--   ✓ Advanced animations (scale_up, slide_up, bounce, typewriter)
--   ✓ Text transform options
--   ✓ Box with border radius
-- ═══════════════════════════════════════════════════════════════════════════════

USE autocliper;

-- Add new premium styles (don't truncate — append to existing)

INSERT INTO hook_styles (name, config, is_active) VALUES

-- ─── Neon Glow ──────────────────────────────────────────────────────────────
-- Keywords glow with neon blue. Scale up animation.
('Neon Glow', '{
  "text":{"fontfile":"","fallback_font":"Anton","font_size_normal":50,"font_size_keyword":80,"color":"#FFFFFF","keyword_color":"#00D4FF","line_spacing":12,"word_spacing":10,"padding_horizontal":60,"text_transform":"uppercase","letter_spacing":2},
  "shadow":{"enable":true,"color":"#001A33","opacity":200,"blur":10,"alpha_multiplier":0.4,"offset_y":3},
  "glow":{"enable":true,"color":"#00D4FF","opacity":150,"radius":10,"keyword_only":true},
  "outline":{"enable":false,"color":"#000000","width":0,"keyword_only":false},
  "keyword":{"underline":{"color":"#00D4FF","opacity":0,"thickness":0,"offset_y":0},"background":{"enable":false},"scale":1.0},
  "position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},
  "box":{"enable":false,"color":"#000000","opacity":0,"padding":0,"border_radius":0,"border_color":"","border_width":0},
  "animation":{"fade_in":0.4,"fade_out":0.3,"type":"scale_up","scale_from":0.85,"slide_distance":0}
}', 1),

-- ─── Pill Highlight ─────────────────────────────────────────────────────────
-- Keywords get a colored background pill. Slide up animation.
('Pill Highlight', '{
  "text":{"fontfile":"","fallback_font":"Poppins Bold","font_size_normal":44,"font_size_keyword":68,"color":"#FFFFFF","keyword_color":"#FFFFFF","line_spacing":16,"word_spacing":12,"padding_horizontal":70,"text_transform":"uppercase","letter_spacing":0},
  "shadow":{"enable":true,"color":"#000000","opacity":160,"blur":8,"alpha_multiplier":0.3,"offset_y":2},
  "glow":{"enable":false},
  "outline":{"enable":false},
  "keyword":{"underline":{"color":"#FFFFFF","opacity":0,"thickness":0,"offset_y":0},"background":{"enable":true,"color":"#E84545","opacity":220,"padding_x":10,"padding_y":5,"border_radius":8},"scale":1.0},
  "position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},
  "box":{"enable":false,"color":"#000000","opacity":0,"padding":0,"border_radius":0,"border_color":"","border_width":0},
  "animation":{"fade_in":0.35,"fade_out":0.3,"type":"slide_up","scale_from":0.8,"slide_distance":40}
}', 1),

-- ─── Outlined Bold ──────────────────────────────────────────────────────────
-- Thick white outline on all text. Bounce animation.
('Outlined Bold', '{
  "text":{"fontfile":"","fallback_font":"Bebas Neue","font_size_normal":54,"font_size_keyword":86,"color":"#FFFFFF","keyword_color":"#FFD700","line_spacing":10,"word_spacing":8,"padding_horizontal":50,"text_transform":"uppercase","letter_spacing":1},
  "shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},
  "glow":{"enable":false},
  "outline":{"enable":true,"color":"#000000","width":3,"keyword_only":false},
  "keyword":{"underline":{"color":"#FFD700","opacity":200,"thickness":4,"offset_y":8},"background":{"enable":false},"scale":1.0},
  "position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},
  "box":{"enable":false,"color":"#000000","opacity":0,"padding":0,"border_radius":0,"border_color":"","border_width":0},
  "animation":{"fade_in":0.3,"fade_out":0.25,"type":"bounce","scale_from":0.8,"slide_distance":0}
}', 1),

-- ─── Glass Card ─────────────────────────────────────────────────────────────
-- Frosted glass box with rounded corners and border. Fade animation.
('Glass Card', '{
  "text":{"fontfile":"","fallback_font":"Montserrat Bold","font_size_normal":42,"font_size_keyword":66,"color":"#FFFFFF","keyword_color":"#A78BFA","line_spacing":16,"word_spacing":10,"padding_horizontal":60,"text_transform":"capitalize","letter_spacing":0},
  "shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},
  "glow":{"enable":true,"color":"#A78BFA","opacity":100,"radius":6,"keyword_only":true},
  "outline":{"enable":false},
  "keyword":{"underline":{"color":"#A78BFA","opacity":180,"thickness":2,"offset_y":6},"background":{"enable":false},"scale":1.0},
  "position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},
  "box":{"enable":true,"color":"#1E1B4B","opacity":200,"padding":28,"border_radius":16,"border_color":"#A78BFA","border_width":2},
  "animation":{"fade_in":0.4,"fade_out":0.4,"type":"fade","scale_from":0.8,"slide_distance":0}
}', 1),

-- ─── Fire Keyword ───────────────────────────────────────────────────────────
-- Keywords glow orange/red like fire. Strong shadow.
('Fire Keyword', '{
  "text":{"fontfile":"","fallback_font":"Anton","font_size_normal":48,"font_size_keyword":78,"color":"#FFF5EB","keyword_color":"#FF6B35","line_spacing":12,"word_spacing":10,"padding_horizontal":55,"text_transform":"uppercase","letter_spacing":1},
  "shadow":{"enable":true,"color":"#3D0000","opacity":220,"blur":14,"alpha_multiplier":0.5,"offset_y":4},
  "glow":{"enable":true,"color":"#FF6B35","opacity":180,"radius":12,"keyword_only":true},
  "outline":{"enable":false},
  "keyword":{"underline":{"color":"#FF6B35","opacity":0,"thickness":0,"offset_y":0},"background":{"enable":false},"scale":1.1},
  "position":{"x":"(w-text_w)/2","y":"h*0.65"},
  "box":{"enable":false,"color":"#000000","opacity":0,"padding":0,"border_radius":0,"border_color":"","border_width":0},
  "animation":{"fade_in":0.25,"fade_out":0.3,"type":"scale_up","scale_from":0.9,"slide_distance":0}
}', 1),

-- ─── Typewriter ─────────────────────────────────────────────────────────────
-- Clean monospace look with typewriter reveal animation.
('Typewriter', '{
  "text":{"fontfile":"","fallback_font":"Inter Bold","font_size_normal":44,"font_size_keyword":70,"color":"#E8E8E8","keyword_color":"#4ADE80","line_spacing":14,"word_spacing":10,"padding_horizontal":65,"text_transform":"none","letter_spacing":1},
  "shadow":{"enable":true,"color":"#000000","opacity":180,"blur":6,"alpha_multiplier":0.3,"offset_y":2},
  "glow":{"enable":false},
  "outline":{"enable":false},
  "keyword":{"underline":{"color":"#4ADE80","opacity":200,"thickness":3,"offset_y":7},"background":{"enable":false},"scale":1.0},
  "position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},
  "box":{"enable":true,"color":"#0D1117","opacity":230,"padding":24,"border_radius":12,"border_color":"#30363D","border_width":1},
  "animation":{"fade_in":0.5,"fade_out":0.3,"type":"typewriter","scale_from":0.8,"slide_distance":0}
}', 1);

-- Verify new styles
SELECT id, name, 
       JSON_EXTRACT(config, '$.animation.type') AS anim_type,
       JSON_EXTRACT(config, '$.glow.enable') AS has_glow,
       JSON_EXTRACT(config, '$.outline.enable') AS has_outline,
       JSON_EXTRACT(config, '$.keyword.background.enable') AS has_keyword_bg
FROM hook_styles 
WHERE id > 20
ORDER BY id;
