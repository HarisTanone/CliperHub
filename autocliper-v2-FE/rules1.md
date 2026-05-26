# AutoCliper V2 — API Documentation for Frontend

**Base URL:** `http://localhost:8000`  
**Auth:** JWT Bearer Token (semua endpoint kecuali `/health` dan `/api/v1/auth/login` wajib pakai token)

---

## Cara Kerja Autentikasi

```
1. Login  →  dapat access_token
2. Simpan token di localStorage / state
3. Semua request berikutnya kirim header:
   Authorization: Bearer <access_token>
4. Token berlaku 24 jam
```

### Axios / Fetch Helper

```javascript
// utils/api.js
const BASE_URL = 'http://localhost:8000';

export function getToken() {
  return localStorage.getItem('access_token');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    // Token expired → redirect ke login
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  }
  return res.json();
}
```

---

## 1. Health Check

> Endpoint publik — tidak perlu token

### `GET /health`

**Response `200`:**
```json
{
  "status": "healthy",
  "service": "AutoCliper v2"
}
```

---

## 2. Authentication

### `POST /api/v1/auth/login`

Login dan dapatkan JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "administrator"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "token_type": "bearer",
  "username": "admin",
  "role": "admin"
}
```

**Error `401`:**
```json
{ "detail": "Invalid username or password" }
```

**Error `403`:**
```json
{ "detail": "Account is deactivated" }
```

**Contoh implementasi halaman login:**
```javascript
async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('role', data.role);
    // redirect ke dashboard
  } else {
    alert(data.detail); // "Invalid username or password"
  }
}
```

> **Default account:**  
> Username: `admin` | Password: `administrator` | Role: `admin`

---

## 3. Caption / Font Styles

> Semua endpoint caption-styles memerlukan token.

### `GET /api/v1/caption-styles/`

Ambil semua font style yang tersedia.

**Request Header:**
```
Authorization: Bearer <token>
```

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "MrBeast Classic",
    "font_family": "Anton",
    "font_weight": "bold",
    "font_size": 15,
    "color": "#FDFDFD",
    "highlight_color": "#FFF45C",
    "outline_color": "#000000",
    "outline_width": 2,
    "shadow_color": "#000000",
    "shadow_offset_x": 3,
    "shadow_offset_y": 3,
    "line_spacing": 1.2,
    "caption_bottom_margin": 70
  },
  {
    "id": 2,
    "name": "Neon Purple Glow",
    "font_family": "Poppins",
    "font_weight": "bold",
    "font_size": 15,
    "color": "#FDFDFD",
    "highlight_color": "#FF69B4",
    "outline_color": "#000000",
    "outline_width": 2,
    "shadow_color": "#8B008B",
    "shadow_offset_x": 2,
    "shadow_offset_y": 2,
    "line_spacing": 1.3,
    "caption_bottom_margin": 185
  }
]
```

---

### `GET /api/v1/caption-styles/{id}`

Ambil detail satu font style. Gunakan ini sebelum menampilkan form edit.

**Path Param:** `id` — integer ID style

**Response `200`:**
```json
{
  "id": 2,
  "name": "Neon Purple Glow",
  "font_family": "Poppins",
  "font_weight": "bold",
  "font_size": 15,
  "color": "#FDFDFD",
  "highlight_color": "#FF69B4",
  "outline_color": "#000000",
  "outline_width": 2,
  "shadow_color": "#8B008B",
  "shadow_offset_x": 2,
  "shadow_offset_y": 2,
  "line_spacing": 1.3,
  "caption_bottom_margin": 185
}
```

**Error `404`:**
```json
{ "detail": "Caption style 99 not found" }
```

---

### `PUT /api/v1/caption-styles/{id}`

Edit font style. Hanya kirim field yang ingin diubah.  
⚠️ **`font_family` tidak bisa diubah** (read-only).

**Request Body (semua optional):**
```json
{
  "name": "string",
  "font_weight": "bold | normal",
  "font_size": 15,
  "color": "#RRGGBB",
  "highlight_color": "#RRGGBB",
  "outline_color": "#RRGGBB",
  "outline_width": 2,
  "shadow_color": "#RRGGBB",
  "shadow_offset_x": 3,
  "shadow_offset_y": 3,
  "line_spacing": 1.2,
  "caption_bottom_margin": 70
}
```

**Response `200`:** Objek font style terbaru (format sama dengan GET detail)

**Error `400`:**
```json
{ "detail": "No editable fields provided. Note: font_family is read-only and cannot be changed." }
```

**Flow frontend (pilih → lihat → edit):**

```javascript
// Step 1: tampilkan list
const styles = await apiFetch('/api/v1/caption-styles/');

// Step 2: user klik satu style → tampilkan detail
const detail = await apiFetch(`/api/v1/caption-styles/${selectedId}`);

// Step 3: user submit form edit
async function updateStyle(id, formData) {
  const result = await apiFetch(`/api/v1/caption-styles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(formData), // hanya kirim field yang berubah
  });
  return result;
}
```

**Field yang bisa diedit (tampilkan di form):**

| Field | Tipe | Deskripsi | Contoh Input UI |
|---|---|---|---|
| `name` | string | Nama preset | Text input |
| `font_weight` | string | `"bold"` atau `"normal"` | Dropdown / toggle |
| `font_size` | integer | Ukuran font | Slider / number input |
| `color` | string hex | Warna teks utama | Color picker |
| `highlight_color` | string hex | Warna highlight kata aktif | Color picker |
| `outline_color` | string hex | Warna outline teks | Color picker |
| `outline_width` | integer | Ketebalan outline (px) | Slider |
| `shadow_color` | string hex | Warna bayangan | Color picker |
| `shadow_offset_x` | integer | Offset bayangan horizontal | Number input |
| `shadow_offset_y` | integer | Offset bayangan vertikal | Number input |
| `line_spacing` | float | Spasi antar baris (misal 1.2) | Slider |
| `caption_bottom_margin` | integer | Jarak subtitle dari bawah (px) | Slider |

---

## 4. Job Management (Video Processing)

### `POST /api/v1/jobs/`

Kirim job pemrosesan video baru. Video akan diproses di background.

**Request Body:**
```json
{
  "urls": "https://www.youtube.com/watch?v=VIDEO_ID",
  "caption_style": 2
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `urls` | string | URL YouTube yang akan diproses |
| `caption_style` | integer | ID font style dari `/api/v1/caption-styles/` |

**Response `200`:**
```json
{
  "status": "accepted",
  "message": "Job has been queued for processing",
  "job_id": null
}
```

> Job berjalan di background. Gunakan endpoint status atau history untuk cek hasilnya.

---

### `GET /api/v1/jobs/history`

List semua job yang **file outputnya masih ada** di folder `tmp`.  
Ini adalah endpoint utama untuk halaman history.

**Response `200`:**
```json
[
  {
    "id": 80,
    "youtube_url": "https://www.youtube.com/watch?v=K62ceOMQ-2Q",
    "caption_style_id": 2,
    "status": "processing",
    "output_path": "./tmp/output/ALASAN_Kenapa...",
    "requested_at": "2026-03-06T13:25:18",
    "clips": [
      {
        "index": 1,
        "start_time": 1286.3,
        "end_time": 1317.0,
        "hook": "Dilema umur 20-an dan 50-an: Kebodohan vs Overthin",
        "score": 0.98,
        "reason": "Sangat berkesan, memberikan perspektif baru..."
      }
    ],
    "output_files": [
      "./tmp/output/ALASAN.../clip_1_final.mp4",
      "./tmp/output/ALASAN.../clip_2_final.mp4",
      "./tmp/output/ALASAN.../clip_3_final.mp4"
    ]
  }
]
```

**Field penting:**

| Field | Keterangan |
|---|---|
| `id` | ID job untuk operasi lainnya |
| `youtube_url` | URL asli yang diproses |
| `status` | `"completed"` / `"processing"` / `"failed"` |
| `clips` | Array clip yang dihasilkan AI (dengan hook, score, alasan) |
| `output_files` | Path file `.mp4` yang bisa diunduh |
| `requested_at` | Waktu permintaan (ISO 8601) |

---

### `GET /api/v1/jobs/{id}`

Cek status satu job spesifik.

**Response `200`:**
```json
{
  "id": 80,
  "youtube_url": "https://www.youtube.com/watch?v=K62ceOMQ-2Q",
  "status": "completed",
  "output_path": "./tmp/output/ALASAN...",
  "clips_count": 5
}
```

---

### `GET /api/v1/jobs/`

List semua job (termasuk yang file outputnya sudah terhapus). Berguna untuk admin melihat history lengkap.

**Response `200`:**
```json
[
  {
    "id": 80,
    "youtube_url": "https://...",
    "status": "completed",
    "clips_count": 5,
    "requested_at": "2026-03-06T13:25:18"
  }
]
```

---

### `DELETE /api/v1/jobs/{id}`

Hapus job dari database **dan hapus folder output** dari disk.

**Response `200`:**
```json
{
  "status": "deleted",
  "job_id": 80
}
```

**Error `404`:**
```json
{ "detail": "Job not found" }
```

---

## 5. User Management (Admin Only)

> Semua endpoint `/api/v1/users/*` hanya bisa diakses oleh user dengan `role: "admin"`.  
> User biasa akan mendapat error `403 Forbidden`.

### `GET /api/v1/users/`

List semua user.

**Response `200`:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@autocliper.local",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-03-06T14:08:04"
  },
  {
    "id": 2,
    "username": "editor1",
    "email": "editor@example.com",
    "role": "user",
    "is_active": true,
    "created_at": "2026-03-06T14:16:17"
  }
]
```

---

### `POST /api/v1/users/`

Buat user baru. Hanya admin yang bisa.

**Request Body:**
```json
{
  "username": "editor1",
  "password": "strongpassword",
  "email": "editor@example.com",
  "role": "user"
}
```

| Field | Wajib | Keterangan |
|---|---|---|
| `username` | ✅ | Harus unik |
| `password` | ✅ | Akan di-hash sebelum disimpan |
| `email` | ❌ | Opsional, harus unik jika diisi |
| `role` | ❌ | `"admin"` atau `"user"` (default: `"user"`) |

**Response `201`:** Objek user baru

**Error `409`:**
```json
{ "detail": "Username already exists" }
```

---

### `GET /api/v1/users/{id}`

Detail satu user.

**Response `200`:** Objek user (format sama dengan list)

**Error `404`:** `{ "detail": "User not found" }`

---

### `PUT /api/v1/users/{id}`

Edit user. Semua field opsional — kirim hanya yang ingin diubah.

**Request Body (semua optional):**
```json
{
  "email": "newemail@example.com",
  "role": "admin",
  "is_active": false,
  "password": "newpassword"
}
```

| Field | Keterangan |
|---|---|
| `email` | Ubah email |
| `role` | `"admin"` atau `"user"` |
| `is_active` | `false` untuk nonaktifkan akun |
| `password` | Kirim untuk ganti password (akan di-hash otomatis) |

**Response `200`:** Objek user terbaru

---

### `DELETE /api/v1/users/{id}`

Hapus user permanen. Admin tidak bisa hapus akun sendiri.

**Response `200`:**
```json
{
  "status": "deleted",
  "user_id": 3
}
```

**Error `400`:**
```json
{ "detail": "Cannot delete your own account" }
```

---

## 6. Error Reference

| HTTP Code | Arti | Kapan terjadi |
|---|---|---|
| `200` | OK | Request berhasil |
| `201` | Created | Resource berhasil dibuat |
| `400` | Bad Request | Data tidak valid / field salah |
| `401` | Unauthorized | Tidak ada token / token expired |
| `403` | Forbidden | Token valid tapi tidak punya izin (misal non-admin ke users endpoint) |
| `404` | Not Found | Resource tidak ditemukan |
| `409` | Conflict | Username sudah dipakai |
| `500` | Internal Server Error | Kesalahan server |

**Format error selalu:**
```json
{ "detail": "Pesan error di sini" }
```

---

## 7. Alur Frontend Lengkap (User Flow)

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
  → GET /api/v1/caption-styles/     ← isi dropdown font
  → User pilih font
  → GET /api/v1/caption-styles/{id}  ← tampilkan detail font
  → (opsional) User edit font style
  → PUT /api/v1/caption-styles/{id}
  → User isi URL YouTube + pilih font
  → POST /api/v1/jobs/
  → Tampilkan "Job sedang diproses..."
  → (polling) GET /api/v1/jobs/{id}  ← cek status
  → Jika status = "completed" → tampilkan output_files
```

### C. Alur History

```
Halaman History
  → GET /api/v1/jobs/history
  → Tampilkan list job + clips per job
  → Tombol download per file dari output_files
  → Tombol hapus → DELETE /api/v1/jobs/{id}
  → Reload list
```

### D. Alur Manajemen User (Admin)

```
Halaman Users (hanya tampil jika role == "admin")
  → GET /api/v1/users/         ← list users
  → Tombol tambah user
    → POST /api/v1/users/
  → Tombol edit user
    → GET /api/v1/users/{id}   ← isi form
    → PUT /api/v1/users/{id}
  → Tombol hapus user
    → DELETE /api/v1/users/{id}
```

---

## 8. Contoh Kode JavaScript Lengkap

```javascript
// utils/api.js
const BASE = 'http://localhost:8000';

export const api = {
  // Auth
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
  getStyles: ()         => api._req('/api/v1/caption-styles/'),
  getStyle: (id)        => api._req(`/api/v1/caption-styles/${id}`),
  updateStyle: (id, d)  => api._req(`/api/v1/caption-styles/${id}`, {
    method: 'PUT', body: JSON.stringify(d),
  }),

  // Jobs
  createJob: (urls, styleId) => api._req('/api/v1/jobs/', {
    method: 'POST', body: JSON.stringify({ urls, caption_style: styleId }),
  }),
  getJobHistory: ()     => api._req('/api/v1/jobs/history'),
  getJob: (id)          => api._req(`/api/v1/jobs/${id}`),
  deleteJob: (id)       => api._req(`/api/v1/jobs/${id}`, { method: 'DELETE' }),

  // Users (admin only)
  getUsers: ()          => api._req('/api/v1/users/'),
  getUser: (id)         => api._req(`/api/v1/users/${id}`),
  createUser: (d)       => api._req('/api/v1/users/', {
    method: 'POST', body: JSON.stringify(d),
  }),
  updateUser: (id, d)   => api._req(`/api/v1/users/${id}`, {
    method: 'PUT', body: JSON.stringify(d),
  }),
  deleteUser: (id)      => api._req(`/api/v1/users/${id}`, { method: 'DELETE' }),
};
```

---

## 9. Catatan Penting untuk Frontend

1. **Token expiry:** Token berlaku 24 jam. Jika expired, semua request balik `401`. Handle dengan redirect ke login.
2. **Role check:** Simpan `role` di localStorage. Sembunyikan menu "Users Management" jika `role !== "admin"`.
3. **Job status polling:** Setelah create job, poll `GET /api/v1/jobs/{id}` setiap 5-10 detik sampai `status === "completed"`.
4. **Output files:** Path di `output_files` adalah path server. Untuk download, frontend perlu endpoint file serving (atau bisa akses langsung jika server dan frontend di mesin yang sama).
5. **font_family read-only:** Jangan tampilkan field `font_family` di form edit. Tampilkan saja sebagai text label.
6. **CORS:** Jika frontend di domain berbeda, perlu tambahkan CORS middleware di server (hubungi backend).
