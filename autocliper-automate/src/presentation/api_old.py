"""
Presentation Layer - FastAPI REST API
TikTok Automate endpoints with JWT authentication (shared with AutoCliper v2)
"""
import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ..infrastructure.database import database
from ..infrastructure.repositories import TikTokAccountRepository, UploadQueueRepository
from ..application.services import account_service, upload_service, upload_worker
from ..domain.entities import UploadFromClipRequest

# Import auth from autocliper-v2 (shared JWT secret)
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'autocliper-v2'))
try:
    from src.infrastructure.auth import decode_access_token
except ImportError:
    # Fallback: implement minimal JWT decode
    from jose import jwt, JWTError
    
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY"))
    ALGORITHM = "HS256"
    
    def decode_access_token(token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type", "access") != "access":
                return None
            return payload
        except JWTError:
            return None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Lifespan
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Starting AutoCliper Automate...")
    
    try:
        database.create_tables()
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    # Start upload worker
    await upload_worker.start()
    
    yield
    
    # Shutdown
    logger.info("Shutting down AutoCliper Automate...")
    await upload_worker.stop()


app = FastAPI(
    title="AutoCliper Automate",
    version="1.0.0",
    description="TikTok Auto Upload API - works with AutoCliper v2",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://100.64.5.96:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
#  Auth helpers
# ─────────────────────────────────────────────────────────────────────────────
security = HTTPBearer()


def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Decode JWT and return the payload dict. Raises 401 on any error."""
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def _require_admin(current_user: dict = Depends(_get_current_user)) -> dict:
    """Same as _get_current_user but also requires role == 'admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
#  Request / Response Models
# ─────────────────────────────────────────────────────────────────────────────

class CreateAccountRequest(BaseModel):
    account_name: str
    login_type: str = "manual"  # "email", "username", "phone", atau "manual"
    login_identifier: Optional[str] = None  # Tidak wajib untuk manual login
    password: Optional[str] = None  # Tidak wajib untuk manual login
    proxy_url: Optional[str] = None
    daily_upload_limit: int = 3
    notes: Optional[str] = None
    auto_login: bool = True  # Auto trigger login after account creation


class UpdateAccountRequest(BaseModel):
    account_name: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    password: Optional[str] = None


class AccountResponse(BaseModel):
    id: int
    user_id: int
    account_name: str
    login_type: str
    login_identifier: str
    tiktok_username: Optional[str] = None
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


# ─────────────────────────────────────────────────────────────────────────────
#  Health Check
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    from ..infrastructure.browser_manager import browser_manager
    
    return {
        "status": "healthy",
        "service": "AutoCliper Automate",
        "browser_contexts": browser_manager.get_active_contexts_count(),
        "upload_worker": upload_worker._running,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Account Management
# ─────────────────────────────────────────────────────────────────────────────

class CreateAccountResponse(BaseModel):
    """Response for create account with login result"""
    account: AccountResponse
    login_triggered: bool = False
    login_result: Optional[Dict[str, Any]] = None


@app.post("/api/v1/tiktok/accounts", status_code=201)
async def create_account(
    body: CreateAccountRequest,
    current: dict = Depends(_get_current_user)
):
    """
    Create a new TikTok account and optionally trigger login
    
    login_type options:
    - "email": Auto-login with email + password
    - "username": Auto-login with username + password  
    - "phone": Auto-login with phone + password
    - "manual": Manual login - browser opens, user logs in manually, system captures cookies
    
    For auto-login (email/username/phone): login_identifier and password are REQUIRED
    For manual login: login_identifier and password are OPTIONAL (not stored)
    """
    try:
        user_id = int(current.get("sub"))
        
        # Validate credentials for auto-login
        if body.login_type != "manual":
            if not body.login_identifier:
                raise HTTPException(status_code=400, detail="login_identifier is required for auto login")
            if not body.password:
                raise HTTPException(status_code=400, detail="password is required for auto login")
        
        from ..domain.entities import CreateAccountRequest as DomainRequest
        request = DomainRequest(
            account_name=body.account_name,
            login_type=body.login_type,
            login_identifier=body.login_identifier,
            password=body.password,
            proxy_url=body.proxy_url,
            daily_upload_limit=body.daily_upload_limit,
            notes=body.notes,
        )
        
        account = account_service.create_account(user_id, request)
        account_response = _account_to_response(account)
        
        # Auto-login if requested (default: True)
        login_result = None
        if body.auto_login:
            try:
                is_manual = body.login_type == "manual"
                logger.info(f"Auto-triggering {'manual' if is_manual else 'auto'} login for account {account.id}")
                login_result = await account_service.trigger_login(account.id, manual=is_manual)
                
                # If login failed (not verification/captcha), delete the account
                if not login_result.get("success") and not login_result.get("needs_verification") and not login_result.get("needs_captcha"):
                    logger.warning(f"Login failed for account {account.id}, deleting account")
                    account_service.delete_account(account.id)
                    raise HTTPException(
                        status_code=400, 
                        detail=login_result.get("message", "Login failed. Please check your credentials.")
                    )
                
                # Refresh account data after login
                account = account_service.get_account(account.id)
                account_response = _account_to_response(account)
                
            except HTTPException:
                raise  # Re-raise HTTP exceptions
            except Exception as login_err:
                logger.warning(f"Auto-login error for account {account.id}: {login_err}")
                # Delete account on login error
                account_service.delete_account(account.id)
                raise HTTPException(
                    status_code=400,
                    detail=f"Login failed: {str(login_err)}. Account not saved."
                )
        
        # Build response
        account_dict = account_response.model_dump() if hasattr(account_response, 'model_dump') else vars(account_response)
        
        response = {
            "account": account_dict,
            "login_triggered": body.auto_login,
            "login_result": login_result,
        }
        # Add flat account fields for backward compatibility
        response.update(account_dict)
        
        return response
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Create account error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/tiktok/accounts", response_model=List[AccountResponse])
async def list_accounts(current: dict = Depends(_get_current_user)):
    """List TikTok accounts. Users see their own, admins see all."""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    if role == "admin":
        accounts = account_service.get_all_accounts()
    else:
        accounts = account_service.get_accounts_by_user(user_id)
    
    return [_account_to_response(a) for a in accounts]


@app.get("/api/v1/tiktok/accounts/available", response_model=List[AccountResponse])
async def list_available_accounts(current: dict = Depends(_get_current_user)):
    """List accounts available for upload (not at daily limit)"""
    user_id = int(current.get("sub"))
    accounts = account_service.get_available_accounts(user_id)
    return [_account_to_response(a) for a in accounts]


@app.get("/api/v1/tiktok/accounts/{account_id}", response_model=AccountResponse)
async def get_account(account_id: int, current: dict = Depends(_get_current_user)):
    """Get account details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check access
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _account_to_response(account)


@app.put("/api/v1/tiktok/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    body: UpdateAccountRequest,
    current: dict = Depends(_get_current_user)
):
    """Update account details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = body.model_dump(exclude_unset=True)
    updated = account_service.update_account(account_id, update_data)
    
    if not updated:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return _account_to_response(updated)


@app.delete("/api/v1/tiktok/accounts/{account_id}")
async def delete_account(account_id: int, current: dict = Depends(_get_current_user)):
    """Delete an account"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not account_service.delete_account(account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"status": "deleted", "account_id": account_id}


class TriggerLoginRequest(BaseModel):
    manual: bool = False  # If True, open browser for manual login


@app.post("/api/v1/tiktok/accounts/{account_id}/login")
async def trigger_login(
    account_id: int, 
    body: Optional[TriggerLoginRequest] = None,
    current: dict = Depends(_get_current_user)
):
    """
    Trigger login for an account
    
    - If account login_type is "manual" OR body.manual=True: Opens browser for user to login manually
    - Otherwise: Auto-login with saved credentials
    """
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    manual = body.manual if body else False
    result = await account_service.trigger_login(account_id, manual=manual)
    return result


@app.post("/api/v1/tiktok/accounts/{account_id}/validate")
async def validate_session(account_id: int, current: dict = Depends(_get_current_user)):
    """Validate account session"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await account_service.validate_session(account_id)
    return result


# ─────────────────────────────────────────────────────────────────────────────
#  Upload Management
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/tiktok/upload/from-clip", response_model=UploadResponse)
async def upload_from_clip(
    body: UploadFromClipRequestModel,
    current: dict = Depends(_get_current_user)
):
    """Create upload from AutoCliper clip"""
    try:
        user_id = int(current.get("sub"))
        
        request = UploadFromClipRequest(
            account_id=body.account_id,
            request_log_id=body.request_log_id,
            clip_index=body.clip_index,
            caption=body.caption,
            hashtags=body.hashtags,
            scheduled_at=body.scheduled_at,
            privacy_level=body.privacy_level,
        )
        
        job = upload_service.create_upload_from_clip(user_id, request)
        return _upload_to_response(job)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload from clip error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/tiktok/upload/bulk", response_model=List[UploadResponse])
async def bulk_upload(
    body: BulkUploadRequestModel,
    current: dict = Depends(_get_current_user)
):
    """Bulk upload multiple clips"""
    user_id = int(current.get("sub"))
    
    results = []
    errors = []
    
    for upload_req in body.uploads:
        try:
            request = UploadFromClipRequest(
                account_id=upload_req.account_id,
                request_log_id=upload_req.request_log_id,
                clip_index=upload_req.clip_index,
                caption=upload_req.caption,
                hashtags=upload_req.hashtags,
                scheduled_at=upload_req.scheduled_at,
                privacy_level=upload_req.privacy_level,
            )
            job = upload_service.create_upload_from_clip(user_id, request)
            results.append(_upload_to_response(job))
        except Exception as e:
            errors.append({
                "clip_index": upload_req.clip_index,
                "error": str(e),
            })
    
    if errors and not results:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    return results


@app.get("/api/v1/tiktok/upload/queue", response_model=List[UploadResponse])
async def get_upload_queue(
    status: Optional[str] = None,
    current: dict = Depends(_get_current_user)
):
    """Get upload queue"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    status_list = status.split(",") if status else None
    
    if role == "admin":
        jobs = upload_service.get_queue(status=status_list)
    else:
        jobs = upload_service.get_queue(user_id=user_id, status=status_list)
    
    return [_upload_to_response(j) for j in jobs]


@app.get("/api/v1/tiktok/upload/{upload_id}", response_model=UploadResponse)
async def get_upload(upload_id: int, current: dict = Depends(_get_current_user)):
    """Get upload details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _upload_to_response(job)


@app.put("/api/v1/tiktok/upload/{upload_id}", response_model=UploadResponse)
async def update_upload(
    upload_id: int,
    body: Dict[str, Any],
    current: dict = Depends(_get_current_user)
):
    """Update upload (reschedule, edit caption)"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Only allow certain fields to be updated
    allowed_fields = {"caption", "hashtags", "scheduled_at", "priority"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    updated = upload_service.update_upload(upload_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return _upload_to_response(updated)


@app.delete("/api/v1/tiktok/upload/{upload_id}")
async def cancel_upload(upload_id: int, current: dict = Depends(_get_current_user)):
    """Cancel an upload"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not upload_service.cancel_upload(upload_id):
        raise HTTPException(status_code=400, detail="Cannot cancel upload in current status")
    
    return {"status": "cancelled", "upload_id": upload_id}


@app.post("/api/v1/tiktok/upload/{upload_id}/retry", response_model=UploadResponse)
async def retry_upload(upload_id: int, current: dict = Depends(_get_current_user)):
    """Retry a failed upload"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    retried = upload_service.retry_upload(upload_id)
    if not retried:
        raise HTTPException(status_code=400, detail="Cannot retry upload (not failed or max retries reached)")
    
    return _upload_to_response(retried)


@app.get("/api/v1/tiktok/upload/{upload_id}/history")
async def get_upload_history(upload_id: int, current: dict = Depends(_get_current_user)):
    """Get upload event history"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return upload_service.get_upload_history(upload_id)


@app.get("/api/v1/tiktok/upload/suggest-schedule", response_model=List[ScheduleSuggestionResponse])
async def suggest_schedule(
    account_id: int,
    clips_count: int = 1,
    current: dict = Depends(_get_current_user)
):
    """Suggest optimal upload times"""
    suggestions = upload_service.suggest_schedule(account_id, clips_count)
    return [ScheduleSuggestionResponse(**s) for s in suggestions]


# ─────────────────────────────────────────────────────────────────────────────
#  Helper functions
# ─────────────────────────────────────────────────────────────────────────────

def _account_to_response(account) -> AccountResponse:
    """Convert domain account to response model"""
    # Check session validity
    session_valid = False
    session = database.get_session()
    try:
        from ..infrastructure.repositories import SessionRepository
        session_repo = SessionRepository(session)
        valid_session = session_repo.get_valid_session(account.id)
        session_valid = valid_session is not None
    finally:
        session.close()
    
    return AccountResponse(
        id=account.id,
        user_id=account.user_id,
        account_name=account.account_name,
        login_type=account.login_type.value if hasattr(account.login_type, 'value') else account.login_type,
        login_identifier=account.login_identifier,
        tiktok_username=account.tiktok_username,
        proxy_url=account.proxy_url,
        daily_upload_limit=account.daily_upload_limit,
        uploads_today=account.uploads_today,
        last_upload_at=account.last_upload_at.isoformat() if account.last_upload_at else None,
        status=account.status.value if hasattr(account.status, 'value') else account.status,
        health_score=account.health_score,
        total_uploads=account.total_uploads,
        total_views=account.total_views,
        notes=account.notes,
        created_at=account.created_at.isoformat() if account.created_at else None,
        session_valid=session_valid,
    )


def _upload_to_response(job) -> UploadResponse:
    """Convert domain upload to response model"""
    # Get account name
    account_name = None
    session = database.get_session()
    try:
        from ..infrastructure.repositories import TikTokAccountRepository
        account_repo = TikTokAccountRepository(session)
        account = account_repo.get_by_id(job.account_id)
        if account:
            account_name = account.account_name
    finally:
        session.close()
    
    return UploadResponse(
        id=job.id,
        user_id=job.user_id,
        account_id=job.account_id,
        account_name=account_name,
        request_log_id=job.request_log_id,
        clip_index=job.clip_index,
        video_path=job.video_path,
        caption=job.caption,
        hashtags=job.hashtags,
        scheduled_at=job.scheduled_at.isoformat() if job.scheduled_at else None,
        priority=job.priority,
        status=job.status.value if hasattr(job.status, 'value') else job.status,
        progress_percent=job.progress_percent,
        tiktok_video_id=job.tiktok_video_id,
        tiktok_url=job.tiktok_url,
        error_message=job.error_message,
        retry_count=job.retry_count,
        created_at=job.created_at.isoformat() if job.created_at else None,
        uploaded_at=job.uploaded_at.isoformat() if job.uploaded_at else None,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Multi-Platform Social Media API Endpoints
# ═══════════════════════════════════════════════════════════════════════════

from ..application.services import social_account_service, social_upload_service
from ..domain.entities import Platform, PLATFORM_INFO


# ─── Request/Response Models ─────────────────────────────────────────────────

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
    video_path: str
    title: Optional[str] = None  # For YouTube
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    privacy_level: str = "public"
    request_log_id: Optional[int] = None
    clip_index: Optional[int] = None
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


# ─── Platform Info ───────────────────────────────────────────────────────────

@app.get("/api/v1/social/platforms")
async def get_platforms():
    """Get available social media platforms"""
    return social_account_service.get_platforms()


# ─── Social Account Management ───────────────────────────────────────────────

@app.post("/api/v1/social/accounts", status_code=201)
async def create_social_account(
    body: CreateSocialAccountRequest,
    current: dict = Depends(_get_current_user)
):
    """Create a new social media account for any platform"""
    try:
        user_id = int(current.get("sub"))
        
        # Validate platform
        valid_platforms = [p.value for p in Platform]
        if body.platform not in valid_platforms:
            raise HTTPException(status_code=400, detail=f"Invalid platform. Must be one of: {valid_platforms}")
        
        # Validate credentials for auto-login
        if body.login_type not in ["manual", "google"]:
            if not body.login_identifier:
                raise HTTPException(status_code=400, detail="login_identifier required for auto login")
            if not body.password:
                raise HTTPException(status_code=400, detail="password required for auto login")
        
        account = social_account_service.create_account(
            user_id=user_id,
            platform=body.platform,
            account_name=body.account_name,
            login_type=body.login_type,
            login_identifier=body.login_identifier,
            password=body.password,
            proxy_url=body.proxy_url,
            daily_upload_limit=body.daily_upload_limit,
            notes=body.notes,
        )
        
        account_response = _social_account_to_response(account)
        
        # Auto-login if requested
        login_result = None
        if body.auto_login:
            try:
                is_manual = body.login_type in ["manual", "google"]
                login_result = await social_account_service.trigger_login(account.id, manual=is_manual)
                
                if not login_result.get("success") and not login_result.get("needs_verification"):
                    social_account_service.delete_account(account.id)
                    raise HTTPException(status_code=400, detail=login_result.get("message", "Login failed"))
                
                account = social_account_service.get_account(account.id)
                account_response = _social_account_to_response(account)
                
            except HTTPException:
                raise
            except Exception as e:
                social_account_service.delete_account(account.id)
                raise HTTPException(status_code=400, detail=f"Login failed: {str(e)}")
        
        return {
            "account": account_response.model_dump(),
            "login_triggered": body.auto_login,
            "login_result": login_result,
            **account_response.model_dump(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create social account error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/social/accounts", response_model=List[SocialAccountResponse])
async def list_social_accounts(
    platform: Optional[str] = None,
    current: dict = Depends(_get_current_user)
):
    """List social media accounts. Optionally filter by platform."""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    if role == "admin":
        accounts = social_account_service.get_all_accounts(platform)
    else:
        accounts = social_account_service.get_accounts_by_user(user_id, platform)
    
    return [_social_account_to_response(a) for a in accounts]


@app.get("/api/v1/social/accounts/{account_id}", response_model=SocialAccountResponse)
async def get_social_account(account_id: int, current: dict = Depends(_get_current_user)):
    """Get social account details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _social_account_to_response(account)


@app.delete("/api/v1/social/accounts/{account_id}")
async def delete_social_account(account_id: int, current: dict = Depends(_get_current_user)):
    """Delete a social media account"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not social_account_service.delete_account(account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"status": "deleted", "account_id": account_id}


@app.post("/api/v1/social/accounts/{account_id}/login")
async def trigger_social_login(
    account_id: int,
    body: Optional[TriggerLoginRequest] = None,
    current: dict = Depends(_get_current_user)
):
    """Trigger login for a social media account"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    manual = body.manual if body else False
    result = await social_account_service.trigger_login(account_id, manual=manual)
    return result


# ─── Social Upload Management ────────────────────────────────────────────────

@app.post("/api/v1/social/upload", response_model=SocialUploadResponse)
async def create_social_upload(
    body: SocialUploadRequest,
    current: dict = Depends(_get_current_user)
):
    """Create upload job for any social platform"""
    try:
        user_id = int(current.get("sub"))
        
        job = social_upload_service.create_upload(
            user_id=user_id,
            account_id=body.account_id,
            video_path=body.video_path,
            title=body.title,
            caption=body.caption,
            hashtags=body.hashtags,
            scheduled_at=body.scheduled_at,
            privacy_level=body.privacy_level,
            request_log_id=body.request_log_id,
            clip_index=body.clip_index,
            made_for_kids=body.made_for_kids,
            category_id=body.category_id,
        )
        return _social_upload_to_response(job)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Create social upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/social/upload/queue", response_model=List[SocialUploadResponse])
async def get_social_upload_queue(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    current: dict = Depends(_get_current_user)
):
    """Get upload queue for social platforms"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    status_list = status.split(",") if status else None
    
    if role == "admin":
        jobs = social_upload_service.get_queue(platform=platform, status=status_list)
    else:
        jobs = social_upload_service.get_queue(user_id=user_id, platform=platform, status=status_list)
    
    return [_social_upload_to_response(j) for j in jobs]


@app.get("/api/v1/social/upload/{upload_id}", response_model=SocialUploadResponse)
async def get_social_upload(upload_id: int, current: dict = Depends(_get_current_user)):
    """Get social upload details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = social_upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _social_upload_to_response(job)


@app.delete("/api/v1/social/upload/{upload_id}")
async def cancel_social_upload(upload_id: int, current: dict = Depends(_get_current_user)):
    """Cancel a social upload"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = social_upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not social_upload_service.cancel_upload(upload_id):
        raise HTTPException(status_code=400, detail="Cannot cancel upload")
    
    return {"status": "cancelled", "upload_id": upload_id}


@app.post("/api/v1/social/upload/{upload_id}/retry", response_model=SocialUploadResponse)
async def retry_social_upload(upload_id: int, current: dict = Depends(_get_current_user)):
    """Retry a failed social upload"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = social_upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    retried = social_upload_service.retry_upload(upload_id)
    if not retried:
        raise HTTPException(status_code=400, detail="Cannot retry upload")
    
    return _social_upload_to_response(retried)


# ─── Helper Functions ────────────────────────────────────────────────────────

def _social_account_to_response(account) -> SocialAccountResponse:
    """Convert social account to response"""
    from ..infrastructure.repositories import SocialSessionRepository
    
    session_valid = False
    session = database.get_session()
    try:
        session_repo = SocialSessionRepository(session)
        valid_session = session_repo.get_valid_session(account.id)
        session_valid = valid_session is not None
    finally:
        session.close()
    
    return SocialAccountResponse(
        id=account.id,
        user_id=account.user_id,
        platform=account.platform.value if hasattr(account.platform, 'value') else account.platform,
        account_name=account.account_name,
        login_type=account.login_type.value if hasattr(account.login_type, 'value') else account.login_type,
        login_identifier=account.login_identifier or "",
        platform_username=account.platform_username,
        proxy_url=account.proxy_url,
        daily_upload_limit=account.daily_upload_limit,
        uploads_today=account.uploads_today,
        last_upload_at=account.last_upload_at.isoformat() if account.last_upload_at else None,
        status=account.status.value if hasattr(account.status, 'value') else account.status,
        health_score=account.health_score,
        total_uploads=account.total_uploads,
        total_views=account.total_views,
        notes=account.notes,
        created_at=account.created_at.isoformat() if account.created_at else None,
        session_valid=session_valid,
    )


def _social_upload_to_response(job) -> SocialUploadResponse:
    """Convert social upload to response"""
    from ..infrastructure.repositories import SocialAccountRepository
    
    account_name = None
    session = database.get_session()
    try:
        account_repo = SocialAccountRepository(session)
        account = account_repo.get_by_id(job.account_id)
        if account:
            account_name = account.account_name
    finally:
        session.close()
    
    return SocialUploadResponse(
        id=job.id,
        user_id=job.user_id,
        account_id=job.account_id,
        platform=job.platform.value if hasattr(job.platform, 'value') else job.platform,
        account_name=account_name,
        request_log_id=job.request_log_id,
        clip_index=job.clip_index,
        video_path=job.video_path,
        title=job.title,
        caption=job.caption,
        hashtags=job.hashtags,
        scheduled_at=job.scheduled_at.isoformat() if job.scheduled_at else None,
        priority=job.priority,
        status=job.status.value if hasattr(job.status, 'value') else job.status,
        progress_percent=job.progress_percent,
        platform_video_id=job.platform_video_id,
        platform_url=job.platform_url,
        error_message=job.error_message,
        retry_count=job.retry_count,
        created_at=job.created_at.isoformat() if job.created_at else None,
        uploaded_at=job.uploaded_at.isoformat() if job.uploaded_at else None,
    )
