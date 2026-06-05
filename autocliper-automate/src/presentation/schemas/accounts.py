"""
TikTok Account Schemas
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any


class CreateAccountRequest(BaseModel):
    account_name: str
    login_type: str = "manual"  # email, username, phone, manual
    login_identifier: Optional[str] = None
    password: Optional[str] = None
    proxy_url: Optional[str] = None
    daily_upload_limit: int = 3
    notes: Optional[str] = None
    auto_login: bool = True


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


class TriggerLoginRequest(BaseModel):
    manual: bool = False


class CreateAccountResponse(BaseModel):
    account: AccountResponse
    login_triggered: bool = False
    login_result: Optional[Dict[str, Any]] = None
