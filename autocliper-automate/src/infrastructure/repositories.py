"""
Repository implementations for database access
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import logging
import random

from .database import (
    TikTokAccountModel, TikTokSessionModel, UploadQueueModel,
    BrowserFingerprintModel, UploadHistoryModel, PendingVerificationModel,
    CaptionTemplateModel, VideoPerformanceModel, AuditLogModel, AccountWarmupModel,
    UserModel
)
from ..domain.entities import (
    TikTokAccount, TikTokSession, UploadJob, BrowserFingerprint,
    UploadHistory, PendingVerification, CaptionTemplate, VideoPerformance,
    AccountWarmup, LoginType, AccountStatus, UploadStatus
)

logger = logging.getLogger(__name__)


def _model_to_account(m: TikTokAccountModel) -> TikTokAccount:
    """Convert SQLAlchemy model to domain entity"""
    return TikTokAccount(
        id=m.id,
        user_id=m.user_id,
        account_name=m.account_name,
        login_type=LoginType(m.login_type),
        login_identifier=m.login_identifier,
        password_encrypted=m.password_encrypted,
        tiktok_username=m.tiktok_username,
        tiktok_user_id=m.tiktok_user_id,
        proxy_url=m.proxy_url,
        daily_upload_limit=m.daily_upload_limit or 3,
        uploads_today=m.uploads_today or 0,
        last_upload_at=m.last_upload_at,
        status=AccountStatus(m.status) if m.status else AccountStatus.ACTIVE,
        health_score=m.health_score or 100,
        total_uploads=m.total_uploads or 0,
        total_views=m.total_views or 0,
        notes=m.notes,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _model_to_session(m: TikTokSessionModel) -> TikTokSession:
    return TikTokSession(
        id=m.id,
        account_id=m.account_id,
        cookies=m.cookies or {},
        local_storage=m.local_storage,
        session_storage=m.session_storage,
        browser_context=m.browser_context,
        fingerprint_id=m.fingerprint_id,
        is_valid=m.is_valid,
        login_method=m.login_method,
        last_validated_at=m.last_validated_at,
        last_used_at=m.last_used_at,
        validation_error=m.validation_error,
        expires_at=m.expires_at,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _model_to_upload(m: UploadQueueModel) -> UploadJob:
    return UploadJob(
        id=m.id,
        user_id=m.user_id,
        account_id=m.account_id,
        request_log_id=m.request_log_id,
        clip_index=m.clip_index,
        video_path=m.video_path,
        video_size_bytes=m.video_size_bytes,
        video_duration_seconds=m.video_duration_seconds,
        caption=m.caption,
        hashtags=m.hashtags,
        mentions=m.mentions,
        music_id=m.music_id,
        privacy_level=m.privacy_level,
        allow_comments=m.allow_comments,
        allow_duet=m.allow_duet,
        allow_stitch=m.allow_stitch,
        scheduled_at=m.scheduled_at,
        priority=m.priority or 5,
        status=UploadStatus(m.status) if m.status else UploadStatus.PENDING,
        deadline_status=m.deadline_status,
        progress_percent=m.progress_percent or 0,
        tiktok_video_id=m.tiktok_video_id,
        tiktok_url=m.tiktok_url,
        error_message=m.error_message,
        error_code=m.error_code,
        retry_count=m.retry_count or 0,
        max_retries=m.max_retries or 3,
        last_retry_at=m.last_retry_at,
        processing_started_at=m.processing_started_at,
        created_at=m.created_at,
        uploaded_at=m.uploaded_at,
    )


def _model_to_fingerprint(m: BrowserFingerprintModel) -> BrowserFingerprint:
    return BrowserFingerprint(
        id=m.id,
        fingerprint_id=m.fingerprint_id,
        name=m.name,
        user_agent=m.user_agent,
        viewport_width=m.viewport_width,
        viewport_height=m.viewport_height,
        device_scale_factor=m.device_scale_factor or 1.0,
        is_mobile=m.is_mobile or False,
        has_touch=m.has_touch or False,
        platform=m.platform,
        timezone=m.timezone,
        locale=m.locale,
        color_depth=m.color_depth or 24,
        webgl_vendor=m.webgl_vendor,
        webgl_renderer=m.webgl_renderer,
        extra_headers=m.extra_headers,
        extra_args=m.extra_args,
        last_used_at=m.last_used_at,
        use_count=m.use_count or 0,
        is_active=m.is_active,
    )


class TikTokAccountRepository:
    """Repository for TikTok accounts"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, user_id: int, account_name: str, login_type: str,
               login_identifier: str, password_encrypted: str,
               proxy_url: str = None, daily_upload_limit: int = 3,
               notes: str = None) -> TikTokAccount:
        model = TikTokAccountModel(
            user_id=user_id,
            account_name=account_name,
            login_type=login_type,
            login_identifier=login_identifier,
            password_encrypted=password_encrypted,
            proxy_url=proxy_url,
            daily_upload_limit=daily_upload_limit,
            notes=notes,
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_account(model)
    
    def get_by_id(self, account_id: int) -> Optional[TikTokAccount]:
        model = self.session.query(TikTokAccountModel).filter(
            TikTokAccountModel.id == account_id
        ).first()
        return _model_to_account(model) if model else None
    
    def get_by_user_id(self, user_id: int) -> List[TikTokAccount]:
        models = self.session.query(TikTokAccountModel).filter(
            TikTokAccountModel.user_id == user_id
        ).order_by(TikTokAccountModel.created_at.desc()).all()
        return [_model_to_account(m) for m in models]
    
    def get_all(self) -> List[TikTokAccount]:
        models = self.session.query(TikTokAccountModel).order_by(
            TikTokAccountModel.created_at.desc()
        ).all()
        return [_model_to_account(m) for m in models]
    
    def update(self, account_id: int, data: Dict[str, Any]) -> Optional[TikTokAccount]:
        model = self.session.query(TikTokAccountModel).filter(
            TikTokAccountModel.id == account_id
        ).first()
        if not model:
            return None
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_account(model)
    
    def delete(self, account_id: int) -> bool:
        model = self.session.query(TikTokAccountModel).filter(
            TikTokAccountModel.id == account_id
        ).first()
        if not model:
            return False
        self.session.delete(model)
        self.session.commit()
        return True
    
    def get_available_for_upload(self, user_id: int) -> List[TikTokAccount]:
        """Get accounts that haven't hit daily limit and are active"""
        models = self.session.query(TikTokAccountModel).filter(
            TikTokAccountModel.user_id == user_id,
            TikTokAccountModel.status == 'active',
            TikTokAccountModel.uploads_today < TikTokAccountModel.daily_upload_limit
        ).order_by(TikTokAccountModel.uploads_today.asc()).all()
        return [_model_to_account(m) for m in models]
    
    def increment_upload_count(self, account_id: int) -> None:
        model = self.session.query(TikTokAccountModel).filter(
            TikTokAccountModel.id == account_id
        ).first()
        if model:
            model.uploads_today = (model.uploads_today or 0) + 1
            model.total_uploads = (model.total_uploads or 0) + 1
            model.last_upload_at = datetime.now()
            self.session.commit()
    
    def reset_daily_uploads(self) -> int:
        """Reset daily upload counters for all accounts"""
        today = datetime.now().date()
        result = self.session.query(TikTokAccountModel).filter(
            or_(
                TikTokAccountModel.last_upload_reset_date.is_(None),
                TikTokAccountModel.last_upload_reset_date < today
            )
        ).update({
            TikTokAccountModel.uploads_today: 0,
            TikTokAccountModel.last_upload_reset_date: today
        }, synchronize_session=False)
        self.session.commit()
        return result


class SessionRepository:
    """Repository for TikTok sessions"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, account_id: int, cookies: Dict, local_storage: Dict = None,
               session_storage: Dict = None, browser_context: Dict = None,
               fingerprint_id: int = None, login_method: str = None) -> TikTokSession:
        # Invalidate existing sessions
        self.invalidate(account_id)
        
        model = TikTokSessionModel(
            account_id=account_id,
            cookies=cookies,
            local_storage=local_storage,
            session_storage=session_storage,
            browser_context=browser_context,
            fingerprint_id=fingerprint_id,
            login_method=login_method,
            is_valid=True,
            last_validated_at=datetime.now(),
            expires_at=datetime.now() + timedelta(days=7),
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_session(model)
    
    def get_by_account_id(self, account_id: int) -> Optional[TikTokSession]:
        model = self.session.query(TikTokSessionModel).filter(
            TikTokSessionModel.account_id == account_id
        ).order_by(TikTokSessionModel.created_at.desc()).first()
        return _model_to_session(model) if model else None
    
    def get_valid_session(self, account_id: int) -> Optional[TikTokSession]:
        model = self.session.query(TikTokSessionModel).filter(
            TikTokSessionModel.account_id == account_id,
            TikTokSessionModel.is_valid == True,
            or_(
                TikTokSessionModel.expires_at.is_(None),
                TikTokSessionModel.expires_at > datetime.now()
            )
        ).order_by(TikTokSessionModel.created_at.desc()).first()
        return _model_to_session(model) if model else None
    
    def update(self, session_id: int, data: Dict[str, Any]) -> Optional[TikTokSession]:
        model = self.session.query(TikTokSessionModel).filter(
            TikTokSessionModel.id == session_id
        ).first()
        if not model:
            return None
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_session(model)
    
    def invalidate(self, account_id: int, error: str = None) -> None:
        self.session.query(TikTokSessionModel).filter(
            TikTokSessionModel.account_id == account_id,
            TikTokSessionModel.is_valid == True
        ).update({
            TikTokSessionModel.is_valid: False,
            TikTokSessionModel.validation_error: error or "Invalidated"
        }, synchronize_session=False)
        self.session.commit()
    
    def mark_used(self, session_id: int) -> None:
        model = self.session.query(TikTokSessionModel).filter(
            TikTokSessionModel.id == session_id
        ).first()
        if model:
            model.last_used_at = datetime.now()
            self.session.commit()
    
    def delete_expired(self) -> int:
        result = self.session.query(TikTokSessionModel).filter(
            TikTokSessionModel.is_valid == False,
            TikTokSessionModel.updated_at < datetime.now() - timedelta(days=30)
        ).delete(synchronize_session=False)
        self.session.commit()
        return result


class UploadQueueRepository:
    """Repository for upload queue"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, user_id: int, account_id: int, video_path: str,
               request_log_id: int = None, clip_index: int = None,
               caption: str = None, hashtags: List[str] = None,
               scheduled_at: datetime = None, priority: int = 5,
               **kwargs) -> UploadJob:
        model = UploadQueueModel(
            user_id=user_id,
            account_id=account_id,
            video_path=video_path,
            request_log_id=request_log_id,
            clip_index=clip_index,
            caption=caption,
            hashtags=hashtags,
            scheduled_at=scheduled_at,
            priority=priority,
            **kwargs
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_upload(model)
    
    def get_by_id(self, job_id: int) -> Optional[UploadJob]:
        model = self.session.query(UploadQueueModel).filter(
            UploadQueueModel.id == job_id
        ).first()
        return _model_to_upload(model) if model else None
    
    def get_by_user_id(self, user_id: int, status: List[str] = None) -> List[UploadJob]:
        query = self.session.query(UploadQueueModel).filter(
            UploadQueueModel.user_id == user_id
        )
        if status:
            query = query.filter(UploadQueueModel.status.in_(status))
        models = query.order_by(UploadQueueModel.created_at.desc()).all()
        return [_model_to_upload(m) for m in models]
    
    def get_all(self, user_id: int = None, status: List[str] = None) -> List[UploadJob]:
        query = self.session.query(UploadQueueModel)
        if user_id:
            query = query.filter(UploadQueueModel.user_id == user_id)
        if status:
            query = query.filter(UploadQueueModel.status.in_(status))
        models = query.order_by(UploadQueueModel.created_at.desc()).all()
        return [_model_to_upload(m) for m in models]
    
    def get_pending_jobs(self, limit: int = 10) -> List[UploadJob]:
        """Get jobs ready to process"""
        now = datetime.now()
        models = self.session.query(UploadQueueModel).join(
            TikTokAccountModel, UploadQueueModel.account_id == TikTokAccountModel.id
        ).filter(
            UploadQueueModel.status == 'pending',
            TikTokAccountModel.status == 'active',
            or_(
                UploadQueueModel.scheduled_at.is_(None),
                UploadQueueModel.scheduled_at <= now
            )
        ).order_by(
            UploadQueueModel.priority.asc(),
            UploadQueueModel.scheduled_at.asc(),
            UploadQueueModel.created_at.asc()
        ).limit(limit).all()
        return [_model_to_upload(m) for m in models]
    
    def get_by_account_id(self, account_id: int, status: List[str] = None) -> List[UploadJob]:
        query = self.session.query(UploadQueueModel).filter(
            UploadQueueModel.account_id == account_id
        )
        if status:
            query = query.filter(UploadQueueModel.status.in_(status))
        models = query.order_by(UploadQueueModel.created_at.desc()).all()
        return [_model_to_upload(m) for m in models]
    
    def update(self, job_id: int, data: Dict[str, Any]) -> Optional[UploadJob]:
        model = self.session.query(UploadQueueModel).filter(
            UploadQueueModel.id == job_id
        ).first()
        if not model:
            return None
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_upload(model)
    
    def delete(self, job_id: int) -> bool:
        model = self.session.query(UploadQueueModel).filter(
            UploadQueueModel.id == job_id
        ).first()
        if not model:
            return False
        self.session.delete(model)
        self.session.commit()
        return True
    
    def check_conflict(self, account_id: int, scheduled_at: datetime, 
                       min_interval_hours: float = 1.0) -> bool:
        """Check if there's a conflict with existing uploads"""
        interval = timedelta(hours=min_interval_hours)
        start = scheduled_at - interval
        end = scheduled_at + interval
        
        conflict = self.session.query(UploadQueueModel).filter(
            UploadQueueModel.account_id == account_id,
            UploadQueueModel.status.in_(['pending', 'processing', 'published']),
            or_(
                and_(
                    UploadQueueModel.scheduled_at >= start,
                    UploadQueueModel.scheduled_at <= end
                ),
                and_(
                    UploadQueueModel.uploaded_at >= start,
                    UploadQueueModel.uploaded_at <= end
                )
            )
        ).first()
        return conflict is not None
    
    def get_next_available_slot(self, account_id: int, after: datetime,
                                 min_interval_hours: float = 1.0) -> datetime:
        """Find next available upload slot"""
        interval = timedelta(hours=min_interval_hours)
        current = after
        
        for _ in range(48):  # Max 48 hours ahead
            if not self.check_conflict(account_id, current, min_interval_hours):
                return current
            current += interval
        
        return current


class FingerprintRepository:
    """Repository for browser fingerprints"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def get_random_active(self, desktop_only: bool = False) -> Optional[BrowserFingerprint]:
        """Get a random active fingerprint
        
        Args:
            desktop_only: If True, only return desktop fingerprints (is_mobile=False)
        """
        query = self.session.query(BrowserFingerprintModel).filter(
            BrowserFingerprintModel.is_active == True
        )
        if desktop_only:
            query = query.filter(BrowserFingerprintModel.is_mobile == False)
        
        models = query.all()
        if not models:
            # Fallback to any active fingerprint if no desktop found
            models = self.session.query(BrowserFingerprintModel).filter(
                BrowserFingerprintModel.is_active == True
            ).all()
        if not models:
            return None
        model = random.choice(models)
        return _model_to_fingerprint(model)
    
    def get_random_desktop(self) -> Optional[BrowserFingerprint]:
        """Get a random desktop fingerprint (not mobile)"""
        return self.get_random_active(desktop_only=True)
    
    def get_by_id(self, fingerprint_id: int) -> Optional[BrowserFingerprint]:
        model = self.session.query(BrowserFingerprintModel).filter(
            BrowserFingerprintModel.id == fingerprint_id
        ).first()
        return _model_to_fingerprint(model) if model else None
    
    def get_least_used(self) -> Optional[BrowserFingerprint]:
        model = self.session.query(BrowserFingerprintModel).filter(
            BrowserFingerprintModel.is_active == True
        ).order_by(
            BrowserFingerprintModel.use_count.asc(),
            BrowserFingerprintModel.last_used_at.asc()
        ).first()
        return _model_to_fingerprint(model) if model else None
    
    def increment_use_count(self, fingerprint_id: int) -> None:
        model = self.session.query(BrowserFingerprintModel).filter(
            BrowserFingerprintModel.id == fingerprint_id
        ).first()
        if model:
            model.use_count = (model.use_count or 0) + 1
            model.last_used_at = datetime.now()
            self.session.commit()
    
    def get_all_active(self) -> List[BrowserFingerprint]:
        models = self.session.query(BrowserFingerprintModel).filter(
            BrowserFingerprintModel.is_active == True
        ).all()
        return [_model_to_fingerprint(m) for m in models]


class UploadHistoryRepository:
    """Repository for upload history"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, upload_queue_id: int, account_id: int, action: str,
               details: Dict = None, screenshot_path: str = None,
               duration_ms: int = None) -> UploadHistory:
        model = UploadHistoryModel(
            upload_queue_id=upload_queue_id,
            account_id=account_id,
            action=action,
            details=details,
            screenshot_path=screenshot_path,
            duration_ms=duration_ms,
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return UploadHistory(
            id=model.id,
            upload_queue_id=model.upload_queue_id,
            account_id=model.account_id,
            action=model.action,
            details=model.details,
            screenshot_path=model.screenshot_path,
            duration_ms=model.duration_ms,
            created_at=model.created_at,
        )
    
    def get_by_upload_id(self, upload_id: int) -> List[UploadHistory]:
        models = self.session.query(UploadHistoryModel).filter(
            UploadHistoryModel.upload_queue_id == upload_id
        ).order_by(UploadHistoryModel.created_at.asc()).all()
        return [UploadHistory(
            id=m.id,
            upload_queue_id=m.upload_queue_id,
            account_id=m.account_id,
            action=m.action,
            details=m.details,
            screenshot_path=m.screenshot_path,
            duration_ms=m.duration_ms,
            created_at=m.created_at,
        ) for m in models]
    
    def get_by_account_id(self, account_id: int, limit: int = 100) -> List[UploadHistory]:
        models = self.session.query(UploadHistoryModel).filter(
            UploadHistoryModel.account_id == account_id
        ).order_by(UploadHistoryModel.created_at.desc()).limit(limit).all()
        return [UploadHistory(
            id=m.id,
            upload_queue_id=m.upload_queue_id,
            account_id=m.account_id,
            action=m.action,
            details=m.details,
            screenshot_path=m.screenshot_path,
            duration_ms=m.duration_ms,
            created_at=m.created_at,
        ) for m in models]


class UserRepository:
    """Repository for users - for authentication"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def get_by_id(self, user_id: int) -> Optional[UserModel]:
        return self.session.query(UserModel).filter(
            UserModel.id == user_id
        ).first()
    
    def get_by_username(self, username: str) -> Optional[UserModel]:
        return self.session.query(UserModel).filter(
            UserModel.username == username
        ).first()


# ═══════════════════════════════════════════════════════════════════════════
# Multi-Platform Social Media Repositories
# ═══════════════════════════════════════════════════════════════════════════

from .database import SocialAccountModel, SocialSessionModel, SocialUploadQueueModel
from ..domain.entities import (
    SocialAccount, SocialSession, SocialUploadJob, Platform, PrivacyLevel
)


def _model_to_social_account(m: SocialAccountModel) -> SocialAccount:
    """Convert SQLAlchemy model to domain entity"""
    return SocialAccount(
        id=m.id,
        user_id=m.user_id,
        platform=Platform(m.platform) if m.platform else Platform.TIKTOK,
        account_name=m.account_name,
        login_type=LoginType(m.login_type) if m.login_type else LoginType.MANUAL,
        login_identifier=m.login_identifier or '',
        password_encrypted=m.password_encrypted or '',
        platform_username=m.platform_username,
        platform_user_id=m.platform_user_id,
        proxy_url=m.proxy_url,
        daily_upload_limit=m.daily_upload_limit or 3,
        uploads_today=m.uploads_today or 0,
        last_upload_at=m.last_upload_at,
        status=AccountStatus(m.status) if m.status else AccountStatus.ACTIVE,
        health_score=m.health_score or 100,
        total_uploads=m.total_uploads or 0,
        total_views=m.total_views or 0,
        notes=m.notes,
        extra_data=m.extra_data,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _model_to_social_session(m: SocialSessionModel) -> SocialSession:
    return SocialSession(
        id=m.id,
        account_id=m.account_id,
        platform=Platform(m.platform) if m.platform else Platform.TIKTOK,
        cookies=m.cookies or {},
        local_storage=m.local_storage,
        session_storage=m.session_storage,
        browser_context=m.browser_context,
        access_token=m.access_token,
        refresh_token=m.refresh_token,
        token_expires_at=m.token_expires_at,
        fingerprint_id=m.fingerprint_id,
        is_valid=m.is_valid,
        login_method=m.login_method,
        last_validated_at=m.last_validated_at,
        last_used_at=m.last_used_at,
        validation_error=m.validation_error,
        expires_at=m.expires_at,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _model_to_social_upload(m: SocialUploadQueueModel) -> SocialUploadJob:
    return SocialUploadJob(
        id=m.id,
        user_id=m.user_id,
        account_id=m.account_id,
        platform=Platform(m.platform) if m.platform else Platform.TIKTOK,
        request_log_id=m.request_log_id,
        clip_index=m.clip_index,
        video_path=m.video_path,
        video_size_bytes=m.video_size_bytes,
        video_duration_seconds=m.video_duration_seconds,
        title=m.title,
        caption=m.caption,
        hashtags=m.hashtags,
        mentions=m.mentions,
        music_id=m.music_id,
        thumbnail_path=m.thumbnail_path,
        privacy_level=PrivacyLevel(m.privacy_level) if m.privacy_level else PrivacyLevel.PUBLIC,
        allow_comments=m.allow_comments,
        allow_duet=m.allow_duet,
        allow_stitch=m.allow_stitch,
        made_for_kids=m.made_for_kids,
        category_id=m.category_id,
        scheduled_at=m.scheduled_at,
        priority=m.priority or 5,
        status=UploadStatus(m.status) if m.status else UploadStatus.PENDING,
        progress_percent=m.progress_percent or 0,
        platform_video_id=m.platform_video_id,
        platform_url=m.platform_url,
        error_message=m.error_message,
        error_code=m.error_code,
        retry_count=m.retry_count or 0,
        max_retries=m.max_retries or 3,
        last_retry_at=m.last_retry_at,
        processing_started_at=m.processing_started_at,
        created_at=m.created_at,
        uploaded_at=m.uploaded_at,
    )


class SocialAccountRepository:
    """Repository for multi-platform social accounts"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, user_id: int, platform: str, account_name: str, login_type: str,
               login_identifier: str = '', password_encrypted: str = '',
               proxy_url: str = None, daily_upload_limit: int = 3,
               notes: str = None, extra_data: Dict = None) -> SocialAccount:
        model = SocialAccountModel(
            user_id=user_id,
            platform=platform,
            account_name=account_name,
            login_type=login_type,
            login_identifier=login_identifier,
            password_encrypted=password_encrypted,
            proxy_url=proxy_url,
            daily_upload_limit=daily_upload_limit,
            notes=notes,
            extra_data=extra_data,
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_social_account(model)
    
    def get_by_id(self, account_id: int) -> Optional[SocialAccount]:
        model = self.session.query(SocialAccountModel).filter(
            SocialAccountModel.id == account_id
        ).first()
        return _model_to_social_account(model) if model else None
    
    def get_by_user_id(self, user_id: int, platform: str = None) -> List[SocialAccount]:
        query = self.session.query(SocialAccountModel).filter(
            SocialAccountModel.user_id == user_id
        )
        if platform:
            query = query.filter(SocialAccountModel.platform == platform)
        models = query.order_by(SocialAccountModel.created_at.desc()).all()
        return [_model_to_social_account(m) for m in models]
    
    def get_all(self, platform: str = None) -> List[SocialAccount]:
        query = self.session.query(SocialAccountModel)
        if platform:
            query = query.filter(SocialAccountModel.platform == platform)
        models = query.order_by(SocialAccountModel.created_at.desc()).all()
        return [_model_to_social_account(m) for m in models]
    
    def update(self, account_id: int, data: Dict[str, Any]) -> Optional[SocialAccount]:
        model = self.session.query(SocialAccountModel).filter(
            SocialAccountModel.id == account_id
        ).first()
        if not model:
            return None
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_social_account(model)
    
    def delete(self, account_id: int) -> bool:
        model = self.session.query(SocialAccountModel).filter(
            SocialAccountModel.id == account_id
        ).first()
        if not model:
            return False
        self.session.delete(model)
        self.session.commit()
        return True
    
    def get_available_for_upload(self, user_id: int, platform: str = None) -> List[SocialAccount]:
        """Get accounts that haven't hit daily limit and are active"""
        query = self.session.query(SocialAccountModel).filter(
            SocialAccountModel.user_id == user_id,
            SocialAccountModel.status == 'active',
            SocialAccountModel.uploads_today < SocialAccountModel.daily_upload_limit
        )
        if platform:
            query = query.filter(SocialAccountModel.platform == platform)
        models = query.order_by(SocialAccountModel.uploads_today.asc()).all()
        return [_model_to_social_account(m) for m in models]
    
    def increment_upload_count(self, account_id: int) -> None:
        model = self.session.query(SocialAccountModel).filter(
            SocialAccountModel.id == account_id
        ).first()
        if model:
            model.uploads_today = (model.uploads_today or 0) + 1
            model.total_uploads = (model.total_uploads or 0) + 1
            model.last_upload_at = datetime.now()
            self.session.commit()
    
    def reset_daily_uploads(self, platform: str = None) -> int:
        """Reset daily upload counters for all accounts"""
        today = datetime.now().date()
        query = self.session.query(SocialAccountModel).filter(
            or_(
                SocialAccountModel.last_upload_reset_date.is_(None),
                SocialAccountModel.last_upload_reset_date < today
            )
        )
        if platform:
            query = query.filter(SocialAccountModel.platform == platform)
        result = query.update({
            SocialAccountModel.uploads_today: 0,
            SocialAccountModel.last_upload_reset_date: today
        }, synchronize_session=False)
        self.session.commit()
        return result


class SocialSessionRepository:
    """Repository for multi-platform social sessions"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, account_id: int, platform: str, cookies: Dict = None,
               local_storage: Dict = None, session_storage: Dict = None,
               browser_context: Dict = None, access_token: str = None,
               refresh_token: str = None, token_expires_at: datetime = None,
               fingerprint_id: int = None, login_method: str = None) -> SocialSession:
        # Invalidate existing sessions
        self.invalidate(account_id)
        
        model = SocialSessionModel(
            account_id=account_id,
            platform=platform,
            cookies=cookies,
            local_storage=local_storage,
            session_storage=session_storage,
            browser_context=browser_context,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            fingerprint_id=fingerprint_id,
            login_method=login_method,
            is_valid=True,
            last_validated_at=datetime.now(),
            expires_at=datetime.now() + timedelta(days=30),  # Default 30 days
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_social_session(model)
    
    def get_by_account_id(self, account_id: int) -> Optional[SocialSession]:
        model = self.session.query(SocialSessionModel).filter(
            SocialSessionModel.account_id == account_id
        ).order_by(SocialSessionModel.created_at.desc()).first()
        return _model_to_social_session(model) if model else None
    
    def get_valid_session(self, account_id: int) -> Optional[SocialSession]:
        model = self.session.query(SocialSessionModel).filter(
            SocialSessionModel.account_id == account_id,
            SocialSessionModel.is_valid == True,
            or_(
                SocialSessionModel.expires_at.is_(None),
                SocialSessionModel.expires_at > datetime.now()
            )
        ).order_by(SocialSessionModel.created_at.desc()).first()
        return _model_to_social_session(model) if model else None
    
    def update(self, session_id: int, data: Dict[str, Any]) -> Optional[SocialSession]:
        model = self.session.query(SocialSessionModel).filter(
            SocialSessionModel.id == session_id
        ).first()
        if not model:
            return None
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_social_session(model)
    
    def invalidate(self, account_id: int, error: str = None) -> None:
        self.session.query(SocialSessionModel).filter(
            SocialSessionModel.account_id == account_id,
            SocialSessionModel.is_valid == True
        ).update({
            SocialSessionModel.is_valid: False,
            SocialSessionModel.validation_error: error or "Invalidated"
        }, synchronize_session=False)
        self.session.commit()
    
    def mark_used(self, session_id: int) -> None:
        model = self.session.query(SocialSessionModel).filter(
            SocialSessionModel.id == session_id
        ).first()
        if model:
            model.last_used_at = datetime.now()
            self.session.commit()
    
    def delete_expired(self) -> int:
        result = self.session.query(SocialSessionModel).filter(
            SocialSessionModel.is_valid == False,
            SocialSessionModel.updated_at < datetime.now() - timedelta(days=30)
        ).delete(synchronize_session=False)
        self.session.commit()
        return result


class SocialUploadQueueRepository:
    """Repository for multi-platform upload queue"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, user_id: int, account_id: int, platform: str, video_path: str,
               request_log_id: int = None, clip_index: int = None,
               title: str = None, caption: str = None, hashtags: List[str] = None,
               thumbnail_path: str = None, scheduled_at: datetime = None,
               priority: int = 5, privacy_level: str = 'public',
               made_for_kids: bool = False, category_id: str = None,
               **kwargs) -> SocialUploadJob:
        model = SocialUploadQueueModel(
            user_id=user_id,
            account_id=account_id,
            platform=platform,
            video_path=video_path,
            request_log_id=request_log_id,
            clip_index=clip_index,
            title=title,
            caption=caption,
            hashtags=hashtags,
            thumbnail_path=thumbnail_path,
            scheduled_at=scheduled_at,
            priority=priority,
            privacy_level=privacy_level,
            made_for_kids=made_for_kids,
            category_id=category_id,
            **kwargs
        )
        self.session.add(model)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_social_upload(model)
    
    def get_by_id(self, job_id: int) -> Optional[SocialUploadJob]:
        model = self.session.query(SocialUploadQueueModel).filter(
            SocialUploadQueueModel.id == job_id
        ).first()
        return _model_to_social_upload(model) if model else None
    
    def get_by_user_id(self, user_id: int, platform: str = None,
                       status: List[str] = None) -> List[SocialUploadJob]:
        query = self.session.query(SocialUploadQueueModel).filter(
            SocialUploadQueueModel.user_id == user_id
        )
        if platform:
            query = query.filter(SocialUploadQueueModel.platform == platform)
        if status:
            query = query.filter(SocialUploadQueueModel.status.in_(status))
        models = query.order_by(SocialUploadQueueModel.created_at.desc()).all()
        return [_model_to_social_upload(m) for m in models]
    
    def get_all(self, user_id: int = None, platform: str = None,
                status: List[str] = None) -> List[SocialUploadJob]:
        query = self.session.query(SocialUploadQueueModel)
        if user_id:
            query = query.filter(SocialUploadQueueModel.user_id == user_id)
        if platform:
            query = query.filter(SocialUploadQueueModel.platform == platform)
        if status:
            query = query.filter(SocialUploadQueueModel.status.in_(status))
        models = query.order_by(SocialUploadQueueModel.created_at.desc()).all()
        return [_model_to_social_upload(m) for m in models]
    
    def get_pending_jobs(self, platform: str = None, limit: int = 10) -> List[SocialUploadJob]:
        """Get jobs ready to process"""
        now = datetime.now()
        query = self.session.query(SocialUploadQueueModel).join(
            SocialAccountModel, SocialUploadQueueModel.account_id == SocialAccountModel.id
        ).filter(
            SocialUploadQueueModel.status == 'pending',
            SocialAccountModel.status == 'active',
            or_(
                SocialUploadQueueModel.scheduled_at.is_(None),
                SocialUploadQueueModel.scheduled_at <= now
            )
        )
        if platform:
            query = query.filter(SocialUploadQueueModel.platform == platform)
        
        models = query.order_by(
            SocialUploadQueueModel.priority.asc(),
            SocialUploadQueueModel.scheduled_at.asc(),
            SocialUploadQueueModel.created_at.asc()
        ).limit(limit).all()
        return [_model_to_social_upload(m) for m in models]
    
    def get_by_account_id(self, account_id: int, status: List[str] = None) -> List[SocialUploadJob]:
        query = self.session.query(SocialUploadQueueModel).filter(
            SocialUploadQueueModel.account_id == account_id
        )
        if status:
            query = query.filter(SocialUploadQueueModel.status.in_(status))
        models = query.order_by(SocialUploadQueueModel.created_at.desc()).all()
        return [_model_to_social_upload(m) for m in models]
    
    def update(self, job_id: int, data: Dict[str, Any]) -> Optional[SocialUploadJob]:
        model = self.session.query(SocialUploadQueueModel).filter(
            SocialUploadQueueModel.id == job_id
        ).first()
        if not model:
            return None
        for key, value in data.items():
            if hasattr(model, key):
                setattr(model, key, value)
        self.session.commit()
        self.session.refresh(model)
        return _model_to_social_upload(model)
    
    def delete(self, job_id: int) -> bool:
        model = self.session.query(SocialUploadQueueModel).filter(
            SocialUploadQueueModel.id == job_id
        ).first()
        if not model:
            return False
        self.session.delete(model)
        self.session.commit()
        return True
    
    def check_conflict(self, account_id: int, scheduled_at: datetime, 
                       min_interval_hours: float = 1.0) -> bool:
        """Check if there's a conflict with existing uploads"""
        interval = timedelta(hours=min_interval_hours)
        start = scheduled_at - interval
        end = scheduled_at + interval
        
        conflict = self.session.query(SocialUploadQueueModel).filter(
            SocialUploadQueueModel.account_id == account_id,
            SocialUploadQueueModel.status.in_(['pending', 'processing', 'published']),
            or_(
                and_(
                    SocialUploadQueueModel.scheduled_at >= start,
                    SocialUploadQueueModel.scheduled_at <= end
                ),
                and_(
                    SocialUploadQueueModel.uploaded_at >= start,
                    SocialUploadQueueModel.uploaded_at <= end
                )
            )
        ).first()
        return conflict is not None
    
    def get_next_available_slot(self, account_id: int, after: datetime,
                                 min_interval_hours: float = 1.0) -> datetime:
        """Find next available upload slot"""
        interval = timedelta(hours=min_interval_hours)
        current = after
        
        for _ in range(48):  # Max 48 hours ahead
            if not self.check_conflict(account_id, current, min_interval_hours):
                return current
            current += interval
        
        return current
