# 📥 Panduan Instalasi — AutoCliper v2

Panduan lengkap untuk menginstal dan menjalankan AutoCliper v2 dari awal.

---

## Daftar Isi

- [Prasyarat](#prasyarat)
- [Langkah Instalasi](#langkah-instalasi)
- [Setup Database](#setup-database)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Menjalankan Server](#menjalankan-server)
- [Verifikasi Instalasi](#verifikasi-instalasi)
- [Setup Cookies YouTube](#setup-cookies-youtube)

---

## Prasyarat

Pastikan sudah terinstal di sistem Anda:

| Software | Versi Minimum | Cara Cek |
|----------|--------------|----------|
| Python | 3.9+ | `python3 --version` |
| MySQL | 5.7+ | `mysql --version` |
| FFmpeg | 4.0+ | `ffmpeg -version` |
| CMake | 3.10+ | `cmake --version` |
| Git | 2.0+ | `git --version` |

### Instalasi Prasyarat (macOS)

```bash
# Menggunakan Homebrew
brew install python@3.11 mysql ffmpeg cmake git
```

---

## Langkah Instalasi

### 1. Clone Repository

```bash
git clone <repository-url>
cd autocliper-v2
```

### 2. Buat Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies Python

```bash
pip install -r requirements.txt
```

**Dependencies utama:**
- `fastapi` + `uvicorn` — Web framework
- `ultralytics` — YOLOv8 untuk tracking
- `mediapipe==0.10.9` — Face detection (pastikan versi ini!)
- `moviepy` — Video editing
- `opencv-python` — Computer vision
- `google-genai` — Gemini AI
- `yt-dlp` — Download YouTube
- `mysql-connector-python` — Database
- `Pillow` — Text rendering
- `numpy` — Komputasi numerik

> ⚠️ **Penting:** MediaPipe harus versi `0.10.9`. Versi lain bisa menyebabkan error.
> ```bash
> pip install mediapipe==0.10.9
> ```

### 4. Setup Whisper.cpp

Whisper.cpp digunakan untuk transkripsi audio (10x lebih cepat dari Python Whisper).

```bash
# Clone Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git

# Compile
cd whisper.cpp
cmake -B build
cmake --build build

# Download model medium
bash ./models/download-ggml-model.sh medium

# Copy model ke folder models
mkdir -p ../models
cp models/ggml-medium.bin ../models/

# Kembali ke root project
cd ..
```

> 💡 **Fallback:** Jika Whisper.cpp gagal dikompilasi, sistem akan otomatis menggunakan Python `openai-whisper` (lebih lambat tapi tetap berfungsi).

### 5. YOLOv8 (Tracking Orang)

YOLOv8 digunakan untuk mendeteksi dan tracking orang di video. **Tidak perlu instalasi manual** — model `yolov8s.pt` akan otomatis didownload saat pertama kali digunakan oleh library `ultralytics` (sudah termasuk di `requirements.txt`).

```bash
# Verifikasi ultralytics terinstal
python3 -c "from ultralytics import YOLO; print('✅ YOLOv8 ready')"
```

**Catatan:**
- Model didownload otomatis (~22MB) ke folder cache `ultralytics`
- Di Apple Silicon (M1/M2/M3), YOLOv8 otomatis menggunakan akselerasi **MPS** (Metal Performance Shaders)
- Jika `ultralytics` tidak terinstal, sistem fallback ke **MediaPipe Face Mesh** (kurang akurat untuk tracking multi-orang)
- Untuk detail teknis: lihat [docs/arsitektur.md — Sistem Tracking & Cropping](arsitektur.md#sistem-tracking--cropping-yolov8)

### 6. Buat Folder yang Diperlukan

```bash
mkdir -p tmp/output
mkdir -p assets/fonts
mkdir -p models
```

---

## Setup Database

### 1. Buat Database

```bash
mysql -u root -p -e "CREATE DATABASE autocliper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Import Skema

```bash
mysql -u root -p autocliper < database/init.sql
```

Ini akan membuat tabel:
- `caption_styles` — Style subtitle
- `hook_styles` — Style hook
- `fonts` — Daftar font
- `request_log` — Log job
- `users` — User management

### 3. Verifikasi

```bash
mysql -u root -p autocliper -e "SHOW TABLES;"
```

---

## Konfigurasi Environment

### 1. Buat File .env

```bash
cp .env.example .env
```

### 2. Edit Konfigurasi

Buka `.env` dan isi:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_anda
DB_NAME=autocliper

# API Keys (WAJIB)
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key

# Whisper
WHISPER_MODEL_PATH=./models/ggml-medium.bin

# Output
OUTPUT_DIR=./tmp/output

# JWT Secret (opsional, default auto-generate)
JWT_SECRET=your_jwt_secret_key
```

### Cara Mendapatkan API Key

#### Gemini API Key
1. Buka [Google AI Studio](https://aistudio.google.com/)
2. Klik "Get API Key"
3. Buat API key baru
4. Copy ke `GEMINI_API_KEY`

#### YouTube Data API Key
1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru (atau pilih yang ada)
3. Aktifkan "YouTube Data API v3"
4. Buat credentials → API Key
5. Copy ke `YOUTUBE_API_KEY`

---

## Menjalankan Server

### Opsi 1: Langsung

```bash
source venv/bin/activate
python3 main.py
```

### Opsi 2: Menggunakan Script

```bash
chmod +x start.sh
./start.sh
```

Script `start.sh` akan otomatis:
- Mengaktifkan virtual environment
- Cek ketersediaan cookies browser
- Kill proses lama di port 8000
- Menjalankan server

Server berjalan di: **http://0.0.0.0:8000**

---

## Verifikasi Instalasi

### 1. Cek Health

```bash
curl http://0.0.0.0:8000/health
```

Response yang diharapkan:
```json
{"status": "healthy", "service": "AutoCliper v2"}
```

### 2. Login

```bash
curl -X POST 'http://0.0.0.0:8000/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "administrator"}'
```

### 3. Test Job (Opsional)

```bash
# Gunakan token dari langkah login
curl -X POST 'http://0.0.0.0:8000/api/v1/jobs/' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "urls": "https://www.youtube.com/watch?v=VIDEO_ID",
    "caption_style": 1
  }'
```

### 4. Monitor Log

```bash
tail -f autocliper.log
```

---

## Setup Cookies YouTube

YouTube memerlukan cookies untuk download video karena bot detection. Lihat panduan lengkap:

📖 [Panduan Cookies YouTube](panduan-cookies.md)

**Cara cepat:**
1. Login ke YouTube di Chrome atau Safari
2. Tonton video yang ingin diproses
3. Restart server — cookies otomatis diambil dari browser

---

## Troubleshooting Instalasi

### MediaPipe Error
```bash
# Pastikan versi 0.10.9
pip install mediapipe==0.10.9
```

### Whisper.cpp Compile Error
```bash
# Pastikan cmake terinstal
brew install cmake

# Compile ulang
cd whisper.cpp
rm -rf build
cmake -B build && cmake --build build
```

### Port 8000 Sudah Dipakai
```bash
lsof -ti:8000 | xargs kill -9
python3 main.py
```

### MySQL Connection Error
- Pastikan MySQL berjalan: `brew services start mysql`
- Cek credentials di `.env`
- Pastikan database sudah dibuat

---

↩️ [Kembali ke README](../README.md)
