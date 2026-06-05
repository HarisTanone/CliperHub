"""
Application Services - Business Logic Layer
"""
import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from ..domain.entities import (
    TikTokAccount, TikTokSession, UploadJob, BrowserFingerprint,
    UploadStatus, AccountStatus, CreateAccountRequest, UploadFromClipRequest
)
from ..infrastructure.database import database
from ..infrastructure.repositories import (
    TikTokAccountRepository, SessionRepository, UploadQueueRepository,
    FingerprintRepository, UploadHistoryRepository
)
from ..infrastructure.encryption import encryption_service
from ..infrastructure.tiktok_automation import tiktok_automation
from ..infrastructure.browser_manager import browser_manager

logger = logging.getLogger(__name__)


class AccountService:
    """Service for managing TikTok accounts"""
    
    def create_account(self, user_id: int, request: CreateAccountRequest) -> TikTokAccount:
        """Create a new TikTok account"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            
            # For manual login, we don't need credentials
            if request.login_type == "manual":
                encrypted_password = ""  # No password for manual login
                login_identifier = request.login_identifier or ""
            else:
                # Auto login requires credentials
                if not request.password:
                    raise ValueError("Password is required for auto login")
                if not request.login_identifier:
                    raise ValueError("Login identifier (email/phone/username) is required for auto login")
                encrypted_password = encryption_service.encrypt(request.password)
                login_identifier = request.login_identifier
            
            account = repo.create(
                user_id=user_id,
                account_name=request.account_name,
                login_type=request.login_type,
                login_identifier=login_identifier,
                password_encrypted=encrypted_password,
                proxy_url=request.proxy_url,
                daily_upload_limit=request.daily_upload_limit,
                notes=request.notes,
            )
            
            logger.info(f"Created TikTok account: {account.account_name} for user {user_id} (login_type: {request.login_type})")
            return account
        finally:
            session.close()
    
    def get_accounts_by_user(self, user_id: int) -> List[TikTokAccount]:
        """Get all accounts for a user"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            return repo.get_by_user_id(user_id)
        finally:
            session.close()
    
    def get_all_accounts(self) -> List[TikTokAccount]:
        """Get all accounts (admin only)"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            return repo.get_all()
        finally:
            session.close()
    
    def get_account(self, account_id: int) -> Optional[TikTokAccount]:
        """Get account by ID"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            return repo.get_by_id(account_id)
        finally:
            session.close()
    
    def update_account(self, account_id: int, data: Dict[str, Any]) -> Optional[TikTokAccount]:
        """Update account details"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            
            # If password is being updated, encrypt it
            if 'password' in data:
                data['password_encrypted'] = encryption_service.encrypt(data.pop('password'))
            
            return repo.update(account_id, data)
        finally:
            session.close()
    
    def delete_account(self, account_id: int) -> bool:
        """Delete an account"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            return repo.delete(account_id)
        finally:
            session.close()
    
    def get_available_accounts(self, user_id: int) -> List[TikTokAccount]:
        """Get accounts available for upload (not at daily limit)"""
        session = database.get_session()
        try:
            repo = TikTokAccountRepository(session)
            return repo.get_available_for_upload(user_id)
        finally:
            session.close()
    
    async def trigger_login(self, account_id: int, manual: bool = False) -> Dict[str, Any]:
        """
        Trigger login for an account
        
        Args:
            account_id: The account ID
            manual: If True, open browser for manual login (no credentials needed)
        """
        session = database.get_session()
        try:
            account_repo = TikTokAccountRepository(session)
            session_repo = SessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            
            account = account_repo.get_by_id(account_id)
            if not account:
                return {"success": False, "message": "Account not found"}
            
            # Get fingerprint - USE DESKTOP ONLY for login (mobile UI is different)
            fingerprint = fingerprint_repo.get_random_desktop()
            if not fingerprint:
                # Fallback to any fingerprint if no desktop available
                fingerprint = fingerprint_repo.get_least_used()
            if not fingerprint:
                return {"success": False, "message": "No fingerprints available"}
            
            logger.info(f"Using fingerprint: {fingerprint.fingerprint_id} (is_mobile={fingerprint.is_mobile})")
            
            # Determine login method
            is_manual = manual or account.login_type == "manual"
            
            if is_manual:
                # Manual login - open browser and wait for user
                logger.info(f"Starting manual login for account {account.account_name}")
                result = await tiktok_automation.manual_login(account_id, fingerprint)
            else:
                # Auto login with credentials
                existing_session = session_repo.get_valid_session(account_id)
                result = await tiktok_automation.login(account, fingerprint, existing_session)
            
            if result.get("success"):
                # Save session
                session_repo.create(
                    account_id=account_id,
                    cookies=result.get("cookies", []),
                    fingerprint_id=fingerprint.id,
                    login_method=result.get("login_method", account.login_type),
                )
                
                # Update account with TikTok username
                update_data = {"status": "active"}
                if result.get("tiktok_username"):
                    update_data["tiktok_username"] = result["tiktok_username"]
                
                account_repo.update(account_id, update_data)
                
                # Update fingerprint usage
                fingerprint_repo.increment_use_count(fingerprint.id)
                
            elif result.get("needs_verification"):
                # Update account status
                account_repo.update(account_id, {
                    "status": result.get("verification_type", "needs_verification"),
                })
            else:
                # Login failed - check error type
                error_msg = result.get("message", "")
                error_code = result.get("error_code", "")
                
                # Check for rate limiting
                if "RATE_LIMITED" in error_msg or "rate" in error_msg.lower() or "frekuensi" in error_msg.lower():
                    logger.warning(f"Rate limiting detected for account {account_id}")
                    # DON'T delete account on rate limiting - it's a temporary issue
                    return {
                        "success": False,
                        "message": error_msg,
                        "error_code": "RATE_LIMITED",
                        "suggestion": "Coba lagi dalam 15-30 menit dengan fingerprint/IP berbeda. Gunakan Manual Login untuk menghindari deteksi.",
                    }
                
                # Check for invalid credentials - delete the account since it won't work
                if "INVALID_CREDENTIALS" in error_msg or error_code == "INVALID_CREDENTIALS":
                    logger.warning(f"Invalid credentials for account {account_id}, deleting account")
                    account_repo.delete(account_id)
                    return {
                        "success": False,
                        "message": error_msg,
                        "error_code": "INVALID_CREDENTIALS",
                        "account_deleted": True,
                    }
                
                # Check for banned/suspended accounts
                if "ACCOUNT_BANNED" in error_msg or "ACCOUNT_SUSPENDED" in error_msg or "ACCOUNT_LOCKED" in error_msg:
                    logger.warning(f"Account {account_id} is banned/suspended, deleting")
                    account_repo.delete(account_id)
                    return {
                        "success": False,
                        "message": error_msg,
                        "error_code": result.get("error_code", "ACCOUNT_ISSUE"),
                        "account_deleted": True,
                    }
            
            return result
        finally:
            session.close()
    
    async def validate_session(self, account_id: int) -> Dict[str, Any]:
        """Validate account session"""
        session = database.get_session()
        try:
            account_repo = TikTokAccountRepository(session)
            session_repo = SessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            
            account = account_repo.get_by_id(account_id)
            if not account:
                return {"valid": False, "message": "Account not found"}
            
            existing_session = session_repo.get_valid_session(account_id)
            if not existing_session:
                return {"valid": False, "message": "No valid session found"}
            
            # Get fingerprint
            fingerprint = None
            if existing_session.fingerprint_id:
                fingerprint = fingerprint_repo.get_by_id(existing_session.fingerprint_id)
            if not fingerprint:
                fingerprint = fingerprint_repo.get_least_used()
            if not fingerprint:
                return {"valid": False, "message": "No fingerprints available"}
            
            result = await tiktok_automation.validate_session(account, existing_session, fingerprint)
            
            if result.get("valid"):
                # Update session with fresh cookies
                session_repo.update(existing_session.id, {
                    "cookies": result.get("cookies"),
                    "last_validated_at": datetime.now(),
                    "is_valid": True,
                })
            else:
                # Invalidate session
                session_repo.invalidate(account_id, result.get("reason"))
            
            return result
        finally:
            session.close()


class UploadService:
    """Service for managing upload queue"""
    
    def __init__(self):
        self.min_upload_interval = int(os.getenv("MIN_UPLOAD_INTERVAL_SECONDS", "3600"))
    
    def create_upload_from_clip(self, user_id: int, request: UploadFromClipRequest) -> UploadJob:
        """Create upload job from AutoCliper clip"""
        session = database.get_session()
        try:
            account_repo = TikTokAccountRepository(session)
            queue_repo = UploadQueueRepository(session)
            
            # Verify account belongs to user
            account = account_repo.get_by_id(request.account_id)
            if not account or account.user_id != user_id:
                raise ValueError("Account not found or access denied")
            
            # Daily upload limit check removed - unlimited uploads allowed
            
            # Build video path from request_log
            autocliper_output = os.getenv("AUTOCLIPER_OUTPUT_DIR", "../autocliper-v2/tmp/output")
            video_path = os.path.join(autocliper_output, f"job_{request.request_log_id}", f"clip_{request.clip_index}_final.mp4")
            
            if not os.path.exists(video_path):
                # Try alternative paths
                alt_paths = [
                    os.path.join(autocliper_output, str(request.request_log_id), f"clip_{request.clip_index}_final.mp4"),
                ]
                for alt in alt_paths:
                    if os.path.exists(alt):
                        video_path = alt
                        break
                else:
                    raise FileNotFoundError(f"Video file not found: {video_path}")
            
            # Check for scheduling conflicts
            scheduled_at = request.scheduled_at
            if scheduled_at:
                min_interval = self.min_upload_interval / 3600  # Convert to hours
                if queue_repo.check_conflict(request.account_id, scheduled_at, min_interval):
                    # Find next available slot
                    scheduled_at = queue_repo.get_next_available_slot(
                        request.account_id, scheduled_at, min_interval
                    )
            
            # Create upload job
            job = queue_repo.create(
                user_id=user_id,
                account_id=request.account_id,
                video_path=video_path,
                request_log_id=request.request_log_id,
                clip_index=request.clip_index,
                caption=request.caption,
                hashtags=request.hashtags,
                scheduled_at=scheduled_at,
                privacy_level=request.privacy_level,
                priority=1 if not scheduled_at else 5,  # Immediate uploads get higher priority
            )
            
            logger.info(f"Created upload job {job.id} for user {user_id}")
            return job
        finally:
            session.close()
    
    def get_queue(self, user_id: int = None, status: List[str] = None) -> List[UploadJob]:
        """Get upload queue"""
        session = database.get_session()
        try:
            repo = UploadQueueRepository(session)
            return repo.get_all(user_id=user_id, status=status)
        finally:
            session.close()
    
    def get_upload(self, upload_id: int) -> Optional[UploadJob]:
        """Get upload job by ID"""
        session = database.get_session()
        try:
            repo = UploadQueueRepository(session)
            return repo.get_by_id(upload_id)
        finally:
            session.close()
    
    def update_upload(self, upload_id: int, data: Dict[str, Any]) -> Optional[UploadJob]:
        """Update upload job"""
        session = database.get_session()
        try:
            repo = UploadQueueRepository(session)
            return repo.update(upload_id, data)
        finally:
            session.close()
    
    def cancel_upload(self, upload_id: int) -> bool:
        """Cancel an upload job"""
        session = database.get_session()
        try:
            repo = UploadQueueRepository(session)
            job = repo.get_by_id(upload_id)
            if not job:
                return False
            
            if job.status in ['pending', 'processing']:
                repo.update(upload_id, {"status": "cancelled"})
                return True
            return False
        finally:
            session.close()
    
    def retry_upload(self, upload_id: int) -> Optional[UploadJob]:
        """Retry a failed upload"""
        session = database.get_session()
        try:
            repo = UploadQueueRepository(session)
            job = repo.get_by_id(upload_id)
            if not job or job.status != "failed":
                return None
            
            if job.retry_count >= job.max_retries:
                return None
            
            return repo.update(upload_id, {
                "status": "pending",
                "retry_count": job.retry_count + 1,
                "last_retry_at": datetime.now(),
                "error_message": None,
                "error_code": None,
            })
        finally:
            session.close()
    
    def get_upload_history(self, upload_id: int) -> List[Dict]:
        """Get upload event history"""
        session = database.get_session()
        try:
            repo = UploadHistoryRepository(session)
            history = repo.get_by_upload_id(upload_id)
            return [
                {
                    "id": h.id,
                    "action": h.action,
                    "details": h.details,
                    "screenshot_path": h.screenshot_path,
                    "duration_ms": h.duration_ms,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
                for h in history
            ]
        finally:
            session.close()
    
    def suggest_schedule(self, account_id: int, clips_count: int = 1) -> List[Dict]:
        """Suggest optimal upload times for clips"""
        session = database.get_session()
        try:
            queue_repo = UploadQueueRepository(session)
            
            # Start from next hour
            now = datetime.now()
            start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            
            # Best hours for TikTok engagement (local time)
            best_hours = [10, 14, 17, 19, 21]
            
            suggestions = []
            current = start
            
            for i in range(clips_count):
                # Find next best hour
                for _ in range(48):  # Max 48 hours ahead
                    if current.hour in best_hours:
                        # Check for conflicts
                        if not queue_repo.check_conflict(account_id, current, 1.0):
                            suggestions.append({
                                "datetime": current.isoformat(),
                                "confidence": 0.85 if current.hour in [19, 21] else 0.7,
                                "reason": f"Optimal posting time ({current.hour}:00)",
                            })
                            current = current + timedelta(hours=1)
                            break
                    current = current + timedelta(hours=1)
            
            return suggestions
        finally:
            session.close()


class UploadWorker:
    """Background worker for processing upload queue"""
    
    def __init__(self):
        self._running = False
        self._task = None
    
    async def start(self):
        """Start the upload worker"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._process_loop())
        logger.info("Upload worker started")
    
    async def stop(self):
        """Stop the upload worker"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        await browser_manager.close_all()
        logger.info("Upload worker stopped")
    
    async def _process_loop(self):
        """Main processing loop"""
        while self._running:
            try:
                await self._process_next_job()
                await asyncio.sleep(10)  # Check every 10 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker error: {e}", exc_info=True)
                await asyncio.sleep(30)  # Wait before retrying
    
    async def _process_next_job(self):
        """Process the next job in queue"""
        session = database.get_session()
        try:
            queue_repo = UploadQueueRepository(session)
            account_repo = TikTokAccountRepository(session)
            session_repo = SessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            history_repo = UploadHistoryRepository(session)
            
            # Get next pending job
            pending = queue_repo.get_pending_jobs(limit=1)
            if not pending:
                return
            
            job = pending[0]
            
            # Check if we can process (max concurrent browsers)
            max_concurrent = int(os.getenv("MAX_CONCURRENT_BROWSERS", "2"))
            if browser_manager.get_active_contexts_count() >= max_concurrent:
                return
            
            # Update job status
            queue_repo.update(job.id, {
                "status": "processing",
                "processing_started_at": datetime.now(),
            })
            
            # Log start
            history_repo.create(job.id, job.account_id, "processing_started")
            
            # Get account
            account = account_repo.get_by_id(job.account_id)
            if not account or account.status != "active":
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_code": "ACCOUNT_UNAVAILABLE",
                    "error_message": "Account not available",
                })
                return
            
            # Daily upload limit check removed - unlimited uploads allowed
            
            # Get session
            valid_session = session_repo.get_valid_session(job.account_id)
            if not valid_session:
                # Try to login
                logger.info(f"No valid session for account {account.id}, attempting login...")
                # Use desktop fingerprint for login (mobile UI is different)
                fingerprint = fingerprint_repo.get_random_desktop()
                if not fingerprint:
                    fingerprint = fingerprint_repo.get_least_used()
                if not fingerprint:
                    queue_repo.update(job.id, {
                        "status": "failed",
                        "error_code": "NO_FINGERPRINT",
                        "error_message": "No browser fingerprints available",
                    })
                    return
                
                history_repo.create(job.id, job.account_id, "login_started")
                
                login_result = await tiktok_automation.login(account, fingerprint)
                
                if not login_result.get("success"):
                    history_repo.create(job.id, job.account_id, "login_failed", {
                        "error": login_result.get("message"),
                    })
                    
                    if login_result.get("needs_verification"):
                        account_repo.update(account.id, {"status": "needs_verification"})
                    
                    queue_repo.update(job.id, {
                        "status": "failed",
                        "error_code": login_result.get("error_code", "LOGIN_FAILED"),
                        "error_message": login_result.get("message"),
                    })
                    return
                
                # Save new session
                valid_session = session_repo.create(
                    account_id=account.id,
                    cookies=login_result.get("cookies", []),
                    fingerprint_id=fingerprint.id,
                    login_method=account.login_type,
                )
                
                # Update account
                if login_result.get("tiktok_username"):
                    account_repo.update(account.id, {
                        "tiktok_username": login_result["tiktok_username"],
                    })
                
                fingerprint_repo.increment_use_count(fingerprint.id)
                history_repo.create(job.id, job.account_id, "login_success")
            
            # Get fingerprint for upload
            fingerprint = None
            if valid_session.fingerprint_id:
                fingerprint = fingerprint_repo.get_by_id(valid_session.fingerprint_id)
            if not fingerprint:
                fingerprint = fingerprint_repo.get_least_used()
            
            if not fingerprint:
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_code": "NO_FINGERPRINT",
                    "error_message": "No browser fingerprints available",
                })
                return
            
            # Progress callback
            async def on_progress(percent, message):
                queue_repo.update(job.id, {"progress_percent": percent})
                history_repo.create(job.id, job.account_id, "upload_progress", {
                    "percent": percent,
                    "message": message,
                })
            
            # Perform upload
            history_repo.create(job.id, job.account_id, "upload_started")
            
            result = await tiktok_automation.upload_video(
                account=account,
                job=job,
                session=valid_session,
                fingerprint=fingerprint,
                on_progress=on_progress,
            )
            
            if result.get("success"):
                # Update job
                queue_repo.update(job.id, {
                    "status": "published",
                    "progress_percent": 100,
                    "tiktok_video_id": result.get("tiktok_video_id"),
                    "tiktok_url": result.get("tiktok_url"),
                    "uploaded_at": datetime.now(),
                })
                
                # Update account
                account_repo.increment_upload_count(account.id)
                
                history_repo.create(job.id, job.account_id, "upload_success", {
                    "video_id": result.get("tiktok_video_id"),
                    "url": result.get("tiktok_url"),
                })
                
                logger.info(f"Upload job {job.id} completed successfully")
            else:
                # Handle failure
                should_retry = job.retry_count < job.max_retries
                
                queue_repo.update(job.id, {
                    "status": "pending" if should_retry else "failed",
                    "error_code": result.get("error_code"),
                    "error_message": result.get("message"),
                    "retry_count": job.retry_count + 1 if should_retry else job.retry_count,
                    "last_retry_at": datetime.now() if should_retry else None,
                })
                
                history_repo.create(job.id, job.account_id, "upload_failed", {
                    "error": result.get("message"),
                    "retry": should_retry,
                })
                
                # Handle session expiry
                if result.get("error_code") == "SESSION_EXPIRED":
                    session_repo.invalidate(account.id, "Session expired during upload")
                
                logger.warning(f"Upload job {job.id} failed: {result.get('message')}")
        
        finally:
            session.close()


# ═══════════════════════════════════════════════════════════════════════════
# Multi-Platform Social Media Services
# ═══════════════════════════════════════════════════════════════════════════

from ..domain.entities import (
    SocialAccount, SocialSession, SocialUploadJob, Platform, PLATFORM_INFO
)
from ..infrastructure.repositories import (
    SocialAccountRepository, SocialSessionRepository, SocialUploadQueueRepository
)


class SocialAccountService:
    """Service for managing multi-platform social accounts"""
    
    def create_account(self, user_id: int, platform: str, account_name: str,
                       login_type: str = 'manual', login_identifier: str = None,
                       password: str = None, proxy_url: str = None,
                       daily_upload_limit: int = 3, notes: str = None) -> SocialAccount:
        """Create a new social media account"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            
            # Validate platform
            try:
                Platform(platform)
            except ValueError:
                raise ValueError(f"Invalid platform: {platform}")
            
            # Encrypt password if provided
            encrypted_password = ""
            if password and login_type != "manual":
                encrypted_password = encryption_service.encrypt(password)
            
            account = repo.create(
                user_id=user_id,
                platform=platform,
                account_name=account_name,
                login_type=login_type,
                login_identifier=login_identifier or "",
                password_encrypted=encrypted_password,
                proxy_url=proxy_url,
                daily_upload_limit=daily_upload_limit,
                notes=notes,
            )
            
            logger.info(f"Created {platform} account: {account_name} for user {user_id}")
            return account
        finally:
            session.close()
    
    def get_accounts_by_user(self, user_id: int, platform: str = None) -> List[SocialAccount]:
        """Get all accounts for a user, optionally filtered by platform"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            return repo.get_by_user_id(user_id, platform)
        finally:
            session.close()
    
    def get_all_accounts(self, platform: str = None) -> List[SocialAccount]:
        """Get all accounts (admin only)"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            return repo.get_all(platform)
        finally:
            session.close()
    
    def get_account(self, account_id: int) -> Optional[SocialAccount]:
        """Get account by ID"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            return repo.get_by_id(account_id)
        finally:
            session.close()
    
    def update_account(self, account_id: int, data: Dict[str, Any]) -> Optional[SocialAccount]:
        """Update account details"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            
            if 'password' in data and data['password']:
                data['password_encrypted'] = encryption_service.encrypt(data.pop('password'))
            elif 'password' in data:
                del data['password']
            
            return repo.update(account_id, data)
        finally:
            session.close()
    
    def delete_account(self, account_id: int) -> bool:
        """Delete an account"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            return repo.delete(account_id)
        finally:
            session.close()
    
    def get_available_accounts(self, user_id: int, platform: str = None) -> List[SocialAccount]:
        """Get accounts available for upload"""
        session = database.get_session()
        try:
            repo = SocialAccountRepository(session)
            return repo.get_available_for_upload(user_id, platform)
        finally:
            session.close()
    
    async def trigger_login(self, account_id: int, manual: bool = False) -> Dict[str, Any]:
        """Trigger login for a social media account"""
        session = database.get_session()
        try:
            account_repo = SocialAccountRepository(session)
            session_repo = SocialSessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            
            account = account_repo.get_by_id(account_id)
            if not account:
                return {"success": False, "message": "Account not found"}
            
            # Get fingerprint
            fingerprint = fingerprint_repo.get_random_desktop()
            if not fingerprint:
                fingerprint = fingerprint_repo.get_least_used()
            if not fingerprint:
                return {"success": False, "message": "No fingerprints available"}
            
            is_manual = manual or account.login_type == "manual"
            
            # Route to platform-specific automation
            platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
            
            if platform == 'youtube':
                # YouTube uses persistent browser profiles
                from ..infrastructure.youtube_automation import YouTubeAutomation
                youtube = YouTubeAutomation()
                
                # Always use setup_account for YouTube (persistent profile)
                result = await youtube.setup_account(account_id, fingerprint)
                
                if result.get("success"):
                    # For YouTube with persistent profiles, we don't store cookies
                    # Session is stored in browser profile directory
                    session_repo.create(
                        account_id=account_id,
                        platform=platform,
                        cookies=[],  # Cookies stored in profile, not DB
                        fingerprint_id=fingerprint.id,
                        login_method="persistent_profile",
                    )
                    
                    # Update account
                    update_data = {"status": "active"}
                    if result.get("platform_username"):
                        update_data["platform_username"] = result["platform_username"]
                    account_repo.update(account_id, update_data)
                    fingerprint_repo.increment_use_count(fingerprint.id)
                
                return result
                
            elif platform == 'tiktok':
                if is_manual:
                    result = await tiktok_automation.manual_login(account_id, fingerprint)
                else:
                    existing_session = session_repo.get_valid_session(account_id)
                    result = await tiktok_automation.login(account, fingerprint, existing_session)
                    
                if result.get("success"):
                    # Save session
                    session_repo.create(
                        account_id=account_id,
                        platform=platform,
                        cookies=result.get("cookies", []),
                        fingerprint_id=fingerprint.id,
                        login_method=result.get("login_method", account.login_type),
                    )
                    
                    # Update account
                    update_data = {"status": "active"}
                    if result.get("tiktok_username"):
                        update_data["platform_username"] = result["tiktok_username"]
                    
                    account_repo.update(account_id, update_data)
                    fingerprint_repo.increment_use_count(fingerprint.id)
                    
                elif result.get("needs_verification"):
                    account_repo.update(account_id, {
                        "status": result.get("verification_type", "needs_verification"),
                    })
                else:
                    # Handle login failure
                    error_msg = result.get("message", "")
                    error_code = result.get("error_code", "")
                    
                    if "INVALID_CREDENTIALS" in error_msg or error_code == "INVALID_CREDENTIALS":
                        account_repo.delete(account_id)
                        return {
                            "success": False,
                            "message": error_msg,
                            "error_code": "INVALID_CREDENTIALS",
                            "account_deleted": True,
                        }
                
                return result
            else:
                return {"success": False, "message": f"Platform {platform} not yet supported"}
            
        finally:
            session.close()
    
    async def validate_session(self, account_id: int) -> Dict[str, Any]:
        """Validate account session"""
        session = database.get_session()
        try:
            account_repo = SocialAccountRepository(session)
            session_repo = SocialSessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            
            account = account_repo.get_by_id(account_id)
            if not account:
                return {"valid": False, "message": "Account not found"}
            
            existing_session = session_repo.get_valid_session(account_id)
            if not existing_session:
                return {"valid": False, "message": "No valid session found"}
            
            fingerprint = None
            if existing_session.fingerprint_id:
                fingerprint = fingerprint_repo.get_by_id(existing_session.fingerprint_id)
            if not fingerprint:
                fingerprint = fingerprint_repo.get_least_used()
            if not fingerprint:
                return {"valid": False, "message": "No fingerprints available"}
            
            platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
            
            if platform == 'youtube':
                from ..infrastructure.youtube_automation import youtube_automation
                result = await youtube_automation.validate_session(account, existing_session, fingerprint)
            elif platform == 'tiktok':
                result = await tiktok_automation.validate_session(account, existing_session, fingerprint)
            else:
                return {"valid": False, "message": f"Platform {platform} not yet supported"}
            
            if result.get("valid"):
                session_repo.update(existing_session.id, {
                    "cookies": result.get("cookies"),
                    "last_validated_at": datetime.now(),
                    "is_valid": True,
                })
            else:
                session_repo.invalidate(account_id, result.get("reason"))
            
            return result
        finally:
            session.close()
    
    def get_platforms(self) -> List[Dict]:
        """Get available platforms info"""
        return [
            {
                "id": p.value,
                "name": info["name"],
                "icon": info["icon"],
                "color": info["color"],
                "difficulty": info["difficulty"],
                "supported_login": info["supported_login"],
            }
            for p, info in PLATFORM_INFO.items()
        ]


class SocialUploadService:
    """Service for managing multi-platform upload queue"""
    
    def __init__(self):
        self.min_upload_interval = int(os.getenv("MIN_UPLOAD_INTERVAL_SECONDS", "3600"))
    
    def create_upload(self, user_id: int, account_id: int, video_path: str,
                      title: str = None, caption: str = None, hashtags: List[str] = None,
                      scheduled_at: datetime = None, privacy_level: str = 'public',
                      request_log_id: int = None, clip_index: int = None,
                      made_for_kids: bool = False, category_id: str = None) -> SocialUploadJob:
        """Create upload job for any platform"""
        session = database.get_session()
        try:
            account_repo = SocialAccountRepository(session)
            queue_repo = SocialUploadQueueRepository(session)
            
            account = account_repo.get_by_id(account_id)
            if not account or account.user_id != user_id:
                raise ValueError("Account not found or access denied")
            
            # Daily upload limit check removed - unlimited uploads allowed
            
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video file not found: {video_path}")
            
            platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
            
            job = queue_repo.create(
                user_id=user_id,
                account_id=account_id,
                platform=platform,
                video_path=video_path,
                title=title,
                caption=caption,
                hashtags=hashtags,
                scheduled_at=scheduled_at,
                priority=1 if not scheduled_at else 5,
                privacy_level=privacy_level,
                request_log_id=request_log_id,
                clip_index=clip_index,
                made_for_kids=made_for_kids,
                category_id=category_id,
            )
            
            logger.info(f"Created {platform} upload job {job.id} for user {user_id}")
            return job
        finally:
            session.close()
    
    def get_queue(self, user_id: int = None, platform: str = None,
                  status: List[str] = None) -> List[SocialUploadJob]:
        """Get upload queue"""
        session = database.get_session()
        try:
            repo = SocialUploadQueueRepository(session)
            return repo.get_all(user_id=user_id, platform=platform, status=status)
        finally:
            session.close()
    
    def get_upload(self, upload_id: int) -> Optional[SocialUploadJob]:
        """Get upload job by ID"""
        session = database.get_session()
        try:
            repo = SocialUploadQueueRepository(session)
            return repo.get_by_id(upload_id)
        finally:
            session.close()
    
    def update_upload(self, upload_id: int, data: Dict[str, Any]) -> Optional[SocialUploadJob]:
        """Update upload job"""
        session = database.get_session()
        try:
            repo = SocialUploadQueueRepository(session)
            return repo.update(upload_id, data)
        finally:
            session.close()
    
    def cancel_upload(self, upload_id: int) -> bool:
        """Cancel an upload job"""
        session = database.get_session()
        try:
            repo = SocialUploadQueueRepository(session)
            job = repo.get_by_id(upload_id)
            if not job:
                return False
            
            if job.status in ['pending', 'processing']:
                repo.update(upload_id, {"status": "cancelled"})
                return True
            return False
        finally:
            session.close()
    
    def retry_upload(self, upload_id: int) -> Optional[SocialUploadJob]:
        """Retry a failed upload"""
        session = database.get_session()
        try:
            repo = SocialUploadQueueRepository(session)
            job = repo.get_by_id(upload_id)
            if not job or job.status != "failed":
                return None
            
            if job.retry_count >= job.max_retries:
                return None
            
            return repo.update(upload_id, {
                "status": "pending",
                "retry_count": job.retry_count + 1,
                "last_retry_at": datetime.now(),
                "error_message": None,
                "error_code": None,
            })
        finally:
            session.close()
    
    async def process_upload(self, upload_id: int) -> Dict[str, Any]:
        """
        Process a single upload immediately.
        This bypasses the queue and runs the upload directly.
        """
        session = database.get_session()
        try:
            queue_repo = SocialUploadQueueRepository(session)
            account_repo = SocialAccountRepository(session)
            session_repo = SocialSessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            
            job = queue_repo.get_by_id(upload_id)
            if not job:
                return {"success": False, "message": "Upload job not found"}
            
            # Update status
            queue_repo.update(job.id, {
                "status": "processing",
                "progress_percent": 5,
            })
            
            # Get account
            account = account_repo.get_by_id(job.account_id)
            if not account:
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": "Account not found",
                })
                return {"success": False, "message": "Account not found"}
            
            # Get fingerprint
            fingerprint = fingerprint_repo.get_random_desktop()
            if not fingerprint:
                fingerprint = fingerprint_repo.get_least_used()
            if not fingerprint:
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": "No browser fingerprints available",
                })
                return {"success": False, "message": "No browser fingerprints available"}
            
            # Get or create session (for cookie-based login)
            valid_session = session_repo.get_valid_session(job.account_id)
            
            # Process based on platform
            platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
            
            async def update_progress(percent, message):
                queue_repo.update(job.id, {
                    "progress_percent": percent,
                })
                logger.info(f"Job {job.id}: {percent}% - {message}")
            
            result = None
            
            if platform == "youtube":
                from ..infrastructure.youtube_automation import YouTubeAutomation
                youtube = YouTubeAutomation()
                result = await youtube.upload_video(
                    account=account,
                    job=job,
                    session=valid_session,
                    fingerprint=fingerprint,
                    on_progress=update_progress,
                )
            else:
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": f"Platform {platform} upload not implemented yet",
                })
                return {"success": False, "message": f"Platform {platform} not supported"}
            
            # Update job based on result
            if result and result.get("success"):
                queue_repo.update(job.id, {
                    "status": "completed",
                    "progress_percent": 100,
                    "platform_video_id": result.get("platform_video_id"),
                    "platform_url": result.get("platform_url"),
                    "uploaded_at": datetime.now(),
                    "error_message": None,
                })
                
                # Update account stats
                account_repo.update(account.id, {
                    "uploads_today": account.uploads_today + 1,
                    "total_uploads": account.total_uploads + 1,
                    "last_upload_at": datetime.now(),
                })
                
                logger.info(f"Upload {job.id} completed: {result.get('platform_url')}")
                return {
                    "success": True,
                    "platform_video_id": result.get("platform_video_id"),
                    "platform_url": result.get("platform_url"),
                }
            else:
                error_msg = result.get("message", "Unknown error") if result else "Upload failed"
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": error_msg,
                    "retry_count": job.retry_count + 1,
                })
                logger.error(f"Upload {job.id} failed: {error_msg}")
                return {"success": False, "message": error_msg}
                
        except Exception as e:
            logger.error(f"Process upload error: {e}", exc_info=True)
            return {"success": False, "message": str(e)}
        finally:
            session.close()


# Singleton instances
account_service = AccountService()
upload_service = UploadService()
upload_worker = UploadWorker()
social_account_service = SocialAccountService()
social_upload_service = SocialUploadService()


class SocialUploadWorker:
    """Background worker for processing multi-platform upload queue (YouTube, etc.)"""
    
    def __init__(self):
        self._running = False
        self._task = None
    
    async def start(self):
        """Start the social upload worker"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._process_loop())
        logger.info("Social upload worker started")
    
    async def stop(self):
        """Stop the social upload worker"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Social upload worker stopped")
    
    async def _process_loop(self):
        """Main processing loop"""
        while self._running:
            try:
                await self._process_next_job()
                await asyncio.sleep(15)  # Check every 15 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Social worker error: {e}", exc_info=True)
                await asyncio.sleep(30)
    
    async def _process_next_job(self):
        """Process the next job in social upload queue"""
        session = database.get_session()
        try:
            queue_repo = SocialUploadQueueRepository(session)
            account_repo = SocialAccountRepository(session)
            session_repo = SocialSessionRepository(session)
            fingerprint_repo = FingerprintRepository(session)
            
            # Get next pending job
            pending = queue_repo.get_pending_jobs(limit=1)
            if not pending:
                return
            
            job = pending[0]
            
            # Check max concurrent browsers
            max_concurrent = int(os.getenv("MAX_CONCURRENT_BROWSERS", "2"))
            if browser_manager.get_active_contexts_count() >= max_concurrent:
                return
            
            # Update job status
            queue_repo.update(job.id, {
                "status": "processing",
                "progress_percent": 5,
            })
            
            # Get account
            account = account_repo.get_by_id(job.account_id)
            if not account or account.status != "active":
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": "Account not available",
                })
                return
            
            # Daily upload limit check removed - unlimited uploads allowed
            
            # Get valid session
            valid_session = session_repo.get_valid_session(job.account_id)
            if not valid_session:
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": "No valid session. Please login to the account first.",
                })
                return
            
            # Get fingerprint
            fingerprint = fingerprint_repo.get_by_id(valid_session.fingerprint_id)
            if not fingerprint:
                fingerprint = fingerprint_repo.get_random_desktop()
            if not fingerprint:
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": "No browser fingerprints available",
                })
                return
            
            # Process based on platform
            platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
            
            async def update_progress(percent, message):
                queue_repo.update(job.id, {
                    "progress_percent": percent,
                })
                logger.info(f"Job {job.id}: {percent}% - {message}")
            
            result = None
            
            if platform == "youtube":
                from ..infrastructure.youtube_automation import YouTubeAutomation
                youtube = YouTubeAutomation()
                result = await youtube.upload_video(
                    account=account,
                    job=job,
                    session=valid_session,
                    fingerprint=fingerprint,
                    on_progress=update_progress,
                )
            else:
                # Other platforms not yet implemented
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": f"Platform {platform} upload not implemented yet",
                })
                return
            
            # Update job based on result
            if result and result.get("success"):
                queue_repo.update(job.id, {
                    "status": "published",
                    "progress_percent": 100,
                    "platform_video_id": result.get("platform_video_id"),
                    "platform_url": result.get("platform_url"),
                    "uploaded_at": datetime.now(),
                })
                
                # Update account stats
                account_repo.update(account.id, {
                    "uploads_today": account.uploads_today + 1,
                    "total_uploads": account.total_uploads + 1,
                    "last_upload_at": datetime.now(),
                })
                
                logger.info(f"Social upload job {job.id} completed successfully")
            else:
                error_msg = result.get("message", "Unknown error") if result else "Upload failed"
                queue_repo.update(job.id, {
                    "status": "failed",
                    "error_message": error_msg,
                    "retry_count": job.retry_count + 1,
                })
                logger.error(f"Social upload job {job.id} failed: {error_msg}")
                
        except Exception as e:
            logger.error(f"Process job error: {e}", exc_info=True)
        finally:
            session.close()


# Social upload worker singleton
social_upload_worker = SocialUploadWorker()
