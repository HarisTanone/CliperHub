"""
TikTok Account Routes
"""
import logging
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends

from ..schemas.accounts import (
    CreateAccountRequest, UpdateAccountRequest, AccountResponse,
    TriggerLoginRequest
)
from ..dependencies import get_current_user, require_admin
from ...infrastructure.database import database
from ...infrastructure.repositories import SessionRepository
from ...application.services import account_service
from ...domain.entities import CreateAccountRequest as DomainCreateRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def _account_to_response(account) -> AccountResponse:
    """Convert domain account to response model"""
    session_valid = False
    session = database.get_session()
    try:
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
        login_identifier=account.login_identifier or "",
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


@router.post("", status_code=201)
async def create_account(
    body: CreateAccountRequest,
    current: dict = Depends(get_current_user)
):
    """Create a new TikTok account and optionally trigger login"""
    try:
        user_id = int(current.get("sub"))
        
        # Validate credentials for auto-login
        if body.login_type != "manual":
            if not body.login_identifier:
                raise HTTPException(status_code=400, detail="login_identifier required for auto login")
            if not body.password:
                raise HTTPException(status_code=400, detail="password required for auto login")
        
        request = DomainCreateRequest(
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
        
        # Auto-login if requested
        login_result = None
        if body.auto_login:
            try:
                is_manual = body.login_type == "manual"
                logger.info(f"Auto-triggering {'manual' if is_manual else 'auto'} login for account {account.id}")
                login_result = await account_service.trigger_login(account.id, manual=is_manual)
                
                # If login failed, delete the account
                if not login_result.get("success") and not login_result.get("needs_verification"):
                    logger.warning(f"Login failed for account {account.id}, deleting")
                    account_service.delete_account(account.id)
                    raise HTTPException(status_code=400, detail=login_result.get("message", "Login failed"))
                
                # Refresh account data
                account = account_service.get_account(account.id)
                account_response = _account_to_response(account)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Auto-login error: {e}")
                account_service.delete_account(account.id)
                raise HTTPException(status_code=400, detail=f"Login failed: {str(e)}")
        
        response = account_response.model_dump()
        response["login_triggered"] = body.auto_login
        response["login_result"] = login_result
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create account error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[AccountResponse])
async def list_accounts(current: dict = Depends(get_current_user)):
    """List TikTok accounts. Users see their own, admins see all."""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    if role == "admin":
        accounts = account_service.get_all_accounts()
    else:
        accounts = account_service.get_accounts_by_user(user_id)
    
    return [_account_to_response(a) for a in accounts]


@router.get("/available", response_model=List[AccountResponse])
async def list_available_accounts(current: dict = Depends(get_current_user)):
    """List accounts available for upload (not at daily limit)"""
    user_id = int(current.get("sub"))
    accounts = account_service.get_available_accounts(user_id)
    return [_account_to_response(a) for a in accounts]


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(account_id: int, current: dict = Depends(get_current_user)):
    """Get account details"""
    user_id = int(current.get("sub"))
    role = current.get("role")
    
    account = account_service.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if role != "admin" and account.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return _account_to_response(account)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    body: UpdateAccountRequest,
    current: dict = Depends(get_current_user)
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


@router.delete("/{account_id}")
async def delete_account(account_id: int, current: dict = Depends(get_current_user)):
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


@router.post("/{account_id}/login")
async def trigger_login(
    account_id: int,
    body: Optional[TriggerLoginRequest] = None,
    current: dict = Depends(get_current_user)
):
    """Trigger login for an account"""
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


@router.post("/{account_id}/validate")
async def validate_session(account_id: int, current: dict = Depends(get_current_user)):
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
