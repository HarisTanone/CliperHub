# 📡 Dokumentasi API — AutoCliper v2

**Base URL:** `http://localhost:8000`  
**Autentikasi:** JWT Bearer Token (semua endpoint kecuali yang ditandai publik)

```
Authorization: Bearer <token>
```

---

## Daftar Isi

- [Autentikasi](#autentikasi)
- [Jobs (Pemrosesan Video)](#jobs-pemrosesan-video)
- [Caption Styles](#caption-styles)
- [Hook Styles](#hook-styles)
- [Font](#font)
- [Manajemen User (Admin)](#manajemen-user-admin-only)
- [Health Check](#health-check)
- [Referensi Kode Error](#referensi-kode-error)
- [Alur Frontend](#alur-frontend)

---

## Autentikasi

### POST /api/v1/auth/login
> Publik — tidak perlu token

Login dan dapatkan JWT token. Token berlaku 24 jam.

**Request:**
```json
{
  "username": "admin",
  "password": "administrator"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "token_type": "bearer",
  "username": "admin",
  "role": "admin"
}
```

| Kode | Error |
|------|-------|
| 401 | Username atau password salah |
| 403 | Akun dinonaktifkan |

> **Akun default:** Username: `admin` | Password: `administrator` | Role: `admin`

---

## Jobs (Pemrosesan Video)

### POST /api/v1/jobs/
Kirim video YouTube untuk diproses. Pemrosesan berjalan di background.

**Request:**
```json
{
  "urls": "https://www.youtube.com/watch?v=VIDEO_ID",
  "caption_style": 1,
  "hook_style_id": 1
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `urls` | string | ✅ | URL YouTube |
| `caption_style` | integer | ✅ | ID caption style |
| `hook_style_id` | integer | ❌ | ID hook style (default: Minimal White) |

**Response 200:**
```json
{
  "status": "accepted",
  "message": "Job has been queued for processing",
  "job_id": null
}
```

| Status | Arti |
|--------|------|
| `accepted` | Berhasil masuk antrian |
| `processing` | URL sama sedang diproses, tunggu |
| `queued` | URL sama sudah ada di antrian |

| Kode | Error |
|------|-------|
| 400 | Caption style tidak ditemukan |
| 400 | Hook style tidak ditemukan |

---

### GET /api/v1/jobs/
Daftar semua job milik user. Admin bisa melihat semua.

**Response 200:**
```json
[
  {
    "id": 1,
    "youtube_url": "https://www.youtube.com/watch?v=...",
    "status": "completed",
    "clips_count": 5,
    "requested_at": "2026-03-07T11:11:21"
  }
]
```

---

### GET /api/v1/jobs/{id}
Detail satu job spesifik. User hanya bisa akses job miliknya.

**Response 200:**
```json
{
  "id": 1,
  "youtube_url": "https://...",
  "status": "completed",
  "output_path": "./tmp/output/...",
  "clips_count": 5
}
```

| Kode | Error |
|------|-------|
| 403 | Akses ditolak |
| 404 | Job tidak ditemukan |

---

### GET /api/v1/jobs/history
Daftar job yang file outputnya masih ada di disk. User hanya lihat miliknya, admin lihat semua.

**Response 200:**
```json
[
  {
    "id": 1,
    "youtube_url": "https://...",
    "caption_style_id": 1,
    "hook_style_id": 1,
    "status": "completed",
    "output_path": "./tmp/output/...",
    "requested_at": "2026-03-07T11:11:21",
    "clips": [
      {
        "index": 1,
        "start_time": 100.0,
        "end_time": 160.0,
        "hook": "Teks hook yang menarik",
        "score": 0.92,
        "reason": "Alasan clip ini bagus"
      }
    ],
    "output_files": ["/api/v1/jobs/1/files/clip_1_final.mp4"],
    "thumbnails": ["/api/v1/jobs/1/files/clip_1_thumb.jpg"]
  }
]
```

> `output_files` dan `thumbnails` berkorespondensi — `output_files[0]` memiliki thumbnail di `thumbnails[0]`.

---

### GET /api/v1/jobs/queue
Status antrian saat ini.

**Response 200:**
```json
{
  "processing_url": "string | null",
  "queue_length": 2,
  "pending": [
    {
      "url": "https://...",
      "caption_style": 1,
      "queued_at": "2026-03-07T11:11:21"
    }
  ]
}
```

---

### GET /api/v1/jobs/logs
Log real-time dari job yang sedang diproses. Poll setiap 2-3 detik selama `status=processing`.

**Response 200:**
```json
{
  "youtube_url": "string",
  "status": "idle | processing | completed | failed",
  "current_stage": "string",
  "current_stage_key": "fetching_video | analyzing_content | generating_clips | applying_captions",
  "total_clips": 5,
  "clips_completed": 2,
  "started_at": "2026-03-07T11:11:21",
  "finished_at": "2026-03-07T11:45:00 | null",
  "error": "string | null",
  "stages": [
    {
      "key": "string",
      "label": "string",
      "status": "pending | active | done | error",
      "started_at": "ISO datetime | null",
      "finished_at": "ISO datetime | null",
      "logs": [{"message": "string", "timestamp": "ISO datetime"}]
    }
  ]
}
```

> Hentikan polling saat `status = completed` atau `status = failed`.

---

### GET /api/v1/jobs/{job_id}/files/{filename}
Download atau tampilkan file output (video final atau thumbnail).

| Parameter | Contoh |
|-----------|--------|
| `job_id` | `1` |
| `filename` | `clip_1_final.mp4` atau `clip_1_thumb.jpg` |

**Response:** File binary (`video/mp4` atau `image/jpeg`)

> Gunakan URL ini langsung di `<video src="">` atau `<img src="">` di frontend.

| Kode | Error |
|------|-------|
| 403 | Akses ditolak |
| 404 | Job atau file tidak ditemukan |

---

### GET /api/v1/jobs/{job_id}/thumbnails/{filename}
Download atau tampilkan thumbnail clip.

| Parameter | Contoh |
|-----------|--------|
| `job_id` | `1` |
| `filename` | `clip_1_thumb.jpg` |

**Response:** File gambar (`image/jpeg`)

---

### GET /api/v1/jobs/{job_id}/videos/{filename}
Download atau tampilkan video clip.

| Parameter | Contoh |
|-----------|--------|
| `job_id` | `1` |
| `filename` | `clip_1_final.mp4` |

**Response:** File video (`video/mp4`)

> **Catatan:** Ketiga endpoint file di atas (`/files/`, `/thumbnails/`, `/videos/`) melayani file yang sama dari folder output. Gunakan `/files/` sebagai endpoint universal, atau `/thumbnails/` dan `/videos/` untuk endpoint yang lebih spesifik.

---

### DELETE /api/v1/jobs/{job_id}
Hapus job dari database + hapus folder output dari disk. Jika masih di antrian, otomatis dibatalkan.

**Response 200:**
```json
{"status": "deleted", "job_id": 1}
```

| Kode | Error |
|------|-------|
| 403 | Akses ditolak |
| 404 | Job tidak ditemukan |
| 409 | Job sedang diproses, tidak bisa dibatalkan |

---

## Caption Styles

Style untuk subtitle karaoke yang muncul di video. User bisa membuat style sendiri dan menggunakan style global bawaan.

### POST /api/v1/caption-styles/
Buat caption style baru. Otomatis dimiliki oleh user yang login.

**Request:**
```json
{
  "name": "My Style",
  "font_id": 2,
  "font_weight": "bold",
  "font_size": 48,
  "color": "#FFFF00",
  "highlight_color": "#FFF45C",
  "outline_color": "#000000",
  "outline_width": 3,
  "shadow_color": "#000000",
  "shadow_offset_x": 2,
  "shadow_offset_y": 2,
  "line_spacing": 1.0,
  "caption_bottom_margin": 70
}
```

> `font_id` opsional. Jika tidak dikirim, font default ke `Arial`. Gunakan `GET /api/v1/fonts/` untuk daftar font.

**Response 201:**
```json
{
  "id": 10,
  "name": "My Style",
  "font_id": 2,
  "font_family": "Poppins Bold",
  "font_weight": "bold",
  "font_size": 48,
  "color": "#FFFF00",
  "highlight_color": "#FFF45C",
  "outline_color": "#000000",
  "outline_width": 3,
  "shadow_color": "#000000",
  "shadow_offset_x": 2,
  "shadow_offset_y": 2,
  "line_spacing": 1.0,
  "caption_bottom_margin": 70,
  "user_id": 5
}
```

---

### GET /api/v1/caption-styles/
Daftar caption style. User melihat miliknya + style global. Admin melihat semua.

---

### GET /api/v1/caption-styles/{id}
Detail satu caption style.

| Kode | Error |
|------|-------|
| 404 | Caption style tidak ditemukan |

---

### PUT /api/v1/caption-styles/{id}
Update caption style. Hanya pemilik atau admin yang bisa. Semua field opsional.

**Field yang bisa diedit:**

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `name` | string | Nama preset |
| `font_id` | integer | ID font (dari `/api/v1/fonts/`) |
| `font_weight` | string | `"bold"` atau `"normal"` |
| `font_size` | integer | Ukuran font |
| `color` | string hex | Warna teks utama |
| `highlight_color` | string hex | Warna highlight kata aktif |
| `outline_color` | string hex | Warna outline teks |
| `outline_width` | integer | Ketebalan outline (px) |
| `shadow_color` | string hex | Warna bayangan |
| `shadow_offset_x` | integer | Offset bayangan horizontal |
| `shadow_offset_y` | integer | Offset bayangan vertikal |
| `line_spacing` | float | Spasi antar baris |
| `caption_bottom_margin` | integer | Jarak subtitle dari bawah (px) |

| Kode | Error |
|------|-------|
| 400 | Tidak ada field untuk diupdate |
| 400 | Font tidak ditemukan |
| 404 | Caption style tidak ditemukan atau akses ditolak |

---

### DELETE /api/v1/caption-styles/{id}
Hapus caption style. Hanya pemilik atau admin.

**Response 200:**
```json
{"status": "deleted", "style_id": 1}
```

---

## Hook Styles

Style untuk teks hook yang muncul di 3 detik pertama video.

### GET /api/v1/hook-styles/
Daftar semua hook style.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Minimal White",
    "text_color": "#FFFFFF",
    "keyword_color": "#FFFFFF",
    "shadow_color": "#000000",
    "shadow_opacity": 200,
    "shadow_blur": 12,
    "keyword_underline_color": "#FFFFFF",
    "keyword_underline_opacity": 180,
    "font_size_normal": 36,
    "font_size_keyword": 56,
    "created_at": "2026-03-07T11:11:21"
  }
]
```

**Style bawaan:**

| ID | Nama | Deskripsi |
|----|------|-----------|
| 1 | Minimal White | Teks putih bersih, shadow halus |
| 2 | Elegant Gold | Teks abu, keyword warna emas |
| 3 | Modern Mono | Teks abu muda, keyword abu gelap |
| 4 | Clean Blue | Teks putih, keyword biru muda |

---

### GET /api/v1/hook-styles/{id}
Detail satu hook style.

---

### POST /api/v1/hook-styles/ *(Admin only)*
Buat hook style baru.

**Request:**
```json
{
  "name": "Custom Gold",
  "text_color": "#FFFFFF",
  "keyword_color": "#FFD700",
  "shadow_color": "#000000",
  "shadow_opacity": 200,
  "shadow_blur": 12,
  "keyword_underline_color": "#FFD700",
  "keyword_underline_opacity": 160,
  "font_size_normal": 36,
  "font_size_keyword": 56
}
```

---

### PUT /api/v1/hook-styles/{id} *(Admin only)*
Update hook style. Semua field opsional.

---

### DELETE /api/v1/hook-styles/{id} *(Admin only)*

**Response 200:**
```json
{"status": "deleted", "style_id": 1}
```

---

## Font

Font yang tersedia untuk caption style. Admin mengelola, user hanya memilih.

> Font otomatis didownload saat pertama kali digunakan.

### GET /api/v1/fonts/
Daftar semua font.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Anton",
    "file_name": "Anton-Regular.ttf",
    "download_url": "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
    "created_at": "2026-03-07T11:11:21"
  }
]
```

---

### GET /api/v1/fonts/{id}
Detail satu font.

---

### POST /api/v1/fonts/ *(Admin only)*
Tambah font baru. File `.ttf` otomatis didownload di background.

**Request:**
```json
{
  "name": "Poppins Bold",
  "file_name": "Poppins-Bold.ttf",
  "download_url": "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf"
}
```

---

### PUT /api/v1/fonts/{id} *(Admin only)*
Update data font. Semua field opsional.

---

### DELETE /api/v1/fonts/{id} *(Admin only)*

**Response 200:**
```json
{"status": "deleted", "font_id": 1}
```

---

## Manajemen User (Admin Only)

> Semua endpoint `/api/v1/users/*` hanya bisa diakses oleh user dengan `role: "admin"`.

### GET /api/v1/users/
Daftar semua user.

**Response 200:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@autocliper.local",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-03-06T14:08:04"
  }
]
```

---

### POST /api/v1/users/
Buat user baru.

**Request:**
```json
{
  "username": "editor1",
  "password": "strongpassword",
  "email": "editor@example.com",
  "role": "user"
}
```

| Field | Wajib | Keterangan |
|-------|-------|------------|
| `username` | ✅ | Harus unik |
| `password` | ✅ | Akan di-hash otomatis |
| `email` | ❌ | Opsional, unik jika diisi |
| `role` | ❌ | `"admin"` atau `"user"` (default: `"user"`) |

| Kode | Error |
|------|-------|
| 409 | Username sudah dipakai |

---

### GET /api/v1/users/{id}
Detail satu user.

---

### PUT /api/v1/users/{id}
Edit user. Semua field opsional.

**Request:**
```json
{
  "email": "newemail@example.com",
  "role": "admin",
  "is_active": false,
  "password": "newpassword"
}
```

---

### DELETE /api/v1/users/{id}
Hapus user permanen. Admin tidak bisa hapus akun sendiri.

| Kode | Error |
|------|-------|
| 400 | Tidak bisa hapus akun sendiri |
| 404 | User tidak ditemukan |

---

## Health Check

### GET /health
> Publik — tidak perlu token

```json
{"status": "healthy", "service": "AutoCliper v2"}
```

---

## Referensi Kode Error

| Kode HTTP | Arti | Kapan Terjadi |
|-----------|------|---------------|
| 200 | OK | Request berhasil |
| 201 | Created | Resource berhasil dibuat |
| 400 | Bad Request | Data tidak valid atau field salah |
| 401 | Unauthorized | Tidak ada token atau token expired |
| 403 | Forbidden | Token valid tapi tidak punya izin |
| 404 | Not Found | Resource tidak ditemukan |
| 409 | Conflict | Data sudah ada (misal username duplikat) |
| 500 | Internal Error | Kesalahan server |

**Format error selalu:**
```json
{"detail": "Pesan error di sini"}
```

---

## Alur Frontend

### A. Alur Login
```
Buka halaman login
  → Input username + password
  → POST /api/v1/auth/login
  → Simpan access_token + role ke localStorage
  → Redirect ke dashboard
```

### B. Alur Buat Video Clip
```
Dashboard
  → GET /api/v1/caption-styles/    ← isi dropdown caption
  → GET /api/v1/hook-styles/       ← isi dropdown hook
  → User pilih style + isi URL YouTube
  → POST /api/v1/jobs/
  → Tampilkan "Sedang diproses..."
  → (polling) GET /api/v1/jobs/logs  ← cek progress real-time
  → Jika status = "completed" → tampilkan output_files
```

### C. Alur Riwayat
```
Halaman Riwayat
  → GET /api/v1/jobs/history
  → Tampilkan daftar job + clip per job
  → Tombol download per file dari output_files
  → Tombol hapus → DELETE /api/v1/jobs/{id}
```

### D. Alur Manajemen User (Admin)
```
Halaman Users (hanya tampil jika role == "admin")
  → GET /api/v1/users/         ← daftar users
  → POST /api/v1/users/        ← tambah user
  → PUT /api/v1/users/{id}     ← edit user
  → DELETE /api/v1/users/{id}  ← hapus user
```

### Contoh Kode JavaScript

```javascript
// utils/api.js
const BASE = 'http://localhost:8000';

export const api = {
  // Login
  async login(username, password) {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  // Helper dengan token
  async _req(path, opts = {}) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return res.json();
  },

  // Caption Styles
  getStyles: ()          => api._req('/api/v1/caption-styles/'),
  getStyle: (id)         => api._req(`/api/v1/caption-styles/${id}`),
  createStyle: (d)       => api._req('/api/v1/caption-styles/', {
    method: 'POST', body: JSON.stringify(d),
  }),
  updateStyle: (id, d)   => api._req(`/api/v1/caption-styles/${id}`, {
    method: 'PUT', body: JSON.stringify(d),
  }),
  deleteStyle: (id)      => api._req(`/api/v1/caption-styles/${id}`, {
    method: 'DELETE',
  }),

  // Hook Styles
  getHookStyles: ()      => api._req('/api/v1/hook-styles/'),
  getHookStyle: (id)     => api._req(`/api/v1/hook-styles/${id}`),

  // Fonts
  getFonts: ()           => api._req('/api/v1/fonts/'),

  // Jobs
  createJob: (urls, styleId, hookStyleId) => api._req('/api/v1/jobs/', {
    method: 'POST',
    body: JSON.stringify({
      urls,
      caption_style: styleId,
      hook_style_id: hookStyleId,
    }),
  }),
  getJobLogs: ()         => api._req('/api/v1/jobs/logs'),
  getJobHistory: ()      => api._req('/api/v1/jobs/history'),
  getJob: (id)           => api._req(`/api/v1/jobs/${id}`),
  deleteJob: (id)        => api._req(`/api/v1/jobs/${id}`, { method: 'DELETE' }),

  // Users (admin only)
  getUsers: ()           => api._req('/api/v1/users/'),
  createUser: (d)        => api._req('/api/v1/users/', {
    method: 'POST', body: JSON.stringify(d),
  }),
  updateUser: (id, d)    => api._req(`/api/v1/users/${id}`, {
    method: 'PUT', body: JSON.stringify(d),
  }),
  deleteUser: (id)       => api._req(`/api/v1/users/${id}`, { method: 'DELETE' }),
};
```

---

### Catatan Penting untuk Frontend

1. **Token expired:** Token berlaku 24 jam. Jika expired, semua request mengembalikan `401`. Handle dengan redirect ke login.
2. **Cek role:** Simpan `role` di localStorage. Sembunyikan menu admin jika `role !== "admin"`.
3. **Polling job:** Setelah buat job, poll `GET /api/v1/jobs/logs` setiap 2-3 detik sampai selesai.
4. **File output:** URL di `output_files` bisa langsung dipakai di `<video>` dan `<img>`.
5. **CORS:** Jika frontend di domain berbeda, perlu tambahkan CORS middleware di server.

---

## Ringkasan Semua Endpoint

| Metode | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| GET | `/health` | Publik | Health check |
| POST | `/api/v1/auth/login` | Publik | Login, dapatkan JWT token |
| **Jobs** | | | |
| POST | `/api/v1/jobs/` | User | Buat job pemrosesan video baru |
| GET | `/api/v1/jobs/` | User | Daftar semua job |
| GET | `/api/v1/jobs/history` | User | Daftar job dengan file output |
| GET | `/api/v1/jobs/queue` | User | Status antrian saat ini |
| GET | `/api/v1/jobs/logs` | User | Log real-time job aktif |
| GET | `/api/v1/jobs/{id}` | User | Detail satu job |
| DELETE | `/api/v1/jobs/{id}` | User | Hapus job + file output |
| GET | `/api/v1/jobs/{id}/files/{filename}` | User | Download file (universal) |
| GET | `/api/v1/jobs/{id}/videos/{filename}` | User | Download video clip |
| GET | `/api/v1/jobs/{id}/thumbnails/{filename}` | User | Download thumbnail |
| **Caption Styles** | | | |
| POST | `/api/v1/caption-styles/` | User | Buat caption style baru |
| GET | `/api/v1/caption-styles/` | User | Daftar caption styles |
| GET | `/api/v1/caption-styles/{id}` | User | Detail caption style |
| PUT | `/api/v1/caption-styles/{id}` | Owner/Admin | Update caption style |
| DELETE | `/api/v1/caption-styles/{id}` | Owner/Admin | Hapus caption style |
| **Hook Styles** | | | |
| GET | `/api/v1/hook-styles/` | User | Daftar hook styles |
| GET | `/api/v1/hook-styles/{id}` | User | Detail hook style |
| POST | `/api/v1/hook-styles/` | Admin | Buat hook style baru |
| PUT | `/api/v1/hook-styles/{id}` | Admin | Update hook style |
| DELETE | `/api/v1/hook-styles/{id}` | Admin | Hapus hook style |
| **Font** | | | |
| GET | `/api/v1/fonts/` | User | Daftar font tersedia |
| GET | `/api/v1/fonts/{id}` | User | Detail font |
| POST | `/api/v1/fonts/` | Admin | Tambah font baru |
| PUT | `/api/v1/fonts/{id}` | Admin | Update font |
| DELETE | `/api/v1/fonts/{id}` | Admin | Hapus font |
| **Users** | | | |
| GET | `/api/v1/users/` | Admin | Daftar semua user |
| POST | `/api/v1/users/` | Admin | Buat user baru |
| GET | `/api/v1/users/{id}` | Admin | Detail user |
| PUT | `/api/v1/users/{id}` | Admin | Update user |
| DELETE | `/api/v1/users/{id}` | Admin | Hapus user |
| **Dokumentasi** | | | |
| GET | `/api/v1/docs` | Publik | Dokumentasi API (HTML) |
| GET | `/api/v1/docs.md` | Publik | Dokumentasi API (Markdown) |

---

↩️ [Kembali ke README](../README.md)
