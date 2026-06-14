"""Job API routes — POST /jobs, GET /jobs/{id}, GET /jobs/{id}/error, GET /jobs/{id}/clips."""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from src.application.services import JobService
from src.config import settings
from src.presentation.dependencies import get_job_service
from src.presentation.schemas.jobs import (
    ClipDataResponse,
    CreateJobRequest,
    JobErrorResponse,
    JobResponse,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", status_code=201, response_model=JobResponse)
async def create_job(
    request: CreateJobRequest,
    service: JobService = Depends(get_job_service),
):
    """Buat job baru dari URL YouTube. Jika URL sudah ada yang aktif, return job yang ada."""
    job = await service.create_job(request.youtube_url)
    return JobResponse(
        job_id=job.job_id,
        youtube_url=job.youtube_url,
        status=job.status.value,
        video_duration=job.video_duration,
        render_progress=job.render_progress,
        error_message=job.error_message,
        clips_data=job.clips_data,
        clips_total=job.clips_total,
        clips_success=job.clips_success,
        clips_failed=job.clips_failed,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    service: JobService = Depends(get_job_service),
):
    """Ambil status dan data job berdasarkan job_id."""
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")
    return JobResponse(
        job_id=job.job_id,
        youtube_url=job.youtube_url,
        status=job.status.value,
        video_duration=job.video_duration,
        render_progress=job.render_progress,
        error_message=job.error_message,
        clips_data=job.clips_data,
        clips_total=job.clips_total,
        clips_success=job.clips_success,
        clips_failed=job.clips_failed,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/{job_id}/error", response_model=JobErrorResponse)
async def get_job_error(
    job_id: str,
    service: JobService = Depends(get_job_service),
):
    """Ambil detail error untuk job yang gagal."""
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")
    if job.status.value not in ("failed", "timeout"):
        raise HTTPException(
            status_code=404,
            detail="Job tidak dalam status failed/timeout",
        )
    return JobErrorResponse(
        job_id=job.job_id,
        error_message=job.error_message,
        error_details=job.error_details,
    )


@router.get("/{job_id}/clips", response_model=ClipDataResponse)
async def get_job_clips(
    job_id: str,
    service: JobService = Depends(get_job_service),
):
    """
    Ambil clip data lengkap untuk Remotion rendering.
    Berisi subtitle, hook, word-level timestamps, dan highlight info.
    """
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")

    clips = None
    if job.clips_data and "clips" in job.clips_data:
        clips = job.clips_data["clips"]

    return ClipDataResponse(
        job_id=job.job_id,
        status=job.status.value,
        clips=clips,
    )


@router.get("/{job_id}/clips/{clip_rank}/video")
async def get_clip_video(
    job_id: str,
    clip_rank: int,
    service: JobService = Depends(get_job_service),
):
    """Download trimmed clip video file."""
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")

    clip_path = f"{settings.OUTPUT_DIR}/{job_id}/clip_{clip_rank:02d}.mp4"
    if not os.path.exists(clip_path):
        raise HTTPException(status_code=404, detail="File clip tidak ditemukan")

    return FileResponse(
        clip_path,
        media_type="video/mp4",
        filename=f"{job_id}_clip_{clip_rank:02d}.mp4",
    )
