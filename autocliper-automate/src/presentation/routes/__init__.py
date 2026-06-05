"""
API Routes - Modular endpoint registration for AutoCliper Automate
"""
from fastapi import APIRouter

from .accounts import router as accounts_router
from .uploads import router as uploads_router
from .social import router as social_router

# Main API router
api_router = APIRouter()

api_router.include_router(accounts_router, prefix="/tiktok/accounts", tags=["TikTok Accounts"])
api_router.include_router(uploads_router, prefix="/tiktok/upload", tags=["TikTok Uploads"])
api_router.include_router(social_router, prefix="/social", tags=["Social Media"])

__all__ = ["api_router"]
