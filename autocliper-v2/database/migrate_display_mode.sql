-- Add display_mode column to remotion_caption_templates
-- Controls how words appear: word_by_word, phrase, sentence

ALTER TABLE remotion_caption_templates 
ADD COLUMN display_mode VARCHAR(20) NOT NULL DEFAULT 'phrase' 
AFTER highlight_transition_duration;

-- Also add to legacy caption_styles config (via JSON — no schema change needed)
-- display_mode is stored in config JSON: {"display_mode": "phrase"}
