"""
Domain Interfaces - Abstract base classes for repositories and services
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime
from .entities import (
    TikTokAccount, TikTokSession, UploadJob, BrowserFingerprint,
    UploadHistory, PendingVerification, AccountWarmup, CaptionTemplate,
    VideoPerformance
)


class ITikTokAccountRepository(ABC):
    """Repository interface for TikTok accounts"""
    
    @abstractmethod
    def create(self, account: TikTokAccount) -> TikTokAccount:
        pass
    
    @abstractmethod
    def get_by_id(self, account_id: int) -> Optional[TikTokAccount]:
        pass
    
    @abstractmethod
    def get_by_user_id(self, user_id: int) -> List[TikTokAccount]:
        pass
    
    @abstractmethod
    def get_all(self) -> List[TikTokAccount]:
        pass
    
    @abstractmethod
    def update(self, account_id: int, data: Dict[str, Any]) -> Optional[TikTokAccount]:
        pass
    
    @abstractmethod
    def delete(self, account_id: int) -> bool:
        pass
    
    @abstractmethod
    def get_available_for_upload(self, user_id: int) -> List[TikTokAccount]:
        """Get accounts that haven't hit daily limit"""
        pass
    
    @abstractmethod
    def increment_upload_count(self, account_id: int) -> None:
        pass
    
    @abstractmethod
    def reset_daily_uploads(self) -> int:
        """Reset daily upload counters, return count of accounts reset"""
        pass


class ISessionRepository(ABC):
    """Repository interface for TikTok sessions"""
    
    @abstractmethod
    def create(self, session: TikTokSession) -> TikTokSession:
        pass
    
    @abstractmethod
    def get_by_account_id(self, account_id: int) -> Optional[TikTokSession]:
        pass
    
    @abstractmethod
    def get_valid_session(self, account_id: int) -> Optional[TikTokSession]:
        pass
    
    @abstractmethod
    def update(self, session_id: int, data: Dict[str, Any]) -> Optional[TikTokSession]:
        pass
    
    @abstractmethod
    def invalidate(self, account_id: int, error: str = None) -> None:
        pass
    
    @abstractmethod
    def delete_expired(self) -> int:
        pass


class IUploadQueueRepository(ABC):
    """Repository interface for upload queue"""
    
    @abstractmethod
    def create(self, job: UploadJob) -> UploadJob:
        pass
    
    @abstractmethod
    def get_by_id(self, job_id: int) -> Optional[UploadJob]:
        pass
    
    @abstractmethod
    def get_by_user_id(self, user_id: int, status: List[str] = None) -> List[UploadJob]:
        pass
    
    @abstractmethod
    def get_pending_jobs(self, limit: int = 10) -> List[UploadJob]:
        """Get jobs ready to process (pending + scheduled_at <= now)"""
        pass
    
    @abstractmethod
    def get_by_account_id(self, account_id: int, status: List[str] = None) -> List[UploadJob]:
        pass
    
    @abstractmethod
    def update(self, job_id: int, data: Dict[str, Any]) -> Optional[UploadJob]:
        pass
    
    @abstractmethod
    def delete(self, job_id: int) -> bool:
        pass
    
    @abstractmethod
    def check_conflict(self, account_id: int, scheduled_at: datetime) -> bool:
        """Check if there's a conflict with existing uploads"""
        pass
    
    @abstractmethod
    def get_next_available_slot(self, account_id: int, after: datetime) -> datetime:
        pass


class IFingerprintRepository(ABC):
    """Repository interface for browser fingerprints"""
    
    @abstractmethod
    def get_random_active(self) -> Optional[BrowserFingerprint]:
        pass
    
    @abstractmethod
    def get_by_id(self, fingerprint_id: int) -> Optional[BrowserFingerprint]:
        pass
    
    @abstractmethod
    def get_least_used(self) -> Optional[BrowserFingerprint]:
        pass
    
    @abstractmethod
    def increment_use_count(self, fingerprint_id: int) -> None:
        pass


class IUploadHistoryRepository(ABC):
    """Repository interface for upload history"""
    
    @abstractmethod
    def create(self, history: UploadHistory) -> UploadHistory:
        pass
    
    @abstractmethod
    def get_by_upload_id(self, upload_id: int) -> List[UploadHistory]:
        pass
    
    @abstractmethod
    def get_by_account_id(self, account_id: int, limit: int = 100) -> List[UploadHistory]:
        pass


class IVerificationRepository(ABC):
    """Repository interface for pending verifications"""
    
    @abstractmethod
    def create(self, verification: PendingVerification) -> PendingVerification:
        pass
    
    @abstractmethod
    def get_pending_by_account(self, account_id: int) -> Optional[PendingVerification]:
        pass
    
    @abstractmethod
    def update_status(self, verification_id: int, status: str, solved_by: str = None) -> None:
        pass
    
    @abstractmethod
    def get_timeout_verifications(self) -> List[PendingVerification]:
        pass


class IEncryptionService(ABC):
    """Service interface for encryption"""
    
    @abstractmethod
    def encrypt(self, plaintext: str) -> str:
        pass
    
    @abstractmethod
    def decrypt(self, ciphertext: str) -> str:
        pass


class IBrowserManager(ABC):
    """Service interface for browser management"""
    
    @abstractmethod
    async def create_context(self, fingerprint: BrowserFingerprint, proxy_url: str = None) -> Any:
        pass
    
    @abstractmethod
    async def close_context(self, context_id: str) -> None:
        pass
    
    @abstractmethod
    async def close_all(self) -> None:
        pass


class ITikTokAutomation(ABC):
    """Service interface for TikTok automation"""
    
    @abstractmethod
    async def login(self, account: TikTokAccount, session: TikTokSession = None) -> TikTokSession:
        pass
    
    @abstractmethod
    async def validate_session(self, account: TikTokAccount, session: TikTokSession) -> bool:
        pass
    
    @abstractmethod
    async def upload_video(self, account: TikTokAccount, job: UploadJob, 
                          session: TikTokSession) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    async def warm_session(self, account: TikTokAccount, session: TikTokSession, 
                          duration_seconds: int = 45) -> None:
        pass


class IAlertService(ABC):
    """Service interface for alerting"""
    
    @abstractmethod
    async def send_telegram(self, message: str, level: str = "info") -> bool:
        pass
    
    @abstractmethod
    async def send_email(self, subject: str, message: str, level: str = "critical") -> bool:
        pass
    
    @abstractmethod
    async def broadcast_websocket(self, event: str, data: Dict[str, Any]) -> None:
        pass
