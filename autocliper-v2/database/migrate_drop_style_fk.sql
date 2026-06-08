-- ============================================================================
-- Migration: Drop FK constraints on request_log style columns
-- Date: 2026-06-08
-- Reason: caption_style_id and hook_style_id now reference EITHER legacy tables
--         (caption_styles, hook_styles) OR Remotion tables
--         (remotion_caption_templates, remotion_hook_templates).
--         FK constraints prevent storing Remotion template IDs.
-- ============================================================================

USE autocliper;

-- Find and drop FK for caption_style_id
SET @fk_caption = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'autocliper' AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'caption_style_id' AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @sql_drop_caption = IF(@fk_caption IS NOT NULL,
    CONCAT('ALTER TABLE request_log DROP FOREIGN KEY ', @fk_caption),
    'SELECT 1');
PREPARE stmt FROM @sql_drop_caption;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Find and drop FK for hook_style_id
SET @fk_hook = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'autocliper' AND TABLE_NAME = 'request_log'
    AND COLUMN_NAME = 'hook_style_id' AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @sql_drop_hook = IF(@fk_hook IS NOT NULL,
    CONCAT('ALTER TABLE request_log DROP FOREIGN KEY ', @fk_hook),
    'SELECT 1');
PREPARE stmt FROM @sql_drop_hook;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make caption_style_id nullable (it was NOT NULL before)
ALTER TABLE request_log MODIFY COLUMN caption_style_id INT NULL;

SELECT 'FK constraints dropped. caption_style_id and hook_style_id now support Remotion template IDs.' AS status;
