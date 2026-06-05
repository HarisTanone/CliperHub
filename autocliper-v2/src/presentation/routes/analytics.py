"""
Analytics Routes - Dashboard stats, engagement, trending audio
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from ..schemas.analytics import EngagementPredictRequest, AudioSuggestRequest
from ..dependencies import get_current_user
from ...infrastructure.database import database
from ...infrastructure.repositories import RequestLogRepository
from ...infrastructure.engagement_predictor import engagement_predictor
from ...infrastructure.trending_audio import trending_audio_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _parse_hooks(caption_response) -> list:
    """Parse hooks from caption_response."""
    if not caption_response:
        return []
    try:
        data = json.loads(caption_response) if isinstance(caption_response, str) else caption_response
        return data if isinstance(data, list) else data.get("hooks", [])
    except:
        return []


@router.get("/stats/dashboard")
async def get_dashboard_stats(current: dict = Depends(get_current_user)):
    """Get dashboard statistics for current user."""
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        user_id = int(current["sub"])
        role = current.get("role")
        
        # Get all jobs for the user (or all if admin)
        if role == "admin":
            all_jobs = repo.get_all()
        else:
            all_jobs = repo.get_all(user_id=user_id)
        
        # Count by status - RequestLog.status is ProcessingState enum
        total_jobs = len(all_jobs)
        completed = sum(1 for j in all_jobs if j.status.value == "completed")
        failed = sum(1 for j in all_jobs if j.status.value == "failed")
        processing = sum(1 for j in all_jobs if j.status.value == "processing")
        pending = sum(1 for j in all_jobs if j.status.value == "pending")
        
        # Calculate total clips from caption_response (list of ClipData)
        total_clips = 0
        for job in all_jobs:
            if job.caption_response:
                total_clips += len(job.caption_response)
        
        # Recent jobs
        recent = all_jobs[:5] if all_jobs else []
        
        return {
            "total_jobs": total_jobs,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "pending": pending,
            "total_clips": total_clips,
            "recent_jobs": [
                {
                    "id": j.id,
                    "youtube_url": j.youtube_url,
                    "status": j.status.value if hasattr(j.status, 'value') else j.status,
                    "requested_at": j.requested_at.isoformat() if j.requested_at else None,
                }
                for j in recent
            ]
        }
    finally:
        session.close()


@router.get("/stats/usage")
async def get_usage_stats(
    days: int = Query(7, ge=1, le=90),
    current: dict = Depends(get_current_user)
):
    """Get usage statistics over time."""
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        user_id = int(current["sub"])
        role = current.get("role")
        
        start_date = datetime.now() - timedelta(days=days)
        
        # Get all jobs and filter by date
        if role == "admin":
            all_jobs = repo.get_all()
        else:
            all_jobs = repo.get_all(user_id=user_id)
        
        jobs = [j for j in all_jobs if j.requested_at and j.requested_at >= start_date]
        
        # Group by date
        daily_stats = {}
        for job in jobs:
            if job.requested_at:
                date_key = job.requested_at.strftime("%Y-%m-%d")
                if date_key not in daily_stats:
                    daily_stats[date_key] = {"jobs": 0, "completed": 0, "failed": 0}
                daily_stats[date_key]["jobs"] += 1
                status_val = job.status.value if hasattr(job.status, 'value') else job.status
                if status_val == "completed":
                    daily_stats[date_key]["completed"] += 1
                elif status_val == "failed":
                    daily_stats[date_key]["failed"] += 1
        
        return {
            "period_days": days,
            "total_jobs": len(jobs),
            "daily_stats": [
                {"date": k, **v}
                for k, v in sorted(daily_stats.items())
            ]
        }
    finally:
        session.close()


@router.get("/analytics/overview")
async def get_analytics_overview(current: dict = Depends(get_current_user)):
    """Get analytics overview."""
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        user_id = int(current["sub"])
        role = current.get("role")
        
        start_date = datetime.now() - timedelta(days=30)
        
        if role == "admin":
            all_jobs = repo.get_all()
        else:
            all_jobs = repo.get_all(user_id=user_id)
        
        jobs = [j for j in all_jobs if j.requested_at and j.requested_at >= start_date]
        
        # Calculate stats - caption_response is a list of ClipData objects
        total_videos = len(jobs)
        total_clips = 0
        total_duration = 0
        
        for job in jobs:
            if job.caption_response:
                total_clips += len(job.caption_response)
                for clip in job.caption_response:
                    total_duration += clip.end_time - clip.start_time
        
        return {
            "period": "30_days",
            "total_videos_processed": total_videos,
            "total_clips_generated": total_clips,
            "total_duration_seconds": round(total_duration, 2),
            "avg_clips_per_video": round(total_clips / total_videos, 1) if total_videos > 0 else 0,
        }
    finally:
        session.close()


@router.get("/analytics/clips")
async def get_clips_analytics(
    days: int = Query(30, ge=1, le=90),
    current: dict = Depends(get_current_user)
):
    """Get detailed clips analytics."""
    session = database.get_session()
    try:
        repo = RequestLogRepository(session)
        user_id = int(current["sub"])
        role = current.get("role")
        
        start_date = datetime.now() - timedelta(days=days)
        
        if role == "admin":
            all_jobs = repo.get_all()
        else:
            all_jobs = repo.get_all(user_id=user_id)
        
        # Filter jobs by status and date
        jobs = [
            j for j in all_jobs
            if (j.status.value if hasattr(j.status, 'value') else j.status) == "completed"
            and j.requested_at and j.requested_at >= start_date
        ]
        
        clips_data = []
        for job in jobs:
            if job.caption_response:
                for i, clip in enumerate(job.caption_response, 1):
                    clips_data.append({
                        "job_id": job.id,
                        "clip_index": i,
                        "hook": clip.hook[:100] if clip.hook else "",
                        "duration": clip.end_time - clip.start_time,
                        "score": clip.score,
                        "requested_at": job.requested_at.isoformat() if job.requested_at else None,
                    })
        
        return {
            "period_days": days,
            "total_clips": len(clips_data),
            "clips": clips_data[:100],
        }
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Engagement & Trending
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/engagement/predict")
async def predict_engagement(
    body: EngagementPredictRequest,
    _: dict = Depends(get_current_user)
):
    """Predict engagement score for a hook."""
    try:
        result = engagement_predictor.predict(
            hook_text=body.hook_text,
            duration_seconds=body.duration_seconds,
            has_trending_audio=body.has_trending_audio
        )
        return result
    except Exception as e:
        logger.error(f"Engagement prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed")


@router.get("/trending/audio/categories")
async def get_audio_categories(_: dict = Depends(get_current_user)):
    """Get trending audio categories."""
    return trending_audio_service.get_categories()


@router.get("/trending/audio")
async def get_trending_audio(
    category: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    _: dict = Depends(get_current_user)
):
    """Get trending audio tracks."""
    return trending_audio_service.get_trending(category=category, limit=limit)


@router.post("/trending/audio/suggest")
async def suggest_audio_for_clips(
    body: AudioSuggestRequest,
    _: dict = Depends(get_current_user)
):
    """Suggest audio tracks based on video mood."""
    return trending_audio_service.suggest_for_mood(
        mood=body.video_mood,
        duration=body.clip_duration
    )
