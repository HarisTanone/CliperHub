-- ============================================================================
-- Migration: Keyframe Animation System
-- Date: 2026-06-08
-- Description: Replaces the legacy Remotion-based styling system with a unified
--              keyframe animation architecture. Drops all Remotion/legacy style
--              tables and creates new keyframe-based tables.
--
-- CHANGELOG:
--   [DROP]  remotion_render_jobs, remotion_compositions,
--           remotion_caption_templates, remotion_hook_templates,
--           caption_styles, hook_styles
--   [CREATE] keyframe_registry, caption_templates, hook_templates,
--            style_compositions
--   [ALTER]  request_log — add new FK columns, add hook_text_raw,
--            drop old FK constraints (keep old columns nullable)
-- ============================================================================

USE autocliper;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Drop FK constraints on request_log that reference tables we're dropping
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop FK referencing remotion_compositions (composition_id column)
SET @fk_comp = (
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND CONSTRAINT_NAME = 'fk_request_composition'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    LIMIT 1
);
SET @sql = IF(@fk_comp IS NOT NULL,
    CONCAT('ALTER TABLE request_log DROP FOREIGN KEY ', @fk_comp),
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop FK referencing caption_styles (caption_style_id column) — may already be dropped
SET @fk_cap = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'caption_style_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);
SET @sql = IF(@fk_cap IS NOT NULL,
    CONCAT('ALTER TABLE request_log DROP FOREIGN KEY ', @fk_cap),
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop FK referencing hook_styles (hook_style_id column) — may already be dropped
SET @fk_hook = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'hook_style_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);
SET @sql = IF(@fk_hook IS NOT NULL,
    CONCAT('ALTER TABLE request_log DROP FOREIGN KEY ', @fk_hook),
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Drop legacy tables (order matters — children first, then parents)
-- ═══════════════════════════════════════════════════════════════════════════════

-- remotion_render_jobs references remotion_compositions, remotion_caption_templates,
-- remotion_hook_templates — drop first
DROP TABLE IF EXISTS remotion_render_jobs;

-- remotion_compositions references remotion_caption_templates, remotion_hook_templates
DROP TABLE IF EXISTS remotion_compositions;

-- Now safe to drop the template tables
DROP TABLE IF EXISTS remotion_caption_templates;
DROP TABLE IF EXISTS remotion_hook_templates;

-- Legacy style tables (FKs already dropped above)
DROP TABLE IF EXISTS caption_styles;
DROP TABLE IF EXISTS hook_styles;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Create new keyframe-based tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── keyframe_registry ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS keyframe_registry (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    fps INT NOT NULL DEFAULT 30,
    duration_frames INT NOT NULL,
    keyframes JSON NOT NULL,
    properties JSON NOT NULL,
    transform_origin VARCHAR(30) NOT NULL DEFAULT 'center center',
    params_hash VARCHAR(64) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_params_hash (params_hash)
);

-- ─── caption_templates ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caption_templates (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    thumbnail_url VARCHAR(500) DEFAULT NULL,
    style_type VARCHAR(20) NOT NULL DEFAULT 'static',
    config JSON NOT NULL,
    user_id INT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    is_default TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_user_active (user_id, is_active),
    CONSTRAINT fk_caption_tpl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── hook_templates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hook_templates (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    thumbnail_url VARCHAR(500) DEFAULT NULL,
    style_type VARCHAR(20) NOT NULL DEFAULT 'animated',
    config JSON NOT NULL,
    user_id INT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    is_default TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_user_active (user_id, is_active),
    CONSTRAINT fk_hook_tpl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── style_compositions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS style_compositions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    thumbnail_url VARCHAR(500) DEFAULT NULL,
    caption_template_id INT DEFAULT NULL,
    hook_template_id INT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    is_default TINYINT(1) DEFAULT 0,
    use_count INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_comp_caption FOREIGN KEY (caption_template_id) REFERENCES caption_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_comp_hook FOREIGN KEY (hook_template_id) REFERENCES hook_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_comp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_active (user_id, is_active)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 4: Alter request_log — add new columns & keep backward compat
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add caption_template_id (references new caption_templates table)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'caption_template_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE request_log ADD COLUMN caption_template_id INT DEFAULT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add hook_template_id (references new hook_templates table)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'hook_template_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE request_log ADD COLUMN hook_template_id INT DEFAULT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add style_composition_id (references new style_compositions table)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'style_composition_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE request_log ADD COLUMN style_composition_id INT DEFAULT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add hook_text_raw (stores original hook text for re-style operations)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'hook_text_raw'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE request_log ADD COLUMN hook_text_raw TEXT DEFAULT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make old columns nullable for backward compatibility
-- caption_style_id may still be NOT NULL from original schema
ALTER TABLE request_log MODIFY COLUMN caption_style_id INT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Verification
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Keyframe Animation System migration complete.' AS status;
SELECT '  - Dropped: remotion_render_jobs, remotion_compositions, remotion_caption_templates, remotion_hook_templates, caption_styles, hook_styles' AS dropped_tables;
SELECT '  - Created: keyframe_registry, caption_templates, hook_templates, style_compositions' AS created_tables;
SELECT '  - Altered: request_log (added caption_template_id, hook_template_id, style_composition_id, hook_text_raw)' AS altered_tables;
