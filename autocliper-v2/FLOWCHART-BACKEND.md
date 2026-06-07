# AutoCliper v2 — Backend Flowchart

## Mode: `USE_CHUNKED_ANALYSIS=true` (Multi-Pass, Default)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FASTAPI SERVER START                          │
│  • Database tables created                                          │
│  • Background queue worker started                                  │
│  • WebSocket broadcaster wired                                      │
│  • Resume unfinished jobs from DB                                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CLIENT REQUEST (POST /api/v1/process)                   │
│  Body: { urls, caption_style, hook_style_id, user_id }              │
│  Auth: JWT Token                                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        JOB QUEUE (FIFO)                              │
│  Job di-enqueue → background worker pick up                         │
│  Max 2 workers (ThreadPoolExecutor)                                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 1: GET CAPTION STYLE & HOOK STYLE                  │
│  • Load CaptionStyle dari DB (font, warna, posisi, dll)             │
│  • Load HookStyle dari DB (jika ada)                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 2: CHECK CACHE                                     │
│  • Cek apakah URL sudah pernah diproses                             │
│  • Jika original.mp4 masih ada → skip download                      │
│  • Cleanup file lama (kecuali original.mp4)                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌──────────────────┐    ┌──────────────────────┐
        │  CACHE HIT       │    │  CACHE MISS          │
        │  Use existing    │    │  STEP 3: DOWNLOAD    │
        │  original.mp4    │    │  via yt-dlp          │
        └────────┬─────────┘    │  • Cookie strategy   │
                 │              │  • Format fallback    │
                 │              │  • H.264 check        │
                 │              └──────────┬────────────┘
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│       STEP 4: WHISPER C++ TRANSCRIPTION (Full Video)                 │
│                                                                     │
│  Input:  original.mp4 → extract full_audio.wav (16kHz)              │
│  Proses: whisper-cli -m ggml-medium.bin -t 8 -p 2 --language auto   │
│  Output: {"data": [["0.0","3.2","teks..."], ...]}                   │
│  Cache:  full_transcript.json (skip jika sudah ada)                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌═════════════════════════════════════════════════════════════════════╗
║       STEP 4a: TRANSCRIPT CHUNK BUILDER                            ║
║                                                                    ║
║  Config: 4000 words/chunk, 200 word overlap                        ║
║                                                                    ║
║  Input:  full_transcript.json (20.000 kata untuk video 1 jam)      ║
║  Output: 5 chunks                                                  ║
║                                                                    ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  ║
║  │ Chunk 1  │ │ Chunk 2  │ │ Chunk 3  │ │ Chunk 4  │ │Chunk 5 │  ║
║  │ 0-760s   │ │ 700-1490s│ │1430-2200s│ │2140-2950s│ │2890-end│  ║
║  │ 4000 kata│ │ 4000 kata│ │ 4000 kata│ │ 4000 kata│ │3500kata│  ║
║  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘  ║
║       ↑ overlap 200 kata ↑                                         ║
╚═══════════════════════════════╤═════════════════════════════════════╝
                                │
                                ▼
┌═════════════════════════════════════════════════════════════════════╗
║       STEP 4b: AI PASS #1 — CANDIDATE DETECTION                    ║
║       (max 3 concurrent, Gemini 2.5-flash)                         ║
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐   ║
║  │  Concurrent Execution (ThreadPool, max_workers=3)           │   ║
║  │                                                             │   ║
║  │  Chunk 1 ──→ Gemini ──→ 8 candidates                       │   ║
║  │  Chunk 2 ──→ Gemini ──→ 7 candidates    (run together)     │   ║
║  │  Chunk 3 ──→ Gemini ──→ 10 candidates                      │   ║
║  │       ↓ (slot freed)                                        │   ║
║  │  Chunk 4 ──→ Gemini ──→ 9 candidates                       │   ║
║  │  Chunk 5 ──→ Gemini ──→ 6 candidates                       │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  Per candidate output (MULTI-SCORE):                               ║
║  ┌─────────────────────────────────────────────────────────────┐   ║
║  │  {                                                          │   ║
║  │    "start_time": 125.0, "end_time": 168.0,                 │   ║
║  │    "viral_score": 0.91,                                     │   ║
║  │    "curiosity_score": 0.95,                                 │   ║
║  │    "emotion_score": 0.62,                                   │   ║
║  │    "controversy_score": 0.48,                               │   ║
║  │    "story_score": 0.88,                                     │   ║
║  │    "brief_reason": "Pernyataan shocking tentang X"          │   ║
║  │  }                                                          │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  Retry: max 3x per chunk (exponential backoff)                     ║
║  Failed chunk → marked failed, pipeline continues                  ║
║                                                                    ║
║  Total: ~40-50 raw candidates                                      ║
╚═══════════════════════════════╤═════════════════════════════════════╝
                                │
                                ▼
┌═════════════════════════════════════════════════════════════════════╗
║       STEP 4c: CANDIDATE AGGREGATOR                                ║
║                                                                    ║
║  Input:  ~40-50 raw candidates from all chunks                     ║
║                                                                    ║
║  Process:                                                          ║
║  1. Calculate final_score per candidate:                           ║
║     final_score = viral*0.35 + curiosity*0.25 + story*0.20        ║
║                 + emotion*0.10 + controversy*0.10                  ║
║                                                                    ║
║  2. Sort by final_score (descending)                               ║
║                                                                    ║
║  3. Remove overlapping clips (>50% overlap → drop lower score)     ║
║                                                                    ║
║  4. Take Top 30                                                    ║
║                                                                    ║
║  Output: 30 best non-overlapping candidates                        ║
╚═══════════════════════════════╤═════════════════════════════════════╝
                                │
                                ▼
┌═════════════════════════════════════════════════════════════════════╗
║       STEP 4d: AI PASS #2 — FINAL RANKING                          ║
║       (1 Gemini call with all 30 candidates + transcript snippets)  ║
║                                                                    ║
║  Input ke Gemini:                                                  ║
║  ┌─────────────────────────────────────────────────────────────┐   ║
║  │  PROMPT: "Pilih 15 terbaik, buat hook + keywords"           │   ║
║  │  + VIDEO METADATA (title, duration, channel, views)         │   ║
║  │  + 30 CANDIDATES (scores + transcript snippet each)         │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  Output dari Gemini:                                               ║
║  ┌─────────────────────────────────────────────────────────────┐   ║
║  │  {                                                          │   ║
║  │    "index": 1,                                              │   ║
║  │    "start_time": 125.0, "end_time": 168.0,                 │   ║
║  │    "hook": "Richard Branson gak tahu P&L?",                 │   ║
║  │    "keywords": ["RICHARD BRANSON", "P&L"],                  │   ║
║  │    "viral_score": 0.91, "curiosity_score": 0.95,           │   ║
║  │    "emotion_score": 0.62, "controversy_score": 0.48,       │   ║
║  │    "story_score": 0.88,                                     │   ║
║  │    "reason": "Fakta mengejutkan tentang..."                 │   ║
║  │  }                                                          │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  Retry: max 3x (exponential backoff)                               ║
║  Fallback: if Pass #2 fails → use Pass #1 results + generic hooks  ║
║                                                                    ║
║  Output: Top 15 final clips (ranked, with hooks & keywords)        ║
╚═══════════════════════════════╤═════════════════════════════════════╝
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 5: SAVE TO DATABASE                                 │
│  • Create RequestLog (status: PROCESSING)                           │
│  • Store clip data + multi-scores (JSON)                            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│       STEP 6: PROCESS EACH CLIP (sequential / parallel)              │
│                                                                     │
│  ┌─────────────────────── PER CLIP ──────────────────────────┐     │
│  │                                                            │     │
│  │  [1/7] CUT VIDEO (FFmpeg stream copy)                     │     │
│  │         start_time → end_time → clip_N_raw.mp4            │     │
│  │                                                            │     │
│  │  [2/7] EXTRACT AUDIO                                      │     │
│  │         clip_N_raw.mp4 → audio_N.wav (16kHz PCM)          │     │
│  │                                                            │     │
│  │  [3/7] WHISPER SUBTITLES (per clip)                       │     │
│  │         audio_N.wav → word-level timestamps                │     │
│  │         Filter: buang segment sebelum hook_duration        │     │
│  │                                                            │     │
│  │  [4-5/7] PERSON TRACKING                                  │     │
│  │         YOLOv8 + DeepSORT (preferred)                     │     │
│  │         atau MediaPipe FaceTracker (fallback)              │     │
│  │         → tracking_data (posisi per frame)                 │     │
│  │                                                            │     │
│  │  [6/7] RENDER BASE CLIP                                   │     │
│  │         Crop 9:16 (centered on person)                     │     │
│  │         → clip_N_base.mp4 (tanpa overlay, untuk re-style) │     │
│  │                                                            │     │
│  │  [7/7] RENDER FINAL CLIP (single-pass)                    │     │
│  │         Crop 9:16 + Hook overlay + Animated Captions       │     │
│  │         → clip_N_final.mp4                                 │     │
│  │                                                            │     │
│  │  + Audio normalization (loudnorm)                          │     │
│  │  + Smart thumbnail (sharpest frame)                        │     │
│  │  + Save metadata JSON (untuk re-styling)                   │     │
│  └────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 7: CLEANUP TEMP FILES                               │
│  • Hapus temp_clip_N/ folders                                       │
│  • Keep: original.mp4, clip_N_base.mp4, clip_N_final.mp4           │
│  • Keep: metadata JSON, thumbnails                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STEP 8: UPDATE STATUS → COMPLETED                       │
│  • Update RequestLog di DB (status: COMPLETED)                      │
│  • Broadcast via WebSocket ke frontend                              │
│  • Return: { clips_processed, output_directory, clips[] }           │
└─────────────────────────────────────────────────────────────────────┘
```


## Perbandingan: Legacy vs Chunked

```
┌─────────────────────────────────┐    ┌─────────────────────────────────────┐
│  LEGACY (USE_CHUNKED=false)     │    │  CHUNKED (USE_CHUNKED=true)         │
├─────────────────────────────────┤    ├─────────────────────────────────────┤
│                                 │    │                                     │
│  Whisper Full Transcript        │    │  Whisper Full Transcript            │
│        ↓                        │    │        ↓                            │
│  Gemini (1 request)             │    │  Chunk Builder (4000 words/chunk)   │
│  20.000 kata sekaligus          │    │        ↓                            │
│        ↓                        │    │  Pass #1: 5 chunks × Gemini        │
│  Output: 3-5 clips             │    │  (3 concurrent, retry per chunk)    │
│        ↓                        │    │        ↓                            │
│  Render                         │    │  Aggregator: 50 → Top 30           │
│                                 │    │        ↓                            │
│  Risiko:                        │    │  Pass #2: 30 → Top 15 + hooks      │
│  • 503 timeout                  │    │        ↓                            │
│  • Token mahal                  │    │  Render (15 clips)                  │
│  • Momen terlewat               │    │                                     │
│  • 1 error = total fail         │    │  Keuntungan:                        │
│                                 │    │  • Lebih akurat                     │
│                                 │    │  • Lebih stabil (retry per chunk)   │
│                                 │    │  • Multi-score ranking              │
│                                 │    │  • Lebih banyak kandidat            │
│                                 │    │  • Momen di tengah tidak terlewat   │
└─────────────────────────────────┘    └─────────────────────────────────────┘
```


## Multi-Score System

```
Per clip, 5 dimensi scoring:

┌──────────────────────────────────────────────────────────────┐
│  viral_score      ████████████████████░░░░  0.91  (×0.35)    │
│  curiosity_score  █████████████████████████ 0.95  (×0.25)    │
│  emotion_score    ██████████████░░░░░░░░░░░ 0.62  (×0.10)    │
│  controversy_score████████████░░░░░░░░░░░░░ 0.48  (×0.10)    │
│  story_score      ████████████████████████░ 0.88  (×0.20)    │
│  ─────────────────────────────────────────────────────────── │
│  final_score      ████████████████████████░ 0.854             │
└──────────────────────────────────────────────────────────────┘

Formula:
  final_score = viral×0.35 + curiosity×0.25 + story×0.20
              + emotion×0.10 + controversy×0.10
```


## Provider Interface (Future-Ready)

```
┌─────────────────────────────────────────┐
│          IAIAnalyzer (interface)         │
│  • analyze_candidates(chunk, metadata)  │
│  • rank_candidates(candidates, meta)    │
└──────────────────┬──────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│ GeminiChunked    │  │ QwenLocal        │
│ Analyzer         │  │ Analyzer (future)│
│                  │  │                  │
│ • gemini-2.5-    │  │ • qwen3:4b       │
│   flash          │  │ • ollama local   │
│ • Cloud API      │  │ • No API cost    │
└──────────────────┘  └──────────────────┘

Fallback chain:
  Gemini → (429/503) → retry 3x → Qwen Local → Output tetap tersedia
```


## File Structure

```
src/
├── domain/
│   ├── entities.py          ← ClipData + ClipScores (multi-score)
│   └── interfaces.py        ← IAIAnalyzer (provider interface)
├── infrastructure/
│   ├── chunked_analyzer.py  ← NEW: ChunkedAnalysisPipeline
│   │   ├── TranscriptChunkBuilder
│   │   ├── CandidateAggregator  
│   │   ├── GeminiChunkedAnalyzer (IAIAnalyzer impl)
│   │   └── ChunkedAnalysisPipeline (orchestrator)
│   ├── external_services.py ← GeminiService (legacy, still works)
│   └── repositories.py      ← Updated: serialize/deserialize ClipScores
├── application/
│   └── services.py          ← Feature flag switch: chunked vs legacy
└── presentation/
    ├── schemas/jobs.py      ← ClipScoresResponse schema
    └── routes/jobs.py       ← Returns scores in API response
```


## Environment Variables

```bash
# Feature flag — toggle between legacy and chunked
USE_CHUNKED_ANALYSIS=true     # true = multi-pass, false = legacy single-pass

# Model override
GEMINI_MODEL=gemini-2.5-flash  # or gemini-2.0-flash for cost saving
```


## WebSocket Progress (Real-time)

```
analyzing_content:
  📦 Building transcript chunks...
  📦 Transcript split into 5 chunks (~4000 words each)
  🔍 Pass #1: Scanning 5 chunks for viral moments (max 3 concurrent)...
  🔍 Pass #1 done: 42 candidates from 5/5 chunks
  🧹 Aggregating 42 candidates → removing overlaps...
  🧹 Top 30 candidates selected for final ranking
  🏆 Pass #2: Final ranking + hook generation for 30 candidates...
  ✅ Analysis complete — 15 final clips with hooks & multi-scores
```
