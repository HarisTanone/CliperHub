"""
TikTok Upload Routes
"""
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends

from ..schemas.uploads import (
    UploadFromClipRequestModel, BulkUploadRequestModel,
    UploadResponse, ScheduleSuggestionResponse
)
from ..dependencies import get_current_user
from ...infrastructure.database import database
from ...infrastructure.repositories import TikTokAccountRepository
from ...application.services import upload_service
from ...domain.entities import UploadFromClipRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def _upload_to_response(job) -> UploadResponse:
    """Convert domain upload to response model"""
    account_name = None
    session = database.get_session()
    try:
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


@router.post("/from-clip", response_model=UploadResponse)
async def upload_from_clip(
    body: UploadFromClipRequestModel,
    current: dict = Depends(get_current_user)
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


@router.post("/bulk", response_model=List[UploadResponse])
async def bulk_upload(
    body: BulkUploadRequestModel,
    current: dict = Depends(get_current_user)
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
            errors.append({"clip_index": upload_req.clip_index, "error": str(e)})
    
    if errors and not results:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    return results


@router.get("/queue", response_model=List[UploadResponse])
async def get_upload_queue(
    status: Optional[str] = None,
    current: dict = Depends(get_current_user)
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


@router.get("/suggest-schedule", response_model=List[ScheduleSuggestionResponse])
async def suggest_schedule(
    account_id: int,
    clips_count: int = 1,
    current: dict = Depends(get_current_user)
):
    """Suggest optimal upload times"""
    suggestions = upload_service.suggest_schedule(account_id, clips_count)
    return [ScheduleSuggestionResponse(**s) for s in suggestions]


@router.get("/{upload_id}", response_model=UploadResponse)
async def get_upload(upload_id: int, current: dict = Depends(get_current_user)):
    """Get upload details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _upload_to_response(job)


@router.put("/{upload_id}", response_model=UploadResponse)
async def update_upload(
    upload_id: int,
    body: Dict[str, Any],
    current: dict = Depends(get_current_user)
):
    """Update upload (reschedule, edit caption)"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    allowed_fields = {"caption", "hashtags", "scheduled_at", "priority"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    updated = upload_service.update_upload(upload_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return _upload_to_response(updated)


@router.delete("/{upload_id}")
async def cancel_upload(upload_id: int, current: dict = Depends(get_current_user)):
    """Cancel an upload"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not upload_service.cancel_upload(upload_id):
        raise HTTPException(status_code=400, detail="Cannot cancel upload")
    
    return {"status": "cancelled", "upload_id": upload_id}


@router.post("/{upload_id}/retry", response_model=UploadResponse)
async def retry_upload(upload_id: int, current: dict = Depends(get_current_user)):
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
        raise HTTPException(status_code=400, detail="Cannot retry upload")
    
    return _upload_to_response(retried)


@router.get("/{upload_id}/history")
async def get_upload_history(upload_id: int, current: dict = Depends(get_current_user)):
    """Get upload event history"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    job = upload_service.get_upload(upload_id)
    if not job:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    if role != "admin" and job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return upload_service.get_upload_history(upload_id)
