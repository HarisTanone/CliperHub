-- ═══════════════════════════════════════════════════════════════════════════════
-- Hook Styles v3 — Fresh redesign
-- Hapus semua data lama, isi dengan 20 style baru yang:
--   ✓ Font besar & terbaca di semua device (normal ≥44, keyword ≥68)
--   ✓ Warna elegan, tidak norak
--   ✓ Setiap style benar-benar berbeda (size, posisi, efek, karakter)
-- ═══════════════════════════════════════════════════════════════════════════════

USE autocliper;

-- Kosongkan tabel (reset auto_increment)
TRUNCATE TABLE hook_styles;

INSERT INTO hook_styles (name, config, is_active) VALUES

-- ─── 1. Clean White Center ──────────────────────────────────────────────────
-- Minimalis, putih bersih, shadow halus. Keyword sedikit lebih besar.
('Clean White', '{"text":{"fontfile":"","fallback_font":"Anton","font_size_normal":48,"font_size_keyword":72,"color":"#FFFFFF","keyword_color":"#FFFFFF","line_spacing":14,"word_spacing":12,"padding_horizontal":70},"shadow":{"enable":true,"color":"#000000","opacity":180,"blur":10,"alpha_multiplier":0.35,"offset_y":3},"keyword":{"underline":{"color":"#FFFFFF","opacity":160,"thickness":3,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.4,"fade_out":0.4}}', 1),

-- ─── 2. Warm Cream ──────────────────────────────────────────────────────────
-- Tone hangat krem, posisi agak atas. Keyword gold gelap.
('Warm Cream', '{"text":{"fontfile":"","fallback_font":"Montserrat Bold","font_size_normal":46,"font_size_keyword":70,"color":"#FFF8F0","keyword_color":"#D4A574","line_spacing":16,"word_spacing":10,"padding_horizontal":80},"shadow":{"enable":true,"color":"#3D2B1F","opacity":160,"blur":8,"alpha_multiplier":0.3,"offset_y":3},"keyword":{"underline":{"color":"#D4A574","opacity":180,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"h*0.35"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.5,"fade_out":0.4}}', 1),

-- ─── 3. Deep Navy ───────────────────────────────────────────────────────────
-- Background box navy gelap, teks putih terang. Keyword biru muda.
('Deep Navy', '{"text":{"fontfile":"","fallback_font":"Poppins Bold","font_size_normal":44,"font_size_keyword":68,"color":"#F0F4FF","keyword_color":"#7EB8FF","line_spacing":14,"word_spacing":10,"padding_horizontal":60},"shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},"keyword":{"underline":{"color":"#7EB8FF","opacity":200,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":true,"color":"#0F1B2D","opacity":220,"padding":24},"animation":{"fade_in":0.35,"fade_out":0.35}}', 1),

-- ─── 4. Coral Accent ────────────────────────────────────────────────────────
-- Putih dengan keyword coral/salmon. Posisi lower area.
('Coral Accent', '{"text":{"fontfile":"","fallback_font":"Bebas Neue","font_size_normal":52,"font_size_keyword":80,"color":"#FFFFFF","keyword_color":"#FF7F6B","line_spacing":12,"word_spacing":10,"padding_horizontal":55},"shadow":{"enable":true,"color":"#000000","opacity":200,"blur":14,"alpha_multiplier":0.4,"offset_y":4},"keyword":{"underline":{"color":"#FF7F6B","opacity":220,"thickness":4,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"h*0.72"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.25,"fade_out":0.3}}', 1),

-- ─── 5. Sage Green ──────────────────────────────────────────────────────────
-- Nuansa hijau sage yang tenang. Box semi-transparan.
('Sage Green', '{"text":{"fontfile":"","fallback_font":"Montserrat Bold","font_size_normal":46,"font_size_keyword":72,"color":"#F5FAF5","keyword_color":"#8FBF8F","line_spacing":14,"word_spacing":11,"padding_horizontal":65},"shadow":{"enable":true,"color":"#1A3A1A","opacity":140,"blur":6,"alpha_multiplier":0.25,"offset_y":2},"keyword":{"underline":{"color":"#8FBF8F","opacity":180,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":true,"color":"#1A2E1A","opacity":140,"padding":20},"animation":{"fade_in":0.4,"fade_out":0.45}}', 1),

-- ─── 6. Bold Impact ─────────────────────────────────────────────────────────
-- Font sangat besar, tebal, tanpa underline. Pure impact visual.
('Bold Impact', '{"text":{"fontfile":"","fallback_font":"Anton","font_size_normal":56,"font_size_keyword":88,"color":"#FFFFFF","keyword_color":"#FFFFFF","line_spacing":10,"word_spacing":8,"padding_horizontal":50},"shadow":{"enable":true,"color":"#000000","opacity":240,"blur":4,"alpha_multiplier":0.6,"offset_y":4},"keyword":{"underline":{"color":"#FFFFFF","opacity":0,"thickness":0,"offset_y":0}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.2,"fade_out":0.25}}', 1),

-- ─── 7. Lavender Soft ───────────────────────────────────────────────────────
-- Lembut, feminin, warna lavender. Posisi center-atas.
('Lavender Soft', '{"text":{"fontfile":"","fallback_font":"Poppins Bold","font_size_normal":44,"font_size_keyword":70,"color":"#F8F0FF","keyword_color":"#B388FF","line_spacing":16,"word_spacing":11,"padding_horizontal":75},"shadow":{"enable":true,"color":"#2D1B4E","opacity":150,"blur":10,"alpha_multiplier":0.3,"offset_y":3},"keyword":{"underline":{"color":"#B388FF","opacity":180,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"h*0.38"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.45,"fade_out":0.45}}', 1),

-- ─── 8. Charcoal Slate ──────────────────────────────────────────────────────
-- Dark mode elegan. Box abu gelap, teks terang. Keyword kuning lembut.
('Charcoal Slate', '{"text":{"fontfile":"","fallback_font":"Inter Bold","font_size_normal":46,"font_size_keyword":72,"color":"#E8E8E8","keyword_color":"#FFD98C","line_spacing":14,"word_spacing":10,"padding_horizontal":65},"shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},"keyword":{"underline":{"color":"#FFD98C","opacity":180,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":true,"color":"#1E1E24","opacity":235,"padding":22},"animation":{"fade_in":0.35,"fade_out":0.35}}', 1),

-- ─── 9. Sunset Gradient ─────────────────────────────────────────────────────
-- Warna sunset warm. Keyword oranye keemasan. Shadow warm.
('Sunset Warm', '{"text":{"fontfile":"","fallback_font":"Bebas Neue","font_size_normal":50,"font_size_keyword":78,"color":"#FFF5EB","keyword_color":"#FF9F43","line_spacing":12,"word_spacing":9,"padding_horizontal":58},"shadow":{"enable":true,"color":"#5C2800","opacity":180,"blur":12,"alpha_multiplier":0.4,"offset_y":4},"keyword":{"underline":{"color":"#FF9F43","opacity":200,"thickness":4,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"h*0.68"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.3,"fade_out":0.35}}', 1),

-- ─── 10. Minimal Left ───────────────────────────────────────────────────────
-- Left-aligned, minimalis. Keyword putih tebal, normal abu terang.
('Minimal Left', '{"text":{"fontfile":"","fallback_font":"Anton","font_size_normal":44,"font_size_keyword":74,"color":"#CCCCCC","keyword_color":"#FFFFFF","line_spacing":14,"word_spacing":10,"padding_horizontal":50},"shadow":{"enable":true,"color":"#000000","opacity":200,"blur":8,"alpha_multiplier":0.35,"offset_y":3},"keyword":{"underline":{"color":"#FFFFFF","opacity":140,"thickness":2,"offset_y":7}},"position":{"x":"w*0.08","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.3,"fade_out":0.3}}', 1),

-- ─── 11. Ocean Teal ─────────────────────────────────────────────────────────
-- Nuansa laut, teal keyword. Posisi center.
('Ocean Teal', '{"text":{"fontfile":"","fallback_font":"Montserrat Bold","font_size_normal":48,"font_size_keyword":74,"color":"#F0FFFF","keyword_color":"#4DD9C0","line_spacing":14,"word_spacing":11,"padding_horizontal":68},"shadow":{"enable":true,"color":"#0A3D3D","opacity":170,"blur":10,"alpha_multiplier":0.35,"offset_y":3},"keyword":{"underline":{"color":"#4DD9C0","opacity":200,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.4,"fade_out":0.4}}', 1),

-- ─── 12. Frosted Card ───────────────────────────────────────────────────────
-- Efek frosted glass card. Box putih semi-transparan, teks gelap.
('Frosted Card', '{"text":{"fontfile":"","fallback_font":"Poppins Bold","font_size_normal":44,"font_size_keyword":70,"color":"#1A1A2E","keyword_color":"#0F3460","line_spacing":16,"word_spacing":10,"padding_horizontal":60},"shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},"keyword":{"underline":{"color":"#0F3460","opacity":200,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":true,"color":"#FFFFFF","opacity":200,"padding":26},"animation":{"fade_in":0.35,"fade_out":0.4}}', 1),

-- ─── 13. Ember Red ──────────────────────────────────────────────────────────
-- Keyword merah bara yang elegan (bukan norak). Shadow deep.
('Ember Red', '{"text":{"fontfile":"","fallback_font":"Bebas Neue","font_size_normal":50,"font_size_keyword":80,"color":"#FFFFFF","keyword_color":"#E84545","line_spacing":12,"word_spacing":9,"padding_horizontal":55},"shadow":{"enable":true,"color":"#3D0000","opacity":200,"blur":16,"alpha_multiplier":0.45,"offset_y":4},"keyword":{"underline":{"color":"#E84545","opacity":220,"thickness":4,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.2,"fade_out":0.3}}', 1),

-- ─── 14. Muted Earth ────────────────────────────────────────────────────────
-- Tone bumi, earthy. Box coklat gelap, teks krem.
('Muted Earth', '{"text":{"fontfile":"","fallback_font":"Inter Bold","font_size_normal":46,"font_size_keyword":72,"color":"#F5EDE3","keyword_color":"#C9956B","line_spacing":14,"word_spacing":10,"padding_horizontal":65},"shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},"keyword":{"underline":{"color":"#C9956B","opacity":180,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"h*0.4"},"box":{"enable":true,"color":"#2C1810","opacity":220,"padding":22},"animation":{"fade_in":0.4,"fade_out":0.4}}', 1),

-- ─── 15. Electric Blue ──────────────────────────────────────────────────────
-- Biru elektrik yang bold. Tanpa box, shadow kuat.
('Electric Blue', '{"text":{"fontfile":"","fallback_font":"Anton","font_size_normal":52,"font_size_keyword":82,"color":"#FFFFFF","keyword_color":"#4FACFE","line_spacing":12,"word_spacing":10,"padding_horizontal":55},"shadow":{"enable":true,"color":"#003366","opacity":220,"blur":14,"alpha_multiplier":0.45,"offset_y":4},"keyword":{"underline":{"color":"#4FACFE","opacity":220,"thickness":4,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"h*0.65"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.25,"fade_out":0.3}}', 1),

-- ─── 16. Paper White ────────────────────────────────────────────────────────
-- Seperti kertas. Box putih bersih, teks hitam. Keyword abu gelap.
('Paper White', '{"text":{"fontfile":"","fallback_font":"Montserrat Bold","font_size_normal":44,"font_size_keyword":70,"color":"#1A1A1A","keyword_color":"#333333","line_spacing":16,"word_spacing":10,"padding_horizontal":70},"shadow":{"enable":false,"color":"#000000","opacity":0,"blur":0,"alpha_multiplier":0,"offset_y":0},"keyword":{"underline":{"color":"#1A1A1A","opacity":220,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":true,"color":"#FAFAFA","opacity":245,"padding":28},"animation":{"fade_in":0.35,"fade_out":0.35}}', 1),

-- ─── 17. Midnight Gold ──────────────────────────────────────────────────────
-- Mewah. Hitam pekat dengan aksen emas.
('Midnight Gold', '{"text":{"fontfile":"","fallback_font":"Bebas Neue","font_size_normal":48,"font_size_keyword":76,"color":"#E8DCC8","keyword_color":"#D4AF37","line_spacing":14,"word_spacing":10,"padding_horizontal":62},"shadow":{"enable":true,"color":"#000000","opacity":200,"blur":10,"alpha_multiplier":0.4,"offset_y":3},"keyword":{"underline":{"color":"#D4AF37","opacity":200,"thickness":4,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.4,"fade_out":0.4}}', 1),

-- ─── 18. Soft Pink ──────────────────────────────────────────────────────────
-- Lembut pink, cocok untuk konten lifestyle. Posisi atas.
('Soft Pink', '{"text":{"fontfile":"","fallback_font":"Poppins Bold","font_size_normal":44,"font_size_keyword":70,"color":"#FFF0F5","keyword_color":"#E88CA5","line_spacing":16,"word_spacing":11,"padding_horizontal":72},"shadow":{"enable":true,"color":"#4A1028","opacity":140,"blur":8,"alpha_multiplier":0.25,"offset_y":2},"keyword":{"underline":{"color":"#E88CA5","opacity":180,"thickness":3,"offset_y":7}},"position":{"x":"(w-text_w)/2","y":"h*0.32"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.45,"fade_out":0.45}}', 1),

-- ─── 19. Concrete Bold ──────────────────────────────────────────────────────
-- Industrial, tebal, abu-abu beton. Keyword putih murni.
('Concrete Bold', '{"text":{"fontfile":"","fallback_font":"Anton","font_size_normal":54,"font_size_keyword":84,"color":"#B0B0B0","keyword_color":"#FFFFFF","line_spacing":10,"word_spacing":8,"padding_horizontal":48},"shadow":{"enable":true,"color":"#000000","opacity":220,"blur":6,"alpha_multiplier":0.5,"offset_y":4},"keyword":{"underline":{"color":"#FFFFFF","opacity":0,"thickness":0,"offset_y":0}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.2,"fade_out":0.25}}', 1),

-- ─── 20. Amber Glow ─────────────────────────────────────────────────────────
-- Warm amber glow. Shadow amber. Lower-third position.
('Amber Glow', '{"text":{"fontfile":"","fallback_font":"Bebas Neue","font_size_normal":50,"font_size_keyword":78,"color":"#FFFAF0","keyword_color":"#FFBF47","line_spacing":12,"word_spacing":9,"padding_horizontal":55},"shadow":{"enable":true,"color":"#6B3A00","opacity":190,"blur":14,"alpha_multiplier":0.4,"offset_y":4},"keyword":{"underline":{"color":"#FFBF47","opacity":200,"thickness":4,"offset_y":8}},"position":{"x":"(w-text_w)/2","y":"h*0.7"},"box":{"enable":false,"color":"#000000","opacity":0,"padding":0},"animation":{"fade_in":0.3,"fade_out":0.35}}', 1);

-- Verifikasi
SELECT id, name, 
       JSON_EXTRACT(config, '$.text.font_size_normal') AS size_normal,
       JSON_EXTRACT(config, '$.text.font_size_keyword') AS size_keyword,
       JSON_EXTRACT(config, '$.position.y') AS pos_y
FROM hook_styles 
ORDER BY id;
