-- ============================================================================
-- Migration: Multi-Platform Social Media Accounts
-- Date: 2026-06-04
-- Description: Convert TikTok-specific tables to generic social accounts
-- ============================================================================

-- 1. Create new social_accounts table (generic for all platforms)
CREATE TABLE IF NOT EXISTS social_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    platform VARCHAR(30) NOT NULL DEFAULT 'tiktok',  -- 'youtube', 'facebook', 'instagram', 'x', 'tiktok'
    account_name VARCHAR(100) NOT NULL,
    login_type VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'email', 'username', 'phone', 'manual', 'google', 'oauth'
    login_identifier VARCHAR(255) NOT NULL DEFAULT '',
    password_encrypted VARCHAR(500) NOT NULL DEFAULT '',
    
    -- Platform-specific username/ID
    platform_username VARCHAR(100) NULL,  -- @username for the platform
    platform_user_id VARCHAR(100) NULL,   -- Platform's internal user ID
    
    -- Configuration
    proxy_url VARCHAR(255) NULL,
    daily_upload_limit INT DEFAULT 3,
    uploads_today INT DEFAULT 0,
    last_upload_at TIMESTAMP NULL,
    last_upload_reset_date DATE NULL,
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'active',  -- 'active', 'suspended', 'needs_verification', 'inactive'
    health_score INT DEFAULT 100,
    
    -- Stats
    total_uploads INT DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    
    -- Metadata
    notes TEXT NULL,
    extra_data JSON NULL,  -- Platform-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_platform (user_id, platform),
    INDEX idx_platform_status (platform, status)
);

-- 2. Create social_sessions table
CREATE TABLE IF NOT EXISTS social_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    platform VARCHAR(30) NOT NULL,
    
    -- Session data
    cookies JSON NULL,
    local_storage JSON NULL,
    session_storage JSON NULL,
    browser_context JSON NULL,
    access_token TEXT NULL,       -- For OAuth-based platforms
    refresh_token TEXT NULL,      -- For OAuth-based platforms
    token_expires_at TIMESTAMP NULL,
    
    -- Fingerprint
    fingerprint_id INT NULL,
    
    -- Status
    is_valid BOOLEAN DEFAULT TRUE,
    login_method VARCHAR(30) NULL,
    last_validated_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    validation_error TEXT NULL,
    expires_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_account_valid (account_id, is_valid),
    INDEX idx_platform (platform)
);

-- 3. Create social_upload_queue table
CREATE TABLE IF NOT EXISTS social_upload_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    account_id INT NOT NULL,
    platform VARCHAR(30) NOT NULL,
    
    -- Source video
    request_log_id INT NULL,
    clip_index INT NULL,
    video_path VARCHAR(500) NOT NULL,
    video_size_bytes BIGINT NULL,
    video_duration_seconds FLOAT NULL,
    
    -- Content
    title VARCHAR(500) NULL,       -- For YouTube/Facebook
    caption TEXT NULL,             -- Description/Caption
    hashtags JSON NULL,
    mentions JSON NULL,
    music_id VARCHAR(100) NULL,
    thumbnail_path VARCHAR(500) NULL,  -- For YouTube
    
    -- Settings
    privacy_level VARCHAR(20) DEFAULT 'public',  -- 'public', 'unlisted', 'private', 'friends'
    allow_comments BOOLEAN DEFAULT TRUE,
    allow_duet BOOLEAN DEFAULT TRUE,      -- TikTok
    allow_stitch BOOLEAN DEFAULT TRUE,    -- TikTok
    made_for_kids BOOLEAN DEFAULT FALSE,  -- YouTube
    category_id VARCHAR(50) NULL,         -- YouTube category
    
    -- Scheduling
    scheduled_at TIMESTAMP NULL,
    priority INT DEFAULT 5,
    
    -- Status
    status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'processing', 'uploading', 'published', 'failed', 'cancelled'
    progress_percent INT DEFAULT 0,
    
    -- Result
    platform_video_id VARCHAR(100) NULL,
    platform_url VARCHAR(500) NULL,
    
    -- Error handling
    error_message TEXT NULL,
    error_code VARCHAR(50) NULL,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    last_retry_at TIMESTAMP NULL,
    
    -- Timestamps
    processing_started_at TIMESTAMP NULL,
    uploaded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_platform (user_id, platform),
    INDEX idx_account_status (account_id, status),
    INDEX idx_status_scheduled (status, scheduled_at)
);

-- 4. Migrate existing TikTok data to new tables
INSERT INTO social_accounts (
    id, user_id, platform, account_name, login_type, login_identifier, 
    password_encrypted, platform_username, platform_user_id, proxy_url,
    daily_upload_limit, uploads_today, last_upload_at, last_upload_reset_date,
    status, health_score, total_uploads, total_views, notes, created_at, updated_at
)
SELECT 
    id, user_id, 'tiktok', account_name, login_type, login_identifier,
    password_encrypted, tiktok_username, tiktok_user_id, proxy_url,
    daily_upload_limit, uploads_today, last_upload_at, last_upload_reset_date,
    status, health_score, total_uploads, total_views, notes, created_at, updated_at
FROM tiktok_accounts
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 5. Migrate sessions
INSERT INTO social_sessions (
    id, account_id, platform, cookies, local_storage, session_storage,
    browser_context, fingerprint_id, is_valid, login_method,
    last_validated_at, last_used_at, validation_error, expires_at,
    created_at, updated_at
)
SELECT 
    id, account_id, 'tiktok', cookies, local_storage, session_storage,
    browser_context, fingerprint_id, is_valid, login_method,
    last_validated_at, last_used_at, validation_error, expires_at,
    created_at, updated_at
FROM tiktok_sessions
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 6. Migrate upload queue
INSERT INTO social_upload_queue (
    id, user_id, account_id, platform, request_log_id, clip_index,
    video_path, video_size_bytes, video_duration_seconds, caption,
    hashtags, mentions, music_id, privacy_level, allow_comments,
    allow_duet, allow_stitch, scheduled_at, priority, status,
    progress_percent, platform_video_id, platform_url, error_message,
    error_code, retry_count, max_retries, last_retry_at,
    processing_started_at, uploaded_at, created_at
)
SELECT 
    id, user_id, account_id, 'tiktok', request_log_id, clip_index,
    video_path, video_size_bytes, video_duration_seconds, caption,
    hashtags, mentions, music_id, privacy_level, allow_comments,
    allow_duet, allow_stitch, scheduled_at, priority, status,
    progress_percent, tiktok_video_id, tiktok_url, error_message,
    error_code, retry_count, max_retries, last_retry_at,
    processing_started_at, uploaded_at, created_at
FROM upload_queue
ON DUPLICATE KEY UPDATE created_at = upload_queue.created_at;

-- 7. Create view for backward compatibility
CREATE OR REPLACE VIEW v_social_account_stats AS
SELECT 
    sa.id,
    sa.user_id,
    sa.platform,
    sa.account_name,
    sa.platform_username,
    sa.status,
    sa.health_score,
    sa.uploads_today,
    sa.daily_upload_limit,
    sa.total_uploads,
    sa.total_views,
    CASE WHEN ss.is_valid = 1 THEN 'valid' ELSE 'invalid' END as session_status,
    (SELECT COUNT(*) FROM social_upload_queue sq WHERE sq.account_id = sa.id AND sq.status = 'pending') as pending_uploads,
    (SELECT COUNT(*) FROM social_upload_queue sq WHERE sq.account_id = sa.id AND sq.status = 'published' AND DATE(sq.uploaded_at) = CURDATE()) as published_today
FROM social_accounts sa
LEFT JOIN social_sessions ss ON sa.id = ss.account_id AND ss.is_valid = 1;

SELECT 'Migration completed successfully!' as status;
