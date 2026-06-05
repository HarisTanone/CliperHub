"""
Admin Routes - Configuration, system management
"""
import os
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends

from ..dependencies import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()

# Default pipeline config
PIPELINE_CONFIG = {
    "max_concurrent_jobs": int(os.getenv("MAX_CONCURRENT_JOBS", "2")),
    "max_clip_duration": int(os.getenv("MAX_CLIP_DURATION", "90")),
    "min_clip_duration": int(os.getenv("MIN_CLIP_DURATION", "15")),
    "default_clips_per_video": int(os.getenv("DEFAULT_CLIPS_PER_VIDEO", "5")),
    "enable_face_tracking": os.getenv("ENABLE_FACE_TRACKING", "true").lower() == "true",
    "enable_audio_analysis": os.getenv("ENABLE_AUDIO_ANALYSIS", "true").lower() == "true",
}


@router.get("/config")
async def get_pipeline_config(_: dict = Depends(require_admin)):
    """Get current pipeline configuration."""
    return PIPELINE_CONFIG


@router.put("/config")
async def update_pipeline_config(
    body: Dict[str, Any],
    _: dict = Depends(require_admin)
):
    """Update pipeline configuration (in-memory, not persistent)."""
    allowed_keys = {
        "max_concurrent_jobs",
        "max_clip_duration",
        "min_clip_duration",
        "default_clips_per_video",
        "enable_face_tracking",
        "enable_audio_analysis",
    }
    
    for key, value in body.items():
        if key in allowed_keys:
            PIPELINE_CONFIG[key] = value
    
    logger.info(f"Pipeline config updated: {body}")
    return PIPELINE_CONFIG


@router.get("/health/detailed")
async def get_detailed_health(_: dict = Depends(require_admin)):
    """Get detailed system health information."""
    import psutil
    
    # Get system stats
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    return {
        "status": "healthy",
        "system": {
            "cpu_percent": cpu_percent,
            "memory_total_gb": round(memory.total / (1024**3), 2),
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_percent": memory.percent,
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_percent": disk.percent,
        },
        "config": PIPELINE_CONFIG,
    }
