"""GeminiAnalyzer — Single-pass Gemini analysis for clip detection."""
import asyncio
import json
import logging
import re
import time
from typing import Optional

from google import genai

from src.config import settings
from src.domain.interfaces import IGeminiAnalyzer

logger = logging.getLogger(__name__)

RETRY_DELAYS = [5, 15, 30]
MAX_RETRIES = 3


class GeminiAnalyzer(IGeminiAnalyzer):
    def __init__(self):
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self._model = settings.GEMINI_MODEL

    async def analyze(
        self, transcript: dict, video_duration: float, max_clips: int
    ) -> dict:
        """Single-pass Gemini analysis → clip candidates with hooks."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._analyze_sync, transcript, video_duration, max_clips
        )

    def _analyze_sync(
        self, transcript: dict, video_duration: float, max_clips: int
    ) -> dict:
        language = transcript.get("language", "id")
        segments = transcript.get("segments", [])

        # Build transcript text
        transcript_text = "\n".join(
            f"[{seg['start']:.1f} - {seg['end']:.1f}] {seg['text']}"
            for seg in segments
        )

        prompt = f"""Kamu adalah AI analis video viral profesional dan pakar kurasi konten short-form (TikTok, Reels, Shorts). Analisis transcript video ini dan temukan maksimal {max_clips} momen TERBAIK untuk dijadikan klip pendek yang sangat berpotensi FYP.

TRANSCRIPT (format: [start - end] teks):
{transcript_text}

DURASI TOTAL VIDEO: {video_duration:.1f} detik
BAHASA VIDEO: {language}

TUGAS UTAMA:
1. Temukan maksimal {max_clips} momen PALING VIRAL dengan durasi masing-masing klip 45-90 detik.
2. Klip TIDAK BOLEH OVERLAP (saling tumpang tindih) satu sama lain.
3. Urutkan hasil dari skor tertinggi ke terendah.

ATURAN TIMESTAMP & TITIK POTONG (ANTI-CUT):
1. 'start' HARUS diambil tepat pada awal segmen kalimat baru (saat pembicara baru mulai berbicara setelah jeda atau membuka topik baru). Jangan memotong di tengah kalimat yang sedang berjalan.
2. 'end' HARUS diambil tepat saat kalimat atau argumen tersebut selesai secara utuh (di akhir tanda baca titik segmen terakhir). Lebih baik berikan toleransi ekstra 1 detik di akhir daripada kata terakhirnya terpotong nanggung.

KRITERIA DAN SISTEM SCORING:
Berikan nilai total 'score' (1-100) dengan menghitung akumulasi dari:
- Kekuatan emosional atau kalimat tamparan keras (harsh truth).
- Adanya cerita/anekdot personal atau data yang mengejutkan.
- Potensi memicu perdebatan sengit (kontroversi) di kolom komentar.
- Ketajaman struktur cerita (memiliki premis masalah dan konklusi utuh dalam satu klip).

ATURAN HOOK:
- Maksimal 60 karakter.
- Menggunakan Bahasa {language}.
- Harus brutal, singkat, dan bikin jempol berhenti scroll.
- OPEN LOOP: Wajib memicu rasa penasaran dan dilarang memberikan jawaban/spoiler di dalam teks hook.

OUTPUT HARUS BERUPA RAW JSON VALID (Kepatuhan Mutlak):
- JANGAN sertakan teks pengantar, teks penutup, atau penjelasan apa pun.
- JANGAN gunakan pembungkus markdown seperti ```json atau ```.
- Output harus langsung dibuka dengan karakter {{ dan diakhiri dengan }}.

Format struktur JSON:
{{"clips": [{{"rank": 1, "score": <int 1-100>, "start": <float>, "end": <float>, "hook": "<hook text max 60 char>", "reason": "<alasan singkat berbasis psikologi audiens kenapa momen ini viral>"}}]}}"""

        result = self._call_with_retry(prompt)
        return self._parse_response(result)

    def _call_with_retry(self, prompt: str) -> str:
        """Call Gemini with retry."""
        for attempt in range(MAX_RETRIES):
            try:
                response = self._client.models.generate_content(
                    model=self._model,
                    contents=prompt,
                )
                if response and response.text:
                    return response.text
                raise ValueError("Respons Gemini kosong")
            except Exception as e:
                error_str = str(e).lower()
                if "api key" in error_str or "permission" in error_str:
                    raise RuntimeError(f"Gemini auth error: {e}")
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAYS[attempt]
                    logger.warning(
                        f"Gemini attempt {attempt + 1} gagal: {e}. Retry {delay}s..."
                    )
                    time.sleep(delay)
                else:
                    raise RuntimeError(f"Gemini gagal setelah {MAX_RETRIES} percobaan: {e}")

    def _parse_response(self, raw_text: str) -> dict:
        """Parse Gemini JSON response."""
        text = raw_text.strip()

        # Remove markdown code fences
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try finding JSON in text
            start_idx = text.find("{")
            end_idx = text.rfind("}") + 1
            if start_idx >= 0 and end_idx > start_idx:
                try:
                    return json.loads(text[start_idx:end_idx])
                except json.JSONDecodeError:
                    pass
            raise ValueError(f"Gagal parse Gemini response sebagai JSON: {text[:500]}")
