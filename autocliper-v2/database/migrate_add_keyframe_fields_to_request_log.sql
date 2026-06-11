-- Migration: Add keyframe animation system fields to request_log table
-- These columns support the new template-based rendering pipeline.

ALTER TABLE request_log
    ADD COLUMN caption_template_id INT NULL DEFAULT NULL AFTER user_id,
    ADD COLUMN hook_template_id INT NULL DEFAULT NULL AFTER caption_template_id,
    ADD COLUMN style_composition_id INT NULL DEFAULT NULL AFTER hook_template_id,
    ADD COLUMN hook_text_raw TEXT NULL DEFAULT NULL AFTER style_composition_id;

-- Add indexes for filtering/lookups
ALTER TABLE request_log
    ADD INDEX idx_request_log_caption_template (caption_template_id),
    ADD INDEX idx_request_log_hook_template (hook_template_id),
    ADD INDEX idx_request_log_style_composition (style_composition_id);
