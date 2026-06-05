-- ═══════════════════════════════════════════════════════════════════════════
-- AutoCliper Automate - TikTok Upload Automation
-- Database Migration Script
-- ═══════════════════════════════════════════════════════════════════════════

USE autocliper;

-- ─── tiktok_accounts ────────────────────────────────────────────────────────
-- Menyimpan informasi akun TikTok untuk login multi-akun

CREATE TABLE IF NOT EXISTS tiktok_accounts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_name VARCHAR(100) NOT NULL COMMENT 'Label untuk identifikasi akun',
  login_type ENUM('email', 'username', 'phone') NOT NULL,
  login_identifier VARCHAR(255) NOT NULL COMMENT 'Email/username/nomor telepon',
  password_encrypted VARCHAR(500) NOT NULL COMMENT 'Password terenkripsi (Fernet)',
  tiktok_username VARCHAR(100) DEFAULT NULL COMMENT 'Username TikTok setelah login',
  tiktok_user_id VARCHAR(50) DEFAULT NULL COMMENT 'TikTok internal user ID',
  proxy_url VARCHAR(255) DEFAULT NULL COMMENT 'Proxy khusus untuk akun ini',
  daily_upload_limit INT DEFAULT 3 COMMENT 'Batas upload per hari',
  uploads_today INT DEFAULT 0 COMMENT 'Counter upload hari ini',
  last_upload_at TIMESTAMP NULL COMMENT 'Waktu upload terakhir',
  last_upload_reset_date DATE DEFAULT NULL COMMENT 'Tanggal terakhir reset counter',
  status ENUM('active', 'suspended', 'needs_verification', 'needs_captcha', 'inactive') DEFAULT 'active',
  health_score INT DEFAULT 100 COMMENT 'Skor kesehatan akun (0-100)',
  total_uploads INT DEFAULT 0 COMMENT 'Total upload sepanjang waktu',
  total_views INT DEFAULT 0 COMMENT 'Total views dari semua video',
  notes TEXT COMMENT 'Catatan tambahan',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_account (user_id, login_identifier),
  INDEX idx_user_status (user_id, status),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─── browser_fingerprints ───────────────────────────────────────────────────
-- Menyimpan fingerprint browser untuk rotasi anti-detection

CREATE TABLE IF NOT EXISTS browser_fingerprints (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  fingerprint_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL COMMENT 'Nama deskriptif fingerprint',
  user_agent VARCHAR(500) NOT NULL,
  viewport_width INT NOT NULL DEFAULT 1920,
  viewport_height INT NOT NULL DEFAULT 1080,
  device_scale_factor FLOAT DEFAULT 1.0,
  is_mobile BOOLEAN DEFAULT FALSE,
  has_touch BOOLEAN DEFAULT FALSE,
  platform VARCHAR(50) NOT NULL COMMENT 'Win32, MacIntel, Linux x86_64',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  locale VARCHAR(20) NOT NULL DEFAULT 'id-ID',
  color_depth INT DEFAULT 24,
  webgl_vendor VARCHAR(255) DEFAULT NULL,
  webgl_renderer VARCHAR(255) DEFAULT NULL,
  extra_headers JSON DEFAULT NULL COMMENT 'Custom headers tambahan',
  extra_args JSON DEFAULT NULL COMMENT 'Browser launch args tambahan',
  last_used_at TIMESTAMP NULL,
  use_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_active (is_active),
  INDEX idx_use_count (use_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── tiktok_sessions ────────────────────────────────────────────────────────
-- Menyimpan cookies dan session data untuk persistent login

CREATE TABLE IF NOT EXISTS tiktok_sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  cookies JSON NOT NULL COMMENT 'Browser cookies',
  local_storage JSON DEFAULT NULL COMMENT 'localStorage data',
  session_storage JSON DEFAULT NULL COMMENT 'sessionStorage data',
  browser_context JSON DEFAULT NULL COMMENT 'Browser state (viewport, user agent, dll)',
  fingerprint_id INT DEFAULT NULL COMMENT 'FK ke browser_fingerprints',
  is_valid BOOLEAN DEFAULT TRUE,
  login_method VARCHAR(50) DEFAULT NULL COMMENT 'Metode login terakhir',
  last_validated_at TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  validation_error TEXT DEFAULT NULL COMMENT 'Error message jika invalid',
  expires_at TIMESTAMP NULL COMMENT 'Perkiraan waktu expired',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (fingerprint_id) REFERENCES browser_fingerprints(id) ON DELETE SET NULL,
  INDEX idx_account_valid (account_id, is_valid),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── upload_queue ───────────────────────────────────────────────────────────
-- Antrian upload video ke TikTok

CREATE TABLE IF NOT EXISTS upload_queue (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT NOT NULL COMMENT 'Akun TikTok untuk upload',
  request_log_id INT DEFAULT NULL COMMENT 'FK ke request_log (job AutoCliper)',
  clip_index INT DEFAULT NULL COMMENT 'Index clip dari job',
  video_path VARCHAR(500) NOT NULL COMMENT 'Path file video',
  video_size_bytes BIGINT DEFAULT NULL COMMENT 'Ukuran file video',
  video_duration_seconds FLOAT DEFAULT NULL COMMENT 'Durasi video',
  caption TEXT COMMENT 'Caption untuk TikTok',
  hashtags JSON DEFAULT NULL COMMENT 'Array hashtag',
  mentions JSON DEFAULT NULL COMMENT 'Array @mentions',
  music_id VARCHAR(100) DEFAULT NULL COMMENT 'TikTok music/sound ID',
  privacy_level ENUM('public', 'friends', 'private') DEFAULT 'public',
  allow_comments BOOLEAN DEFAULT TRUE,
  allow_duet BOOLEAN DEFAULT TRUE,
  allow_stitch BOOLEAN DEFAULT TRUE,
  scheduled_at TIMESTAMP NULL COMMENT 'Waktu jadwal upload',
  priority INT DEFAULT 5 COMMENT '1=highest, 10=lowest',
  status ENUM('pending', 'processing', 'uploading', 'published', 'failed', 'cancelled') DEFAULT 'pending',
  progress_percent INT DEFAULT 0 COMMENT 'Progress upload (0-100)',
  tiktok_video_id VARCHAR(100) DEFAULT NULL COMMENT 'ID video setelah upload sukses',
  tiktok_url VARCHAR(255) DEFAULT NULL COMMENT 'URL video di TikTok',
  error_message TEXT DEFAULT NULL COMMENT 'Pesan error jika gagal',
  error_code VARCHAR(50) DEFAULT NULL COMMENT 'Kode error untuk kategorisasi',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  last_retry_at TIMESTAMP NULL,
  processing_started_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TIMESTAMP NULL COMMENT 'Waktu berhasil upload',
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (request_log_id) REFERENCES request_log(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at),
  INDEX idx_account_status (account_id, status),
  INDEX idx_user_status (user_id, status),
  INDEX idx_priority_scheduled (priority, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ─── upload_history ─────────────────────────────────────────────────────────
-- Log riwayat dan event upload untuk tracking dan debugging

CREATE TABLE IF NOT EXISTS upload_history (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upload_queue_id INT NOT NULL,
  account_id INT NOT NULL,
  action ENUM(
    'queued',
    'processing_started',
    'session_loaded',
    'session_invalid',
    'login_started',
    'login_success',
    'login_failed',
    'captcha_detected',
    'captcha_solved',
    'verification_required',
    'verification_completed',
    'session_warming',
    'upload_page_opened',
    'file_selected',
    'upload_started',
    'upload_progress',
    'caption_entered',
    'hashtags_added',
    'publish_clicked',
    'upload_success',
    'upload_failed',
    'retry_scheduled',
    'cancelled',
    'error'
  ) NOT NULL,
  details JSON DEFAULT NULL COMMENT 'Detail tambahan (error message, progress, dll)',
  screenshot_path VARCHAR(500) DEFAULT NULL COMMENT 'Path screenshot jika ada error',
  duration_ms INT DEFAULT NULL COMMENT 'Durasi aksi dalam milliseconds',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  INDEX idx_upload_queue (upload_queue_id),
  INDEX idx_account (account_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── account_activity_log ───────────────────────────────────────────────────
-- Log aktivitas akun untuk monitoring kesehatan

CREATE TABLE IF NOT EXISTS account_activity_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  activity_type ENUM(
    'login',
    'logout',
    'session_refresh',
    'upload',
    'browse',
    'rate_limited',
    'suspended',
    'recovered',
    'health_check'
  ) NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  INDEX idx_account_type (account_id, activity_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── proxy_configs ──────────────────────────────────────────────────────────
-- Konfigurasi proxy yang tersedia

CREATE TABLE IF NOT EXISTS proxy_configs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  proxy_type ENUM('http', 'https', 'socks4', 'socks5') NOT NULL DEFAULT 'http',
  host VARCHAR(255) NOT NULL,
  port INT NOT NULL,
  username VARCHAR(100) DEFAULT NULL,
  password_encrypted VARCHAR(500) DEFAULT NULL,
  country_code VARCHAR(5) DEFAULT NULL COMMENT 'ISO country code',
  city VARCHAR(100) DEFAULT NULL,
  is_residential BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_tested_at TIMESTAMP NULL,
  last_test_success BOOLEAN DEFAULT NULL,
  last_test_latency_ms INT DEFAULT NULL,
  use_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_active_country (is_active, country_code),
  INDEX idx_residential (is_residential)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── scheduled_jobs ─────────────────────────────────────────────────────────
-- Konfigurasi scheduled jobs untuk upload terjadwal

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  cron_expression VARCHAR(100) DEFAULT NULL COMMENT 'Cron schedule (e.g., "0 10 * * *")',
  account_selection ENUM('specific', 'round_robin', 'least_used', 'random') DEFAULT 'round_robin',
  account_ids JSON DEFAULT NULL COMMENT 'Array of account IDs untuk specific selection',
  default_hashtags JSON DEFAULT NULL COMMENT 'Default hashtags untuk upload',
  default_privacy ENUM('public', 'friends', 'private') DEFAULT 'public',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP NULL,
  next_run_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, is_active),
  INDEX idx_next_run (next_run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS untuk kemudahan query
-- ═══════════════════════════════════════════════════════════════════════════

-- View: Account overview dengan statistik
CREATE OR REPLACE VIEW v_tiktok_account_stats AS
SELECT 
  ta.id,
  ta.user_id,
  ta.account_name,
  ta.tiktok_username,
  ta.login_type,
  ta.status,
  ta.health_score,
  ta.daily_upload_limit,
  ta.uploads_today,
  ta.total_uploads,
  ta.total_views,
  ta.last_upload_at,
  ts.is_valid AS session_valid,
  ts.last_validated_at AS session_last_validated,
  (SELECT COUNT(*) FROM upload_queue uq WHERE uq.account_id = ta.id AND uq.status = 'pending') AS pending_uploads,
  (SELECT COUNT(*) FROM upload_queue uq WHERE uq.account_id = ta.id AND uq.status = 'failed') AS failed_uploads,
  ta.created_at
FROM tiktok_accounts ta
LEFT JOIN tiktok_sessions ts ON ta.id = ts.account_id AND ts.is_valid = TRUE;

-- View: Upload queue dengan detail akun
CREATE OR REPLACE VIEW v_upload_queue_detail AS
SELECT 
  uq.id,
  uq.user_id,
  uq.account_id,
  ta.account_name,
  ta.tiktok_username,
  uq.request_log_id,
  uq.clip_index,
  uq.video_path,
  uq.caption,
  uq.hashtags,
  uq.scheduled_at,
  uq.priority,
  uq.status,
  uq.progress_percent,
  uq.tiktok_video_id,
  uq.tiktok_url,
  uq.error_message,
  uq.retry_count,
  uq.max_retries,
  uq.created_at,
  uq.uploaded_at
FROM upload_queue uq
JOIN tiktok_accounts ta ON uq.account_id = ta.id;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORED PROCEDURES
-- ═══════════════════════════════════════════════════════════════════════════

DELIMITER //

-- Procedure: Reset daily upload counter
-- Jalankan setiap hari jam 00:00
CREATE PROCEDURE IF NOT EXISTS sp_reset_daily_uploads()
BEGIN
  UPDATE tiktok_accounts 
  SET uploads_today = 0, 
      last_upload_reset_date = CURDATE()
  WHERE last_upload_reset_date IS NULL 
     OR last_upload_reset_date < CURDATE();
END //

-- Procedure: Get next upload job
-- Mengambil job berikutnya yang siap diproses
CREATE PROCEDURE IF NOT EXISTS sp_get_next_upload_job()
BEGIN
  SELECT uq.*, ta.status AS account_status
  FROM upload_queue uq
  JOIN tiktok_accounts ta ON uq.account_id = ta.id
  WHERE uq.status = 'pending'
    AND (uq.scheduled_at IS NULL OR uq.scheduled_at <= NOW())
    AND ta.status = 'active'
  ORDER BY uq.priority ASC, uq.scheduled_at ASC, uq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END //

-- Procedure: Update account health score
CREATE PROCEDURE IF NOT EXISTS sp_update_account_health(
  IN p_account_id INT,
  IN p_success BOOLEAN
)
BEGIN
  DECLARE current_score INT;
  DECLARE new_score INT;
  
  SELECT health_score INTO current_score FROM tiktok_accounts WHERE id = p_account_id;
  
  IF p_success THEN
    SET new_score = LEAST(100, current_score + 5);
  ELSE
    SET new_score = GREATEST(0, current_score - 15);
  END IF;
  
  UPDATE tiktok_accounts 
  SET health_score = new_score,
      status = CASE 
        WHEN new_score <= 20 THEN 'suspended'
        ELSE status
      END
  WHERE id = p_account_id;
END //

DELIMITER ;

-- ═══════════════════════════════════════════════════════════════════════════
-- EVENT SCHEDULER
-- ═══════════════════════════════════════════════════════════════════════════

-- Pastikan event scheduler aktif
SET GLOBAL event_scheduler = ON;

-- Event: Reset daily uploads setiap tengah malam
CREATE EVENT IF NOT EXISTS evt_reset_daily_uploads
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURDATE()) + INTERVAL 1 DAY)
DO CALL sp_reset_daily_uploads();

-- ═══════════════════════════════════════════════════════════════════════════
-- SELESAI
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'Migration completed successfully!' AS status;


-- ═══════════════════════════════════════════════════════════════════════════
-- ADDITIONAL TABLES (Security, Audit, Verification)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── audit_log ──────────────────────────────────────────────────────────────
-- Log semua aksi sensitif untuk security audit

CREATE TABLE IF NOT EXISTS audit_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action ENUM(
    'account_created', 'account_updated', 'account_deleted',
    'upload_created', 'upload_cancelled', 'upload_retried',
    'login_manual', 'logout_manual', 'session_refreshed',
    'settings_changed', 'bulk_action', 'password_changed'
  ) NOT NULL,
  resource_type VARCHAR(50) NOT NULL COMMENT 'tiktok_account, upload_queue, etc',
  resource_id INT NOT NULL,
  old_value JSON DEFAULT NULL,
  new_value JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── audit_log_archive ──────────────────────────────────────────────────────
-- Archive untuk audit log yang sudah lama (> 1 tahun)

CREATE TABLE IF NOT EXISTS audit_log_archive LIKE audit_log;

-- ─── pending_verifications ──────────────────────────────────────────────────
-- Track 2FA/CAPTCHA yang membutuhkan intervensi user

CREATE TABLE IF NOT EXISTS pending_verifications (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  upload_queue_id INT DEFAULT NULL,
  verification_type ENUM('sms_otp', 'email_otp', 'captcha', 'phone', 'suspicious_login', 'other') NOT NULL,
  screenshot_path VARCHAR(500) DEFAULT NULL,
  browser_session_id VARCHAR(100) DEFAULT NULL COMMENT 'For remote browser access (VNC)',
  details JSON DEFAULT NULL COMMENT 'Additional context (phone number hint, etc)',
  status ENUM('pending', 'solved', 'timeout', 'skipped') DEFAULT 'pending',
  notified_channels JSON DEFAULT NULL COMMENT '["telegram", "email", "websocket"]',
  notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  timeout_at TIMESTAMP NOT NULL,
  solved_at TIMESTAMP NULL,
  solved_by ENUM('user_input', 'remote_browser', 'auto_retry', 'skipped') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_account_status (account_id, status),
  INDEX idx_timeout (timeout_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── alert_notifications ────────────────────────────────────────────────────
-- Log notifikasi yang dikirim untuk alerting

CREATE TABLE IF NOT EXISTS alert_notifications (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  alert_type ENUM(
    'upload_failed', 'account_suspended', 'queue_overload',
    'daily_limit_reached', 'captcha_detected', '2fa_required',
    'disk_space_low', 'service_error', 'rate_limited'
  ) NOT NULL,
  severity ENUM('info', 'warning', 'critical') NOT NULL,
  channel ENUM('telegram', 'email', 'websocket') NOT NULL,
  recipient VARCHAR(255) NOT NULL COMMENT 'chat_id, email address, user_id',
  message TEXT NOT NULL,
  related_account_id INT DEFAULT NULL,
  related_upload_id INT DEFAULT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivery_status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  
  INDEX idx_type_severity (alert_type, severity),
  INDEX idx_channel (channel),
  INDEX idx_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- ALTER EXISTING TABLES (Additional columns)
-- ═══════════════════════════════════════════════════════════════════════════

-- Tambahan kolom untuk upload_queue
ALTER TABLE upload_queue 
ADD COLUMN IF NOT EXISTS deadline_status ENUM('on_time', 'late', 'missed') DEFAULT 'on_time' AFTER status,
ADD COLUMN IF NOT EXISTS verification_type VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS verification_screenshot_path VARCHAR(500) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_timeout_at TIMESTAMP NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- CLEANUP STORED PROCEDURES
-- ═══════════════════════════════════════════════════════════════════════════

DELIMITER //

-- Procedure: Cleanup old data (daily)
CREATE PROCEDURE IF NOT EXISTS sp_cleanup_old_data()
BEGIN
  DECLARE deleted_history INT DEFAULT 0;
  DECLARE deleted_activity INT DEFAULT 0;
  DECLARE archived_audit INT DEFAULT 0;
  
  -- Upload history older than 90 days
  DELETE FROM upload_history 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
  SET deleted_history = ROW_COUNT();
  
  -- Activity log older than 30 days
  DELETE FROM account_activity_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
  SET deleted_activity = ROW_COUNT();
  
  -- Archive audit log older than 1 year
  INSERT INTO audit_log_archive 
  SELECT * FROM audit_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
  SET archived_audit = ROW_COUNT();
  
  DELETE FROM audit_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
  
  -- Cleanup resolved/timeout verifications older than 7 days
  DELETE FROM pending_verifications
  WHERE status IN ('solved', 'timeout', 'skipped')
    AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
  
  -- Cleanup old alert notifications older than 30 days
  DELETE FROM alert_notifications
  WHERE sent_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
  
  -- Log cleanup results
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, new_value)
  VALUES (0, 'bulk_action', 'system', 0, JSON_OBJECT(
    'action', 'cleanup_old_data',
    'deleted_history', deleted_history,
    'deleted_activity', deleted_activity,
    'archived_audit', archived_audit
  ));
END //

-- Procedure: Cleanup expired sessions
CREATE PROCEDURE IF NOT EXISTS sp_cleanup_expired_sessions()
BEGIN
  DECLARE invalidated INT DEFAULT 0;
  DECLARE deleted INT DEFAULT 0;
  
  -- Mark expired sessions as invalid
  UPDATE tiktok_sessions 
  SET is_valid = FALSE, 
      validation_error = 'Session expired (auto-cleanup)'
  WHERE expires_at < NOW() AND is_valid = TRUE;
  SET invalidated = ROW_COUNT();
  
  -- Delete very old invalid sessions (> 30 days)
  DELETE FROM tiktok_sessions 
  WHERE is_valid = FALSE 
    AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
  SET deleted = ROW_COUNT();
  
  -- Handle verification timeouts
  UPDATE pending_verifications
  SET status = 'timeout'
  WHERE status = 'pending' AND timeout_at < NOW();
END //

-- Procedure: Handle missed deadlines
CREATE PROCEDURE IF NOT EXISTS sp_handle_missed_deadlines()
BEGIN
  -- Mark uploads as late if overdue < 24 hours
  UPDATE upload_queue
  SET deadline_status = 'late'
  WHERE status = 'pending'
    AND scheduled_at IS NOT NULL
    AND scheduled_at < NOW()
    AND scheduled_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    AND deadline_status = 'on_time';
  
  -- Mark uploads as missed if overdue > 24 hours
  UPDATE upload_queue
  SET deadline_status = 'missed',
      status = 'failed',
      error_message = 'Deadline missed (> 24 hours overdue)'
  WHERE status = 'pending'
    AND scheduled_at IS NOT NULL
    AND scheduled_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    AND deadline_status != 'missed';
END //

DELIMITER ;

-- ═══════════════════════════════════════════════════════════════════════════
-- EVENTS (Scheduled Jobs)
-- ═══════════════════════════════════════════════════════════════════════════

-- Daily cleanup at 3 AM
DROP EVENT IF EXISTS evt_cleanup_old_data;
CREATE EVENT evt_cleanup_old_data
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURDATE()) + INTERVAL 1 DAY + INTERVAL 3 HOUR)
DO CALL sp_cleanup_old_data();

-- Session cleanup every 6 hours
DROP EVENT IF EXISTS evt_cleanup_sessions;
CREATE EVENT evt_cleanup_sessions
ON SCHEDULE EVERY 6 HOUR
DO CALL sp_cleanup_expired_sessions();

-- Check missed deadlines every 15 minutes
DROP EVENT IF EXISTS evt_check_deadlines;
CREATE EVENT evt_check_deadlines
ON SCHEDULE EVERY 15 MINUTE
DO CALL sp_handle_missed_deadlines();

-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'Migration v2 (security, audit, verification) completed!' AS status;


-- ═══════════════════════════════════════════════════════════════════════════
-- ANALYTICS & DASHBOARD TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── video_performance ──────────────────────────────────────────────────────
-- Track performance metrics for uploaded videos

CREATE TABLE IF NOT EXISTS video_performance (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upload_queue_id INT NOT NULL,
  account_id INT NOT NULL,
  tiktok_video_id VARCHAR(100) NOT NULL,
  
  -- Metrics (updated periodically via scraping/API)
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,
  avg_watch_time_seconds FLOAT DEFAULT NULL,
  completion_rate FLOAT DEFAULT NULL COMMENT 'Percentage of viewers who watched full video',
  
  -- Posting context
  posted_at TIMESTAMP NOT NULL,
  posted_hour TINYINT GENERATED ALWAYS AS (HOUR(posted_at)) STORED,
  posted_day_of_week TINYINT GENERATED ALWAYS AS (DAYOFWEEK(posted_at)) STORED,
  
  -- Content context
  video_duration_seconds FLOAT DEFAULT NULL,
  hashtags JSON DEFAULT NULL,
  caption_length INT DEFAULT NULL,
  has_music BOOLEAN DEFAULT NULL,
  
  -- Tracking
  last_fetched_at TIMESTAMP NULL,
  fetch_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_video (tiktok_video_id),
  INDEX idx_account_posted (account_id, posted_at),
  INDEX idx_posted_hour (account_id, posted_hour),
  INDEX idx_posted_day (account_id, posted_day_of_week),
  INDEX idx_views (account_id, views DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── caption_templates ──────────────────────────────────────────────────────
-- Templates for auto-generating captions

CREATE TABLE IF NOT EXISTS caption_templates (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT DEFAULT NULL COMMENT 'NULL = applies to all user accounts',
  name VARCHAR(100) NOT NULL,
  template TEXT NOT NULL COMMENT 'Supports {hook}, {hashtags}, {date}, {account}',
  default_hashtags JSON DEFAULT NULL,
  niche VARCHAR(50) DEFAULT NULL COMMENT 'gaming, comedy, education, etc',
  is_default BOOLEAN DEFAULT FALSE,
  use_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_user_default (user_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── trending_hashtags ──────────────────────────────────────────────────────
-- Cache for trending hashtags (updated periodically)

CREATE TABLE IF NOT EXISTS trending_hashtags (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hashtag VARCHAR(100) NOT NULL,
  category VARCHAR(50) DEFAULT NULL COMMENT 'general, gaming, comedy, etc',
  country_code VARCHAR(5) DEFAULT 'ID',
  view_count BIGINT DEFAULT 0,
  video_count INT DEFAULT 0,
  trend_score FLOAT DEFAULT 0 COMMENT 'Calculated trend score',
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NULL,
  
  UNIQUE KEY unique_hashtag_country (hashtag, country_code),
  INDEX idx_category (category),
  INDEX idx_trend_score (trend_score DESC),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── account_warmup ─────────────────────────────────────────────────────────
-- Track account warm-up progress

CREATE TABLE IF NOT EXISTS account_warmup (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL UNIQUE,
  warmup_phase ENUM('passive', 'light_engagement', 'active_engagement', 'ready', 'paused') DEFAULT 'passive',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  phase_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Total progress
  total_videos_watched INT DEFAULT 0,
  total_likes_given INT DEFAULT 0,
  total_follows_given INT DEFAULT 0,
  total_comments_given INT DEFAULT 0,
  total_browse_minutes INT DEFAULT 0,
  
  -- Daily targets
  daily_watch_target INT DEFAULT 30,
  daily_like_target INT DEFAULT 10,
  daily_follow_target INT DEFAULT 5,
  
  -- Today's progress (reset daily)
  today_videos_watched INT DEFAULT 0,
  today_likes_given INT DEFAULT 0,
  today_follows_given INT DEFAULT 0,
  today_browse_minutes INT DEFAULT 0,
  last_activity_date DATE DEFAULT NULL,
  
  -- Settings
  auto_advance_phase BOOLEAN DEFAULT TRUE,
  skip_weekends BOOLEAN DEFAULT FALSE,
  preferred_niches JSON DEFAULT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_warmup_at TIMESTAMP NULL,
  next_warmup_at TIMESTAMP NULL,
  error_count INT DEFAULT 0,
  last_error TEXT DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  INDEX idx_phase (warmup_phase),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── warmup_activity_log ────────────────────────────────────────────────────
-- Log warm-up activities

CREATE TABLE IF NOT EXISTS warmup_activity_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  activity_type ENUM('browse', 'watch', 'like', 'follow', 'unfollow', 'comment', 'share') NOT NULL,
  target_video_id VARCHAR(100) DEFAULT NULL,
  target_user_id VARCHAR(100) DEFAULT NULL,
  duration_seconds INT DEFAULT NULL,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  INDEX idx_account_date (account_id, created_at),
  INDEX idx_activity_type (activity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── captcha_solve_log ──────────────────────────────────────────────────────
-- Track CAPTCHA solving attempts and costs

CREATE TABLE IF NOT EXISTS captcha_solve_log (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  upload_queue_id INT DEFAULT NULL,
  captcha_type VARCHAR(50) NOT NULL COMMENT 'recaptcha_v2, hcaptcha, funcaptcha, etc',
  solver_service VARCHAR(50) NOT NULL COMMENT '2captcha, anti-captcha, capsolver, manual',
  site_key VARCHAR(255) DEFAULT NULL,
  page_url VARCHAR(500) DEFAULT NULL,
  
  -- Result
  status ENUM('pending', 'solved', 'failed', 'timeout', 'manual') NOT NULL DEFAULT 'pending',
  solve_time_ms INT DEFAULT NULL,
  cost_usd DECIMAL(10, 6) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  solved_at TIMESTAMP NULL,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE SET NULL,
  INDEX idx_account (account_id),
  INDEX idx_status (status),
  INDEX idx_service (solver_service),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS FOR ANALYTICS
-- ═══════════════════════════════════════════════════════════════════════════

-- View: Account performance summary
CREATE OR REPLACE VIEW v_account_performance AS
SELECT 
  account_id,
  COUNT(*) as total_videos,
  SUM(views) as total_views,
  ROUND(AVG(views), 0) as avg_views,
  SUM(likes) as total_likes,
  ROUND(AVG(likes), 0) as avg_likes,
  SUM(comments) as total_comments,
  SUM(shares) as total_shares,
  ROUND(AVG((likes + comments + shares) / NULLIF(views, 0) * 100), 2) as avg_engagement_rate,
  MAX(views) as best_video_views,
  MIN(posted_at) as first_post,
  MAX(posted_at) as last_post
FROM video_performance
GROUP BY account_id;

-- View: Best posting hours per account
CREATE OR REPLACE VIEW v_best_posting_hours AS
SELECT 
  account_id,
  posted_hour,
  COUNT(*) as video_count,
  ROUND(AVG(views), 0) as avg_views,
  ROUND(AVG(likes), 0) as avg_likes,
  ROUND(AVG((likes + comments + shares) / NULLIF(views, 0) * 100), 2) as avg_engagement_rate,
  RANK() OVER (PARTITION BY account_id ORDER BY AVG(views) DESC) as hour_rank
FROM video_performance
WHERE posted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY account_id, posted_hour
HAVING video_count >= 2;

-- View: Best posting days per account
CREATE OR REPLACE VIEW v_best_posting_days AS
SELECT 
  account_id,
  posted_day_of_week,
  CASE posted_day_of_week
    WHEN 1 THEN 'Sunday'
    WHEN 2 THEN 'Monday'
    WHEN 3 THEN 'Tuesday'
    WHEN 4 THEN 'Wednesday'
    WHEN 5 THEN 'Thursday'
    WHEN 6 THEN 'Friday'
    WHEN 7 THEN 'Saturday'
  END as day_name,
  COUNT(*) as video_count,
  ROUND(AVG(views), 0) as avg_views,
  ROUND(AVG((likes + comments + shares) / NULLIF(views, 0) * 100), 2) as avg_engagement_rate
FROM video_performance
WHERE posted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY account_id, posted_day_of_week;

-- View: CAPTCHA solving stats
CREATE OR REPLACE VIEW v_captcha_stats AS
SELECT 
  solver_service,
  captcha_type,
  COUNT(*) as total_attempts,
  SUM(status = 'solved') as solved_count,
  SUM(status = 'failed') as failed_count,
  SUM(status = 'timeout') as timeout_count,
  ROUND(AVG(CASE WHEN status = 'solved' THEN solve_time_ms END), 0) as avg_solve_time_ms,
  ROUND(SUM(cost_usd), 4) as total_cost_usd,
  ROUND(SUM(status = 'solved') / COUNT(*) * 100, 1) as success_rate
FROM captcha_solve_log
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY solver_service, captcha_type;

-- View: Warmup progress summary
CREATE OR REPLACE VIEW v_warmup_progress AS
SELECT 
  aw.account_id,
  ta.account_name,
  ta.tiktok_username,
  aw.warmup_phase,
  aw.started_at,
  DATEDIFF(NOW(), aw.started_at) as days_in_warmup,
  aw.total_videos_watched,
  aw.total_likes_given,
  aw.total_follows_given,
  aw.today_videos_watched,
  aw.today_likes_given,
  aw.is_active,
  aw.last_warmup_at,
  aw.next_warmup_at
FROM account_warmup aw
JOIN tiktok_accounts ta ON aw.account_id = ta.id;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORED PROCEDURES FOR WARMUP
-- ═══════════════════════════════════════════════════════════════════════════

DELIMITER //

-- Procedure: Reset daily warmup counters
CREATE PROCEDURE IF NOT EXISTS sp_reset_daily_warmup()
BEGIN
  UPDATE account_warmup
  SET today_videos_watched = 0,
      today_likes_given = 0,
      today_follows_given = 0,
      today_browse_minutes = 0,
      last_activity_date = CURDATE()
  WHERE last_activity_date IS NULL 
     OR last_activity_date < CURDATE();
END //

-- Procedure: Auto-advance warmup phase
CREATE PROCEDURE IF NOT EXISTS sp_advance_warmup_phases()
BEGIN
  -- Passive → Light (after 3 days)
  UPDATE account_warmup
  SET warmup_phase = 'light_engagement',
      phase_started_at = NOW()
  WHERE warmup_phase = 'passive'
    AND auto_advance_phase = TRUE
    AND is_active = TRUE
    AND DATEDIFF(NOW(), phase_started_at) >= 3;
  
  -- Light → Active (after 4 days)
  UPDATE account_warmup
  SET warmup_phase = 'active_engagement',
      phase_started_at = NOW()
  WHERE warmup_phase = 'light_engagement'
    AND auto_advance_phase = TRUE
    AND is_active = TRUE
    AND DATEDIFF(NOW(), phase_started_at) >= 4;
  
  -- Active → Ready (after 7 days)
  UPDATE account_warmup
  SET warmup_phase = 'ready',
      phase_started_at = NOW()
  WHERE warmup_phase = 'active_engagement'
    AND auto_advance_phase = TRUE
    AND is_active = TRUE
    AND DATEDIFF(NOW(), phase_started_at) >= 7;
END //

DELIMITER ;

-- Event: Reset daily warmup at midnight
DROP EVENT IF EXISTS evt_reset_daily_warmup;
CREATE EVENT evt_reset_daily_warmup
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURDATE()) + INTERVAL 1 DAY)
DO CALL sp_reset_daily_warmup();

-- Event: Check warmup phase advancement every 6 hours
DROP EVENT IF EXISTS evt_advance_warmup;
CREATE EVENT evt_advance_warmup
ON SCHEDULE EVERY 6 HOUR
DO CALL sp_advance_warmup_phases();

-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'Migration v3 (analytics, warmup, captcha) completed!' AS status;
