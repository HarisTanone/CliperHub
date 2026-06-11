# AutoCliper V2

Pipeline otomatis untuk memotong video YouTube menjadi short-form clips (TikTok / Reels / Shorts) dengan subtitle karaoke yang sinkron sempurna dengan ucapan.

---

## Daftar Isi

1. [Fitur Utama](#1-fitur-utama)
2. [Output Per Clip](#2-output-per-clip)
3. [Arsitektur Pipeline](#3-arsitektur-pipeline)
4. [Subtitle Sync — Cara Kerja](#4-subtitle-sync--cara-kerja)
5. [Ukuran Output yang Didukung](#5-ukuran-output-yang-didukung)
6. [Remotion — Single Source of Truth](#6-remotion--single-source-of-truth)
7. [Struktur Project](#7-struktur-project)
8. [Multiple Video Processing](#8-multiple-video-processing)
9. [Konfigurasi](#9-konfigurasi)
10. [Estimasi Waktu](#10-estimasi-waktu)
11. [Persyaratan Hardware](#11-persyaratan-hardware)
12. [Struktur Folder Output](#12-struktur-folder-output)

---

## 1. Fitur Utama

| Fitur | Keterangan |
|---|---|
| **Subtitle karaoke lip-sync** | Kata aktif highlight tepat saat diucapkan, bukan estimasi |
| **Word-level timestamps** | Whisper medium dijalankan sekali di full video, word timestamps di-cache dan di-slice per clip |
| **Dual output per clip** | Raw cut (belum di-crop) + final video (ready prod) + thumbnail |
| **Dynamic aspect ratio** | 9:16, 16:9, 1:1, 4:5, dan custom — dipilih saat runtime |
| **Remotion sebagai single source of truth** | Komponen Remotion ditulis sekali, dipakai di frontend (via `<Player />`) dan di backend (via `npx remotion render`) — preview di browser identik pixel-perfect dengan video output |
| **Multiple video queue** | Proses banyak URL sekaligus dengan worker pool |
| **YOLO smart sampling** | Frame sampling setiap 3 frame + interpolasi linear, 3× lebih cepat |
| **Parallel clip processing** | Hingga 3 clip diproses bersamaan dengan isolated process workers |
| **AV1 pre-detection** | Hindari re-encode AV1 yang memakan waktu 10–15 menit |
| **Single-pass Gemini** | Full transcript dikirim dalam 1 API call, bukan chunked multi-pass |

---

## 2. Output Per Clip

Setiap clip yang direkomendasikan AI menghasilkan **3 file**:

```
output/
└── job_abc123/
    ├── clip_01/
    │   ├── clip_01_raw.mp4          ← Video mentah: sudah dipotong, BELUM di-crop/overlay
    │   ├── clip_01_final.mp4        ← Video final: crop + subtitle + hook, siap upload
    │   └── clip_01_thumb.jpg        ← Thumbnail: frame terbaik dari clip
    ├── clip_02/
    │   ├── clip_02_raw.mp4
    │   ├── clip_02_final.mp4
    │   └── clip_02_thumb.jpg
    └── ...
```

### Penjelasan Tiap File

**`clip_XX_raw.mp4`**
- Hasil `ffmpeg -ss [start] -to [end] -c copy` dari video original
- Resolusi asli (biasanya 1080p atau 4K), aspect ratio asli
- Tidak ada overlay, tidak ada crop
- Berguna untuk: re-render dengan style berbeda, manual review tracking, atau distribusi ke platform yang punya cropper sendiri

**`clip_XX_final.mp4`**
- Sudah di-crop ke aspect ratio yang dipilih (default 9:16 → 1080×1920)
- YOLO person tracking aktif — wajah pembicara selalu di center frame
- Subtitle karaoke: kata aktif berwarna, kata berikutnya abu-abu, sinkron dengan mulut
- Hook text di 2–4 detik pertama
- Audio dinormalisasi ke -16 LUFS (opsional)
- Siap upload ke TikTok, Reels, YouTube Shorts

**`clip_XX_thumb.jpg`**
- Resolusi: 1280×720 (landscape) atau 720×1280 (portrait)
- Frame dipilih berdasarkan: ekspresi wajah, mulut tertutup (bukan mid-speech), sharpness tinggi
- Embed metadata: judul clip, timestamps, skor viral dari Gemini

---

## 3. Arsitektur Pipeline

```
INPUT: YouTube URL (tunggal atau batch)
        │
        ▼
┌─────────────────────────────────────────────┐
│  STEP 0 — Job Queue                         │
│  • Terima 1 atau banyak URL                 │
│  • Assign job_id per URL                    │
│  • Masukkan ke worker pool                  │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  STEP 1 — Download (yt-dlp)                 │
│  • Pre-check format: pilih H.264 ≥1080p     │
│  • Jika hanya AV1: tampilkan warning        │
│  • Download video + audio, merge via FFmpeg │
│  • Validasi resolusi                        │
│  OUTPUT: original.mp4                       │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  STEP 2 — Whisper Full Transcription        │
│  • Extract audio WAV 16kHz mono             │
│  • Whisper medium: segment + WORD timestamps│
│  • Cache ke full_transcript_words.json      │
│  • TIDAK diulang untuk per-clip             │
│  OUTPUT: full_transcript_words.json         │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  STEP 3 — AI Analysis (Gemini, single-pass) │
│  • Kirim FULL transcript dalam 1 API call   │
│  • Output: Top 10 clips + hook + skor       │
│  OUTPUT: List[ClipData]                     │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  STEP 4 — Per-Clip Processing               │
│  (dijalankan parallel, hingga 3 workers)    │
│                                             │
│  4a. Cut Video → clip_XX_raw.mp4 ✓ SELESAI │
│  4b. Slice Word Timestamps (0.001s, no GPU) │
│  4c. YOLO Tracking (sample_rate=3 + lerp)   │
│  4d. Remotion Render → clip_XX_final.mp4    │
│  4e. Thumbnail Extraction → clip_XX_thumb   │
└─────────────────────────────────────────────┘
        │
        ▼
OUTPUT: clip_XX_raw.mp4 + clip_XX_final.mp4 + clip_XX_thumb.jpg
```

---

## 4. Subtitle Sync — Cara Kerja

### Masalah yang Diselesaikan

Subtitle "karaoke" (kata aktif highlight) harus sinkron dengan gerakan mulut pembicara. Ada dua sumber ketidak-sinkronan yang perlu diatasi:

1. **Timestamp drift** — Whisper yang dijalankan pada audio pendek lebih akurat dari yang dijalankan pada audio panjang, karena model mendapat konteks yang lebih fokus. Solusinya: word timestamps dari full transcript disimpan dengan offset absolut, lalu di-slice per clip dengan koreksi offset.

2. **Display lag** — Subtitle muncul terlambat karena pipeline render tidak memperhitungkan frame buffer delay. Solusinya: semua timestamps di-shift maju sebesar `SUBTITLE_LEAD_MS` (default: 80ms) sehingga kata muncul tepat saat mulut mulai membentuk kata tersebut.

### Alur Word Timestamp

```
Step 2 — Full video Whisper dengan word timestamps:
{
  "words": [
    {"word": "Hari",    "start": 12.00, "end": 12.42},
    {"word": "ini",     "start": 12.42, "end": 12.61},
    {"word": "saya",    "start": 12.61, "end": 12.90},
    {"word": "mau",     "start": 12.90, "end": 13.10},
    ...
  ]
}

Step 4b — Slice untuk clip yang dimulai di t=12.00, durasi 60s:
clip_words = [w for w in all_words if 12.00 <= w.start < 72.00]

Koreksi offset absolut → relatif:
{"word": "Hari", "start": 0.00, "end": 0.42}
{"word": "ini",  "start": 0.42, "end": 0.61}
...

Terapkan SUBTITLE_LEAD_MS = 80ms:
{"word": "Hari", "start": -0.08, "end": 0.34}  ← muncul 80ms lebih awal
{"word": "ini",  "start":  0.34, "end": 0.53}
```

### Rendering Subtitle via Remotion

Di Remotion, setiap frame yang di-render mendapat `currentFrame` dan `fps`. Subtitle highlight dihitung sebagai:

```typescript
// Di Remotion component
const currentTimeMs = (currentFrame / fps) * 1000;

const activeWordIndex = words.findIndex(
  w => currentTimeMs >= w.start * 1000 && currentTimeMs < w.end * 1000
);

// Render: kata aktif = warna utama, kata lain = abu-abu
words.map((word, i) => (
  <span style={{ color: i === activeWordIndex ? PRIMARY_COLOR : INACTIVE_COLOR }}>
    {word.text}
  </span>
))
```

Karena Remotion me-render setiap frame secara deterministik (berbeda dari PIL loop yang berjalan real-time), hasilnya konsisten dan tidak ada frame drop.

### Parameter Subtitle yang Bisa Dikonfigurasi

```env
SUBTITLE_LEAD_MS=80            # Maju-kan subtitle N ms (kompensasi display lag)
SUBTITLE_FONT=Anton             # Font nama
SUBTITLE_SIZE=72                # Ukuran font (px, untuk 1080×1920)
SUBTITLE_COLOR=#FFFFFF          # Warna kata aktif
SUBTITLE_INACTIVE_COLOR=#888888 # Warna kata tidak aktif
SUBTITLE_SHADOW_BLUR=8          # Blur shadow (px)
SUBTITLE_MAX_WORDS=4            # Maks kata per baris subtitle
SUBTITLE_POSITION=bottom        # top / center / bottom
```

---

## 5. Ukuran Output yang Didukung

Aspect ratio dipilih per-job atau per-clip saat runtime via parameter `--aspect` atau di `config.env`.

| Nama | Rasio | Resolusi | Platform Utama |
|---|---|---|---|
| `portrait` | 9:16 | 1080 × 1920 | TikTok, Reels, Shorts (default) |
| `landscape` | 16:9 | 1920 × 1080 | YouTube, Twitter/X |
| `square` | 1:1 | 1080 × 1080 | Instagram feed, LinkedIn |
| `portrait_4_5` | 4:5 | 1080 × 1350 | Instagram feed portrait |
| `ultrawide` | 21:9 | 2560 × 1080 | Sinematik / LinkedIn cover |
| `custom` | bebas | lihat config | Tentukan sendiri via `CUSTOM_W` × `CUSTOM_H` |

### Cara Memilih Ukuran

**Via command line (per-job):**
```bash
python autocliper.py --url "https://youtube.com/..." --aspect portrait
python autocliper.py --url "https://youtube.com/..." --aspect landscape
python autocliper.py --url "https://youtube.com/..." --aspect custom --width 1080 --height 1440
```

**Via config.env (default global):**
```env
OUTPUT_ASPECT=portrait
# Atau untuk custom:
OUTPUT_ASPECT=custom
CUSTOM_W=1080
CUSTOM_H=1440
```

**Via batch file (per-URL berbeda aspect ratio):**
```json
[
  {"url": "https://youtube.com/watch?v=AAA", "aspect": "portrait"},
  {"url": "https://youtube.com/watch?v=BBB", "aspect": "landscape"},
  {"url": "https://youtube.com/watch?v=CCC", "aspect": "square"}
]
```

### Perilaku Crop per Aspect Ratio

Untuk semua aspect ratio, YOLO tracking tetap aktif dan memastikan wajah pembicara selalu berada di tengah crop area. Untuk konten dengan dua pembicara (detected ≥3 detik), layout otomatis beralih ke split-screen yang disesuaikan dengan aspect ratio yang dipilih.

---

## 6. Remotion — Single Source of Truth

### Prinsip Utama

AutoCliper menggunakan **Opsi C**: Remotion sebagai satu-satunya sumber kebenaran untuk semua visual dalam video. Komponen React/Remotion ditulis **sekali**, lalu dipakai di dua tempat:

```
packages/remotion-compositions/
        │
        ├── Frontend (web app)
        │   └── import { ClipComposition } from '@autocliper/remotion-compositions'
        │       <Player component={ClipComposition} inputProps={clipData} />
        │       → Preview di browser IDENTIK dengan video output
        │
        └── Backend (render server)
            └── npx remotion render ClipComposition --props clipData.json
                → Output: clip_XX_final.mp4
                → Engine sama = hasil dijamin identik
```

Framer Motion **tetap dipakai** untuk UI web (animasi tombol, transisi halaman, panel sidebar). Hanya konten **di dalam video** yang dikontrol oleh Remotion.

### Mengapa Bukan PIL Loop?

Pipeline sebelumnya menggunakan PIL (Python Imaging Library) untuk me-render subtitle langsung ke setiap frame, menghasilkan lebih dari **1 juta `draw.text()` per clip**. Tidak ada caching, tidak ada preview, sulit di-debug.

| Aspek | PIL Loop (lama) | Remotion (baru) |
|---|---|---|
| Teknologi | Python PIL + cv2 | React + Chromium + FFmpeg |
| Preview sebelum render | Tidak ada | Live di browser via `<Player />` |
| Konsistensi frontend↔output | Tidak ada jaminan | Pixel-perfect (engine sama) |
| Custom font & animasi | Terbatas | Semua CSS, web font, keyframes |
| Subtitle caching | Manual dict | Native React reconciliation |
| Debug | Render dulu baru lihat | Scrub timeline di browser |
| Render speed per clip | 30–90s | 10–25s |
| Parallelisasi | ProcessPool manual | `--concurrency` flag bawaan |

### Cara Kerja `<Player />` di Frontend

`@remotion/player` adalah React component resmi yang embed Remotion composition langsung di web app, tanpa iframe eksternal.

```tsx
// frontend/src/components/ClipPreview.tsx
import { Player } from '@remotion/player';
import { ClipComposition } from '@autocliper/remotion-compositions';

export function ClipPreview({ clipData }: { clipData: ClipData }) {
  return (
    <Player
      component={ClipComposition}
      inputProps={clipData}          // data yang sama dengan yang dikirim ke backend
      durationInFrames={clipData.durationFrames}
      fps={30}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{
        width: 270,                  // preview skala 1/4 untuk sidebar
        height: 480,
        borderRadius: 12,
      }}
      controls                       // tampilkan play/pause/scrubber
      loop
    />
  );
}
```

User bisa scrub timeline, play preview, dan melihat subtitle karaoke bergerak **persis seperti yang akan muncul di video output** — sebelum render dimulai.

### Alur Data: Frontend → Backend

Data `ClipData` yang sama dipakai di frontend (preview) dan backend (render):

```typescript
// packages/remotion-compositions/src/types.ts
// Dipakai di frontend (Player) DAN backend (render CLI)

export interface ClipData {
  videoSrc: string;              // URL atau path ke clip_XX_raw.mp4
  durationFrames: number;        // total frame clip
  fps: number;                   // default 30
  words: WordTimestamp[];        // dari Whisper word-level cache
  trackingData: TrackingFrame[]; // YOLO crop coordinates per frame
  hookText: string;              // dari Gemini analysis
  aspect: AspectRatio;           // portrait | landscape | square | ...
  style: StyleConfig;            // warna, font, ukuran subtitle
}
```

```
Frontend                          Backend
────────                          ───────
User submit URL
    │
    ▼
POST /api/jobs { url, aspect }
    │                              Job dibuat, antrian diisi
    │◄─── { job_id, status }
    │
    ▼
Polling GET /api/jobs/:id
    │◄─── { status: "clips_ready", clips: [ClipData, ...] }
    │
    ▼
<Player inputProps={clips[0]} />  npx remotion render --props clips[0]
Preview tampil langsung            Output: clip_01_final.mp4
(engine sama, hasil identik)
```

### Setup

```bash
# 1. Install semua dependensi dari root monorepo
npm install

# 2. Preview komposisi di browser (opsional, untuk development)
npm run remotion:preview
# → buka http://localhost:3000, scrub timeline, lihat semua komposisi

# 3. Backend render dipanggil otomatis oleh Python pipeline
#    Tidak perlu server terpisah — cukup subprocess call ke npx remotion render
```

### Struktur Komponen Remotion

```
packages/remotion-compositions/
├── src/
│   ├── index.tsx                  ← Export semua komposisi + types
│   ├── compositions/
│   │   └── ClipComposition.tsx    ← Komposisi utama, menerima ClipData sebagai props
│   ├── components/
│   │   ├── CroppedVideo.tsx       ← Video base + crop transform dari tracking data
│   │   ├── SubtitleKaraoke.tsx    ← Subtitle dengan word-level highlight
│   │   ├── HookText.tsx           ← Animasi hook text di detik 0–4
│   │   └── AspectFrame.tsx        ← Wrapper untuk dynamic aspect ratio
│   ├── hooks/
│   │   └── useActiveWord.ts       ← Logic highlight kata aktif berdasarkan currentFrame
│   └── types.ts                   ← ClipData, WordTimestamp, TrackingFrame, StyleConfig
├── public/
│   └── fonts/                     ← Font lokal (Anton.ttf, dll.)
└── package.json
```

---

## 7. Struktur Project

AutoCliper menggunakan struktur **monorepo** agar `packages/remotion-compositions` bisa dipakai langsung oleh frontend dan backend tanpa duplikasi kode.

```
autocliper/
├── packages/
│   └── remotion-compositions/     ← Shared package: komponen Remotion
│       ├── src/
│       │   ├── index.tsx          ← Export utama
│       │   ├── compositions/
│       │   │   └── ClipComposition.tsx
│       │   ├── components/
│       │   │   ├── CroppedVideo.tsx
│       │   │   ├── SubtitleKaraoke.tsx
│       │   │   ├── HookText.tsx
│       │   │   └── AspectFrame.tsx
│       │   ├── hooks/
│       │   │   └── useActiveWord.ts
│       │   └── types.ts           ← ClipData, WordTimestamp, dll.
│       ├── public/fonts/
│       └── package.json           ← name: "@autocliper/remotion-compositions"
│
├── apps/
│   ├── web/                       ← Frontend Next.js
│   │   ├── src/
│   │   │   ├── app/               ← Next.js App Router pages
│   │   │   ├── components/
│   │   │   │   ├── ClipPreview.tsx    ← Pakai <Player /> dari remotion-compositions
│   │   │   │   ├── JobDashboard.tsx   ← Daftar job + progress
│   │   │   │   └── BatchUploader.tsx  ← Input URL, pilih aspect ratio
│   │   │   └── lib/
│   │   │       └── api.ts         ← Fetch ke backend API
│   │   └── package.json           ← depends on @autocliper/remotion-compositions
│   │
│   └── api/                       ← Backend Python (FastAPI)
│       ├── main.py                ← REST API: POST /jobs, GET /jobs/:id
│       ├── pipeline/
│       │   ├── download.py        ← yt-dlp wrapper
│       │   ├── transcribe.py      ← Whisper word-level
│       │   ├── analyze.py         ← Gemini single-pass
│       │   ├── track.py           ← YOLO smart sampling
│       │   └── render.py          ← Subprocess call ke npx remotion render
│       ├── workers/
│       │   ├── video_worker.py    ← Per-video job orchestrator
│       │   └── clip_worker.py     ← Per-clip parallel processor
│       └── requirements.txt
│
├── output/                        ← Hasil render (gitignored)
├── package.json                   ← Monorepo root (npm workspaces)
└── turbo.json                     ← Turborepo build pipeline (opsional)
```

### Cara Monorepo Menghubungkan Frontend dan Backend

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "@autocliper/remotion-compositions": "*"  // resolve ke packages/remotion-compositions
  }
}
```

```typescript
// apps/web/src/components/ClipPreview.tsx
import { Player } from '@remotion/player';
import { ClipComposition } from '@autocliper/remotion-compositions';
// Komponen yang SAMA persis dengan yang dipakai backend untuk render
```

```python
# apps/api/pipeline/render.py
import subprocess, json

def render_clip(clip_data: dict, output_path: str):
    subprocess.run([
        "npx", "remotion", "render",
        "ClipComposition",                      # nama komposisi dari packages/remotion-compositions
        "--props", json.dumps(clip_data),
        "--output", output_path,
        "--concurrency", "4",
    ], cwd="../../packages/remotion-compositions", check=True)
```

### Setup Monorepo

```bash
# Clone dan install semua dependensi sekaligus
git clone https://github.com/your-org/autocliper.git
cd autocliper
npm install                        # install semua packages + apps sekaligus

# Setup Python backend
cd apps/api
pip install -r requirements.txt

# Jalankan frontend dev server
cd apps/web
npm run dev                        # → http://localhost:3000

# Preview Remotion compositions (opsional)
cd packages/remotion-compositions
npm run preview                    # → http://localhost:3001

# Jalankan backend API
cd apps/api
uvicorn main:app --reload          # → http://localhost:8000
```

---

## 8. Multiple Video Processing

### Mode Batch

Proses banyak URL sekaligus dari file JSON atau argumen langsung:

```bash
# Dari argumen langsung (multiple URL)
python autocliper.py \
  --url "https://youtube.com/watch?v=AAA" \
  --url "https://youtube.com/watch?v=BBB" \
  --url "https://youtube.com/watch?v=CCC"

# Dari file batch JSON
python autocliper.py --batch urls.json

# Format urls.json:
[
  {
    "url": "https://youtube.com/watch?v=AAA",
    "aspect": "portrait",
    "num_clips": 10
  },
  {
    "url": "https://youtube.com/watch?v=BBB",
    "aspect": "landscape",
    "num_clips": 5
  }
]
```

### Arsitektur Worker Pool

```
Job Queue
  [URL_1, URL_2, URL_3, URL_4, URL_5]
       │
       ▼
  ┌─────────────────────────────────┐
  │  Video Worker Pool              │
  │  (default: 2 video concurrent)  │
  │                                 │
  │  Video Worker 1: URL_1          │
  │    └─ Clip Worker Pool          │
  │       ├─ Clip 1, 2, 3 parallel  │
  │                                 │
  │  Video Worker 2: URL_2          │
  │    └─ Clip Worker Pool          │
  │       ├─ Clip 1, 2, 3 parallel  │
  └─────────────────────────────────┘
       │
  Video Worker 1 selesai → ambil URL_3
  Video Worker 2 selesai → ambil URL_4
  ...
```

### Konfigurasi Concurrency

```env
# Berapa video yang diproses bersamaan
VIDEO_WORKERS=2

# Berapa clip per video yang diproses bersamaan
CLIP_WORKERS=3

# Berapa Gemini call yang berjalan bersamaan (jangan > 3)
GEMINI_CONCURRENT=3
```

**Panduan memilih nilai:**

| RAM Tersedia | VIDEO_WORKERS | CLIP_WORKERS | Estimasi RAM Peak |
|---|---|---|---|
| 8 GB | 1 | 2 | ~5 GB |
| 16 GB | 2 | 3 | ~11 GB |
| 32 GB | 3 | 4 | ~20 GB |

### Progress Monitoring

```bash
# Output saat batch berjalan:
[12:01] Job q7k2m | URL_1 | Download... ████████░░ 80%
[12:01] Job p3n8x | URL_2 | Whisper...  ██████░░░░ 60%
[12:02] Job q7k2m | URL_1 | Gemini...   ██████████ done
[12:02] Job q7k2m | URL_1 | Clip 1/10 YOLO ███░░░ 30%
[12:02] Job q7k2m | URL_1 | Clip 2/10 YOLO ██░░░░ 20%
[12:03] Job q7k2m | URL_1 | Clip 1/10 ✓ → output/q7k2m/clip_01/
```

---

## 9. Konfigurasi

Salin `config.env.example` ke `config.env` dan sesuaikan:

```env
# ─── API Keys ───────────────────────────────────────────
GEMINI_API_KEY=your_key_here

# ─── Download ────────────────────────────────────────────
COOKIES_FILE=cookies.txt           # Path ke file cookies YouTube
PREFER_H264=true                   # Hindari AV1, pilih H.264 duluan
MAX_RESOLUTION=1080                # Resolusi maks yang di-download (px)

# ─── Output ──────────────────────────────────────────────
OUTPUT_DIR=./output
OUTPUT_ASPECT=portrait             # portrait | landscape | square | portrait_4_5 | custom
CUSTOM_W=1080                      # Hanya jika OUTPUT_ASPECT=custom
CUSTOM_H=1440

# ─── Clip Selection ──────────────────────────────────────
NUM_CLIPS=10                       # Berapa clip yang dihasilkan per video
MIN_CLIP_DURATION=30               # Durasi minimum clip (detik)
MAX_CLIP_DURATION=90               # Durasi maksimum clip (detik)

# ─── Subtitle ────────────────────────────────────────────
SUBTITLE_LEAD_MS=80                # Kompensasi lip-sync (ms)
SUBTITLE_FONT=Anton
SUBTITLE_SIZE=72
SUBTITLE_COLOR=#FFFFFF
SUBTITLE_INACTIVE_COLOR=#888888
SUBTITLE_MAX_WORDS=4
SUBTITLE_POSITION=bottom           # top | center | bottom

# ─── YOLO Tracking ───────────────────────────────────────
YOLO_SAMPLE_RATE=3                 # Proses 1 dari N frame, interpolasi sisanya
YOLO_MODEL=yolov8s.pt

# ─── Whisper ─────────────────────────────────────────────
WHISPER_MODEL=medium               # tiny | base | small | medium | large
WHISPER_LANGUAGE=id                # Kode bahasa (id = Indonesia, en = English)

# ─── Concurrency ─────────────────────────────────────────
VIDEO_WORKERS=2                    # Video bersamaan
CLIP_WORKERS=3                     # Clip bersamaan per video
GEMINI_CONCURRENT=3                # Gemini call bersamaan

# ─── Audio ───────────────────────────────────────────────
ENABLE_AUDIO_NORMALIZATION=false   # true = aktifkan, false = skip (lebih cepat)
AUDIO_TARGET_LUFS=-16

# ─── Thumbnail ───────────────────────────────────────────
ENABLE_THUMBNAIL=true
THUMBNAIL_FORMAT=jpg               # jpg | png
THUMBNAIL_QUALITY=90               # 1–100 (hanya untuk jpg)
```

---

## 10. Estimasi Waktu

Untuk video 20 menit, menghasilkan 10 clips (hardware: Apple Silicon M1/M2 dengan MPS):

| Komponen | Sebelum Optimasi | Setelah Optimasi |
|---|---|---|
| Download | ~60s | ~60s |
| Whisper (dengan word timestamps) | ~90s | ~110s |
| Gemini (single-pass) | ~45s | ~15s |
| Cut + Slice timestamps ×10 | ~30s | ~30s |
| Whisper per-clip ×10 | ~300s | **~0s** (dihapus) |
| YOLO Tracking ×10 | ~600s | **~200s** (3× lebih cepat) |
| Remotion Render ×10 | ~400s | **~150s** |
| Audio Normalization ×10 | ~75s | **~0s** (off by default) |
| Thumbnail Extraction ×10 | 0 | ~10s |
| **Total (serial)** | **~1.600s (~27 menit)** | **~575s (~10 menit)** |
| **Total (3 clip workers)** | — | **~250s (~4 menit)** |

> Waktu di CPU-only bisa 2–3× lebih lambat dari angka di atas.

---

## 11. Persyaratan Hardware

### Minimum

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| RAM | 8 GB | 16 GB |
| Storage | 20 GB free (SSD) | 50 GB+ SSD |
| CPU | 4 cores | 8+ cores |
| GPU | — | Apple Silicon MPS / NVIDIA CUDA |
| OS | macOS 12+ / Ubuntu 20.04+ | macOS 14+ / Ubuntu 22.04+ |

### Dependensi Software

```bash
# Python
pip install -r requirements.txt
# Termasuk: openai-whisper, ultralytics, mediapipe, yt-dlp, google-generativeai, fastapi, uvicorn

# Node.js (untuk Remotion + frontend)
node >= 18.0.0
npm >= 9.0.0
# Packages utama: remotion, @remotion/player, @remotion/renderer, next, react

# System
ffmpeg >= 6.0
```

---

## 12. Struktur Folder Output

```
output/
└── {job_id}/                      ← ID unik per video yang diproses
    ├── job_info.json              ← Metadata: URL, durasi, timestamps proses
    ├── original.mp4               ← Video asli yang di-download (dihapus setelah selesai jika KEEP_ORIGINAL=false)
    ├── full_transcript_words.json ← Cache word timestamps Whisper (dipertahankan)
    ├── gemini_analysis.json       ← Hasil analisis Gemini: clip recommendations + scores
    │
    ├── clip_01/
    │   ├── clip_01_raw.mp4        ← Potongan mentah, resolusi original, tanpa overlay
    │   ├── clip_01_final.mp4      ← Final: crop + subtitle karaoke + hook, siap upload
    │   └── clip_01_thumb.jpg      ← Thumbnail: frame terbaik dari clip
    │
    ├── clip_02/
    │   ├── clip_02_raw.mp4
    │   ├── clip_02_final.mp4
    │   └── clip_02_thumb.jpg
    │
    └── ... (hingga clip_10)
```

### File `job_info.json`

```json
{
  "job_id": "q7k2m",
  "url": "https://youtube.com/watch?v=...",
  "title": "Judul Video YouTube",
  "duration_seconds": 1234,
  "output_aspect": "portrait",
  "output_resolution": "1080x1920",
  "whisper_model": "medium",
  "clips_generated": 10,
  "processing_time_seconds": 247,
  "created_at": "2025-06-11T12:01:00Z",
  "clips": [
    {
      "id": "clip_01",
      "start": 123.4,
      "end": 183.4,
      "hook": "Ini yang bikin bisnis gue bangkrut",
      "viral_score": 87,
      "emotion_score": 92,
      "curiosity_score": 85
    }
  ]
}
```

---

## Catatan

- **Cookies YouTube** harus diperbarui setiap 7–14 hari. Tanda expired: error `HTTP Error 403` atau `Sign in to confirm you're not a bot`.
- **Remotion sebagai single source of truth** — komponen ditulis sekali di `packages/remotion-compositions`, dipakai frontend via `<Player />` dan backend via `npx remotion render`. Preview di browser dijamin identik dengan video output karena engine-nya sama. Chromium diunduh otomatis saat pertama kali (~150 MB).
- **Framer Motion** tetap dipakai untuk animasi UI web (tombol, transisi halaman, modal) — bukan untuk konten di dalam video.
- **YOLO interpolasi** menggunakan linear interpolation (lerp) antar frame yang di-detect. Posisi wajah akan sedikit lebih halus dari mode detect-setiap-frame karena noise per-frame ter-smooth.
- **Word timestamps** dari full transcript memiliki akurasi sedikit lebih rendah dari Whisper yang dijalankan per-clip pendek (drift ~50ms), namun masih dalam threshold karaoke yang dapat diterima (100–200ms).

---

*Dibuat berdasarkan AutoCliper V2 Optimization Guide. Estimasi waktu berdasarkan Apple Silicon M1/M2 dengan MPS acceleration.*