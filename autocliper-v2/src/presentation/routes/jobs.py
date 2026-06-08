"""
Job Routes - Video processing jobs, analyze, queue management
"""
import os
import re
import json
import logging
import traceback
import asyncio
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, StreamingResponse

from ..schemas.jobs import (
    JobRequestModel, BatchJobResponse, JobResponse, JobStatusResponse,
    JobHistoryResponse, ClipInfo, AnalyzeRequest, AnalyzeResponse,
    ClipCandidate, ProcessSelectedRequest, PreviewRequest, PreviewResponse,
    BaseProcessRequest, BaseProcessResponse, ApplyStyleRequest, ApplyStyleResponse,
    BaseClipInfo, BaseJobDetailResponse
)
from ..dependencies import get_current_user, require_admin, safe_file_path
from ...infrastructure.database import database
from ...infrastructure.repositories import (
    RequestLogRepository, CaptionStyleRepository, HookStyleRepository
)
from ...infrastructure.job_queue import job_queue, QueuedJob
from ...infrastructure.job_logger import job_logger
from ...domain.entities import JobRequest, ProcessingState
from ...application.services import VideoProcessingPipeline

logger = logging.getLogger(__name__)
router = APIRouter()

OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./tmp/output")
_job_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="video_worker")
video_service = VideoProcessingPipeline()


def _generate_thumbnail_if_missing(video_path: str, thumb_path: str) -> bool:
    """Generate thumbnail from video if it doesn't exist."""
    if os.path.exists(thumb_path):
        return True
    if not os.path.exists(video_path):
        return False
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return False
        # Seek to 1 second
        cap.set(cv2.CAP_PROP_POS_MSEC, 1000)
        ret, frame = cap.read()
        cap.release()
        if ret:
            cv2.imwrite(thumb_path, frame)
            return True
        return False
    except Exception as e:
        logger.warning(f"Thumbnail generation failed for {video_path}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

def _parse_clips_from_response(caption_response) -> List[ClipInfo]:
    """Parse clips from caption_response which can be list of ClipData objects or JSON."""
    clips = []
    if not caption_response:
        return clips
    
    try:
        # If it's a string, parse it as JSON
        if isinstance(caption_response, str):
            data = json.loads(caption_response)
            hooks = data if isinstance(data, list) else data.get("hooks", [])
        else:
            # It's already parsed (list of ClipData objects from repository)
            hooks = caption_response
        
        for i, h in enumerate(hooks, start=1):
            # Handle both dict and ClipData objects
            if hasattr(h, 'hook'):  # ClipData object
                scores_data = None
                if hasattr(h, 'scores') and h.scores:
                    scores_data = {
                        "viral_score": h.scores.viral_score,
                        "curiosity_score": h.scores.curiosity_score,
                        "emotion_score": h.scores.emotion_score,
                        "controversy_score": h.scores.controversy_score,
                        "story_score": h.scores.story_score,
                        "final_score": h.scores.final_score,
                    }
                clips.append(ClipInfo(
                    index=h.index if hasattr(h, 'index') else i,
                    hook=h.hook or "",
                    start=h.start_time if hasattr(h, 'start_time') else 0,
                    end=h.end_time if hasattr(h, 'end_time') else 0,
                    score=h.score if hasattr(h, 'score') else 0,
                    file_path=getattr(h, 'file_path', None),
                    thumbnail_path=getattr(h, 'thumbnail_path', None),
                    keywords=getattr(h, 'keywords', []) or [],
                    reason=getattr(h, 'reason', None),
                    scores=scores_data,
                ))
            else:  # dict
                scores_data = None
                if "scores" in h and h["scores"]:
                    scores_data = h["scores"]
                clips.append(ClipInfo(
                    index=i,
                    hook=h.get("hook", ""),
                    start=h.get("start_time", h.get("start", 0)),
                    end=h.get("end_time", h.get("end", 0)),
                    score=h.get("score", 0),
                    file_path=h.get("file_path"),
                    thumbnail_path=h.get("thumbnail_path"),
                    keywords=h.get("keywords", []),
                    reason=h.get("reason"),
                    scores=scores_data,
                ))
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse clips: {e}")
    
    return clips


def _build_job_status_response(log) -> JobStatusResponse:
    """Build JobStatusResponse from RequestLog model."""
    clips = _parse_clips_from_response(log.caption_response)
    status = log.status.value if isinstance(log.status, ProcessingState) else str(log.status)
    
    return JobStatusResponse(
        id=log.id,
        youtube_url=log.youtube_url,
        video_title=getattr(log, 'video_title', None),
        status=status,
        progress=getattr(log, 'progress', 0) or 0,
        current_step=getattr(log, 'current_step', "") or "",
        clips=clips,
        error_message=getattr(log, 'error_message', None),
        created_at=log.requested_at.isoformat() if log.requested_at else "",
        updated_at=log.requested_at.isoformat() if log.requested_at else "",
    )


def _build_job_history_response(log, include_files: bool = True) -> JobHistoryResponse:
    """Build JobHistoryResponse from RequestLog model."""
    clips = _parse_clips_from_response(log.caption_response)
    total_duration = sum(c.end - c.start for c in clips)
    status = log.status.value if isinstance(log.status, ProcessingState) else str(log.status)
    
    # Build output files and thumbnails list - only include existing files
    output_files = []
    thumbnails = []
    if include_files and log.output_path and os.path.isdir(log.output_path):
        for i, clip in enumerate(clips, start=1):
            # Check for _final.mp4 first, fallback to _base.mp4, then _raw.mp4
            final_path = os.path.join(log.output_path, f"clip_{i}_final.mp4")
            base_path = os.path.join(log.output_path, f"clip_{i}_base.mp4")
            raw_path = os.path.join(log.output_path, f"clip_{i}_raw.mp4")
            thumb_path = os.path.join(log.output_path, f"clip_{i}_thumb.jpg")
            
            # Determine which video file exists
            video_file = None
            if os.path.exists(final_path):
                video_file = final_path
                output_files.append(final_path)
            elif os.path.exists(base_path):
                video_file = base_path
                output_files.append(base_path)
            elif os.path.exists(raw_path):
                video_file = raw_path
                output_files.append(raw_path)
            
            # Generate thumbnail if missing (on-demand)
            # Prefer base/raw for thumbnail to avoid showing overlaid content
            if not os.path.exists(thumb_path):
                thumb_source = None
                if os.path.exists(base_path):
                    thumb_source = base_path
                elif os.path.exists(raw_path):
                    thumb_source = raw_path
                elif video_file:
                    thumb_source = video_file
                if thumb_source:
                    _generate_thumbnail_if_missing(thumb_source, thumb_path)
            
            if os.path.exists(thumb_path):
                thumbnails.append(thumb_path)
    
    return JobHistoryResponse(
        id=log.id,
        youtube_url=log.youtube_url,
        video_title=getattr(log, 'video_title', None),
        status=status,
        clips=clips,
        hook_count=len(clips),
        total_duration=total_duration,
        created_at=log.requested_at.isoformat() if log.requested_at else "",
        completed_at=log.requested_at.isoformat() if status == "completed" else None,
        output_files=output_files,
        thumbnails=thumbnails,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Job CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=BatchJobResponse)
async def create_job(
    request: JobRequestModel,
    current: dict = Depends(get_current_user)
):
    """Submit one or more video processing jobs to the queue."""
    try:
        user_id = int(current.get("sub"))
        
        # Parse multiple URLs
        raw_urls = request.urls.strip()
        url_list = [u.strip() for u in re.split(r'[\n,]+', raw_urls) if u.strip()]
        
        # Deduplicate
        seen = set()
        unique_urls = []
        for u in url_list:
            if u not in seen:
                seen.add(u)
                unique_urls.append(u)
        
        if not unique_urls:
            raise HTTPException(status_code=400, detail="No valid URLs provided")

        # Get effective IDs (support both legacy caption_style and new caption_template_id)
        caption_id = request.effective_caption_id
        hook_id = request.effective_hook_id
        
        # Process each URL
        results = []
        accepted = 0
        skipped = 0
        
        for url in unique_urls:
            if job_queue.is_processing(url):
                results.append({"url": url, "status": "processing", "message": "Video sedang diproses"})
                skipped += 1
                continue
            
            if job_queue.is_queued(url):
                results.append({"url": url, "status": "queued", "message": "Video sudah ada dalam antrian"})
                skipped += 1
                continue
            
            job_request = JobRequest(
                urls=url,
                caption_style=caption_id or 1,
                user_id=user_id,
                hook_style_id=hook_id
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
            overall_message = f"{accepted} accepted, {skipped} skipped"
        
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
        logger.error(f"Create job error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/", response_model=List[Dict[str, Any]])
async def list_jobs(current: dict = Depends(get_current_user)):
    """List all jobs — user sees own, admin sees all."""
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
                "clips_count": len(log.caption_response or []),
                "requested_at": log.requested_at.isoformat() if log.requested_at else None
            }
            for log in logs
        ]
    finally:
        session.close()


@router.get("/history", response_model=List[JobHistoryResponse])
async def list_job_history(current: dict = Depends(get_current_user)):
    """Get job history for current user (or all for admin)."""
    user_id = int(current.get("sub"))
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        logs = repo.get_existing_jobs(user_id=user_id, is_admin=is_admin)
        result = []
        for log in logs:
            try:
                result.append(_build_job_history_response(log))
            except Exception as e:
                logger.error(f"Failed to build history response for job {log.id}: {e}\n{traceback.format_exc()}")
                continue
        return result
    except Exception as e:
        logger.error(f"Job history error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch job history: {str(e)}")
    finally:
        session.close()


@router.get("/queue")
async def get_queue_status(_: dict = Depends(get_current_user)):
    """Get current queue status."""
    return job_queue.get_status()


@router.post("/queue/clear-stuck")
async def clear_stuck_processing(_: dict = Depends(require_admin)):
    """Clear stuck processing state (admin only).
    
    Use this when:
    - Server crashed while processing a job
    - Job appears stuck but queue page shows empty
    - Getting "already processing" error for a URL that isn't actually processing
    """
    previous_url = job_queue.processing_url
    job_queue.set_processing(None)
    # Also reset job_logger so the Queue page doesn't show "Currently Processing"
    job_logger._reset_state()
    job_logger._push_ws()
    logger.info(f"Admin cleared stuck processing state. Previous URL: {previous_url}")
    return {
        "status": "cleared",
        "previous_url": previous_url,
        "message": "Processing state cleared. You can now resubmit jobs."
    }


@router.delete("/queue/{url:path}")
async def cancel_queued_job(url: str, _: dict = Depends(require_admin)):
    """Cancel a pending or currently processing job from queue (admin only)."""
    # Try removing from pending queue first
    if job_queue.cancel(url):
        return {"status": "cancelled", "url": url}
    
    # If URL is currently being processed, clear the processing state
    if job_queue.is_processing(url):
        job_queue.set_processing(None)
        # Reset job_logger if it's tracking this URL
        if job_logger.get_state().get("youtube_url") == url:
            job_logger._reset_state()
            job_logger._push_ws()
        return {"status": "cancelled", "url": url, "was_processing": True}
    
    raise HTTPException(status_code=404, detail="URL not found in queue")


@router.get("/logs")
async def get_job_logs(_: dict = Depends(get_current_user)):
    """Get real-time processing logs."""
    return job_logger.get_state()


@router.get("/logs/stream")
async def stream_job_logs(_: dict = Depends(get_current_user)):
    """Server-Sent Events stream for real-time job progress."""
    async def event_generator():
        while True:
            state = job_logger.get_state()
            yield f"data: {json.dumps(state, ensure_ascii=False)}\n\n"
            if state["status"] in ("completed", "failed", "idle"):
                break
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


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: int, current: dict = Depends(get_current_user)):
    """Get job status by ID."""
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
        
        return _build_job_status_response(log)
    finally:
        session.close()


@router.delete("/{job_id}")
async def delete_job(job_id: int, current: dict = Depends(get_current_user)):
    """Cancel queued job or delete completed job + output files."""
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
        
        # If the job is currently processing, clear the processing state
        if job_queue.is_processing_job_id(job_id):
            job_queue.set_processing(None)
            # Reset job_logger if it's tracking this job
            if job_logger.get_state().get("youtube_url") == log.youtube_url:
                job_logger._reset_state()
                job_logger._push_ws()
        
        job_queue.cancel(log.youtube_url)
        repo.delete(job_id)
        return {"status": "deleted", "job_id": job_id}
    finally:
        session.close()


@router.post("/{job_id}/retry")
async def retry_failed_job(job_id: int, current: dict = Depends(get_current_user)):
    """Retry a failed job."""
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
        
        # Reset status
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
        
        return {"status": "accepted", "message": "Job re-queued", "job_id": job_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Base Processing Pipeline (Two-Step Flow)
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/base-process", response_model=BaseProcessResponse)
async def base_process_video(
    request: BaseProcessRequest,
    current: dict = Depends(get_current_user)
):
    """Base Processing Pipeline — process video WITHOUT any styling."""
    try:
        user_id = int(current.get("sub"))
        
        if job_queue.is_processing(request.url):
            return BaseProcessResponse(job_id=0, status="processing", message="Video sedang diproses")
        if job_queue.is_queued(request.url):
            return BaseProcessResponse(job_id=0, status="queued", message="Video sudah ada dalam antrian")
        
        job_request = JobRequest(
            urls=request.url,
            caption_style=1,  # Placeholder
            user_id=user_id,
            hook_style_id=None,
            base_only=True,
        )
        
        job_queue.enqueue(QueuedJob(job_request=job_request))
        logger.info(f"Base-only job queued: {request.url} by user {user_id}")
        
        return BaseProcessResponse(
            job_id=0,
            status="accepted",
            message="Base processing started"
        )
    except Exception as e:
        logger.error(f"Base process error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@router.get("/{job_id}/base-clips")
async def get_base_clips(job_id: int, current: dict = Depends(get_current_user)):
    """Get base clip previews for a completed base-processed job."""
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
                with open(os.path.join(video_dir, f), 'r') as mf:
                    meta = json.load(mf)
                
                clip_index = meta['clip_index']
                base_video = meta.get('base_video', f"clip_{clip_index}_base.mp4")
                
                # Check if thumbnail exists
                thumb_path = os.path.join(video_dir, f"clip_{clip_index}_thumb.jpg")
                has_thumbnail = os.path.exists(thumb_path)
                
                clips.append(BaseClipInfo(
                    index=clip_index,
                    hook=meta['hook'],
                    keywords=meta.get('keywords', []),
                    start=meta['start_time'],
                    end=meta['end_time'],
                    duration=meta['duration'],
                    score=meta.get('score', 0),
                    base_video_path=base_video,
                    thumbnail_path=f"clip_{clip_index}_thumb.jpg" if has_thumbnail else None,
                ))
        
        # Fallback from caption_response if no metadata files
        if not clips and log.caption_response:
            caption_data = log.caption_response
            if isinstance(caption_data, str):
                try:
                    caption_data = json.loads(caption_data)
                except:
                    caption_data = []
            
            for i, clip_data in enumerate(caption_data):
                clip_index = i + 1
                base_path = os.path.join(video_dir, f"clip_{clip_index}_base.mp4")
                raw_path = os.path.join(video_dir, f"clip_{clip_index}_raw.mp4")
                final_path = os.path.join(video_dir, f"clip_{clip_index}_final.mp4")
                
                # Must have at least base or raw clip to show for re-styling
                if not (os.path.exists(base_path) or os.path.exists(raw_path) or os.path.exists(final_path)):
                    continue
                
                if hasattr(clip_data, 'start_time'):
                    start_t, end_t = clip_data.start_time, clip_data.end_time
                    hook, score = clip_data.hook, clip_data.score
                    keywords = getattr(clip_data, 'keywords', [])
                else:
                    start_t = clip_data.get('start_time', 0)
                    end_t = clip_data.get('end_time', 0)
                    hook = clip_data.get('hook', '')
                    score = clip_data.get('score', 0)
                    keywords = clip_data.get('keywords', [])

                # Priority: base > raw (never use _final for re-styling preview)
                if os.path.exists(base_path):
                    video_file = f"clip_{clip_index}_base.mp4"
                elif os.path.exists(raw_path):
                    video_file = f"clip_{clip_index}_raw.mp4"
                else:
                    # Only use final as last resort so clips still show up
                    video_file = f"clip_{clip_index}_final.mp4"
                
                # Check if thumbnail exists
                thumb_path = os.path.join(video_dir, f"clip_{clip_index}_thumb.jpg")
                has_thumbnail = os.path.exists(thumb_path)
                
                clips.append(BaseClipInfo(
                    index=clip_index,
                    hook=hook,
                    keywords=keywords,
                    start=start_t,
                    end=end_t,
                    duration=end_t - start_t,
                    score=score,
                    base_video_path=video_file,
                    thumbnail_path=f"clip_{clip_index}_thumb.jpg" if has_thumbnail else None,
                ))
        
        has_styled = any(f.endswith('_final.mp4') for f in os.listdir(video_dir))
        has_raw = any(f.endswith('_raw.mp4') for f in os.listdir(video_dir))
        has_base = any(f.endswith('_base.mp4') for f in os.listdir(video_dir))
        status = log.status.value if hasattr(log.status, 'value') else str(log.status)
        
        return BaseJobDetailResponse(
            id=log.id,
            youtube_url=log.youtube_url,
            video_title=getattr(log, 'video_title', None),
            status=status,
            clips=clips,
            has_styled_clips=has_styled,
            has_raw_clips=has_raw or has_base,  # True if raw/base clips available for re-styling
            created_at=log.requested_at.isoformat() if log.requested_at else "",
        )
    finally:
        session.close()


@router.get("/{job_id}/clip-thumbnail/{clip_index}")
async def serve_clip_thumbnail(job_id: int, clip_index: int, _: dict = Depends(get_current_user)):
    """Serve a clip thumbnail image. Generates from base/raw if missing."""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        video_dir = log.output_path
        if not video_dir or not os.path.exists(video_dir):
            raise HTTPException(status_code=404, detail="Output directory not found")
        
        thumb_path = os.path.join(video_dir, f"clip_{clip_index}_thumb.jpg")
        
        # If thumbnail doesn't exist, try generating from base/raw
        if not os.path.exists(thumb_path):
            base_path = os.path.join(video_dir, f"clip_{clip_index}_base.mp4")
            raw_path = os.path.join(video_dir, f"clip_{clip_index}_raw.mp4")
            final_path = os.path.join(video_dir, f"clip_{clip_index}_final.mp4")
            
            source = None
            if os.path.exists(base_path):
                source = base_path
            elif os.path.exists(raw_path):
                source = raw_path
            elif os.path.exists(final_path):
                source = final_path
            
            if source:
                _generate_thumbnail_if_missing(source, thumb_path)
        
        if os.path.exists(thumb_path):
            return FileResponse(thumb_path, media_type="image/jpeg")
        else:
            raise HTTPException(status_code=404, detail="Thumbnail not found")
    finally:
        session.close()


@router.get("/{job_id}/base-clip/{clip_index}")
async def serve_base_clip(job_id: int, clip_index: int, _: dict = Depends(get_current_user)):
    """Serve a base clip video file for preview (raw/unprocessed, no overlays)."""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        video_dir = log.output_path
        if not video_dir or not os.path.exists(video_dir):
            raise HTTPException(status_code=404, detail="Output directory not found")
        
        # Priority: _base.mp4 (cropped, no overlay) > _raw.mp4 (raw clip) 
        # Never fall back to _final.mp4 here — it has overlays applied
        base_path = os.path.join(video_dir, f"clip_{clip_index}_base.mp4")
        raw_path = os.path.join(video_dir, f"clip_{clip_index}_raw.mp4")
        
        if os.path.exists(base_path):
            return FileResponse(base_path, media_type="video/mp4")
        elif os.path.exists(raw_path):
            return FileResponse(raw_path, media_type="video/mp4")
        else:
            raise HTTPException(status_code=404, detail="Base clip video not found")
    finally:
        session.close()


@router.get("/{job_id}/base-thumbnail/{clip_index}")
async def serve_base_thumbnail(job_id: int, clip_index: int, _: dict = Depends(get_current_user)):
    """Serve a thumbnail generated from the base/raw clip (no overlays).
    
    Used by the Re-Style page to show clean preview thumbnails.
    Generates from base/raw video, never from _final.mp4.
    """
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        video_dir = log.output_path
        if not video_dir or not os.path.exists(video_dir):
            raise HTTPException(status_code=404, detail="Output directory not found")
        
        # Use a separate thumbnail file for base previews
        base_thumb_path = os.path.join(video_dir, f"clip_{clip_index}_base_thumb.jpg")
        
        if not os.path.exists(base_thumb_path):
            # Generate from base/raw only
            base_path = os.path.join(video_dir, f"clip_{clip_index}_base.mp4")
            raw_path = os.path.join(video_dir, f"clip_{clip_index}_raw.mp4")
            
            source = None
            if os.path.exists(base_path):
                source = base_path
            elif os.path.exists(raw_path):
                source = raw_path
            
            if source:
                _generate_thumbnail_if_missing(source, base_thumb_path)
        
        # Fall back to regular thumb if base thumb can't be generated
        if not os.path.exists(base_thumb_path):
            thumb_path = os.path.join(video_dir, f"clip_{clip_index}_thumb.jpg")
            if os.path.exists(thumb_path):
                return FileResponse(thumb_path, media_type="image/jpeg")
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        
        return FileResponse(base_thumb_path, media_type="image/jpeg")
    finally:
        session.close()


@router.post("/{job_id}/apply-style", response_model=ApplyStyleResponse)
async def apply_style_to_job(
    job_id: int,
    request: ApplyStyleRequest,
    current: dict = Depends(get_current_user)
):
    """Apply styling to existing base clips."""
    try:
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            _job_executor,
            video_service.apply_style_to_clips,
            job_id,
            request.effective_caption_id,
            request.effective_hook_id,
        )
        
        return ApplyStyleResponse(
            job_id=job_id,
            status=result["status"],
            message=f"Style applied to {result['clips_rendered']} clips",
            clips_to_style=result["clips_rendered"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Apply style error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Style rendering failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
#  Analyze & Process Selected (Two-Step Flow)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video_for_clips(
    request: AnalyzeRequest,
    current: dict = Depends(get_current_user)
):
    """Step 1: Analyze video and return clip candidates."""
    try:
        loop = asyncio.get_event_loop()
        
        def _analyze():
            from ...infrastructure.external_services import GeminiService, YouTubeDownloader
            from ...infrastructure.video_processor import WhisperService
            
            gemini = GeminiService()
            whisper = WhisperService()
            downloader = YouTubeDownloader(os.getenv("OUTPUT_DIR", "./tmp/output"))
            
            video_info = downloader.download(request.url)
            transcript = whisper.transcribe_full_video(video_info.filepath)
            clips = gemini.analyze_youtube_content(request.url, video_info, transcript)
            return clips, video_info.duration

        clips, duration = await loop.run_in_executor(_job_executor, _analyze)
        
        return AnalyzeResponse(
            job_id=0,
            candidates=[
                ClipCandidate(
                    index=c.index,
                    hook=c.hook,
                    start=c.start_time,
                    end=c.end_time,
                    duration=c.end_time - c.start_time,
                    score=c.score,
                    keywords=c.keywords,
                )
                for c in clips
            ],
            video_duration=duration,
        )
    except Exception as e:
        logger.error(f"Analyze error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/process-selected", response_model=JobResponse)
async def process_selected_clips(
    request: ProcessSelectedRequest,
    current: dict = Depends(get_current_user)
):
    """Step 2: Process only the selected/edited clips."""
    try:
        user_id = int(current.get("sub"))
        
        if not request.selected_indices:
            raise HTTPException(status_code=400, detail="No clips selected")
        
        session = database.get_session()
        try:
            log = RequestLogRepository(session).get_by_id(request.job_id)
            if not log:
                raise HTTPException(status_code=404, detail="Job not found")
        finally:
            session.close()
        
        if job_queue.is_processing(log.youtube_url):
            return JobResponse(status="processing", message="Video sedang diproses")
        
        caption_style = request.effective_caption_id or log.caption_style_id
        hook_id = request.effective_hook_id
        job_request = JobRequest(
            urls=log.youtube_url,
            caption_style=caption_style or 1,
            user_id=user_id,
            hook_style_id=hook_id,
        )
        job_request._selected_indices = request.selected_indices
        job_request._edited_hooks = request.edited_hooks
        
        job_queue.enqueue(QueuedJob(job_request=job_request))
        return JobResponse(status="accepted", message=f"Processing {len(request.selected_indices)} clips")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Process-selected error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─────────────────────────────────────────────────────────────────────────────
#  Preview Generation
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/preview", response_model=PreviewResponse)
async def generate_preview(
    request: PreviewRequest,
    current: dict = Depends(get_current_user)
):
    """Generate a 5-second low-res preview of a clip."""
    try:
        user_id = int(current.get("sub"))
        
        loop = asyncio.get_event_loop()
        
        def _generate():
            import subprocess
            import time as _time
            from ...infrastructure.external_services import YouTubeDownloader
            
            output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
            preview_dir = os.path.join(output_dir, "_previews")
            os.makedirs(preview_dir, exist_ok=True)
            
            # Clean old previews (>1 hour)
            now = _time.time()
            for f in os.listdir(preview_dir):
                fp = os.path.join(preview_dir, f)
                if os.path.isfile(fp) and now - os.path.getmtime(fp) > 3600:
                    try:
                        os.remove(fp)
                    except OSError:
                        pass
            
            preview_id = f"preview_{user_id}_{request.clip_index}_{int(now)}"
            preview_path = os.path.join(preview_dir, f"{preview_id}.mp4")
            
            # If video_path is a URL, download first
            if request.video_path.startswith('http'):
                downloader = YouTubeDownloader(output_dir)
                video_info = downloader.download(request.video_path)
                video_file = video_info.filepath
            else:
                video_file = request.video_path
            
            # Generate preview with FFmpeg
            duration = min(request.duration, 5.0)
            cmd = [
                'ffmpeg', '-ss', str(request.start_time),
                '-i', video_file, '-t', str(duration),
                '-vf', 'scale=540:-2',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
                '-c:a', 'aac', '-b:a', '96k',
                '-y', preview_path
            ]
            subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            return preview_id, duration
        
        preview_id, actual_duration = await loop.run_in_executor(_job_executor, _generate)
        
        return PreviewResponse(
            preview_id=preview_id,
            preview_url=f"/api/v1/jobs/preview/{preview_id}",
            expires_in=300,
        )
    except Exception as e:
        logger.error(f"Preview error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")


@router.get("/preview/{preview_id}")
async def serve_preview(preview_id: str, _: dict = Depends(get_current_user)):
    """Serve a generated preview video file."""
    if not re.match(r'^preview_\d+_\d+_\d+$', preview_id):
        raise HTTPException(status_code=400, detail="Invalid preview ID")
    
    output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
    preview_path = os.path.join(output_dir, "_previews", f"{preview_id}.mp4")
    
    if not os.path.isfile(preview_path):
        raise HTTPException(status_code=404, detail="Preview not found or expired")
    
    return FileResponse(preview_path, media_type="video/mp4", filename=f"{preview_id}.mp4")


# ─────────────────────────────────────────────────────────────────────────────
#  File Serving (clips, thumbnails, videos)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{job_id}/clip/{clip_index}")
async def serve_clip(job_id: int, clip_index: int, _: dict = Depends(get_current_user)):
    """Serve a clip video file."""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job_dir = log.output_path or os.path.join(OUTPUT_DIR, f"job_{job_id}")
        video_path = os.path.join(job_dir, f"clip_{clip_index}_final.mp4")
        
        if not os.path.exists(video_path):
            video_path = os.path.join(job_dir, f"clip_{clip_index}_base.mp4")
        
        if not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Clip not found")
        
        return FileResponse(video_path, media_type="video/mp4", filename=f"clip_{job_id}_{clip_index}.mp4")
    finally:
        session.close()


@router.get("/{job_id}/thumbnail/{clip_index}")
async def serve_thumbnail_by_index(job_id: int, clip_index: int, _: dict = Depends(get_current_user)):
    """Serve a clip thumbnail by index. Generates from base/raw if missing."""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job_dir = log.output_path or os.path.join(OUTPUT_DIR, f"job_{job_id}")
        thumb_path = os.path.join(job_dir, f"clip_{clip_index}_thumb.jpg")
        
        # If thumbnail doesn't exist, try generating from base/raw (not final)
        if not os.path.exists(thumb_path):
            base_path = os.path.join(job_dir, f"clip_{clip_index}_base.mp4")
            raw_path = os.path.join(job_dir, f"clip_{clip_index}_raw.mp4")
            final_path = os.path.join(job_dir, f"clip_{clip_index}_final.mp4")
            
            source = None
            if os.path.exists(base_path):
                source = base_path
            elif os.path.exists(raw_path):
                source = raw_path
            elif os.path.exists(final_path):
                source = final_path
            
            if source:
                _generate_thumbnail_if_missing(source, thumb_path)
        
        if not os.path.exists(thumb_path):
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        
        return FileResponse(thumb_path, media_type="image/jpeg")
    finally:
        session.close()


@router.get("/{job_id}/thumbnails/{filename}")
async def serve_thumbnail(job_id: int, filename: str, _: dict = Depends(get_current_user)):
    """Serve thumbnail by filename."""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log or not log.output_path:
            raise HTTPException(status_code=404, detail="Not found")
        if not filename.endswith("_thumb.jpg"):
            raise HTTPException(status_code=400, detail="Only thumbnails allowed")
        file_path = safe_file_path(log.output_path, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        return FileResponse(file_path, media_type="image/jpeg", filename=filename)
    finally:
        session.close()


@router.get("/{job_id}/videos/{filename}")
async def serve_video(job_id: int, filename: str, _: dict = Depends(get_current_user)):
    """Serve final clip video by filename."""
    session = database.get_session()
    try:
        log = RequestLogRepository(session).get_by_id(job_id)
        if not log or not log.output_path:
            raise HTTPException(status_code=404, detail="Not found")
        if not filename.endswith("_final.mp4"):
            raise HTTPException(status_code=400, detail="Only final clips allowed")
        file_path = safe_file_path(log.output_path, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="Video not found")
        return FileResponse(file_path, media_type="video/mp4", filename=filename)
    finally:
        session.close()


@router.get("/{job_id}/files/{filename}")
async def serve_job_file(job_id: int, filename: str, current: dict = Depends(get_current_user)):
    """Serve a file (final video or thumbnail) belonging to a job."""
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
        file_path = safe_file_path(log.output_path, filename)
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        media_type = "video/mp4" if filename.endswith(".mp4") else "image/jpeg"
        return FileResponse(file_path, media_type=media_type, filename=filename)
    finally:
        session.close()
