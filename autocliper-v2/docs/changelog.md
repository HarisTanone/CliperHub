# 📝 Riwayat Perubahan — AutoCliper v2

Semua perubahan penting pada AutoCliper v2 didokumentasikan di sini.

---

## [2.2.0] - 2026-05-12

### 🔒 Security

- **JWT Secret Key** — Tidak lagi ada hardcoded fallback. Server gagal start jika `JWT_SECRET_KEY` tidak di-set di environment
- **Path Traversal Protection** — Semua endpoint file serving (video, thumbnail) sekarang memvalidasi path dengan `os.path.realpath()` untuk mencegah directory traversal attack
- **Rate Limiting Login** — Endpoint `/api/v1/auth/login` dibatasi 5 percobaan per IP per 5 menit. Reset otomatis setelah login berhasil
- **Auth pada Video/Thumbnail** — Endpoint `serve_video` dan `serve_thumbnail` sekarang memerlukan JWT token (sebelumnya public)

### ⚡ Performance

- **Binary Search Subtitle** — Pencarian subtitle aktif per-frame menggunakan binary search O(log n) menggantikan linear search O(n). Signifikan untuk video panjang dengan banyak subtitle chunk
- **Optimized Text Outline** — `SubtitleRenderer._draw_text_with_style` sekarang menggunakan Pillow `stroke_width` (1 draw call) alih-alih nested loop O(outline_width²). Fallback ke 8-direction draw untuk Pillow lama
- **Optimized `get_existing_jobs`** — Query hanya mengambil job dengan status `completed` dan `output_path` tidak null, dengan limit 50. Mengurangi filesystem I/O drastis

### 🏗️ Infrastructure

- **Database Connection Pooling** — SQLAlchemy engine sekarang dikonfigurasi dengan `pool_size=5`, `max_overflow=10`, `pool_recycle=3600`, `pool_pre_ping=True`
- **FastAPI Lifespan** — Migrasi dari deprecated `@app.on_event("startup")` ke `asynccontextmanager` lifespan pattern
- **Modern SQLAlchemy** — Migrasi dari `declarative_base()` ke `DeclarativeBase` class (SQLAlchemy 2.0 style)
- **Modern datetime** — `datetime.utcnow()` diganti `datetime.now(timezone.utc)` (Python 3.12+ compatible)
- **asyncio fix** — `asyncio.get_event_loop()` diganti `asyncio.get_running_loop()` di job_queue (Python 3.12+ compatible)
- **Database Index** — Tambah index pada `request_log.youtube_url` untuk cache lookup yang lebih cepat

### 🧹 Code Quality

- **Hapus duplikat YouTubeDownloader** — Class di `video_processor.py` dihapus (yang aktif ada di `external_services.py`)
- **Environment validation** — `main.py` sekarang memvalidasi semua required env vars (`DATABASE_URL`, `JWT_SECRET_KEY`, `GEMINI_API_KEY`) sebelum start
- **`.env.example` lengkap** — Ditambahkan `JWT_SECRET_KEY`, `YOUTUBE_API_KEY`, dan `JWT_EXPIRE_MINUTES`
- **Proper error logging** — Bare `except: pass` diganti dengan proper exception logging

### 🧪 Testing

- **Test framework** — Setup pytest dengan `pytest.ini` dan `tests/conftest.py`
- **Unit tests** — 13 test cases covering:
  - Authentication (hash, verify, JWT create/decode/expiry)
  - Domain entities (HookStyle config merge, CaptionStyle, SubtitleSegment)
  - API security (path traversal blocking, rate limiter)

### 📄 Database Migration

- `database/migrate_add_indexes.sql` — Script untuk menambahkan index pada database existing

#### File yang Diubah
- `src/infrastructure/auth.py` — Security hardening
- `src/infrastructure/database.py` — Connection pooling + modern SQLAlchemy
- `src/infrastructure/job_queue.py` — asyncio fix
- `src/infrastructure/video_processor.py` — Remove duplicate class
- `src/infrastructure/overlay_renderer.py` — Binary search + outline optimization
- `src/infrastructure/repositories.py` — Optimized queries
- `src/presentation/api.py` — Rate limiting, path traversal, lifespan, auth
- `main.py` — Env validation
- `.env.example` — Complete variables
- `database/init.sql` — Added youtube_url index
- `requirements.txt` — Added pytest
- `tests/` — New test suite

---

## [2.1.0] - 2026-03-15

### 🔧 Perbaikan Grid Layout & Hook

#### Diperbaiki
- **Grid: Posisi dinamis per-frame** — Posisi wajah/bbox diupdate setiap frame (sebelumnya frozen di frame pertama grid). Slot assignment (siapa atas/bawah) tetap terkunci
- **Grid: Framing lebih baik** — Mengurangi ruang kosong di atas kepala dengan headroom yang lebih kecil (0.30/0.28 dari 0.35/0.33)
- **Grid: Padding dikurangi** — pad_factor dari 1.8/1.4/1.2 menjadi 1.5/1.3/1.15 untuk framing lebih rapat
- **Grid: Minimum crop height** — Dinaikkan ke 75% tinggi orang + minimum 40% tinggi frame untuk mencegah area blank
- **Hook: Batas karakter dinaikkan** — Dari 50 menjadi 120 karakter agar hook tidak terpotong di tengah kalimat

#### File yang Diubah
- `src/infrastructure/yolo_deepsort_tracker.py` — Grid cropping & tracking
- `src/infrastructure/overlay_renderer.py` — Single-pass renderer
- `src/infrastructure/external_services.py` — Prompt AI & parsing hook

---

## [2.0.2] - 2026-03-08

### 🔧 Perbaikan YouTube Download

#### Diperbaiki
- **Cookie handling** — Prioritas browser cookies (Chrome → Safari → Firefox) untuk mengatasi YouTube bot detection
- **Format selection** — Disederhanakan agar lebih reliable (`best` sebagai fallback)
- **Error messages** — Pesan error lebih jelas dengan instruksi perbaikan

#### Ditambahkan
- `start.sh` — Script mulai cepat dengan cek cookies otomatis
- `.gitignore` — Proteksi file cookies agar tidak ter-commit

---

## [2.0.1] - 2026-01-15

### 🔧 Perbaikan Face Tracking & Grid Mode

#### Diperbaiki
- **Perpindahan speaker terlalu cepat** — Speaker sekarang butuh kandidat bicara >= 50 frame (2 detik) berturut-turut + total durasi bicara >= 3 detik
- **Threshold variance lebih ketat** — Kandidat harus punya variance > 5x speaker aktif
- **Grid muncul untuk bicara pendek** — Grid sekarang hanya muncul jika 2 wajah terdeteksi >= 3 detik berturut-turut (fps-aware)
- **Grid goyang saat zoom** — Grid mode pakai smoother terpisah dengan alpha lebih kecil (0.02 vs 0.05)
- **Subtitle sync** — Pre-offset dikurangi ke 50ms (lebih natural), post-offset dinaikkan ke 150ms (sustain lebih lama)
- **Dynamic chunking** — 4 kata per chunk dengan deteksi jeda natural (> 0.5 detik)

#### Diubah
- `SpeakerDetector`: `min_speak_frames=50`, `cooldown_frames=120`, `variance threshold 5x`
- Grid smoother: `alpha_fast=0.02`, `alpha_slow=0.01`, `threshold=100px`
- Subtitle: `PRE_OFFSET=0.05s`, `POST_OFFSET=0.15s`, `words_per_chunk=4`

---

## [2.0.0] - 2026-01-14

### 🎉 Rilis Mayor — Tulis Ulang Total

#### Ditambahkan
- **Integrasi Caption YouTube** — Langsung menggunakan caption YouTube untuk analisis AI (20x lebih cepat)
- **Face Tracking Berbasis Mulut** — MediaPipe Face Mesh dengan 468 landmark
- **Subtitle Karaoke** — Highlight per kata dengan transisi halus
- **AI Keyword Highlighting** — Gemini menganalisis hook dan highlight kata penting
- **Caching Multi-level** — Cache video, transkrip, dan hasil analisis
- **Logging Detail** — Log langkah demi langkah dengan emoji
- **Clean Architecture** — Layer Domain, Application, Infrastructure, Presentation
- **Background Processing** — FastAPI BackgroundTasks untuk proses async

#### Diubah
- **Model AI**: Gemini 1.5 → Gemini 2.0 Flash (lebih cepat & murah)
- **Transkripsi**: Python Whisper → Whisper.cpp (10x lebih cepat)
- **Face Tracking**: Center-only → Mouth-centered (framing lebih baik)
- **Subtitle**: Dasar → Karaoke per kata (profesional)
- **Hook**: Statis → AI keyword highlight (lebih menarik)
- **Codec Video**: mp4v → libx264 (kompatibilitas lebih baik)
- **Flow Proses**: Sequential full video → Per-clip processing

#### Dihapus
- ❌ Transkripsi video penuh (diganti caption YouTube)
- ❌ Duplikasi transkripsi per clip
- ❌ Implementasi face tracker lama
- ❌ File test yang tidak digunakan
- ❌ 15+ file dokumentasi deprecated

#### Performa
- **Analisis AI**: 5-10 menit → 10-30 detik (20x lebih cepat)
- **Total Waktu (pertama)**: 30-60 menit → 5-15 menit (4-6x lebih cepat)
- **Total Waktu (cache)**: 30-60 menit → 3-10 menit (6-10x lebih cepat)
- **Penggunaan Memori**: Berkurang 50%
- **Biaya API**: Berkurang 90%

---

## [1.0.0] - 2025-12

### Rilis Awal
- Pipeline pemrosesan video dasar
- Analisis AI Gemini 1.5
- Transkripsi Python Whisper
- Face tracking dasar
- Hook overlay statis
- Subtitle dasar
- Integrasi database MySQL

---

## Rencana Pengembangan

### [2.2.0] — Direncanakan
- [ ] Pemrosesan clip paralel (3-5x lebih cepat)
- [ ] Akselerasi GPU untuk face tracking
- [ ] Web UI untuk kemudahan penggunaan
- [ ] Pemrosesan batch (multiple video)
- [ ] Upload font kustom

### [3.0.0] — Masa Depan
- [ ] Pemrosesan real-time
- [ ] Upload langsung ke media sosial
- [ ] Dashboard analitik
- [ ] Kolaborasi tim

---

**Legenda:**
- 🎉 Fitur utama
- ✨ Fitur baru
- 🐛 Perbaikan bug
- ⚡ Peningkatan performa
- 🔧 Konfigurasi/perbaikan teknis
- ❌ Dihapus

---

↩️ [Kembali ke README](../README.md)
