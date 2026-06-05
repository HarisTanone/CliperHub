"""
Multi-Platform Social Media Routes
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text

from ..schemas.social import (
    CreateSocialAccountRequest, SocialAccountResponse,
    SocialUploadRequest, SocialUploadResponse
)
from ..dependencies import get_current_user
from ...infrastructure.database import database
from ...infrastructure.repositories import SocialSessionRepository
from ...application.services import social_account_service, social_upload_service
from ...domain.entities import Platform

logger = logging.getLogger(__name__)
router = APIRouter()


def _social_account_to_response(account) -> SocialAccountResponse:
    """Convert domain social account to response model"""
    session_valid = False
    session = database.get_session()
    try:
        session_repo = SocialSessionRepository(session)
        valid_session = session_repo.get_valid_session(account.id)
        session_valid = valid_session is not None
    except:
        pass
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
    """Convert domain social upload to response model"""
    account_name = None
    platform = "unknown"
    
    session = database.get_session()
    try:
        from ...infrastructure.repositories import SocialAccountRepository
        account_repo = SocialAccountRepository(session)
        account = account_repo.get_by_id(job.account_id)
        if account:
            account_name = account.account_name
            platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
    except:
        pass
    finally:
        session.close()
    
    return SocialUploadResponse(
        id=job.id,
        user_id=job.user_id,
        account_id=job.account_id,
        platform=platform,
        account_name=account_name,
        request_log_id=getattr(job, 'request_log_id', None),
        clip_index=getattr(job, 'clip_index', None),
        video_path=job.video_path,
        title=getattr(job, 'title', None),
        caption=job.caption,
        hashtags=job.hashtags,
        scheduled_at=job.scheduled_at.isoformat() if job.scheduled_at else None,
        priority=job.priority,
        status=job.status.value if hasattr(job.status, 'value') else job.status,
        progress_percent=job.progress_percent,
        platform_video_id=getattr(job, 'platform_video_id', None),
        platform_url=getattr(job, 'platform_url', None),
        error_message=job.error_message,
        retry_count=job.retry_count,
        created_at=job.created_at.isoformat() if job.created_at else None,
        uploaded_at=job.uploaded_at.isoformat() if job.uploaded_at else None,
    )


# ─── Platform Info ───────────────────────────────────────────────────────────

@router.get("/platforms")
async def get_platforms():
    """Get available social media platforms"""
    return social_account_service.get_platforms()


# ─── Social Account Management ───────────────────────────────────────────────

@router.post("/accounts", status_code=201)
async def create_social_account(
    body: CreateSocialAccountRequest,
    current: dict = Depends(get_current_user)
):
    """Create a new social media account"""
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
                login_result = await social_account_service.trigger_login(account.id)
                
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
        
        response = account_response.model_dump()
        response["login_triggered"] = body.auto_login
        response["login_result"] = login_result
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create social account error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/accounts", response_model=List[SocialAccountResponse])
async def list_social_accounts(
    platform: Optional[str] = None,
    current: dict = Depends(get_current_user)
):
    """List social media accounts"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    if role == "admin":
        accounts = social_account_service.get_all_accounts(platform=platform)
    else:
        accounts = social_account_service.get_accounts_by_user(user_id, platform=platform)
    
    return [_social_account_to_response(a) for a in accounts]


@router.get("/accounts/{account_id}", response_model=SocialAccountResponse)
async def get_social_account(account_id: int, current: dict = Depends(get_current_user)):
    """Get social account details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _social_account_to_response(account)


@router.delete("/accounts/{account_id}")
async def delete_social_account(account_id: int, current: dict = Depends(get_current_user)):
    """Delete a social account and its related records"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Delete related records first (sessions, upload queue)
        session = database.get_session()
        try:
            from ..infrastructure.repositories import SocialSessionRepository, SocialUploadQueueRepository
            
            # Delete sessions
            session_repo = SocialSessionRepository(session)
            session_repo.invalidate(account_id, "Account deleted")
            
            # Delete pending upload jobs (cancel them)
            session.execute(
                text("DELETE FROM social_upload_queue WHERE account_id = :account_id AND status IN ('pending', 'processing')"),
                {"account_id": account_id}
            )
            session.commit()
        finally:
            session.close()
        
        # Now delete the account
        if not social_account_service.delete_account(account_id):
            raise HTTPException(status_code=404, detail="Account not found")
        
        return {"status": "deleted", "account_id": account_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting account {account_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


@router.post("/accounts/{account_id}/login")
async def trigger_social_login(account_id: int, current: dict = Depends(get_current_user)):
    """Trigger login for a social account"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await social_account_service.trigger_login(account_id)
    return result


@router.post("/accounts/{account_id}/setup")
async def setup_youtube_account(account_id: int, current: dict = Depends(get_current_user)):
    """
    Setup YouTube account - opens browser for user to login manually.
    The session is saved persistently, so this only needs to be done ONCE.
    
    After setup, uploads will work automatically without needing to login again.
    """
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Only for YouTube
    platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
    if platform != "youtube":
        raise HTTPException(status_code=400, detail="Setup only available for YouTube accounts")
    
    result = await social_account_service.trigger_login(account_id)
    
    # If successful, update account status
    if result.get("success"):
        session = database.get_session()
        try:
            from ...infrastructure.repositories import SocialAccountRepository
            account_repo = SocialAccountRepository(session)
            update_data = {"status": "active"}
            if result.get("platform_username"):
                update_data["platform_username"] = result.get("platform_username")
            account_repo.update(account_id, update_data)
            session.commit()
        finally:
            session.close()
    
    return result


@router.get("/accounts/{account_id}/session-status")
async def get_session_status(account_id: int, current: dict = Depends(get_current_user)):
    """
    Check if YouTube account session is still active.
    Returns whether the persistent profile is logged in.
    """
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Only for YouTube
    platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
    if platform != "youtube":
        raise HTTPException(status_code=400, detail="Session status only available for YouTube accounts")
    
    try:
        from ...infrastructure.youtube_automation import YouTubeAutomation
        from ...infrastructure.repositories import BrowserFingerprintRepository
        
        session = database.get_session()
        try:
            fp_repo = BrowserFingerprintRepository(session)
            fingerprint = fp_repo.get_random()
            if not fingerprint:
                return {
                    "has_profile": False,
                    "logged_in": False,
                    "message": "No browser fingerprint available"
                }
        finally:
            session.close()
        
        youtube = YouTubeAutomation()
        status = await youtube.check_session_status(account_id, fingerprint)
        return status
    except Exception as e:
        logger.error(f"Error checking session status: {e}")
        return {
            "has_profile": False,
            "logged_in": False,
            "message": f"Error: {str(e)}"
        }


@router.post("/accounts/{account_id}/process-upload/{upload_id}")
async def process_single_upload(
    account_id: int, 
    upload_id: int,
    current: dict = Depends(get_current_user)
):
    """
    Process a single upload immediately.
    Uses persistent browser profile for YouTube uploads.
    """
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    job = social_upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if job.account_id != account_id:
        raise HTTPException(status_code=400, detail="Upload does not belong to this account")
    
    try:
        result = await social_upload_service.process_upload(upload_id)
        return result
    except Exception as e:
        logger.error(f"Error processing upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel
from typing import List, Dict, Any

class ImportCookiesRequest(BaseModel):
    cookies: List[Dict[str, Any]]
    platform_username: str = None


@router.post("/accounts/{account_id}/import-cookies")
async def import_cookies(
    account_id: int, 
    body: ImportCookiesRequest,
    current: dict = Depends(get_current_user)
):
    """
    Import cookies from browser extension (e.g., EditThisCookie, Cookie-Editor)
    
    Steps for user:
    1. Login to YouTube/Google in normal Chrome browser
    2. Install "Cookie-Editor" or "EditThisCookie" extension
    3. Go to youtube.com, click extension, click "Export" (JSON)
    4. Paste the JSON here
    """
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = social_account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate cookies have required Google auth cookies
    cookie_names = [c.get('name') for c in body.cookies]
    required_cookies = ['SID', 'HSID', 'SSID']  # At least these for Google
    
    has_auth = any(name in cookie_names for name in required_cookies)
    if not has_auth:
        raise HTTPException(
            status_code=400, 
            detail="Cookies don't contain Google authentication. Make sure you export cookies while logged in to Google/YouTube."
        )
    
    # Convert cookie format if needed (EditThisCookie uses different format)
    playwright_cookies = []
    for cookie in body.cookies:
        pc = {
            "name": cookie.get("name"),
            "value": cookie.get("value"),
            "domain": cookie.get("domain", ".youtube.com"),
            "path": cookie.get("path", "/"),
        }
        
        # Handle expiration
        if cookie.get("expirationDate"):
            pc["expires"] = cookie.get("expirationDate")
        elif cookie.get("expires"):
            pc["expires"] = cookie.get("expires")
        
        # Handle other attributes
        if cookie.get("secure") is not None:
            pc["secure"] = cookie.get("secure")
        if cookie.get("httpOnly") is not None:
            pc["httpOnly"] = cookie.get("httpOnly")
        
        # Handle sameSite - convert to Playwright format
        same_site = cookie.get("sameSite")
        if same_site:
            # Convert various formats to Playwright-compatible values
            same_site_lower = str(same_site).lower()
            if same_site_lower in ['none', 'no_restriction', 'unspecified']:
                pc["sameSite"] = "None"
            elif same_site_lower in ['lax']:
                pc["sameSite"] = "Lax"
            elif same_site_lower in ['strict']:
                pc["sameSite"] = "Strict"
            # If invalid or null, don't include sameSite (let browser decide)
        
        playwright_cookies.append(pc)
    
    # Save session with cookies
    try:
        session = database.get_session()
        session_repo = SocialSessionRepository(session)
        
        # Create new session
        platform = account.platform.value if hasattr(account.platform, 'value') else account.platform
        session_repo.create(
            account_id=account_id,
            platform=platform,
            cookies=playwright_cookies,
            fingerprint_id=None,
            login_method="cookie_import",
        )
        
        # Update account status and username
        from ...infrastructure.repositories import SocialAccountRepository
        account_repo = SocialAccountRepository(session)
        update_data = {"status": "active"}
        if body.platform_username:
            update_data["platform_username"] = body.platform_username
        account_repo.update(account_id, update_data)
        
        session.commit()
        session.close()
        
        return {
            "success": True,
            "message": "Cookies imported successfully. Session is now active.",
            "cookies_count": len(playwright_cookies),
        }
    except Exception as e:
        logger.error(f"Error importing cookies: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to import cookies: {str(e)}")


# ─── Social Upload Management ────────────────────────────────────────────────

@router.post("/upload", response_model=SocialUploadResponse)
async def create_social_upload(
    body: SocialUploadRequest,
    current: dict = Depends(get_current_user)
):
    """Create upload for any platform"""
    import os
    import mysql.connector
    try:
        user_id = int(current.get("sub"))
        
        # Resolve video path
        video_path = body.video_path
        if not video_path and body.request_log_id is not None and body.clip_index is not None:
            # Try to get output_path from request_log database
            try:
                db_config = {
                    "host": os.getenv("AUTOCLIPER_DB_HOST", "100.64.5.96"),
                    "user": os.getenv("AUTOCLIPER_DB_USER", "customer_user"),
                    "password": os.getenv("AUTOCLIPER_DB_PASSWORD", "sayapsuci!@#"),
                    "database": os.getenv("AUTOCLIPER_DB_NAME", "autocliper"),
                }
                conn = mysql.connector.connect(**db_config)
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT output_path FROM request_log WHERE id = %s", (body.request_log_id,))
                row = cursor.fetchone()
                cursor.close()
                conn.close()
                
                if row and row.get("output_path"):
                    output_folder = row["output_path"]
                    # Convert relative path to absolute if needed
                    if output_folder.startswith("./"):
                        autocliper_base = os.getenv("AUTOCLIPER_BASE_DIR", "../autocliper-v2")
                        output_folder = os.path.join(autocliper_base, output_folder[2:])
                    
                    # Build video path: clip_{index}_final.mp4
                    clip_file = f"clip_{body.clip_index}_final.mp4"
                    video_path = os.path.join(output_folder, clip_file)
                    
                    if os.path.exists(video_path):
                        logger.info(f"Found video at: {video_path}")
                    else:
                        logger.warning(f"Video not found at: {video_path}")
                        video_path = None
                        
            except Exception as e:
                logger.warning(f"Could not get video path from database: {e}")
            
            # Fallback to file system search if database lookup failed
            if not video_path or not os.path.exists(video_path):
                autocliper_output = os.getenv("AUTOCLIPER_OUTPUT_DIR", "../autocliper-v2/tmp/output")
                
                # Try various path patterns
                possible_paths = [
                    os.path.join(autocliper_output, f"job_{body.request_log_id}", f"clip_{body.clip_index}_final.mp4"),
                    os.path.join(autocliper_output, str(body.request_log_id), f"clip_{body.clip_index}_final.mp4"),
                ]
                
                for path in possible_paths:
                    if os.path.exists(path):
                        video_path = path
                        logger.info(f"Found video via fallback at: {video_path}")
                        break
            
            if not video_path or not os.path.exists(video_path):
                raise FileNotFoundError(f"Could not find video for request_log_id={body.request_log_id}, clip_index={body.clip_index}")
        
        if not video_path:
            raise ValueError("Either video_path or request_log_id + clip_index required")
        
        job = social_upload_service.create_upload(
            user_id=user_id,
            account_id=body.account_id,
            video_path=video_path,
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
        logger.error(f"Social upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/upload/queue", response_model=List[SocialUploadResponse])
async def get_social_upload_queue(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    current: dict = Depends(get_current_user)
):
    """Get social upload queue"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    status_list = status.split(",") if status else None
    
    if role == "admin":
        jobs = social_upload_service.get_queue(platform=platform, status=status_list)
    else:
        jobs = social_upload_service.get_queue(user_id=user_id, platform=platform, status=status_list)
    
    return [_social_upload_to_response(j) for j in jobs]


@router.get("/upload/{upload_id}", response_model=SocialUploadResponse)
async def get_social_upload(upload_id: int, current: dict = Depends(get_current_user)):
    """Get social upload details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = social_upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _social_upload_to_response(job)


@router.delete("/upload/{upload_id}")
async def cancel_social_upload(upload_id: int, current: dict = Depends(get_current_user)):
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
