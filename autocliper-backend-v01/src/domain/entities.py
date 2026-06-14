"""Domain entities — pure Python dataclasses and enums."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    VALIDATING = "validating"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    RENDERING = "rendering"
    WHISPER = "whisper"
    ASSEMBLING = "assembling"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    # Legacy statuses (backward compat)
    EXTRACTING = "extracting"
    UPLOADING = "uploading"
    QUEUED = "queued"
    PROCESSING = "processing"


@dataclass
class Word:
    word: str
    start: float
    end: float
    highlight: bool = False


@dataclass
class Subtitle:
    start: float
    end: float
    text: str
    words: list[Word] = field(default_factory=list)


@dataclass
class Clip:
    rank: int
    score: int
    start: float
    end: float
    hook: str
    reason: str
    subtitles: list[Subtitle] = field(default_factory=list)


@dataclass
class ClipResult:
    version: str
    video_id: str
    language: str
    error: Optional[str]
    clips: list[Clip]


@dataclass
class Job:
    job_id: str
    youtube_url: str
    status: JobStatus = JobStatus.VALIDATING
    video_duration: Optional[float] = None
    render_progress: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[dict] = None
    clips_data: Optional[dict] = None
    clips_total: int = 0
    clips_success: int = 0
    clips_failed: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
