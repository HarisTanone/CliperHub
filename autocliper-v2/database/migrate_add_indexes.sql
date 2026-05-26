-- Migration: Add missing indexes for performance
-- Run this on existing databases to improve query performance

USE autocliper;

-- Index on youtube_url for cache lookups (get_by_youtube_url)
CREATE INDEX IF NOT EXISTS idx_request_log_youtube_url 
    ON request_log(youtube_url);

-- Composite index for get_existing_jobs query
CREATE INDEX IF NOT EXISTS idx_request_log_status_output 
    ON request_log(status, output_path(255));

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_request_log_user_status 
    ON request_log(user_id, status);
