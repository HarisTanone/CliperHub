"""Domain interfaces — Abstract Base Classes for infrastructure implementations."""
from abc import ABC, abstractmethod
from typing import Optional

from .entities import Job, JobStatus, Clip


class IJobRepository(ABC):
    @abstractmethod
    async def create(self, job: Job) -> Job:
        ...

    @abstractmethod
    async def get_by_job_id(self, job_id: str) -> Optional[Job]:
        ...

    @abstractmethod
    async def update_status(
        self, job_id: str, status: JobStatus, error_message: Optional[str] = None
    ) -> None:
        ...

    @abstractmethod
    async def update_render_progress(self, job_id: str, progress: str) -> None:
        ...

    @abstractmethod
    async def update_clips_count(
        self, job_id: str, total: int, success: int, failed: int
    ) -> None:
        ...

    @abstractmethod
    async def update_clips_data(self, job_id: str, clips_data: dict) -> None:
        ...

    @abstractmethod
    async def get_by_url_active(self, url: str) -> Optional[Job]:
        ...


class IDownloader(ABC):
    @abstractmethod
    async def validate_url(
        self, url: str
    ) -> tuple[bool, Optional[str], Optional[float]]:
        """Returns (is_valid, error_message, duration_seconds)."""
        ...

    @abstractmethod
    async def download_video(self, url: str, output_path: str) -> bool:
        ...


class ITranscriptFetcher(ABC):
    @abstractmethod
    async def fetch_transcript(self, video_url: str) -> Optional[dict]:
        """Fetch captions from YouTube. Returns {language, duration, segments: [{start, end, text}]}."""
        ...


class IGeminiAnalyzer(ABC):
    @abstractmethod
    async def analyze(
        self, transcript: dict, video_duration: float, max_clips: int
    ) -> dict:
        """Analyze transcript and return clip candidates with hooks and scoring."""
        ...


class IWhisperLocal(ABC):
    @abstractmethod
    async def transcribe_clip(self, audio_path: str) -> list[dict]:
        """Transcribe audio clip → [{start, end, text, words: [{word, start, end}]}]."""
        ...


class IRenderer(ABC):
    @abstractmethod
    async def trim_clip(
        self, video_path: str, clip: Clip, output_path: str
    ) -> bool:
        """Trim video segment only (no overlays — Remotion handles subtitle/hook)."""
        ...


class IValidator(ABC):
    @abstractmethod
    def validate_clip_result(
        self, data: dict, video_duration: float
    ) -> tuple[bool, list[str]]:
        ...

    @abstractmethod
    def validate_clip_timestamps(
        self, clip: Clip, video_duration: float
    ) -> list[str]:
        ...
