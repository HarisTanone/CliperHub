"""
Multi-Platform Social Media Schemas
"""
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List


class CreateSocialAccountRequest(BaseModel):
    platform: str  # youtube, facebook, instagram, x, tiktok
    account_name: str
    login_type: str = "manual"  # email, username, phone, manual, google
    login_identifier: Optional[str] = None
    password: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: int = 3
    notes: Optional[str] = None
    auto_login: bool = True


class SocialAccountResponse(BaseModel):
    id: int
    user_id: int
    platform: str
    account_name: str
    login_type: str
    login_identifier: str
    platform_username: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: int = 3
    uploads_today: int = 0
    last_upload_at: Optional[str] = None
    status: str = "active"
    health_score: int = 100
    total_uploads: int = 0
    total_views: int = 0
    notes: Optional[str] = None
    created_at: Optional[str] = None
    session_valid: bool = False


class SocialUploadRequest(BaseModel):
    account_id: int
    video_path: Optional[str] = None  # Direct video path (optional if request_log_id provided)
    title: Optional[str] = None  # For YouTube
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    privacy_level: str = "public"
    request_log_id: Optional[int] = None  # AutoCliper request_log ID
    clip_index: Optional[int] = None  # Clip index within the job
    made_for_kids: bool = False  # YouTube
    category_id: Optional[str] = None  # YouTube


class SocialUploadResponse(BaseModel):
    id: int
    user_id: int
    account_id: int
    platform: str
    account_name: Optional[str] = None
    request_log_id: Optional[int] = None
    clip_index: Optional[int] = None
    video_path: str
    title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    priority: int = 5
    status: str = "pending"
    progress_percent: int = 0
    platform_video_id: Optional[str] = None
    platform_url: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: Optional[str] = None
    uploaded_at: Optional[str] = None
