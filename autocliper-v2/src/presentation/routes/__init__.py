"""
API Routes - Modular endpoint registration
"""
from fastapi import APIRouter

from .auth import router as auth_router
from .users import router as users_router
from .jobs import router as jobs_router
from .styles import router as styles_router
from .analytics import router as analytics_router
from .admin import router as admin_router

# Main API router that includes all sub-routers
api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(jobs_router, prefix="/jobs", tags=["Jobs"])
api_router.include_router(styles_router, tags=["Styles"])
api_router.include_router(analytics_router, tags=["Analytics"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])

__all__ = ["api_router"]
