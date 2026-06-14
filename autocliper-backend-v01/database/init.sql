-- AutoCliper Backend v0.1 — Database Schema
-- Database: autoclip_v1

CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(20) NOT NULL UNIQUE,
    youtube_url VARCHAR(2048) NOT NULL,
    video_duration FLOAT DEFAULT NULL,
    status ENUM(
        'validating', 'downloading', 'extracting', 'uploading',
        'queued', 'processing', 'rendering',
        'completed', 'failed', 'timeout'
    ) NOT NULL DEFAULT 'validating',
    render_progress VARCHAR(10) DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    error_details JSON DEFAULT NULL,
    clips_data JSON DEFAULT NULL,
    clips_total INT DEFAULT 0,
    clips_success INT DEFAULT 0,
    clips_failed INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_job_id (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
