# Update Backend — Requirements untuk Improve Frontend UX

> Dokumen ini berisi daftar endpoint dan fitur backend yang perlu ditambahkan agar frontend bisa lebih interaktif, real-time, dan user-friendly.

---

## 1. Real-time Updates (Prioritas Tinggi)

Saat ini frontend polling `/api/v1/jobs/logs` setiap 3 detik. Ini boros resource dan tidak real-time.

### Option A: WebSocket

```
WS /ws/jobs/{job_id}/logs
```

- Kirim log baru secara real-time ke client
- Kirim event saat status berubah (pending → processing → completed/failed)
- Format message:

```json
{
  "type": "log",
  "stage": "generating_clips",
  "message": "Clip 3/5 completed",
  "timestamp": "2026-05-12T10:30:00"
}
```

```json
{
  "type": "status_change",
  "old_status": "processing",
  "new_status": "completed",
  "total_clips": 5
}
```

### Option B: Server-Sent Events (SSE)

```
GET /api/v1/jobs/{job_id}/stream
```

- Lebih simple dari WebSocket (one-way)
- Client cukup pakai `EventSource` API
- Cocok karena data hanya flow dari server → client

---

## 2. Pagination & Filtering

### Jobs List dengan Pagination

```
GET /api/v1/jobs/?page=1&limit=10&status=completed&search=keyword&sort=date_desc
```

**Query Parameters:**

| Param | Type | Default | Keterangan |
|---|---|---|---|
| `page` | int | 1 | Halaman ke-n |
| `limit` | int | 10 | Jumlah per halaman |
| `status` | string | null | Filter: completed, processing, failed, pending |
| `search` | string | null | Search di youtube_url atau video title |
| `sort` | string | date_desc | Sorting: date_desc, date_asc, score_desc |

**Response:**

```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 10,
  "total_pages": 15
}
```

### History dengan Filter Score

```
GET /api/v1/jobs/history?min_score=0.8&page=1&limit=10
```

---

## 3. Batch Operations

### Batch Submit Jobs

```
POST /api/v1/jobs/batch
```

**Request:**

```json
{
  "urls": [
    "https://www.youtube.com/watch?v=VIDEO_1",
    "https://www.youtube.com/watch?v=VIDEO_2",
    "https://www.youtube.com/watch?v=VIDEO_3"
  ],
  "caption_style": 2,
  "hook_style_id": 1
}
```

**Response:**

```json
{
  "status": "accepted",
  "message": "3 jobs queued for processing",
  "job_ids": [81, 82, 83]
}
```

### Batch Delete

```
POST /api/v1/jobs/batch-delete
```

**Request:**

```json
{
  "job_ids": [80, 81, 82]
}
```

**Response:**

```json
{
  "deleted": 3,
  "failed": 0
}
```

### Download All Clips (ZIP)

```
GET /api/v1/jobs/{id}/download-all
```

- Response: file ZIP berisi semua clip `.mp4` dari job tersebut
- Header: `Content-Type: application/zip`, `Content-Disposition: attachment; filename="job_80_clips.zip"`

---

## 4. Analytics & Statistics Dashboard

### Endpoint Stats Terpusat

```
GET /api/v1/stats/dashboard
```

**Response:**

```json
{
  "total_jobs": 150,
  "completed_jobs": 120,
  "failed_jobs": 10,
  "processing_jobs": 5,
  "total_clips_generated": 480,
  "average_score": 0.82,
  "average_processing_time_seconds": 320,
  "storage_used_mb": 2048,
  "jobs_today": 8,
  "clips_today": 32
}
```

### Usage Over Time (untuk Chart)

```
GET /api/v1/stats/usage?period=7d
```

**Query Params:**

| Param | Values | Keterangan |
|---|---|---|
| `period` | 7d, 30d, 90d | Rentang waktu |

**Response:**

```json
{
  "period": "7d",
  "data": [
    { "date": "2026-05-06", "jobs": 5, "clips": 20 },
    { "date": "2026-05-07", "jobs": 8, "clips": 32 },
    { "date": "2026-05-08", "jobs": 3, "clips": 12 }
  ]
}
```

### Per-User Stats (Admin)

```
GET /api/v1/stats/users
```

**Response:**

```json
[
  {
    "user_id": 1,
    "username": "admin",
    "total_jobs": 80,
    "total_clips": 320,
    "storage_used_mb": 1200
  }
]
```

---

## 5. Auth & User Experience

### Validate Token + Get Current User

```
GET /api/v1/auth/me
```

**Response:**

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@autocliper.local",
  "role": "admin",
  "is_active": true,
  "created_at": "2026-03-06T14:08:04"
}
```

> Digunakan saat app load untuk validasi token masih berlaku, tanpa harus re-login.

### Refresh Token

```
POST /api/v1/auth/refresh
```

**Request Header:** `Authorization: Bearer <current_token>`

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Change Password (Self)

```
PUT /api/v1/auth/change-password
```

**Request:**

```json
{
  "current_password": "oldpass123",
  "new_password": "newpass456"
}
```

**Response:**

```json
{ "message": "Password updated successfully" }
```

**Error:**

```json
{ "detail": "Current password is incorrect" }
```

### Update Profile (Self)

```
PUT /api/v1/auth/profile
```

**Request:**

```json
{
  "email": "newemail@example.com",
  "display_name": "John Doe"
}
```

---

## 6. Job Management Enhancements

### Retry Failed Job

```
POST /api/v1/jobs/{id}/retry
```

- Re-queue job yang statusnya `failed` tanpa user harus submit ulang URL
- Reset status ke `pending`

**Response:**

```json
{
  "status": "accepted",
  "message": "Job re-queued for processing",
  "job_id": 80
}
```

**Error:**

```json
{ "detail": "Only failed jobs can be retried" }
```

### Queue Position & ETA

```
GET /api/v1/jobs/queue
```

**Response (enhanced):**

```json
{
  "queue_length": 3,
  "your_jobs": [
    {
      "job_id": 82,
      "position": 2,
      "estimated_wait_seconds": 600,
      "youtube_url": "https://..."
    }
  ]
}
```

### Regenerate Single Clip

```
POST /api/v1/jobs/{id}/clips/{clip_index}/regenerate
```

- Regenerate satu clip spesifik (misal user tidak puas dengan hasilnya)

**Response:**

```json
{
  "status": "accepted",
  "message": "Clip 3 queued for regeneration"
}
```

---

## 7. Notification System (Persistent)

### Get Notifications

```
GET /api/v1/notifications/?page=1&limit=20&unread_only=false
```

**Response:**

```json
{
  "items": [
    {
      "id": 1,
      "type": "job_completed",
      "title": "Video processing completed!",
      "message": "Your video 'Tutorial React...' has been processed. 5 clips generated.",
      "data": { "job_id": 80 },
      "is_read": false,
      "created_at": "2026-05-12T10:30:00"
    }
  ],
  "total": 25,
  "unread_count": 3
}
```

### Mark as Read

```
PUT /api/v1/notifications/read-all
```

```
PUT /api/v1/notifications/{id}/read
```

### Notification Types

| Type | Trigger |
|---|---|
| `job_completed` | Job selesai diproses |
| `job_failed` | Job gagal |
| `job_started` | Job mulai diproses (dari queue) |
| `system` | Maintenance, update, dll |

---

## 8. File Serving (Improved)

### Proper File Endpoint

```
GET /api/v1/files/{job_id}/{filename}
```

**Requirements:**
- Support `Range` header untuk video streaming (partial content / seek)
- Proper `Content-Type` header (video/mp4)
- `Content-Disposition` header untuk download
- Auth check (user hanya bisa akses file miliknya)

**Headers Response:**

```
Content-Type: video/mp4
Content-Length: 15728640
Accept-Ranges: bytes
Content-Disposition: inline; filename="clip_1_final.mp4"
```

### Thumbnail Generation

```
GET /api/v1/jobs/{id}/clips/{clip_index}/thumbnail?width=320&height=568
```

- Generate thumbnail dari frame pertama clip
- Cache di server
- Return image (JPEG/WebP)

### Storage Info

```
GET /api/v1/storage/usage
```

**Response:**

```json
{
  "used_mb": 2048,
  "limit_mb": 10240,
  "percentage": 20,
  "jobs_count": 150,
  "oldest_job_date": "2026-03-06T13:25:18"
}
```

---

## 9. Activity Log (Admin)

```
GET /api/v1/activity/?page=1&limit=50&user_id=1
```

**Response:**

```json
{
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "username": "admin",
      "action": "job_created",
      "details": "Created job for https://youtube.com/...",
      "ip_address": "192.168.1.1",
      "created_at": "2026-05-12T10:00:00"
    }
  ],
  "total": 500
}
```

**Actions to log:**
- `login`, `logout`
- `job_created`, `job_deleted`, `job_retried`
- `style_created`, `style_updated`, `style_deleted`
- `user_created`, `user_updated`, `user_deleted`

---

## 10. Prioritas Implementasi

### Phase 1 — Quick Wins (Backend 1-2 hari)

| # | Endpoint | Impact |
|---|---|---|
| 1 | `GET /api/v1/auth/me` | Validasi token saat app load |
| 2 | `PUT /api/v1/auth/change-password` | User self-service |
| 3 | `POST /api/v1/jobs/{id}/retry` | UX improvement untuk failed jobs |
| 4 | Pagination di `GET /api/v1/jobs/` | Performance |

### Phase 2 — Core Features (Backend 3-5 hari)

| # | Endpoint | Impact |
|---|---|---|
| 1 | WebSocket/SSE untuk job logs | Real-time, hemat resource |
| 2 | `GET /api/v1/stats/dashboard` | Dashboard informatif |
| 3 | `GET /api/v1/jobs/{id}/download-all` (ZIP) | User convenience |
| 4 | Search & filter params di jobs | Navigasi data besar |

### Phase 3 — Advanced (Backend 1-2 minggu)

| # | Endpoint | Impact |
|---|---|---|
| 1 | `POST /api/v1/jobs/batch` | Power user feature |
| 2 | Persistent notifications | Engagement |
| 3 | `GET /api/v1/stats/usage` | Analytics chart |
| 4 | Activity log | Audit trail |
| 5 | Proper file serving dengan Range support | Video streaming |

---

## 11. Database Schema Additions (Suggested)

### Table: `notifications`

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `activity_logs`

```sql
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `user_preferences`

```sql
CREATE TABLE user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    theme VARCHAR(10) DEFAULT 'system',
    email_notifications BOOLEAN DEFAULT TRUE,
    display_name VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 12. CORS & Security Notes

- Pastikan semua endpoint baru include CORS headers yang sesuai
- WebSocket perlu handle auth via query param (`?token=xxx`) karena browser WebSocket API tidak support custom headers
- Rate limiting untuk endpoint batch operations
- File serving harus validate ownership (user hanya bisa akses file dari job miliknya)
- Activity log jangan log password (hanya log action, bukan payload sensitif)
