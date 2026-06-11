# AutoCliper V2 — Deep Performance Breakdown

Dokumen ini menjelaskan secara mendalam **setiap tahap proses** yang membuat pipeline AutoCliper lambat, termasuk input, proses internal, output, dan estimasi waktu per tahap.

---

## 🔄 Pipeline Overview (Urutan Eksekusi)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. DOWNLOAD (yt-dlp)                    ~30-120s                       │
│  2. WHISPER FULL TRANSCRIPTION           ~60-300s (cached)              │
│  3. AI ANALYSIS (Chunked Multi-Pass)     ~30-180s                       │
│  4. PER-CLIP PROCESSING (×10 clips):                                    │
│     4a. Cut Video (FFmpeg)               ~2s                            │
│     4b. Extract Audio                    ~3s                            │
│     4c. Whisper Per-Clip Subtitles       ~20-60s                        │
│     4d. YOLO Tracking                    ~30-120s  ← BOTTLENECK UTAMA  │
│     4e. Base Crop Render                 ~15-40s                        │
│     4f. Final Render (Crop+Overlay)      ~30-90s   ← BOTTLENECK UTAMA  │
│     4g. Audio Normalization              ~5-10s                         │
│  5. CLEANUP                              ~1s                            │
└─────────────────────────────────────────────────────────────────────────┘

TOTAL ESTIMASI (video 20 menit, 10 clips):
  - Best case:  ~15 menit
  - Average:    ~25-35 menit
  - Worst case: ~60+ menit
```

---

## 📥 STEP 1: YouTube Download (yt-dlp)

### Input
- YouTube URL

### Proses Internal
1. **Format Probe** — Enumerate semua format tersedia dari YouTube
2. **Quality Validation** — Cari format ≥1080p, filter HLS/SABR unreliable
3. **Download** — Download video+audio streams terpisah
4. **Merge** — FFmpeg merge video+audio ke MP4
5. **Codec Check** — Jika AV1, re-encode ke H.264 (tambah ~5-15 menit!)
6. **ffprobe Validation** — Verifikasi resolusi final

### Output
- `original.mp4` di folder output (1080p+ H.264)

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi Waktu |
|--------|-----------|----------------|
| Bandwidth | Download 500MB-2GB file | 30-120s |
| AV1 → H.264 re-encode | FFmpeg transcode seluruh video | +300-900s |
| YouTube throttling | Rate limit per session | +10-30s |
| Cookie/auth negotiation | Coba berbagai auth strategy | +5-15s |

### Catatan
- Jika video sudah pernah didownload, **cache HIT** — skip step ini sepenuhnya
- AV1 re-encode adalah penalty terbesar (bisa 10-15 menit untuk video 30 menit)

---

## 🎤 STEP 2: Whisper C++ Full Transcription

### Input
- `original.mp4` → extract audio ke `full_audio.wav` (16kHz, mono, PCM)

### Proses Internal
1. **Audio Extraction** — FFmpeg extract audio dari full video
2. **Whisper Inference** — Model `ggml-medium.bin` (~1.5GB) melakukan:
   - Mel spectrogram computation (80 mel bins, 16kHz)
   - Encoder: 24 transformer layers, ~768M parameters
   - Decoder: autoregressive token generation per segment
   - Language detection (auto)
   - Timestamp alignment per segment

### Parameter Runtime
```
Threads:     8 (atau max CPU cores)
Processors:  2 (parallel beam search)
Model:       ggml-medium (769M params, 1.5GB RAM)
Timeout:     3600s (1 jam)
```

### Output
```json
{"data": [["0.0", "3.2", "teks segment..."], ["3.2", "6.8", "teks..."], ...]}
```
- Disimpan sebagai `full_transcript.json` (CACHED — tidak diulang)

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi Waktu |
|--------|-----------|----------------|
| Model size | Medium = 769M params, setiap token harus melalui 24 layers | Dominan |
| CPU-bound | Tidak ada GPU acceleration (ggml CPU only di Mac) | ~0.3-0.5× realtime |
| Sequential decoding | Autoregressive — token N bergantung token N-1 | Tidak bisa diparallelkan |
| Full video length | Video 20 menit = 20 menit audio diproses | Linear scaling |

### Estimasi Waktu
- Video 10 menit → ~30-60s (dengan 8 threads)
- Video 20 menit → ~60-120s
- Video 60 menit → ~180-300s

### Mitigasi yang Sudah Ada
- **Caching**: Hasil disimpan ke `full_transcript.json`, tidak diulang jika sudah ada
- **Multi-thread**: 8 threads + 2 processors

---

## 🧠 STEP 3: AI Analysis (Chunked Multi-Pass)

### Input
- Whisper transcript JSON
- YouTube metadata (title, duration, views, channel)

### Proses Internal

#### Mode: STANDARD (Gemini saja)
```
Transcript (full)
    ↓
STEP 4a: Chunk Builder (4000 words/chunk, 200 word overlap)
    ↓
STEP 4b: Pass #1 — Candidate Detection (3 chunks concurrent via Gemini)
    ↓
STEP 4c: Aggregator (sort, dedup, remove overlap → Top 40)
    ↓
STEP 4d: Pass #2 — Final Ranking (1 Gemini call → Top 10 clips)
    ↓
Output: List[ClipData] (10 clips with hooks, keywords, multi-scores)
```

#### Mode: HYBRID (Mistral-Nemo lokal + Gemini)
```
Transcript (full)
    ↓
STEP 4a: Chunk Builder (800 words/chunk, 80 word overlap) ← lebih kecil!
    ↓
STEP 4b: Pass #1 — Mistral-Nemo SEQUENTIAL (1 chunk at a time, ~2 min/chunk)
    ↓
STEP 4c: Aggregator → Top 40
    ↓
STEP 4d: Pass #2 — Gemini Final Ranking
    ↓
Output: List[ClipData]
```

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi Waktu |
|--------|-----------|----------------|
| **HYBRID Pass #1** | Mistral-Nemo 12B lokal, sequential, ~2 min/chunk | chunks × 2 menit |
| Gemini API latency | Setiap call = 3-10s round-trip | chunks × 3-10s |
| Rate limiting | Gemini 429 retry + backoff | +5-30s |
| JSON parsing | Regex extraction + validation per response | <1s |
| Chunk count | Video 20min = ~5-8 chunks (standard), ~25-30 chunks (hybrid) | Linear |

### Estimasi Waktu
| Mode | Video 20 min | Video 60 min |
|------|-------------|-------------|
| Standard (Gemini) | ~30-60s | ~60-120s |
| Hybrid (Mistral-Nemo) | ~10-20 min | ~30-60 min |

### Catatan Kritis
- Mode HYBRID sangat lambat karena Mistral-Nemo 12B di CPU lokal butuh ~120s per chunk
- Standard mode relatif cepat (3 concurrent Gemini calls)

---

## ✂️ STEP 4a: Cut Video (per clip)

### Input
- `original.mp4` + start_time + end_time

### Proses
- FFmpeg `stream copy` — TIDAK re-encode, hanya potong stream

### Output
- `clip_X_raw.mp4` (45-90 detik)

### Waktu: ~1-2s (sangat cepat, no re-encode)

---

## 🔊 STEP 4b: Extract Audio (per clip)

### Input
- `clip_X_raw.mp4`

### Proses
- MoviePy extract audio → WAV 16kHz mono PCM

### Output
- `audio_X.wav`

### Waktu: ~2-5s

---

## 📝 STEP 4c: Whisper Per-Clip Subtitles

### Input
- `audio_X.wav` (45-90 detik audio)

### Proses Internal (sama seperti Step 2 tapi per clip)
1. Mel spectrogram dari 45-90s audio
2. Whisper medium inference:
   - Encoder forward pass (24 transformer layers)
   - Decoder token-by-token generation
   - **Word-level timestamps** (token timing alignment)
   - BPE token merging ke words
3. Token filtering (buang `[_TT_]`, `[_BEG_]`, timestamps)
4. Output: segments + words dengan timing presisi

### Output
```json
[
  {
    "start": 0.0, "end": 3.2,
    "text": "kalimat lengkap",
    "words": [
      {"word": "kalimat", "start": 0.0, "end": 1.2},
      {"word": "lengkap", "start": 1.2, "end": 3.2}
    ]
  }
]
```

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi Waktu |
|--------|-----------|----------------|
| Medium model | 769M params per token | ~15-45s per clip |
| Word timestamps | Extra computation untuk word alignment | +20% |
| Sequential per clip | 10 clips = 10× inference | 10 × 15-45s |

### Estimasi: 15-45s per clip, total 150-450s untuk 10 clips

### Catatan
- **TIDAK di-cache** per clip (hanya full transcript yang di-cache)
- Ini duplikasi work — clip audio sudah ada di full transcript, tapi Whisper dijalankan ulang untuk word-level precision

---

## 👤 STEP 4d: YOLO Person Tracking (BOTTLENECK #1)

### Input
- `clip_X_raw.mp4` (45-90s, 30fps = 1350-2700 frames)

### Proses Internal (per frame)

```
Untuk SETIAP FRAME (1350-2700 frames per clip):

1. YOLOv8s Detection (per frame)
   Input:  Frame 1080×1920 RGB
   Proses: - Resize ke 640×640
           - Neural network forward pass (11M params)
           - NMS (Non-Maximum Suppression)
           - Filter: class=0 (person), conf>0.40
   Output: List[bbox] + confidence scores
   Waktu:  ~15-30ms per frame (MPS/CPU)

2. ByteTrack (per frame)
   Input:  Detections + previous tracks
   Proses: - IoU matching (Hungarian algorithm)
           - Track state: confirmed/tentative/lost
           - ID assignment (persistent across frames)
   Output: List[{track_id, bbox}]
   Waktu:  ~1-2ms per frame

3. OpenCV DNN Face Detection (per frame, per person)
   Input:  Cropped person region (upper 65%)
   Proses: - Resize crop ke 300×300
           - SSD MobileNet forward pass
           - Filter conf > 0.35
   Output: face_box (x, y, w, h)
   Waktu:  ~5-10ms per person per frame

4. MediaPipe Face Mesh — Mouth Landmark (per frame, per face)
   Input:  Cropped face region + padding
   Proses: - Face mesh 478 landmarks
           - Extract landmark #13 (upper lip) dan #14 (lower lip)
           - Calculate mouth_open = gap / face_height × 100
   Output: mouth_open value (0-100)
   Waktu:  ~8-15ms per face per frame

5. Kalman Filter Smoothing (per frame, per track)
   Input:  Raw face_center (x, y)
   Proses: - Predict step (state transition matrix)
           - Update step (measurement incorporation)
           - State: [x, y, vx, vy]
   Output: Smoothed face_center
   Waktu:  <0.1ms per track

6. Speaker Detection (per frame)
   Input:  mouth_open history (60 frames window)
   Proses: - Calculate variance per track
           - Compare with current speaker
           - Switch jika kandidat > 2× variance speaker aktif
           - Lock 150 frames (~5s) setelah switch
   Output: speaker_id
   Waktu:  <0.1ms
```

### Total per Frame
```
YOLO inference:         ~15-30ms
ByteTrack matching:     ~1-2ms
Face detection (×2):    ~10-20ms
Mouth landmark (×2):    ~16-30ms
Kalman + Speaker:       ~0.2ms
─────────────────────────────────
TOTAL PER FRAME:        ~42-82ms

Clip 60s @ 30fps = 1800 frames × 62ms avg = ~112 detik
```

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi |
|--------|-----------|---------|
| **YOLO per frame** | 11M params forward pass × 1800 frames | ~27-54s |
| **Face detection per frame** | DNN inference × persons × frames | ~18-36s |
| **MediaPipe per frame** | 478 landmark mesh × persons × frames | ~29-54s |
| **Tidak di-skip** | sample_rate=1 berarti SETIAP frame diproses | Full cost |
| **Sequential** | Frame N harus selesai sebelum frame N+1 | Tidak parallel |
| **Multi-person** | 2 orang = 2× face + 2× mouth per frame | Double cost |

### Estimasi Total
- Clip 45s (1 orang): ~45-70s tracking
- Clip 60s (2 orang): ~90-140s tracking
- Clip 90s (2 orang): ~135-210s tracking
- **10 clips total: ~15-35 menit HANYA untuk tracking**

---

## 🎬 STEP 4e: Base Crop Render

### Input
- `clip_X_raw.mp4` + tracking_data (positions per frame)

### Proses Internal (per frame)
```
Untuk SETIAP FRAME:

1. Layout Decision
   - LayoutManager.update(): apakah grid (2+ orang) atau single?
   - Debounce: masuk grid butuh 3s continuous, keluar butuh 25 frames

2. IF Single Mode:
   - Hitung crop window (9:16 dari 16:9)
   - Center pada face dengan headroom rule-of-thirds
   - Smooth posisi crop dengan BBoxSmoother (alpha=0.05)
   - cv2.resize ke 1080×1920

3. IF Grid Mode:
   - Untuk SETIAP person (top + bottom):
     - Hitung dynamic padding (size_ratio)
     - Smooth crop size (BBoxSmoother alpha=0.02)
     - Smooth crop position (BBoxSmoother alpha=0.04)
     - cv2.resize cell ke 1080×960
   - numpy.vstack([top_cell, bottom_cell])
   - Draw divider line

4. Transition Blending
   - Grid→Single: 10-frame crossfade (cubic ease)
   - Single→Grid: instant cut
   - cv2.addWeighted untuk blending

5. Write frame ke FFmpeg pipe
   - Raw BGR bytes → stdin pipe
   - FFmpeg encode: libx264, CRF 18, preset fast
```

### Output
- `clip_X_base.mp4` (1080×1920, cropped, no overlays)

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi |
|--------|-----------|---------|
| Per-frame resize | cv2.resize × 1800 frames | ~5-10s |
| FFmpeg encoding | libx264 CRF 18 encode dari raw frames | ~10-25s |
| Memory bandwidth | 1080×1920×3 bytes per frame through pipe | ~3-5s |
| Grid computation | 2× crop calculations + vstack | +5-10s |

### Estimasi: ~15-40s per clip

---

## 🎨 STEP 4f: Final Render — Crop + Overlay (BOTTLENECK #2)

### Input
- `clip_X_raw.mp4` (source video)
- tracking_data (dari Step 4d)
- hook_text + hook_style
- subtitles (dari Step 4c) + caption_style

### Proses Internal — `render_full_overlay_on_source()` (SINGLE PASS)

```
Untuk SETIAP FRAME (1800 frames untuk clip 60s):

═══ STEP A: CROP (sama seperti Step 4e) ═══
  - Layout decision
  - Person crop + resize
  - Transition blending
  Waktu: ~3-5ms per frame

═══ STEP B: OVERLAY ═══

  IF frame < hook_frames (pertama 2-4 detik):
    ┌─── Premium Hook Rendering ───┐
    │ 1. cv2→PIL conversion         │  ~0.5ms
    │ 2. Create RGBA overlay        │  ~0.1ms
    │ 3. Font resolution:           │
    │    - Check local assets       │
    │    - Query DB jika perlu      │  ~0.1ms (cached)
    │    - Load .ttf file           │
    │ 4. Per-word metrics:          │
    │    - textbbox() per word      │  ~0.2ms × words
    │    - is_important check       │
    │ 5. Layout (line breaking)     │  ~0.1ms
    │ 6. Draw SHADOW:               │
    │    - Nested loop blur_offset  │
    │    - draw.text() × O(blur²)   │  ~2-5ms ← HEAVY
    │ 7. Draw GLOW (if enabled):    │
    │    - Triple nested loop       │  ~3-8ms ← HEAVY
    │ 8. Draw OUTLINE:              │
    │    - 8-direction stroke       │  ~1-2ms
    │ 9. Draw main TEXT             │  ~0.3ms
    │ 10. Draw UNDERLINE            │  ~0.1ms
    │ 11. Animation transform:      │
    │    - Alpha multiplication     │
    │    - Scale/slide/bounce       │  ~0.5-1ms
    │ 12. PIL→cv2 conversion        │  ~0.5ms
    └───────────────────────────────┘
    Total hook frame: ~8-18ms

  ELSE (subtitle frames):
    ┌─── Premium Caption Rendering ───┐
    │ 1. Binary search subtitle       │  ~0.01ms (O(log n))
    │ 2. cv2→PIL conversion           │  ~0.5ms
    │ 3. Font loading (cached)        │  ~0.1ms
    │ 4. Word wrapping                │  ~0.2ms
    │ 5. Per-word karaoke check:      │
    │    - Compare current_time       │
    │    - Determine highlight color  │  ~0.1ms × words
    │ 6. Draw SHADOW per word         │  ~1-3ms
    │ 7. Draw OUTLINE per word        │  ~1-2ms
    │ 8. Draw TEXT per word           │  ~0.3ms
    │ 9. Draw HIGHLIGHT (active word) │  ~0.2ms
    │ 10. PIL→cv2 conversion          │  ~0.5ms
    └──────────────────────────────────┘
    Total subtitle frame: ~4-7ms

═══ STEP C: WRITE TO FFMPEG ═══
  - frame.tobytes() → pipe stdin
  - FFmpeg libx264 CRF 18 encode
  Waktu: ~2-4ms per frame (piped, buffered)
```

### Total per Frame (Final Render)
```
Crop + resize:          ~3-5ms
Overlay rendering:      ~4-18ms (hook heavier than subtitle)
FFmpeg pipe write:      ~2-4ms
─────────────────────────────────
TOTAL PER FRAME:        ~9-27ms

Clip 60s @ 30fps = 1800 frames × 18ms avg = ~32 detik
```

### Kenapa Lambat?
| Faktor | Penjelasan | Estimasi |
|--------|-----------|---------|
| **PIL per frame** | cv2↔PIL conversion 2× per frame × 1800 frames | ~2s total |
| **Shadow rendering** | Nested loop O(blur²) — blur=12 = 144 draw.text() calls per word | ~3-8s total |
| **Glow rendering** | Triple nested loop radius × dx × dy | ~5-10s total |
| **Font metrics** | textbbox() per word per frame | ~1-2s total |
| **Frame encoding** | libx264 CRF 18 dari raw 1080×1920 | ~10-20s total |
| **Memory copy** | 6.2MB per frame (1080×1920×3) through pipe | ~3-5s total |
| **Sequential** | Frame-by-frame, tidak bisa diparallelkan | Full serial |

### Estimasi Total
- Clip 45s: ~20-35s
- Clip 60s: ~30-50s
- Clip 90s: ~45-90s
- **10 clips total: ~5-15 menit untuk rendering**

---

## 🔊 STEP 4g: Audio Normalization

### Input
- `clip_X_final.mp4`

### Proses Internal
1. **Pass 1**: FFmpeg `loudnorm` filter analyze (measure loudness)
2. **Pass 2**: Apply normalization (target: -16 LUFS, TP -1.5, LRA 11)
3. Copy video stream, re-encode audio only (AAC 192kbps)
4. Replace original file

### Output
- `clip_X_final.mp4` (audio normalized)

### Waktu: ~5-10s per clip (2-pass FFmpeg)

---

## 📊 Ringkasan: Dimana Waktu Terbuang?

### Distribusi Waktu (Video 20 menit, 10 clips)

```
┌─────────────────────────────────────────────────────────┐
│ STEP                         │ Waktu    │ % Total       │
├─────────────────────────────────────────────────────────┤
│ 1. Download                  │ ~60s     │ 4%            │
│ 2. Whisper Full Transcript   │ ~90s     │ 6%            │
│ 3. AI Analysis (Standard)    │ ~45s     │ 3%            │
│ 4c. Whisper ×10 clips        │ ~300s    │ 19%           │
│ 4d. YOLO Tracking ×10       │ ~600s    │ 38% ← #1     │
│ 4e+4f. Render ×10           │ ~400s    │ 25% ← #2     │
│ 4g. Audio Norm ×10          │ ~75s     │ 5%            │
│ Lainnya (cut, extract, etc) │ ~30s     │ <2%           │
├─────────────────────────────────────────────────────────┤
│ TOTAL                        │ ~1600s   │ ~27 menit     │
└─────────────────────────────────────────────────────────┘
```

### Top 3 Bottleneck

| # | Bottleneck | Penyebab Utama | Waktu |
|---|-----------|----------------|-------|
| 1 | **YOLO Tracking** | Neural network inference per frame × 10 clips | ~10 menit |
| 2 | **Final Render** | PIL overlay + FFmpeg encode per frame × 10 clips | ~7 menit |
| 3 | **Whisper per-clip** | Medium model inference × 10 clips (redundant!) | ~5 menit |

---

## 🔬 Detail: Mengapa Setiap Komponen Berat?

### Whisper Medium — Mengapa Berat?
```
Architecture:
  - Encoder: 24 transformer layers, d_model=1024, 16 heads
  - Decoder: 24 transformer layers, autoregressive
  - Parameters: 769 million
  - Input: 80-channel mel spectrogram, 30s chunks
  
Per 30s audio chunk:
  - Mel spectrogram: 3000 frames × 80 dims
  - Encoder: 24 × self-attention O(n²) = ~50ms
  - Decoder: ~100-200 tokens × 24 layers each = ~5-15s
  - Total per 30s chunk: ~5-15s CPU time
  
Kenapa medium bukan small/tiny:
  - Medium: WER ~8% (Indonesian), akurat untuk word timestamps
  - Small: WER ~15%, sering miss kata/timestamp salah
  - Tiny: WER ~30%, unusable untuk karaoke subtitles
```

### YOLOv8s — Mengapa Berat per Frame?
```
Architecture:
  - Backbone: CSPDarknet (modified)
  - Neck: PANet + C2f modules
  - Head: Decoupled head (class + bbox)
  - Parameters: 11.2 million
  - Input: 640×640×3

Per frame computation:
  - Preprocessing: resize 1080×1920 → 640×640 (letterbox)
  - Backbone: ~50 conv layers
  - Neck: feature pyramid (P3, P4, P5)
  - Head: 8400 anchors × (4 bbox + 80 class)
  - NMS: filter overlapping boxes
  - Total: ~15-30ms per frame (MPS) atau ~40-80ms (CPU only)

Kenapa setiap frame:
  - sample_rate=1 berarti TIDAK ada frame skip
  - Person tracking butuh continuous detection untuk stable IDs
  - ByteTrack IoU matching gagal jika ada gap >1 frame
```

### OpenCV DNN Face Detection — Mengapa per Frame?
```
Model: SSD + ResNet-10 (Caffe)
Input: 300×300 (cropped dari person bbox upper 65%)
Inference: ~5-10ms per person per frame

Kenapa per frame per person:
  - Face position berubah terus (berbicara, menoleh)
  - Dibutuhkan untuk Kalman filter update setiap frame
  - Mouth landmark butuh face_box yang akurat
```

### MediaPipe Face Mesh — Mengapa per Frame?
```
Model: BlazeFace + 478 landmarks
Input: Cropped face region + 30% padding

Per face per frame:
  - BlazeFace detection: ~3ms
  - Landmark regression (478 points): ~5ms
  - Mouth calculation: landmark[13].y - landmark[14].y
  - Total: ~8-15ms per face

Kenapa setiap frame:
  - Speaker detection butuh CONTINUOUS mouth_open variance
  - 60-frame sliding window (2s di 30fps) untuk variance calculation
  - Miss 1 frame = noise di variance → speaker switch salah
```

### PIL Overlay — Mengapa Berat per Frame?
```
Per subtitle frame:
  1. np.array → PIL.Image (memory copy 6.2MB)
  2. ImageDraw creation
  3. Per-word rendering:
     - textbbox() — font metric calculation
     - Shadow: blur radius 12 → 12×12=144 draw.text() calls per word!
       (nested loop: for blur_offset in range(12): for dx: for dy:)
     - Outline: 8 draw.text() calls per word
     - Main text: 1 draw.text()
  4. Alpha composite (RGBA blending)
  5. PIL.Image → np.array (memory copy 6.2MB)
  
Typical subtitle = 4 words:
  Shadow draws:  4 words × 144 calls = 576 draw.text()
  Outline draws: 4 words × 8 calls = 32 draw.text()
  Main draws:    4 words × 1 call = 4 draw.text()
  TOTAL:         612 draw.text() calls PER FRAME!
  
  × 1800 frames = 1,101,600 draw.text() calls per clip
```

---

## 💡 Potensi Optimasi (Referensi)

| # | Optimasi | Dampak Estimasi | Kompleksitas |
|---|---------|----------------|-------------|
| 1 | **YOLO sample_rate=3** | Tracking 3× lebih cepat | Rendah (sudah ada `video_cropper_fast`) |
| 2 | **Skip Whisper per-clip** | -5 menit (gunakan slice dari full transcript) | Medium |
| 3 | **Pre-render overlay** | Cache subtitle images, reuse across identical text | Medium |
| 4 | **Batch shadow rendering** | Render shadow 1× per unique text, bukan per frame | Medium |
| 5 | **Parallel clip processing** | 3× speedup (sudah ada flag, experimental) | Rendah |
| 6 | **GPU YOLO (MPS)** | 2-3× faster inference pada Apple Silicon | Rendah |
| 7 | **Whisper small** untuk per-clip | 2× faster, slight accuracy drop | Rendah |
| 8 | **FFmpeg overlay filter** | Hardware-accelerated subtitle burn-in | Tinggi |
| 9 | **Skip audio normalization** | -75s total | Rendah (flag off) |
| 10 | **AV1 detection pre-download** | Avoid 10-15 min re-encode surprise | Rendah |

---

## 📎 Catatan Tambahan

### Mengapa 10 Clips Sequential (Default)?
- `PIPELINE_CONFIG["parallel_clips"] = False`
- Alasan: YOLO model singleton (1 model instance) — concurrent inference bisa crash
- Experimental parallel mode tersedia tapi belum stabil

### Mengapa Whisper Dijalankan 2× (Full + Per-Clip)?
- Full transcript: untuk AI analysis (segment-level, no word timestamps)
- Per-clip: untuk karaoke subtitles (butuh word-level timestamps yang presisi)
- Full transcript TIDAK punya word-level timing — hanya segment-level

### Memory Usage Peak
```
YOLO model loaded:     ~100MB
Whisper model loaded:  ~1.5GB
Video frame in memory: ~6.2MB (1080×1920×3)
PIL overlay:           ~12.4MB (2× RGBA)
OpenCV DNN:            ~20MB
MediaPipe Face Mesh:   ~50MB
─────────────────────────────────
Peak RAM usage:        ~2-3GB per clip processing
```
