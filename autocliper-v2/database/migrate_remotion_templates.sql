-- ============================================================================
-- Migration: Remotion Template System v2
-- Date: 2026-06-08
-- Description: Tambah tabel untuk menyimpan Remotion caption & hook templates
--              yang akan digunakan oleh cliperhub-remotion service (port 8002)
--
-- CHANGELOG dari v1:
--  [FIX]  Tambah IF NOT EXISTS + DROP constraint yang aman untuk re-run
--  [FIX]  ALTER TABLE request_log pakai kondisi aman (tidak error jika sudah ada)
--  [FIX]  Seed data composition pakai subquery (bukan hardcode ID)
--  [ADD]  Kolom baru: remotion_component (nama React component)
--  [ADD]  Kolom baru: preview_css (CSS string untuk preview di frontend)
--  [ADD]  Kolom baru: category pada caption & hook template
--  [ADD]  15 caption templates (dari 5 → 15)
--  [ADD]  13 hook templates (dari 5 → 13)
--  [ADD]  8 compositions (dari 3 → 8)
-- ============================================================================

USE autocliper;

-- ─────────────────────────────────────────────────────────────────────────────
-- SAFETY: Nonaktifkan FK check selama migrasi
-- ─────────────────────────────────────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: remotion_caption_templates
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS remotion_caption_templates (
  id                          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                        VARCHAR(100) NOT NULL,
  description                 TEXT DEFAULT NULL,
  category                    VARCHAR(50) DEFAULT 'general'
    COMMENT 'general, viral, minimal, gaming, edu, aesthetic',
  
  -- Remotion component & preview
  remotion_component          VARCHAR(100) NOT NULL DEFAULT 'KaraokeCaption'
    COMMENT 'Nama React component yang dipakai di Remotion',
  thumbnail_url               VARCHAR(500) DEFAULT NULL,
  preview_css                 TEXT DEFAULT NULL
    COMMENT 'Inline CSS JSON untuk live preview di frontend (tanpa render)',
  
  -- Font
  font_family                 VARCHAR(100) NOT NULL DEFAULT 'Inter',
  font_weight                 VARCHAR(20) NOT NULL DEFAULT '700',
  font_size                   INT NOT NULL DEFAULT 48 COMMENT 'px di canvas 1080x1920',
  letter_spacing              FLOAT DEFAULT 0,
  text_transform              VARCHAR(20) DEFAULT 'none',
  line_height                 FLOAT DEFAULT 1.3,
  
  -- Colors
  color                       VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  highlight_color             VARCHAR(20) NOT NULL DEFAULT '#FFD700',
  highlight_style             VARCHAR(30) NOT NULL DEFAULT 'color'
    COMMENT 'color | background | scale | glow | underline | box_jump | gradient_sweep',
  
  -- Background per-line atau per-word
  bg_enabled                  TINYINT(1) DEFAULT 0,
  bg_color                    VARCHAR(20) DEFAULT '#000000',
  bg_opacity                  FLOAT DEFAULT 0.7,
  bg_padding_x                INT DEFAULT 12,
  bg_padding_y                INT DEFAULT 6,
  bg_border_radius            INT DEFAULT 8,
  bg_per_word                 TINYINT(1) DEFAULT 0 COMMENT '1=per word pill, 0=per line',
  
  -- Outline / stroke
  outline_enabled             TINYINT(1) DEFAULT 1,
  outline_color               VARCHAR(20) DEFAULT '#000000',
  outline_width               INT DEFAULT 2,
  
  -- Shadow
  shadow_enabled              TINYINT(1) DEFAULT 1,
  shadow_color                VARCHAR(20) DEFAULT '#000000',
  shadow_blur                 INT DEFAULT 4,
  shadow_offset_x             INT DEFAULT 0,
  shadow_offset_y             INT DEFAULT 2,
  
  -- Posisi
  position_y                  VARCHAR(20) NOT NULL DEFAULT 'bottom',
  position_y_offset           INT DEFAULT 80,
  max_words_per_line          INT DEFAULT 4,
  max_lines                   INT DEFAULT 2,
  
  -- Animasi masuk/keluar baris
  animation_in                VARCHAR(30) DEFAULT 'fade'
    COMMENT 'none|fade|pop|slide_up|slide_left|typewriter|bounce|stomp|flip_in',
  animation_out               VARCHAR(30) DEFAULT 'fade'
    COMMENT 'none|fade|pop|slide_down|blur_out',
  animation_in_duration       INT DEFAULT 200 COMMENT 'ms',
  animation_out_duration      INT DEFAULT 150 COMMENT 'ms',
  
  -- Animasi highlight kata aktif
  highlight_transition        VARCHAR(30) DEFAULT 'instant'
    COMMENT 'instant|smooth|bounce|spring|scale_bounce',
  highlight_transition_duration INT DEFAULT 100,
  
  -- Extended config JSON
  config                      JSON DEFAULT NULL
    COMMENT 'Properti tambahan: gradient stops, spring config, emoji suffix, dll.',
  
  -- Metadata
  user_id                     INT DEFAULT NULL,
  is_active                   TINYINT(1) DEFAULT 1,
  is_default                  TINYINT(1) DEFAULT 0,
  sort_order                  INT DEFAULT 0,
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_caption_user    (user_id),
  INDEX idx_caption_active  (is_active),
  INDEX idx_caption_default (is_default),
  INDEX idx_caption_category(category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: remotion_hook_templates
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS remotion_hook_templates (
  id                          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                        VARCHAR(100) NOT NULL,
  description                 TEXT DEFAULT NULL,
  category                    VARCHAR(50) DEFAULT 'general'
    COMMENT 'general, cinematic, hype, minimal, aesthetic, edu',
  
  -- Remotion component & preview
  remotion_component          VARCHAR(100) NOT NULL DEFAULT 'HookOverlay'
    COMMENT 'Nama React component untuk hook',
  thumbnail_url               VARCHAR(500) DEFAULT NULL,
  preview_css                 TEXT DEFAULT NULL,
  
  -- Font
  font_family                 VARCHAR(100) NOT NULL DEFAULT 'Anton',
  font_weight                 VARCHAR(20) NOT NULL DEFAULT '400',
  font_size_normal            INT NOT NULL DEFAULT 36,
  font_size_keyword           INT NOT NULL DEFAULT 56,
  letter_spacing              FLOAT DEFAULT 0,
  text_transform              VARCHAR(20) DEFAULT 'uppercase',
  
  -- Colors
  color                       VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  keyword_color               VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
  
  -- Box di belakang seluruh hook
  box_enabled                 TINYINT(1) DEFAULT 0,
  box_color                   VARCHAR(20) DEFAULT '#000000',
  box_opacity                 FLOAT DEFAULT 0.6,
  box_padding                 INT DEFAULT 20,
  box_border_radius           INT DEFAULT 12,
  box_border_color            VARCHAR(20) DEFAULT NULL,
  box_border_width            INT DEFAULT 0,
  
  -- Background khusus keyword
  keyword_bg_enabled          TINYINT(1) DEFAULT 0,
  keyword_bg_color            VARCHAR(20) DEFAULT '#FF0000',
  keyword_bg_opacity          FLOAT DEFAULT 0.8,
  keyword_bg_padding_x        INT DEFAULT 8,
  keyword_bg_padding_y        INT DEFAULT 4,
  keyword_bg_border_radius    INT DEFAULT 6,
  
  -- Keyword underline
  keyword_underline_enabled   TINYINT(1) DEFAULT 1,
  keyword_underline_color     VARCHAR(20) DEFAULT '#FFFFFF',
  keyword_underline_thickness INT DEFAULT 3,
  keyword_underline_offset    INT DEFAULT 8,
  
  -- Shadow
  shadow_enabled              TINYINT(1) DEFAULT 1,
  shadow_color                VARCHAR(20) DEFAULT '#000000',
  shadow_blur                 INT DEFAULT 12,
  shadow_offset_y             INT DEFAULT 3,
  
  -- Glow
  glow_enabled                TINYINT(1) DEFAULT 0,
  glow_color                  VARCHAR(20) DEFAULT '#FFFFFF',
  glow_radius                 INT DEFAULT 8,
  glow_keyword_only           TINYINT(1) DEFAULT 1,
  
  -- Outline
  outline_enabled             TINYINT(1) DEFAULT 0,
  outline_color               VARCHAR(20) DEFAULT '#000000',
  outline_width               INT DEFAULT 2,
  
  -- Gradient pada teks
  gradient_enabled            TINYINT(1) DEFAULT 0,
  gradient_colors             JSON DEFAULT NULL COMMENT '["#FF0080","#7928CA"] — warna gradient stops',
  gradient_direction          VARCHAR(20) DEFAULT 'to right'
    COMMENT 'CSS gradient direction',
  
  -- Position
  position_x                  VARCHAR(20) NOT NULL DEFAULT 'center',
  position_y                  VARCHAR(20) NOT NULL DEFAULT 'center',
  position_y_offset           INT DEFAULT 0,
  
  -- Animasi
  animation_type              VARCHAR(30) DEFAULT 'fade'
    COMMENT 'none|fade|scale_up|slide_up|slide_split|typewriter|bounce|glitch|stomp|cinematic_reveal|word_by_word',
  animation_in_duration       INT DEFAULT 300,
  animation_out_duration      INT DEFAULT 300,
  scale_from                  FLOAT DEFAULT 0.8,
  
  -- Timing
  display_duration_seconds    FLOAT DEFAULT 3.0,
  delay_before_seconds        FLOAT DEFAULT 0.5,
  
  -- Extended config
  config                      JSON DEFAULT NULL,
  
  -- Metadata
  user_id                     INT DEFAULT NULL,
  is_active                   TINYINT(1) DEFAULT 1,
  is_default                  TINYINT(1) DEFAULT 0,
  sort_order                  INT DEFAULT 0,
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_hook_user     (user_id),
  INDEX idx_hook_active   (is_active),
  INDEX idx_hook_default  (is_default),
  INDEX idx_hook_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: remotion_compositions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS remotion_compositions (
  id                          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                        VARCHAR(150) NOT NULL,
  description                 TEXT DEFAULT NULL,
  thumbnail_url               VARCHAR(500) DEFAULT NULL,
  category                    VARCHAR(50) DEFAULT 'general',
  
  -- Template references
  caption_template_id         INT DEFAULT NULL,
  hook_template_id            INT DEFAULT NULL,
  
  -- Video settings
  fps                         INT NOT NULL DEFAULT 30,
  width                       INT NOT NULL DEFAULT 1080,
  height                      INT NOT NULL DEFAULT 1920,
  codec                       VARCHAR(20) NOT NULL DEFAULT 'h264',
  crf                         INT DEFAULT 18,
  pixel_format                VARCHAR(20) DEFAULT 'yuv420p',
  
  -- Global overlay config
  overlay_config              JSON DEFAULT NULL,
  
  -- Metadata
  user_id                     INT DEFAULT NULL,
  is_active                   TINYINT(1) DEFAULT 1,
  is_default                  TINYINT(1) DEFAULT 0,
  use_count                   INT DEFAULT 0,
  sort_order                  INT DEFAULT 0,
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (caption_template_id) REFERENCES remotion_caption_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (hook_template_id)    REFERENCES remotion_hook_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id)             REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comp_user    (user_id),
  INDEX idx_comp_active  (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: remotion_render_jobs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS remotion_render_jobs (
  id                          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_log_id              INT NOT NULL,
  clip_index                  INT NOT NULL,
  composition_id              INT DEFAULT NULL,
  
  -- Override individual templates
  caption_template_id         INT DEFAULT NULL,
  hook_template_id            INT DEFAULT NULL,
  
  -- Input
  input_video_path            VARCHAR(500) NOT NULL,
  metadata_path               VARCHAR(500) DEFAULT NULL,
  hook_text                   TEXT DEFAULT NULL,
  subtitle_data               JSON DEFAULT NULL
    COMMENT 'Array of {text, startMs, endMs, timestampMs} untuk @remotion/captions',
  
  -- Output
  output_video_path           VARCHAR(500) DEFAULT NULL,
  
  -- Status
  status                      VARCHAR(30) NOT NULL DEFAULT 'pending'
    COMMENT 'pending|rendering|completed|failed|cancelled',
  progress_percent            INT DEFAULT 0,
  render_time_ms              INT DEFAULT NULL,
  
  -- Error & retry
  error_message               TEXT DEFAULT NULL,
  retry_count                 INT DEFAULT 0,
  max_retries                 INT DEFAULT 2,
  
  -- Timestamps
  queued_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at                  TIMESTAMP NULL,
  completed_at                TIMESTAMP NULL,
  
  FOREIGN KEY (request_log_id)      REFERENCES request_log(id) ON DELETE CASCADE,
  FOREIGN KEY (composition_id)      REFERENCES remotion_compositions(id) ON DELETE SET NULL,
  FOREIGN KEY (caption_template_id) REFERENCES remotion_caption_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (hook_template_id)    REFERENCES remotion_hook_templates(id) ON DELETE SET NULL,
  INDEX idx_rjob_request (request_log_id, clip_index),
  INDEX idx_rjob_status  (status),
  INDEX idx_rjob_queued  (queued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER request_log — aman untuk re-run
-- ─────────────────────────────────────────────────────────────────────────────

-- Tambah composition_id jika belum ada
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'request_log'
  AND COLUMN_NAME  = 'composition_id');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE request_log ADD COLUMN composition_id INT DEFAULT NULL COMMENT ''FK ke remotion_compositions''',
  'SELECT ''column composition_id already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tambah render_mode jika belum ada
SET @col_exists2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'request_log'
  AND COLUMN_NAME  = 'render_mode');

SET @sql2 = IF(@col_exists2 = 0,
  'ALTER TABLE request_log ADD COLUMN render_mode VARCHAR(20) DEFAULT ''remotion'' COMMENT ''remotion | legacy_ffmpeg''',
  'SELECT ''column render_mode already exists'' AS info');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Tambah FK jika belum ada
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA      = DATABASE()
  AND TABLE_NAME        = 'request_log'
  AND CONSTRAINT_NAME   = 'fk_request_composition');

SET @sql3 = IF(@fk_exists = 0,
  'ALTER TABLE request_log ADD CONSTRAINT fk_request_composition FOREIGN KEY (composition_id) REFERENCES remotion_compositions(id) ON DELETE SET NULL',
  'SELECT ''FK fk_request_composition already exists'' AS info');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;


-- ─────────────────────────────────────────────────────────────────────────────
-- RE-ENABLE FK
-- ─────────────────────────────────────────────────────────────────────────────
SET FOREIGN_KEY_CHECKS = 1;


-- ═════════════════════════════════════════════════════════════════════════════
-- SEED: Caption Templates
-- Referensi style: Remotion Pro store, VEED (2026), BlitzCut AI viral data
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO remotion_caption_templates
  (name, description, category, remotion_component,
   font_family, font_weight, font_size, text_transform,
   color, highlight_color, highlight_style,
   outline_enabled, outline_color, outline_width,
   shadow_enabled, shadow_color, shadow_blur, shadow_offset_y,
   bg_enabled, bg_color, bg_opacity, bg_padding_x, bg_padding_y, bg_border_radius, bg_per_word,
   animation_in, animation_out, animation_in_duration,
   highlight_transition, highlight_transition_duration,
   position_y, position_y_offset, max_words_per_line,
   is_default, sort_order, config)
VALUES

-- ── 1. Classic Yellow (default) ─────────────────────────────────────────────
('Classic Yellow',
 'Subtitle kuning klasik — paling banyak dipakai kreator viral (MrBeast, Khaby Lame). Putih + keyword kuning.',
 'viral', 'KaraokeCaption',
 'Inter', '800', 52, 'none',
 '#FFFFFF', '#FFE500', 'color',
 1, '#000000', 3,
 1, '#000000', 6, 2,
 0, '#000000', 0, 0, 0, 0, 0,
 'fade', 'fade', 180,
 'instant', 80,
 'bottom', 90, 4,
 1, 1, NULL),

-- ── 2. Clean White Pill ──────────────────────────────────────────────────────
('Clean White Pill',
 'Kata-kata tampil dalam pill hitam transparan. Highlight biru elektrik. Style CapCut yang bersih dan mudah dibaca.',
 'minimal', 'KaraokeCaption',
 'Inter', '700', 44, 'none',
 '#FFFFFF', '#00D4FF', 'color',
 0, '#000000', 0,
 0, '#000000', 0, 0,
 1, '#000000', 0.72, 16, 9, 50, 0,
 'pop', 'fade', 220,
 'smooth', 120,
 'bottom', 100, 5,
 0, 2, NULL),

-- ── 3. Hormozi Style ─────────────────────────────────────────────────────────
('Hormozi Bold',
 'Populer di konten edukasi & bisnis. Word-by-word pop-in, uppercase, bold putih dengan outline hitam tebal. Mirip style Alex Hormozi.',
 'edu', 'KaraokeCaption',
 'Montserrat', '900', 56, 'uppercase',
 '#FFFFFF', '#FF4D00', 'scale',
 1, '#000000', 4,
 1, '#000000', 8, 3,
 0, '#000000', 0, 0, 0, 0, 0,
 'pop', 'fade', 150,
 'scale_bounce', 100,
 'center', 0, 3,
 0, 3,
 '{"scale_active": 1.25, "scale_base": 1.0, "spring_stiffness": 300, "spring_damping": 15}'),

-- ── 4. Word Pop Rainbow ──────────────────────────────────────────────────────
('Word Pop Rainbow',
 'Setiap kata muncul dengan bounce. Kata aktif berubah warna rainbow (gradient). Cocok untuk konten fun/entertainment.',
 'viral', 'RainbowKaraoke',
 'Poppins', '800', 50, 'none',
 '#FFFFFF', '#FF0080', 'gradient_sweep',
 1, '#1a1a1a', 3,
 1, '#000000', 10, 3,
 0, '#000000', 0, 0, 0, 0, 0,
 'bounce', 'fade', 200,
 'spring', 150,
 'bottom', 85, 4,
 0, 4,
 '{"gradient_colors": ["#FF0080","#FF8C00","#FFE500","#00D4FF","#7B2FFF"], "gradient_animate": true, "bounce_height": 8}'),

-- ── 5. Animated Background Jump ──────────────────────────────────────────────
('Animated BG Jump',
 'Rounded rectangle bergerak mengikuti kata yang aktif (spring animation). Style dari Remotion Pro Store. Tidak perlu highlight warna.',
 'aesthetic', 'AnimatedBgCaption',
 'Inter', '700', 46, 'none',
 '#FFFFFF', '#FFFFFF', 'box_jump',
 1, '#FF6B35', 0.9, 14, 8, 14, 1,
 'fade', 'fade', 200,
 'spring', 0,
 'bottom', 80, 5,
 0, 5,
 '{"spring_stiffness": 280, "spring_damping": 22, "bg_active_color": "#FF6B35", "bg_inactive_color": "rgba(0,0,0,0.6)"}'),

-- ── 6. TikTok Neon Karaoke ───────────────────────────────────────────────────
('TikTok Neon Karaoke',
 'Bold uppercase dengan efek glow neon. Kata aktif bersinar terang (glow). Top performer di konten gaming & nightlife.',
 'gaming', 'KaraokeCaption',
 'Anton', '400', 54, 'uppercase',
 '#E0E0FF', '#FF2D95', 'glow',
 0, '#000000', 0,
 1, '#FF2D95', 16, 0,
 0, '#000000', 0, 0, 0, 0, 0,
 'slide_up', 'fade', 250,
 'smooth', 180,
 'bottom', 90, 3,
 0, 6,
 '{"glow_spread": 6, "glow_layers": 3, "glow_color": "#FF2D95", "text_glow_inactive": "0 0 4px rgba(255,45,149,0.3)"}'),

-- ── 7. Minimal Dark Per-Word ─────────────────────────────────────────────────
('Minimal Dark Pill',
 'Setiap kata punya background pill gelap sendiri (bg_per_word). Minimalis, tidak gangguin visual video. Baik untuk konten lifestyle.',
 'minimal', 'KaraokeCaption',
 'Montserrat', '600', 40, 'none',
 '#F5F5F5', '#64FFDA', 'background',
 1, '#111111', 0.85, 12, 7, 8, 1,
 'fade', 'fade', 200,
 'smooth', 100,
 'bottom', 70, 5,
 0, 7, NULL),

-- ── 8. Stomp Impact ──────────────────────────────────────────────────────────
('Stomp Impact',
 'Setiap kata turun dari atas dengan efek "stomp" — seperti stamp ke screen. Cocok untuk hype content, olahraga, motivasi.',
 'viral', 'StompCaption',
 'Impact', '400', 58, 'uppercase',
 '#FFFFFF', '#FF3B30', 'color',
 1, '#000000', 5,
 1, '#000000', 10, 4,
 0, '#000000', 0, 0, 0, 0, 0,
 'stomp', 'fade', 120,
 'instant', 60,
 'center', 0, 3,
 0, 8,
 '{"stomp_scale_start": 1.6, "stomp_scale_end": 1.0, "stomp_spring_stiffness": 400, "shake_enabled": true, "shake_frames": 3}'),

-- ── 9. Typewriter Edu ────────────────────────────────────────────────────────
('Typewriter Edu',
 'Kata-kata muncul satu per satu seperti diketik. Efek cursor berkedip. Cocok untuk konten tutorial, educational, listicle.',
 'edu', 'TypewriterCaption',
 'Courier Prime', '700', 38, 'none',
 '#F0FFF0', '#00FF88', 'color',
 1, '#000000', 0,
 0, '#000000', 0, 0,
 1, '#002800', 0.85, 16, 10, 6, 0,
 'typewriter', 'fade', 300,
 'instant', 50,
 'bottom', 80, 6,
 0, 9,
 '{"cursor_enabled": true, "cursor_blink_ms": 530, "cursor_char": "|", "cursor_color": "#00FF88"}'),

-- ── 10. Flip In Words ────────────────────────────────────────────────────────
('Flip In Words',
 'Setiap kata flip masuk dari bawah (rotateX 90→0). Efek dramatis yang menarik perhatian. Cocok untuk countdown, motivasi.',
 'aesthetic', 'FlipCaption',
 'Bebas Neue', '400', 52, 'uppercase',
 '#FFFFFF', '#FDDB3A', 'color',
 1, '#000000', 2,
 1, '#000000', 6, 2,
 0, '#000000', 0, 0, 0, 0, 0,
 'flip_in', 'fade', 220,
 'instant', 80,
 'bottom', 95, 4,
 0, 10,
 '{"flip_perspective": 600, "flip_origin": "bottom center", "stagger_ms": 80}'),

-- ── 11. Pastel Aesthetic ─────────────────────────────────────────────────────
('Pastel Aesthetic',
 'Warna pastel lembut, font rounded. Kata aktif highlight ungu pastel. Cocok untuk konten lifestyle, beauty, GRWM.',
 'aesthetic', 'KaraokeCaption',
 'Nunito', '800', 44, 'none',
 '#FFF0F8', '#D4A5FF', 'background',
 1, '#D4A5FF', 0.35, 14, 8, 20, 1,
 'pop', 'fade', 250,
 'smooth', 150,
 'bottom', 85, 4,
 0, 11,
 '{"bg_active_color": "#D4A5FF", "bg_inactive_color": "rgba(255,240,248,0.15)", "letter_spacing": 0.02}'),

-- ── 12. Golden Outline ───────────────────────────────────────────────────────
('Golden Outline',
 'Teks putih dengan outline emas tebal. Kata aktif berubah solid emas. Cocok untuk konten premium, finance, crypto.',
 'viral', 'KaraokeCaption',
 'Anton', '400', 50, 'uppercase',
 '#FFFFFF', '#FFD700', 'color',
 1, '#FFD700', 4,
 1, '#000000', 8, 3,
 0, '#000000', 0, 0, 0, 0, 0,
 'fade', 'fade', 200,
 'smooth', 100,
 'bottom', 90, 4,
 0, 12, NULL),

-- ── 13. Gradient Sweep ───────────────────────────────────────────────────────
('Gradient Sweep',
 'Highlight berupa gradient yang "menyapu" dari kiri ke kanan saat kata diucapkan. Efek premium seperti brand fashion.',
 'aesthetic', 'GradientSweepCaption',
 'Montserrat', '800', 48, 'none',
 '#FFFFFF', '#FFFFFF', 'gradient_sweep',
 1, '#000000', 2,
 1, '#000000', 4, 2,
 0, '#000000', 0, 0, 0, 0, 0,
 'slide_up', 'fade', 200,
 'smooth', 200,
 'bottom', 88, 4,
 0, 13,
 '{"gradient_colors": ["#7B2FFF","#FF2D95"], "sweep_direction": "left-to-right", "sweep_duration_ms": 300}'),

-- ── 14. Box Highlight (VEED style) ──────────────────────────────────────────
('Box Highlight',
 'Background kotak padat berwarna di belakang seluruh baris. Mirip subtitle VEED "Box Highlight" — sangat readable di semua background.',
 'minimal', 'KaraokeCaption',
 'Inter', '700', 42, 'none',
 '#000000', '#FFE500', 'background',
 0, '#000000', 0,
 0, '#000000', 0, 0,
 1, '#FFFFFF', 1.0, 18, 10, 4, 0,
 'fade', 'fade', 200,
 'instant', 0,
 'bottom', 75, 5,
 0, 14,
 '{"bg_active_line_color": "#FFE500", "bg_normal_line_color": "#FFFFFF"}'),

-- ── 15. Cinematic White (OpusClip Style) ─────────────────────────────────────
('Cinematic White',
 'Putih bersih dengan outline ultra-tipis. Line muncul dari fade-in smooth. Mirip style OpusClip / Opus Pro premium.',
 'minimal', 'KaraokeCaption',
 'Inter', '600', 42, 'none',
 '#FFFFFF', '#FFFFFF', 'underline',
 1, '#CCCCCC', 1,
 1, '#000000', 12, 4,
 0, '#000000', 0, 0, 0, 0, 0,
 'fade', 'fade', 350,
 'smooth', 200,
 'bottom', 95, 4,
 0, 15,
 '{"underline_color": "#FFFFFF", "underline_thickness": 2, "underline_offset": 6, "word_opacity_inactive": 0.55}');


-- ═════════════════════════════════════════════════════════════════════════════
-- SEED: Hook Templates
-- ═════════════════════════════════════════════════════════════════════════════

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

-- ── H1. Minimal White (default) ──────────────────────────────────────────────
('Minimal White',
 'Hook putih minimalis — universal dan timeless. Shadow hitam kuat untuk readability di semua video.',
 'minimal', 'HookOverlay',
 'Anton', '400', 36, 56,
 'uppercase', '#FFFFFF', '#FFFFFF',
 1, '#000000', 14, 4,
 0, '#FFFFFF', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 1, '#FFFFFF', 3,
 0, '#FF0000', 0.8, 8, 4, 6,
 0, '#000000', 0, 0, 0,
 'fade', 300, 3.0, 0.5,
 'center', 'center', 0,
 1, 1, NULL),

-- ── H2. Elegant Gold ─────────────────────────────────────────────────────────
('Elegant Gold',
 'Keyword emas premium dengan underline garis emas. Cocok untuk konten finance, luxury, motivasi.',
 'general', 'HookOverlay',
 'Anton', '400', 36, 58,
 'uppercase', '#E8E8E8', '#FFD700',
 1, '#000000', 10, 3,
 0, '#FFD700', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 1, '#FFD700', 3,
 0, '#FFD700', 0.8, 8, 4, 4,
 0, '#000000', 0, 0, 0,
 'scale_up', 400, 3.5, 0.5,
 'center', 'center', 0,
 0, 2, '{"scale_from": 0.75, "spring_stiffness": 250, "spring_damping": 20}'),

-- ── H3. Bold Red Stomp ───────────────────────────────────────────────────────
('Bold Red Stomp',
 'Hook agresif dengan keyword merah + animasi stomp yang menghentak. Cocok untuk konten hype, sports, challenge.',
 'hype', 'StompHook',
 'Bebas Neue', '400', 42, 62,
 'uppercase', '#FFFFFF', '#FF3B30',
 1, '#000000', 10, 3,
 0, '#FF3B30', 0, 1,
 1, '#000000', 3,
 0, NULL, 'to right',
 0, '#FF3B30', 0,
 1, '#FF3B30', 0.85, 10, 5, 4,
 0, '#000000', 0, 0, 0,
 'stomp', 350, 3.0, 0.3,
 'center', 'center', 0,
 0, 3, '{"stomp_scale_start": 1.8, "shake_enabled": true, "shake_intensity": 6, "shake_frames": 4}'),

-- ── H4. Neon Blue Glow ───────────────────────────────────────────────────────
('Neon Blue Glow',
 'Teks biru neon bersinar — efek glow berlapis. Keyword lebih terang. Cocok untuk tech, gaming, crypto.',
 'gaming', 'HookOverlay',
 'Montserrat', '700', 34, 52,
 'uppercase', '#C8E8FF', '#64C8FF',
 1, '#000000', 8, 2,
 1, '#64C8FF', 12, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 1, '#64C8FF', 2,
 0, '#64C8FF', 0.8, 8, 4, 6,
 0, '#000000', 0, 0, 0,
 'typewriter', 500, 4.0, 0.5,
 'center', 'center', 0,
 0, 4, '{"typewriter_char_delay_ms": 45, "glow_layers": ["0 0 6px #64C8FF","0 0 20px #64C8FF","0 0 40px #1a6fff"]}'),

-- ── H5. Glitch Style ─────────────────────────────────────────────────────────
('Glitch Style',
 'Efek glitch RGB split pada hook. Cocok untuk konten edgy, horror, cyberpunk, drama.',
 'gaming', 'GlitchHook',
 'Anton', '400', 38, 58,
 'uppercase', '#FFFFFF', '#00FF66',
 1, '#000000', 10, 3,
 0, '#00FF66', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 0, '#00FF66', 0,
 0, '#00FF66', 0.8, 8, 4, 4,
 0, '#000000', 0, 0, 0,
 'glitch', 400, 3.0, 0.4,
 'center', 'center', 0,
 0, 5, '{"glitch_intensity": 8, "glitch_color_r": "#FF0055", "glitch_color_b": "#00AAFF", "glitch_flicker_enabled": true, "glitch_repeat_interval_ms": 2000}'),

-- ── H6. Cinematic Reveal ─────────────────────────────────────────────────────
('Cinematic Reveal',
 'Kata-kata terbuka dari tengah ke luar seperti opening film. Background letterbox semi-transparan. Sangat sinematik.',
 'cinematic', 'CinematicHook',
 'Cormorant Garamond', '700', 32, 48,
 'uppercase', '#F5F0E8', '#D4A843',
 1, '#000000', 20, 5,
 0, '#D4A843', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 1, '#D4A843', 1,
 0, '#D4A843', 0.8, 8, 4, 2,
 1, '#000000', 0.55, 28, 0,
 'cinematic_reveal', 600, 4.0, 0.8,
 'center', 'center', 0,
 0, 6, '{"letterbox_height": 120, "letterbox_color": "#000000", "reveal_direction": "center-out", "letter_spacing": 6}'),

-- ── H7. Word By Word ─────────────────────────────────────────────────────────
('Word By Word',
 'Hook muncul kata per kata secara berurutan — seperti presenter bicara. Efek yang engaging dan dramatis.',
 'edu', 'WordByWordHook',
 'Montserrat', '800', 38, 56,
 'uppercase', '#FFFFFF', '#FF9500',
 1, '#000000', 12, 3,
 0, '#FF9500', 0, 1,
 1, '#000000', 3,
 0, NULL, 'to right',
 1, '#FF9500', 3,
 0, '#FF9500', 0.8, 8, 5, 6,
 0, '#000000', 0, 0, 0,
 'word_by_word', 250, 4.5, 0.3,
 'center', 'center', 0,
 0, 7, '{"word_delay_ms": 180, "word_animation": "pop", "active_word_scale": 1.15}'),

-- ── H8. Slide Split ──────────────────────────────────────────────────────────
('Slide Split',
 'Dua baris teks masuk dari arah berlawanan (kiri & kanan) bertemu di tengah. Sangat eye-catching untuk hook pertanyaan.',
 'hype', 'SlideSplitHook',
 'Anton', '400', 36, 54,
 'uppercase', '#FFFFFF', '#FDDB3A',
 1, '#000000', 14, 4,
 0, '#FDDB3A', 0, 1,
 1, '#000000', 3,
 0, NULL, 'to right',
 1, '#FDDB3A', 3,
 0, '#FDDB3A', 0.8, 8, 4, 4,
 0, '#000000', 0, 0, 0,
 'slide_split', 400, 3.5, 0.4,
 'center', 'center', 0,
 0, 8, '{"line1_from": "left", "line2_from": "right", "gap_between_lines": 16, "spring_stiffness": 220, "spring_damping": 18}'),

-- ── H9. Gradient Title ───────────────────────────────────────────────────────
('Gradient Title',
 'Teks hook dengan fill gradient warna-warni. Tidak ada keyword khusus — seluruh hook satu gradient. Cocok untuk konten lifestyle & beauty.',
 'aesthetic', 'HookOverlay',
 'Nunito', '900', 38, 56,
 'uppercase', '#FFFFFF', '#FFFFFF',
 1, '#000000', 12, 4,
 0, '#FF2D95', 0, 1,
 0, '#000000', 0,
 1, JSON_ARRAY('#FF2D95','#FF8C00','#7B2FFF'), 'to right',
 0, '#FF2D95', 0,
 0, '#FF2D95', 0.8, 8, 4, 6,
 0, '#000000', 0, 0, 0,
 'scale_up', 450, 3.5, 0.5,
 'center', 'center', 0,
 0, 9, '{"gradient_animate": true, "gradient_animation_speed": 3, "gradient_angle_degrees": 90}'),

-- ── H10. Box Punch ───────────────────────────────────────────────────────────
('Box Punch',
 'Hook di dalam kotak padat berwarna yang "muncul" dengan animasi scale-punch. Modern dan tegas seperti social media post.',
 'hype', 'BoxPunchHook',
 'Montserrat', '900', 34, 50,
 'uppercase', '#000000', '#000000',
 0, '#000000', 0, 0,
 0, '#FFDD00', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 0, '#000000', 0,
 0, '#000000', 0.8, 8, 4, 6,
 1, '#FFDD00', 1.0, 32, 12,
 'scale_up', 350, 3.0, 0.4,
 'center', 'center', 0,
 0, 10, '{"box_border_color": "#000000", "box_border_width": 3, "punch_scale_start": 1.4, "punch_overshoot": 1.05}'),

-- ── H11. Typewriter Reveal ───────────────────────────────────────────────────
('Typewriter Reveal',
 'Hook muncul karakter per karakter. Ada sound visual effect berupa kursor berkedip. Cocok untuk mystery & suspense content.',
 'cinematic', 'TypewriterHook',
 'Courier Prime', '700', 34, 48,
 'uppercase', '#00FF44', '#FFFFFF',
 0, '#000000', 0, 0,
 1, '#00FF44', 8, 0,
 0, '#000000', 0,
 0, NULL, 'to right',
 0, '#00FF44', 0,
 0, '#00FF44', 0.8, 8, 4, 2,
 1, '#001800', 0.92, 28, 8,
 'typewriter', 600, 4.5, 0.6,
 'center', 'center', 0,
 0, 11, '{"cursor_enabled": true, "cursor_blink_ms": 500, "char_delay_ms": 55, "sound_visual_enabled": true}'),

-- ── H12. Pastel Pop ──────────────────────────────────────────────────────────
('Pastel Pop',
 'Hook lembut dengan font rounded dan warna pastel. Kata kunci ungu pastel. Cocok untuk konten beauty, food, GRWM.',
 'aesthetic', 'HookOverlay',
 'Nunito', '800', 34, 50,
 'none', '#FFF0F8', '#C084FC',
 1, '#9933CC', 8, 3,
 0, '#C084FC', 0, 1,
 0, '#000000', 0,
 0, NULL, 'to right',
 1, '#C084FC', 2,
 1, '#FDE8FF', 0.85, 12, 6, 20,
 0, '#000000', 0, 0, 0,
 'pop', 350, 3.5, 0.5,
 'center', 'center', 0,
 0, 12, NULL),

-- ── H13. Impact Top Banner ───────────────────────────────────────────────────
('Impact Top Banner',
 'Hook di bagian atas video dalam banner hitam padat. Tidak di tengah. Cocok agar tidak menutupi speaker di bawah.',
 'general', 'HookOverlay',
 'Impact', '400', 38, 56,
 'uppercase', '#FFFF00', '#FFFFFF',
 1, '#000000', 6, 2,
 0, '#FFFF00', 0, 1,
 1, '#000000', 3,
 0, NULL, 'to right',
 0, '#FFFF00', 0,
 0, '#FFFF00', 0.8, 8, 4, 4,
 1, '#000000', 1.0, 24, 0,
 'slide_up', 300, 3.5, 0.3,
 'center', 'top', 60,
 0, 13, NULL);


-- ═════════════════════════════════════════════════════════════════════════════
-- SEED: Compositions (pakai subquery, bukan hardcode ID)
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO remotion_compositions
  (name, description, category,
   caption_template_id, hook_template_id,
   fps, width, height, codec, crf,
   is_default, sort_order)
SELECT
  'Standard Viral',
  'Setup paling populer — Classic Yellow + Minimal White hook. Terbukti performant.',
  'viral',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Classic Yellow' LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Minimal White'  LIMIT 1),
  30, 1080, 1920, 'h264', 18,
  1, 1;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'Hormozi Edu',
  'Style konten edukasi dan bisnis — Hormozi Bold + Word By Word hook.',
  'edu',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Hormozi Bold'   LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Word By Word'   LIMIT 1),
  30, 1080, 1920, 'h264', 18, 0, 2;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'TikTok Hype',
  'Konten hype & challenge — Stomp Impact caption + Bold Red Stomp hook.',
  'hype',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Stomp Impact'   LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Bold Red Stomp' LIMIT 1),
  30, 1080, 1920, 'h264', 20, 0, 3;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'Gaming / Tech',
  'Konten gaming dan teknologi — TikTok Neon Karaoke + Neon Blue Glow hook.',
  'gaming',
  (SELECT id FROM remotion_caption_templates WHERE name = 'TikTok Neon Karaoke' LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Neon Blue Glow'      LIMIT 1),
  30, 1080, 1920, 'h264', 18, 0, 4;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'Aesthetic Lifestyle',
  'Konten lifestyle, beauty, GRWM — Pastel Aesthetic caption + Pastel Pop hook.',
  'aesthetic',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Pastel Aesthetic' LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Pastel Pop'       LIMIT 1),
  30, 1080, 1920, 'h264', 18, 0, 5;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'Cinematic Premium',
  'Konten premium dan sinematik — Cinematic White caption + Cinematic Reveal hook.',
  'cinematic',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Cinematic White'    LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Cinematic Reveal'   LIMIT 1),
  30, 1080, 1920, 'h264', 16, 0, 6;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'Mystery / Drama',
  'Konten drama dan misteri — Typewriter Edu + Glitch Style hook.',
  'cinematic',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Typewriter Edu' LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Glitch Style'   LIMIT 1),
  30, 1080, 1920, 'h264', 18, 0, 7;

INSERT INTO remotion_compositions
  (name, description, category, caption_template_id, hook_template_id, fps, width, height, codec, crf, is_default, sort_order)
SELECT
  'Finance / Crypto',
  'Konten keuangan, investasi, kripto — Golden Outline caption + Elegant Gold hook.',
  'viral',
  (SELECT id FROM remotion_caption_templates WHERE name = 'Golden Outline' LIMIT 1),
  (SELECT id FROM remotion_hook_templates    WHERE name = 'Elegant Gold'   LIMIT 1),
  30, 1080, 1920, 'h264', 18, 0, 8;


-- ═════════════════════════════════════════════════════════════════════════════
SELECT
  CONCAT(
    'Migration v2 selesai! ',
    (SELECT COUNT(*) FROM remotion_caption_templates), ' caption templates, ',
    (SELECT COUNT(*) FROM remotion_hook_templates),    ' hook templates, ',
    (SELECT COUNT(*) FROM remotion_compositions),      ' compositions.'
  ) AS status;
-- ═════════════════════════════════════════════════════════════════════════════
