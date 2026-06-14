"""TranscriptFetcher — YouTube Transcript API wrapper."""
import asyncio
import logging
import re
from typing import Optional

from youtube_transcript_api import YouTubeTranscriptApi

from src.domain.interfaces import ITranscriptFetcher

logger = logging.getLogger(__name__)

# Extract video ID from various YouTube URL formats
VIDEO_ID_PATTERN = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/)([\w\-]{11})"
)


class TranscriptFetcher(ITranscriptFetcher):
    async def fetch_transcript(self, video_url: str) -> Optional[dict]:
        """Fetch YouTube captions. Returns segment-level transcript."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._fetch_sync, video_url)

    def _fetch_sync(self, video_url: str) -> Optional[dict]:
        match = VIDEO_ID_PATTERN.search(video_url)
        if not match:
            logger.error(f"Tidak bisa extract video ID dari: {video_url}")
            return None

        video_id = match.group(1)

        try:
            api = YouTubeTranscriptApi()
            # Coba bahasa Indonesia dulu, lalu English, lalu auto-generated
            transcript = api.fetch(video_id, languages=["id", "en"])
            entries = list(transcript)

            if not entries:
                logger.warning(f"Transcript kosong untuk {video_id}")
                return None

            segments = []
            for entry in entries:
                segments.append({
                    "start": round(entry.start, 2),
                    "end": round(entry.start + entry.duration, 2),
                    "text": entry.text.strip(),
                })

            # Detect language from first few segments
            sample_text = " ".join(s["text"] for s in segments[:10])
            language = self._detect_language(sample_text)

            duration = segments[-1]["end"] if segments else 0

            logger.info(
                f"Transcript fetched: {len(segments)} segments, "
                f"lang={language}, duration={duration:.0f}s"
            )

            return {
                "language": language,
                "duration": duration,
                "segments": segments,
            }

        except Exception as e:
            logger.warning(f"YouTube Transcript API gagal: {e}")
            return None

    def _detect_language(self, text: str) -> str:
        """Simple language detection based on character analysis."""
        # Korean characters
        if re.search(r"[\uAC00-\uD7A3]", text):
            return "ko"
        # Japanese
        if re.search(r"[\u3040-\u309F\u30A0-\u30FF]", text):
            return "ja"
        # Chinese
        if re.search(r"[\u4E00-\u9FFF]", text):
            return "zh"
        # Indonesian/Malay indicators
        indo_words = ["yang", "dan", "ini", "itu", "untuk", "dengan", "tidak", "ada"]
        words = text.lower().split()
        indo_count = sum(1 for w in words if w in indo_words)
        if indo_count > len(words) * 0.1:
            return "id"
        return "en"
