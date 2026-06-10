"""
Job Schemas - Video processing jobs
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ─── Available Video Resolutions ──────────────────────────────────────────────

VIDEO_RESOLUTIONS = {
    # Portrait (Vertikal)
    "9:16": {"width": 1080, "height": 1920, "label": "9:16 — Standar TikTok/Reels"},
    "4:5": {"width": 1080, "height": 1350, "label": "4:5 — Instagram Feed"},
    "3:4": {"width": 1080, "height": 1440, "label": "3:4 — Mobile friendly"},
    "2:3": {"width": 1080, "height": 1620, "label": "2:3 — Alternatif vertikal"},
    # Landscape (Horizontal)
    "16:9": {"width": 1920, "height": 1080, "label": "16:9 — Standar YouTube"},
    "21:9": {"width": 2560, "height": 1080, "label": "21:9 — Cinematic ultra-wide"},
    "18:9": {"width": 2160, "height": 1080, "label": "18:9 — Smartphone widescreen"},
}


class JobRequestModel(BaseModel):
    urls: str  # Single URL or newline/comma-separated multiple URLs
    caption_style: Optional[int] = None  # Legacy field (FFmpeg)
    caption_template_id: Optional[int] = None  # Remotion template
    hook_style_id: Optional[int] = None  # Legacy field (FFmpeg)
    hook_template_id: Optional[int] = None  # Remotion template
    resolution: Optional[str] = "9:16"  # Aspect ratio: 9:16, 4:5, 16:9, etc.

    @property
    def effective_caption_id(self) -> Optional[int]:
        return self.caption_template_id or self.caption_style

    @property
    def effective_hook_id(self) -> Optional[int]:
        return self.hook_template_id or self.hook_style_id


class BatchJobResponse(BaseModel):
    status: str
    message: str
    total_urls: int = 1
    accepted: int = 0
    skipped: int = 0
    results: List[Dict[str, Any]] = []


class JobResponse(BaseModel):
    status: str
    message: str
    job_id: Optional[int] = None


class ClipScoresResponse(BaseModel):
    viral_score: float = 0.0
    curiosity_score: float = 0.0
    emotion_score: float = 0.0
    controversy_score: float = 0.0
    story_score: float = 0.0
    final_score: float = 0.0


class ClipInfo(BaseModel):
    index: int
    hook: str
    start: float
    end: float
    score: float
    file_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    keywords: List[str] = []
    reason: Optional[str] = None
    scores: Optional[ClipScoresResponse] = None


class JobHistoryResponse(BaseModel):
    id: int
    youtube_url: str
    video_title: Optional[str] = None
    status: str
    clips: List[ClipInfo]
    hook_count: int
    total_duration: float
    created_at: str
    completed_at: Optional[str] = None
    output_files: List[str] = []
    thumbnails: List[str] = []


class JobStatusResponse(BaseModel):
    id: int
    youtube_url: str
    video_title: Optional[str] = None
    status: str
    progress: int = 0
    current_step: str = ""
    clips: List[ClipInfo] = []
    error_message: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


# ─── Analyze & Process ───────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    url: str
    caption_style: Optional[int] = None
    caption_template_id: Optional[int] = None
    hook_style_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    resolution: Optional[str] = "9:16"

    @property
    def effective_caption_id(self) -> Optional[int]:
        return self.caption_template_id or self.caption_style

    @property
    def effective_hook_id(self) -> Optional[int]:
        return self.hook_template_id or self.hook_style_id


class ClipCandidate(BaseModel):
    index: int
    hook: str
    start: float
    end: float
    duration: float
    score: float
    keywords: List[str] = []
    context: Optional[str] = None


class AnalyzeResponse(BaseModel):
    job_id: int
    candidates: List[ClipCandidate]
    video_duration: float


class ProcessSelectedRequest(BaseModel):
    job_id: int
    selected_indices: List[int]
    edited_hooks: Optional[Dict[int, str]] = None
    caption_style: Optional[int] = None
    caption_template_id: Optional[int] = None
    hook_style_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    resolution: Optional[str] = "9:16"

    @property
    def effective_caption_id(self) -> Optional[int]:
        return self.caption_template_id or self.caption_style

    @property
    def effective_hook_id(self) -> Optional[int]:
        return self.hook_template_id or self.hook_style_id


# ─── Preview ─────────────────────────────────────────────────────────────────

class PreviewRequest(BaseModel):
    video_path: str
    caption_style_id: Optional[int] = None  # Legacy
    caption_template_id: Optional[int] = None  # Remotion
    hook_style_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    clip_index: int = 1
    text_preview: Optional[str] = None
    start_time: float = 0
    duration: float = 5

    @property
    def effective_caption_id(self) -> Optional[int]:
        return self.caption_template_id or self.caption_style_id

    @property
    def effective_hook_id(self) -> Optional[int]:
        return self.hook_template_id or self.hook_style_id


class PreviewResponse(BaseModel):
    preview_id: str
    preview_url: str
    expires_in: int = 300


# ─── Base Process (Two-step) ─────────────────────────────────────────────────

class BaseProcessRequest(BaseModel):
    url: str
    skip_clips: Optional[List[int]] = None
    resolution: Optional[str] = "9:16"


class BaseProcessResponse(BaseModel):
    job_id: int
    status: str
    message: str


class ApplyStyleRequest(BaseModel):
    caption_style_id: Optional[int] = None  # Legacy
    caption_template_id: Optional[int] = None  # Remotion
    hook_style_id: Optional[int] = None  # Legacy
    hook_template_id: Optional[int] = None  # Remotion
    resolution: Optional[str] = "9:16"

    @property
    def effective_caption_id(self) -> Optional[int]:
        return self.caption_template_id or self.caption_style_id

    @property
    def effective_hook_id(self) -> Optional[int]:
        return self.hook_template_id or self.hook_style_id


class ApplyStyleResponse(BaseModel):
    job_id: int
    status: str
    message: str
    clips_to_style: int = 0


class BaseClipInfo(BaseModel):
    index: int
    hook: str
    keywords: List[str] = []
    start: float
    end: float
    duration: float
    score: float
    context: Optional[str] = None
    base_video_path: Optional[str] = None
    final_video_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    status: str = "pending"


class BaseJobDetailResponse(BaseModel):
    id: int
    youtube_url: str
    video_title: Optional[str] = None
    status: str
    clips: List[BaseClipInfo] = []
    has_styled_clips: bool = False
    has_raw_clips: bool = False  # True if raw clips available for proper re-styling
    created_at: str = ""
