CREATE DATABASE IF NOT EXISTS autocliper;
USE autocliper;

-- ─── users (must exist before FK references) ────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE DEFAULT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── fonts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fonts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  download_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO fonts (name, file_name, download_url) VALUES
('Anton', 'Anton-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf'),
('Poppins Bold', 'Poppins-Bold.ttf', 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf'),
('Bebas Neue', 'BebasNeue-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf'),
('Montserrat Bold', 'Montserrat-Bold.ttf', 'https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Bold.ttf'),
('Inter Bold', 'Inter-Bold.ttf', 'https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Bold.ttf')
ON DUPLICATE KEY UPDATE name=name;

-- ─── hook_styles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hook_styles (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  config JSON NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO hook_styles (name, config) VALUES
('Minimal White', '{"text":{"fontfile":"","font_size_normal":36,"font_size_keyword":56,"color":"#FFFFFF","keyword_color":"#FFFFFF","line_spacing":10},"shadow":{"enable":true,"color":"#000000","opacity":200,"blur":12},"keyword":{"underline":{"color":"#FFFFFF","opacity":180}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false},"animation":{"fade_in":0.3,"fade_out":0.3}}'),
('Elegant Gold',  '{"text":{"fontfile":"","font_size_normal":36,"font_size_keyword":56,"color":"#E6E6E6","keyword_color":"#FFD700","line_spacing":10},"shadow":{"enable":true,"color":"#000000","opacity":180,"blur":10},"keyword":{"underline":{"color":"#FFD700","opacity":160}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false},"animation":{"fade_in":0.3,"fade_out":0.3}}'),
('Modern Mono',   '{"text":{"fontfile":"","font_size_normal":36,"font_size_keyword":56,"color":"#F5F5F5","keyword_color":"#C8C8C8","line_spacing":10},"shadow":{"enable":true,"color":"#000000","opacity":200,"blur":8},"keyword":{"underline":{"color":"#969696","opacity":180}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false},"animation":{"fade_in":0.3,"fade_out":0.3}}'),
('Clean Blue',    '{"text":{"fontfile":"","font_size_normal":36,"font_size_keyword":56,"color":"#F0F0F0","keyword_color":"#64C8FF","line_spacing":10},"shadow":{"enable":true,"color":"#000000","opacity":180,"blur":10},"keyword":{"underline":{"color":"#64C8FF","opacity":150}},"position":{"x":"(w-text_w)/2","y":"(h-text_h)/2"},"box":{"enable":false},"animation":{"fade_in":0.3,"fade_out":0.3}}')
ON DUPLICATE KEY UPDATE name=name;

-- ─── caption_styles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caption_styles (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  font_id INT DEFAULT NULL,
  font_family VARCHAR(100) DEFAULT 'Arial',
  font_weight VARCHAR(20) DEFAULT 'bold',
  font_size INT DEFAULT 48,
  color VARCHAR(20) DEFAULT '#FFFF00',
  highlight_color VARCHAR(20) DEFAULT '#FFF45C',
  outline_color VARCHAR(20) DEFAULT '#000000',
  outline_width INT DEFAULT 3,
  shadow_color VARCHAR(20) DEFAULT '#000000',
  shadow_offset_x INT DEFAULT 2,
  shadow_offset_y INT DEFAULT 2,
  line_spacing FLOAT DEFAULT 1.0,
  caption_bottom_margin INT DEFAULT 70,
  user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_caption_font FOREIGN KEY (font_id) REFERENCES fonts(id) ON DELETE SET NULL,
  CONSTRAINT fk_caption_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Global default styles (user_id NULL = visible to all)
INSERT INTO caption_styles (name, font_family, font_weight, font_size, color, highlight_color, outline_color, outline_width) VALUES
('Default Yellow', 'Arial', 'bold', 48, '#FFFF00', '#FFF45C', '#000000', 3),
('White Clean',    'Arial', 'bold', 52, '#FFFFFF', '#CCCCCC', '#000000', 2),
('Red Bold',       'Arial', 'bold', 56, '#FF0000', '#FF6666', '#FFFFFF', 3),
('Neon Purple Glow','Poppins','bold',18, '#FDFDFD', '#FF69B4', '#000000', 0)
ON DUPLICATE KEY UPDATE name=name;

-- ─── request_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  youtube_url VARCHAR(255) NOT NULL,
  caption_style_id INT NOT NULL,
  hook_style_id INT DEFAULT NULL,
  caption_response JSON NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  output_path VARCHAR(500) DEFAULT NULL,
  user_id INT DEFAULT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (caption_style_id),
  INDEX (status),
  INDEX (user_id),
  INDEX idx_youtube_url (youtube_url),
  CONSTRAINT fk_request_caption_style
    FOREIGN KEY (caption_style_id) REFERENCES caption_styles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_request_hook_style
    FOREIGN KEY (hook_style_id) REFERENCES hook_styles(id) ON DELETE SET NULL
);