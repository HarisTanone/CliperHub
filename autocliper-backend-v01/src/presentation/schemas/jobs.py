"""Pydantic schemas for job API endpoints."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


class CreateJobRequest(BaseModel):
    youtube_url: str

    @field_validator("youtube_url")
    @classmethod
    def url_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("URL tidak boleh kosong")
        return v.strip()


class JobResponse(BaseModel):
    job_id: str
    youtube_url: str
    status: str
    video_duration: Optional[float] = None
    render_progress: Optional[str] = None
    error_message: Optional[str] = None
    clips_data: Optional[Any] = None
    clips_total: int = 0
    clips_success: int = 0
    clips_failed: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class JobErrorResponse(BaseModel):
    job_id: str
    error_message: Optional[str] = None
    error_details: Optional[dict] = None


class ClipDataResponse(BaseModel):
    """Response untuk Remotion — berisi clip data lengkap dengan subtitle dan hook."""
    job_id: str
    status: str
    clips: Optional[list[dict]] = None
    video_url: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
