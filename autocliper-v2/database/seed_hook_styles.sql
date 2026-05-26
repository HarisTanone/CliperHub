-- ============================================================
--  Hook Styles Seed — 10 styles variatif
--  Jalankan: mysql -u user -p autocliper < database/seed_hook_styles.sql
-- ============================================================
USE autocliper;

-- Hapus data lama (opsional, comment jika ingin append)
DELETE FROM hook_styles;

INSERT INTO hook_styles (name, config, is_active) VALUES

-- ────────────────────────────────────────────────────────────
-- 1. Elegant Gold
--    Teks abu terang, keyword emas, shadow halus, fade smooth
-- ────────────────────────────────────────────────────────────
('Elegant Gold', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Anton',
    'font_size_normal', 52,
    'font_size_keyword', 72,
    'color', '#E8E8E8',
    'keyword_color', '#FFD700',
    'line_spacing', 14,
    'word_spacing', 14,
    'padding_horizontal', 80
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#000000',
    'opacity', 180,
    'blur', 10,
    'alpha_multiplier', 0.35,
    'offset_y', 4
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#FFD700',
      'opacity', 200,
      'thickness', 4,
      'offset_y', 6
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.4, 'fade_out', 0.4)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 2. Neon Red Alert
--    Teks putih bersih, keyword merah neon menyala, shadow tebal
--    Cocok untuk konten shocking / berita viral
-- ────────────────────────────────────────────────────────────
('Neon Red Alert', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Bebas Neue',
    'font_size_normal', 56,
    'font_size_keyword', 80,
    'color', '#FFFFFF',
    'keyword_color', '#FF2D2D',
    'line_spacing', 12,
    'word_spacing', 10,
    'padding_horizontal', 60
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#8B0000',
    'opacity', 220,
    'blur', 16,
    'alpha_multiplier', 0.45,
    'offset_y', 5
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#FF2D2D',
      'opacity', 255,
      'thickness', 5,
      'offset_y', 7
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.2, 'fade_out', 0.3)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 3. Ice Blue Minimal
--    Teks putih dingin, keyword biru es, shadow tipis
--    Cocok untuk konten tech / edukasi / clean aesthetic
-- ────────────────────────────────────────────────────────────
('Ice Blue Minimal', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Montserrat Bold',
    'font_size_normal', 44,
    'font_size_keyword', 62,
    'color', '#F0F8FF',
    'keyword_color', '#00BFFF',
    'line_spacing', 16,
    'word_spacing', 16,
    'padding_horizontal', 100
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#001F3F',
    'opacity', 160,
    'blur', 8,
    'alpha_multiplier', 0.25,
    'offset_y', 3
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#00BFFF',
      'opacity', 180,
      'thickness', 3,
      'offset_y', 8
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.5, 'fade_out', 0.5)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 4. Dark Box Bold
--    Teks putih di atas kotak hitam semi-transparan
--    Keyword kuning, mudah dibaca di background apapun
-- ────────────────────────────────────────────────────────────
('Dark Box Bold', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Anton',
    'font_size_normal', 50,
    'font_size_keyword', 68,
    'color', '#FFFFFF',
    'keyword_color', '#FFE033',
    'line_spacing', 12,
    'word_spacing', 12,
    'padding_horizontal', 60
  ),
  'shadow', JSON_OBJECT(
    'enable', FALSE,
    'color', '#000000',
    'opacity', 0,
    'blur', 0,
    'alpha_multiplier', 0.0,
    'offset_y', 0
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#FFE033',
      'opacity', 220,
      'thickness', 4,
      'offset_y', 6
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', TRUE, 'color', '#000000', 'opacity', 160, 'padding', 20),
  'animation', JSON_OBJECT('fade_in', 0.3, 'fade_out', 0.3)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 5. Toxic Green
--    Teks putih, keyword hijau neon, shadow gelap
--    Cocok untuk konten gaming / hype / challenge
-- ────────────────────────────────────────────────────────────
('Toxic Green', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Bebas Neue',
    'font_size_normal', 54,
    'font_size_keyword', 76,
    'color', '#FFFFFF',
    'keyword_color', '#39FF14',
    'line_spacing', 10,
    'word_spacing', 10,
    'padding_horizontal', 60
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#003300',
    'opacity', 200,
    'blur', 14,
    'alpha_multiplier', 0.4,
    'offset_y', 4
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#39FF14',
      'opacity', 255,
      'thickness', 5,
      'offset_y', 7
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.2, 'fade_out', 0.2)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 6. Warm Orange
--    Teks krem hangat, keyword oranye terang
--    Cocok untuk konten lifestyle / motivasi / food
-- ────────────────────────────────────────────────────────────
('Warm Orange', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Poppins Bold',
    'font_size_normal', 46,
    'font_size_keyword', 64,
    'color', '#FFF5E4',
    'keyword_color', '#FF6B00',
    'line_spacing', 14,
    'word_spacing', 14,
    'padding_horizontal', 80
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#3D1A00',
    'opacity', 170,
    'blur', 10,
    'alpha_multiplier', 0.3,
    'offset_y', 4
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#FF6B00',
      'opacity', 200,
      'thickness', 4,
      'offset_y', 7
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.4, 'fade_out', 0.4)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 7. Purple Glow
--    Teks putih, keyword ungu terang bersinar
--    Cocok untuk konten beauty / fashion / mystery
-- ────────────────────────────────────────────────────────────
('Purple Glow', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Montserrat Bold',
    'font_size_normal', 48,
    'font_size_keyword', 68,
    'color', '#F8F0FF',
    'keyword_color', '#BF5FFF',
    'line_spacing', 14,
    'word_spacing', 14,
    'padding_horizontal', 80
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#2D0050',
    'opacity', 200,
    'blur', 14,
    'alpha_multiplier', 0.4,
    'offset_y', 4
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#BF5FFF',
      'opacity', 220,
      'thickness', 4,
      'offset_y', 7
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.5, 'fade_out', 0.5)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 8. Cinematic White
--    Teks putih bersih, tanpa keyword highlight, shadow dramatis
--    Cocok untuk konten sinematik / travel / dokumenter
-- ────────────────────────────────────────────────────────────
('Cinematic White', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Inter Bold',
    'font_size_normal', 42,
    'font_size_keyword', 42,
    'color', '#FFFFFF',
    'keyword_color', '#FFFFFF',
    'line_spacing', 18,
    'word_spacing', 18,
    'padding_horizontal', 120
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#000000',
    'opacity', 220,
    'blur', 20,
    'alpha_multiplier', 0.5,
    'offset_y', 5
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#FFFFFF',
      'opacity', 0,
      'thickness', 0,
      'offset_y', 0
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.6, 'fade_out', 0.6)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 9. Street Yellow
--    Teks hitam di atas kotak kuning — kontras maksimal
--    Cocok untuk konten street / urban / berita cepat
-- ────────────────────────────────────────────────────────────
('Street Yellow', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Bebas Neue',
    'font_size_normal', 54,
    'font_size_keyword', 74,
    'color', '#1A1A1A',
    'keyword_color', '#CC0000',
    'line_spacing', 10,
    'word_spacing', 10,
    'padding_horizontal', 60
  ),
  'shadow', JSON_OBJECT(
    'enable', FALSE,
    'color', '#000000',
    'opacity', 0,
    'blur', 0,
    'alpha_multiplier', 0.0,
    'offset_y', 0
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#CC0000',
      'opacity', 255,
      'thickness', 5,
      'offset_y', 6
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', TRUE, 'color', '#FFE000', 'opacity', 230, 'padding', 18),
  'animation', JSON_OBJECT('fade_in', 0.15, 'fade_out', 0.15)
), TRUE),

-- ────────────────────────────────────────────────────────────
-- 10. Minimal Mono
--     Teks abu muda, keyword putih terang, shadow sangat tipis
--     Cocok untuk konten podcast / talking head / minimalis
-- ────────────────────────────────────────────────────────────
('Minimal Mono', JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'fallback_font', 'Inter Bold',
    'font_size_normal', 40,
    'font_size_keyword', 56,
    'color', '#AAAAAA',
    'keyword_color', '#FFFFFF',
    'line_spacing', 16,
    'word_spacing', 16,
    'padding_horizontal', 100
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', '#000000',
    'opacity', 140,
    'blur', 6,
    'alpha_multiplier', 0.2,
    'offset_y', 2
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', '#FFFFFF',
      'opacity', 120,
      'thickness', 2,
      'offset_y', 8
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE, 'color', '#000000', 'opacity', 0, 'padding', 0),
  'animation', JSON_OBJECT('fade_in', 0.5, 'fade_out', 0.5)
), TRUE);

-- Verifikasi
SELECT id, name, is_active,
  JSON_UNQUOTE(JSON_EXTRACT(config, '$.text.color')) AS text_color,
  JSON_UNQUOTE(JSON_EXTRACT(config, '$.text.keyword_color')) AS keyword_color,
  JSON_UNQUOTE(JSON_EXTRACT(config, '$.text.fallback_font')) AS font,
  JSON_EXTRACT(config, '$.text.font_size_normal') AS size_normal,
  JSON_EXTRACT(config, '$.text.font_size_keyword') AS size_keyword,
  JSON_EXTRACT(config, '$.box.enable') AS box,
  JSON_EXTRACT(config, '$.animation.fade_in') AS fade_in
FROM hook_styles
ORDER BY id;
