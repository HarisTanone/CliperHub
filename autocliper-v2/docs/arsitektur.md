# 🏗️ Arsitektur Sistem — AutoCliper v2

Dokumen ini menjelaskan arsitektur, komponen, pipeline pemrosesan, dan fungsi utama dari AutoCliper v2.

---

## Daftar Isi

- [Clean Architecture](#clean-architecture)
- [Komponen Utama](#komponen-utama)
- [Pipeline Pemrosesan Video](#pipeline-pemrosesan-video)
- [Sistem Tracking & Cropping](#sistem-tracking--cropping)
- [Sistem Subtitle](#sistem-subtitle)
- [Sistem Caching](#sistem-caching)
- [Database](#database)

---

## Clean Architecture

AutoCliper v2 menggunakan arsitektur berlapis (Clean Architecture):

```
┌──────────────────────────────────────────┐
│           Presentation Layer             │
│           (api.py — FastAPI)             │
├──────────────────────────────────────────┤
│           Application Layer              │
│    (services.py — Orkestrator Pipeline)  │
├──────────────────────────────────────────┤
│          Infrastructure Layer            │
│  (Semua integrasi eksternal & ML model)  │
├──────────────────────────────────────────┤
│             Domain Layer                 │
│     (entities.py — Model Data Bisnis)    │
└──────────────────────────────────────────┘
```

### Domain Layer (`src/domain/`)
- **`entities.py`** — Model data: `ClipData`, `CaptionStyle`, `HookStyle`, `RequestLog`, `VideoInfo`, `User`, `Font`
- **`interfaces.py`** — Interface abstrak untuk repository

### Application Layer (`src/application/`)
- **`services.py`** — `VideoProcessingPipeline`: orkestrator utama yang mengelola seluruh flow dari download video hingga render akhir

### Infrastructure Layer (`src/infrastructure/`)
- **`external_services.py`** — `GeminiService` (analisis AI), `YouTubeDownloader` (download video)
- **`video_processor.py`** — `VideoClipper` (potong video), `AudioExtractor` (ekstrak audio), `WhisperService` (transkripsi)
- **`yolo_deepsort_tracker.py`** — Tracking orang (YOLOv8 + ByteTrack), face detection, grid layout, smart cropping
- **`mouth_centered_face_tracker.py`** — Face tracking fallback menggunakan MediaPipe Face Mesh
- **`overlay_renderer.py`** — `HookRenderer` (render hook), `SubtitleRenderer` (render subtitle karaoke), single-pass rendering
- **`repositories.py`** — Repository database (CRUD caption style, hook style, font, user, request log)
- **`database.py`** — Koneksi database MySQL
- **`job_queue.py`** — `JobQueue`: sistem antrian job FIFO, mencegah duplikasi URL
- **`job_logger.py`** — `JobLogger`: logging real-time per stage (untuk endpoint `/api/v1/jobs/logs`)

### Presentation Layer (`src/presentation/`)
- **`api.py`** — Semua endpoint FastAPI (auth, jobs, styles, users, fonts)

---

## Komponen Utama

### 1. GeminiService — Analisis AI
**File:** `external_services.py`

Menggunakan **Gemini 2.5 Flash** untuk menganalisis konten video:
- Mengambil caption YouTube via `youtube-transcript-api`
- Mengambil metadata via YouTube Data API v3
- AI menentukan 3-5 momen terbaik untuk short video
- Menghasilkan hook text (max 120 karakter) untuk setiap clip
- Retry otomatis jika terkena rate limit

### 2. YouTubeDownloader — Download Video
**File:** `external_services.py`

- Download video terbaik (sampai 1080p) menggunakan `yt-dlp`
- Otomatis menggunakan cookies dari browser (Chrome → Safari → Firefox)
- Menyimpan ke folder cache untuk reuse

### 3. VideoClipper — Pemotong Video
**File:** `video_processor.py`

- Memotong segmen video menggunakan FFmpeg stream copy (sangat cepat)
- Tidak perlu re-encode saat memotong

### 4. WhisperService — Transkripsi
**File:** `video_processor.py`

- Menggunakan **Whisper.cpp** (C++) untuk transkripsi per-clip
- 10x lebih cepat dari Python Whisper
- Menghasilkan timestamp per kata untuk subtitle karaoke
- Fallback ke Python `openai-whisper` jika Whisper.cpp tidak tersedia

### 5. YoloCenteredVideoCropper — Tracking & Cropping
**File:** `yolo_deepsort_tracker.py`

Komponen paling kompleks, terdiri dari sub-komponen:

| Sub-Komponen | Fungsi |
|-------------|--------|
| `PersonDetector` | Deteksi orang menggunakan YOLOv8 + ByteTrack |
| `FaceDetector` | Deteksi wajah dalam bounding box orang (OpenCV DNN + MediaPipe) |
| `HeadPositioner` | Menentukan posisi kepala target berdasarkan rule-of-thirds |
| `KalmanSmoother` | Menghaluskan posisi wajah dengan Kalman filter |
| `BBoxSmoother` | Menghaluskan ukuran bounding box dengan EMA |
| `SpeakerDetector` | Mendeteksi pembicara aktif berdasarkan varians gerakan mulut |
| `LayoutManager` | Mengelola transisi antara mode single dan grid |
| `SmartCropper` | Melakukan cropping cerdas untuk single dan grid mode |
| `TransitionBlender` | Menangani crossfade antar mode |

Mendukung dua metode rendering:
- **`track_only()`** — Hanya tracking, hasilkan data posisi per frame (untuk single-pass)
- **`crop_to_aspect_ratio()`** — Tracking + cropping langsung ke file output

### 6. OverlayRenderer — Render Hook & Subtitle
**File:** `overlay_renderer.py`

- **HookRenderer**: Render teks hook di 3 detik pertama, dengan keyword highlighting dari AI (Gemini)
- **SubtitleRenderer**: Render subtitle karaoke dengan highlight per kata
- **`render_full_overlay_on_source()`**: Single-pass rendering — crop + overlay dalam satu kali FFmpeg encode (metode utama)
- **`render_full_overlay()`**: Legacy dual-pass — overlay di atas video yang sudah di-crop
- Mendukung berbagai style dari database
- Keyword extraction via Gemini AI untuk hook highlighting

### 7. JobQueue — Sistem Antrian
**File:** `job_queue.py`

- Antrian FIFO (First In First Out) untuk pemrosesan video
- **Deduplikasi**: Mencegah URL yang sama diproses bersamaan
- **Deteksi antrian**: URL yang sudah ada di antrian tidak ditambahkan lagi
- Job diproses satu per satu secara berurutan

### 8. JobLogger — Logging Real-time
**File:** `job_logger.py`

- Mencatat progress pemrosesan per tahap (stage)
- **Stage yang dilacak**: `fetching_video`, `analyzing_content`, `generating_clips`, `applying_captions`
- Menyimpan log per stage dengan timestamp
- Data diakses via endpoint `GET /api/v1/jobs/logs` untuk polling dari frontend

### 9. Status Pemrosesan (ProcessingState)
**File:** `entities.py`

Setiap job memiliki status yang berubah seiring pemrosesan:

| Status | Deskripsi |
|--------|-----------|
| `pending` | Job baru dibuat, menunggu antrian |
| `downloading` | Sedang download video YouTube |
| `analyzing` | Sedang analisis AI (Gemini) |
| `processing` | Sedang memproses clip (crop, subtitle, dll) |
| `completed` | Selesai, output tersedia |
| `failed` | Gagal, cek error log |

---

## Pipeline Pemrosesan Video

```
┌─────────────────┐
│   VideoProcessing│
│   Pipeline       │
│   (services.py)  │
└────────┬────────┘
         │
    ┌────▼────┐    Langkah 1: Validasi style dari DB
    │ Validasi │
    └────┬────┘
         │
    ┌────▼────┐    Langkah 2: Cek cache video
    │  Cache   │
    └────┬────┘
         │
    ┌────▼────┐    Langkah 3: Download video YouTube
    │ Download │    (atau gunakan cache)
    └────┬────┘
         │
    ┌────▼─────┐   Langkah 4: Ambil caption + metadata
    │ Captions  │   (YouTube API, BUKAN transcribe)
    └────┬─────┘
         │
    ┌────▼──────┐  Langkah 5: AI analisis momen terbaik
    │ Gemini AI  │  (menghasilkan hook + clip segments)
    └────┬──────┘
         │
    ┌────▼──────────────────────────┐
    │   Untuk setiap clip:          │
    │                               │
    │  ┌──────────┐ Potong video    │
    │  │ VideoClip │                │
    │  └────┬─────┘                 │
    │       │                       │
    │  ┌────▼─────┐ Ekstrak audio   │
    │  │  Audio   │                 │
    │  └────┬─────┘                 │
    │       │                       │
    │  ┌────▼─────┐ Transkripsi     │
    │  │ Whisper  │ (per kata)      │
    │  └────┬─────┘                 │
    │       │                       │
    │  ┌────▼──────┐ Tracking +     │
    │  │ YOLOv8    │ Cropping       │
    │  │ + Overlay │ + Hook/Sub     │
    │  └────┬──────┘                │
    │       │                       │
    │  ┌────▼──────┐                │
    │  │ Output    │ clip_X_final.mp4│
    │  └───────────┘                │
    └───────────────────────────────┘
```

---

## Sistem Tracking & Cropping (YOLOv8)

AutoCliper v2 menggunakan **YOLOv8** sebagai sistem tracking utama. Jika YOLOv8 tidak tersedia, otomatis fallback ke MediaPipe Face Mesh.

### Arsitektur Pipeline YOLOv8

```
Frame Video
    │
    ▼
┌────────────────────┐
│   PersonDetector   │  YOLOv8s + ByteTrack
│   (deteksi orang)  │  → Bounding box + track ID per orang
└────────┬───────────┘
         │
    ▼────▼────▼        Untuk setiap orang terdeteksi:
┌────────────────────┐
│   FaceDetector     │  OpenCV DNN (res10_300x300)
│   (deteksi wajah)  │  + MediaPipe Face Mesh (468 landmarks)
└────────┬───────────┘
         │
┌────────▼───────────┐
│   HeadPositioner   │  Hitung posisi target kepala
│   (posisi target)  │  berdasarkan rule-of-thirds
└────────┬───────────┘
         │
┌────────▼───────────┐
│   KalmanSmoother   │  Menghaluskan posisi wajah
│   + BBoxSmoother   │  dengan Kalman filter + EMA
└────────┬───────────┘
         │
┌────────▼───────────┐
│  SpeakerDetector   │  Tentukan siapa yang sedang bicara
│  (deteksi mulut)   │  berdasarkan varians gerakan mulut
└────────┬───────────┘
         │
┌────────▼───────────┐
│   LayoutManager    │  Tentukan mode: single atau grid
│   (layout mode)    │  + spatial locking (slot atas/bawah)
└────────┬───────────┘
         │
┌────────▼───────────┐
│   SmartCropper     │  Crop frame ke 9:16
│   (crop cerdas)    │  per orang (single/grid)
└────────┬───────────┘
         │
┌────────▼───────────┐
│ TransitionBlender  │  Crossfade antar mode
│ (transisi halus)   │  (single ↔ grid)
└────────────────────┘
```

### Detail Komponen YOLOv8

#### PersonDetector — Deteksi & Tracking Orang
- **Model:** `yolov8s.pt` (YOLOv8 Small) — otomatis didownload saat pertama kali
- **Tracker:** ByteTrack (bawaan Ultralytics) — memberikan `track_id` konsisten per orang
- **Confidence threshold:** 0.40
- **Kelas deteksi:** Hanya kelas `person` (kelas 0)
- **Akselerasi:** Otomatis menggunakan MPS (Apple Silicon) jika tersedia, fallback ke CPU
- **Persist:** Tracking antar frame dipertahankan (`persist=True`) untuk konsistensi ID

```python
# Contoh cara kerja internal
results = model.track(frame, persist=True, tracker='bytetrack.yaml',
                      classes=[0], conf=0.40, verbose=False)
# → Menghasilkan bounding box + track_id per orang
```

#### FaceDetector — Deteksi Wajah dalam Bounding Box
Menggunakan dua tahap:
1. **OpenCV DNN** (`res10_300x300_ssd`) — Deteksi wajah cepat dalam area bounding box orang
2. **MediaPipe Face Mesh** — Deteksi 468 landmark wajah untuk akurasi tinggi (termasuk landmark mulut)

Landmark mulut yang dipantau: titik 13, 14, 78, 308, 324, 402

#### SpeakerDetector — Siapa yang Bicara?
- Mengukur **varians gerakan mulut** (mouth openness) per orang
- Speaker aktif = orang dengan varians mulut tertinggi secara konsisten
- **Cooldown:** 120 frame (~4.8 detik di 25fps) untuk mencegah perpindahan bolak-balik
- **Minimum bicara:** 50 frame berturut-turut (~2 detik) + total 3 detik durasi bicara
- **Threshold:** Varians kandidat harus > 5x varians speaker aktif

#### LayoutManager — Mode Single vs Grid
- **Mode Single:** 1 orang terdeteksi, atau 1 orang dominan bicara
- **Mode Grid:** 2+ orang terdeteksi selama >= 3 detik berturut-turut (fps-aware)
- **Enter threshold:** `fps × 3.0` frame (~3 detik)
- **Leave threshold:** `fps × 1.5` frame (~1.5 detik)
- **Spatial locking:** Setelah masuk grid, slot atas/bawah terkunci per orang (tidak bertukar)

### Mode Single (1 Orang)
- Crop mengikuti wajah pembicara
- Resolusi output: 1080x1920 (9:16)
- Posisi kepala berdasarkan rule-of-thirds
- Smoothing via Kalman filter

### Mode Grid (2 Orang)
- Layar dibagi 2: atas (1080x960) dan bawah (1080x960)
- **Spatial locking**: Setelah ditentukan siapa di atas/bawah, posisi tidak bertukar
- **Posisi dinamis**: Posisi wajah/bbox diupdate setiap frame (bukan frozen)
- Smart cropping per orang dengan padding dinamis
- Minimum crop: 40% tinggi frame untuk menghindari blank area

### Parameter Cropping Grid

| Parameter | Nilai | Keterangan |
|-----------|-------|------------|
| Headroom (atas) | 0.30 | Ruang di atas kepala |
| Headroom (bawah) | 0.28 | Ruang di atas kepala |
| Pad factor (kecil) | 1.5x | Padding untuk orang kecil di frame |
| Pad factor (medium) | 1.3x | Padding untuk orang medium |
| Pad factor (besar) | 1.15x | Padding untuk orang besar |
| Min crop height | 75% tinggi orang | Minimum area crop |
| Min crop height (frame) | 40% tinggi frame | Floor minimum |

### Transisi
- **Single → Grid**: Instant cut (langsung tampil)
- **Grid → Single**: Crossfade halus (12 frame)

### Fallback: MediaPipe Face Mesh

Jika YOLOv8 / `ultralytics` tidak terinstal, sistem otomatis menggunakan **fallback tracker**:
- **File:** `mouth_centered_face_tracker.py`
- **Metode:** MediaPipe Face Mesh (468 landmarks) langsung dari frame
- **Anchor:** Mulut diposisikan di 60% dari atas frame
- **Smoothing:** Adaptive EMA (alpha cepat/lambat terpisah)
- **Grid:** Didukung dengan grid smoother terpisah (alpha lebih kecil untuk stabilitas)

> ⚠️ Fallback ini kurang akurat dibanding YOLOv8 karena tidak memiliki tracking berbasis ID (ByteTrack). Disarankan menginstal `ultralytics` untuk hasil terbaik.

---

## Sistem Subtitle

### Subtitle Karaoke
- Kata yang sedang diucapkan di-highlight dengan warna berbeda
- **Chunk dinamis**: 4 kata per chunk, dengan deteksi jeda natural (> 0.5 detik)
- **Timing**: 50ms lebih awal (pre-offset) + 150ms sustain (post-offset)

### Hook Text
- Muncul di 3 detik pertama video
- AI mendeteksi keyword penting dan memberi highlight
- Mendukung berbagai style (warna, ukuran, shadow)

---

## Sistem Caching

AutoCliper v2 menggunakan caching multi-level:

| Level | Apa yang di-cache | Efek |
|-------|-------------------|------|
| Video | `original.mp4` di folder output | Skip download pada run berikutnya |
| Transkrip | `audio_X.json` per clip | Skip Whisper pada reprocess |
| Analisis | Respons AI disimpan di database | Bisa reprocess dengan style berbeda |

---

## Database

### Tabel Utama

| Tabel | Fungsi |
|-------|--------|
| `caption_styles` | Style subtitle karaoke |
| `hook_styles` | Style teks hook |
| `fonts` | Daftar font yang tersedia |
| `request_log` | Log semua job (status, output, clip data) |
| `users` | Manajemen user dengan role (admin/user) |

### Skema
Lihat file `database/init.sql` untuk skema lengkap.

---

↩️ [Kembali ke README](../README.md)
