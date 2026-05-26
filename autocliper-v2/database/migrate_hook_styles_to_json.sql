-- Migration: hook_styles flat columns → JSON config
-- Run once on existing database

USE autocliper;

-- 1. Add new columns
ALTER TABLE hook_styles
  ADD COLUMN config JSON NULL AFTER name,
  ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER config,
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 2. Migrate existing rows to JSON config
UPDATE hook_styles SET config = JSON_OBJECT(
  'text', JSON_OBJECT(
    'fontfile', '',
    'font_size_normal', font_size_normal,
    'font_size_keyword', font_size_keyword,
    'color', text_color,
    'keyword_color', keyword_color,
    'line_spacing', 10
  ),
  'shadow', JSON_OBJECT(
    'enable', TRUE,
    'color', shadow_color,
    'opacity', shadow_opacity,
    'blur', shadow_blur
  ),
  'keyword', JSON_OBJECT(
    'underline', JSON_OBJECT(
      'color', keyword_underline_color,
      'opacity', keyword_underline_opacity
    )
  ),
  'position', JSON_OBJECT('x', '(w-text_w)/2', 'y', '(h-text_h)/2'),
  'box', JSON_OBJECT('enable', FALSE),
  'animation', JSON_OBJECT('fade_in', 0.3, 'fade_out', 0.3)
);

-- 3. Make config NOT NULL after migration
ALTER TABLE hook_styles MODIFY COLUMN config JSON NOT NULL;

-- 4. Drop old flat columns
ALTER TABLE hook_styles
  DROP COLUMN text_color,
  DROP COLUMN keyword_color,
  DROP COLUMN shadow_color,
  DROP COLUMN shadow_opacity,
  DROP COLUMN shadow_blur,
  DROP COLUMN keyword_underline_color,
  DROP COLUMN keyword_underline_opacity,
  DROP COLUMN font_size_normal,
  DROP COLUMN font_size_keyword;

-- 5. Change id to BIGINT (drop FK first, update both columns, re-add FK)
ALTER TABLE request_log DROP FOREIGN KEY fk_request_hook_style;
ALTER TABLE hook_styles MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;
ALTER TABLE request_log MODIFY COLUMN hook_style_id BIGINT DEFAULT NULL;
ALTER TABLE request_log ADD CONSTRAINT fk_request_hook_style
  FOREIGN KEY (hook_style_id) REFERENCES hook_styles(id) ON DELETE SET NULL;
