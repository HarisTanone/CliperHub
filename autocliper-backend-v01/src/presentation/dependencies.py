"""Dependency Injection — wires infrastructure to application layer."""
from functools import lru_cache

from src.application.services import JobService
from src.infrastructure.downloader import YouTubeDownloader
from src.infrastructure.gemini_analyzer import GeminiAnalyzer
from src.infrastructure.renderer import FFmpegRenderer
from src.infrastructure.repositories import JobRepository
from src.infrastructure.transcript_fetcher import TranscriptFetcher
from src.infrastructure.validator import ClipValidator
from src.infrastructure.whisper_local import WhisperLocal


@lru_cache()
def get_job_service() -> JobService:
    """Singleton JobService dengan semua dependencies."""
    return JobService(
        job_repo=JobRepository(),
        downloader=YouTubeDownloader(),
        transcript_fetcher=TranscriptFetcher(),
        gemini_analyzer=GeminiAnalyzer(),
        whisper_local=WhisperLocal(),
        renderer=FFmpegRenderer(),
        validator=ClipValidator(),
    )
