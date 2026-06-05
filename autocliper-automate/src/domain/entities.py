"""
Domain Entities for AutoCliper Automate
Multi-Platform Social Media Support
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


# ─── Platform Enum ───────────────────────────────────────────────────────────

class Platform(str, Enum):
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    X = "x"
    TIKTOK = "tiktok"


# Platform display info
PLATFORM_INFO = {
    Platform.YOUTUBE: {
        "name": "YouTube Shorts",
        "icon": "youtube",
        "color": "#FF0000",
        "max_duration": 60,
        "max_file_size": 256 * 1024 * 1024,  # 256MB
        "supported_login": ["google", "manual"],
        "difficulty": 1,
    },
    Platform.FACEBOOK: {
        "name": "Facebook Reels",
        "icon": "facebook",
        "color": "#1877F2",
        "max_duration": 90,
        "max_file_size": 1024 * 1024 * 1024,  # 1GB
        "supported_login": ["email", "phone", "manual"],
        "difficulty": 2,
    },
    Platform.INSTAGRAM: {
        "name": "Instagram Reels",
        "icon": "instagram",
        "color": "#E4405F",
        "max_duration": 90,
        "max_file_size": 650 * 1024 * 1024,  # 650MB
        "supported_login": ["email", "username", "phone", "manual"],
        "difficulty": 3,
    },
    Platform.X: {
        "name": "X Video",
        "icon": "x",
        "color": "#000000",
        "max_duration": 140,
        "max_file_size": 512 * 1024 * 1024,  # 512MB
        "supported_login": ["email", "username", "phone", "manual"],
        "difficulty": 4,
    },
    Platform.TIKTOK: {
        "name": "TikTok",
        "icon": "tiktok",
        "color": "#000000",
        "max_duration": 180,
        "max_file_size": 287 * 1024 * 1024,  # 287MB
        "supported_login": ["email", "username", "phone", "manual"],
        "difficulty": 5,
    },
}


class LoginType(str, Enum):
    EMAIL = "email"
    USERNAME = "username"
    PHONE = "phone"
    MANUAL = "manual"
    GOOGLE = "google"  # For YouTube
    OAUTH = "oauth"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    NEEDS_VERIFICATION = "needs_verification"
    NEEDS_CAPTCHA = "needs_captcha"
    INACTIVE = "inactive"


class UploadStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    UPLOADING = "uploading"
    PUBLISHED = "published"
    COMPLETED = "completed"  # Alias for published, used by YouTube
    FAILED = "failed"
    CANCELLED = "cancelled"


class DeadlineStatus(str, Enum):
    ON_TIME = "on_time"
    LATE = "late"
    MISSED = "missed"


class PrivacyLevel(str, Enum):
    PUBLIC = "public"
    UNLISTED = "unlisted"  # YouTube
    FRIENDS = "friends"
    PRIVATE = "private"


class VerificationType(str, Enum):
    SMS_OTP = "sms_otp"
    EMAIL_OTP = "email_otp"
    CAPTCHA = "captcha"
    PHONE = "phone"
    SUSPICIOUS_LOGIN = "suspicious_login"
    TWO_FACTOR = "two_factor"
    OTHER = "other"


class WarmupPhase(str, Enum):
    PASSIVE = "passive"
    LIGHT_ENGAGEMENT = "light_engagement"
    ACTIVE_ENGAGEMENT = "active_engagement"
    READY = "ready"
    PAUSED = "paused"


# ─── Social Account Entity (Generic) ─────────────────────────────────────────

@dataclass
class SocialAccount:
    """Generic social media account entity"""
    id: int
    user_id: int
    platform: Platform
    account_name: str
    login_type: LoginType
    login_identifier: str
    password_encrypted: str
    platform_username: Optional[str] = None
    platform_user_id: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: int = 3
    uploads_today: int = 0
    last_upload_at: Optional[datetime] = None
    status: AccountStatus = AccountStatus.ACTIVE
    health_score: int = 100
    total_uploads: int = 0
    total_views: int = 0
    notes: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Alias for backward compatibility
TikTokAccount = SocialAccount


@dataclass
class BrowserFingerprint:
    """Browser fingerprint for anti-detection"""
    id: int
    fingerprint_id: str
    name: str
    user_agent: str
    viewport_width: int = 1920
    viewport_height: int = 1080
    device_scale_factor: float = 1.0
    is_mobile: bool = False
    has_touch: bool = False
    platform: str = "Win32"
    timezone: str = "Asia/Jakarta"
    locale: str = "id-ID"
    color_depth: int = 24
    webgl_vendor: Optional[str] = None
    webgl_renderer: Optional[str] = None
    extra_headers: Optional[Dict[str, Any]] = None
    extra_args: Optional[List[str]] = None
    last_used_at: Optional[datetime] = None
    use_count: int = 0
    is_active: bool = True


@dataclass
class SocialSession:
    """Social media browser session"""
    id: int
    account_id: int
    platform: Platform
    cookies: Dict[str, Any]
    local_storage: Optional[Dict[str, Any]] = None
    session_storage: Optional[Dict[str, Any]] = None
    browser_context: Optional[Dict[str, Any]] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    fingerprint_id: Optional[int] = None
    is_valid: bool = True
    login_method: Optional[str] = None
    last_validated_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    validation_error: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Alias for backward compatibility
TikTokSession = SocialSession


@dataclass
class SocialUploadJob:
    """Social media upload queue job"""
    id: int
    user_id: int
    account_id: int
    platform: Platform
    request_log_id: Optional[int] = None
    clip_index: Optional[int] = None
    video_path: str = ""
    video_size_bytes: Optional[int] = None
    video_duration_seconds: Optional[float] = None
    title: Optional[str] = None  # For YouTube/Facebook
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    mentions: Optional[List[str]] = None
    music_id: Optional[str] = None
    thumbnail_path: Optional[str] = None  # For YouTube
    privacy_level: PrivacyLevel = PrivacyLevel.PUBLIC
    allow_comments: bool = True
    allow_duet: bool = True
    allow_stitch: bool = True
    made_for_kids: bool = False  # YouTube
    category_id: Optional[str] = None  # YouTube
    scheduled_at: Optional[datetime] = None
    priority: int = 5
    status: UploadStatus = UploadStatus.PENDING
    deadline_status: DeadlineStatus = DeadlineStatus.ON_TIME
    progress_percent: int = 0
    platform_video_id: Optional[str] = None
    platform_url: Optional[str] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    last_retry_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    uploaded_at: Optional[datetime] = None


# Alias for backward compatibility
UploadJob = SocialUploadJob


@dataclass
class UploadHistory:
    """Upload event history"""
    id: int
    upload_queue_id: int
    account_id: int
    action: str
    details: Optional[Dict[str, Any]] = None
    screenshot_path: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: Optional[datetime] = None


@dataclass
class PendingVerification:
    """Pending 2FA/CAPTCHA verification"""
    id: int
    account_id: int
    upload_queue_id: Optional[int] = None
    verification_type: VerificationType = VerificationType.OTHER
    screenshot_path: Optional[str] = None
    browser_session_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    status: str = "pending"
    notified_channels: Optional[List[str]] = None
    notified_at: Optional[datetime] = None
    timeout_at: Optional[datetime] = None
    solved_at: Optional[datetime] = None
    solved_by: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class AccountWarmup:
    """Account warmup tracking"""
    id: int
    account_id: int
    warmup_phase: WarmupPhase = WarmupPhase.PASSIVE
    started_at: Optional[datetime] = None
    phase_started_at: Optional[datetime] = None
    total_videos_watched: int = 0
    total_likes_given: int = 0
    total_follows_given: int = 0
    total_comments_given: int = 0
    total_browse_minutes: int = 0
    daily_watch_target: int = 30
    daily_like_target: int = 10
    daily_follow_target: int = 5
    today_videos_watched: int = 0
    today_likes_given: int = 0
    today_follows_given: int = 0
    today_browse_minutes: int = 0
    last_activity_date: Optional[datetime] = None
    auto_advance_phase: bool = True
    skip_weekends: bool = False
    preferred_niches: Optional[List[str]] = None
    is_active: bool = True
    last_warmup_at: Optional[datetime] = None
    next_warmup_at: Optional[datetime] = None
    error_count: int = 0
    last_error: Optional[str] = None


@dataclass
class CaptionTemplate:
    """Caption template for auto-generation"""
    id: int
    user_id: int
    account_id: Optional[int] = None
    name: str = ""
    template: str = "{hook}"
    default_hashtags: Optional[List[str]] = None
    niche: Optional[str] = None
    is_default: bool = False
    use_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class VideoPerformance:
    """Video performance metrics"""
    id: int
    upload_queue_id: int
    account_id: int
    platform_video_id: str
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    saves: int = 0
    avg_watch_time_seconds: Optional[float] = None
    completion_rate: Optional[float] = None
    posted_at: Optional[datetime] = None
    posted_hour: Optional[int] = None
    posted_day_of_week: Optional[int] = None
    video_duration_seconds: Optional[float] = None
    hashtags: Optional[List[str]] = None
    caption_length: Optional[int] = None
    has_music: Optional[bool] = None
    last_fetched_at: Optional[datetime] = None
    fetch_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─── Request/Response DTOs ───────────────────────────────────────────────────

@dataclass
class CreateAccountRequest:
    """Request to create a social media account"""
    account_name: str
    platform: str = "tiktok"
    login_type: str = "manual"
    login_identifier: Optional[str] = None
    password: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: int = 3
    notes: Optional[str] = None


@dataclass
class UpdateAccountRequest:
    """Request to update a social media account"""
    account_name: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class UploadFromClipRequest:
    """Request to upload from AutoCliper clip"""
    account_id: int
    request_log_id: int
    clip_index: int
    title: Optional[str] = None  # For YouTube
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    privacy_level: str = "public"


@dataclass
class BulkUploadRequest:
    """Request for bulk upload"""
    uploads: List[UploadFromClipRequest] = field(default_factory=list)


@dataclass
class ScheduleSuggestion:
    """Suggested upload time"""
    datetime: datetime
    confidence: float
    reason: str


@dataclass
class ConflictResult:
    """Result of conflict check"""
    has_conflict: bool
    conflicting_upload_id: Optional[int] = None
    suggested_time: Optional[datetime] = None
