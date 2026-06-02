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

## Deployment ke Server (Production)

Panduan deploy CliperHub ke server Ubuntu/Debian.

### Prasyarat Server

| Software | Versi | Cara Install |
|----------|-------|--------------|
| Python | 3.9+ | `sudo apt install python3 python3-venv python3-pip` |
| MySQL | 8.0+ | `sudo apt install mysql-server` |
| FFmpeg | 4.0+ | `sudo apt install ffmpeg` |
| Node.js | 18+ | `sudo apt install nodejs npm` |
| Deno | 2.0+ | `curl -fsSL https://deno.land/install.sh \| sh` |
| CMake | 3.10+ | `sudo apt install cmake` |
| Git | 2.0+ | `sudo apt install git` |

### 1. Clone Repository

```bash
cd ~/project
git clone https://github.com/HarisTanone/CliperHub.git
cd CliperHub
```

### 2. Setup Backend

```bash
cd autocliper-v2
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install bcrypt python-jose[cryptography]
```

### 3. Setup Whisper.cpp

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release -j$(nproc)
./models/download-ggml-model.sh medium
cd ..
mkdir -p models
ln -s ../whisper.cpp/models/ggml-medium.bin models/ggml-medium.bin
```

### 4. Install Deno (untuk yt-dlp EJS solver)

```bash
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"
# Tambahkan ke ~/.bashrc agar permanen
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
```

### 5. Setup Database

```bash
mysql -u root -p -e "CREATE DATABASE autocliper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p autocliper < database/init.sql
```

### 6. Konfigurasi Environment

```bash
cp .env.example .env
nano .env
```

Isi konfigurasi:
```env
DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/autocliper
JWT_SECRET_KEY=<generate dengan: python -c "import secrets; print(secrets.token_urlsafe(64))">
JWT_REFRESH_SECRET_KEY=<generate lagi>
GEMINI_API_KEY=your_gemini_api_key
YOUTUBE_API_KEY=your_youtube_api_key
WHISPER_MODEL_PATH=./models/ggml-medium.bin
OUTPUT_DIR=./tmp/output
```

### 7. Upload Cookies YouTube

Export cookies dari Chrome dengan extension "Get cookies.txt LOCALLY", lalu upload:

```bash
scp ~/Downloads/cookies.txt user@server:~/project/CliperHub/autocliper-v2/cookies.txt
```

### 8. Setup Frontend

```bash
cd ~/project/CliperHub/autocliper-v2-FE

# Update API URL ke IP server
sed -i "s|http://localhost:8000|http://YOUR_SERVER_IP:8000|g" src/utils/api.js

npm install
npm run build
```

### 9. Setup Systemd Services (Auto-start)

**Backend Service:**

```bash
sudo tee /etc/systemd/system/cliperhub-backend.service << 'EOF'
[Unit]
Description=CliperHub Backend API
After=network.target mysql.service

[Service]
Type=simple
User=backend
WorkingDirectory=/home/backend/project/CliperHub/autocliper-v2
Environment=PATH=/home/backend/.deno/bin:/home/backend/project/CliperHub/autocliper-v2/venv/bin:/usr/bin
ExecStart=/home/backend/project/CliperHub/autocliper-v2/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

**Frontend Service:**

```bash
sudo tee /etc/systemd/system/cliperhub-frontend.service << 'EOF'
[Unit]
Description=CliperHub Frontend
After=network.target

[Service]
Type=simple
User=backend
WorkingDirectory=/home/backend/project/CliperHub/autocliper-v2-FE
ExecStart=/usr/bin/python3 -m http.server 5173 --directory dist --bind 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

**Enable dan Start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable cliperhub-backend cliperhub-frontend
sudo systemctl start cliperhub-backend cliperhub-frontend
```

### 10. Verifikasi

```bash
sudo systemctl status cliperhub-backend
sudo systemctl status cliperhub-frontend
curl http://localhost:8000/health
```

### Command Berguna

| Aksi | Command |
|------|---------|
| Lihat log backend | `journalctl -u cliperhub-backend -f` |
| Lihat log frontend | `journalctl -u cliperhub-frontend -f` |
| Restart backend | `sudo systemctl restart cliperhub-backend` |
| Restart frontend | `sudo systemctl restart cliperhub-frontend` |
| Stop semua | `sudo systemctl stop cliperhub-backend cliperhub-frontend` |
| Cek status | `sudo systemctl status cliperhub-backend cliperhub-frontend` |

### Akses Aplikasi

- **Frontend:** `http://YOUR_SERVER_IP:5173`
- **Backend API:** `http://YOUR_SERVER_IP:8000`
- **Swagger docs:** `http://YOUR_SERVER_IP:8000/docs`

### Setup Nginx (Opsional - untuk domain/HTTPS)

```bash
sudo apt install nginx

sudo tee /etc/nginx/sites-available/cliperhub << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Swagger docs
    location /docs {
        proxy_pass http://127.0.0.1:8000;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/cliperhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Install Redis (Opsional - untuk persistent queue)

```bash
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Tambahkan ke `.env`:
```env
REDIS_URL=redis://localhost:6379/0
```

---

↩️ [Kembali ke README](../README.md)
