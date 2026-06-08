# AutoCliper v2 🎬

Sistem otomatis untuk membuat short video viral dari YouTube menggunakan AI, face tracking, subtitle karaoke, dan styling yang bisa dikustomisasi.

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## 📚 Daftar Isi

- [Mulai Cepat](#-mulai-cepat)
- [Fitur Utama](#-fitur-utama)
- [Cara Kerja](#-cara-kerja)
- [Endpoint API](#-endpoint-api)
- [Konfigurasi](#-konfigurasi)
- [Struktur Proyek](#-struktur-proyek)
- [Pemecahan Masalah](#-pemecahan-masalah)
- [Dokumentasi Lengkap](#-dokumentasi-lengkap)

---

## 🚀 Mulai Cepat

```bash
# 1. Clone & Setup
git clone <repository>
cd autocliper-v2
python3 -m venv venv
source venv/bin/activate

# 2. Install Dependencies
pip install -r requirements.txt

# 3. Setup Whisper.cpp (transkripsi cepat)
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build && cmake --build build
bash ./models/download-ggml-model.sh medium
cp models/ggml-medium.bin ../models/
cd ..

# 4. Setup Database
mysql -u root -p -e "CREATE DATABASE autocliper;"
mysql -u root -p autocliper < database/init.sql

# 5. Konfigurasi Environment
cp .env.example .env
# Edit .env dengan credentials Anda

# 6. Jalankan Server
python3 main.py
```

Server berjalan di: `http://0.0.0.0:8000`

> 📖 Panduan instalasi lengkap: [docs/instalasi.md](docs/instalasi.md)

---

## ✨ Fitur Utama

### 🤖 Analisis Video dengan AI
- **Gemini 2.5 Flash** menganalisis caption YouTube untuk menemukan momen terbaik
- Otomatis generate hook text yang menarik untuk setiap clip
- **20x lebih cepat** — tidak perlu download & transcribe seluruh video

### 🎤 Subtitle Karaoke
- **Highlight per kata** — kata yang sedang diucapkan di-highlight secara real-time
- Chunk dinamis berdasarkan jeda natural (4 kata per chunk)
- Warna dan styling bisa dikustomisasi dari database

### 📹 Smart Video Processing
- **Output HD**: 1080x1920 (format vertikal 9:16)
- **YOLOv8 + ByteTrack**: Deteksi dan tracking orang dengan akurat
- **Grid Mode**: Otomatis tampilkan 2 orang dalam split-screen saat kedua berbicara
- **Smooth Transitions**: Kalman filter & EMA smoothing untuk transisi halus
- **Hook Overlay**: Teks hook di 3 detik pertama dengan keyword highlighting

### ⚡ Performa Optimal
- **Whisper C++**: Transkripsi 10x lebih cepat dari Python Whisper
- **Smart Caching**: Video, transkrip, dan hasil AI di-cache untuk reprocessing cepat
- **Background Processing**: Job diproses asynchronous via antrian
- **Single-Pass Rendering**: Crop + overlay dalam satu kali encode

---

## 🔄 Cara Kerja

```
1. [Validasi]     → Cek caption style dari database
       ↓
2. [Cache]        → Cek apakah video sudah pernah didownload
       ↓
3. [Download]     → Download video YouTube (atau gunakan cache)
       ↓
4. [Captions]     → Ambil caption YouTube + metadata (cepat!)
       ↓
5. [Analisis AI]  → Gemini 2.5 Flash → Temukan momen menarik + generate hook
       ↓
6. [Simpan DB]    → Simpan request_log dengan respons AI
       ↓
7. [Proses Clip]  → Untuk setiap clip:
       ├─ [1/6] Potong segmen video
       ├─ [2/6] Ekstrak audio
       ├─ [3/6] Generate subtitle (Whisper C++)
       ├─ [4/6] Tracking wajah (YOLOv8 / MediaPipe)
       ├─ [5/6] Crop ke 9:16 (adaptive smoothing)
       └─ [6/6] Render hook + subtitle karaoke
       ↓
8. [Bersihkan]    → Hapus file sementara, simpan hasil akhir
       ↓
9. [Update DB]    → Status = completed, path output tersimpan
```

> 📖 Detail arsitektur: [docs/arsitektur.md](docs/arsitektur.md)

---

## 📡 Endpoint API

### Health Check (Publik)
```bash
curl http://0.0.0.0:8000/health
```

### Login
```bash
curl -X POST 'http://0.0.0.0:8000/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "administrator"}'
```

### Buat Job Baru
```bash
curl -X POST 'http://0.0.0.0:8000/api/v1/jobs/' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "urls": "https://www.youtube.com/watch?v=VIDEO_ID",
    "caption_style": 1,
    "hook_style_id": 1
  }'
```

### Cek Status Job
```bash
curl -H 'Authorization: Bearer <token>' \
  'http://0.0.0.0:8000/api/v1/jobs/{id}'
```

### Lihat Log Real-time
```bash
curl -H 'Authorization: Bearer <token>' \
  'http://0.0.0.0:8000/api/v1/jobs/logs'
```

### Lihat Riwayat Job
```bash
curl -H 'Authorization: Bearer <token>' \
  'http://0.0.0.0:8000/api/v1/jobs/history'
```

> 📖 Dokumentasi API lengkap: [docs/api.md](docs/api.md)

---

## ⚙️ Konfigurasi

### Environment Variables (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=autocliper

# API Keys
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key

# Whisper
WHISPER_MODEL_PATH=./models/ggml-medium.bin

# Output
OUTPUT_DIR=./tmp/output
```

### Kualitas Video
| Parameter | Nilai |
|-----------|-------|
| Resolusi Output | 1080x1920 (9:16 vertikal) |
| Codec | H.264 (libx264) |
| CRF | 18 (kualitas tinggi) |
| Format | MP4 |

---

## 📁 Struktur Proyek

```
autocliper-v2/
├── main.py                          # Entry point (Uvicorn server)
├── requirements.txt                 # Dependencies Python
├── .env                             # Environment variables
├── start.sh                         # Script mulai cepat
│
├── src/
│   ├── domain/                      # Domain Layer
│   │   ├── entities.py              # ClipData, CaptionStyle, HookStyle, dll
│   │   └── interfaces.py           # Interface abstrak
│   │
│   ├── application/                 # Application Layer
│   │   └── services.py             # VideoProcessingPipeline (orkestrator)
│   │
│   ├── infrastructure/              # Infrastructure Layer
│   │   ├── database.py             # Koneksi database
│   │   ├── repositories.py         # Repository (caption, hook, font, user)
│   │   ├── external_services.py    # GeminiService, YouTubeDownloader
│   │   ├── video_processor.py      # VideoClipper, AudioExtractor, WhisperService
│   │   ├── yolo_deepsort_tracker.py # YOLOv8 tracking + grid + cropping
│   │   ├── mouth_centered_face_tracker.py # Face tracking fallback (MediaPipe)
│   │   ├── overlay_renderer.py     # HookRenderer, SubtitleRenderer
│   │   └── job_queue.py            # Antrian job
│   │
│   └── presentation/               # Presentation Layer
│       └── api.py                  # FastAPI endpoints
│
├── docs/                            # Dokumentasi
│   ├── api.md                      # Dokumentasi API lengkap
│   ├── arsitektur.md               # Arsitektur & fungsi sistem
│   ├── instalasi.md                # Panduan instalasi lengkap
│   ├── panduan-cookies.md          # Panduan cookies YouTube
│   └── changelog.md                # Riwayat perubahan
│
├── database/init.sql                # Skema database
├── models/                          # Model ML (Whisper)
├── assets/fonts/                    # Font untuk subtitle
├── whisper.cpp/                     # Whisper C++ (dikompilasi)
└── tmp/output/                      # Output video
```

> 📖 Penjelasan arsitektur lengkap: [docs/arsitektur.md](docs/arsitektur.md)

---

## 🐛 Pemecahan Masalah

### Server Tidak Bisa Start
```bash
# Cek apakah port 8000 sudah dipakai
lsof -ti:8000 | xargs kill -9

# Jalankan ulang
python3 main.py
```

### YouTube Bot Detection Error
Jika muncul error `Sign in to confirm you're not a bot`:
1. Login ke YouTube di Chrome/Safari
2. Tonton video yang ingin diproses
3. Restart server

> 📖 Panduan lengkap: [docs/panduan-cookies.md](docs/panduan-cookies.md)

### Video Tidak Ada Output
```bash
# Cek log utama
tail -f autocliper.log

# Cek error per clip
ls tmp/output/*/error_*.txt
```

### Subtitle Tidak Muncul
- Pastikan `caption_style` yang digunakan ada di database
- Subtitle muncul setelah detik ke-3 (setelah hook selesai)
- Cek log Whisper untuk error transkripsi

### Face Tracking Gagal
- Sistem akan otomatis fallback ke center crop
- Pastikan video memiliki wajah yang terlihat jelas

### Gemini 429 Error (Rate Limit)
- Sistem akan otomatis retry dengan delay
- Tunggu beberapa menit jika terkena rate limit
- Pastikan `GEMINI_API_KEY` valid di file `.env`

---

## 📖 Dokumentasi Lengkap

| Dokumen | Deskripsi |
|---------|-----------|
| [📡 Dokumentasi API](docs/api.md) | Semua endpoint, request/response, kode error |
| [🏗️ Arsitektur Sistem](docs/arsitektur.md) | Arsitektur, komponen, pipeline, dan fungsi |
| [📥 Panduan Instalasi](docs/instalasi.md) | Instalasi lengkap, setup database, konfigurasi |
| [🍪 Panduan Cookies](docs/panduan-cookies.md) | Mengatasi YouTube bot detection |
| [📝 Riwayat Perubahan](docs/changelog.md) | Changelog semua versi |

---

## 📊 Metrik Performa

| Metrik | Nilai |
|--------|-------|
| Kecepatan Analisis AI | 10-30 detik (20x lebih cepat dari v1) |
| Waktu Proses (pertama) | 5-15 menit per video |
| Waktu Proses (cache) | 3-10 menit per video |
| Penghematan Biaya API | 90% lebih hemat |
| Penggunaan Memori | 50% lebih rendah |

---

## 🙏 Kredit

- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) — Implementasi C++ untuk transkripsi
- [Google Gemini](https://ai.google.dev/) — Analisis video dengan AI
- [YOLOv8](https://docs.ultralytics.com/) — Deteksi dan tracking objek
- [MediaPipe](https://mediapipe.dev/) — Deteksi wajah & landmark
- [FastAPI](https://fastapi.tiangolo.com/) — Framework web modern
- [MoviePy](https://zulko.github.io/moviepy/) — Editing video

---

## 📝 Lisensi

MIT License — Silakan gunakan dan modifikasi sesuai kebutuhan.

---

**Selamat Membuat Konten! 🎬✨**

---

## 🎬 Remotion Integration (v2.1)

Backend menyediakan Remotion template system untuk rendering video menggunakan Remotion (React-based):

### API Endpoints

```
GET    /api/v1/remotion/caption-templates      # List caption templates
POST   /api/v1/remotion/caption-templates      # Create
GET    /api/v1/remotion/caption-templates/{id}  # Get detail
PUT    /api/v1/remotion/caption-templates/{id}  # Update
DELETE /api/v1/remotion/caption-templates/{id}  # Delete

GET    /api/v1/remotion/hook-templates          # List hook templates
POST   /api/v1/remotion/hook-templates          # Create
GET    /api/v1/remotion/hook-templates/{id}
PUT    /api/v1/remotion/hook-templates/{id}
DELETE /api/v1/remotion/hook-templates/{id}

GET    /api/v1/remotion/compositions            # List compositions (preset combos)
POST   /api/v1/remotion/compositions
GET    /api/v1/remotion/compositions/{id}
PUT    /api/v1/remotion/compositions/{id}
DELETE /api/v1/remotion/compositions/{id}

POST   /api/v1/remotion/render-jobs             # Trigger render
GET    /api/v1/remotion/render-jobs             # List render jobs
GET    /api/v1/remotion/render-jobs/stats       # Render stats
```

### Database Migration

```bash
mysql -u root -p autocliper < database/migrate_remotion_templates.sql
```

Ini membuat tabel:
- `remotion_caption_templates` (15 seed templates)
- `remotion_hook_templates` (13 seed templates)
- `remotion_compositions` (8 preset combinations)
- `remotion_render_jobs` (render job tracking)

### Job Creation (Remotion)

Frontend sekarang mengirim `caption_template_id` dan `hook_template_id` (bukan `caption_style`):

```json
POST /api/v1/jobs/
{
  "urls": "https://youtube.com/watch?v=...",
  "caption_template_id": 1,
  "hook_template_id": 3
}
```
