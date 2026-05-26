"""
Presentation Layer - FastAPI REST API with JWT Authentication
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Request, status, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging
import traceback
import os
import time
import json
import asyncio
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from ..domain.entities import JobRequest, ProcessingState
from ..application.services import VideoProcessingPipeline
from ..infrastructure.database import database
from ..infrastructure.job_logger import job_logger
from ..infrastructure.job_queue import job_queue, QueuedJob
from ..infrastructure.repositories import (
    CaptionStyleRepository, RequestLogRepository, UserRepository,
    FontRepository, HookStyleRepository
)
from ..infrastructure.external_services import YouTubeDownloader
from ..infrastructure.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
    create_token_pair, rotate_refresh_token, decode_refresh_token,
    revoke_refresh_token, create_refresh_token
)
from ..infrastructure.websocket_manager import ws_manager
from ..infrastructure.engagement_predictor import engagement_predictor
from ..infrastructure.trending_audio import trending_audio_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Rate Limiter (in-memory, per-IP)
# ─────────────────────────────────────────────────────────────────────────────
class RateLimiter:
    """Simple in-memory rate limiter for login endpoint."""
    
    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, List[float]] = defaultdict(list)
    
    def is_rate_limited(self, key: str) -> bool:
        now = time.time()
        # Clean old entries
        self._attempts[key] = [
            t for t in self._attempts[key]
            if now - t < self.window_seconds
        ]
        return len(self._attempts[key]) >= self.max_attempts
    
    def record_attempt(self, key: str):
        self._attempts[key].append(time.time())
    
    def reset(self, key: str):
        self._attempts.pop(key, None)


login_limiter = RateLimiter(max_attempts=5, window_seconds=300)


# ─────────────────────────────────────────────────────────────────────────────
#  Path security helper
# ─────────────────────────────────────────────────────────────────────────────
def _safe_file_path(base_dir: str, filename: str) -> str:
    """Resolve file path safely, preventing path traversal attacks."""
    # Reject obviously malicious filenames
    if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Resolve and verify the path stays within base_dir
    resolved = os.path.realpath(os.path.join(base_dir, filename))
    base_resolved = os.path.realpath(base_dir)
    
    if not resolved.startswith(base_resolved + os.sep) and resolved != base_resolved:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    return resolved

# ─────────────────────────────────────────────────────────────────────────────
#  Lifespan (replaces deprecated @app.on_event)
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # ── Startup ──
    logger.info("Starting AutoCliper v2...")
    try:
        database.create_tables()
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    asyncio.create_task(_queue_worker())

    # Wire WebSocket broadcaster to job_logger for real-time push
    loop = asyncio.get_event_loop()
    job_logger.set_ws_broadcaster(ws_manager.broadcast_job_progress, loop)

    # Resume unfinished jobs from DB (pending/processing on last shutdown)
    try:
        session = database.get_session()
        try:
            pending_jobs = RequestLogRepository(session).get_pending_jobs()
        finally:
            session.close()

        if pending_jobs:
            logger.info(f"Resuming {len(pending_jobs)} unfinished job(s) from database...")
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
    
    # ── Shutdown ──
    logger.info("Shutting down AutoCliper v2...")


app = FastAPI(
    title="AutoCliper v2",
    version="2.0.0",
    description="Automatic YouTube video clipping with AI analysis — JWT protected",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
#  Auth helpers
# ─────────────────────────────────────────────────────────────────────────────
security = HTTPBearer()


def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Decode JWT and return the payload dict. Raises 401 on any error."""
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def _require_admin(current_user: dict = Depends(_get_current_user)):
    """Same as _get_current_user but also requires role == 'admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
#  Request / Response Models
# ─────────────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str = ""
    token_type: str = "bearer"
    username: str
    role: str
    expires_in: int = 1800  # seconds (30 min)


class CreateUserRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: str = "user"   # "admin" or "user"


class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None   # provide to change password


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool
    created_at: Optional[str]


class JobRequestModel(BaseModel):
    urls: str  # Single URL or newline/comma-separated multiple URLs
    caption_style: int
    hook_style_id: Optional[int] = None


class BatchJobResponse(BaseModel):
    status: str
    message: str
    total_urls: int = 1
    accepted: int = 0
    skipped: int = 0
    results: List[Dict[str, Any]] = []


class JobResponse(BaseModel):
    status: str
    message: str
    job_id: Optional[int] = None


class FontResponse(BaseModel):
    id: int
    name: str
    file_name: str
    download_url: str
    created_at: Optional[str] = None


class FontCreateModel(BaseModel):
    name: str
    file_name: str
    download_url: str


class FontUpdateModel(BaseModel):
    name: Optional[str] = None
    file_name: Optional[str] = None
    download_url: Optional[str] = None


class HookStyleResponse(BaseModel):
    id: int
    name: str
    config: Dict[str, Any]
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class HookStyleCreateModel(BaseModel):
    name: str
    config: Dict[str, Any]
    is_active: bool = True


class HookStyleUpdateModel(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class CaptionStyleResponse(BaseModel):
    id: int
    name: str
    font_id: Optional[int] = None
    font_family: str
    font_weight: str
    font_size: int
    color: str
    highlight_color: str
    outline_color: str
    outline_width: int
    shadow_color: str
    shadow_offset_x: int
    shadow_offset_y: int
    line_spacing: float
    caption_bottom_margin: int
    user_id: Optional[int] = None


class CaptionStyleCreateModel(BaseModel):
    name: str
    font_id: Optional[int] = None
    font_weight: str = "bold"
    font_size: int = 48
    color: str = "#FFFF00"
    highlight_color: str = "#FFF45C"
    outline_color: str = "#000000"
    outline_width: int = 3
    shadow_color: str = "#000000"
    shadow_offset_x: int = 2
    shadow_offset_y: int = 2
    line_spacing: float = 1.0
    caption_bottom_margin: int = 70


class CaptionStyleUpdateModel(BaseModel):
    name: Optional[str] = None
    font_id: Optional[int] = None
    font_weight: Optional[str] = None
    font_size: Optional[int] = None
    color: Optional[str] = None
    highlight_color: Optional[str] = None
    outline_color: Optional[str] = None
    outline_width: Optional[int] = None
    shadow_color: Optional[str] = None
    shadow_offset_x: Optional[int] = None
    shadow_offset_y: Optional[int] = None
    line_spacing: Optional[float] = None
    caption_bottom_margin: Optional[int] = None


class ClipInfo(BaseModel):
    index: int
    start_time: float
    end_time: float
    hook: str
    score: float
    reason: str


class JobHistoryResponse(BaseModel):
    id: int
    youtube_url: str
    caption_style_id: int
    hook_style_id: Optional[int] = None
    status: str
    output_path: Optional[str] = None
    requested_at: Optional[str] = None
    clips: List[ClipInfo] = []
    output_files: List[str] = []
    thumbnails: List[str] = []


class JobStatusResponse(BaseModel):
    id: int
    youtube_url: str
    status: str
    output_path: Optional[str] = None
    clips_count: int = 0


# ─────────────────────────────────────────────────────────────────────────────
#  Global processing service + thread pool
# ─────────────────────────────────────────────────────────────────────────────
video_service = VideoProcessingPipeline()

_job_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="video_worker")


async def _queue_worker():
    """Single worker that drains the queue sequentially."""
    while True:
        queued: QueuedJob = await job_queue.dequeue()
        job_queue.set_processing(queued.job_request.urls, getattr(queued, 'log_id', None))
        try:
            loop = asyncio.get_event_loop()
            # Check if this is a base-only job
            if queued.job_request.base_only:
                await loop.run_in_executor(
                    _job_executor,
                    video_service.process_job_base_only,
                    queued.job_request
                )
            else:
                await loop.run_in_executor(
                    _job_executor,
                    video_service.process_job,
                    queued.job_request
                )
        except Exception as e:
            logger.error(f"Queue worker error: {e}")
        finally:
            job_queue.set_processing(None)


# ─────────────────────────────────────────────────────────────────────────────
#  ① Public endpoints (no auth required)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Enhanced health check with system status"""
    import shutil
    
    # Disk space check
    output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
    try:
        disk = shutil.disk_usage(output_dir if os.path.exists(output_dir) else "/")
        disk_free_gb = disk.free / (1024 ** 3)
        disk_status = "ok" if disk_free_gb > 5 else "warning" if disk_free_gb > 1 else "critical"
    except Exception:
        disk_free_gb = -1
        disk_status = "unknown"
    
    # Queue status
    queue_status = job_queue.get_status()
    
    return {
        "status": "healthy",
        "service": "AutoCliper v2",
        "queue": {
            "processing": queue_status["processing_url"] is not None,
            "pending": queue_status["queue_length"],
        },
        "disk": {
            "free_gb": round(disk_free_gb, 1),
            "status": disk_status,
        },
    }


@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    """
    Login with username + password.
    Returns a JWT Bearer token valid for 24 hours.
    Include it in all other requests as:
        Authorization: Bearer <token>
    """
    # Rate limiting by IP
    client_ip = request.client.host if request.client else "unknown"
    if login_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again in 5 minutes."
        )
    
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_username(body.username)
        if not user or not verify_password(body.password, user.hashed_password):
            login_limiter.record_attempt(client_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated"
            )
        # Successful login — reset rate limiter for this IP
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
            role=user.role,
            expires_in=1800,
        )
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ② User management (admin only)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/users/", response_model=List[UserResponse])
async def list_users(_: dict = Depends(_require_admin)):
    """List all users — admin only"""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        return [_user_to_response(u) for u in repo.get_all()]
    finally:
        session.close()


@app.post("/api/v1/users/", response_model=UserResponse, status_code=201)
async def create_user(body: CreateUserRequest, _: dict = Depends(_require_admin)):
    """Create a new user — admin only"""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        if repo.get_by_username(body.username):
            raise HTTPException(status_code=409, detail="Username already exists")
        if body.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="role must be 'admin' or 'user'")
        user = repo.create(
            username=body.username,
            hashed_password=hash_password(body.password),
            email=body.email,
            role=body.role,
        )
        return _user_to_response(user)
    finally:
        session.close()


@app.get("/api/v1/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, _: dict = Depends(_require_admin)):
    """Get user detail — admin only"""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        user = repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return _user_to_response(user)
    finally:
        session.close()


@app.put("/api/v1/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    _: dict = Depends(_require_admin)
):
    """Update user — admin only. Provide password to change it."""
    session = database.get_session()
    try:
        repo = UserRepository(session)
        update_data = body.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["hashed_password"] = hash_password(update_data.pop("password"))
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        user = repo.update(user_id, update_data)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return _user_to_response(user)
    finally:
        session.close()


@app.delete("/api/v1/users/{user_id}")
async def delete_user(user_id: int, current: dict = Depends(_require_admin)):
    """Delete user — admin only. Cannot delete yourself."""
    if str(user_id) == current.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    session = database.get_session()
    try:
        repo = UserRepository(session)
        if not repo.delete(user_id):
            raise HTTPException(status_code=404, detail="User not found")
        return {"status": "deleted", "user_id": user_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ③ Jobs — all require valid JWT
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/jobs/", response_model=BatchJobResponse)
async def create_job(
    request: JobRequestModel,
    _: dict = Depends(_get_current_user)
):
    """Submit one or more video processing jobs to the queue.
    
    Supports batch processing: pass multiple URLs separated by newline or comma.
    Each URL is validated and queued independently.
    """
    try:
        user_id = int(_.get("sub"))

        # Parse multiple URLs (split by newline, comma, or space)
        import re
        raw_urls = request.urls.strip()
        url_list = [u.strip() for u in re.split(r'[\n,]+', raw_urls) if u.strip()]
        
        # Deduplicate while preserving order
        seen = set()
        unique_urls = []
        for u in url_list:
            if u not in seen:
                seen.add(u)
                unique_urls.append(u)
        
        if not unique_urls:
            raise HTTPException(status_code=400, detail="No valid URLs provided")

        # Validate caption style once
        session = database.get_session()
        try:
            style = CaptionStyleRepository(session).get_by_id(request.caption_style)
            if not style:
                raise HTTPException(status_code=400, detail=f"Caption style {request.caption_style} not found")
            if request.hook_style_id:
                hook_style = HookStyleRepository(session).get_by_id(request.hook_style_id)
                if not hook_style:
                    raise HTTPException(status_code=400, detail=f"Hook style {request.hook_style_id} not found")
        finally:
            session.close()

        # Process each URL
        results = []
        accepted = 0
        skipped = 0
        
        for url in unique_urls:
            # Same URL already processing?
            if job_queue.is_processing(url):
                results.append({"url": url, "status": "processing", "message": "Video sedang diproses"})
                skipped += 1
                continue

            # Same URL already queued?
            if job_queue.is_queued(url):
                results.append({"url": url, "status": "queued", "message": "Video sudah ada dalam antrian"})
                skipped += 1
                continue

            job_request = JobRequest(
                urls=url,
                caption_style=request.caption_style,
                user_id=user_id,
                hook_style_id=request.hook_style_id
            )
            job_queue.enqueue(QueuedJob(job_request=job_request))
            results.append({"url": url, "status": "accepted", "message": "Job queued"})
            accepted += 1
            logger.info(f"Job queued: {url} by user {user_id}")

        # Determine overall status
        if accepted == 0:
            overall_status = "skipped"
            overall_message = "All URLs are already processing or queued"
        elif accepted == len(unique_urls):
            overall_status = "accepted"
            overall_message = f"{accepted} job(s) queued for processing"
        else:
            overall_status = "partial"
            overall_message = f"{accepted} accepted, {skipped} skipped (already processing/queued)"

        return BatchJobResponse(
            status=overall_status,
            message=overall_message,
            total_urls=len(unique_urls),
            accepted=accepted,
            skipped=skipped,
            results=results,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────────────────────────────────────
#  ③b. Two-step clip selection flow (analyze → select → process)
# ─────────────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    url: str
    caption_style: int
    hook_style_id: Optional[int] = None


class ClipCandidate(BaseModel):
    index: int
    start_time: float
    end_time: float
    hook: str
    score: float
    reason: str
    keywords: List[str] = []


class AnalyzeResponse(BaseModel):
    status: str
    url: str
    clips: List[ClipCandidate]


class ProcessSelectedRequest(BaseModel):
    url: str
    caption_style: int
    hook_style_id: Optional[int] = None
    clips: List[ClipCandidate]


# ─────────────────────────────────────────────────────────────────────────────
#  ③d. Base Processing Pipeline (no styling) + Style Rendering Pipeline
# ─────────────────────────────────────────────────────────────────────────────

class BaseProcessRequest(BaseModel):
    url: str


class BaseProcessResponse(BaseModel):
    status: str
    message: str
    job_id: Optional[int] = None


class ApplyStyleRequest(BaseModel):
    caption_style: int
    hook_style_id: Optional[int] = None


class ApplyStyleResponse(BaseModel):
    status: str
    message: str
    clips_rendered: int = 0
    clips: List[Dict[str, Any]] = []


class BaseClipInfo(BaseModel):
    index: int
    start_time: float
    end_time: float
    duration: float
    hook: str
    score: float
    keywords: List[str] = []
    base_video: str = ""
    thumbnail: str = ""


class BaseJobDetailResponse(BaseModel):
    id: int
    youtube_url: str
    status: str
    output_path: Optional[str] = None
    clips: List[BaseClipInfo] = []
    has_styled_clips: bool = False


@app.post("/api/v1/jobs/base-process", response_model=BaseProcessResponse)
async def base_process_video(
    request: BaseProcessRequest,
    current: dict = Depends(_get_current_user)
):
    """Base Processing Pipeline — process video WITHOUT any styling.
    
    Runs: download → transcribe → AI analysis → clip detection → base crop render.
    Does NOT apply: subtitle style, hook style, preset colors, animations.
    
    After completion, use GET /api/v1/jobs/{id}/base-clips to preview,
    then POST /api/v1/jobs/{id}/apply-style to render with chosen style.
    """
    try:
        user_id = int(current.get("sub"))
        
        # Check if already processing
        if job_queue.is_processing(request.url):
            return BaseProcessResponse(status="processing", message="Video sedang diproses, mohon tunggu")
        if job_queue.is_queued(request.url):
            return BaseProcessResponse(status="queued", message="Video sudah ada dalam antrian")
        
        # Create job request with minimal style (placeholder)
        job_request = JobRequest(
            urls=request.url,
            caption_style=1,  # Placeholder — not used in base processing
            user_id=user_id,
            hook_style_id=None,
            base_only=True,
        )
        
        job_queue.enqueue(QueuedJob(job_request=job_request))
        logger.info(f"Base-only job queued: {request.url} by user {user_id}")
        
        return BaseProcessResponse(
            status="accepted",
            message="Base processing started — styling will be applied later"
        )
    except Exception as e:
        logger.error(f"Base process error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to start base processing: {str(e)}")


@app.get("/api/v1/jobs/{job_id}/base-clips")
async def get_base_clips(
    job_id: int,
    current: dict = Depends(_get_current_user)
):
    """Get base clip previews for a completed base-processed job.
    
    Returns clip metadata + base video URLs for preview before styling.
    """
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        log = repo.get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        video_dir = log.output_path
        if not video_dir or not os.path.exists(video_dir):
            raise HTTPException(status_code=404, detail="Output directory not found")
        
        # Find metadata files
        clips = []
        for f in sorted(os.listdir(video_dir)):
            if f.endswith('_metadata.json'):
                import json as _json
                with open(os.path.join(video_dir, f), 'r') as mf:
                    meta = _json.load(mf)
                
                clip_index = meta['clip_index']
                base_video = meta.get('base_video', f"clip_{clip_index}_base.mp4")
                thumb = f"clip_{clip_index}_thumb.jpg"
                
                clips.append(BaseClipInfo(
                    index=clip_index,
                    start_time=meta['start_time'],
                    end_time=meta['end_time'],
                    duration=meta['duration'],
                    hook=meta['hook'],
                    score=meta.get('score', 0),
                    keywords=meta.get('keywords', []),
                    base_video=base_video,
                    thumbnail=thumb,
                ))
        
        # Fallback: if no metadata files, try to build from request_log caption_response
        # (for jobs processed with old flow that have _final.mp4 but no _metadata.json)
        if not clips and log.caption_response:
            caption_data = log.caption_response
            if isinstance(caption_data, str):
                import json as _json
                try:
                    caption_data = _json.loads(caption_data)
                except:
                    caption_data = []
            
            for i, clip_data in enumerate(caption_data):
                clip_index = i + 1
                # Check if there's a final or base video for this clip
                final_path = os.path.join(video_dir, f"clip_{clip_index}_final.mp4")
                base_path = os.path.join(video_dir, f"clip_{clip_index}_base.mp4")
                
                has_video = os.path.exists(final_path) or os.path.exists(base_path)
                if not has_video:
                    continue
                
                video_file = f"clip_{clip_index}_base.mp4" if os.path.exists(base_path) else f"clip_{clip_index}_final.mp4"
                
                # Handle both ClipData objects and dicts
                if hasattr(clip_data, 'start_time'):
                    start_t = clip_data.start_time
                    end_t = clip_data.end_time
                    hook = clip_data.hook
                    score = clip_data.score
                    keywords = clip_data.keywords if hasattr(clip_data, 'keywords') else []
                else:
                    start_t = clip_data.get('start_time', 0)
                    end_t = clip_data.get('end_time', 0)
                    hook = clip_data.get('hook', '')
                    score = clip_data.get('score', 0)
                    keywords = clip_data.get('keywords', [])
                
                clips.append(BaseClipInfo(
                    index=clip_index,
                    start_time=start_t,
                    end_time=end_t,
                    duration=end_t - start_t,
                    hook=hook,
                    score=score,
                    keywords=keywords,
                    base_video=video_file,
                    thumbnail=f"clip_{clip_index}_thumb.jpg",
                ))
        
        # Check if styled clips exist
        has_styled = any(f.endswith('_final.mp4') for f in os.listdir(video_dir))
        
        return BaseJobDetailResponse(
            id=log.id,
            youtube_url=log.youtube_url,
            status=log.status.value if hasattr(log.status, 'value') else str(log.status),
            output_path=video_dir,
            clips=clips,
            has_styled_clips=has_styled,
        )
    finally:
        session.close()


@app.get("/api/v1/jobs/{job_id}/base-clip/{clip_index}")
async def serve_base_clip(
    job_id: int,
    clip_index: int,
    current: dict = Depends(_get_current_user)
):
    """Serve a base clip video file for preview."""
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        log = repo.get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        video_dir = log.output_path
        if not video_dir or not os.path.exists(video_dir):
            raise HTTPException(status_code=404, detail="Output directory not found")
        
        # Try base clip first, then final clip as fallback
        base_path = os.path.join(video_dir, f"clip_{clip_index}_base.mp4")
        final_path = os.path.join(video_dir, f"clip_{clip_index}_final.mp4")
        
        if os.path.exists(base_path):
            return FileResponse(base_path, media_type="video/mp4")
        elif os.path.exists(final_path):
            return FileResponse(final_path, media_type="video/mp4")
        else:
            raise HTTPException(status_code=404, detail="Clip video not found")
    finally:
        session.close()


@app.post("/api/v1/jobs/{job_id}/apply-style", response_model=ApplyStyleResponse)
async def apply_style_to_job(
    job_id: int,
    request: ApplyStyleRequest,
    current: dict = Depends(_get_current_user)
):
    """Style Rendering Pipeline — Apply styling to existing base clips.
    
    Reads cached metadata + base clips, applies selected caption style + hook style.
    Can be called multiple times with different styles for fast re-render.
    
    Base clips are preserved (non-destructive editing).
    """
    try:
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            _job_executor,
            video_service.apply_style_to_clips,
            job_id,
            request.caption_style,
            request.hook_style_id,
        )
        
        return ApplyStyleResponse(
            status=result["status"],
            message=f"Style applied to {result['clips_rendered']} clips",
            clips_rendered=result["clips_rendered"],
            clips=result.get("clips", []),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Apply style error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Style rendering failed: {str(e)}")


@app.post("/api/v1/jobs/analyze", response_model=AnalyzeResponse)
async def analyze_video_for_clips(
    request: AnalyzeRequest,
    current: dict = Depends(_get_current_user)
):
    """Step 1 of 2-step flow: Analyze video and return clip candidates.
    
    User can then review, reorder, edit hooks, and select which clips to process.
    Submit selected clips to POST /api/v1/jobs/process-selected.
    """
    try:
        loop = asyncio.get_event_loop()
        
        # Run analysis in thread pool (blocking I/O)
        def _analyze():
            from ..infrastructure.external_services import GeminiService
            from ..infrastructure.video_processor import WhisperService
            
            gemini = GeminiService()
            whisper = WhisperService()
            downloader = YouTubeDownloader(os.getenv("OUTPUT_DIR", "./tmp/output"))
            
            # Download video first (needed for Whisper)
            video_info = downloader.download(request.url)
            
            # Transcribe with Whisper
            transcript = whisper.transcribe_full_video(video_info.filepath)
            
            # Analyze with Gemini
            clips = gemini.analyze_youtube_content(request.url, video_info, transcript)
            return clips
        
        clips = await loop.run_in_executor(_job_executor, _analyze)
        
        return AnalyzeResponse(
            status="success",
            url=request.url,
            clips=[
                ClipCandidate(
                    index=c.index,
                    start_time=c.start_time,
                    end_time=c.end_time,
                    hook=c.hook,
                    score=c.score,
                    reason=c.reason,
                    keywords=c.keywords,
                )
                for c in clips
            ]
        )
    except Exception as e:
        logger.error(f"Analyze error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/api/v1/jobs/process-selected", response_model=JobResponse)
async def process_selected_clips(
    request: ProcessSelectedRequest,
    current: dict = Depends(_get_current_user)
):
    """Step 2 of 2-step flow: Process only the selected/edited clips.
    
    Accepts clips from the analyze response (user can edit hooks, reorder, remove).
    Queues the job with the user-selected clips.
    """
    try:
        user_id = int(current.get("sub"))
        
        if not request.clips:
            raise HTTPException(status_code=400, detail="No clips selected")
        
        # Validate caption style
        session = database.get_session()
        try:
            style = CaptionStyleRepository(session).get_by_id(request.caption_style)
            if not style:
                raise HTTPException(status_code=400, detail=f"Caption style {request.caption_style} not found")
        finally:
            session.close()
        
        # Same URL already processing?
        if job_queue.is_processing(request.url):
            return JobResponse(status="processing", message="Video sedang diproses, mohon tunggu")
        
        job_request = JobRequest(
            urls=request.url,
            caption_style=request.caption_style,
            user_id=user_id,
            hook_style_id=request.hook_style_id,
        )
        # Attach selected clips to the job request for the pipeline to use
        job_request._selected_clips = [
            {
                "index": c.index,
                "start_time": c.start_time,
                "end_time": c.end_time,
                "hook": c.hook,
                "score": c.score,
                "reason": c.reason,
                "keywords": c.keywords,
            }
            for c in request.clips
        ]
        
        job_queue.enqueue(QueuedJob(job_request=job_request))
        return JobResponse(status="accepted", message=f"Processing {len(request.clips)} selected clips")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Process-selected error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────────────────────────────────────
#  ③c. Preview — generate low-res 5-second preview before full processing
# ─────────────────────────────────────────────────────────────────────────────

class PreviewRequest(BaseModel):
    url: str
    clip_index: int
    start_time: float
    end_time: float
    hook: str = ""
    caption_style: int = 1
    hook_style_id: Optional[int] = None


class PreviewResponse(BaseModel):
    status: str
    preview_url: str = ""
    duration: float = 0
    message: str = ""


@app.post("/api/v1/jobs/preview", response_model=PreviewResponse)
async def generate_preview(
    request: PreviewRequest,
    current: dict = Depends(_get_current_user)
):
    """Generate a 5-second low-res preview of a clip before full processing.
    
    This is fast (~10-20 seconds) and helps users verify the AI-selected moment
    is actually good before committing to full processing (which takes minutes).
    
    The preview is:
    - 5 seconds from the middle of the clip
    - Low resolution (540x960 instead of 1080x1920)
    - No subtitles (just hook overlay + basic crop)
    - Stored temporarily and auto-cleaned
    """
    try:
        user_id = int(current.get("sub"))
        
        # Validate times
        duration = request.end_time - request.start_time
        if duration <= 0:
            raise HTTPException(status_code=400, detail="Invalid time range")
        
        # Preview is 5 seconds from the middle of the clip
        preview_duration = min(5.0, duration)
        preview_start = request.start_time + (duration - preview_duration) / 2
        preview_end = preview_start + preview_duration
        
        loop = asyncio.get_event_loop()
        
        def _generate():
            import subprocess
            import shutil
            
            output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
            preview_dir = os.path.join(output_dir, "_previews")
            os.makedirs(preview_dir, exist_ok=True)
            
            # Clean old previews (older than 1 hour)
            import time as _time
            now = _time.time()
            for f in os.listdir(preview_dir):
                fp = os.path.join(preview_dir, f)
                if os.path.isfile(fp) and now - os.path.getmtime(fp) > 3600:
                    try:
                        os.remove(fp)
                    except OSError:
                        pass
            
            # Generate unique preview filename
            preview_id = f"preview_{user_id}_{request.clip_index}_{int(now)}"
            preview_path = os.path.join(preview_dir, f"{preview_id}.mp4")
            
            # Step 1: Download video (use cache if available)
            downloader = YouTubeDownloader(output_dir)
            video_info = downloader.download(request.url)
            
            # Step 2: Cut 5-second segment at low res with center crop to 9:16
            # Single FFmpeg command: seek + scale + crop + short duration
            cmd = [
                'ffmpeg',
                '-ss', str(preview_start),
                '-i', video_info.filepath,
                '-t', str(preview_duration),
                '-vf', 'scale=-2:960,crop=540:960:(iw-540)/2:0',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
                '-c:a', 'aac', '-b:a', '96k',
                '-y', preview_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                # Fallback: simpler command without crop
                cmd_simple = [
                    'ffmpeg',
                    '-ss', str(preview_start),
                    '-i', video_info.filepath,
                    '-t', str(preview_duration),
                    '-vf', 'scale=540:-2',
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
                    '-c:a', 'aac', '-b:a', '96k',
                    '-y', preview_path
                ]
                result = subprocess.run(cmd_simple, capture_output=True, text=True, timeout=60)
                if result.returncode != 0:
                    raise RuntimeError(f"FFmpeg preview failed: {result.stderr[:200]}")
            
            return preview_id, preview_duration
        
        preview_id, actual_duration = await loop.run_in_executor(_job_executor, _generate)
        
        return PreviewResponse(
            status="success",
            preview_url=f"/api/v1/jobs/preview/{preview_id}",
            duration=actual_duration,
            message="Preview generated successfully",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")


@app.get("/api/v1/jobs/preview/{preview_id}")
async def serve_preview(preview_id: str, _: dict = Depends(_get_current_user)):
    """Serve a generated preview video file."""
    # Validate preview_id format (prevent path traversal)
    import re
    if not re.match(r'^preview_\d+_\d+_\d+$', preview_id):
        raise HTTPException(status_code=400, detail="Invalid preview ID")
    
    output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
    preview_path = os.path.join(output_dir, "_previews", f"{preview_id}.mp4")
    
    if not os.path.isfile(preview_path):
        raise HTTPException(status_code=404, detail="Preview not found or expired")
    
    return FileResponse(preview_path, media_type="video/mp4", filename=f"{preview_id}.mp4")


@app.get("/api/v1/jobs/history", response_model=List[JobHistoryResponse])
async def list_job_history(current: dict = Depends(_get_current_user)):
    """Jobs whose output files still exist — filtered by user (admin sees all)"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        logs = repo.get_existing_jobs(user_id=user_id, is_admin=is_admin)
        result = []
        for log in logs:
            output_files = []
            thumbnails = []
            if log.output_path and os.path.isdir(log.output_path):
                try:
                    for f in sorted(os.listdir(log.output_path)):
                        if f.endswith("_final.mp4"):
                            output_files.append(f"/api/v1/jobs/{log.id}/videos/{f}")
                            # Generate thumbnail on-the-fly if missing
                            thumb_name = f.replace("_final.mp4", "_thumb.jpg")
                            thumb_path = os.path.join(log.output_path, thumb_name)
                            if not os.path.isfile(thumb_path):
                                _generate_thumbnail(os.path.join(log.output_path, f), thumb_path)
                            if os.path.isfile(thumb_path):
                                thumbnails.append(f"/api/v1/jobs/{log.id}/thumbnails/{thumb_name}")
                except Exception:
                    pass
            clips_info = [
                ClipInfo(
                    index=c.index, start_time=c.start_time, end_time=c.end_time,
                    hook=c.hook, score=c.score, reason=c.reason,
                )
                for c in (log.caption_response or [])
            ]
            result.append(JobHistoryResponse(
                id=log.id,
                youtube_url=log.youtube_url,
                caption_style_id=log.caption_style_id,
                hook_style_id=log.hook_style_id,
                status=log.status.value if isinstance(log.status, ProcessingState) else log.status,
                output_path=log.output_path,
                requested_at=log.requested_at.isoformat() if log.requested_at else None,
                clips=clips_info,
                output_files=output_files,
                thumbnails=thumbnails,
            ))
        return result
    finally:
        session.close()


@app.get("/api/v1/jobs/queue")
async def get_queue_status(_: dict = Depends(_get_current_user)):
    """Get current queue status — processing URL and pending jobs"""
    return job_queue.get_status()


@app.get("/api/v1/jobs/logs")
async def get_job_logs(_: dict = Depends(_get_current_user)):
    """Get real-time processing logs for the current/latest job"""
    return job_logger.get_state()


@app.get("/api/v1/jobs/logs/stream")
async def stream_job_logs(_: dict = Depends(_get_current_user)):
    """Server-Sent Events stream for real-time job progress.
    
    Connect with EventSource:
        const es = new EventSource('/api/v1/jobs/logs/stream', {headers: {'Authorization': 'Bearer ...'}});
        es.onmessage = (e) => console.log(JSON.parse(e.data));
    
    Sends updates every 2 seconds until job completes or fails.
    """
    async def event_generator():
        last_log_count = 0
        while True:
            state = job_logger.get_state()
            current_log_count = sum(len(s["logs"]) for s in state.get("stages", []))
            
            # Always send if there are new logs or status changed
            yield f"data: {json.dumps(state, ensure_ascii=False)}\n\n"
            
            # Stop streaming when job is done
            if state["status"] in ("completed", "failed", "idle"):
                break
            
            last_log_count = current_log_count
            await asyncio.sleep(2)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/v1/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: int, current: dict = Depends(_get_current_user)):
    """Get status of a job — user can only see own jobs, admin sees all"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        log = repo.get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        if not is_admin and log.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return JobStatusResponse(
            id=log.id,
            youtube_url=log.youtube_url,
            status=log.status.value if isinstance(log.status, ProcessingState) else log.status,
            output_path=log.output_path,
            clips_count=len(log.caption_response)
        )
    finally:
        session.close()


@app.delete("/api/v1/jobs/{job_id}")
async def delete_job(job_id: int, current: dict = Depends(_get_current_user)):
    """Cancel queued job or delete completed job + output files"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        log = repo.get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        if not is_admin and log.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        # If actively processing THIS specific job, cannot cancel
        if job_queue.is_processing_job_id(job_id):
            raise HTTPException(status_code=409, detail="Job sedang diproses, tidak bisa dibatalkan")
        # Remove from queue if pending
        job_queue.cancel(log.youtube_url)
        # Delete from DB + files
        repo.delete(job_id)
        return {"status": "deleted", "job_id": job_id}
    finally:
        session.close()


@app.get("/api/v1/jobs/{job_id}/thumbnails/{filename}")
async def serve_thumbnail(job_id: int, filename: str, _: dict = Depends(_get_current_user)):
    """Serve thumbnail — requires auth"""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log or not log.output_path:
            raise HTTPException(status_code=404, detail="Not found")
        if not filename.endswith("_thumb.jpg"):
            raise HTTPException(status_code=400, detail="Only thumbnails allowed")
        file_path = _safe_file_path(log.output_path, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        return FileResponse(file_path, media_type="image/jpeg", filename=filename)
    finally:
        session.close()


@app.get("/api/v1/jobs/{job_id}/videos/{filename}")
async def serve_video(job_id: int, filename: str, _: dict = Depends(_get_current_user)):
    """Serve final clip video — requires auth"""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log or not log.output_path:
            raise HTTPException(status_code=404, detail="Not found")
        if not filename.endswith("_final.mp4"):
            raise HTTPException(status_code=400, detail="Only final clips allowed")
        file_path = _safe_file_path(log.output_path, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Video not found")
        return FileResponse(file_path, media_type="video/mp4", filename=filename)
    finally:
        session.close()


@app.get("/api/v1/jobs/{job_id}/files/{filename}")
async def serve_job_file(job_id: int, filename: str, current: dict = Depends(_get_current_user)):
    """Serve a file (final video or thumbnail) belonging to a job"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        log = repo.get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        if not is_admin and log.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if not log.output_path:
            raise HTTPException(status_code=404, detail="No output path for this job")
        file_path = _safe_file_path(log.output_path, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        media_type = "video/mp4" if filename.endswith(".mp4") else "image/jpeg"
        return FileResponse(file_path, media_type=media_type, filename=filename)
    finally:
        session.close()


@app.get("/api/v1/jobs/")
async def list_jobs(current: dict = Depends(_get_current_user)):
    """List all jobs — user sees own, admin sees all"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        logs = repo.get_all(user_id=user_id, is_admin=is_admin)
        return [
            {
                "id": log.id,
                "youtube_url": log.youtube_url,
                "status": log.status.value if isinstance(log.status, ProcessingState) else log.status,
                "clips_count": len(log.caption_response),
                "requested_at": log.requested_at.isoformat() if log.requested_at else None
            }
            for log in logs
        ]
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ④b. Admin — Disk management & Configuration
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/admin/cleanup")
async def cleanup_old_outputs(
    days: int = 30,
    _: dict = Depends(_require_admin)
):
    """Delete output directories older than N days. Admin only.
    
    Args:
        days: Delete outputs older than this many days (default 30)
    """
    import shutil
    from datetime import datetime, timedelta
    
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
                # Calculate size before deletion
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


@app.get("/api/v1/admin/config")
async def get_pipeline_config(_: dict = Depends(_require_admin)):
    """Get current pipeline configuration. Admin only."""
    from ..application.services import PIPELINE_CONFIG
    return PIPELINE_CONFIG


@app.put("/api/v1/admin/config")
async def update_pipeline_config(
    updates: Dict[str, Any],
    _: dict = Depends(_require_admin)
):
    """Update pipeline configuration at runtime. Admin only.
    
    Only updates keys that exist in PIPELINE_CONFIG.
    Changes are NOT persisted across restarts.
    """
    from ..application.services import PIPELINE_CONFIG
    
    updated = {}
    for key, value in updates.items():
        if key in PIPELINE_CONFIG:
            PIPELINE_CONFIG[key] = value
            updated[key] = value
    
    if not updated:
        raise HTTPException(status_code=400, detail="No valid config keys provided")
    
    return {"status": "updated", "changes": updated}


# ─────────────────────────────────────────────────────────────────────────────
#  ⑤ API Documentation — public
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/docs.md")
async def api_docs_md():
    """API documentation in Markdown format"""
    md_path = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "api.md")
    md_path = os.path.abspath(md_path)
    if not os.path.exists(md_path):
        raise HTTPException(status_code=404, detail="Documentation file not found")
    return FileResponse(md_path, media_type="text/markdown", filename="api.md")


@app.get("/api/v1/docs")
async def api_docs():
    """Frontend-friendly API documentation"""
    return {
        "service": "AutoCliper v2",
        "version": "2.0.0",
        "base_url": "http://0.0.0.0:8000",
        "auth": {
            "type": "Bearer JWT",
            "header": "Authorization: Bearer <token>",
            "obtain": "POST /api/v1/auth/login",
            "expiry": "24 hours",
        },
        "endpoints": [
            # ── Auth ──────────────────────────────────────────────────────────
            {
                "group": "Auth",
                "method": "POST",
                "path": "/api/v1/auth/login",
                "auth": False,
                "description": "Login dan dapatkan JWT token",
                "request_body": {"username": "string", "password": "string"},
                "response": {
                    "access_token": "string",
                    "token_type": "bearer",
                    "username": "string",
                    "role": "admin | user",
                },
                "errors": {"401": "Invalid credentials", "403": "Account deactivated"},
            },
            # ── Jobs ──────────────────────────────────────────────────────────
            {
                "group": "Jobs",
                "method": "POST",
                "path": "/api/v1/jobs/",
                "auth": True,
                "description": "Submit video YouTube untuk diproses. URL yang sama dan sedang diproses akan ditolak. URL berbeda masuk antrian.",
                "request_body": {"urls": "string (YouTube URL)", "caption_style": "int (caption_style id)"},
                "response": {
                    "status": "accepted | processing | queued",
                    "message": "string",
                    "job_id": "int | null",
                },
                "notes": [
                    "status=processing → URL sama sedang diproses",
                    "status=queued → URL sama sudah ada di antrian",
                    "status=accepted → berhasil masuk antrian",
                ],
                "errors": {"400": "Caption style not found"},
            },
            {
                "group": "Jobs",
                "method": "GET",
                "path": "/api/v1/jobs/",
                "auth": True,
                "description": "List semua job milik user. Admin melihat semua job.",
                "response": [
                    {
                        "id": "int",
                        "youtube_url": "string",
                        "status": "pending | downloading | analyzing | processing | completed | failed",
                        "clips_count": "int",
                        "requested_at": "ISO datetime",
                    }
                ],
            },
            {
                "group": "Jobs",
                "method": "GET",
                "path": "/api/v1/jobs/queue",
                "auth": True,
                "description": "Status antrian saat ini — URL yang sedang diproses dan daftar yang menunggu.",
                "response": {
                    "processing_url": "string | null",
                    "queue_length": "int",
                    "pending": [
                        {"url": "string", "caption_style": "int", "queued_at": "ISO datetime"}
                    ],
                },
            },
            {
                "group": "Jobs",
                "method": "GET",
                "path": "/api/v1/jobs/logs",
                "auth": True,
                "description": "Real-time log processing job terakhir. Poll setiap 2-3 detik selama status=processing.",
                "response": {
                    "youtube_url": "string",
                    "status": "idle | processing | completed | failed",
                    "current_stage": "string",
                    "current_stage_key": "fetching_video | analyzing_content | generating_clips | applying_captions",
                    "total_clips": "int",
                    "clips_completed": "int",
                    "started_at": "ISO datetime | null",
                    "finished_at": "ISO datetime | null",
                    "error": "string | null",
                    "stages": [
                        {
                            "key": "fetching_video | analyzing_content | generating_clips | applying_captions",
                            "label": "string",
                            "status": "pending | active | done | error",
                            "started_at": "ISO datetime | null",
                            "finished_at": "ISO datetime | null",
                            "logs": [{"message": "string", "timestamp": "ISO datetime"}],
                        }
                    ],
                },
                "notes": [
                    "Hanya menyimpan log 1 job terakhir",
                    "Reset otomatis setiap job baru di-submit",
                    "Poll sampai status=completed atau status=failed",
                ],
            },
            {
                "group": "Jobs",
                "method": "GET",
                "path": "/api/v1/jobs/history",
                "auth": True,
                "description": "List job yang file output-nya masih ada di disk. User hanya lihat miliknya, admin lihat semua.",
                "response": [
                    {
                        "id": "int",
                        "youtube_url": "string",
                        "caption_style_id": "int",
                        "status": "string",
                        "output_path": "string | null",
                        "requested_at": "ISO datetime | null",
                        "clips": [
                            {
                                "index": "int",
                                "start_time": "float",
                                "end_time": "float",
                                "hook": "string",
                                "score": "float",
                                "reason": "string",
                            }
                        ],
                        "output_files": ["string (path to _final.mp4)"],
                    }
                ],
            },
            {
                "group": "Jobs",
                "method": "GET",
                "path": "/api/v1/jobs/{job_id}",
                "auth": True,
                "description": "Detail status satu job. User hanya bisa akses job miliknya.",
                "path_params": {"job_id": "int"},
                "response": {
                    "id": "int",
                    "youtube_url": "string",
                    "status": "string",
                    "output_path": "string | null",
                    "clips_count": "int",
                },
                "errors": {"403": "Access denied", "404": "Job not found"},
            },
            {
                "group": "Jobs",
                "method": "DELETE",
                "path": "/api/v1/jobs/{job_id}",
                "auth": True,
                "description": "Hapus job dari DB + file output. Jika masih di antrian, otomatis di-cancel. Tidak bisa hapus job yang sedang aktif diproses.",
                "path_params": {"job_id": "int"},
                "response": {"status": "deleted", "job_id": "int"},
                "errors": {
                    "403": "Access denied",
                    "404": "Job not found",
                    "409": "Job sedang diproses, tidak bisa dibatalkan",
                },
            },
            # ── Caption Styles ────────────────────────────────────────────────
            {
                "group": "Caption Styles",
                "method": "GET",
                "path": "/api/v1/caption-styles/",
                "auth": True,
                "description": "List semua caption style yang tersedia.",
                "response": [
                    {
                        "id": "int",
                        "name": "string",
                        "font_family": "string",
                        "font_weight": "normal | bold",
                        "font_size": "int",
                        "color": "hex string",
                        "highlight_color": "hex string",
                        "outline_color": "hex string",
                        "outline_width": "int",
                        "shadow_color": "hex string",
                        "shadow_offset_x": "int",
                        "shadow_offset_y": "int",
                        "line_spacing": "float",
                        "caption_bottom_margin": "int",
                    }
                ],
            },
            {
                "group": "Caption Styles",
                "method": "GET",
                "path": "/api/v1/caption-styles/{style_id}",
                "auth": True,
                "description": "Detail satu caption style.",
                "path_params": {"style_id": "int"},
                "errors": {"404": "Caption style not found"},
            },
            {
                "group": "Caption Styles",
                "method": "PUT",
                "path": "/api/v1/caption-styles/{style_id}",
                "auth": True,
                "description": "Update caption style. font_family tidak bisa diubah.",
                "path_params": {"style_id": "int"},
                "request_body": {
                    "name": "string (optional)",
                    "font_weight": "string (optional)",
                    "font_size": "int (optional)",
                    "color": "hex string (optional)",
                    "highlight_color": "hex string (optional)",
                    "outline_color": "hex string (optional)",
                    "outline_width": "int (optional)",
                    "shadow_color": "hex string (optional)",
                    "shadow_offset_x": "int (optional)",
                    "shadow_offset_y": "int (optional)",
                    "line_spacing": "float (optional)",
                    "caption_bottom_margin": "int (optional)",
                },
                "errors": {"400": "No editable fields provided", "404": "Caption style not found"},
            },
            # ── Users (Admin only) ────────────────────────────────────────────
            {
                "group": "Users",
                "method": "GET",
                "path": "/api/v1/users/",
                "auth": True,
                "role_required": "admin",
                "description": "List semua user.",
                "response": [
                    {"id": "int", "username": "string", "email": "string | null", "role": "string", "is_active": "bool", "created_at": "ISO datetime"}
                ],
            },
            {
                "group": "Users",
                "method": "POST",
                "path": "/api/v1/users/",
                "auth": True,
                "role_required": "admin",
                "description": "Buat user baru.",
                "request_body": {"username": "string", "password": "string", "email": "string (optional)", "role": "admin | user"},
                "errors": {"409": "Username already exists"},
            },
            {
                "group": "Users",
                "method": "PUT",
                "path": "/api/v1/users/{user_id}",
                "auth": True,
                "role_required": "admin",
                "description": "Update user. Kirim password untuk ganti password.",
                "path_params": {"user_id": "int"},
                "request_body": {"email": "string (optional)", "role": "string (optional)", "is_active": "bool (optional)", "password": "string (optional)"},
            },
            {
                "group": "Users",
                "method": "DELETE",
                "path": "/api/v1/users/{user_id}",
                "auth": True,
                "role_required": "admin",
                "description": "Hapus user. Tidak bisa hapus akun sendiri.",
                "path_params": {"user_id": "int"},
                "errors": {"400": "Cannot delete your own account", "404": "User not found"},
            },
            # ── Health ────────────────────────────────────────────────────────
            {
                "group": "System",
                "method": "GET",
                "path": "/health",
                "auth": False,
                "description": "Health check.",
                "response": {"status": "healthy", "service": "AutoCliper v2"},
            },
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
#  ④ Fonts — GET for all authenticated users, CRUD for admin only
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/fonts/", response_model=List[FontResponse])
async def list_fonts(_: dict = Depends(_get_current_user)):
    session = database.get_session()
    try:
        return [_font_to_response(f) for f in FontRepository(session).get_all()]
    finally:
        session.close()


@app.get("/api/v1/fonts/{font_id}", response_model=FontResponse)
async def get_font(font_id: int, _: dict = Depends(_get_current_user)):
    session = database.get_session()
    try:
        font = FontRepository(session).get_by_id(font_id)
        if not font:
            raise HTTPException(status_code=404, detail="Font not found")
        return _font_to_response(font)
    finally:
        session.close()


@app.post("/api/v1/fonts/", response_model=FontResponse, status_code=201)
async def create_font(body: FontCreateModel, _: dict = Depends(_require_admin)):
    session = database.get_session()
    try:
        font = FontRepository(session).create(body.model_dump())
        # Eagerly download the font file if not already present
        import asyncio
        from ..infrastructure.overlay_renderer import TextRenderer
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, lambda: TextRenderer()._download_font(
            font.download_url,
            os.path.join("assets", "fonts", font.file_name)
        ))
        return _font_to_response(font)
    finally:
        session.close()


@app.put("/api/v1/fonts/{font_id}", response_model=FontResponse)
async def update_font(font_id: int, body: FontUpdateModel, _: dict = Depends(_require_admin)):
    session = database.get_session()
    try:
        font = FontRepository(session).update(font_id, body.model_dump(exclude_unset=True))
        if not font:
            raise HTTPException(status_code=404, detail="Font not found")
        return _font_to_response(font)
    finally:
        session.close()


@app.delete("/api/v1/fonts/{font_id}")
async def delete_font(font_id: int, _: dict = Depends(_require_admin)):
    session = database.get_session()
    try:
        if not FontRepository(session).delete(font_id):
            raise HTTPException(status_code=404, detail="Font not found")
        return {"status": "deleted", "font_id": font_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ⑤ Hook Styles — GET for all authenticated users, CRUD for admin only
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/hook-styles/", response_model=List[HookStyleResponse])
async def list_hook_styles(_: dict = Depends(_get_current_user)):
    session = database.get_session()
    try:
        return [_hook_style_to_response(s) for s in HookStyleRepository(session).get_all()]
    finally:
        session.close()


@app.get("/api/v1/hook-styles/{style_id}", response_model=HookStyleResponse)
async def get_hook_style(style_id: int, _: dict = Depends(_get_current_user)):
    session = database.get_session()
    try:
        s = HookStyleRepository(session).get_by_id(style_id)
        if not s:
            raise HTTPException(status_code=404, detail="Hook style not found")
        return _hook_style_to_response(s)
    finally:
        session.close()


@app.post("/api/v1/hook-styles/", response_model=HookStyleResponse, status_code=201)
async def create_hook_style(body: HookStyleCreateModel, _: dict = Depends(_require_admin)):
    session = database.get_session()
    try:
        s = HookStyleRepository(session).create(body.model_dump())
        return _hook_style_to_response(s)
    finally:
        session.close()


@app.put("/api/v1/hook-styles/{style_id}", response_model=HookStyleResponse)
async def update_hook_style(style_id: int, body: HookStyleUpdateModel, _: dict = Depends(_require_admin)):
    session = database.get_session()
    try:
        s = HookStyleRepository(session).update(style_id, body.model_dump(exclude_unset=True))
        if not s:
            raise HTTPException(status_code=404, detail="Hook style not found")
        return _hook_style_to_response(s)
    finally:
        session.close()


@app.delete("/api/v1/hook-styles/{style_id}")
async def delete_hook_style(style_id: int, _: dict = Depends(_require_admin)):
    session = database.get_session()
    try:
        if not HookStyleRepository(session).delete(style_id):
            raise HTTPException(status_code=404, detail="Hook style not found")
        return {"status": "deleted", "style_id": style_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ⑥ Caption Styles — user owns their own styles
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/caption-styles/", response_model=CaptionStyleResponse, status_code=201)
async def create_caption_style(body: CaptionStyleCreateModel, current: dict = Depends(_get_current_user)):
    """Create a caption style owned by the current user"""
    user_id = int(current.get("sub"))
    session = database.get_session()
    try:
        # Resolve font_family from font_id
        data = body.model_dump()
        font_family = "Arial"
        if data.get("font_id"):
            font = FontRepository(session).get_by_id(data["font_id"])
            if not font:
                raise HTTPException(status_code=400, detail=f"Font {data['font_id']} not found")
            font_family = font.name
        data["font_family"] = font_family
        data["user_id"] = user_id
        style = CaptionStyleRepository(session).create(data)
        return _style_to_response(style)
    finally:
        session.close()


@app.get("/api/v1/caption-styles/", response_model=List[CaptionStyleResponse])
async def get_caption_styles(current: dict = Depends(_get_current_user)):
    """User sees own styles + global styles; admin sees all"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        return [_style_to_response(s) for s in
                CaptionStyleRepository(session).get_all(user_id=user_id, is_admin=is_admin)]
    finally:
        session.close()


@app.get("/api/v1/caption-styles/{style_id}", response_model=CaptionStyleResponse)
async def get_caption_style_detail(style_id: int, _: dict = Depends(_get_current_user)):
    session = database.get_session()
    try:
        style = CaptionStyleRepository(session).get_by_id(style_id)
        if not style:
            raise HTTPException(status_code=404, detail=f"Caption style {style_id} not found")
        return _style_to_response(style)
    finally:
        session.close()


@app.put("/api/v1/caption-styles/{style_id}", response_model=CaptionStyleResponse)
async def update_caption_style(
    style_id: int, body: CaptionStyleUpdateModel, current: dict = Depends(_get_current_user)
):
    """Only the owner (or admin) can update a caption style"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        update_data = body.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        # Resolve font_family if font_id is being updated
        if "font_id" in update_data and update_data["font_id"]:
            font = FontRepository(session).get_by_id(update_data["font_id"])
            if not font:
                raise HTTPException(status_code=400, detail=f"Font {update_data['font_id']} not found")
            update_data["font_family"] = font.name
        updated = CaptionStyleRepository(session).update(
            style_id, update_data, user_id=user_id, is_admin=is_admin
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Caption style not found or access denied")
        return _style_to_response(updated)
    finally:
        session.close()


@app.delete("/api/v1/caption-styles/{style_id}")
async def delete_caption_style(style_id: int, current: dict = Depends(_get_current_user)):
    """Only the owner (or admin) can delete a caption style"""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        if not CaptionStyleRepository(session).delete(style_id, user_id=user_id, is_admin=is_admin):
            raise HTTPException(status_code=404, detail="Caption style not found or access denied")
        return {"status": "deleted", "style_id": style_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ⑦ Auth Self-Service (change password, profile, token refresh, me)
# ─────────────────────────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None


@app.get("/api/v1/auth/me")
async def get_current_user_info(current: dict = Depends(_get_current_user)):
    """Validate token and return current user info.
    
    Use on app load to verify token is still valid without re-login.
    """
    user_id = int(current.get("sub"))
    session = database.get_session()
    try:
        user = UserRepository(session).get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    finally:
        session.close()


@app.post("/api/v1/auth/refresh")
async def refresh_token(current: dict = Depends(_get_current_user)):
    """Refresh JWT token without re-login.
    
    Returns a new token with extended expiry.
    Call this before access token expires to maintain session.
    """
    new_token = create_access_token({
        "sub": current.get("sub"),
        "username": current.get("username"),
        "role": current.get("role"),
    })
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "expires_in": 1800,
    }


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@app.post("/api/v1/auth/token/refresh")
async def rotate_token(body: RefreshTokenRequest):
    """Rotate refresh token — exchange old refresh token for new access + refresh pair.
    
    This implements refresh token rotation:
    1. Validates the old refresh token
    2. Revokes the old refresh token (one-time use)
    3. Issues a new access token + new refresh token
    
    No access token required — only the refresh token.
    If the refresh token is invalid/expired/already-used, returns 401.
    """
    result = rotate_refresh_token(body.refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please login again.",
        )
    
    new_access, new_refresh, payload = result
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": 1800,
        "username": payload.get("username"),
        "role": payload.get("role"),
    }


@app.post("/api/v1/auth/logout")
async def logout(body: RefreshTokenRequest):
    """Logout — revoke the refresh token so it cannot be reused.
    
    The access token will naturally expire (30 min).
    """
    revoke_refresh_token(body.refresh_token)
    return {"message": "Logged out successfully"}


@app.put("/api/v1/auth/change-password")
async def change_password(body: ChangePasswordRequest, current: dict = Depends(_get_current_user)):
    """Change own password. Requires current password for verification."""
    user_id = int(current.get("sub"))
    session = database.get_session()
    try:
        user = UserRepository(session).get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        UserRepository(session).update(user_id, {"hashed_password": hash_password(body.new_password)})
        return {"message": "Password updated successfully"}
    finally:
        session.close()


@app.put("/api/v1/auth/profile")
async def update_profile(body: ProfileUpdateRequest, current: dict = Depends(_get_current_user)):
    """Update own profile (email, display_name)."""
    user_id = int(current.get("sub"))
    session = database.get_session()
    try:
        update_data = body.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        # Only allow email update for now (display_name not in DB yet)
        allowed = {}
        if "email" in update_data:
            allowed["email"] = update_data["email"]
        if not allowed:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        user = UserRepository(session).update(user_id, allowed)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ⑧ Job Retry
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/v1/jobs/{job_id}/retry")
async def retry_failed_job(job_id: int, current: dict = Depends(_get_current_user)):
    """Re-queue a failed job without re-submitting the URL.
    
    Only jobs with status 'failed' can be retried.
    """
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        log = repo.get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        if not is_admin and log.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        status_val = log.status.value if isinstance(log.status, ProcessingState) else log.status
        if status_val != "failed":
            raise HTTPException(status_code=400, detail="Only failed jobs can be retried")
        
        # Reset status to pending
        log.status = ProcessingState.PENDING
        repo.update(log)
        
        # Re-queue
        job_request = JobRequest(
            urls=log.youtube_url,
            caption_style=log.caption_style_id,
            user_id=log.user_id,
            hook_style_id=log.hook_style_id,
        )
        job_queue.enqueue(QueuedJob(job_request=job_request))
        
        return {
            "status": "accepted",
            "message": "Job re-queued for processing",
            "job_id": job_id,
        }
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ⑨ Statistics & Analytics
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/stats/dashboard")
async def get_dashboard_stats(current: dict = Depends(_get_current_user)):
    """Centralized dashboard statistics.
    
    Returns aggregated stats for the current user (or all users if admin).
    """
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        from sqlalchemy import func as sqlfunc
        from datetime import datetime, timedelta
        
        q = session.query(RequestLogModel)
        if not is_admin:
            q = q.filter(RequestLogModel.user_id == user_id)
        
        total_jobs = q.count()
        completed_jobs = q.filter(RequestLogModel.status == "completed").count()
        failed_jobs = q.filter(RequestLogModel.status == "failed").count()
        processing_jobs = q.filter(RequestLogModel.status.in_(["processing", "pending", "downloading", "analyzing"])).count()
        
        # Total clips from completed jobs
        completed_logs = q.filter(RequestLogModel.status == "completed").all()
        total_clips = sum(len(m.caption_response or []) for m in completed_logs)
        
        # Average score
        all_scores = []
        for m in completed_logs:
            for clip in (m.caption_response or []):
                if isinstance(clip, dict) and "score" in clip:
                    all_scores.append(clip["score"])
        avg_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0
        
        # Today's stats
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_q = q.filter(RequestLogModel.requested_at >= today_start)
        jobs_today = today_q.count()
        today_completed = today_q.filter(RequestLogModel.status == "completed").all()
        clips_today = sum(len(m.caption_response or []) for m in today_completed)
        
        # Storage usage
        import shutil
        output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
        storage_used_mb = 0
        if os.path.exists(output_dir):
            for root, dirs, files in os.walk(output_dir):
                for f in files:
                    try:
                        storage_used_mb += os.path.getsize(os.path.join(root, f))
                    except OSError:
                        pass
        storage_used_mb = round(storage_used_mb / (1024 * 1024), 1)
        
        return {
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "processing_jobs": processing_jobs,
            "total_clips_generated": total_clips,
            "average_score": avg_score,
            "storage_used_mb": storage_used_mb,
            "jobs_today": jobs_today,
            "clips_today": clips_today,
        }
    finally:
        session.close()


@app.get("/api/v1/stats/usage")
async def get_usage_stats(
    period: str = "7d",
    current: dict = Depends(_get_current_user)
):
    """Usage statistics over time for charts.
    
    Args:
        period: "7d", "30d", or "90d"
    """
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 7)
    
    session = database.get_session()
    try:
        from datetime import datetime, timedelta
        
        start_date = datetime.now() - timedelta(days=days)
        
        q = session.query(RequestLogModel).filter(
            RequestLogModel.requested_at >= start_date
        )
        if not is_admin:
            q = q.filter(RequestLogModel.user_id == user_id)
        
        logs = q.order_by(RequestLogModel.requested_at.asc()).all()
        
        # Group by date
        daily_data = {}
        for i in range(days):
            date = (datetime.now() - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
            daily_data[date] = {"date": date, "jobs": 0, "clips": 0}
        
        for log in logs:
            if log.requested_at:
                date_key = log.requested_at.strftime("%Y-%m-%d")
                if date_key in daily_data:
                    daily_data[date_key]["jobs"] += 1
                    if log.status == "completed":
                        daily_data[date_key]["clips"] += len(log.caption_response or [])
        
        return {
            "period": period,
            "data": list(daily_data.values()),
        }
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  ⑩ WebSocket — Real-time bidirectional communication
# ─────────────────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time job progress and notifications.
    
    Client must send auth message first:
        {"type": "auth", "token": "<access_token>"}
    
    After auth, server pushes:
        - job_progress: real-time processing updates
        - queue_update: queue position changes
        - job_completed: job finished notification
        - job_failed: job error notification
    
    Client can send:
        - {"type": "ping"} → server responds with {"type": "pong"}
        - {"type": "subscribe_job", "job_id": 123} → subscribe to specific job
    """
    user_id = None
    try:
        # Wait for auth message
        await websocket.accept()
        auth_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        
        if auth_msg.get("type") != "auth" or not auth_msg.get("token"):
            await websocket.send_json({"type": "error", "message": "Auth required"})
            await websocket.close(code=4001)
            return
        
        # Validate token
        payload = decode_access_token(auth_msg["token"])
        if not payload:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close(code=4001)
            return
        
        user_id = int(payload.get("sub"))
        
        # Register connection
        # Re-accept not needed since we already accepted above
        # Just register in manager
        async with ws_manager._lock:
            if user_id not in ws_manager._connections:
                ws_manager._connections[user_id] = set()
            ws_manager._connections[user_id].add(websocket)
        
        await websocket.send_json({
            "type": "auth_success",
            "user_id": user_id,
            "message": "Connected",
        })
        
        # Send current state immediately
        state = job_logger.get_state()
        if state["status"] != "idle":
            await websocket.send_json({"type": "job_progress", "data": state})
        
        queue_status = job_queue.get_status()
        await websocket.send_json({"type": "queue_status", "data": queue_status})
        
        # Keep connection alive, handle client messages
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg.get("type") == "get_progress":
                    state = job_logger.get_state()
                    await websocket.send_json({"type": "job_progress", "data": state})
                elif msg.get("type") == "get_queue":
                    await websocket.send_json({"type": "queue_status", "data": job_queue.get_status()})
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except Exception:
                    break
                    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WebSocket error: {e}")
    finally:
        if user_id is not None:
            await ws_manager.disconnect(websocket, user_id)


# ─────────────────────────────────────────────────────────────────────────────
#  ⑪ Engagement Prediction
# ─────────────────────────────────────────────────────────────────────────────

class EngagementPredictRequest(BaseModel):
    clips: List[Dict[str, Any]]
    language: str = "id"


@app.post("/api/v1/engagement/predict")
async def predict_engagement(
    body: EngagementPredictRequest,
    _: dict = Depends(_get_current_user)
):
    """Predict engagement/viral potential for clips.
    
    Input clips should have: hook, start_time, end_time, score, keywords
    Returns detailed engagement breakdown per clip with suggestions.
    """
    results = []
    for clip in body.clips:
        prediction = engagement_predictor.predict(
            hook=clip.get("hook", ""),
            duration=clip.get("end_time", 30) - clip.get("start_time", 0),
            score_from_ai=clip.get("score", 0.5),
            keywords=clip.get("keywords", []),
            language=body.language,
        )
        results.append({
            "clip_index": clip.get("index", 0),
            "overall_score": prediction.overall_score,
            "hook_score": prediction.hook_score,
            "content_score": prediction.content_score,
            "timing_score": prediction.timing_score,
            "platform_scores": prediction.platform_scores,
            "factors": prediction.factors,
            "suggestions": prediction.suggestions,
            "predicted_views_range": prediction.predicted_views_range,
        })
    
    return {"predictions": results}


# ─────────────────────────────────────────────────────────────────────────────
#  ⑫ Trending Audio
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/trending/audio/categories")
async def get_audio_categories(_: dict = Depends(_get_current_user)):
    """Get all available audio categories with descriptions."""
    return trending_audio_service.get_categories()


@app.get("/api/v1/trending/audio")
async def get_trending_audio(
    category: Optional[str] = None,
    platform: str = "all",
    limit: int = 10,
    _: dict = Depends(_get_current_user)
):
    """Get trending audio/sounds for short-form content.
    
    Args:
        category: Filter by category (motivational, dramatic, funny, etc.)
        platform: Filter by platform (tiktok, reels, shorts, all)
        limit: Max results (default 10)
    """
    sounds = trending_audio_service.get_trending_sounds(category, platform, limit)
    return {"sounds": sounds, "total": len(sounds)}


class AudioSuggestRequest(BaseModel):
    clips: List[Dict[str, Any]]


@app.post("/api/v1/trending/audio/suggest")
async def suggest_audio_for_clips(
    body: AudioSuggestRequest,
    _: dict = Depends(_get_current_user)
):
    """Suggest audio categories for clips based on their content.
    
    Analyzes hook text and keywords to recommend the best audio mood.
    """
    suggestions = trending_audio_service.suggest_for_clips(body.clips)
    return {"suggestions": suggestions}


# ─────────────────────────────────────────────────────────────────────────────
#  ⑬ Analytics Dashboard (Enhanced)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/v1/analytics/overview")
async def get_analytics_overview(current: dict = Depends(_get_current_user)):
    """Comprehensive analytics overview with engagement metrics.
    
    Returns:
    - Total stats (jobs, clips, avg score)
    - Performance by time period
    - Top performing clips
    - Processing efficiency metrics
    """
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        from datetime import datetime, timedelta
        
        q = session.query(RequestLogModel)
        if not is_admin:
            q = q.filter(RequestLogModel.user_id == user_id)
        
        all_logs = q.all()
        completed_logs = [l for l in all_logs if l.status == "completed"]
        failed_logs = [l for l in all_logs if l.status == "failed"]
        
        # ─── Basic stats ─────────────────────────────────────────────────
        total_jobs = len(all_logs)
        total_completed = len(completed_logs)
        total_failed = len(failed_logs)
        total_clips = sum(len(l.caption_response or []) for l in completed_logs)
        
        # Average score
        all_scores = []
        for l in completed_logs:
            for clip in (l.caption_response or []):
                if isinstance(clip, dict) and "score" in clip:
                    all_scores.append(clip["score"])
        avg_score = round(sum(all_scores) / len(all_scores), 3) if all_scores else 0
        
        # ─── Success rate ────────────────────────────────────────────────
        success_rate = round(total_completed / total_jobs * 100, 1) if total_jobs > 0 else 0
        
        # ─── Processing time estimates ───────────────────────────────────
        processing_times = []
        for l in completed_logs:
            if l.requested_at:
                # Estimate based on clip count (actual time not stored yet)
                clips_count = len(l.caption_response or [])
                est_time = clips_count * 3  # ~3 min per clip estimate
                processing_times.append(est_time)
        avg_processing_time = round(sum(processing_times) / len(processing_times), 1) if processing_times else 0
        
        # ─── Top clips by score ──────────────────────────────────────────
        top_clips = []
        for l in completed_logs[-20:]:  # Last 20 jobs
            for clip in (l.caption_response or []):
                if isinstance(clip, dict):
                    top_clips.append({
                        "job_id": l.id,
                        "youtube_url": l.youtube_url,
                        "hook": clip.get("hook", ""),
                        "score": clip.get("score", 0),
                        "duration": round(clip.get("end_time", 0) - clip.get("start_time", 0), 1),
                    })
        top_clips.sort(key=lambda x: x["score"], reverse=True)
        top_clips = top_clips[:10]
        
        # ─── Weekly trend ────────────────────────────────────────────────
        now = datetime.now()
        this_week = [l for l in all_logs if l.requested_at and (now - l.requested_at).days < 7]
        last_week = [l for l in all_logs if l.requested_at and 7 <= (now - l.requested_at).days < 14]
        
        this_week_jobs = len(this_week)
        last_week_jobs = len(last_week)
        week_trend = round((this_week_jobs - last_week_jobs) / max(last_week_jobs, 1) * 100, 1)
        
        # ─── Score distribution ──────────────────────────────────────────
        score_distribution = {"excellent": 0, "good": 0, "average": 0, "low": 0}
        for s in all_scores:
            if s >= 0.9:
                score_distribution["excellent"] += 1
            elif s >= 0.75:
                score_distribution["good"] += 1
            elif s >= 0.6:
                score_distribution["average"] += 1
            else:
                score_distribution["low"] += 1
        
        return {
            "summary": {
                "total_jobs": total_jobs,
                "total_completed": total_completed,
                "total_failed": total_failed,
                "total_clips": total_clips,
                "avg_score": avg_score,
                "success_rate": success_rate,
                "avg_processing_time_min": avg_processing_time,
            },
            "trends": {
                "this_week_jobs": this_week_jobs,
                "last_week_jobs": last_week_jobs,
                "week_over_week_change": week_trend,
            },
            "score_distribution": score_distribution,
            "top_clips": top_clips,
        }
    finally:
        session.close()


@app.get("/api/v1/analytics/clips")
async def get_clips_analytics(
    sort_by: str = "score",
    limit: int = 20,
    current: dict = Depends(_get_current_user)
):
    """Get detailed clip-level analytics.
    
    Args:
        sort_by: "score", "duration", "recent"
        limit: Max results
    """
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        q = session.query(RequestLogModel).filter(RequestLogModel.status == "completed")
        if not is_admin:
            q = q.filter(RequestLogModel.user_id == user_id)
        
        logs = q.order_by(RequestLogModel.id.desc()).limit(50).all()
        
        all_clips = []
        for l in logs:
            for clip in (l.caption_response or []):
                if isinstance(clip, dict):
                    all_clips.append({
                        "job_id": l.id,
                        "youtube_url": l.youtube_url,
                        "index": clip.get("index", 0),
                        "hook": clip.get("hook", ""),
                        "score": clip.get("score", 0),
                        "start_time": clip.get("start_time", 0),
                        "end_time": clip.get("end_time", 0),
                        "duration": round(clip.get("end_time", 0) - clip.get("start_time", 0), 1),
                        "keywords": clip.get("keywords", []),
                        "reason": clip.get("reason", ""),
                        "requested_at": l.requested_at.isoformat() if l.requested_at else None,
                    })
        
        # Sort
        if sort_by == "score":
            all_clips.sort(key=lambda x: x["score"], reverse=True)
        elif sort_by == "duration":
            all_clips.sort(key=lambda x: x["duration"], reverse=True)
        elif sort_by == "recent":
            pass  # Already sorted by recent
        
        return {"clips": all_clips[:limit], "total": len(all_clips)}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_thumbnail(video_path: str, thumb_path: str):
    """Extract frame at 1s from video and save as JPEG thumbnail"""
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        cap.set(cv2.CAP_PROP_POS_MSEC, 1000)
        ret, frame = cap.read()
        cap.release()
        if ret:
            cv2.imwrite(thumb_path, frame)
    except Exception:
        pass


def _style_to_response(s) -> CaptionStyleResponse:
    return CaptionStyleResponse(
        id=s.id, name=s.name,
        font_id=s.font_id, font_family=s.font_family,
        font_weight=s.font_weight, font_size=s.font_size,
        color=s.color, highlight_color=s.highlight_color,
        outline_color=s.outline_color, outline_width=s.outline_width,
        shadow_color=s.shadow_color, shadow_offset_x=s.shadow_offset_x,
        shadow_offset_y=s.shadow_offset_y, line_spacing=s.line_spacing,
        caption_bottom_margin=s.caption_bottom_margin,
        user_id=s.user_id,
    )


def _font_to_response(f) -> FontResponse:
    return FontResponse(
        id=f.id, name=f.name, file_name=f.file_name,
        download_url=f.download_url,
        created_at=f.created_at.isoformat() if f.created_at else None,
    )


def _hook_style_to_response(s) -> HookStyleResponse:
    return HookStyleResponse(
        id=s.id, name=s.name, config=s.config, is_active=s.is_active,
        created_at=s.created_at.isoformat() if s.created_at else None,
        updated_at=s.updated_at.isoformat() if s.updated_at else None,
    )


def _user_to_response(u) -> UserResponse:
    return UserResponse(
        id=u.id,
        username=u.username,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at.isoformat() if u.created_at else None,
    )