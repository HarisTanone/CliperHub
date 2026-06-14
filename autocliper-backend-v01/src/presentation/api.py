"""FastAPI application with lifespan and CORS."""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.presentation.routes.jobs import router as jobs_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create dirs. Shutdown: cleanup."""
    os.makedirs(settings.DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    logger.info("Server started — local pipeline mode (no Colab/Drive)")
    yield
    logger.info("Server stopped")


app = FastAPI(
    title="AutoCliper Backend v0.1",
    description="Pipeline otomatis konversi YouTube → klip pendek viral. "
    "Semua processing lokal: YouTube Transcript → Gemini → FFmpeg trim → Whisper word-level.",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(jobs_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.2.0", "mode": "local"}
