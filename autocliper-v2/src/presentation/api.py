"""
Presentation Layer - FastAPI REST API with JWT Authentication
Refactored with modular routes for clean architecture
"""
import os
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .routes import api_router
from ..domain.entities import JobRequest
from ..application.services import VideoProcessingPipeline
from ..infrastructure.database import database
from ..infrastructure.repositories import RequestLogRepository
from ..infrastructure.job_queue import job_queue, QueuedJob
from ..infrastructure.job_logger import job_logger
from ..infrastructure.websocket_manager import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Background Worker
# ─────────────────────────────────────────────────────────────────────────────
async def _queue_worker():
    """Background worker that processes jobs from the queue."""
    from concurrent.futures import ThreadPoolExecutor
    
    pipeline = VideoProcessingPipeline()
    executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="video_worker")
    
    while True:
        try:
            queued = await job_queue.dequeue()
            job_req = queued.job_request
            
            job_queue.set_processing(job_req.urls, getattr(queued, 'log_id', None))
            logger.info(f"Processing job: {job_req.urls}")
            
            try:
                loop = asyncio.get_event_loop()
                if job_req.base_only:
                    await loop.run_in_executor(executor, pipeline.process_job_base_only, job_req)
                else:
                    await loop.run_in_executor(executor, pipeline.process_job, job_req)
            except Exception as e:
                logger.error(f"Job failed: {job_req.urls} - {e}")
            finally:
                job_queue.set_processing(None)
        
        except asyncio.CancelledError:
            logger.info("Queue worker cancelled")
            break
        except Exception as e:
            logger.error(f"Queue worker error: {e}")
            await asyncio.sleep(5)


# ─────────────────────────────────────────────────────────────────────────────
#  Lifespan
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Starting AutoCliper v2...")
    
    # Initialize database
    try:
        database.create_tables()
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    # Check Ollama + Qwen availability for AI fallback
    try:
        from ..infrastructure.qwen_local_analyzer import is_ollama_available, QWEN_CONFIG
        qwen_model = QWEN_CONFIG["model"]
        if is_ollama_available():
            logger.info(f"✅ Ollama + {qwen_model} available (AI fallback ready)")
        else:
            logger.warning(f"⚠️  Ollama/{qwen_model} not available. Run: QWEN_MODEL={qwen_model} ./scripts/setup_ollama.sh")
    except Exception as e:
        logger.warning(f"⚠️  Ollama check failed: {e}")
    
    # Start background worker
    worker_task = asyncio.create_task(_queue_worker())
    
    # Wire WebSocket broadcaster
    loop = asyncio.get_event_loop()
    job_logger.set_ws_broadcaster(ws_manager.broadcast_job_progress, loop)
    
    # Resume unfinished jobs
    try:
        session = database.get_session()
        try:
            pending_jobs = RequestLogRepository(session).get_pending_jobs()
        finally:
            session.close()
        
        if pending_jobs:
            logger.info(f"Resuming {len(pending_jobs)} unfinished job(s)...")
            for log in pending_jobs:
                job_request = JobRequest(
                    urls=log.youtube_url,
                    caption_style=log.caption_style_id,
                    user_id=log.user_id,
                    hook_style_id=log.hook_style_id,
                )
                job_queue.enqueue(QueuedJob(job_request=job_request))
                logger.info(f"  Re-queued job #{log.id}: {log.youtube_url}")
    except Exception as e:
        logger.error(f"Failed to resume pending jobs: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AutoCliper v2...")
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


# ─────────────────────────────────────────────────────────────────────────────
#  FastAPI App
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AutoCliper v2",
    version="2.0.0",
    description="Automatic YouTube video clipping with AI analysis",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://100.64.5.96:5173",
        "http://100.64.5.96",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include modular routes
app.include_router(api_router, prefix="/api/v1")


# ─────────────────────────────────────────────────────────────────────────────
#  File Serving (direct path)
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import Query, HTTPException, Depends
from fastapi.responses import FileResponse
from .dependencies import get_current_user

@app.get("/api/v1/files")
async def serve_file_by_path(
    path: str = Query(..., description="File path relative to output dir"),
    current: dict = Depends(get_current_user)
):
    """Serve a file by its path. Used for thumbnails and video files."""
    OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./tmp/output")
    
    # Security: ensure path doesn't escape the output directory
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    
    # Normalize the path - remove leading ./
    normalized = path.lstrip("./")
    full_path = os.path.join(OUTPUT_DIR, normalized.replace(OUTPUT_DIR.lstrip("./") + "/", ""))
    
    # Also try the path directly if it starts with OUTPUT_DIR pattern
    if not os.path.isfile(full_path):
        full_path = path
    
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    
    # Determine media type
    if full_path.endswith(".mp4"):
        media_type = "video/mp4"
    elif full_path.endswith(".jpg") or full_path.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif full_path.endswith(".png"):
        media_type = "image/png"
    else:
        media_type = "application/octet-stream"
    
    filename = os.path.basename(full_path)
    return FileResponse(full_path, media_type=media_type, filename=filename)


# ─────────────────────────────────────────────────────────────────────────────
#  Health Check (root level)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    queue_status = job_queue.get_status()
    return {
        "status": "healthy",
        "service": "AutoCliper v2",
        "queue_length": queue_status["queue_length"],
        "processing_url": queue_status["processing_url"],
    }


# ─────────────────────────────────────────────────────────────────────────────
#  WebSocket
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time job updates."""
    # Default user_id=0 for anonymous connections
    user_id = 0
    await ws_manager.connect(websocket, user_id=user_id)
    try:
        while True:
            # Keep connection alive, handle incoming messages if needed
            data = await websocket.receive_text()
            # Echo or handle commands
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, user_id=user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await ws_manager.disconnect(websocket, user_id=user_id)
