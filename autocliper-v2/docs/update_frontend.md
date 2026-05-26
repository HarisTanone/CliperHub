# 🖥️ Frontend Update Guide — AutoCliper v2.2

Dokumen ini berisi semua perubahan yang harus dilakukan di frontend setelah update backend v2.2.

---

## ⚠️ Breaking Changes (WAJIB diupdate)

### 1. Video & Thumbnail Endpoint Butuh Auth Token

**Sebelumnya:** Endpoint `/api/v1/jobs/{id}/videos/{filename}` dan `/api/v1/jobs/{id}/thumbnails/{filename}` bisa diakses tanpa token (public).

**Sekarang:** Semua endpoint file serving memerlukan JWT Bearer token.

**Impact:** Semua `<video src="...">` dan `<img src="...">` yang langsung mengarah ke URL tersebut akan return **401 Unauthorized**.

**Solusi — Fetch sebagai Blob:**

```js
// utils/api.js
export async function getAuthenticatedMediaUrl(endpoint) {
  const token = localStorage.getItem('access_token');
  const response = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Contoh penggunaan di komponen
async function loadVideo(jobId, filename) {
  const url = await getAuthenticatedMediaUrl(
    `/api/v1/jobs/${jobId}/videos/${filename}`
  );
  videoElement.src = url;
}

async function loadThumbnail(jobId, filename) {
  const url = await getAuthenticatedMediaUrl(
    `/api/v1/jobs/${jobId}/thumbnails/${filename}`
  );
  imgElement.src = url;
}
```

**Penting:** Jangan lupa `URL.revokeObjectURL(url)` saat komponen di-unmount untuk mencegah memory leak.

---

### 2. Handle Rate Limiting (429) di Login

**Sebelumnya:** Login gagal selalu return 401.

**Sekarang:** Setelah 5 percobaan gagal dalam 5 menit, return **429 Too Many Requests**.

**Yang perlu ditambahkan:**

```js
// pages/Login.jsx
async function handleLogin(username, password) {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (response.status === 429) {
    setError('Terlalu banyak percobaan login. Coba lagi dalam 5 menit.');
    setLoginDisabled(true);
    setTimeout(() => setLoginDisabled(false), 300_000); // 5 menit
    return;
  }

  if (response.status === 401) {
    setError('Username atau password salah');
    return;
  }

  if (response.status === 403) {
    setError('Akun dinonaktifkan. Hubungi admin.');
    return;
  }

  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
  // redirect...
}
```

---

## 🆕 Fitur Baru — Two-Step Clip Selection

### Overview

Flow baru yang memungkinkan user me-review dan mengedit clip sebelum diproses:

```
[Input URL] → [Analyze] → [Review Clips] → [Select & Edit] → [Process]
```

### API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/jobs/analyze` | Analyze video, return clip candidates |
| POST | `/api/v1/jobs/process-selected` | Process hanya clip yang dipilih |

### A. Halaman/Komponen: Analyze Video

**Request:**
```json
POST /api/v1/jobs/analyze
{
  "url": "https://www.youtube.com/watch?v=xxxxx",
  "caption_style": 1,
  "hook_style_id": 5
}
```

**Response:**
```json
{
  "status": "success",
  "url": "https://www.youtube.com/watch?v=xxxxx",
  "clips": [
    {
      "index": 1,
      "start_time": 12.5,
      "end_time": 48.2,
      "hook": "Kenapa anak jadi GTM?",
      "score": 0.95,
      "reason": "Pembahasan GTM yang sangat engaging",
      "keywords": ["GTM"]
    },
    {
      "index": 2,
      "start_time": 65.0,
      "end_time": 110.3,
      "hook": "Rahasia diet tanpa lapar",
      "score": 0.91,
      "reason": "Tips diet yang actionable",
      "keywords": ["RAHASIA", "DIET"]
    }
  ]
}
```

**UI yang dibutuhkan:**
- Form input: URL + dropdown Caption Style + dropdown Hook Style
- Tombol "🔍 Analyze Video"
- Loading state dengan pesan "Menganalisis video... (~30-60 detik)"
- Error handling jika analysis gagal

### B. Halaman/Komponen: Review & Select Clips

Setelah analyze berhasil, tampilkan list clip candidates:

```
┌─────────────────────────────────────────────────────────┐
│ [✓] Clip 1 — Score: 0.95 ⭐                            │
│     ⏱️ 12.5s → 48.2s (35.7 detik)                      │
│     🎣 Hook: [Kenapa anak jadi GTM?        ] ← input   │
│     🏷️ Keywords: GTM                                    │
│     💡 Reason: Pembahasan GTM yang engaging             │
├─────────────────────────────────────────────────────────┤
│ [✓] Clip 2 — Score: 0.91                               │
│     ⏱️ 65.0s → 110.3s (45.3 detik)                     │
│     🎣 Hook: [Rahasia diet tanpa lapar     ] ← input   │
│     🏷️ Keywords: RAHASIA, DIET                          │
│     💡 Reason: Tips diet yang actionable                │
├─────────────────────────────────────────────────────────┤
│ [ ] Clip 3 — Score: 0.87                               │
│     ⏱️ 150.0s → 195.0s (45 detik)                      │
│     🎣 Hook: [Ini yang sering salah        ] ← input   │
│     🏷️ Keywords: SALAH                                  │
│     💡 Reason: Common mistake yang relatable            │
└─────────────────────────────────────────────────────────┘

         [🚀 Process 2 Selected Clips]
```

**Fitur yang dibutuhkan:**
- Checkbox per clip (select/deselect)
- Input field untuk edit hook text (editable)
- Tombol hapus clip dari list
- Counter: "2 dari 3 clip dipilih"
- Tombol "Process Selected Clips" (disabled jika 0 dipilih)

### C. Submit Selected Clips

**Request:**
```json
POST /api/v1/jobs/process-selected
{
  "url": "https://www.youtube.com/watch?v=xxxxx",
  "caption_style": 1,
  "hook_style_id": 5,
  "clips": [
    {
      "index": 1,
      "start_time": 12.5,
      "end_time": 48.2,
      "hook": "Kenapa anak jadi GTM?",
      "score": 0.95,
      "reason": "Pembahasan GTM yang engaging",
      "keywords": ["GTM"]
    },
    {
      "index": 2,
      "start_time": 65.0,
      "end_time": 110.3,
      "hook": "Diet tanpa lapar itu mungkin",
      "score": 0.91,
      "reason": "Tips diet yang actionable",
      "keywords": ["DIET"]
    }
  ]
}
```

**Response:**
```json
{
  "status": "accepted",
  "message": "Processing 2 selected clips"
}
```

Setelah submit, redirect ke halaman progress monitoring.

---

## 🆕 Fitur Baru — Real-time Progress (SSE)

### Overview

Ganti polling `setInterval` dengan Server-Sent Events untuk progress yang lebih real-time dan efisien.

**Endpoint:** `GET /api/v1/jobs/logs/stream`

### Implementasi

```js
// hooks/useJobProgress.js
export function useJobProgress(token) {
  const [progress, setProgress] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!token) return;
    
    let abortController = new AbortController();
    setIsStreaming(true);

    async function streamProgress() {
      try {
        const response = await fetch('/api/v1/jobs/logs/stream', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal,
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              setProgress(data);

              // Auto-stop saat selesai
              if (data.status === 'completed' || data.status === 'failed') {
                setIsStreaming(false);
                return;
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('SSE stream error:', err);
          // Fallback ke polling jika SSE gagal
          fallbackToPolling();
        }
      }
    }

    streamProgress();

    return () => {
      abortController.abort();
      setIsStreaming(false);
    };
  }, [token]);

  return { progress, isStreaming };
}
```

### Data Structure dari SSE

Setiap event berisi JSON lengkap:

```json
{
  "youtube_url": "https://...",
  "status": "processing",
  "current_stage": "Generating Clips",
  "current_stage_key": "generating_clips",
  "total_clips": 3,
  "clips_completed": 1,
  "started_at": "2026-05-12T10:30:00",
  "finished_at": null,
  "error": null,
  "stages": [
    {
      "key": "fetching_video",
      "label": "Fetching Video",
      "status": "done",
      "started_at": "...",
      "finished_at": "...",
      "logs": [{"message": "...", "timestamp": "..."}]
    },
    {
      "key": "analyzing_content",
      "label": "Analyzing Content",
      "status": "done",
      "started_at": "...",
      "finished_at": "...",
      "logs": [...]
    },
    {
      "key": "generating_clips",
      "label": "Generating Clips",
      "status": "active",
      "started_at": "...",
      "finished_at": null,
      "logs": [...]
    },
    {
      "key": "applying_captions",
      "label": "Applying Captions",
      "status": "pending",
      "started_at": null,
      "finished_at": null,
      "logs": []
    }
  ]
}
```

### UI Progress Component

```
┌─────────────────────────────────────────────────────┐
│ 🎬 Processing: youtube.com/watch?v=xxxxx            │
│                                                     │
│ ✅ Fetching Video ─────────────────── Done          │
│ ✅ Analyzing Content ──────────────── Done          │
│ 🔄 Generating Clips ──────────────── 1/3 clips     │
│ ⏳ Applying Captions ──────────────── Pending       │
│                                                     │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░ 33%            │
│                                                     │
│ Latest: [Clip 2] Tracking persons (YOLOv8)...       │
└─────────────────────────────────────────────────────┘
```

**Catatan:** Endpoint polling lama `GET /api/v1/jobs/logs` masih berfungsi sebagai fallback.

---

## 🆕 Fitur Baru — Admin Panel

### Hanya tampilkan jika `user.role === "admin"`

### A. Disk Cleanup

**Endpoint:** `POST /api/v1/admin/cleanup?days=30`

**Response:**
```json
{
  "status": "ok",
  "deleted": 5,
  "freed_mb": 2340.5,
  "cutoff_days": 30
}
```

**UI:**
```
┌─────────────────────────────────────────────────────┐
│ 🗑️ Disk Cleanup                                     │
│                                                     │
│ Hapus output lebih dari [30] hari                   │
│                                                     │
│ [🧹 Run Cleanup]                                    │
│                                                     │
│ ✅ Berhasil menghapus 5 folder (2.3 GB freed)       │
└─────────────────────────────────────────────────────┘
```

### B. Pipeline Configuration

**Endpoint GET:** `GET /api/v1/admin/config`

**Response:**
```json
{
  "hook_duration_min": 2.0,
  "hook_duration_max": 4.5,
  "hook_reading_speed": 3.5,
  "hook_padding": 0.8,
  "words_per_chunk": 4,
  "parallel_clips": false,
  "audio_normalize": true,
  "smart_thumbnail": true,
  "thumbnail_candidates": 5
}
```

**Endpoint PUT:** `PUT /api/v1/admin/config`

**Request body (partial update):**
```json
{
  "audio_normalize": false,
  "hook_duration_max": 5.0
}
```

**UI:**
```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Pipeline Configuration                           │
│                                                     │
│ Hook Duration                                       │
│   Min: [2.0]s  Max: [4.5]s  Reading Speed: [3.5]   │
│   Padding: [0.8]s                                   │
│                                                     │
│ Subtitle                                            │
│   Words per Chunk: [4]                              │
│                                                     │
│ Output                                              │
│   Audio Normalize: [✓]                             │
│   Smart Thumbnail: [✓]                             │
│   Thumbnail Candidates: [5]                         │
│                                                     │
│ [💾 Save Changes]                                   │
│                                                     │
│ ⚠️ Perubahan berlaku untuk job berikutnya.           │
│    Tidak persist setelah server restart.             │
└─────────────────────────────────────────────────────┘
```

---

## 🆕 Fitur Baru — Enhanced Health Status

**Endpoint:** `GET /health` (public, tanpa auth)

**Response baru:**
```json
{
  "status": "healthy",
  "service": "AutoCliper v2",
  "queue": {
    "processing": true,
    "pending": 2
  },
  "disk": {
    "free_gb": 45.2,
    "status": "ok"
  }
}
```

**UI — Status Bar di Header/Navbar:**

```
┌──────────────────────────────────────────────────────────────┐
│ AutoCliper v2    🟢 Healthy  │  🔄 Processing  │  📋 Queue: 2  │  💾 45.2 GB free │
└──────────────────────────────────────────────────────────────┘
```

- `disk.status === "warning"` → tampilkan badge kuning ⚠️
- `disk.status === "critical"` → tampilkan badge merah 🔴 + alert

---

## 📝 Update Minor — Job History

### Keywords Display

Response `GET /api/v1/jobs/history` sekarang include `keywords` per clip di field `clips[].keywords` (belum ada di response model lama, tapi data tersimpan di DB).

**Tambahkan di UI history:**

```
┌─────────────────────────────────────────────────────┐
│ Clip 1: 12.5s → 48.2s                              │
│ 🎣 "Kenapa anak jadi GTM?"                          │
│ 🏷️ GTM                          ← keyword badges    │
│ ⭐ Score: 0.95                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Checklist Implementasi

### Prioritas Tinggi (Breaking Changes)
- [ ] Update semua video/thumbnail loading ke authenticated fetch + blob URL
- [ ] Handle 429 response di halaman login
- [ ] Revoke blob URLs saat komponen unmount

### Prioritas Sedang (Fitur Baru)
- [ ] Halaman Analyze Video (form + loading)
- [ ] Halaman Review & Select Clips (list + edit + select)
- [ ] SSE progress stream (atau keep polling sebagai fallback)
- [ ] Admin: Disk Cleanup page
- [ ] Admin: Pipeline Config page

### Prioritas Rendah (Enhancement)
- [ ] Health status bar di navbar
- [ ] Keywords badges di job history
- [ ] Disk space warning alert

---

## 🔗 API Reference Lengkap (Endpoint Baru)

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/v1/jobs/analyze` | User | Analyze video → return clip candidates |
| POST | `/api/v1/jobs/process-selected` | User | Process selected clips only |
| GET | `/api/v1/jobs/logs/stream` | User | SSE real-time progress |
| GET | `/api/v1/jobs/{id}/videos/{file}` | User | Serve video (now requires auth) |
| GET | `/api/v1/jobs/{id}/thumbnails/{file}` | User | Serve thumbnail (now requires auth) |
| POST | `/api/v1/admin/cleanup` | Admin | Delete old outputs |
| GET | `/api/v1/admin/config` | Admin | Get pipeline config |
| PUT | `/api/v1/admin/config` | Admin | Update pipeline config |
| GET | `/health` | Public | Enhanced health check |

---

## 🏗️ Suggested File Structure (jika pakai React/Vue)

```
src/
├── pages/
│   ├── Login.jsx              ← update: handle 429
│   ├── Dashboard.jsx          ← update: health status bar
│   ├── NewJob.jsx             ← update: pilih mode (direct / analyze)
│   ├── AnalyzeVideo.jsx       ← BARU
│   ├── ReviewClips.jsx        ← BARU
│   ├── JobProgress.jsx        ← update: SSE stream
│   ├── JobHistory.jsx         ← update: keywords badges
│   └── admin/
│       ├── DiskCleanup.jsx    ← BARU
│       └── PipelineConfig.jsx ← BARU
├── components/
│   ├── ClipCard.jsx           ← BARU (reusable clip display)
│   ├── ProgressStages.jsx     ← BARU (stage progress bar)
│   ├── HealthBadge.jsx        ← BARU (navbar status)
│   └── AuthMedia.jsx          ← BARU (authenticated img/video)
├── hooks/
│   ├── useJobProgress.js      ← BARU (SSE hook)
│   └── useAuthMedia.js        ← BARU (blob URL hook)
└── utils/
    └── api.js                 ← update: add getAuthenticatedMediaUrl
```
