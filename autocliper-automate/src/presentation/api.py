"""
Presentation Layer - FastAPI REST API
TikTok & Multi-Platform Automate endpoints
Refactored with modular routes for clean architecture
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import api_router
from ..infrastructure.database import database
from ..application.services import upload_worker, social_upload_worker

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
    
    # Start upload workers
    await upload_worker.start()
    await social_upload_worker.start()
    
    yield
    
    # Shutdown
    logger.info("Shutting down AutoCliper Automate...")
    await upload_worker.stop()
    await social_upload_worker.stop()


# ─────────────────────────────────────────────────────────────────────────────
#  FastAPI App
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AutoCliper Automate",
    version="1.0.0",
    description="TikTok & Multi-Platform Auto Upload API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://100.64.5.96:5173",
        "http://100.64.5.96",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routes
app.include_router(api_router, prefix="/api/v1")


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
        "tiktok_upload_worker": upload_worker._running,
        "social_upload_worker": social_upload_worker._running,
    }
