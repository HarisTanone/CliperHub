# Pipeline v0.3 — Analisis, Bottleneck & Rekomendasi Final

> Dokumen ini adalah review menyeluruh dari Pipeline v0.2 + update fitur AI Reframe Engine.
> Mencakup: identifikasi bottleneck, kritik arsitektur, rekomendasi perbaikan, dan roadmap implementasi.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Analisis Per Step — Bottleneck & Fix](#2-analisis-per-step--bottleneck--fix)
3. [Bottleneck Utama — Cross-Cutting Issues](#3-bottleneck-utama--cross-cutting-issues)
4. [AI Reframe Engine — Analisis Khusus](#4-ai-reframe-engine--analisis-khusus)
5. [Arsitektur & Infrastruktur](#5-arsitektur--infrastruktur)
6. [Konfigurasi — Koreksi & Penambahan](#6-konfigurasi--koreksi--penambahan)
7. [Estimasi Performa Realistis](#7-estimasi-performa-realistis)
8. [Roadmap Implementasi](#8-roadmap-implementasi)
9. [Checklist Production-Readiness](#9-checklist-production-readiness)

---

## 1. Ringkasan Eksekutif

Pipeline ini sudah memiliki fondasi yang solid: environment-based config, step-by-step timing, parallelism yang terstruktur. Namun ada beberapa area kritis yang perlu dibenahi sebelum layak production:

| Area | Status | Severity |
|---|---|---|
| Semaphore sebagai job queue | ⚠️ Rapuh | HIGH |
| Tidak ada retry / error recovery | ❌ Missing | HIGH |
| Reframe menjadi bottleneck baru | ⚠️ Signifikan | HIGH |
| Concurrent jobs server terlalu optimis (8) | ⚠️ Salah kalkulasi | MEDIUM |
| Tidak ada progress streaming ke client | ❌ Missing | MEDIUM |
| Whisper fallback belum diimplementasi lengkap | ⚠️ Partial | MEDIUM |
| Cleanup tidak ada di error path | ❌ Missing | MEDIUM |
| Tidak ada rate limiting Gemini | ❌ Missing | MEDIUM |
| Tidak ada monitoring / alerting | ❌ Missing | LOW |
| TalkNet dependency belum divalidasi | ⚠️ Risk | LOW |

---

## 2. Analisis Per Step — Bottleneck & Fix

### Step 1 — VALIDATE

**Current:**
```
yt-dlp cek URL + durasi. Max 5 min (local) / 60 min (prod).
```

**Masalah:**
- `yt-dlp --dump-json` untuk validasi saja butuh **3-8 detik** karena hit YouTube server
- Tidak ada caching: URL sama divalidasi ulang kalau user submit lagi
- Tidak ada check apakah video sudah pernah diproses (deduplication)

**Rekomendasi:**
```python
# Tambahkan URL deduplication di DB sebelum hit yt-dlp
async def validate_step(youtube_url: str) -> VideoMeta:
    # 1. Cek cache/DB dulu
    cached = await db.get_processed_url(youtube_url)
    if cached and cached.status == "completed":
        return cached  # Skip semua step, langsung return hasil

    # 2. Baru hit yt-dlp
    # Gunakan --no-download --print duration,title,id -- lebih cepat dari --dump-json
    proc = await asyncio.create_subprocess_exec(
        "yt-dlp", "--no-download",
        "--print", "%(duration)s\t%(id)s\t%(title)s",
        youtube_url, ...
    )
```

**Improvement:** URL deduplication bisa hemat 100% waktu untuk video yang sama.

---

### Step 2 — DOWNLOAD

**Current:**
```
yt-dlp + aria2c (-x16 -s16) di production
```

**Masalah:**
- Download full MP4 dulu baru diproses — tidak ada streaming processing
- Di server dengan 8 concurrent jobs, 8 download simultan bisa saturate bandwidth
- Tidak ada resume kalau koneksi putus di tengah jalan
- Format tidak dispesifikasi — bisa download 4K padahal hanya butuh 1080p

**Rekomendasi:**
```bash
# Selalu force max 1080p, format mp4, skip download kalau sudah ada
yt-dlp \
  --format "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]" \
  --merge-output-format mp4 \
  --output "%(id)s.%(ext)s" \
  --continue \          # resume kalau putus
  --no-overwrites \     # skip kalau sudah ada
  --concurrent-fragments 16 \  # ganti aria2c, built-in yt-dlp terbaru
  URL
```

**Catatan:** `yt-dlp --concurrent-fragments` (versi terbaru) sudah built-in multi-thread download tanpa perlu aria2c terpisah. Simplify dependency.

**Tambahan — Download bandwidth throttling antar jobs:**
```python
# config.py
max_download_concurrent: int = 3  # batasi download bersamaan, bukan semua 8
download_semaphore = asyncio.Semaphore(CONFIG.max_download_concurrent)
```

---

### Step 3 — YOUTUBE TRANSCRIPT

**Current:**
```
YouTube Transcript API → [{start, end, text}]
Fallback: Whisper full video (prod only)
```

**Masalah:**
- YouTube Transcript API bisa rate-limited atau block IP server (terutama IP datacenter/VPS)
- Tidak ada language detection — transcript bisa dalam bahasa yang salah (auto-generated beda bahasa)
- Fallback ke Whisper full video di production bisa tambah 2-5 menit untuk video panjang
- Tidak ada handling untuk video dengan multiple language tracks

**Rekomendasi:**
```python
async def get_transcript(video_id: str, lang_priority: list = ["id", "en"]) -> list:
    # 1. Coba YouTube Transcript dengan preferred language
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        # Priority: manual captions > auto-generated, preferred lang first
        for lang in lang_priority:
            try:
                return transcript_list.find_transcript([lang]).fetch()
            except:
                pass
        
        # Fallback: ambil apapun yang ada, translate kalau perlu
        return transcript_list.find_generated_transcript(lang_priority).fetch()
    
    except TranscriptsDisabled:
        # Tidak ada caption sama sekali
        if CONFIG.is_local:
            raise JobError("No transcript available")
        else:
            return await whisper_full_video_fallback(video_id)
    
    except Exception as e:
        # Rate limited atau error lain
        await asyncio.sleep(2)  # backoff
        raise
```

**Tambahan:** Simpan transcript ke DB/cache. Kalau video sama disubmit lagi, tidak perlu fetch ulang.

---

### Step 4 — GEMINI ANALYSIS

**Current:**
```
1 pass, prompt anti-cut, multi-score, max clips dinamis
```

**Masalah:**
- **Tidak ada retry logic** — kalau Gemini timeout atau error 429, job langsung gagal
- **Tidak ada rate limiting** — dengan 8 concurrent jobs, 8 Gemini call simultan bisa trigger quota exceeded
- **Context window limit** — transcript video 60 menit bisa sangat panjang, bisa melebihi token limit
- Prompt tidak diverifikasi hasilnya secara ketat (JSON parsing error tidak ditangani dengan baik)
- Max clips "dinamis" tapi logic-nya hardcoded di prompt — risiko Gemini return format salah

**Rekomendasi:**
```python
# Tambahkan Gemini rate limiter global
gemini_semaphore = asyncio.Semaphore(CONFIG.max_gemini_concurrent)  # max 3-4

async def call_gemini_with_retry(prompt: str, max_retries: int = 3) -> dict:
    for attempt in range(max_retries):
        try:
            async with gemini_semaphore:
                response = await model.generate_content_async(prompt)
                return parse_gemini_response(response)
        except ResourceExhausted:  # 429
            wait = 2 ** attempt * 5  # exponential backoff: 5s, 10s, 20s
            await asyncio.sleep(wait)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2)
    raise GeminiError("Max retries exceeded")

def parse_gemini_response(response) -> dict:
    # Strict JSON parsing dengan schema validation
    text = response.text.strip()
    # Remove markdown code blocks kalau ada
    text = re.sub(r'^```(?:json)?\n?', '', text).rstrip('`')
    
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Coba extract JSON dari text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise GeminiParseError("Cannot parse Gemini response")
    
    # Schema validation
    validate_clips_schema(data)
    return data
```

**Tambahan — Transcript chunking untuk video panjang:**
```python
MAX_TRANSCRIPT_TOKENS = 50_000  # ~37,500 kata

def prepare_transcript_for_gemini(transcript: list, video_duration: float) -> str:
    full_text = format_transcript(transcript)
    
    if estimate_tokens(full_text) > MAX_TRANSCRIPT_TOKENS:
        # Chunk transcript, analisis per segment, merge hasilnya
        # Atau: compress dengan ambil 1 dari setiap 2 segmen kalau terlalu panjang
        full_text = compress_transcript(transcript, target_tokens=MAX_TRANSCRIPT_TOKENS)
    
    return full_text
```

---

### Step 5 — TIME PADDING + VALIDASI

**Current:**
```
start - 0.5s, end + 1.0s. Filter min 5 detik.
```

**Masalah:**
- Padding 0.5s/1.0s hardcoded — seharusnya dari config
- Tidak ada overlap detection — dua clips bisa overlap kalau Gemini return timestamps yang dekat
- Tidak ada max duration validation per clip (Gemini bisa return clip 55 menit dari video 60 menit)

**Rekomendasi:**
```python
@dataclass
class PipelineConfig:
    # Time padding (tambahkan ke config)
    clip_start_padding: float = 0.5   # detik
    clip_end_padding: float = 1.0     # detik
    clip_min_duration: float = 5.0    # detik
    clip_max_duration: float = 180.0  # detik (3 menit max per clip)

def validate_and_pad_clips(clips: list, video_duration: float, config) -> list:
    validated = []
    
    for clip in clips:
        # Apply padding
        start = max(0, clip['start'] - config.clip_start_padding)
        end = min(video_duration, clip['end'] + config.clip_end_padding)
        duration = end - start
        
        # Filter invalid
        if duration < config.clip_min_duration:
            logger.warning(f"Clip too short ({duration:.1f}s), skipping")
            continue
        if duration > config.clip_max_duration:
            logger.warning(f"Clip too long ({duration:.1f}s), truncating")
            end = start + config.clip_max_duration
        
        validated.append({**clip, 'start': start, 'end': end})
    
    # Overlap detection & resolution
    validated = resolve_overlapping_clips(validated)
    
    return validated

def resolve_overlapping_clips(clips: list) -> list:
    clips_sorted = sorted(clips, key=lambda x: x['start'])
    result = [clips_sorted[0]]
    
    for clip in clips_sorted[1:]:
        prev = result[-1]
        if clip['start'] < prev['end']:
            # Overlap: pilih yang score lebih tinggi, atau trim
            if clip.get('score', 0) > prev.get('score', 0):
                result[-1] = clip  # replace dengan yang lebih baik
            # else: skip clip ini
        else:
            result.append(clip)
    
    return result
```

---

### Step 6 — TRIM (FFmpeg stream copy)

**Current:**
```
Paralel, -c copy, -avoid_negative_ts, -movflags faststart
```

**Masalah:**
- Stream copy bisa menghasilkan **A/V sync issue** kalau start point tidak tepat di keyframe
- Tidak ada validasi output — FFmpeg bisa "sukses" tapi output corrupt atau kosong
- Error handling FFmpeg: exit code 0 tidak selalu berarti output valid

**Rekomendasi:**
```bash
# Gunakan re-encode ringan hanya untuk frame yang tidak tepat di keyframe
# Tapi untuk clip > 5 detik, force keyframe lebih baik
ffmpeg -y \
  -ss {start} \           # Seek sebelum -i (fast seek)
  -i {input} \
  -to {duration} \        # Durasi relatif (lebih akurat dari -t untuk stream copy)
  -c:v copy \
  -c:a aac -b:a 128k \    # Re-encode audio saja untuk sync — sangat cepat
  -avoid_negative_ts make_zero \
  -movflags +faststart \
  -map_metadata -1 \      # Strip metadata untuk file lebih kecil
  {output}
```

```python
async def validate_output_clip(clip_path: str) -> bool:
    """Validasi clip output tidak corrupt"""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        clip_path, stdout=PIPE, stderr=PIPE
    )
    stdout, _ = await proc.communicate()
    
    if proc.returncode != 0:
        return False
    
    try:
        duration = float(stdout.decode().strip())
        return duration > 0
    except:
        return False
```

---

### Step 7 — AI REFRAME ENGINE *(baru)*

> Dibahas detail di [Seksi 4](#4-ai-reframe-engine--analisis-khusus).

**Summary:** Ini adalah **bottleneck terbesar baru** di pipeline. Di M1 bisa 5-6 menit per clip. Butuh strategi khusus.

---

### Step 8 — WHISPER (per clip, paralel)

**Current:**
```
Local: medium + Metal, 1 paralel
Prod: large-v3-turbo + CUDA, 4-6 paralel
```

**Masalah:**
- WAV conversion (MP4 → WAV 16kHz) tidak diparallelkan terpisah dari transcription
- Tidak ada caching — kalau clip sama ditranscribe ulang (tidak terjadi di normal flow, tapi kalau retry)
- large-v3-turbo butuh **~3GB VRAM** — kalau reframe juga pakai GPU, bisa VRAM contention di RTX 3070 (8GB)
- Whisper di M1 dengan model medium + 1 thread bisa lambat untuk clip panjang

**Rekomendasi VRAM Management (Production):**
```python
# Reframe dan Whisper tidak boleh jalan bersamaan (VRAM contention)
# Opsi 1: Sequential (aman)
# Step 7 (Reframe semua clips) → selesai → Step 8 (Whisper semua clips)

# Opsi 2: Serialized dengan GPU lock
gpu_semaphore = asyncio.Semaphore(1)  # Hanya 1 proses GPU simultan

async def whisper_transcribe_clip(clip_path: str) -> list:
    async with gpu_semaphore:
        # convert WAV dulu (CPU, tidak perlu lock)
        wav_path = await convert_to_wav(clip_path)
        # Whisper GPU
        result = await run_whisper(wav_path)
    return result
```

**Rekomendasi untuk M1 — Percepat Whisper:**
```bash
# Gunakan CoreML untuk akselerasi di M1 (lebih cepat dari Metal backend)
# Build whisper.cpp dengan CoreML support
cmake -B build \
  -DGGML_METAL=ON \
  -DWHISPER_COREML=ON  # Generate CoreML model
cmake --build build -j8

# Generate CoreML model (sekali saja)
python3 models/generate-coreml-model.py medium
# Output: ggml-medium-encoder.mlmodelc
```

CoreML di M1 bisa **2-3x lebih cepat** dari Metal-only untuk Whisper medium.

---

### Step 9 — GEMINI HIGHLIGHT (paralel)

**Current:**
```
asyncio.gather semua clips. Fallback rule-based.
```

**Masalah:**
- Ini adalah **Gemini call ke-N** setelah Step 4 — makin banyak clip, makin banyak API call
- Tidak ada batching — untuk 10 clips = 10 Gemini API call simultan
- Fallback rule-based tidak terdefinisi dengan jelas di dokumentasi

**Rekomendasi:**
```python
# Batasi concurrent Gemini highlight calls
HIGHLIGHT_SEMAPHORE = asyncio.Semaphore(CONFIG.max_gemini_concurrent)

async def highlight_single_clip(clip_data: dict) -> dict:
    async with HIGHLIGHT_SEMAPHORE:
        try:
            return await call_gemini_highlight(clip_data)
        except Exception:
            return apply_rule_based_highlight(clip_data)

# Rule-based fallback yang proper
def apply_rule_based_highlight(clip_data: dict) -> dict:
    words = clip_data['words']
    
    # Highlight berdasarkan kriteria linguistik:
    # 1. Kata dengan durasi > rata-rata (kata yang ditekankan)
    # 2. Kata di awal kalimat (setelah tanda baca)
    # 3. Kata dengan huruf kapital (proper noun)
    # 4. Kata yang bukan stopword
    
    avg_duration = sum(w['end'] - w['start'] for w in words) / len(words)
    stopwords = {"yang", "dan", "di", "ke", "dari", "untuk", "ini", "itu", "adalah", "dengan"}
    
    for word in words:
        duration = word['end'] - word['start']
        word['highlight'] = (
            duration > avg_duration * 1.3 or
            word['word'][0].isupper() or
            word['word'].lower() not in stopwords
        ) and len(word['word']) > 2
    
    return clip_data
```

---

### Step 10 — ASSEMBLE JSON

**Masalah:**
- Tidak ada schema versioning yang ketat di output JSON
- Tidak ada checksum/hash untuk validasi integritas output
- Kalau DB write gagal setelah semua processing selesai, semua kerja hilang

**Rekomendasi:**
```python
async def assemble_final_json(job_id: str, clips_data: list) -> dict:
    result = {
        "version": "1.1",  # bump versi kalau ada breaking change
        "job_id": job_id,
        "created_at": datetime.utcnow().isoformat(),
        "pipeline_version": "0.3",
        "clips": clips_data
    }
    
    # Simpan ke file dulu sebagai backup
    output_path = f"{CONFIG.output_dir}/{job_id}.json"
    async with aiofiles.open(output_path, 'w') as f:
        await f.write(json.dumps(result, ensure_ascii=False, indent=2))
    
    # Baru update DB
    await db.update_job(job_id, status="completed", output_path=output_path)
    
    return result
```

---

### Step 11 — CLEANUP

**Masalah kritis:** Cleanup hanya dipanggil setelah `completed`. Kalau job `failed` di Step 5, temp files tidak dihapus — di M1 dengan 11GB disk ini sangat berbahaya.

**Rekomendasi:**
```python
async def run_pipeline(job_id: str, youtube_url: str):
    temp_files = []  # track semua temp files
    
    try:
        # ... semua steps ...
        pass
    
    except Exception as e:
        await db.update_job(job_id, status="failed", error=str(e))
        logger.error(f"Job {job_id} failed at step X: {e}")
    
    finally:
        # SELALU cleanup, baik success maupun failed
        await cleanup_job_files(job_id, temp_files)

async def cleanup_job_files(job_id: str, temp_files: list):
    paths_to_delete = [
        f"{CONFIG.download_dir}/{job_id}*",
        f"{CONFIG.clip_dir}/{job_id}*",
        f"{CONFIG.wav_dir}/{job_id}*",
        f"{CONFIG.reframe_dir}/{job_id}*",  # temp reframe files
    ]
    
    for pattern in paths_to_delete:
        for path in glob.glob(pattern):
            try:
                os.remove(path)
            except Exception as e:
                logger.warning(f"Cleanup failed for {path}: {e}")
```

---

## 3. Bottleneck Utama — Cross-Cutting Issues

### 3.1 — Semaphore sebagai Job Queue (CRITICAL)

**Problem:** `asyncio.Semaphore` bukan job queue. Kalau:
- Server restart → semua job yang "processing" hilang, tidak pernah selesai
- Job stuck (Whisper hang) → Semaphore tidak pernah direlease → pipeline hang

**Solusi Jangka Pendek (tanpa Redis):**
```python
# Gunakan database sebagai simple job queue
class JobQueue:
    async def claim_job(self) -> Optional[Job]:
        """Atomic claim job dari DB"""
        async with db.transaction():
            job = await db.fetch_one(
                "SELECT * FROM jobs WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE"
            )
            if job:
                await db.execute(
                    "UPDATE jobs SET status='processing', started_at=NOW() WHERE id=?",
                    job.id
                )
            return job
    
    async def worker_loop(self):
        while True:
            job = await self.claim_job()
            if job:
                asyncio.create_task(run_pipeline(job))
            else:
                await asyncio.sleep(2)  # polling
```

**Solusi Jangka Panjang:** ARQ (Redis-based async job queue) seperti yang sudah direncanakan di TODO. Prioritaskan ini.

---

### 3.2 — Tidak Ada Progress Streaming

**Problem:** Client hanya bisa poll `GET /api/jobs/{id}` untuk cek status. Untuk pipeline 3-4 menit, user experience buruk.

**Solusi — Server-Sent Events:**
```python
@app.get("/api/jobs/{job_id}/progress")
async def job_progress_stream(job_id: str):
    async def event_generator():
        while True:
            job = await db.get_job(job_id)
            yield {
                "data": json.dumps({
                    "step": job.current_step,
                    "progress": job.progress,
                    "total": 11,
                    "message": job.step_message,
                    "status": job.status
                })
            }
            
            if job.status in ["completed", "failed"]:
                break
            
            await asyncio.sleep(1)
    
    return EventSourceResponse(event_generator())
```

---

### 3.3 — Error Recovery

**Problem:** Pipeline tidak bisa di-resume dari step terakhir yang berhasil. Kalau Step 8 (Whisper) gagal setelah Step 7 (Reframe) yang butuh 5 menit di M1, user harus restart dari awal.

**Solusi — Checkpoint System:**
```python
async def run_step(job_id: str, step_name: str, step_fn, *args):
    # Cek apakah step ini sudah selesai sebelumnya
    checkpoint = await db.get_checkpoint(job_id, step_name)
    if checkpoint and checkpoint.status == "done":
        logger.info(f"Step {step_name} already completed, skipping")
        return checkpoint.result
    
    logger.info(f"Running step {step_name}")
    timer = StepTimer(step_name)
    
    try:
        result = await step_fn(*args)
        await db.save_checkpoint(job_id, step_name, result)
        timer.stop()
        return result
    except Exception as e:
        timer.stop(error=True)
        raise

# Usage
clips = await run_step(job_id, "GEMINI_ANALYSIS", gemini_analyze, transcript)
trimmed = await run_step(job_id, "TRIM", trim_clips, clips, video_path)
# dst...
```

---

### 3.4 — Memory & Resource Leak

**Problem di M1 (8GB RAM, 11GB disk):**
- `ffmpeg` process zombie kalau tidak di-cleanup dengan benar
- WAV files di `/tmp` tidak selalu terhapus kalau ada exception
- Multiple yt-dlp process bisa concurrent kalau ada race condition

**Monitoring sederhana:**
```python
import psutil

async def check_resources() -> dict:
    disk = psutil.disk_usage('/tmp')
    mem = psutil.virtual_memory()
    
    return {
        "disk_free_gb": disk.free / (1024**3),
        "mem_available_gb": mem.available / (1024**3),
        "ffmpeg_processes": len([p for p in psutil.process_iter() if 'ffmpeg' in p.name()]),
    }

# Di setiap job start:
async def pre_job_check():
    resources = await check_resources()
    if resources['disk_free_gb'] < 2.0:
        raise InsufficientResourcesError("Disk hampir penuh, tolak job baru")
    if resources['mem_available_gb'] < 1.0:
        raise InsufficientResourcesError("RAM tidak cukup")
```

---

## 4. AI Reframe Engine — Analisis Khusus

### 4.1 — Estimasi Waktu yang Salah

Dokumen menyebutkan **~5-6 menit per clip di M1** untuk reframe. Ini masalah besar:

```
Pipeline tanpa reframe:  2-3 menit (video 3 menit, 2 clip)
+ Reframe 2 clip:        10-12 menit extra
= Total di M1:           12-15 menit untuk video 3 menit
```

Ini **tidak acceptable** untuk development workflow. User harus tunggu 15 menit untuk test pipeline.

**Solusi untuk M1:**
1. **Tambahkan `--skip-reframe` flag** untuk local development
2. **Kurangi resolusi preview** — reframe ke 480p dulu di local, bukan 1080p
3. **Sample setiap N frame** — untuk tracking, tidak perlu setiap frame, sample setiap 5 frame (dari 30fps → proses 6fps)

```python
@dataclass
class PipelineConfig:
    reframe_enabled: bool = True      # False di local untuk dev
    reframe_preview_only: bool = False # True di local: output 480p saja
    reframe_frame_sample: int = 1      # Local: 5 (setiap 5 frame), Prod: 1

LOCAL_CONFIG = PipelineConfig(
    reframe_enabled=True,       # tetap bisa test
    reframe_preview_only=True,  # tapi output 480p saja
    reframe_frame_sample=5,     # sample setiap 5 frame untuk speed
    ...
)
```

### 4.2 — VRAM Budget RTX 3070 (8GB)

Hitung budget VRAM dengan semua komponen aktif:

| Komponen | VRAM Usage |
|---|---|
| YOLOv11-face (small) | ~400 MB |
| ByteTrack | ~100 MB |
| TalkNet | ~800 MB |
| Whisper large-v3-turbo | ~3,000 MB |
| FFmpeg NVENC | ~500 MB |
| OpenCV CUDA buffers | ~200 MB |
| **Total estimate** | **~5,000 MB** |
| **RTX 3070 VRAM** | **8,192 MB** |
| **Headroom** | **~3,192 MB** |

Masih aman, tapi tipis kalau ada 2 jobs paralel yang sama-sama reframe. Rekomendasi: **serialkan reframe jobs** (max 1 reframe simultan) meskipun concurrent jobs 3-4.

```python
reframe_gpu_semaphore = asyncio.Semaphore(1)  # Hanya 1 reframe simultan
whisper_gpu_semaphore = asyncio.Semaphore(2)  # 2 Whisper bisa simultan (ukuran lebih kecil)
```

### 4.3 — One Euro Filter — Parameter Tuning

One Euro Filter butuh parameter yang tepat untuk feel yang natural:

```python
class OneEuroFilter:
    def __init__(self, freq=30, mincutoff=1.0, beta=0.1, dcutoff=1.0):
        # Untuk face tracking di video:
        # mincutoff rendah (0.5-1.0): lebih smooth, tapi lag
        # beta tinggi (0.1-0.5): responsif ke gerakan cepat
        # Rekomendasi starting point: mincutoff=0.7, beta=0.2
        pass
```

Parameter yang tidak tuned bisa menghasilkan kamera yang terasa "mengambang" atau justru terlalu jerky.

### 4.4 — TalkNet — Dependency Risk

TalkNet adalah model yang tidak aktif dikembangkan. Risiko:
- Tidak compatible dengan PyTorch versi terbaru
- Dependency chain bisa conflict (terutama dengan ultralytics/YOLOv11)
- Tidak ada fallback yang jelas kalau TalkNet gagal

**Alternatif yang lebih stabil:**
- **SyncNet** (lebih ringan, khusus lip-sync detection)
- **pyannote-audio** (speaker diarization, lebih maintained)
- **Simple rule**: kalau ada 2 orang, follow yang berbicara lebih banyak berdasarkan motion (mulut movement) via OpenCV — tanpa model tambahan

**Rekomendasi:** Tunda TalkNet, implementasi pyannote-audio yang lebih mudah di-maintain.

---

## 5. Arsitektur & Infrastruktur

### 5.1 — Concurrent Jobs: Angka yang Realistis

**Dokumen lama menyebut: 8 concurrent jobs di production.**

Hitung ulang untuk server (i7-13700K, 62GB RAM, RTX 3070):

| Step | Resource Bottleneck | Max Safe Concurrent |
|---|---|---|
| Download | Network bandwidth (asumsi 100Mbps) | 3-4 |
| Gemini Analysis | API rate limit | 3-5 |
| Reframe | VRAM (8GB) | 1 |
| Whisper | VRAM (8GB shared) | 2-3 |
| FFmpeg Trim | CPU/disk I/O | 6 |

**Realistic concurrent jobs: 3-4 (bukan 8)**

Dengan 8 concurrent, kemungkinan besar akan ada:
- VRAM OOM saat reframe + whisper bersamaan
- Gemini 429 rate limit error
- I/O saturation di download step

Update `PRODUCTION_CONFIG`:
```python
PRODUCTION_CONFIG = PipelineConfig(
    max_concurrent_jobs=4,        # Realistis, bukan 8
    max_download_concurrent=3,    # Batasi download paralel
    max_gemini_concurrent=3,      # Hindari 429
    max_reframe_concurrent=1,     # VRAM constraint
    max_whisper_parallel=2,       # VRAM constraint (shared dengan reframe)
    max_render_workers=6,         # CPU-only, aman paralel tinggi
    ...
)
```

### 5.2 — SQLite vs MySQL untuk Local Dev

**Problem:** SQLite dengan `aiosqlite` tidak support `FOR UPDATE` (row locking). Kalau ada bug yang bikin multiple workers bisa pick job yang sama, SQLite tidak bisa mencegahnya.

**Rekomendasi:** Gunakan SQLite untuk unit test saja. Untuk integration test di lokal, gunakan MySQL via Docker:

```yaml
# docker-compose.dev.yml
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: pipeline_dev
    ports:
      - "3306:3306"
```

```bash
# .env.local.dev (untuk integration test)
DATABASE_URL=mysql+aiomysql://root:root@127.0.0.1/pipeline_dev
```

### 5.3 — Logging yang Lebih Baik

**Tambahkan structured logging:**
```python
import structlog

logger = structlog.get_logger()

# Di setiap step:
logger.info("step_start",
    job_id=job_id,
    step="WHISPER",
    clip_count=len(clips),
    model=CONFIG.whisper_model
)

logger.info("step_complete",
    job_id=job_id,
    step="WHISPER",
    duration_ms=timer.elapsed_ms,
    clips_processed=len(results)
)
```

Ini memudahkan query log di production: "Berapa rata-rata waktu Step 8 minggu ini?"

---

## 6. Konfigurasi — Koreksi & Penambahan

Config yang direkomendasikan (diff dari versi sekarang):

```python
@dataclass
class PipelineConfig:
    # --- EXISTING (beberapa dikoreksi) ---
    max_concurrent_jobs: int        # Local: 1, Prod: 4 (bukan 8)
    max_whisper_parallel: int       # Local: 1, Prod: 2 (bukan 6)
    max_render_workers: int         # Local: 2, Prod: 6 ✓

    whisper_bin: str
    whisper_model: str
    whisper_threads: int            # Local: 4 ✓, Prod: 8 ✓
    whisper_use_gpu: bool
    whisper_use_coreml: bool        # BARU: untuk M1 CoreML acceleration

    face_detector: str
    use_speaker_detection: bool
    use_gpu_encode: bool
    reframe_max_parallel: int       # Local: 1 ✓, Prod: 1 (bukan 4, VRAM)
    reframe_enabled: bool           # BARU: toggle reframe
    reframe_preview_only: bool      # BARU: output 480p di local
    reframe_frame_sample: int       # BARU: sample rate untuk tracking

    download_dir: str
    clip_dir: str
    wav_dir: str
    output_dir: str                 # BARU: untuk final JSON output

    max_video_duration: int
    max_video_size_mb: int
    clip_start_padding: float       # BARU: dari hardcoded 0.5
    clip_end_padding: float         # BARU: dari hardcoded 1.0
    clip_min_duration: float        # BARU: dari hardcoded 5.0
    clip_max_duration: float        # BARU: max durasi per clip (180s)

    use_aria2c: bool
    is_local: bool

    # --- BARU ---
    max_download_concurrent: int    # Throttle download paralel
    max_gemini_concurrent: int      # Throttle Gemini API calls
    disk_min_free_gb: float         # Pre-job resource check
    ram_min_free_gb: float          # Pre-job resource check
    
    lang_priority: list             # Bahasa transcript ["id", "en"]
    gemini_model: str               # "gemini-2.5-flash"
    gemini_max_retries: int         # Retry untuk Gemini (3)
    
    enable_url_cache: bool          # Skip re-process URL yang sama
    enable_step_checkpoints: bool   # Resume dari step terakhir
    enable_sse_progress: bool       # Server-sent events untuk progress
```

---

## 7. Estimasi Performa Realistis

### Local (M1, dengan Reframe)

| Durasi Video | Clips | Download | Gemini | Trim | Reframe | Whisper | Total |
|---|---|---|---|---|---|---|---|
| 3 menit | 2 | ~15s | ~5s | ~2s | ~10-12 menit | ~3-4 menit | **~14-17 menit** |
| (tanpa reframe) | | ~15s | ~5s | ~2s | — | ~3-4 menit | **~4-5 menit** |
| (dengan preview mode) | | ~15s | ~5s | ~2s | ~2-3 menit | ~3-4 menit | **~6-8 menit** |

**Rekomendasi local dev: gunakan `--skip-reframe` atau `reframe_preview_only=True`**

### Production (RTX 3070 aktif, 4 concurrent jobs)

| Durasi Video | Clips | Download | Gemini | Trim | Reframe | Whisper | Total |
|---|---|---|---|---|---|---|---|
| 3 menit | 2 | ~10s | ~5s | ~1s | ~30-40s | ~15s | **~60-75 detik** |
| 15 menit | 5 | ~30s | ~8s | ~2s | ~75-100s | ~30s | **~2.5-3 menit** |
| 60 menit | 10 | ~90s | ~15s | ~5s | ~150-200s | ~60s | **~5-6 menit** |

**Catatan:** Angka ini untuk single job. Dengan 4 concurrent jobs, throughput ~4x tapi per-job latency bisa 1.5-2x karena resource contention.

---

## 8. Roadmap Implementasi

### Phase 1 — Critical Fixes (lakukan sebelum production)

```
[ ] 1. Cleanup di finally block (bukan hanya di success)
[ ] 2. Gemini retry dengan exponential backoff
[ ] 3. Gemini rate limiter (semaphore global, max 3)
[ ] 4. Resource check sebelum job start (disk & RAM)
[ ] 5. FFmpeg output validation (ffprobe setelah trim)
[ ] 6. Fix concurrent jobs config: prod 4 (bukan 8), whisper paralel 2 (bukan 6)
[ ] 7. Overlap detection di Step 5
```

### Phase 2 — Stability & Developer Experience

```
[ ] 8.  Checkpoint system (resume dari step terakhir)
[ ] 9.  Server-Sent Events untuk progress streaming
[ ] 10. URL deduplication / caching
[ ] 11. reframe_preview_only mode untuk M1 dev
[ ] 12. Whisper CoreML build di M1 (2-3x speedup)
[ ] 13. Structured logging (structlog)
[ ] 14. Pre-job resource monitoring
[ ] 15. Language priority config untuk transcript
```

### Phase 3 — Production Hardening

```
[ ] 16. ARQ + Redis job queue (ganti Semaphore)
[ ] 17. NVENC encode (setelah GPU driver fix + reboot)
[ ] 18. YOLOv11 + ByteTrack di production
[ ] 19. pyannote-audio sebagai alternatif TalkNet
[ ] 20. Monitoring dashboard (Grafana / custom)
[ ] 21. Alerting kalau job queue backlog tinggi
[ ] 22. Docker Compose untuk local dev dengan MySQL
```

### Phase 4 — Optimasi Lanjutan

```
[ ] 23. OpenCV CUDA backend
[ ] 24. yt-dlp concurrent-fragments (ganti aria2c)
[ ] 25. Transcript caching di DB
[ ] 26. Auto-scaling berdasarkan queue depth
[ ] 27. CDN untuk output clips
[ ] 28. Batch Gemini highlight (kurangi API calls)
```

---

## 9. Checklist Production-Readiness

Sebelum launch ke production, pastikan semua ini sudah done:

### Security
- [ ] API key tidak hardcoded, selalu dari env
- [ ] `.env.production` tidak pernah di-commit ke git
- [ ] Input URL divalidasi (hanya YouTube, bukan arbitrary URL)
- [ ] Job ID tidak predictable (UUID, bukan auto-increment)
- [ ] Rate limiting per IP untuk POST /api/jobs

### Reliability
- [ ] Cleanup jalan di semua code path (success + failed + timeout)
- [ ] Gemini retry logic dengan backoff
- [ ] Timeout per step (tidak ada step yang bisa hang selamanya)
- [ ] Health check endpoint `/api/health` yang cek DB + disk + GPU
- [ ] Job timeout global (kalau 1 job jalan > 30 menit, auto-kill)

### Performance
- [ ] NVIDIA driver fix (reboot server)
- [ ] Whisper CUDA build terverifikasi
- [ ] VRAM budget dihitung dan tidak OOM
- [ ] Concurrent jobs config realistis (4, bukan 8)

### Monitoring
- [ ] StepTimer output ke log file terstruktur
- [ ] Alert kalau disk < 50GB free
- [ ] Alert kalau job gagal > 3x berturut-turut
- [ ] Dashboard untuk melihat job queue dan step timings

### Testing
- [ ] Unit test per step (bisa jalan tanpa internet)
- [ ] Integration test dengan video pendek (< 2 menit)
- [ ] Load test: 4 concurrent jobs, 15 menit video
- [ ] Failure test: Gemini down → pipeline fallback dengan benar
- [ ] Disk full test: pipeline tolak job baru dengan benar

---

## Catatan Akhir

Pipeline ini sudah di arah yang benar. Fondasi arsitekturnya solid: config-driven, environment-aware, step-based dengan timing. Yang perlu dibenahi adalah **robustness** (error handling, retry, cleanup) dan **kalibrasi resource** (concurrent jobs, VRAM budget).

Prioritas tertinggi sebelum production:
1. Cleanup di `finally` block
2. Gemini retry + rate limit
3. Resource check pre-job
4. Fix angka concurrency yang realistis
5. NVIDIA driver reboot

Setelah itu pipeline sudah bisa jalan di production dengan aman.

---

*Dokumen ini: Pipeline v0.3 Analysis — Generated from v0.2 + AI Reframe Update*
*Hardware ref: MacBook Air M1 (8GB, 11GB free) + Server i7-13700K / RTX 3070 (62GB RAM)*