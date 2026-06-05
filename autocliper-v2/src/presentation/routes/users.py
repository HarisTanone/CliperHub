"""
User Routes - CRUD operations for user management
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from ..schemas.users import CreateUserRequest, UpdateUserRequest, UserResponse
from ..dependencies import get_current_user, require_admin
from ...infrastructure.database import database
from ...infrastructure.repositories import UserRepository
from ...infrastructure.auth import hash_password

logger = logging.getLogger(__name__)
router = APIRouter()


def _user_to_response(u) -> UserResponse:
    """Convert user model to response."""
    return UserResponse(
        id=u.id,
        username=u.username,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at.isoformat() if u.created_at else None
    )


@router.get("/", response_model=List[UserResponse])
async def list_users(_: dict = Depends(require_admin)):
    """List all users (admin only)."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        users = repo.get_all()
        return [_user_to_response(u) for u in users]
    finally:
        session.close()


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(body: CreateUserRequest, _: dict = Depends(require_admin)):
    """Create a new user (admin only)."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        
        if repo.get_by_username(body.username):
            raise HTTPException(status_code=400, detail="Username already exists")
        
        user = repo.create(
            username=body.username,
            password_hash=hash_password(body.password),
            email=body.email,
            role=body.role
        )
        return _user_to_response(user)
    finally:
        session.close()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, _: dict = Depends(require_admin)):
    """Get user by ID (admin only)."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return _user_to_response(user)
    finally:
        session.close()


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    _: dict = Depends(require_admin)
):
    """Update user (admin only)."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        update_data = body.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["password_hash"] = hash_password(update_data.pop("password"))
        
        repo.update(user_id, update_data)
        user = repo.get_by_id(user_id)
        return _user_to_response(user)
    finally:
        session.close()


@router.delete("/{user_id}")
async def delete_user(user_id: int, current: dict = Depends(require_admin)):
    """Delete user (admin only). Cannot delete self."""
    if int(current["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        repo.delete(user_id)
        return {"status": "deleted", "user_id": user_id}
    finally:
        session.close()
