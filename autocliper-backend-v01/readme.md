# YouTube Clip Generator — Dokumentasi Arsitektur


## Ringkasan Sistem

Sistem ini secara otomatis mengubah video YouTube panjang menjadi klip pendek yang menarik, dilengkapi subtitle animasi dan hook text. Terdiri dari tiga komponen utama yang berkomunikasi lewat Google Drive sebagai antrian job.

Komponen:
- Server Lokal — menerima input URL, mendownload audio, mengupload ke Drive, dan merender video akhir
- Google Drive Queue — menjadi perantara antara server lokal dan worker Colab
- Google Colab Worker — menjalankan transkripsi Whisper dan analisis Gemini


---


## Flowchart Arsitektur Keseluruhan

```
[User Input URL]
      |
      v
[Server Lokal]
  yt-dlp download → FFmpeg extract audio → Generate Job ID → Upload ke Google Drive input/
      |
      v
[Google Drive Queue]
  input/ → processing/ → results/ → completed/
      |
      v
[Google Colab Worker]
  Load Model → Polling input/ → Transcribe Whisper → 4x Gemini Tasks → Simpan JSON ke results/
      |
      v
[Server Lokal]
  Polling done file → Download JSON → FFmpeg Trim → Render Subtitle + Hook → Output MP4
```


---


## Alur Detail Per Komponen


### Server Lokal — Input & Download

```
[User Input]
  YouTube URL
      |
      v
[yt-dlp]
  Download video.mp4
      |
      v
[FFmpeg]
  Extract audio → audio.m4a
      |
      v
[Generate Job ID]
  Contoh: job_abc123
      |
      v
[Upload ke Google Drive]
  Simpan ke → input/job_abc123.m4a
      |
      v
[Polling]
  Tunggu completed/job_abc123.done
```


### Google Drive — Struktur Folder Queue

```
input/
├── job_abc123.m4a          ← file baru masuk dari server lokal

processing/
├── job_abc123.m4a          ← sedang diproses worker
├── job_abc123.lock         ← file lock agar tidak diambil worker lain

results/
├── job_abc123.json         ← output analisis Gemini

completed/
├── job_abc123.done         ← sinyal bahwa job selesai

failed/
├── job_abc123.error        ← job yang gagal beserta pesan error
```


### Google Colab Worker — Transkripsi & Analisis

```
[Start Notebook]
      |
      v
[Load Model]
  Faster-Whisper Medium
  Gemini 2.5 Flash Client
      |
      v
[Loop Forever]
  Cek folder input/ setiap 15 detik
      |
      v
[File ditemukan?]
  TIDAK → sleep 15 detik → kembali ke loop
  YA → lanjut ke bawah
      |
      v
[Cek file .lock]
  Ada .lock → skip, ambil file lain
  Tidak ada → tulis .lock → pindahkan ke processing/
      |
      v
[Checkpoint ada?]
  YA → load transcript dari checkpoint, skip transkripsi
  TIDAK → jalankan Faster-Whisper
      |
      v
[Transkripsi Audio]
  Faster-Whisper → word-level timestamps
  Simpan checkpoint/job_abc123_transcript.json
      |
      v
[Kirim ke Gemini]
      |
      +---------------------------+
      |                           |
      v                           v
[Task #1]                    [Task #2]
Candidate Detection          Clip Ranking
Cari momen menarik           Score 1–100
  retry 3x jika gagal          retry 3x jika gagal
      |                           |
      +---------------------------+
                  |
                  v
            [Task #3]
          Hook Generation
          retry 3x jika gagal
                  |
                  v
            [Task #4]
       Highlight Word Detection
       retry 3x jika gagal
                  |
                  v
      [Validasi Output JSON]
      Cek semua field wajib ada
      Cek start < end untuk setiap clip
                  |
             +----+----+
             |         |
           VALID     INVALID
             |         |
             v         v
      [Simpan JSON]  [Simpan ke failed/]
      results/       job_abc123.error
      job_abc123     Catat pesan error
      .json
             |
             v
      [Tulis completed/job_abc123.done]
             |
             v
      [Hapus processing/ dan .lock]
      [Hapus checkpoint/]
```


### Server Lokal — Rendering Video

```
[Polling Google Drive]
  Cek setiap 15 detik, timeout 30 menit
      |
      v
[Timeout tercapai?]
  YA → tandai job failed → notif user → berhenti
  TIDAK → lanjut cek
      |
      v
[job_abc123.done ditemukan]
      |
      v
[Download job_abc123.json]
      |
      v
[Validasi Semua Timestamp]
  Pastikan start < end untuk tiap clip
  Pastikan timestamp tidak melebihi durasi video
  Clip tidak valid → skip + catat di log
      |
      v
[Buat Output Folder]
  final/job_abc123/
      |
      v
[Render Paralel — 3 clip sekaligus]
  Thread Pool: clip_01, clip_02, clip_03 → selesai → clip_04, clip_05, clip_06 → dst
      |
      v
[Per Clip:]
  FFmpeg Trim → Render Subtitle Overlay → Render Hook Overlay → clip_N_final.mp4
  Berhasil → catat status OK
  Gagal    → catat status FAILED, lanjut ke clip berikutnya
      |
      v
[Output]
  final/job_abc123/
  ├── clip_01.mp4
  ├── clip_02.mp4
  ├── clip_03.mp4
  └── clip_10.mp4
      |
      v
[Notif ke User]
  Selesai: N clip berhasil, M clip gagal
  Tampilkan daftar clip yang gagal jika ada
```


---


## Format JSON Output

```json
{
  "version": "1.0",
  "video_id": "abc123",
  "language": "id",
  "error": null,
  "clips": [
    {
      "rank": 1,
      "score": 98,
      "start": 120.4,
      "end": 180.8,
      "hook": "Saya hampir menyerah saat bisnis ini gagal",
      "reason": "strong emotional story",
      "subtitles": [
        {
          "start": 122.1,
          "end": 124.8,
          "text": "Tetapi saya TERPAKSA menjual semua aset",
          "words": [
            { "word": "Tetapi",   "start": 122.1, "end": 122.4, "highlight": false },
            { "word": "saya",     "start": 122.4, "end": 122.7, "highlight": false },
            { "word": "TERPAKSA", "start": 122.7, "end": 123.2, "highlight": true  },
            { "word": "menjual",  "start": 123.2, "end": 123.7, "highlight": false },
            { "word": "semua",    "start": 123.7, "end": 124.1, "highlight": false },
            { "word": "aset",     "start": 124.1, "end": 124.8, "highlight": false }
          ]
        }
      ]
    }
  ]
}
```

Catatan field:
- `version` — versi format JSON untuk kompatibilitas ke depan
- `error` — diisi pesan error jika proses gagal sebagian, bernilai null jika sukses
- `score` — nilai 1–100 dari Gemini untuk menentukan urutan ranking
- `hook` — kalimat pembuka yang ditampilkan di awal clip
- `reason` — alasan Gemini memilih segmen ini sebagai momen menarik
- `highlight` — selalu ada di setiap word, bernilai `true` atau `false`


---


## Masalah, Penyebab & Solusi Lengkap


### 1. Server Lokal — Input & Download


MASALAH: Tidak ada validasi URL

Penyebab: Input langsung diteruskan ke yt-dlp tanpa pengecekan format atau domain.
Dampak: URL salah, URL bukan YouTube, atau URL private akan menyebabkan yt-dlp crash di tengah proses.

Solusi:
Sebelum menjalankan yt-dlp, jalankan pengecekan awal:

```
[Terima URL dari user]
      |
      v
[Cek format URL]
  Apakah mengandung youtube.com/watch?v= atau youtu.be/ ?
  TIDAK → tampilkan pesan error → minta user input ulang → berhenti
  YA → lanjut
      |
      v
[Cek ketersediaan video]
  Gunakan yt-dlp --no-download --print duration
  Jika error "Video unavailable" atau "Private video" → berhenti + notif user
  Jika berhasil → simpan durasi untuk pengecekan berikutnya
```

Implementasi di Python:
```python
import re, subprocess

def validate_youtube_url(url):
    pattern = r'(youtube\.com/watch\?v=|youtu\.be/)[\w-]+'
    if not re.search(pattern, url):
        raise ValueError("URL bukan YouTube yang valid")

def get_video_duration(url):
    result = subprocess.run(
        ["yt-dlp", "--no-download", "--print", "duration", url],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        raise ValueError("Video tidak tersedia atau bersifat private")
    return float(result.stdout.strip())
```


---

MASALAH: Tidak ada batas durasi video

Penyebab: Tidak ada pengecekan panjang video sebelum download.
Dampak: Video berdurasi 3–5 jam akan didownload penuh, menghabiskan bandwidth, storage, dan waktu tanpa peringatan.

Solusi:
Gunakan durasi yang sudah diambil saat validasi, lalu bandingkan dengan batas maksimal:

```
[Durasi video didapat dari yt-dlp]
      |
      v
[Durasi > 3600 detik (60 menit)?]
  YA → tampilkan pesan "Video terlalu panjang (X menit). Maksimal 60 menit."
       → berhenti
  TIDAK → lanjut ke download
```

Implementasi di Python:
```python
MAX_DURATION_SECONDS = 3600  # 60 menit

def check_duration(duration_seconds):
    if duration_seconds > MAX_DURATION_SECONDS:
        menit = int(duration_seconds // 60)
        raise ValueError(f"Video terlalu panjang ({menit} menit). Maksimal 60 menit.")
```


---

MASALAH: File lokal tidak dibersihkan jika upload ke Drive gagal

Penyebab: Tidak ada mekanisme cleanup — jika upload gagal, video.mp4 dan audio.m4a tetap tersimpan di disk.
Dampak: Disk penuh secara perlahan setelah banyak job gagal.

Solusi:
Gunakan try/finally untuk memastikan cleanup selalu berjalan:

```
[Download & extract audio]
      |
      v
[Coba upload ke Google Drive]
  Berhasil → lanjut ke polling → FINALLY: hapus video.mp4 + audio.m4a
  Gagal    → catat error → notif user → FINALLY: hapus video.mp4 + audio.m4a
```

Implementasi di Python:
```python
import os

def process_job(url):
    video_path = "video.mp4"
    audio_path = "audio.m4a"
    try:
        download_video(url, video_path)
        extract_audio(video_path, audio_path)
        upload_to_drive(audio_path)
    except Exception as e:
        print(f"Job gagal: {e}")
        raise
    finally:
        # Selalu bersihkan file lokal, berhasil maupun gagal
        for f in [video_path, audio_path]:
            if os.path.exists(f):
                os.remove(f)
```


---

MASALAH: Tidak ada timeout pada yt-dlp dan FFmpeg

Penyebab: Proses subprocess dijalankan tanpa batas waktu.
Dampak: Koneksi lambat atau file korup bisa membuat proses hang tanpa batas — seluruh sistem berhenti menunggu.

Solusi:
Set timeout pada setiap subprocess call, dan tangkap TimeoutExpired:

```python
import subprocess

def download_video(url, output_path):
    try:
        subprocess.run(
            ["yt-dlp", "-o", output_path, url],
            timeout=600,  # 10 menit maksimal
            check=True
        )
    except subprocess.TimeoutExpired:
        raise TimeoutError("Download timeout setelah 10 menit")

def extract_audio(video_path, audio_path):
    try:
        subprocess.run(
            ["ffmpeg", "-i", video_path, "-vn", audio_path],
            timeout=120,  # 2 menit maksimal
            check=True
        )
    except subprocess.TimeoutExpired:
        raise TimeoutError("Ekstraksi audio timeout setelah 2 menit")
```


---


### 2. Google Drive — Queue System


MASALAH: Race condition — dua worker bisa mengambil file yang sama

Penyebab: Tidak ada mekanisme locking. Worker hanya memindahkan file dari input/ ke processing/, tapi jika dua worker cek folder input/ di waktu yang hampir bersamaan, keduanya melihat file yang sama sebelum salah satu sempat memindahkannya.
Dampak: File diproses dua kali, menghasilkan duplikat output dan pemborosan API Gemini.

Solusi:
Gunakan file `.lock` sebagai penanda kepemilikan. Worker yang berhasil membuat `.lock` lebih dulu yang mengambil job:

```
[Worker cek folder input/]
      |
      v
[File ditemukan: job_abc123.m4a]
      |
      v
[Coba buat file input/job_abc123.lock]
  Sudah ada .lock → file sedang diambil worker lain → skip, cek file lain
  Berhasil buat .lock → lanjut
      |
      v
[Pindahkan .m4a ke processing/]
[Pindahkan .lock ke processing/]
      |
      v
[Proses job...]
```

Implementasi di Python (Google Drive API):
```python
def try_acquire_job(drive_service, file_id, filename):
    lock_name = filename.replace(".m4a", ".lock")
    # Cek apakah .lock sudah ada
    existing = search_file(drive_service, lock_name, folder="input")
    if existing:
        return False  # Worker lain sudah mengambil
    # Buat file .lock
    create_file(drive_service, lock_name, folder="input", content=str(time.time()))
    return True
```


---

MASALAH: Server lokal bisa stuck selamanya menunggu .done

Penyebab: Jika worker crash setelah menulis results/job_abc123.json tapi sebelum menulis completed/job_abc123.done, server lokal tidak pernah tahu job sudah selesai.
Dampak: Proses polling berjalan terus tanpa batas.

Solusi:
Tambahkan timeout polling di server lokal. Jika dalam 30 menit tidak ada .done, anggap job gagal:

```
[Mulai polling]
  Catat waktu mulai: start_time = now()
      |
      v
[Loop: cek completed/job_abc123.done setiap 15 detik]
      |
      v
[.done ditemukan?]
  YA → lanjut download JSON
  TIDAK → cek elapsed time
      |
      v
[now() - start_time > 30 menit?]
  YA → log "Job timeout" → notif user → berhenti
  TIDAK → sleep 15 detik → ulangi loop
```

Implementasi di Python:
```python
import time

def poll_for_result(job_id, timeout_minutes=30):
    start = time.time()
    while True:
        if check_file_exists(f"completed/{job_id}.done"):
            return True
        elapsed = (time.time() - start) / 60
        if elapsed > timeout_minutes:
            raise TimeoutError(f"Job {job_id} timeout setelah {timeout_minutes} menit")
        time.sleep(15)
```


---

MASALAH: File gagal di processing/ tidak pernah kembali

Penyebab: Tidak ada watchdog yang memantau file yang terlalu lama di processing/.
Dampak: Job yang gagal di tengah proses menggantung di processing/ selamanya.

Solusi:
Tambahkan metadata timestamp di dalam file `.lock`, lalu buat watchdog yang memindahkan file lama kembali ke input/:

```
[Setiap kali worker membuat .lock]
  Isi .lock dengan: { "worker_id": "...", "started_at": "2024-01-01T10:00:00" }

[Watchdog — jalankan setiap 5 menit]
  Scan semua file di processing/
      |
      v
  [Untuk setiap .lock]
    Baca started_at
    Sudah > 45 menit?
    YA → pindahkan kembali ke input/ → hapus .lock lama
    TIDAK → biarkan
```


---

MASALAH: Folder completed/ terus membesar

Penyebab: File .done tidak pernah dihapus setelah server lokal selesai mengunduh hasilnya.
Dampak: Akumulasi file yang tidak berguna menghabiskan storage Google Drive.

Solusi:
Server lokal menghapus file .done setelah berhasil mengunduh JSON. Tambahkan juga cleanup terjadwal untuk file yang lebih dari 7 hari:

```python
def cleanup_after_download(job_id, drive_service):
    # Hapus .done setelah JSON berhasil didownload
    delete_file(drive_service, f"completed/{job_id}.done")
    delete_file(drive_service, f"results/{job_id}.json")

# Jalankan sekali sehari
def cleanup_old_files(drive_service, max_age_days=7):
    for folder in ["completed", "results", "failed"]:
        files = list_files_older_than(drive_service, folder, days=max_age_days)
        for f in files:
            delete_file(drive_service, f)
```


---


### 3. Google Colab Worker — Transkripsi & Analisis


MASALAH: Colab bisa mati di tengah job tanpa pemulihan

Penyebab: Google Colab memiliki batas waktu sesi dan bisa disconnect kapan saja.
Dampak: Job hilang, audio sudah di processing/ tapi tidak pernah selesai.

Solusi:
Simpan checkpoint setelah setiap tahap berat. Saat worker restart, cek checkpoint terlebih dahulu:

```
[Worker mulai memproses job_abc123]
      |
      v
[Cek checkpoint/job_abc123_transcript.json]
  Ada → load transcript dari checkpoint, skip transkripsi Whisper
  Tidak ada → jalankan Whisper → simpan hasil ke checkpoint/
      |
      v
[Proses Gemini...]
  Selesai Task #1 → simpan checkpoint/job_abc123_task1.json
  Selesai Task #2 → simpan checkpoint/job_abc123_task2.json
  dst.
      |
      v
[Job selesai → hapus semua checkpoint]
```

Implementasi di Python:
```python
import json, os

def load_or_run_transcription(audio_path, job_id):
    checkpoint_path = f"checkpoint/{job_id}_transcript.json"
    if os.path.exists(checkpoint_path):
        print(f"[{job_id}] Memuat checkpoint transkripsi...")
        with open(checkpoint_path) as f:
            return json.load(f)
    # Tidak ada checkpoint, jalankan Whisper
    result = transcribe_with_whisper(audio_path)
    os.makedirs("checkpoint", exist_ok=True)
    with open(checkpoint_path, "w") as f:
        json.dump(result, f)
    return result
```


---

MASALAH: Gemini API call gagal tanpa retry

Penyebab: Setiap task Gemini dipanggil sekali saja tanpa penanganan error.
Dampak: Rate limit, timeout jaringan, atau respons kosong dari Gemini akan menggagalkan seluruh job.

Solusi:
Bungkus setiap Gemini task dengan fungsi retry yang menunggu makin lama setiap percobaan (exponential backoff):

```
[Panggil Gemini Task]
      |
      v
[Berhasil?]
  YA → lanjut
  TIDAK → tunggu 5 detik → coba lagi
      |
      v
[Percobaan ke-2 berhasil?]
  YA → lanjut
  TIDAK → tunggu 15 detik → coba lagi
      |
      v
[Percobaan ke-3 berhasil?]
  YA → lanjut
  TIDAK → log error → pindahkan job ke failed/ → berhenti
```

Implementasi di Python:
```python
import time

def call_gemini_with_retry(prompt, max_retries=3):
    delays = [5, 15, 30]  # detik antar percobaan
    for attempt in range(max_retries):
        try:
            response = gemini_client.generate(prompt)
            if response and response.text:
                return response.text
            raise ValueError("Respons Gemini kosong")
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Percobaan {attempt+1} gagal: {e}. Retry dalam {delays[attempt]}s...")
                time.sleep(delays[attempt])
            else:
                raise RuntimeError(f"Gemini gagal setelah {max_retries} percobaan: {e}")
```


---

MASALAH: Tidak ada validasi output Gemini

Penyebab: Hasil teks dari Gemini langsung disimpan sebagai JSON tanpa pengecekan.
Dampak: Jika Gemini mengembalikan teks tidak valid, JSON rusak, atau field hilang, server lokal akan crash saat membaca file.

Solusi:
Validasi output sebelum disimpan. Jika tidak valid, simpan ke folder failed/:

```python
REQUIRED_CLIP_FIELDS = ["rank", "score", "start", "end", "hook", "reason", "subtitles"]

def validate_output(data, video_duration):
    if "clips" not in data:
        raise ValueError("Field 'clips' tidak ditemukan")
    for i, clip in enumerate(data["clips"]):
        for field in REQUIRED_CLIP_FIELDS:
            if field not in clip:
                raise ValueError(f"Clip #{i+1} tidak memiliki field '{field}'")
        if clip["start"] >= clip["end"]:
            raise ValueError(f"Clip #{i+1}: start >= end ({clip['start']} >= {clip['end']})")
        if clip["end"] > video_duration:
            raise ValueError(f"Clip #{i+1}: end ({clip['end']}) melebihi durasi video ({video_duration})")
        for word in (w for s in clip["subtitles"] for w in s["words"]):
            if "highlight" not in word:
                word["highlight"] = False  # auto-isi jika tidak ada
```


---

MASALAH: Polling busy loop menguras Google Drive API quota

Penyebab: Loop cek folder input/ berjalan tanpa jeda.
Dampak: Google Drive API memiliki quota harian. Loop tanpa sleep bisa menghabiskan quota dalam hitungan jam, menyebabkan seluruh sistem berhenti dengan error 429.

Solusi:
Tambahkan sleep interval. Gunakan interval lebih panjang saat folder input/ kosong:

```python
import time

SLEEP_EMPTY = 15    # detik jika tidak ada job
SLEEP_BETWEEN = 3   # detik antar pengecekan file dalam batch

while True:
    jobs = list_files_in_folder(drive_service, "input", extension=".m4a")
    if not jobs:
        time.sleep(SLEEP_EMPTY)
        continue
    for job_file in jobs:
        process_job(job_file)
        time.sleep(SLEEP_BETWEEN)
```


---


### 4. JSON Output — Struktur Data


MASALAH: Field highlight tidak konsisten

Penyebab: Gemini hanya menambahkan field `highlight: true` pada kata yang perlu di-highlight, dan menghilangkan field tersebut untuk kata biasa.
Dampak: Server lokal harus selalu menggunakan `.get("highlight", False)` alih-alih `word["highlight"]`. Jika lupa, KeyError crash.

Solusi:
Normalisasi seluruh output Gemini sebelum disimpan. Pastikan setiap word selalu punya field highlight:

```python
def normalize_highlights(clips):
    for clip in clips:
        for subtitle in clip["subtitles"]:
            for word in subtitle["words"]:
                if "highlight" not in word:
                    word["highlight"] = False
    return clips
```


---

MASALAH: Tidak ada versioning format JSON

Penyebab: Format JSON tidak memiliki identifier versi.
Dampak: Jika format berubah di masa depan (tambah/hapus field), server lokal lama tidak tahu dan akan crash saat parsing.

Solusi:
Tambahkan field `version` di root JSON. Server lokal membaca versi ini sebelum parsing:

```python
# Di worker Colab saat membuat JSON
output = {
    "version": "1.0",
    "video_id": job_id,
    "language": detected_language,
    "error": None,
    "clips": clips
}

# Di server lokal saat membaca JSON
SUPPORTED_VERSIONS = ["1.0"]

def load_result(json_path):
    with open(json_path) as f:
        data = json.load(f)
    if data.get("version") not in SUPPORTED_VERSIONS:
        raise ValueError(f"Format JSON versi {data.get('version')} tidak didukung")
    return data
```


---

MASALAH: Tidak ada field error untuk kegagalan parsial

Penyebab: JSON tidak memiliki field untuk melaporkan kegagalan yang terjadi di tengah proses.
Dampak: Jika Gemini berhasil menganalisis tapi hanya menghasilkan 3 clip alih-alih 10, server lokal tidak tahu apakah ini memang hasilnya atau ada yang gagal.

Solusi:
Tambahkan field `error` dan `warnings` di root JSON:

```json
{
  "version": "1.0",
  "video_id": "abc123",
  "language": "id",
  "error": null,
  "warnings": [
    "Task #2 gagal pada percobaan pertama, berhasil di percobaan ke-2",
    "Hanya 6 clip ditemukan (target: 10)"
  ],
  "clips": [...]
}
```


---


### 5. Server Lokal — Rendering Video


MASALAH: Rendering 10 clip dilakukan sekuensial

Penyebab: Clip dirender satu per satu dalam loop biasa.
Dampak: Untuk 10 clip dengan durasi masing-masing 1 menit, total render bisa memakan waktu 30–60 menit tergantung spesifikasi mesin.

Solusi:
Gunakan ThreadPoolExecutor untuk merender beberapa clip sekaligus:

```
[Download JSON]
      |
      v
[Buat daftar semua clip yang valid]
      |
      v
[ThreadPoolExecutor — max 3 worker]
  Worker 1: render clip_01
  Worker 2: render clip_02
  Worker 3: render clip_03
      |
      v (setelah ketiganya selesai)
  Worker 1: render clip_04
  Worker 2: render clip_05
  Worker 3: render clip_06
      |
      v (dst. sampai semua clip selesai)
```

Implementasi di Python:
```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def render_all_clips(clips, output_dir, max_workers=3):
    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(render_single_clip, clip, output_dir): clip["rank"]
            for clip in clips
        }
        for future in as_completed(futures):
            rank = futures[future]
            try:
                output_path = future.result()
                results[rank] = {"status": "ok", "path": output_path}
            except Exception as e:
                results[rank] = {"status": "failed", "error": str(e)}
    return results
```


---

MASALAH: Tidak ada validasi timestamp sebelum render

Penyebab: Timestamp dari JSON langsung dipakai sebagai argumen FFmpeg tanpa pengecekan.
Dampak: `end < start` akan membuat FFmpeg menghasilkan file kosong. Timestamp melebihi durasi video akan menyebabkan FFmpeg error atau clip terpotong di tempat yang salah.

Solusi:
Validasi semua timestamp sebelum memulai rendering. Clip yang tidak valid di-skip dan dicatat:

```python
def validate_clip(clip, video_duration):
    errors = []
    if clip["start"] < 0:
        errors.append(f"start negatif: {clip['start']}")
    if clip["end"] <= clip["start"]:
        errors.append(f"end ({clip['end']}) <= start ({clip['start']})")
    if clip["end"] > video_duration:
        errors.append(f"end ({clip['end']}) melebihi durasi ({video_duration})")
    if clip["end"] - clip["start"] < 5:
        errors.append(f"durasi clip terlalu pendek: {clip['end'] - clip['start']} detik")
    return errors

def filter_valid_clips(clips, video_duration):
    valid, skipped = [], []
    for clip in clips:
        errs = validate_clip(clip, video_duration)
        if errs:
            skipped.append({"rank": clip["rank"], "errors": errs})
        else:
            valid.append(clip)
    if skipped:
        print(f"[SKIP] {len(skipped)} clip dilewati karena timestamp tidak valid:")
        for s in skipped:
            print(f"  Clip #{s['rank']}: {', '.join(s['errors'])}")
    return valid
```


---

MASALAH: Output folder tidak dipisah antar job

Penyebab: Semua clip selalu disimpan ke folder `final/` yang sama.
Dampak: Jika menjalankan 2 job berbeda, clip dari job pertama akan tercampur dengan clip dari job kedua.

Solusi:
Gunakan job ID sebagai nama subfolder:

```python
import os

def get_output_dir(job_id):
    output_dir = os.path.join("final", job_id)
    os.makedirs(output_dir, exist_ok=True)
    return output_dir

# Output akan tersimpan di:
# final/job_abc123/clip_01.mp4
# final/job_abc123/clip_02.mp4
# final/job_xyz789/clip_01.mp4  ← tidak tercampur
```


---


## Prioritas Perbaikan

KRITIS — harus diperbaiki sebelum dipakai:
- Race condition pada Google Drive queue → implementasi file .lock
- Server lokal stuck selamanya → tambahkan timeout polling 30 menit
- Gemini gagal tanpa retry → bungkus semua task dengan retry + exponential backoff
- Timestamp tidak divalidasi → validasi semua clip sebelum render

PENTING — segera setelah sistem berjalan stabil:
- Cleanup file lokal setelah upload → gunakan try/finally
- Validasi output JSON dari Gemini → cek field wajib dan normalize highlight
- Rendering paralel → ThreadPoolExecutor max 3 worker
- Folder failed/ → untuk debugging job yang gagal
- Checkpoint Whisper → agar Colab restart tidak mengulang dari awal

NICE TO HAVE — optimasi jangka panjang:
- Versioning format JSON → field version di root
- Pembersihan otomatis folder completed/ → hapus file > 7 hari
- Progress feedback ke user → log per clip dan ringkasan akhir
- Watchdog untuk file lama di processing/ → kembalikan ke input/ setelah 45 menit