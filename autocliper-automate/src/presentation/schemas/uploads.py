"""
Upload Queue Schemas
"""
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List


class UploadFromClipRequestModel(BaseModel):
    account_id: int
    request_log_id: int
    clip_index: int
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    privacy_level: str = "public"


class BulkUploadRequestModel(BaseModel):
    uploads: List[UploadFromClipRequestModel]


class UploadResponse(BaseModel):
    id: int
    user_id: int
    account_id: int
    account_name: Optional[str] = None
    request_log_id: Optional[int] = None
    clip_index: Optional[int] = None
    video_path: str
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    priority: int = 5
    status: str = "pending"
    progress_percent: int = 0
    tiktok_video_id: Optional[str] = None
    tiktok_url: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: Optional[str] = None
    uploaded_at: Optional[str] = None


class ScheduleSuggestionResponse(BaseModel):
    datetime: str
    confidence: float
    reason: str
