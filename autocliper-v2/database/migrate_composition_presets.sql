-- ============================================================================
-- Migration: Composition-Based Hook Presets
-- Date: 2026-06-10
-- Description: Tambah hook template presets yang menggunakan composition model
--              (multi-line, badge, stagger animations, particles, flash, etc.)
--              Menggunakan table remotion_hook_templates yang sudah ada.
--              Data baru di kolom `config` JSON — no schema change.
-- ============================================================================

USE autocliper;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPOSITION HOOK PRESETS (menggunakan config.text.lines[] untuk multi-line)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO remotion_hook_templates
  (name, description, category, remotion_component,
   font_family, font_weight, font_size_normal, font_size_keyword,
   text_transform, color, keyword_color,
   shadow_enabled, shadow_color, shadow_blur, shadow_offset_y,
   glow_enabled, glow_color, glow_radius, glow_keyword_only,
   outline_enabled, outline_color, outline_width,
   gradient_enabled, gradient_colors, gradient_direction,
   keyword_underline_enabled, keyword_underline_color, keyword_underline_thickness,
   keyword_bg_enabled, keyword_bg_color, keyword_bg_opacity, keyword_bg_padding_x, keyword_bg_padding_y, keyword_bg_border_radius,
   box_enabled, box_color, box_opacity, box_padding, box_border_radius,
   animation_type, animation_in_duration, display_duration_seconds, delay_before_seconds,
   position_x, position_y, position_y_offset,
   is_default, sort_order, config)
VALUES

-- ═══════════════════════════════════════════════════════════════════════════════
-- CP1. TikTok Viral Drama — Setara cek.jsx
-- Badge pink + 3 lines (putih/kuning/pink) + slam stagger + divider + emoji + particles
-- ═══════════════════════════════════════════════════════════════════════════════
('TikTok Viral Drama',
 'Style viral TikTok dengan badge, 3 baris warna berbeda, animasi slam stagger, divider gradient, emoji row, dan particle effects. Setara kualitas cek.jsx.',
 'viral', 'HookOverlay',
 'Bebas Neue', '900', 46, 52,
 'uppercase', '#FFFFFF', '#FDE68A',
 1, '#000000', 14, 3,
 0, '#FFFFFF', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 0, '#FFFFFF', 0,
 0, '#000000', 0, 0, 0, 0,
 0, '#000000', 0, 0, 0,
 'fade', 300, 4.0, 0.3,
 'center', 'top', 0,
 0, 20,
 '{"schema_version":1,"text":{"lines":[{"text":"KEPUTUSAN","color":"#FFFFFF","font_size":46,"font":"Bebas Neue","font_weight":"900","letter_spacing":1},{"text":"ORANG TUA","color":"#FDE68A","font_size":52,"font":"Bebas Neue","font_weight":"900","letter_spacing":0},{"text":"MENGEJUTKAN","color":"#F0ABFC","font_size":34,"font":"Bebas Neue","font_weight":"900","letter_spacing":4}]},"badge":{"enable":true,"text":"CERITA NYATA 🔥","bg_color":"#EA449A","font_size":10,"font_family":"Montserrat","letter_spacing":2,"animation":{"type":"slide_left","delay":0.15,"duration":0.4}},"animation":{"type":"stagger_composition","per_line":[{"type":"slam_left","delay":0.35,"easing":"backOut","idle":null,"idle_delay":0},{"type":"slam_right","delay":0.58,"easing":"backOut","idle":null,"idle_delay":0},{"type":"scale_rotate","delay":0.82,"easing":"backOut","idle":"shake","idle_delay":0.73}]},"decorations":{"divider":{"enable":true,"colors":["#f472b6","#c084fc","transparent"],"width":180,"delay":1.1},"emoji_row":{"enable":true,"emojis":["😱","💔","😭"],"delay":1.25}},"effects":{"flash":{"enable":true,"color":"rgba(192,132,252,0.3)","delay":0.25,"duration":0.55},"particles":{"enable":true,"count":8,"colors":["#f472b6","#c084fc","#818cf8","#fde68a"],"size_range":[3,5]}},"overlay":{"gradient_top":{"enable":true,"color":"rgba(80,10,120,0.5)","height_percent":40},"gradient_bottom":{"enable":true,"color":"rgba(0,0,0,0.85)","height_percent":35}},"position":{"anchor":"top","offset_y":0,"offset_x":0},"safe_area":{"override":false,"top_percent":10,"bottom_percent":20,"side_percent":10}}'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- CP2. MrBeast Impact — Bold kuning + pop animasi + flash
-- Badge merah + 2 lines besar + pop stagger + flash
-- ═══════════════════════════════════════════════════════════════════════════════
('MrBeast Impact',
 'Style tebal dan impactful seperti MrBeast thumbnails. Kuning + putih bold, pop animation, flash merah.',
 'hype', 'HookOverlay',
 'Anton', '400', 48, 64,
 'uppercase', '#FFFFFF', '#FFD700',
 1, '#000000', 16, 4,
 0, '#FFFFFF', 0, 1,
 1, '#000000', 4,
 0, NULL, 'to right',
 0, '#FFFFFF', 0,
 0, '#000000', 0, 0, 0, 0,
 0, '#000000', 0, 0, 0,
 'fade', 300, 3.5, 0.3,
 'center', 'center', 0,
 0, 21,
 '{"schema_version":1,"text":{"lines":[{"text":"YOU WON''T","color":"#FFFFFF","font_size":48,"font":"Anton","font_weight":"900","letter_spacing":2},{"text":"BELIEVE THIS","color":"#FFD700","font_size":64,"font":"Anton","font_weight":"900","letter_spacing":0}]},"badge":{"enable":true,"text":"SHOCKING 🤯","bg_color":"#FF3B30","font_size":11,"font_family":"Montserrat","letter_spacing":3,"animation":{"type":"pop","delay":0.1,"duration":0.3}},"animation":{"type":"stagger_composition","per_line":[{"type":"pop","delay":0.35,"easing":"backOut","idle":null,"idle_delay":0},{"type":"pop","delay":0.6,"easing":"bounce","idle":"pulse","idle_delay":0.5}]},"decorations":{"divider":{"enable":false,"colors":[],"width":0,"delay":0},"emoji_row":{"enable":true,"emojis":["🤯","💰","🔥"],"delay":1.0}},"effects":{"flash":{"enable":true,"color":"rgba(255,59,48,0.25)","delay":0.2,"duration":0.4},"particles":{"enable":false,"count":0,"colors":[],"size_range":[0,0]}},"overlay":{"gradient_top":{"enable":false,"color":"","height_percent":10},"gradient_bottom":{"enable":true,"color":"rgba(0,0,0,0.75)","height_percent":30}},"position":{"anchor":"center","offset_y":-20,"offset_x":0},"safe_area":{"override":false,"top_percent":10,"bottom_percent":20,"side_percent":10}}'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- CP3. Aesthetic Pastel — Soft pink/ungu/biru + slide_up halus
-- No badge, 3 lines pastel, smooth slide_up, particles lembut
-- ═══════════════════════════════════════════════════════════════════════════════
('Aesthetic Pastel',
 'Style lembut dan estetik dengan warna pastel (pink, ungu, biru). Animasi slide up smooth. Cocok untuk konten beauty, lifestyle, self-care.',
 'aesthetic', 'HookOverlay',
 'Poppins', '700', 36, 48,
 'none', '#FFC0CB', '#C8A2C8',
 1, '#000000', 8, 2,
 0, '#FFFFFF', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 0, '#FFFFFF', 0,
 0, '#000000', 0, 0, 0, 0,
 0, '#000000', 0, 0, 0,
 'fade', 300, 4.0, 0.5,
 'center', 'center', 0,
 0, 22,
 '{"schema_version":1,"text":{"lines":[{"text":"self care itu","color":"#FFB6C1","font_size":32,"font":"Poppins","font_weight":"600","letter_spacing":1},{"text":"bukan egois","color":"#C8A2C8","font_size":44,"font":"Poppins","font_weight":"700","letter_spacing":0},{"text":"tapi kebutuhan 💜","color":"#87CEEB","font_size":28,"font":"Poppins","font_weight":"500","letter_spacing":1}]},"badge":{"enable":false,"text":"","bg_color":"","font_size":10,"font_family":"Poppins","letter_spacing":2},"animation":{"type":"stagger_composition","per_line":[{"type":"slide_up","delay":0.4,"easing":"easeOut","idle":null,"idle_delay":0},{"type":"slide_up","delay":0.7,"easing":"easeOut","idle":null,"idle_delay":0},{"type":"slide_up","delay":1.0,"easing":"easeOut","idle":"pulse","idle_delay":1.0}]},"decorations":{"divider":{"enable":true,"colors":["#FFB6C1","#C8A2C8","transparent"],"width":140,"delay":1.3},"emoji_row":{"enable":false,"emojis":[],"delay":0}},"effects":{"flash":{"enable":false,"color":"","delay":0,"duration":0},"particles":{"enable":true,"count":6,"colors":["#FFB6C1","#C8A2C8","#87CEEB","#FFDAB9"],"size_range":[2,4]}},"overlay":{"gradient_top":{"enable":true,"color":"rgba(255,182,193,0.2)","height_percent":30},"gradient_bottom":{"enable":true,"color":"rgba(0,0,0,0.6)","height_percent":25}},"position":{"anchor":"center","offset_y":0,"offset_x":0},"safe_area":{"override":false,"top_percent":10,"bottom_percent":20,"side_percent":10}}'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- CP4. Gaming Neon — Hijau neon + outline tebal + glitch feel
-- Badge neon + 2 lines besar + scale_rotate
-- ═══════════════════════════════════════════════════════════════════════════════
('Gaming Neon',
 'Neon hijau terang dengan outline hitam tebal. Feel gaming/esports. Badge toxicgreen, animasi energetik.',
 'gaming', 'HookOverlay',
 'Bebas Neue', '400', 40, 58,
 'uppercase', '#00FF88', '#FFFFFF',
 1, '#000000', 12, 3,
 1, '#00FF88', 10, 0,
 1, '#000000', 3,
 0, NULL, 'to right',
 0, '#00FF88', 0,
 0, '#000000', 0, 0, 0, 0,
 0, '#000000', 0, 0, 0,
 'fade', 300, 3.5, 0.3,
 'center', 'center', 0,
 0, 23,
 '{"schema_version":1,"text":{"lines":[{"text":"NO WAY","color":"#00FF88","font_size":56,"font":"Bebas Neue","font_weight":"900","letter_spacing":3},{"text":"THIS IS REAL","color":"#FFFFFF","font_size":40,"font":"Bebas Neue","font_weight":"900","letter_spacing":1}]},"badge":{"enable":true,"text":"INSANE PLAY 🎮","bg_color":"#00CC66","font_size":9,"font_family":"Montserrat","letter_spacing":2,"animation":{"type":"scale_rotate","delay":0.1,"duration":0.35}},"animation":{"type":"stagger_composition","per_line":[{"type":"scale_rotate","delay":0.3,"easing":"backOut","idle":"shake","idle_delay":0.4},{"type":"slam_right","delay":0.55,"easing":"backOut","idle":null,"idle_delay":0}]},"decorations":{"divider":{"enable":false,"colors":[],"width":0,"delay":0},"emoji_row":{"enable":true,"emojis":["🎮","⚡","🏆"],"delay":0.9}},"effects":{"flash":{"enable":true,"color":"rgba(0,255,136,0.2)","delay":0.15,"duration":0.35},"particles":{"enable":true,"count":10,"colors":["#00FF88","#00CC66","#88FFB8","#FFFFFF"],"size_range":[2,5]}},"overlay":{"gradient_top":{"enable":false,"color":"","height_percent":10},"gradient_bottom":{"enable":true,"color":"rgba(0,20,10,0.8)","height_percent":30}},"position":{"anchor":"center","offset_y":0,"offset_x":0},"safe_area":{"override":false,"top_percent":10,"bottom_percent":20,"side_percent":10}}'),

-- ═══════════════════════════════════════════════════════════════════════════════
-- CP5. Educational Clean — Biru + putih professional + no effects
-- Badge biru, 2 lines clean, fade halus, no particles/flash
-- ═══════════════════════════════════════════════════════════════════════════════
('Educational Clean',
 'Style bersih dan professional untuk konten edukasi. Biru + putih, badge informatif, tanpa efek berlebihan. Mudah dibaca.',
 'edu', 'HookOverlay',
 'Inter', '700', 34, 48,
 'none', '#FFFFFF', '#3B82F6',
 1, '#000000', 6, 2,
 0, '#FFFFFF', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 0, '#FFFFFF', 0,
 0, '#000000', 0, 0, 0, 0,
 0, '#000000', 0, 0, 0,
 'fade', 300, 4.5, 0.5,
 'center', 'top', 0,
 0, 24,
 '{"schema_version":1,"text":{"lines":[{"text":"Tahukah kamu?","color":"#E0E7FF","font_size":30,"font":"Inter","font_weight":"500","letter_spacing":0},{"text":"Fakta Menarik","color":"#FFFFFF","font_size":44,"font":"Inter","font_weight":"800","letter_spacing":0},{"text":"yang jarang diketahui","color":"#93C5FD","font_size":26,"font":"Inter","font_weight":"400","letter_spacing":0}]},"badge":{"enable":true,"text":"INFO 📚","bg_color":"#3B82F6","font_size":10,"font_family":"Inter","letter_spacing":2,"animation":{"type":"fade","delay":0.2,"duration":0.5}},"animation":{"type":"stagger_composition","per_line":[{"type":"fade","delay":0.4,"easing":"easeOut","idle":null,"idle_delay":0},{"type":"slide_up","delay":0.7,"easing":"easeOut","idle":null,"idle_delay":0},{"type":"fade","delay":1.0,"easing":"easeOut","idle":null,"idle_delay":0}]},"decorations":{"divider":{"enable":true,"colors":["#3B82F6","#93C5FD","transparent"],"width":160,"delay":1.2},"emoji_row":{"enable":false,"emojis":[],"delay":0}},"effects":{"flash":{"enable":false,"color":"","delay":0,"duration":0},"particles":{"enable":false,"count":0,"colors":[],"size_range":[0,0]}},"overlay":{"gradient_top":{"enable":false,"color":"","height_percent":10},"gradient_bottom":{"enable":true,"color":"rgba(0,0,0,0.65)","height_percent":25}},"position":{"anchor":"top","offset_y":10,"offset_x":0},"safe_area":{"override":false,"top_percent":10,"bottom_percent":20,"side_percent":10}}')

ON DUPLICATE KEY UPDATE name=name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
