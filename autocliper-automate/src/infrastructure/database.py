"""
Database Configuration and SQLAlchemy Models
Connects to the same database as AutoCliper v2
"""
from sqlalchemy import (
    create_engine, Column, Integer, BigInteger, String, Float, 
    JSON, TIMESTAMP, ForeignKey, Boolean, Text, Enum, Date
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session, relationship
from sqlalchemy.sql import func
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


# ═══════════════════════════════════════════════════════════════════════════
# Existing AutoCliper v2 Models (for reference/foreign keys)
# ═══════════════════════════════════════════════════════════════════════════

class UserModel(Base):
    """User accounts - shared with AutoCliper v2"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class RequestLogModel(Base):
    """Request log - shared with AutoCliper v2"""
    __tablename__ = "request_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    youtube_url = Column(String(255), nullable=False)
    caption_style_id = Column(Integer, nullable=False)
    hook_style_id = Column(BigInteger, nullable=True)
    caption_response = Column(JSON, nullable=False)
    status = Column(String(50), default="pending")
    output_path = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(TIMESTAMP, server_default=func.current_timestamp())


# ═══════════════════════════════════════════════════════════════════════════
# AutoCliper Automate Models
# ═══════════════════════════════════════════════════════════════════════════

class TikTokAccountModel(Base):
    """TikTok accounts for automation"""
    __tablename__ = "tiktok_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_name = Column(String(100), nullable=False)
    login_type = Column(String(20), nullable=False, default='manual')  # email, username, phone, manual
    login_identifier = Column(String(255), nullable=False)
    password_encrypted = Column(String(500), nullable=False)
    tiktok_username = Column(String(100), nullable=True)
    tiktok_user_id = Column(String(50), nullable=True)
    proxy_url = Column(String(255), nullable=True)
    daily_upload_limit = Column(Integer, default=3)
    uploads_today = Column(Integer, default=0)
    last_upload_at = Column(TIMESTAMP, nullable=True)
    last_upload_reset_date = Column(Date, nullable=True)
    status = Column(String(30), default='active')  # active, suspended, needs_verification, needs_captcha, inactive
    health_score = Column(Integer, default=100)
    total_uploads = Column(Integer, default=0)
    total_views = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # Relationships
    sessions = relationship("TikTokSessionModel", back_populates="account", cascade="all, delete-orphan")
    uploads = relationship("UploadQueueModel", back_populates="account")


class BrowserFingerprintModel(Base):
    """Browser fingerprints for anti-detection"""
    __tablename__ = "browser_fingerprints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fingerprint_id = Column(String(100), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    user_agent = Column(String(500), nullable=False)
    viewport_width = Column(Integer, nullable=False, default=1920)
    viewport_height = Column(Integer, nullable=False, default=1080)
    device_scale_factor = Column(Float, default=1.0)
    is_mobile = Column(Boolean, default=False)
    has_touch = Column(Boolean, default=False)
    platform = Column(String(50), nullable=False)
    timezone = Column(String(50), nullable=False, default='Asia/Jakarta')
    locale = Column(String(20), nullable=False, default='id-ID')
    color_depth = Column(Integer, default=24)
    webgl_vendor = Column(String(255), nullable=True)
    webgl_renderer = Column(String(255), nullable=True)
    extra_headers = Column(JSON, nullable=True)
    extra_args = Column(JSON, nullable=True)
    last_used_at = Column(TIMESTAMP, nullable=True)
    use_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class TikTokSessionModel(Base):
    """TikTok browser sessions"""
    __tablename__ = "tiktok_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="CASCADE"), nullable=False)
    cookies = Column(JSON, nullable=False)
    local_storage = Column(JSON, nullable=True)
    session_storage = Column(JSON, nullable=True)
    browser_context = Column(JSON, nullable=True)
    fingerprint_id = Column(Integer, ForeignKey("browser_fingerprints.id", ondelete="SET NULL"), nullable=True)
    is_valid = Column(Boolean, default=True)
    login_method = Column(String(50), nullable=True)
    last_validated_at = Column(TIMESTAMP, nullable=True)
    last_used_at = Column(TIMESTAMP, nullable=True)
    validation_error = Column(Text, nullable=True)
    expires_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # Relationships
    account = relationship("TikTokAccountModel", back_populates="sessions")


class UploadQueueModel(Base):
    """Upload queue for TikTok"""
    __tablename__ = "upload_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="CASCADE"), nullable=False)
    request_log_id = Column(Integer, ForeignKey("request_log.id", ondelete="SET NULL"), nullable=True)
    clip_index = Column(Integer, nullable=True)
    video_path = Column(String(500), nullable=False)
    video_size_bytes = Column(BigInteger, nullable=True)
    video_duration_seconds = Column(Float, nullable=True)
    caption = Column(Text, nullable=True)
    hashtags = Column(JSON, nullable=True)
    mentions = Column(JSON, nullable=True)
    music_id = Column(String(100), nullable=True)
    privacy_level = Column(Enum('public', 'friends', 'private', name='privacy_level_enum'), default='public')
    allow_comments = Column(Boolean, default=True)
    allow_duet = Column(Boolean, default=True)
    allow_stitch = Column(Boolean, default=True)
    scheduled_at = Column(TIMESTAMP, nullable=True)
    priority = Column(Integer, default=5)
    status = Column(
        Enum('pending', 'processing', 'uploading', 'published', 'failed', 'cancelled',
             name='upload_status_enum'),
        default='pending'
    )
    deadline_status = Column(
        Enum('on_time', 'late', 'missed', name='deadline_status_enum'),
        default='on_time'
    )
    progress_percent = Column(Integer, default=0)
    tiktok_video_id = Column(String(100), nullable=True)
    tiktok_url = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_retry_at = Column(TIMESTAMP, nullable=True)
    processing_started_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    uploaded_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    account = relationship("TikTokAccountModel", back_populates="uploads")
    history = relationship("UploadHistoryModel", back_populates="upload", cascade="all, delete-orphan")


class UploadHistoryModel(Base):
    """Upload event history"""
    __tablename__ = "upload_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_queue_id = Column(Integer, ForeignKey("upload_queue.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    details = Column(JSON, nullable=True)
    screenshot_path = Column(String(500), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    # Relationships
    upload = relationship("UploadQueueModel", back_populates="history")


class PendingVerificationModel(Base):
    """Pending 2FA/CAPTCHA verifications"""
    __tablename__ = "pending_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="CASCADE"), nullable=False)
    upload_queue_id = Column(Integer, ForeignKey("upload_queue.id", ondelete="SET NULL"), nullable=True)
    verification_type = Column(
        Enum('sms_otp', 'email_otp', 'captcha', 'phone', 'suspicious_login', 'other',
             name='verification_type_enum'),
        nullable=False
    )
    screenshot_path = Column(String(500), nullable=True)
    browser_session_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    status = Column(Enum('pending', 'solved', 'timeout', 'skipped', name='verification_status_enum'), default='pending')
    notified_channels = Column(JSON, nullable=True)
    notified_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    timeout_at = Column(TIMESTAMP, nullable=False)
    solved_at = Column(TIMESTAMP, nullable=True)
    solved_by = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


class CaptionTemplateModel(Base):
    """Caption templates"""
    __tablename__ = "caption_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    template = Column(Text, nullable=False)
    default_hashtags = Column(JSON, nullable=True)
    niche = Column(String(50), nullable=True)
    is_default = Column(Boolean, default=False)
    use_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class VideoPerformanceModel(Base):
    """Video performance metrics"""
    __tablename__ = "video_performance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_queue_id = Column(Integer, ForeignKey("upload_queue.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="CASCADE"), nullable=False)
    tiktok_video_id = Column(String(100), nullable=False, unique=True)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    avg_watch_time_seconds = Column(Float, nullable=True)
    completion_rate = Column(Float, nullable=True)
    posted_at = Column(TIMESTAMP, nullable=False)
    video_duration_seconds = Column(Float, nullable=True)
    hashtags = Column(JSON, nullable=True)
    caption_length = Column(Integer, nullable=True)
    has_music = Column(Boolean, nullable=True)
    last_fetched_at = Column(TIMESTAMP, nullable=True)
    fetch_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class AuditLogModel(Base):
    """Audit log for security"""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())


# ═══════════════════════════════════════════════════════════════════════════
# Multi-Platform Social Media Models
# ═══════════════════════════════════════════════════════════════════════════

class SocialAccountModel(Base):
    """Generic social media accounts for all platforms"""
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(30), nullable=False, default='tiktok')  # youtube, facebook, instagram, x, tiktok
    account_name = Column(String(100), nullable=False)
    login_type = Column(String(20), nullable=False, default='manual')  # email, username, phone, manual, google, oauth
    login_identifier = Column(String(255), nullable=False, default='')
    password_encrypted = Column(String(500), nullable=False, default='')
    
    # Platform-specific username/ID
    platform_username = Column(String(100), nullable=True)
    platform_user_id = Column(String(100), nullable=True)
    
    # Configuration
    proxy_url = Column(String(255), nullable=True)
    daily_upload_limit = Column(Integer, default=3)
    uploads_today = Column(Integer, default=0)
    last_upload_at = Column(TIMESTAMP, nullable=True)
    last_upload_reset_date = Column(Date, nullable=True)
    
    # Status
    status = Column(String(30), default='active')  # active, suspended, needs_verification, inactive
    health_score = Column(Integer, default=100)
    
    # Stats
    total_uploads = Column(Integer, default=0)
    total_views = Column(BigInteger, default=0)
    
    # Metadata
    notes = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # Relationships
    sessions = relationship("SocialSessionModel", back_populates="account", cascade="all, delete-orphan")
    uploads = relationship("SocialUploadQueueModel", back_populates="account")


class SocialSessionModel(Base):
    """Browser sessions for all social platforms"""
    __tablename__ = "social_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(30), nullable=False)
    
    # Session data
    cookies = Column(JSON, nullable=True)
    local_storage = Column(JSON, nullable=True)
    session_storage = Column(JSON, nullable=True)
    browser_context = Column(JSON, nullable=True)
    access_token = Column(Text, nullable=True)  # For OAuth-based platforms
    refresh_token = Column(Text, nullable=True)  # For OAuth-based platforms
    token_expires_at = Column(TIMESTAMP, nullable=True)
    
    # Fingerprint
    fingerprint_id = Column(Integer, ForeignKey("browser_fingerprints.id", ondelete="SET NULL"), nullable=True)
    
    # Status
    is_valid = Column(Boolean, default=True)
    login_method = Column(String(30), nullable=True)
    last_validated_at = Column(TIMESTAMP, nullable=True)
    last_used_at = Column(TIMESTAMP, nullable=True)
    validation_error = Column(Text, nullable=True)
    expires_at = Column(TIMESTAMP, nullable=True)
    
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    # Relationships
    account = relationship("SocialAccountModel", back_populates="sessions")


class SocialUploadQueueModel(Base):
    """Upload queue for all social platforms"""
    __tablename__ = "social_upload_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(30), nullable=False)
    
    # Source video
    request_log_id = Column(Integer, ForeignKey("request_log.id", ondelete="SET NULL"), nullable=True)
    clip_index = Column(Integer, nullable=True)
    video_path = Column(String(500), nullable=False)
    video_size_bytes = Column(BigInteger, nullable=True)
    video_duration_seconds = Column(Float, nullable=True)
    
    # Content
    title = Column(String(500), nullable=True)  # For YouTube/Facebook
    caption = Column(Text, nullable=True)
    hashtags = Column(JSON, nullable=True)
    mentions = Column(JSON, nullable=True)
    music_id = Column(String(100), nullable=True)
    thumbnail_path = Column(String(500), nullable=True)  # For YouTube
    
    # Settings
    privacy_level = Column(String(20), default='public')  # public, unlisted, private, friends
    allow_comments = Column(Boolean, default=True)
    allow_duet = Column(Boolean, default=True)  # TikTok
    allow_stitch = Column(Boolean, default=True)  # TikTok
    made_for_kids = Column(Boolean, default=False)  # YouTube
    category_id = Column(String(50), nullable=True)  # YouTube category
    
    # Scheduling
    scheduled_at = Column(TIMESTAMP, nullable=True)
    priority = Column(Integer, default=5)
    
    # Status
    status = Column(String(30), default='pending')  # pending, processing, uploading, published, failed, cancelled
    progress_percent = Column(Integer, default=0)
    
    # Result
    platform_video_id = Column(String(100), nullable=True)
    platform_url = Column(String(500), nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_retry_at = Column(TIMESTAMP, nullable=True)
    
    # Timestamps
    processing_started_at = Column(TIMESTAMP, nullable=True)
    uploaded_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    # Relationships
    account = relationship("SocialAccountModel", back_populates="uploads")


class AccountWarmupModel(Base):
    """Account warmup tracking"""
    __tablename__ = "account_warmup"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("tiktok_accounts.id", ondelete="CASCADE"), nullable=False, unique=True)
    warmup_phase = Column(
        Enum('passive', 'light_engagement', 'active_engagement', 'ready', 'paused',
             name='warmup_phase_enum'),
        default='passive'
    )
    started_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    phase_started_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    total_videos_watched = Column(Integer, default=0)
    total_likes_given = Column(Integer, default=0)
    total_follows_given = Column(Integer, default=0)
    total_comments_given = Column(Integer, default=0)
    total_browse_minutes = Column(Integer, default=0)
    daily_watch_target = Column(Integer, default=30)
    daily_like_target = Column(Integer, default=10)
    daily_follow_target = Column(Integer, default=5)
    today_videos_watched = Column(Integer, default=0)
    today_likes_given = Column(Integer, default=0)
    today_follows_given = Column(Integer, default=0)
    today_browse_minutes = Column(Integer, default=0)
    last_activity_date = Column(Date, nullable=True)
    auto_advance_phase = Column(Boolean, default=True)
    skip_weekends = Column(Boolean, default=False)
    preferred_niches = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    last_warmup_at = Column(TIMESTAMP, nullable=True)
    next_warmup_at = Column(TIMESTAMP, nullable=True)
    error_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


# ═══════════════════════════════════════════════════════════════════════════
# Database Connection
# ═══════════════════════════════════════════════════════════════════════════

class Database:
    def __init__(self):
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            # Build from individual components
            host = os.getenv("DB_HOST", "localhost")
            port = os.getenv("DB_PORT", "3306")
            user = os.getenv("DB_USER", "root")
            password = os.getenv("DB_PASSWORD", "")
            name = os.getenv("DB_NAME", "autocliper")
            db_url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}"
        
        # Auto-convert aiomysql to pymysql
        if 'aiomysql' in db_url:
            db_url = db_url.replace('aiomysql', 'pymysql')
        
        self.engine = create_engine(
            db_url,
            pool_size=5,
            max_overflow=10,
            pool_recycle=3600,
            pool_pre_ping=True,
            echo=False,
        )
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def get_session(self) -> Session:
        return self.SessionLocal()
    
    def create_tables(self):
        """Create tables that don't exist yet"""
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created/verified")


# Singleton instance
database = Database()
