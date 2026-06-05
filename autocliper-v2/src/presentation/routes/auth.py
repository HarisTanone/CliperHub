"""
Auth Routes - Login, Logout, Token Refresh, Profile
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request, status

from ..schemas.auth import (
    LoginRequest, TokenResponse, RefreshTokenRequest,
    ChangePasswordRequest, ProfileUpdateRequest
)
from ..schemas.users import UserResponse
from ..dependencies import get_current_user, login_limiter
from ...infrastructure.database import database
from ...infrastructure.repositories import UserRepository
from ...infrastructure.auth import (
    verify_password, create_token_pair, 
    rotate_refresh_token, decode_refresh_token,
    revoke_refresh_token, hash_password
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    """Authenticate user and return JWT tokens."""
    client_ip = request.client.host if request.client else "unknown"
    
    if login_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_username(body.username)
        
        if user is None or not verify_password(body.password, user.hashed_password):
            login_limiter.record_attempt(client_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated"
            )
        
        login_limiter.reset(client_ip)
        
        user_data = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
        }
        access_token, refresh_token = create_token_pair(user_data)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            username=user.username,
            role=user.role
        )
    finally:
        session.close()


@router.get("/me")
async def get_current_user_info(current: dict = Depends(get_current_user)):
    """Get current user info from token."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(int(current["sub"]))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
        }
    finally:
        session.close()


@router.post("/refresh")
async def refresh_token(current: dict = Depends(get_current_user)):
    """Generate new access token using valid current token."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(int(current["sub"]))
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        user_data = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
        }
        access_token, refresh_token = create_token_pair(user_data)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            username=user.username,
            role=user.role
        )
    finally:
        session.close()


@router.post("/token/refresh")
async def rotate_token(body: RefreshTokenRequest):
    """Rotate refresh token - get new access + refresh token pair."""
    result = rotate_refresh_token(body.refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    new_access, new_refresh, payload = result
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        username=payload.get("username"),
        role=payload.get("role")
    )


@router.post("/logout")
async def logout(body: RefreshTokenRequest):
    """Revoke refresh token on logout."""
    revoke_refresh_token(body.refresh_token)
    return {"status": "logged out"}


@router.put("/change-password")
async def change_password(body: ChangePasswordRequest, current: dict = Depends(get_current_user)):
    """Change user password."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(int(current["sub"]))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        repo.update(user.id, {"hashed_password": hash_password(body.new_password)})
        return {"status": "password changed"}
    finally:
        session.close()


@router.put("/profile")
async def update_profile(body: ProfileUpdateRequest, current: dict = Depends(get_current_user)):
    """Update user profile (email only for now)."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(int(current["sub"]))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        update_data = {}
        if body.email is not None:
            update_data["email"] = body.email
        
        if update_data:
            repo.update(user.id, update_data)
        
        user = repo.get_by_id(user.id)
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
        }
    finally:
        session.close()
