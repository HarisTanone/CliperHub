"""
Job Schemas - Video processing jobs
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class JobRequestModel(BaseModel):
    urls: str  # Single URL or newline/comma-separated multiple URLs
    caption_style: int
    hook_style_id: Optional[int] = None


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
    caption_style: int
    hook_style_id: Optional[int] = None


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
    hook_style_id: Optional[int] = None


# ─── Preview ─────────────────────────────────────────────────────────────────

class PreviewRequest(BaseModel):
    video_path: str
    caption_style_id: int
    hook_style_id: Optional[int] = None
    clip_index: int = 1
    text_preview: Optional[str] = None
    start_time: float = 0
    duration: float = 5


class PreviewResponse(BaseModel):
    preview_id: str
    preview_url: str
    expires_in: int = 300


# ─── Base Process (Two-step) ─────────────────────────────────────────────────

class BaseProcessRequest(BaseModel):
    url: str
    skip_clips: Optional[List[int]] = None


class BaseProcessResponse(BaseModel):
    job_id: int
    status: str
    message: str


class ApplyStyleRequest(BaseModel):
    caption_style_id: int
    hook_style_id: Optional[int] = None


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
