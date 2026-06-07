"""
Admin Routes - Configuration, system management
"""
import os
import shutil
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from sqlalchemy import text

from ..dependencies import require_admin
from ...infrastructure.database import database
from ...infrastructure.redis_job_queue import job_queue, REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, REDIS_PENDING_KEY
from ...infrastructure.job_logger import job_logger

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


@router.post("/cleanup")
async def cleanup_old_outputs(
    days: int = 30,
    _: dict = Depends(require_admin)
):
    """Delete output directories older than N days. Admin only."""
    output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
    if not os.path.exists(output_dir):
        return {"status": "ok", "deleted": 0, "freed_mb": 0}
    
    cutoff = datetime.now() - timedelta(days=days)
    deleted = 0
    freed_bytes = 0
    
    for item in os.listdir(output_dir):
        item_path = os.path.join(output_dir, item)
        if not os.path.isdir(item_path):
            continue
        try:
            mtime = datetime.fromtimestamp(os.path.getmtime(item_path))
            if mtime < cutoff:
                for root, dirs, files in os.walk(item_path):
                    for f in files:
                        freed_bytes += os.path.getsize(os.path.join(root, f))
                shutil.rmtree(item_path)
                deleted += 1
        except Exception as e:
            logger.warning(f"Cleanup failed for {item_path}: {e}")
    
    return {
        "status": "ok",
        "deleted": deleted,
        "freed_mb": round(freed_bytes / (1024 * 1024), 1),
        "cutoff_days": days,
    }


@router.post("/clear-all-data")
async def clear_all_data(_: dict = Depends(require_admin)):
    """
    Clear ALL non-essential data. Admin only.
    
    This will:
    - Truncate history/queue/log/session tables in the database
    - Delete all social accounts and TikTok accounts
    - Flush Redis queue and cache
    - Delete all output files (clips, originals, thumbnails)
    - Clean tmp directories
    
    Tables preserved: users, caption_styles, caption_templates, fonts, hook_styles, browser_fingerprints
    """
    results = {
        "database": {"tables_cleared": [], "errors": []},
        "redis": {"flushed": False, "error": None},
        "files": {"directories_deleted": 0, "freed_mb": 0, "errors": []},
    }
    
    # ─── 1. Clear database tables ─────────────────────────────────────────────
    tables_to_clear = [
        # Child tables first (FK references to accounts)
        "social_upload_queue",
        "social_sessions",
        "tiktok_sessions",
        "upload_history",
        "upload_queue",
        "account_activity_log",
        "account_warmup",
        "video_performance",
        "pending_verifications",
        "scheduled_jobs",
        "audit_log",
        "proxy_configs",
        "request_log",
        # Parent tables last
        "social_accounts",
        "tiktok_accounts",
    ]
    
    session = database.get_session()
    try:
        for table in tables_to_clear:
            try:
                session.execute(text(f"DELETE FROM `{table}`"))
                results["database"]["tables_cleared"].append(table)
            except Exception as e:
                results["database"]["errors"].append(f"{table}: {str(e)}")
        session.commit()
    except Exception as e:
        session.rollback()
        results["database"]["errors"].append(f"commit failed: {str(e)}")
    finally:
        session.close()
    
    # ─── 2. Flush Redis queue ─────────────────────────────────────────────────
    try:
        if job_queue._use_redis and job_queue._redis:
            pipe = job_queue._redis.pipeline()
            pipe.delete(REDIS_QUEUE_KEY)
            pipe.delete(REDIS_PROCESSING_KEY)
            pipe.delete(REDIS_PENDING_KEY)
            # Also flush any autocliper: prefixed keys
            keys = job_queue._redis.keys("autocliper:*")
            if keys:
                pipe.delete(*keys)
            pipe.execute()
            results["redis"]["flushed"] = True
        
        # Clear in-memory queue state
        with job_queue._lock:
            job_queue._pending = []
            job_queue._processing_url = None
            job_queue._processing_job_id = None
        
        # Reset job_logger so frontend stops showing "Currently Processing"
        job_logger._reset_state()
        job_logger._push_ws()  # Broadcast idle state to frontend
        
    except Exception as e:
        results["redis"]["error"] = str(e)
    
    # ─── 3. Clean output files ────────────────────────────────────────────────
    output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
    freed_bytes = 0
    dirs_deleted = 0
    
    if os.path.exists(output_dir):
        for item in os.listdir(output_dir):
            item_path = os.path.join(output_dir, item)
            try:
                if os.path.isdir(item_path):
                    for root, dirs, files in os.walk(item_path):
                        for f in files:
                            try:
                                freed_bytes += os.path.getsize(os.path.join(root, f))
                            except OSError:
                                pass
                    shutil.rmtree(item_path)
                    dirs_deleted += 1
                elif os.path.isfile(item_path):
                    freed_bytes += os.path.getsize(item_path)
                    os.remove(item_path)
            except Exception as e:
                results["files"]["errors"].append(f"{item}: {str(e)}")
    
    # Also clean tmp root (but keep the output directory itself)
    tmp_dir = os.path.dirname(output_dir) if output_dir.endswith("/output") else "./tmp"
    if os.path.exists(tmp_dir):
        for item in os.listdir(tmp_dir):
            item_path = os.path.join(tmp_dir, item)
            # Keep the output dir structure
            if os.path.basename(item_path) == "output":
                continue
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                    dirs_deleted += 1
                elif os.path.isfile(item_path):
                    freed_bytes += os.path.getsize(item_path)
                    os.remove(item_path)
            except Exception as e:
                results["files"]["errors"].append(f"tmp/{item}: {str(e)}")
    
    results["files"]["directories_deleted"] = dirs_deleted
    results["files"]["freed_mb"] = round(freed_bytes / (1024 * 1024), 1)
    
    logger.info(f"[CLEAR ALL DATA] Completed: {results}")
    
    return {
        "status": "ok",
        "message": "All non-essential data has been cleared",
        **results,
    }

