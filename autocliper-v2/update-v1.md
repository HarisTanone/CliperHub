# Update v1 — Ubah Analisis AI: YouTube Captions → Whisper C++ Transcript

## Ringkasan Perubahan

Mengganti sumber teks untuk analisis Gemini AI dari YouTube captions (tidak akurat, auto-generated) ke Whisper C++ transcript (akurat, word-level timestamps). Subtitle per-clip tetap menggunakan Whisper per-clip seperti sekarang.

---

## ⚠️ Trade-off yang Harus Diketahui

| Aspek | Sebelum (YouTube Captions) | Sesudah (Whisper Full Video) |
|---|---|---|
| Waktu analisis | < 1 detik | 5–15 menit (video 1 jam) |
| Akurasi teks | Rendah (auto-generated) | Tinggi (Whisper medium) |
| Video tanpa vokal | Masih ada teks (manual uploader) | Transkrip kosong → fallback |
| Cache | Tidak ada | JSON di-cache, tidak ulang |

---

## File yang Diubah

### 1. `src/infrastructure/video_processor.py`

**Apa yang diubah:** Tambah method baru `transcribe_full_video()` ke class `WhisperService`.

**Kondisi saat ini:**
- `WhisperService` hanya punya `generate_subtitles(audio_path)` — menerima path audio WAV yang sudah diekstrak
- Tidak ada method untuk transkripsi video penuh ke format teks dengan timestamp

**Yang ditambahkan:**
```
WhisperService.transcribe_full_video(video_path: str) -> str
```

- Input: path video MP4 (full video, bukan clip)
- Proses:
  1. Cek cache — jika `{video_dir}/full_transcript.json` sudah ada, langsung parse
  2. Ekstrak audio full video → WAV 16kHz mono ke path temp (`{video_dir}/full_audio.wav`) menggunakan `AudioExtractor` yang sudah ada
  3. Jalankan Whisper C++ dengan flag `-oj -ojf` → hasilkan `full_audio.json`
  4. Parse JSON → format menjadi string transcript dengan timestamp per segment
- Output: string format:
  ```
  [0.0s - 5.2s] Halo semuanya, hari ini kita akan membahas...
  [5.2s - 10.8s] Topik yang sangat penting yaitu...
  ```
- Cache: simpan formatted transcript ke `{video_dir}/full_transcript.json` agar tidak ulang jika reprocess

**Lokasi perubahan di file:**
- Tambah method setelah `generate_subtitles()` di class `WhisperService` (sekitar line 130)
- Tidak mengubah method yang sudah ada

---

### 2. `src/infrastructure/external_services.py`

**Apa yang diubah:** Ubah signature dan implementasi `analyze_youtube_content()` di class `GeminiService`.

**Kondisi saat ini:**
```python
def analyze_youtube_content(self, youtube_url: str, video_info: VideoInfo) -> List[ClipData]:
    transcript = self._get_youtube_captions(video_id)   # ← sumber utama
    metadata = self._get_youtube_metadata(video_id)
    ...
```

**Yang diubah:**
```python
def analyze_youtube_content(self, youtube_url: str, video_info: VideoInfo, whisper_transcript: str = "") -> List[ClipData]:
    metadata = self._get_youtube_metadata(video_id)     # tetap diambil (konteks AI)
    # whisper_transcript dipakai sebagai sumber teks utama
    # _get_youtube_captions() tidak dihapus, hanya tidak dipanggil di sini
    ...
```

- Parameter baru: `whisper_transcript: str = ""` (default kosong untuk backward compatibility)
- Jika `whisper_transcript` tidak kosong → pakai sebagai sumber teks di prompt
- Jika `whisper_transcript` kosong → fallback ke `_get_youtube_captions()` (behavior lama)
- Label di prompt diubah dari `YOUTUBE CAPTIONS:` → `WHISPER TRANSCRIPT:` saat pakai Whisper
- `_get_youtube_captions()` tetap ada di file, tidak dihapus

**Lokasi perubahan di file:**
- Ubah signature `analyze_youtube_content()` di line ~130
- Ubah blok `content = f"""..."""` di dalam method tersebut
- Tidak ada perubahan di method lain

---

### 3. `src/application/services.py`

**Apa yang diubah:** Ubah Step 4 di method `process_job()` di class `VideoProcessingPipeline`.

**Kondisi saat ini (Step 4, sekitar line 155):**
```python
# Step 4: Get YouTube captions + metadata for AI analysis
logger.info("Step 4: Getting YouTube captions + metadata for AI analysis")
self._update_status(ProcessingState.ANALYZING, "Getting YouTube captions")
job_logger.log("Fetching YouTube captions and metadata", "analyzing_content")

clips = self.gemini_service.analyze_youtube_content(job_request.urls, video_info)
```

**Yang diubah menjadi:**
```python
# Step 4: Transcribe full video with Whisper → AI analysis
logger.info("Step 4: Transcribing full video with Whisper C++ for AI analysis")
self._update_status(ProcessingState.ANALYZING, "Transcribing full video with Whisper C++")
job_logger.log("Transcribing full video with Whisper C++...", "analyzing_content")

whisper_transcript = self.whisper_service.transcribe_full_video(video_info.filepath)
logger.info(f"Whisper transcript ready: {len(whisper_transcript)} chars")
job_logger.log(f"Whisper transcript ready ({len(whisper_transcript)} chars), sending to Gemini AI")

clips = self.gemini_service.analyze_youtube_content(job_request.urls, video_info, whisper_transcript)
```

**Lokasi perubahan di file:**
- Hanya blok Step 4 (~5 baris) yang diubah
- Tidak ada perubahan di Step 1–3 dan Step 5–8

---

## Alur Baru Setelah Update

```
Download video
    ↓
[BARU] Ekstrak audio full video → WAV 16kHz mono
    ↓
[BARU] Whisper C++ medium → JSON → formatted transcript string
    ↓
[DIUBAH] Gemini AI menerima Whisper transcript (bukan YouTube captions)
    ↓
Proses clip (tidak berubah):
    ├─ Potong segmen
    ├─ Ekstrak audio clip
    ├─ Whisper per-clip → subtitle (tidak berubah)
    ├─ Face tracking
    └─ Render hook + subtitle
```

---

## Caching Strategy

| File Cache | Lokasi | Kapan Dibuat | Kapan Dipakai |
|---|---|---|---|
| `full_audio.wav` | `{video_dir}/full_audio.wav` | Saat transkripsi pertama | Dihapus setelah JSON dibuat |
| `full_transcript.json` | `{video_dir}/full_transcript.json` | Saat transkripsi pertama | Reuse saat reprocess |

`_cleanup_for_reprocess()` di `services.py` sudah menjaga file `.json` (line: `if item == "original.mp4" or item.endswith(".json"): continue`) — jadi cache transcript otomatis terjaga saat reprocess.

---

## Verification Plan

```bash
# 1. Cek syntax semua file yang diubah
python3 -c "from src.infrastructure.video_processor import WhisperService; print('✅ video_processor OK')"
python3 -c "from src.infrastructure.external_services import GeminiService; print('✅ external_services OK')"
python3 -c "from src.application.services import VideoProcessingPipeline; print('✅ services OK')"

# 2. Jalankan server
python3 main.py

# 3. Submit job baru dan pantau log
tail -f autocliper.log | grep -E "(Transcribing|Whisper transcript|Gemini)"
```

**Yang harus terlihat di log:**
```
Step 4: Transcribing full video with Whisper C++ for AI analysis
Transcribing full video with Whisper C++...
Whisper transcript ready: XXXX chars, sending to Gemini AI
✅ Gemini analysis successful!
```

---

## Tidak Ada Perubahan Di

- `src/domain/entities.py` — tidak perlu
- `src/domain/interfaces.py` — tidak perlu
- `src/infrastructure/repositories.py` — tidak perlu
- `src/infrastructure/yolo_deepsort_tracker.py` — tidak perlu
- `src/infrastructure/overlay_renderer.py` — tidak perlu
- `src/infrastructure/job_queue.py` — tidak perlu
- `src/presentation/api.py` — tidak perlu
- `database/init.sql` — tidak perlu
- `requirements.txt` — tidak perlu (Whisper C++ sudah dipakai)
