# About — Jawaban Pertanyaan

---

## 1. Workflow Automation yang Pernah Saya Build dan Masih Aktif Dipakai

**Project: AutoCliper v2 — Automated YouTube to Short-Form Content Pipeline**

**Tools yang digunakan:**
- Python (FastAPI) sebagai backend orchestrator
- Google Gemini AI untuk analisis konten dan pemilihan clip viral
- OpenAI Whisper untuk transcription dan word-level timestamp
- FFmpeg untuk video processing (cutting, captioning, overlay)
- YOLOv8 untuk person tracking (smart framing 9:16)
- React + Tailwind CSS untuk dashboard frontend
- MySQL untuk data persistence
- Server-Sent Events (SSE) untuk real-time progress monitoring

**Proses bisnis yang diotomasi:**
Sebelumnya, content creator harus menonton video panjang (30-120 menit), manually memilih momen viral, cut video, tambah caption satu-satu, dan render. Proses ini memakan 3-5 jam per video.

Dengan AutoCliper v2, user cukup paste YouTube URL → AI menganalisis seluruh konten → otomatis memilih 3-5 momen paling viral berdasarkan engagement score → generate clip 9:16 dengan animated captions dan hook overlay → output siap upload ke TikTok/Reels/Shorts.

**Dampak terukur:**
- Waktu produksi: dari 3-5 jam → 10-15 menit (otomatis)
- Output per hari: dari 2-3 clip manual → 15-20 clip otomatis
- Konsistensi kualitas caption dan framing 100% (tidak ada human error)
- Sistem masih aktif dipakai setiap hari untuk produksi konten short-form

---

## 2. Sistem Otomasi Lead Qualification via WhatsApp

**Pendekatan saya — mulai dari mana:**

### Step 1: Mapping Flow & Kriteria Kualifikasi
Pertama saya akan duduk dengan tim sales untuk define:
- Kriteria lead scoring (budget, timeline, kebutuhan, company size)
- Kategori output (Hot/Warm/Cold atau A/B/C)
- Format brief yang dibutuhkan sales
- SLA response time yang diharapkan

### Step 2: Tech Stack yang Saya Pilih

| Layer | Tool | Alasan |
|-------|------|--------|
| WhatsApp Gateway | **Fonnte API** atau **WhatsApp Business API (via 360dialog/Wati)** | Reliable, official, webhook support |
| Orchestrator | **n8n** (self-hosted) atau **Make.com** | Visual workflow, easy to maintain, webhook trigger |
| AI Screening | **OpenAI GPT-4o-mini** via API | Cost-effective, fast, excellent di Bahasa Indonesia |
| Database | **Airtable** atau **Google Sheets** (awal) → **Supabase** (scale) | Quick setup, tim sales bisa lihat langsung |
| Notification ke Sales | **WhatsApp Group** atau **Slack** dengan brief terformat | Instant, familiar |

### Step 3: Flow Arsitektur

```
Lead kirim WA → Webhook trigger n8n →
  → AI extract info (nama, kebutuhan, budget, timeline)
  → AI scoring & kategorisasi (Hot/Warm/Cold)
  → Simpan ke database
  → IF Hot: langsung forward ke sales + brief
  → IF Warm: auto-reply "tim kami akan hubungi dalam 1 jam"
  → IF Cold: auto-reply nurturing + masuk drip sequence
```

### Step 4: AI Prompt Engineering
Saya akan craft prompt yang:
- Extract structured data dari percakapan natural bahasa Indonesia
- Scoring berdasarkan BANT (Budget, Authority, Need, Timeline)
- Generate brief 3-4 baris untuk sales (siapa, mau apa, budget range, urgency)

### Step 5: Iterasi
- Week 1: MVP dengan n8n + GPT + Google Sheets
- Week 2: Monitor accuracy, tune prompt berdasarkan feedback sales
- Week 3: Tambah edge cases, multi-turn conversation handling
- Week 4: Dashboard reporting (conversion rate per kategori)

**Kenapa pendekatan ini:**
- Bisa live dalam 2-3 hari (MVP)
- Non-technical team bisa maintain (n8n visual)
- Scalable — tinggal ganti Sheets ke proper DB kalau volume naik
- AI-first tapi dengan human-in-the-loop untuk Hot leads

---

## 3. Ekspektasi Gaji & Ketersediaan

**Ekspektasi gaji:** Rp 7.000.000 - 9.000.000 / bulan (take home)

Negotiable tergantung:
- Scope pekerjaan dan kompleksitas project
- Benefit lain (remote flexibility, tools/subscription budget, bonus performance)
- Growth opportunity dan learning budget

**Ketersediaan:** Bisa mulai **segera** (within 1 minggu setelah deal).

---

*Dokumen ini dibuat sebagai jawaban atas pertanyaan rekrutmen. Semua project dan pengalaman yang disebutkan adalah nyata dan dapat didemonstrasikan.*
