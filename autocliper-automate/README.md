# 🚀 AutoCliper Automate — Multi-Platform Social Media Auto Upload

Sistem automasi upload video ke berbagai platform social media (TikTok, YouTube Shorts, Facebook Reels, Instagram Reels, X Video) menggunakan Playwright dengan fitur multi-akun, session management, dan anti-detection.

---

## 📚 Daftar Isi

- [Overview](#-overview)
- [Supported Platforms](#-supported-platforms)
- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Database Schema](#-database-schema)
- [Anti-Detection Strategy](#-anti-detection-strategy)
- [API Endpoints](#-api-endpoints)
- [Alur Kerja](#-alur-kerja)
- [Roadmap Pengembangan](#-roadmap-pengembangan)
- [Struktur Folder](#-struktur-folder)
- [Teknologi](#-teknologi)

---

## 🎯 Overview

**AutoCliper Automate** adalah modul tambahan untuk AutoCliper v2 yang menangani proses upload otomatis video hasil clipping ke berbagai platform social media. Sistem ini dirancang untuk:

1. **Multi-Platform Support** — Upload ke TikTok, YouTube Shorts, Facebook Reels, Instagram Reels, dan X Video
2. **Multi-akun per Platform** — Kelola banyak akun dalam satu dashboard
3. **Session Persistence** — Login sekali, gunakan cookies/session untuk sesi berikutnya
4. **Anti-Detection** — Menghindari deteksi bot oleh platform
5. **Integrasi Seamless** — Terhubung dengan database AutoCliper v2 untuk membaca clip yang sudah diproses

---

## 🌐 Supported Platforms

| Platform | Level | Status | Login Method | Notes |
|----------|-------|--------|--------------|-------|
| **YouTube Shorts** | ⭐⭐⭐⭐⭐ | ✅ Implemented | Google OAuth / Manual | Easiest - uploads via YouTube Studio |
| **Facebook Reels** | ⭐⭐⭐⭐ | 🚧 Planned | Facebook Login / Manual | - |
| **Instagram Reels** | ⭐⭐⭐ | 🚧 Planned | Instagram Login / Manual | Same auth as Facebook |
| **X (Twitter) Video** | ⭐⭐⭐ | 🚧 Planned | X Login / Manual | - |
| **TikTok** | ⭐⭐ | ✅ Implemented | Email/Phone/Username/Manual | Hardest - strict anti-bot |

### Platform Difficulty Explanation

- **YouTube** (Easiest): Google login is straightforward, YouTube Studio upload is reliable
- **Facebook/Instagram** (Medium): Meta's login system has moderate anti-bot measures
- **X** (Medium): Standard OAuth flow with some bot detection
- **TikTok** (Hardest): Aggressive anti-bot detection, requires advanced stealth techniques

---

## ✨ Fitur Utama

### 🔐 Manajemen Akun TikTok

| Fitur | Deskripsi |
|-------|-----------|
| Multi-login | Email, username, atau nomor telepon |
| Session Storage | Simpan cookies & localStorage setelah login sukses |
| Auto-relogin | Deteksi session expired dan relogin otomatis |
| Account Rotation | Rotasi akun untuk distribusi upload |
| Account Health | Monitor status kesehatan setiap akun |

### 📤 Upload Automation

| Fitur | Deskripsi |
|-------|-----------|
| Scheduled Upload | Jadwalkan upload di waktu optimal |
| Queue System | Antrian upload dengan prioritas |
| Caption Integration | Ambil caption dari database AutoCliper |
| Hashtag Generator | Generate hashtag trending otomatis |
| Retry Mechanism | Retry otomatis jika upload gagal |

### 🛡️ Anti-Detection

| Fitur | Deskripsi |
|-------|-----------|
| Human-like Behavior | Simulasi perilaku manusia (delay, scroll, typing) |
| Browser Fingerprint | Rotasi fingerprint browser |
| Proxy Support | Dukungan proxy per akun |
| Rate Limiting | Batasi upload per akun per hari |
| Session Warming | "Pemanasan" session sebelum upload |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AutoCliper Automate                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   Frontend   │◄──►│  FastAPI     │◄──►│  AutoCliper v2 Database  │  │
│  │   (React)    │    │  Backend     │    │  (MySQL)                 │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│                     ┌────────────────┐                                  │
│                     │  Job Scheduler │                                  │
│                     │  (APScheduler) │                                  │
│                     └────────┬───────┘                                  │
│                              │                                           │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Playwright Browser Pool                        │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │  │
│  │  │Browser 1│  │Browser 2│  │Browser 3│  │Browser N│             │  │
│  │  │(Akun A) │  │(Akun B) │  │(Akun C) │  │(Akun N) │             │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│                     ┌────────────────┐                                  │
│                     │    TikTok      │                                  │
│                     │    Platform    │                                  │
│                     └────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```


---

## 💾 Database Schema

### Tabel: `tiktok_accounts`

Menyimpan informasi akun TikTok untuk login.

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `user_id` | INT | FK ke `users.id` (pemilik akun) |
| `account_name` | VARCHAR(100) | Nama label akun (untuk identifikasi) |
| `login_type` | ENUM | `'email'`, `'username'`, `'phone'` |
| `login_identifier` | VARCHAR(255) | Email/username/nomor telepon |
| `password` | VARCHAR(255) | Password (encrypted) |
| `tiktok_username` | VARCHAR(100) | Username TikTok setelah login |
| `proxy_url` | VARCHAR(255) | Proxy khusus untuk akun ini (opsional) |
| `uploads_today` | INT | Counter upload hari ini |
| `last_upload_at` | TIMESTAMP | Waktu upload terakhir |
| `status` | ENUM | `'active'`, `'suspended'`, `'needs_verification'`, `'inactive'` |
| `health_score` | INT | Skor kesehatan akun (0-100) |
| `notes` | TEXT | Catatan tambahan |
| `created_at` | TIMESTAMP | Waktu dibuat |
| `updated_at` | TIMESTAMP | Waktu diupdate |

```sql
CREATE TABLE tiktok_accounts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  login_type ENUM('email', 'username', 'phone') NOT NULL,
  login_identifier VARCHAR(255) NOT NULL,
  password_encrypted VARCHAR(500) NOT NULL,
  tiktok_username VARCHAR(100) DEFAULT NULL,
  proxy_url VARCHAR(255) DEFAULT NULL,
  daily_upload_limit INT DEFAULT 3,
  uploads_today INT DEFAULT 0,
  last_upload_at TIMESTAMP NULL,
  status ENUM('active', 'suspended', 'needs_verification', 'inactive') DEFAULT 'active',
  health_score INT DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_account (user_id, login_identifier)
);
```

### Tabel: `tiktok_sessions`

Menyimpan cookies dan session data untuk persistent login.

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `account_id` | INT | FK ke `tiktok_accounts.id` |
| `cookies` | JSON | Cookies dari browser |
| `local_storage` | JSON | localStorage data |
| `session_storage` | JSON | sessionStorage data |
| `browser_context` | JSON | Browser state (viewport, user agent, dll) |
| `fingerprint_id` | VARCHAR(100) | ID fingerprint yang digunakan |
| `is_valid` | BOOLEAN | Apakah session masih valid |
| `last_validated_at` | TIMESTAMP | Terakhir divalidasi |
| `expires_at` | TIMESTAMP | Perkiraan waktu expired |
| `created_at` | TIMESTAMP | Waktu dibuat |
| `updated_at` | TIMESTAMP | Waktu diupdate |

```sql
CREATE TABLE tiktok_sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  cookies JSON NOT NULL,
  local_storage JSON DEFAULT NULL,
  session_storage JSON DEFAULT NULL,
  browser_context JSON DEFAULT NULL,
  fingerprint_id VARCHAR(100) DEFAULT NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  last_validated_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE
);
```


### Tabel: `upload_queue`

Antrian upload video ke TikTok.

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `user_id` | INT | FK ke `users.id` |
| `account_id` | INT | FK ke `tiktok_accounts.id` (akun untuk upload) |
| `request_log_id` | INT | FK ke `request_log.id` (job AutoCliper) |
| `clip_index` | INT | Index clip dari job |
| `video_path` | VARCHAR(500) | Path file video |
| `caption` | TEXT | Caption untuk TikTok |
| `hashtags` | JSON | Array hashtag |
| `scheduled_at` | TIMESTAMP | Waktu jadwal upload |
| `priority` | INT | Prioritas (1=highest) |
| `status` | ENUM | `'pending'`, `'processing'`, `'uploaded'`, `'failed'`, `'cancelled'` |
| `tiktok_video_id` | VARCHAR(100) | ID video setelah upload sukses |
| `tiktok_url` | VARCHAR(255) | URL video di TikTok |
| `error_message` | TEXT | Pesan error jika gagal |
| `retry_count` | INT | Jumlah percobaan |
| `created_at` | TIMESTAMP | Waktu dibuat |
| `uploaded_at` | TIMESTAMP | Waktu berhasil upload |

```sql
CREATE TABLE upload_queue (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  request_log_id INT NOT NULL,
  clip_index INT NOT NULL,
  video_path VARCHAR(500) NOT NULL,
  caption TEXT,
  hashtags JSON DEFAULT NULL,
  scheduled_at TIMESTAMP NULL,
  priority INT DEFAULT 5,
  status ENUM('pending', 'processing', 'uploaded', 'failed', 'cancelled') DEFAULT 'pending',
  tiktok_video_id VARCHAR(100) DEFAULT NULL,
  tiktok_url VARCHAR(255) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (request_log_id) REFERENCES request_log(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at),
  INDEX idx_account_status (account_id, status)
);
```

### Tabel: `upload_history`

Log riwayat upload untuk analytics.

```sql
CREATE TABLE upload_history (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upload_queue_id INT NOT NULL,
  account_id INT NOT NULL,
  action ENUM('started', 'login_attempt', 'login_success', 'login_failed', 
              'upload_started', 'upload_progress', 'upload_success', 'upload_failed',
              'captcha_detected', 'verification_required', 'session_expired') NOT NULL,
  details JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  INDEX idx_upload_queue (upload_queue_id),
  INDEX idx_account (account_id)
);
```

### Tabel: `browser_fingerprints`

Menyimpan fingerprint browser untuk rotasi.

```sql
CREATE TABLE browser_fingerprints (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  fingerprint_id VARCHAR(100) NOT NULL UNIQUE,
  user_agent VARCHAR(500) NOT NULL,
  viewport_width INT NOT NULL,
  viewport_height INT NOT NULL,
  device_scale_factor FLOAT DEFAULT 1.0,
  is_mobile BOOLEAN DEFAULT FALSE,
  has_touch BOOLEAN DEFAULT FALSE,
  platform VARCHAR(50) NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  locale VARCHAR(20) NOT NULL,
  webgl_vendor VARCHAR(255) DEFAULT NULL,
  webgl_renderer VARCHAR(255) DEFAULT NULL,
  extra_headers JSON DEFAULT NULL,
  last_used_at TIMESTAMP NULL,
  use_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🌐 Multi-Platform Database Schema

Tabel-tabel berikut digunakan untuk menyimpan akun dan upload dari berbagai platform social media (YouTube, Facebook, Instagram, X, TikTok).

### Tabel: `social_accounts`

Menyimpan informasi akun untuk semua platform.

| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `user_id` | INT | FK ke `users.id` |
| `platform` | ENUM | `'youtube'`, `'facebook'`, `'instagram'`, `'x'`, `'tiktok'` |
| `account_name` | VARCHAR(100) | Nama label akun |
| `login_type` | ENUM | `'email'`, `'phone'`, `'username'`, `'manual'`, `'google'` |
| `login_identifier` | VARCHAR(255) | Email/username/phone |
| `password_encrypted` | VARCHAR(500) | Password (encrypted) |
| `platform_username` | VARCHAR(100) | Username di platform |
| `proxy_url` | VARCHAR(255) | Proxy khusus akun |
| `daily_upload_limit` | INT | Limit upload per hari |
| `uploads_today` | INT | Counter upload hari ini |
| `status` | ENUM | `'active'`, `'suspended'`, `'needs_verification'`, `'inactive'` |
| `health_score` | INT | Skor kesehatan (0-100) |

```sql
CREATE TABLE social_accounts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  platform ENUM('youtube', 'facebook', 'instagram', 'x', 'tiktok') NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  login_type ENUM('email', 'phone', 'username', 'manual', 'google') NOT NULL DEFAULT 'manual',
  login_identifier VARCHAR(255) DEFAULT NULL,
  password_encrypted VARCHAR(500) DEFAULT NULL,
  platform_username VARCHAR(100) DEFAULT NULL,
  proxy_url VARCHAR(255) DEFAULT NULL,
  daily_upload_limit INT DEFAULT 3,
  uploads_today INT DEFAULT 0,
  last_upload_at TIMESTAMP NULL,
  status ENUM('active', 'suspended', 'needs_verification', 'inactive') DEFAULT 'active',
  health_score INT DEFAULT 100,
  total_uploads INT DEFAULT 0,
  total_views INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_social_account (user_id, platform, login_identifier)
);
```

### Tabel: `social_sessions`

Menyimpan cookies dan session untuk semua platform.

```sql
CREATE TABLE social_sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  cookies JSON NOT NULL,
  local_storage JSON DEFAULT NULL,
  session_storage JSON DEFAULT NULL,
  browser_context JSON DEFAULT NULL,
  fingerprint_id INT DEFAULT NULL,
  login_method VARCHAR(50) DEFAULT NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  last_validated_at TIMESTAMP NULL,
  validation_error VARCHAR(255) DEFAULT NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES social_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (fingerprint_id) REFERENCES browser_fingerprints(id) ON DELETE SET NULL,
  INDEX idx_account_valid (account_id, is_valid)
);
```

### Tabel: `social_upload_queue`

Antrian upload untuk semua platform.

```sql
CREATE TABLE social_upload_queue (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  platform ENUM('youtube', 'facebook', 'instagram', 'x', 'tiktok') NOT NULL,
  request_log_id INT DEFAULT NULL,
  clip_index INT DEFAULT NULL,
  video_path VARCHAR(500) NOT NULL,
  title VARCHAR(255) DEFAULT NULL COMMENT 'For YouTube',
  caption TEXT,
  hashtags JSON DEFAULT NULL,
  scheduled_at TIMESTAMP NULL,
  priority INT DEFAULT 5,
  status ENUM('pending', 'processing', 'published', 'failed', 'cancelled') DEFAULT 'pending',
  progress_percent INT DEFAULT 0,
  platform_video_id VARCHAR(100) DEFAULT NULL,
  platform_url VARCHAR(500) DEFAULT NULL,
  error_code VARCHAR(50) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  privacy_level ENUM('public', 'unlisted', 'private', 'friends') DEFAULT 'public',
  made_for_kids BOOLEAN DEFAULT FALSE COMMENT 'For YouTube',
  category_id VARCHAR(50) DEFAULT NULL COMMENT 'For YouTube',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES social_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (request_log_id) REFERENCES request_log(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at),
  INDEX idx_platform (platform)
);
```

### Multi-Platform API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/v1/social/platforms` | List supported platforms |
| `POST` | `/api/v1/social/accounts` | Create account for any platform |
| `GET` | `/api/v1/social/accounts` | List all social accounts |
| `GET` | `/api/v1/social/accounts?platform=youtube` | List accounts for specific platform |
| `DELETE` | `/api/v1/social/accounts/{id}` | Delete social account |
| `POST` | `/api/v1/social/accounts/{id}/login` | Trigger login |
| `POST` | `/api/v1/social/upload` | Create upload job |
| `GET` | `/api/v1/social/upload/queue` | Get upload queue |

#### Example: Create YouTube Account

```json
POST /api/v1/social/accounts
{
  "platform": "youtube",
  "account_name": "My Channel",
  "login_type": "google",
  "auto_login": true
}
```

#### Example: Create Upload to YouTube Shorts

```json
POST /api/v1/social/upload
{
  "account_id": 1,
  "video_path": "/path/to/video.mp4",
  "title": "Amazing Short Video",
  "caption": "Check this out!",
  "hashtags": ["#shorts", "#viral"],
  "privacy_level": "public",
  "made_for_kids": false
}
```


---

## 🛡️ Anti-Detection Strategy

### 1. Browser Fingerprint Rotation

```python
# Contoh fingerprint yang akan dirotasi
fingerprints = [
    {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
        "viewport": {"width": 1920, "height": 1080},
        "platform": "Win32",
        "timezone": "Asia/Jakarta"
    },
    {
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
        "viewport": {"width": 1440, "height": 900},
        "platform": "MacIntel",
        "timezone": "Asia/Jakarta"
    }
]
```

### 2. Human-like Behavior Simulation

| Aksi | Implementasi |
|------|--------------|
| **Typing Speed** | Random delay 50-150ms antar karakter |
| **Mouse Movement** | Bezier curve movement, bukan teleportasi |
| **Scroll Behavior** | Scroll dengan kecepatan bervariasi |
| **Click Delay** | Random delay 200-800ms sebelum click |
| **Page Interaction** | Hover elemen random sebelum aksi |
| **Session Warming** | Browse TikTok 30-60 detik sebelum upload |

### 3. Rate Limiting Strategy

```python
RATE_LIMITS = {
    "uploads_per_account_per_day": 3,      # Max upload per akun per hari
    "min_interval_between_uploads": 3600,   # Min 1 jam antar upload
    "session_warm_up_duration": 45,         # Detik browsing sebelum upload
    "max_concurrent_browsers": 2,           # Max browser paralel
    "cool_down_after_error": 1800,          # 30 menit cooldown setelah error
}
```

### 4. Proxy Management

| Strategi | Deskripsi |
|----------|-----------|
| **Dedicated Proxy** | Setiap akun punya proxy sendiri (recommended) |
| **Residential Proxy** | Gunakan residential IP untuk menghindari deteksi |
| **Geo-matching** | Proxy location match dengan region akun |
| **Proxy Rotation** | Rotasi proxy jika terkena rate limit |

### 5. Session Management

```
Login Flow:
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cek Session│────►│ Session Valid?   │────►│ Use Existing    │
│  di Database│     │ (test API call)  │ Yes │ Session         │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                              │ No
                              ▼
                    ┌──────────────────┐
                    │ Fresh Login      │
                    │ (dengan delay)   │
                    └────────┬─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Handle 2FA/      │
                    │ Verification     │
                    └────────┬─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Save Session     │
                    │ to Database      │
                    └──────────────────┘
```

### 6. Error Handling & Recovery

| Error Type | Recovery Action |
|------------|-----------------|
| Session Expired | Auto relogin dengan delay |
| CAPTCHA Detected | Auto-solve via API atau notify user |
| Rate Limited | Cooldown 30 menit, switch akun |
| Account Suspended | Mark akun sebagai suspended, notify user |
| Network Error | Retry dengan exponential backoff |
| Upload Failed | Retry hingga 3x, lalu mark as failed |

### 7. Conflict Detection

Mencegah 2 upload di akun yang sama terlalu berdekatan:

| Rule | Implementasi |
|------|--------------|
| **Min Interval** | Minimum 1 jam antar upload per akun |
| **Queue Lock** | Lock akun saat sedang upload |
| **Scheduled Conflict** | Cegah schedule < 1 jam dari upload lain |
| **Auto Reschedule** | Jika conflict, geser otomatis ke slot kosong |

```python
async def check_upload_conflict(account_id: int, scheduled_at: datetime) -> ConflictResult:
    """Check if proposed upload time conflicts with existing uploads"""
    
    # Get recent and upcoming uploads for this account
    recent_uploads = await get_uploads(
        account_id=account_id,
        status=['processing', 'pending', 'uploaded'],
        time_range=(scheduled_at - timedelta(hours=1), scheduled_at + timedelta(hours=1))
    )
    
    for upload in recent_uploads:
        time_diff = abs((upload.scheduled_at or upload.uploaded_at) - scheduled_at)
        if time_diff < timedelta(hours=1):
            return ConflictResult(
                has_conflict=True,
                conflicting_upload_id=upload.id,
                suggested_time=find_next_available_slot(account_id, scheduled_at)
            )
    
    return ConflictResult(has_conflict=False)
```

---

## 📊 Analytics & Dashboard

### Account Performance Dashboard

| Metric | Deskripsi |
|--------|-----------|
| **Total Views** | Total views dari semua video |
| **Avg Views/Video** | Rata-rata views per video |
| **Best Performing** | Video dengan views tertinggi |
| **Engagement Rate** | (Likes + Comments + Shares) / Views |
| **Growth Trend** | Views trend 7/30 hari terakhir |
| **Best Posting Time** | Jam posting dengan engagement tertinggi |

#### Database: Video Performance Tracking

```sql
CREATE TABLE video_performance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  upload_queue_id INT NOT NULL,
  account_id INT NOT NULL,
  tiktok_video_id VARCHAR(100) NOT NULL,
  
  -- Metrics (updated periodically)
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,
  avg_watch_time_seconds FLOAT DEFAULT 0,
  
  -- Posting context
  posted_at TIMESTAMP NOT NULL,
  posted_hour INT GENERATED ALWAYS AS (HOUR(posted_at)) STORED,
  posted_day_of_week INT GENERATED ALWAYS AS (DAYOFWEEK(posted_at)) STORED,
  
  -- Content context
  video_duration_seconds FLOAT,
  hashtags JSON,
  caption_length INT,
  
  -- Tracking
  last_fetched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  INDEX idx_account_posted (account_id, posted_at),
  INDEX idx_views (account_id, views DESC)
);
```

### Posting Time Analytics (Korelasi Jam vs Engagement)

```sql
-- View: Best posting hours per account
CREATE VIEW v_best_posting_hours AS
SELECT 
  account_id,
  posted_hour,
  COUNT(*) as video_count,
  AVG(views) as avg_views,
  AVG((likes + comments + shares) / NULLIF(views, 0)) as avg_engagement_rate,
  RANK() OVER (PARTITION BY account_id ORDER BY AVG(views) DESC) as hour_rank
FROM video_performance
WHERE posted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY account_id, posted_hour
HAVING video_count >= 3;
```

### Auto-Suggest Optimal Posting Time

```python
async def suggest_optimal_posting_time(account_id: int) -> List[SuggestedTime]:
    """Suggest optimal posting times based on historical data"""
    
    best_hours = await db.fetch_all("""
        SELECT posted_hour, avg_views, avg_engagement_rate
        FROM v_best_posting_hours
        WHERE account_id = :account_id AND hour_rank <= 3
        ORDER BY avg_views DESC
    """, {"account_id": account_id})
    
    suggestions = []
    for hour in best_hours:
        next_slot = get_next_available_slot(account_id, hour['posted_hour'])
        suggestions.append(SuggestedTime(
            datetime=next_slot,
            confidence=hour['avg_engagement_rate'],
            reason=f"Best performing hour ({hour['posted_hour']}:00)"
        ))
    
    return suggestions[:5]
```

### Visual Calendar API

```python
@app.get("/api/v1/tiktok/calendar")
async def get_upload_calendar(
    start_date: date,
    end_date: date,
    account_ids: List[int] = None,
    current: dict = Depends(_get_current_user)
):
    """Get calendar view of all scheduled uploads"""
    # Returns grouped by date for calendar visualization
    pass
```

#### Calendar UI Mockup

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Upload Calendar                    June 2026    [◀] [▶]    │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│  Sun   │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│   1    │   2    │   3    │   4    │   5    │   6    │   7    │
│        │ 🟢10:00│ 🟢14:00│        │ 🟡10:00│ 🟢09:00│        │
│        │ @acc1  │ @acc2  │        │ @acc1  │ @acc3  │        │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┘
Legend: 🟢 Uploaded  🟡 Pending  ⏳ Scheduled  🔴 Failed
```

---

## 🌱 Account Warm-up Automation

Akun baru TikTok perlu "dididik" sebelum upload untuk menghindari ban:

### Warm-up Phases

| Phase | Duration | Activities |
|-------|----------|------------|
| **Passive** | Day 1-3 | Browse FYP, watch videos, like 5-10 |
| **Light** | Day 4-7 | + Follow 5-10 accounts/day |
| **Active** | Day 8-14 | + Comment 2-3/day, can post 1/day |
| **Ready** | Day 15+ | Normal posting schedule |

### Database: Warm-up Tracking

```sql
CREATE TABLE account_warmup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL UNIQUE,
  warmup_phase ENUM('passive', 'light_engagement', 'active_engagement', 'ready') DEFAULT 'passive',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Progress
  total_videos_watched INT DEFAULT 0,
  total_likes_given INT DEFAULT 0,
  total_follows_given INT DEFAULT 0,
  
  -- Today's progress
  today_videos_watched INT DEFAULT 0,
  today_likes_given INT DEFAULT 0,
  
  -- Settings
  auto_advance_phase BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE
);
```

### Warm-up API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/v1/tiktok/accounts/{id}/warmup` | Get warmup status |
| `POST` | `/api/v1/tiktok/accounts/{id}/warmup/start` | Start warmup |
| `POST` | `/api/v1/tiktok/accounts/{id}/warmup/pause` | Pause warmup |

---

## 🤖 CAPTCHA Solving Integration

Integrasi dengan layanan CAPTCHA solving otomatis:

### Supported Services

| Service | Price | Avg Speed |
|---------|-------|-----------|
| **2Captcha** | $2.99/1000 | 20-40s |
| **Anti-Captcha** | $2/1000 | 15-30s |
| **CapSolver** | $0.8-2/1000 | 10-20s |

### Configuration

```env
CAPTCHA_SOLVER_ENABLED=true
CAPTCHA_SOLVER_SERVICE=capsolver  # 2captcha | anti-captcha | capsolver
CAPTCHA_SOLVER_API_KEY=your-api-key
CAPTCHA_FALLBACK_TO_MANUAL=true
```

### CAPTCHA Handling Flow

```
CAPTCHA Detected → Auto-solve via API (if enabled)
                       │
                  ┌────┴────┐
                  │ Success │
                  └────┬────┘
                  Yes  │  No
                   ▼      ▼
              Continue   Fallback to manual
                         (notify user)
```


---

## 📡 API Endpoints

### Access Control

| Role | Akses |
|------|-------|
| **User** | Hanya bisa lihat & kelola akun TikTok miliknya sendiri |
| **Admin** | Bisa lihat & kelola semua akun TikTok dari semua user |

> Sama seperti AutoCliper v2, role disimpan di tabel `users.role` (`'admin'` atau `'user'`)

### Account Management

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| `POST` | `/api/v1/tiktok/accounts` | User | Tambah akun TikTok baru (milik user login) |
| `GET` | `/api/v1/tiktok/accounts` | User | List akun milik sendiri, Admin lihat semua |
| `GET` | `/api/v1/tiktok/accounts/{id}` | Owner/Admin | Detail akun |
| `PUT` | `/api/v1/tiktok/accounts/{id}` | Owner/Admin | Update akun |
| `DELETE` | `/api/v1/tiktok/accounts/{id}` | Owner/Admin | Hapus akun |
| `POST` | `/api/v1/tiktok/accounts/{id}/login` | Owner/Admin | Trigger login manual |
| `POST` | `/api/v1/tiktok/accounts/{id}/validate` | Owner/Admin | Validasi session |
| `POST` | `/api/v1/tiktok/accounts/{id}/logout` | Owner/Admin | Logout & hapus session |

### Upload Management

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| `POST` | `/api/v1/tiktok/upload` | User | Tambah ke antrian upload |
| `GET` | `/api/v1/tiktok/upload/queue` | User | List antrian milik sendiri, Admin lihat semua |
| `GET` | `/api/v1/tiktok/upload/{id}` | Owner/Admin | Detail upload |
| `PUT` | `/api/v1/tiktok/upload/{id}` | Owner/Admin | Update (reschedule, edit caption) |
| `DELETE` | `/api/v1/tiktok/upload/{id}` | Owner/Admin | Cancel upload |
| `POST` | `/api/v1/tiktok/upload/{id}/retry` | Owner/Admin | Retry upload yang gagal |
| `GET` | `/api/v1/tiktok/upload/history` | User | Riwayat milik sendiri, Admin lihat semua |

### Integration dengan AutoCliper v2 (Library)

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| `GET` | `/api/v1/jobs/history` | User | List job dengan clips (sudah ada di v2) |
| `GET` | `/api/v1/tiktok/accounts` | User | List akun TikTok untuk dropdown pilihan |
| `POST` | `/api/v1/tiktok/upload/from-clip` | User | Auto post clip dari Library ke TikTok |
| `POST` | `/api/v1/tiktok/upload/bulk` | User | Bulk post multiple clips sekaligus |

### Library Auto Post Flow

Di halaman **Library** (job history), setiap job menampilkan:
1. **Video Original** — Info video YouTube source (judul, thumbnail, durasi)
2. **Hasil Clipping** — Multiple clips hasil AI analysis dengan preview

User bisa memilih **clip mana saja** yang akan di-upload ke TikTok:

```
┌─────────────────────────────────────────────────────────────────┐
│  Library - Job History                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📹 Original: "Podcast Deddy Corbuzier - Episode #123"          │
│  ├─ YouTube: https://youtube.com/watch?v=xxxxx                  │
│  ├─ Duration: 1:45:30                                           │
│  └─ Status: ✅ Completed | 5 clips generated                    │
│                                                                 │
│  ┌─ Hasil Clipping ─────────────────────────────────────────┐   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ [☐] Clip 1                        [▶️ Preview]       │ │   │
│  │  │ Hook: "Ini rahasia sukses yang jarang..."           │ │   │
│  │  │ Timestamp: 00:15:30 - 00:16:15 (45 detik)           │ │   │
│  │  │ Score: ⭐ 0.92 (High engagement predicted)           │ │   │
│  │  │                                                     │ │   │
│  │  │ [📥 Download]  [🚀 Post to TikTok]                   │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ [☐] Clip 2                        [▶️ Preview]       │ │   │
│  │  │ Hook: "Ternyata ini yang bikin orang gagal..."      │ │   │
│  │  │ Timestamp: 00:32:10 - 00:33:05 (55 detik)           │ │   │
│  │  │ Score: ⭐ 0.87                                       │ │   │
│  │  │                                                     │ │   │
│  │  │ [📥 Download]  [🚀 Post to TikTok]                   │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ [☐] Clip 3                        [▶️ Preview]       │ │   │
│  │  │ Hook: "Mindset ini yang membedakan..."              │ │   │
│  │  │ Timestamp: 01:05:20 - 01:06:10 (50 detik)           │ │   │
│  │  │ Score: ⭐ 0.85                                       │ │   │
│  │  │                                                     │ │   │
│  │  │ [📥 Download]  [🚀 Post to TikTok]                   │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ... (more clips)                                        │   │
│  │                                                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Selected: 2 clips    [🚀 Bulk Post Selected to TikTok]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**User dapat:**
- ✅ Post **satu clip** langsung dengan tombol per-clip
- ✅ **Select multiple clips** dengan checkbox, lalu bulk post
- ✅ **Preview** setiap clip sebelum memutuskan
- ✅ Lihat **score/rating** untuk memilih clip terbaik
- ✅ Lihat **timestamp** dari video original

### Modal "Post to TikTok" (Single Clip)

Ketika user klik "Post to TikTok" pada satu clip:

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 Post to TikTok                                       [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📹 Clip Preview                                                │
│  ┌─────────────────────┐  Original: Podcast Deddy #123          │
│  │                     │  Timestamp: 00:15:30 - 00:16:15        │
│  │   [Video Player]    │  Duration: 45 detik                    │
│  │                     │  Score: ⭐ 0.92                         │
│  └─────────────────────┘                                       │
│                                                                 │
│  👤 Pilih Akun TikTok                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▼ Akun Utama (@username1) - 2/3 uploads today           │   │
│  │   Akun Backup (@username2) - 0/3 uploads today          │   │
│  │   Akun Gaming (@gaming_tt) - 1/3 uploads today          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📝 Caption (dari hook text)                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Ini rahasia sukses yang jarang dibahas! 🔥              │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  #️⃣ Hashtags                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ #fyp #viral #tips #sukses #motivasi                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│  💡 Suggested: #podcast #deddycorbuzier #trending              │
│                                                                 │
│  ⏰ Kapan posting?                                              │
│  ○ Sekarang                                                    │
│  ○ Jadwalkan: [📅 05/06/2026] [🕐 10:00]                       │
│     💡 Suggested: 19:00 (best engagement for this account)     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            [Cancel]        [🚀 Post Now]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modal "Bulk Post" (Multiple Clips Selected)

Ketika user select beberapa clips dan klik "Bulk Post Selected", sistem akan **otomatis membagi jadwal upload** dengan interval yang aman. User dapat **mengubah jadwal yang disarankan**:

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 Schedule Posts (3 clips selected)                    [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 Pilih Akun TikTok                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▼ Akun Utama (@username1) - 0/3 uploads today           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📅 Jadwal Upload (auto-distributed, editable)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ 1. Clip 1 - "Ini rahasia sukses..."             │   │   │
│  │  │    📅 [05/06/2026]  🕐 [10:00 ▼]  ✏️ Edit       │   │   │
│  │  │    💡 Suggested (best engagement hour)           │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                        ↓ +1 jam interval                │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ 2. Clip 3 - "Mindset ini yang membedakan..."    │   │   │
│  │  │    📅 [05/06/2026]  🕐 [11:00 ▼]  ✏️ Edit       │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                        ↓ +1 jam interval                │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ 3. Clip 5 - "Kesalahan terbesar..."             │   │   │
│  │  │    📅 [05/06/2026]  🕐 [12:00 ▼]  ✏️ Edit       │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚙️ Interval Settings                                           │
│  Minimum interval antar posting: [1 jam ▼]                     │
│                                                                 │
│  📝 Caption (apply to all, use {hook} for individual)          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ {hook} 🔥                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  #️⃣ Hashtags (apply to all)                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ #fyp #viral #podcast                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │       [Cancel]        [📅 Schedule 3 Posts]             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Schedule Logic

Ketika user memilih multiple clips, sistem akan:

1. **Calculate optimal times** berdasarkan:
   - Best engagement hours dari analytics akun
   - Minimum interval (default 1 jam)
   - Existing scheduled posts (avoid conflict)

2. **Distribute schedule** dalam satu hari:
   ```
   Contoh: User pilih 5 clips
   
   - Clip 1 → 10:00 (best hour #1)
   - Clip 2 → 11:00 (+1 jam)
   - Clip 3 → 12:00 (+1 jam)
   - Clip 4 → 13:00 (+1 jam)
   - Clip 5 → 14:00 (+1 jam)
   ```

3. **User dapat edit**:
   - Ubah tanggal posting
   - Ubah jam posting
   - Ubah interval antar posting
   - Reorder clips
   - Remove clip dari queue

```python
def auto_schedule_clips(
    clips: List[ClipInfo],
    account_id: int,
    start_from: datetime = None,
    interval_hours: int = 1
) -> List[ScheduledPost]:
    """Auto-distribute clips dengan interval waktu"""
    
    best_hours = get_best_posting_hours(account_id)  # e.g., [10, 14, 19]
    min_interval = timedelta(hours=interval_hours)
    
    scheduled = []
    current_time = start_from or datetime.now()
    
    # Start from best hour if scheduling for later
    if current_time.date() > datetime.now().date():
        current_time = current_time.replace(hour=best_hours[0], minute=0)
    
    for clip in clips:
        # Check conflict with existing posts
        while has_conflict(account_id, current_time, min_interval):
            current_time += min_interval
        
        scheduled.append(ScheduledPost(
            clip=clip,
            scheduled_at=current_time,
            is_suggested=True,
            editable=True
        ))
        
        current_time += min_interval
    
    return scheduled
```

### Caption & Hashtag Source

Caption dan hashtag diambil dari berbagai sumber:

| Source | Deskripsi | Priority |
|--------|-----------|----------|
| **Hook Text** | Teks hook dari AI analysis (AutoCliper v2) | Default caption |
| **User Input** | User edit manual di modal posting | Override |
| **Template** | Template per akun/niche (disimpan di DB) | Fallback |
| **AI Generated** | Generate otomatis dari video content | Optional |

```
Caption Generation Flow:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Ambil hook text dari request_log.caption_response           │
│    → clip.hook = "Ini rahasia sukses yang jarang dibahas"      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Apply template (jika ada)                                    │
│    → template: "{hook}\n\n{hashtags}"                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Generate hashtags                                            │
│    a. User-defined hashtags                                     │
│    b. Account default hashtags                                  │
│    c. Trending hashtags (dari TikTok API/scraping)             │
│    d. Niche-specific hashtags                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. User review & edit di modal                                  │
│    → Final caption siap upload                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Database: Caption Templates

```sql
CREATE TABLE caption_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT DEFAULT NULL COMMENT 'NULL = berlaku untuk semua akun user',
  name VARCHAR(100) NOT NULL,
  template TEXT NOT NULL COMMENT 'Supports {hook}, {hashtags}, {date}, {account}',
  default_hashtags JSON DEFAULT NULL,
  niche VARCHAR(50) DEFAULT NULL COMMENT 'gaming, comedy, education, etc',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE
);
```

#### Hashtag Sources

| Source | Endpoint/Method |
|--------|-----------------|
| **Trending** | Scrape TikTok Creative Center atau API |
| **Niche-specific** | Pre-defined list per kategori |
| **Historical** | Hashtag yang perform baik dari upload sebelumnya |
| **AI Suggested** | Generate dari video transcript/hook |

```python
# Contoh hashtag generation
async def generate_hashtags(clip_data, account, user_preferences):
    hashtags = []
    
    # 1. User-defined (highest priority)
    if user_preferences.get('hashtags'):
        hashtags.extend(user_preferences['hashtags'])
    
    # 2. Account defaults
    if account.default_hashtags:
        hashtags.extend(account.default_hashtags)
    
    # 3. Trending (limit 3)
    trending = await get_trending_hashtags(limit=3)
    hashtags.extend(trending)
    
    # 4. Niche-specific
    if account.niche:
        niche_tags = NICHE_HASHTAGS.get(account.niche, [])
        hashtags.extend(niche_tags[:2])
    
    # Dedupe & limit to 10
    return list(dict.fromkeys(hashtags))[:10]
```

---

### Contoh Request

#### Tambah Akun TikTok
```json
POST /api/v1/tiktok/accounts
{
  "account_name": "Akun Utama",
  "login_type": "email",
  "login_identifier": "email@example.com",
  "password": "secretpassword",
  "proxy_url": "http://user:pass@proxy.example.com:8080",
  "daily_upload_limit": 3
}
```

#### Post Clip dari Library ke TikTok
```json
POST /api/v1/tiktok/upload/from-clip
{
  "account_id": 1,
  "request_log_id": 5,
  "clip_index": 1,
  "caption": "Ini rahasia sukses yang jarang dibahas! 🔥",
  "hashtags": ["#fyp", "#viral", "#tips", "#sukses"],
  "scheduled_at": null
}
```

> **Note:** `request_log_id` adalah ID job dari `/api/v1/jobs/history`, `clip_index` adalah index clip (1, 2, 3, dst)

#### Bulk Post Multiple Clips
```json
POST /api/v1/tiktok/upload/bulk
{
  "uploads": [
    {
      "account_id": 1,
      "request_log_id": 5,
      "clip_index": 1,
      "caption": "Part 1: Rahasia sukses! 🔥",
      "hashtags": ["#fyp", "#viral"],
      "scheduled_at": "2026-06-05T10:00:00Z"
    },
    {
      "account_id": 2,
      "request_log_id": 5,
      "clip_index": 2,
      "caption": "Part 2: Lanjutan tips! 💡",
      "hashtags": ["#fyp", "#tips"],
      "scheduled_at": "2026-06-05T14:00:00Z"
    }
  ]
}
```

#### Jadwalkan Upload (Schedule)
```json
POST /api/v1/tiktok/upload/from-clip
{
  "account_id": 1,
  "request_log_id": 5,
  "clip_index": 1,
  "caption": "Video keren nih! 🔥",
  "hashtags": ["#fyp", "#viral", "#trending"],
  "scheduled_at": "2026-06-05T10:00:00Z"
}
```

#### Response Upload Success
```json
{
  "id": 123,
  "status": "uploaded",
  "tiktok_video_id": "7234567890123456789",
  "tiktok_url": "https://www.tiktok.com/@username/video/7234567890123456789",
  "uploaded_at": "2026-06-05T10:02:35Z"
}
```

#### Response Upload Queued (untuk scheduled)
```json
{
  "id": 124,
  "status": "pending",
  "scheduled_at": "2026-06-05T10:00:00Z",
  "message": "Upload scheduled successfully"
}
```


---

## 🔄 Alur Kerja

### A. Alur Registrasi Akun TikTok

```
1. User input credentials (email/username/phone + password)
         │
         ▼
2. Encrypt password & simpan ke database
         │
         ▼
3. Launch Playwright browser dengan fingerprint
         │
         ▼
4. Navigate ke TikTok login page
         │
         ▼
5. Human-like typing untuk input credentials
         │
         ▼
6. Handle CAPTCHA/2FA jika muncul
   └── Notify user untuk solve manual jika perlu
         │
         ▼
7. Verifikasi login sukses
         │
         ▼
8. Extract & simpan cookies + session ke database
         │
         ▼
9. Extract TikTok username dari profile
         │
         ▼
10. Update status akun = 'active'
```

### B. Alur Upload Video

```
1. Cek antrian upload (priority + scheduled_at)
         │
         ▼
2. Pilih akun dengan uploads_today < daily_limit
         │
         ▼
3. Load session dari database
         │
         ▼
4. Validate session (test API atau navigate to profile)
   └── Jika expired → relogin
         │
         ▼
5. Session warming (browse FYP 30-60 detik)
         │
         ▼
6. Navigate ke upload page
         │
         ▼
7. Upload video file dengan progress tracking
         │
         ▼
8. Input caption dengan human-like typing
         │
         ▼
9. Add hashtags
         │
         ▼
10. Click publish dengan random delay
         │
         ▼
11. Wait for upload complete & extract video URL
         │
         ▼
12. Update database: status, tiktok_video_id, tiktok_url
         │
         ▼
13. Update account: uploads_today++, last_upload_at
         │
         ▼
14. Save updated session
```

### C. Alur Integrasi dengan AutoCliper v2 (Library Page)

```
┌─────────────────────────────────────────────────────────────────┐
│ User buka halaman Library                                       │
│ GET /api/v1/jobs/history                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend tampilkan daftar job + clips                           │
│ Setiap clip punya tombol [🚀 Post to TikTok]                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ User klik "Post to TikTok" pada clip                            │
│ GET /api/v1/tiktok/accounts → Load dropdown akun TikTok         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Modal muncul dengan:                                            │
│ - Video preview                                                 │
│ - Dropdown pilih akun (dengan info uploads_today/limit)         │
│ - Caption (pre-filled dari hook text)                           │
│ - Hashtag input                                                 │
│ - Schedule option (now / later)                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ User pilih akun, edit caption, tambah hashtag                   │
│ Klik [Post Now] atau [Schedule]                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/v1/tiktok/upload/from-clip                            │
│ {                                                               │
│   "account_id": 1,                                              │
│   "request_log_id": 5,    ← ID job dari history                 │
│   "clip_index": 1,        ← Index clip                          │
│   "caption": "...",                                             │
│   "hashtags": [...],                                            │
│   "scheduled_at": null    ← null = post sekarang                │
│ }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ AutoCliper Automate:                                            │
│ 1. Validasi akun milik user                                     │
│ 2. Cek daily upload limit                                       │
│ 3. Ambil video_path dari request_log + clip_index               │
│ 4. Tambah ke upload_queue                                       │
│ 5. Jika scheduled_at = null → proses langsung                   │
│    Jika scheduled_at ada → tunggu waktu yang dijadwalkan        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ WebSocket: Real-time status update ke frontend                  │
│ - "Logging in..."                                               │
│ - "Uploading video... 45%"                                      │
│ - "Adding caption..."                                           │
│ - "Published! ✅"                                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend update UI:                                             │
│ - Tampilkan TikTok URL                                          │
│ - Badge "Posted ✅" pada clip                                    │
│ - Update akun uploads_today counter                             │
└─────────────────────────────────────────────────────────────────┘
```

### D. Frontend Component Structure (Library Page)

```javascript
// Contoh React component structure

// 1. Library Page - menampilkan job history
<LibraryPage>
  {jobs.map(job => (
    <JobCard key={job.id}>
      <JobHeader title={job.youtube_url} status={job.status} />
      <ClipList>
        {job.clips.map((clip, index) => (
          <ClipCard 
            key={index}
            clip={clip}
            videoUrl={job.output_files[index]}
            thumbnailUrl={job.thumbnails[index]}
            onPostToTikTok={() => openPostModal(job.id, index + 1, clip)}
          />
        ))}
      </ClipList>
    </JobCard>
  ))}
</LibraryPage>

// 2. Post to TikTok Modal
<PostToTikTokModal
  isOpen={isModalOpen}
  clip={selectedClip}
  videoUrl={selectedVideoUrl}
  onClose={closeModal}
>
  <VideoPreview src={videoUrl} />
  
  <AccountSelector 
    accounts={tiktokAccounts}
    selectedAccount={selectedAccount}
    onChange={setSelectedAccount}
  />
  
  <CaptionEditor 
    initialValue={clip.hook}
    value={caption}
    onChange={setCaption}
  />
  
  <HashtagInput 
    value={hashtags}
    onChange={setHashtags}
    suggestions={suggestedHashtags}
  />
  
  <ScheduleOption
    isScheduled={isScheduled}
    scheduledAt={scheduledAt}
    onChange={setScheduledAt}
  />
  
  <ActionButtons>
    <Button onClick={closeModal}>Cancel</Button>
    <Button primary onClick={handlePost}>
      {isScheduled ? '📅 Schedule' : '🚀 Post Now'}
    </Button>
  </ActionButtons>
</PostToTikTokModal>

// 3. API Call
const handlePost = async () => {
  const response = await api.post('/api/v1/tiktok/upload/from-clip', {
    account_id: selectedAccount.id,
    request_log_id: jobId,
    clip_index: clipIndex,
    caption: caption,
    hashtags: hashtags,
    scheduled_at: isScheduled ? scheduledAt.toISOString() : null
  });
  
  if (response.status === 'pending' || response.status === 'processing') {
    // Connect WebSocket untuk real-time status
    connectUploadWebSocket(response.id);
  }
};
```


---

## 📋 Roadmap Pengembangan

### Phase 1: Foundation (Week 1-2)
- [ ] Setup project structure
- [ ] Database migration (tabel baru)
- [ ] Basic Playwright setup dengan anti-detection
- [ ] Encryption service untuk password
- [ ] Account CRUD API endpoints
- [ ] Manual login flow dengan session saving

### Phase 2: Upload Core (Week 3-4)
- [ ] Upload queue system
- [ ] Basic upload automation
- [ ] Session validation & auto-relogin
- [ ] Error handling & retry mechanism
- [ ] Upload history logging
- [ ] Conflict detection (min interval antar upload)

### Phase 3: Anti-Detection (Week 5-6)
- [ ] Browser fingerprint rotation
- [ ] Human-like behavior simulation
- [ ] Rate limiting implementation
- [ ] Proxy support per akun
- [ ] Session warming routine

### Phase 4: Integration (Week 7-8)
- [ ] Integration dengan AutoCliper v2 API
- [ ] Caption & hashtag generation
- [ ] WebSocket untuk real-time status
- [ ] Frontend: Account management page
- [ ] Frontend: Upload scheduling UI (Library integration)
- [ ] Frontend: Upload history & calendar view

### Phase 5: Analytics & Optimization (Week 9-10)
- [ ] Video performance tracking
- [ ] Best posting time analytics
- [ ] Auto-suggest optimal posting time
- [ ] Dashboard per akun
- [ ] Trending hashtags integration

### Phase 6: Account Warm-up (Week 11-12)
- [ ] Warm-up automation system
- [ ] Phase-based warm-up (passive → active → ready)
- [ ] Warm-up activity logging
- [ ] Auto-advance phases
- [ ] Warm-up scheduling

### Phase 7: Advanced Features (Week 13-14)
- [ ] CAPTCHA solving integration (2Captcha/CapSolver)
- [ ] 2FA handling dengan UI input
- [ ] Remote browser session (VNC/noVNC)
- [ ] Alerting (Telegram, Email)
- [ ] Audit logging

### Phase 8: Hardening (Week 15-16)
- [ ] Comprehensive error handling
- [ ] Graceful shutdown & recovery
- [ ] Data retention policies
- [ ] Load testing
- [ ] Documentation & deployment guide
- [ ] Production readiness checklist

---

## 📁 Struktur Folder

```
autocliper-automate/
├── README.md                        # Dokumentasi ini
├── requirements.txt                 # Dependencies Python
├── .env.example                     # Template environment
├── main.py                          # Entry point
│
├── src/
│   ├── __init__.py
│   │
│   ├── domain/                      # Domain Layer
│   │   ├── __init__.py
│   │   ├── entities.py              # TikTokAccount, UploadJob, Session, dll
│   │   └── interfaces.py            # Interface abstrak
│   │
│   ├── application/                 # Application Layer
│   │   ├── __init__.py
│   │   ├── account_service.py       # CRUD akun TikTok
│   │   ├── upload_service.py        # Upload orchestration
│   │   ├── session_service.py       # Session management
│   │   └── scheduler_service.py     # Job scheduling
│   │
│   ├── infrastructure/              # Infrastructure Layer
│   │   ├── __init__.py
│   │   ├── database.py              # Koneksi database
│   │   ├── repositories.py          # Repository (account, session, queue)
│   │   ├── encryption.py            # Password encryption
│   │   ├── browser_manager.py       # Playwright browser pool
│   │   ├── fingerprint_manager.py   # Browser fingerprint rotation
│   │   ├── human_behavior.py        # Human-like actions
│   │   ├── proxy_manager.py         # Proxy handling
│   │   └── tiktok_automation.py     # TikTok-specific automation
│   │
│   └── presentation/                # Presentation Layer
│       ├── __init__.py
│       ├── api.py                   # FastAPI routes
│       └── websocket.py             # WebSocket untuk real-time status
│
├── database/
│   ├── migrate_tiktok_accounts.sql  # Migration untuk tabel baru
│   └── seed_fingerprints.sql        # Seed data fingerprint
│
├── tests/
│   ├── __init__.py
│   ├── test_account_service.py
│   ├── test_upload_service.py
│   └── test_tiktok_automation.py
│
└── scripts/
    ├── setup_playwright.sh          # Install Playwright browsers
    └── generate_fingerprints.py     # Generate fingerprint data
```


---

## 📊 Monitoring & Observability

### Logging Strategy

| Aspek | Implementasi |
|-------|--------------|
| **Format** | JSON structured logging untuk kemudahan parsing |
| **Level** | DEBUG, INFO, WARNING, ERROR, CRITICAL |
| **Rotation** | Daily rotation, max 7 hari, max 100MB per file |
| **Output** | File + stdout (untuk Docker/container) |

```python
# Contoh log format
{
  "timestamp": "2026-06-05T10:15:30.123Z",
  "level": "INFO",
  "service": "autocliper-automate",
  "action": "upload_started",
  "account_id": 1,
  "upload_id": 123,
  "user_id": 5,
  "message": "Starting upload for clip_1_final.mp4",
  "extra": {
    "video_size_mb": 45.2,
    "scheduled_at": null
  }
}
```

### Health Check Endpoints

| Endpoint | Deskripsi |
|----------|-----------|
| `GET /health` | Basic health check (service up/down) |
| `GET /health/ready` | Readiness check (DB, Redis, Playwright connected) |
| `GET /health/live` | Liveness check (service responsive) |

```json
// GET /health/ready
{
  "status": "healthy",
  "checks": {
    "database": {"status": "ok", "latency_ms": 5},
    "redis": {"status": "ok", "latency_ms": 2},
    "playwright": {"status": "ok", "browsers_available": 2},
    "disk_space": {"status": "ok", "free_gb": 45.2}
  },
  "version": "1.0.0",
  "uptime_seconds": 86400
}
```

### Metrics & Dashboard

| Metric | Deskripsi |
|--------|-----------|
| `uploads_total` | Total upload (counter) |
| `uploads_success_total` | Upload sukses |
| `uploads_failed_total` | Upload gagal |
| `upload_duration_seconds` | Durasi upload (histogram) |
| `accounts_active` | Jumlah akun aktif |
| `accounts_suspended` | Jumlah akun suspended |
| `queue_pending` | Antrian menunggu |
| `queue_processing` | Sedang diproses |
| `session_validations_total` | Total validasi session |
| `login_attempts_total` | Total percobaan login |
| `captcha_detected_total` | Total CAPTCHA terdeteksi |

### Alerting

| Kondisi | Alert Level | Notifikasi |
|---------|-------------|------------|
| Upload gagal > 5 dalam 1 jam | WARNING | Telegram |
| Akun suspended | CRITICAL | Telegram + Email |
| Queue > 50 pending | WARNING | Telegram |
| All accounts at daily limit | INFO | Telegram |
| CAPTCHA detected | WARNING | Telegram + WebSocket (real-time) |
| 2FA required | CRITICAL | Telegram + WebSocket + Email |
| Disk space < 5GB | WARNING | Telegram |
| Service down > 5 menit | CRITICAL | Telegram + Email |

```python
# Konfigurasi alerting
ALERTING = {
    "telegram": {
        "enabled": True,
        "bot_token": "BOT_TOKEN",
        "chat_id": "CHAT_ID",
        "notify_on": ["critical", "warning"]
    },
    "email": {
        "enabled": True,
        "smtp_host": "smtp.gmail.com",
        "recipients": ["admin@example.com"],
        "notify_on": ["critical"]
    }
}
```

---

## 🔐 Security

### Password Encryption

| Aspek | Implementasi |
|-------|--------------|
| **Algorithm** | Fernet (AES-128-CBC with HMAC) |
| **Key Storage** | Environment variable `ENCRYPTION_KEY` |
| **Key Rotation** | Support re-encryption dengan key baru |
| **Backup** | Key harus di-backup secara terpisah dan aman |

```python
# Key generation
from cryptography.fernet import Fernet
key = Fernet.generate_key()  # Simpan di .env

# Encryption
from cryptography.fernet import Fernet
cipher = Fernet(os.getenv("ENCRYPTION_KEY"))
encrypted = cipher.encrypt(password.encode())

# Decryption
decrypted = cipher.decrypt(encrypted).decode()
```

**Key Rotation Procedure:**
1. Generate new key
2. Run migration script: decrypt dengan old key, encrypt dengan new key
3. Update `ENCRYPTION_KEY` di environment
4. Restart service

### API Authentication

| Aspek | Implementasi |
|-------|--------------|
| **Method** | JWT Bearer Token (sama dengan AutoCliper v2) |
| **Token Source** | Shared `SECRET_KEY` dengan AutoCliper v2 |
| **SSO** | User login di v2, token valid di automate |
| **Token Expiry** | 30 menit (access), 7 hari (refresh) |

```python
# Shared authentication dengan autocliper-v2
# Gunakan SECRET_KEY yang sama di .env

from src.infrastructure.auth import decode_access_token

def _get_current_user(credentials):
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload
```

### API Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /api/v1/tiktok/accounts` | 10 req/hour per user |
| `POST /api/v1/tiktok/upload/*` | 30 req/hour per user |
| `GET /*` | 100 req/minute per user |
| Login attempts | 5 req/5 minutes per IP |

```python
# Implementasi dengan slowapi atau custom middleware
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/tiktok/accounts")
@limiter.limit("10/hour")
async def create_account(...):
    ...
```

### Audit Log

Semua aksi sensitif dicatat di tabel `audit_log`:

```sql
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action ENUM(
    'account_created', 'account_updated', 'account_deleted',
    'upload_created', 'upload_cancelled',
    'login_manual', 'logout_manual',
    'settings_changed', 'bulk_action'
  ) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INT NOT NULL,
  old_value JSON DEFAULT NULL,
  new_value JSON DEFAULT NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
);
```

---

## ⚙️ Advanced Queue Behavior

### Daily Limit Exceeded Strategy

Ketika semua akun sudah mencapai `daily_upload_limit`:

| Strategy | Deskripsi |
|----------|-----------|
| **hold** (default) | Queue tetap pending, diproses besok setelah reset |
| **redistribute** | Distribusikan ke hari berikutnya secara otomatis |
| **notify_and_hold** | Notify user via Telegram, tunggu instruksi |

```python
# Konfigurasi di .env
DAILY_LIMIT_STRATEGY=hold  # hold | redistribute | notify_and_hold

# Behavior "redistribute"
# Jika scheduled_at = 2026-06-05 10:00 tapi semua akun full
# Auto-reschedule ke 2026-06-06 10:00
```

### Missed Deadline Handling

Ketika `scheduled_at` sudah lewat tapi belum diproses:

| Kondisi | Behavior |
|---------|----------|
| Lewat < 1 jam | Proses segera (late execution) |
| Lewat 1-24 jam | Proses dengan flag `late_execution=true` |
| Lewat > 24 jam | Mark sebagai `missed`, notify user |

```sql
-- Status tambahan di upload_queue
ALTER TABLE upload_queue 
ADD COLUMN deadline_status ENUM('on_time', 'late', 'missed') DEFAULT 'on_time';
```

### Queue Priority Rules

```
Priority Order:
1. Immediate uploads (scheduled_at = NULL) → priority 1
2. Overdue scheduled uploads → priority 2
3. Scheduled uploads within 5 minutes → priority 3
4. Retry uploads → priority 4
5. Normal scheduled uploads → priority 5 (default)
```

---

## 🌍 Environment Configuration

### Multi-Environment Support

| Environment | PLAYWRIGHT_HEADLESS | DEBUG | LOG_LEVEL |
|-------------|---------------------|-------|-----------|
| Development | false | true | DEBUG |
| Staging | true | true | INFO |
| Production | true | false | WARNING |

```env
# .env.development
ENVIRONMENT=development
PLAYWRIGHT_HEADLESS=false
PLAYWRIGHT_SLOW_MO=100
DEBUG=true
LOG_LEVEL=DEBUG
SAVE_ERROR_SCREENSHOTS=true

# .env.production
ENVIRONMENT=production
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_SLOW_MO=0
DEBUG=false
LOG_LEVEL=WARNING
SAVE_ERROR_SCREENSHOTS=true
```

### Remote Display Support (Development)

Untuk debugging dengan `PLAYWRIGHT_HEADLESS=false` di server:

| Method | Deskripsi |
|--------|-----------|
| **VNC** | Jalankan VNC server, connect via VNC client |
| **X11 Forwarding** | `ssh -X` lalu jalankan script |
| **Xvfb** | Virtual framebuffer untuk headless server |
| **noVNC** | Web-based VNC, akses via browser |

```bash
# Setup Xvfb + VNC di server
apt install xvfb x11vnc
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
x11vnc -display :99 -forever -nopw &

# Atau gunakan Docker dengan VNC
docker run -p 5900:5900 -e VNC_PASSWORD=secret autocliper-automate:dev
```

---

## 🗑️ Data Retention Policy

### Upload History Cleanup

| Data | Retention | Cleanup Method |
|------|-----------|----------------|
| `upload_history` | 90 hari | Daily cron job |
| `account_activity_log` | 30 hari | Daily cron job |
| `audit_log` | 1 tahun | Monthly archive |
| Error screenshots | 7 hari | Daily cleanup |

```sql
-- Stored procedure untuk cleanup
CREATE PROCEDURE sp_cleanup_old_data()
BEGIN
  -- Upload history older than 90 days
  DELETE FROM upload_history 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
  
  -- Activity log older than 30 days
  DELETE FROM account_activity_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
  
  -- Archive audit log (move to audit_log_archive)
  INSERT INTO audit_log_archive 
  SELECT * FROM audit_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
  
  DELETE FROM audit_log 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
END;

-- Event: Run daily at 3 AM
CREATE EVENT evt_cleanup_old_data
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURDATE()) + INTERVAL 3 HOUR)
DO CALL sp_cleanup_old_data();
```

### Session Cleanup

```sql
-- Cleanup expired sessions
CREATE PROCEDURE sp_cleanup_expired_sessions()
BEGIN
  -- Mark expired sessions as invalid
  UPDATE tiktok_sessions 
  SET is_valid = FALSE, 
      validation_error = 'Session expired (auto-cleanup)'
  WHERE expires_at < NOW() AND is_valid = TRUE;
  
  -- Delete very old invalid sessions (> 30 days)
  DELETE FROM tiktok_sessions 
  WHERE is_valid = FALSE 
    AND updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END;

-- Run every 6 hours
CREATE EVENT evt_cleanup_sessions
ON SCHEDULE EVERY 6 HOUR
DO CALL sp_cleanup_expired_sessions();
```

---

## 🔄 Graceful Shutdown & Recovery

### Shutdown Procedure

```python
import signal
import asyncio

class GracefulShutdown:
    def __init__(self):
        self.shutdown_event = asyncio.Event()
        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)
    
    def _handle_signal(self, signum, frame):
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.shutdown_event.set()
    
    async def shutdown(self):
        # 1. Stop accepting new jobs
        job_queue.stop_accepting()
        
        # 2. Wait for current uploads to complete (max 5 minutes)
        await self._wait_current_uploads(timeout=300)
        
        # 3. Mark remaining processing jobs as "interrupted"
        await self._mark_interrupted_jobs()
        
        # 4. Close browser contexts gracefully
        await browser_manager.close_all()
        
        # 5. Close database connections
        database.close()
        
        logger.info("Graceful shutdown completed")
```

### Orphan Job Recovery

Saat startup, cek dan recover job yang `status='processing'` tapi tidak ada yang mengerjakan:

```python
async def recover_orphan_jobs():
    """Run at startup to recover interrupted jobs"""
    
    session = database.get_session()
    try:
        # Find orphan jobs (processing but no active worker)
        orphan_jobs = session.query(UploadQueue).filter(
            UploadQueue.status == 'processing',
            UploadQueue.processing_started_at < datetime.now() - timedelta(minutes=30)
        ).all()
        
        for job in orphan_jobs:
            if job.retry_count < job.max_retries:
                # Reset to pending for retry
                job.status = 'pending'
                job.retry_count += 1
                job.error_message = 'Recovered from interrupted state'
                logger.warning(f"Recovered orphan job {job.id}, retry #{job.retry_count}")
            else:
                # Max retries exceeded
                job.status = 'failed'
                job.error_message = 'Max retries exceeded after recovery'
                logger.error(f"Job {job.id} failed after max retries")
            
            # Log recovery action
            session.add(UploadHistory(
                upload_queue_id=job.id,
                account_id=job.account_id,
                action='error',
                details={'recovered': True, 'previous_status': 'processing'}
            ))
        
        session.commit()
        logger.info(f"Recovered {len(orphan_jobs)} orphan jobs")
    finally:
        session.close()
```

---

## 🔐 2FA / Verification Handling (Detail)

### Detection Methods

| Verification Type | Detection Method |
|-------------------|------------------|
| SMS OTP | URL contains `/verify` atau element `[name="code"]` |
| Email OTP | Text "check your email" atau "verification code" |
| CAPTCHA | Element `#captcha`, iframe recaptcha |
| Phone Verification | Element `[data-e2e="verify-phone"]` |
| Suspicious Login | Text "unusual activity" atau "new device" |

### Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser detects 2FA/CAPTCHA required                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Take screenshot of verification page                         │
│ 2. Update account status = 'needs_verification'                 │
│ 3. Log event to upload_history                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ WebSocket       │ │ Telegram        │ │ Email           │
│ (Real-time UI)  │ │ (Bot message)   │ │ (If critical)   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ User receives notification with:                                │
│ - Account name                                                  │
│ - Screenshot of verification page                               │
│ - Link to solve (opens browser atau modal)                      │
│ - Timeout countdown                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ User options:                                                   │
│ A. Solve via UI (input OTP di modal)                           │
│ B. Open remote browser session (VNC/noVNC)                     │
│ C. Skip (mark job as failed)                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Timeout: 10 minutes                                             │
│ - If solved → continue upload                                   │
│ - If timeout → mark job failed, schedule retry later            │
└─────────────────────────────────────────────────────────────────┘
```

### UI for 2FA Input

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Verification Required                                  [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Account: Akun Utama (@username1)                               │
│  Type: SMS OTP Verification                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   [Screenshot of TikTok verification page]              │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  TikTok sent a code to: +62***1234                             │
│                                                                 │
│  Enter OTP Code:                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [  ] [  ] [  ] [  ] [  ] [  ]                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⏱️ Time remaining: 08:45                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Skip & Retry Later]      [Submit OTP]                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💡 Tip: You can also solve via remote browser session          │
│     [Open Remote Browser]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration

```env
# 2FA/Verification Settings
VERIFICATION_TIMEOUT_SECONDS=600          # 10 minutes
VERIFICATION_NOTIFY_TELEGRAM=true
VERIFICATION_NOTIFY_EMAIL=true
VERIFICATION_NOTIFY_WEBSOCKET=true
VERIFICATION_ALLOW_REMOTE_BROWSER=true    # Enable VNC/noVNC
VERIFICATION_AUTO_RETRY_AFTER_HOURS=6     # Retry setelah X jam jika timeout
```

### Database Schema Addition

```sql
-- Tambahan kolom untuk tracking verification
ALTER TABLE upload_queue 
ADD COLUMN verification_type VARCHAR(50) DEFAULT NULL,
ADD COLUMN verification_requested_at TIMESTAMP NULL,
ADD COLUMN verification_screenshot_path VARCHAR(500) DEFAULT NULL,
ADD COLUMN verification_timeout_at TIMESTAMP NULL;

-- Tabel untuk pending verifications
CREATE TABLE pending_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  upload_queue_id INT DEFAULT NULL,
  verification_type ENUM('sms_otp', 'email_otp', 'captcha', 'phone', 'suspicious_login') NOT NULL,
  screenshot_path VARCHAR(500),
  browser_session_id VARCHAR(100) COMMENT 'For remote browser access',
  status ENUM('pending', 'solved', 'timeout', 'skipped') DEFAULT 'pending',
  notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  timeout_at TIMESTAMP NOT NULL,
  solved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_queue_id) REFERENCES upload_queue(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_timeout (timeout_at)
);
```

---

| Komponen | Teknologi | Alasan |
|----------|-----------|--------|
| **Browser Automation** | Playwright | Anti-detection lebih baik dari Selenium, native async |
| **Backend** | FastAPI | Async, cepat, integrasi mudah dengan autocliper-v2 |
| **Database** | MySQL | Konsisten dengan autocliper-v2 |
| **Task Queue** | APScheduler + Redis | Scheduling & background jobs |
| **Encryption** | Fernet (cryptography) | Symmetric encryption untuk password |
| **WebSocket** | FastAPI WebSocket | Real-time upload status |

### Dependencies

```txt
# requirements.txt
playwright==1.44.0
playwright-stealth==1.0.6        # Anti-detection patches
fastapi==0.111.0
uvicorn==0.30.0
mysql-connector-python==8.4.0
cryptography==42.0.0             # Password encryption
apscheduler==3.10.4              # Job scheduling
redis==5.0.0                     # Queue backend
python-dotenv==1.0.0
pydantic==2.7.0
httpx==0.27.0                    # Async HTTP client
fake-useragent==1.5.0            # User agent rotation
```

---

## ⚠️ Disclaimer & Best Practices

### Legal & ToS Considerations

1. **Automasi melanggar ToS TikTok** — Gunakan dengan risiko sendiri
2. **Akun bisa dibanned** — Jangan gunakan akun utama/penting
3. **Rate limiting penting** — Jangan spam upload, akan terdeteksi
4. **Backup akun** — Siapkan akun cadangan

### Best Practices untuk Menghindari Ban

| Practice | Implementasi |
|----------|--------------|
| **Low Volume** | Max 3 upload per akun per hari |
| **Natural Timing** | Upload di jam aktif (bukan tengah malam) |
| **Varied Content** | Jangan upload video identik ke banyak akun |
| **Account Aging** | Gunakan akun yang sudah berumur beberapa bulan |
| **Real Activity** | Sesekali browse, like, comment secara manual |
| **IP Diversity** | Gunakan proxy berbeda per akun |
| **Session Warming** | Browse dulu sebelum upload |

---

## 🔗 Referensi

- [Playwright Documentation](https://playwright.dev/python/)
- [playwright-stealth](https://github.com/AtuboDad/playwright_stealth)
- [TikTok Developer Terms](https://developers.tiktok.com/terms)
- [AutoCliper v2 Documentation](../autocliper-v2/README.md)

---

## 📝 Catatan Pengembangan

### Environment Variables

```env
# Database (sama dengan autocliper-v2)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=autocliper

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Redis (untuk queue)
REDIS_URL=redis://localhost:6379/1

# Proxy (opsional, default untuk akun tanpa proxy spesifik)
DEFAULT_PROXY_URL=

# Rate Limits
MAX_UPLOADS_PER_ACCOUNT_DAY=3
MIN_UPLOAD_INTERVAL_SECONDS=3600
SESSION_WARM_UP_SECONDS=45

# Playwright
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_SLOW_MO=50
```

---

**🚀 Siap untuk memulai pengembangan!**

Mulai dari Phase 1: Setup project structure dan database migration.
