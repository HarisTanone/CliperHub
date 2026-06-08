"""
Remotion Template Routes
CRUD endpoints untuk caption templates, hook templates, compositions, dan render jobs.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from ..schemas.remotion import (
    CaptionTemplateResponse, CaptionTemplateCreate, CaptionTemplateUpdate,
    HookTemplateResponse, HookTemplateCreate, HookTemplateUpdate,
    CompositionResponse, CompositionCreate, CompositionUpdate,
    RenderJobResponse, RenderJobCreate, RenderJobStats,
)
from ..dependencies import get_current_user, require_admin
from ...infrastructure.database import database
from ...infrastructure.remotion_repository import (
    RemotionCaptionTemplateRepository,
    RemotionHookTemplateRepository,
    RemotionCompositionRepository,
    RemotionRenderJobRepository,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _caption_to_response(obj) -> CaptionTemplateResponse:
    return CaptionTemplateResponse(
        id=obj.id, name=obj.name, description=obj.description,
        category=obj.category or "general",
        remotion_component=obj.remotion_component or "KaraokeCaption",
        thumbnail_url=obj.thumbnail_url,
        font_family=obj.font_family, font_weight=obj.font_weight,
        font_size=obj.font_size, letter_spacing=obj.letter_spacing or 0,
        text_transform=obj.text_transform or "none",
        line_height=obj.line_height or 1.3,
        color=obj.color, highlight_color=obj.highlight_color,
        highlight_style=obj.highlight_style,
        bg_enabled=bool(obj.bg_enabled), bg_color=obj.bg_color or "#000000",
        bg_opacity=obj.bg_opacity or 0.7, bg_padding_x=obj.bg_padding_x or 12,
        bg_padding_y=obj.bg_padding_y or 6, bg_border_radius=obj.bg_border_radius or 8,
        bg_per_word=bool(obj.bg_per_word),
        outline_enabled=bool(obj.outline_enabled), outline_color=obj.outline_color or "#000000",
        outline_width=obj.outline_width or 2,
        shadow_enabled=bool(obj.shadow_enabled), shadow_color=obj.shadow_color or "#000000",
        shadow_blur=obj.shadow_blur or 4, shadow_offset_x=obj.shadow_offset_x or 0,
        shadow_offset_y=obj.shadow_offset_y or 2,
        position_y=obj.position_y, position_y_offset=obj.position_y_offset or 80,
        max_words_per_line=obj.max_words_per_line or 4, max_lines=obj.max_lines or 2,
        animation_in=obj.animation_in or "fade", animation_out=obj.animation_out or "fade",
        animation_in_duration=obj.animation_in_duration or 200,
        animation_out_duration=obj.animation_out_duration or 150,
        highlight_transition=obj.highlight_transition or "instant",
        highlight_transition_duration=obj.highlight_transition_duration or 100,
        config=obj.config,
        user_id=obj.user_id, is_active=bool(obj.is_active),
        is_default=bool(obj.is_default), sort_order=obj.sort_order or 0,
    )


def _hook_to_response(obj) -> HookTemplateResponse:
    return HookTemplateResponse(
        id=obj.id, name=obj.name, description=obj.description,
        category=obj.category or "general",
        remotion_component=obj.remotion_component or "HookOverlay",
        thumbnail_url=obj.thumbnail_url,
        font_family=obj.font_family, font_weight=obj.font_weight,
        font_size_normal=obj.font_size_normal, font_size_keyword=obj.font_size_keyword,
        letter_spacing=obj.letter_spacing or 0,
        text_transform=obj.text_transform or "uppercase",
        color=obj.color, keyword_color=obj.keyword_color,
        box_enabled=bool(obj.box_enabled), box_color=obj.box_color or "#000000",
        box_opacity=obj.box_opacity or 0.6, box_padding=obj.box_padding or 20,
        box_border_radius=obj.box_border_radius or 12,
        keyword_bg_enabled=bool(obj.keyword_bg_enabled),
        keyword_bg_color=obj.keyword_bg_color or "#FF0000",
        keyword_bg_opacity=obj.keyword_bg_opacity or 0.8,
        keyword_underline_enabled=bool(obj.keyword_underline_enabled),
        keyword_underline_color=obj.keyword_underline_color or "#FFFFFF",
        keyword_underline_thickness=obj.keyword_underline_thickness or 3,
        shadow_enabled=bool(obj.shadow_enabled), shadow_color=obj.shadow_color or "#000000",
        shadow_blur=obj.shadow_blur or 12, shadow_offset_y=obj.shadow_offset_y or 3,
        glow_enabled=bool(obj.glow_enabled), glow_color=obj.glow_color or "#FFFFFF",
        glow_radius=obj.glow_radius or 8,
        outline_enabled=bool(obj.outline_enabled), outline_color=obj.outline_color or "#000000",
        outline_width=obj.outline_width or 2,
        gradient_enabled=bool(obj.gradient_enabled),
        gradient_colors=obj.gradient_colors,
        gradient_direction=obj.gradient_direction or "to right",
        position_x=obj.position_x, position_y=obj.position_y,
        position_y_offset=obj.position_y_offset or 0,
        animation_type=obj.animation_type or "fade",
        animation_in_duration=obj.animation_in_duration or 300,
        display_duration_seconds=obj.display_duration_seconds or 3.0,
        delay_before_seconds=obj.delay_before_seconds or 0.5,
        config=obj.config,
        user_id=obj.user_id, is_active=bool(obj.is_active),
        is_default=bool(obj.is_default), sort_order=obj.sort_order or 0,
    )


def _composition_to_response(obj, caption=None, hook=None) -> CompositionResponse:
    return CompositionResponse(
        id=obj.id, name=obj.name, description=obj.description,
        thumbnail_url=obj.thumbnail_url, category=obj.category or "general",
        caption_template_id=obj.caption_template_id,
        hook_template_id=obj.hook_template_id,
        fps=obj.fps, width=obj.width, height=obj.height,
        codec=obj.codec, crf=obj.crf,
        overlay_config=obj.overlay_config,
        user_id=obj.user_id, is_active=bool(obj.is_active),
        is_default=bool(obj.is_default), use_count=obj.use_count or 0,
        sort_order=obj.sort_order or 0,
        caption_template=_caption_to_response(caption) if caption else None,
        hook_template=_hook_to_response(hook) if hook else None,
    )


def _render_job_to_response(obj) -> RenderJobResponse:
    return RenderJobResponse(
        id=obj.id, request_log_id=obj.request_log_id,
        clip_index=obj.clip_index, composition_id=obj.composition_id,
        caption_template_id=obj.caption_template_id,
        hook_template_id=obj.hook_template_id,
        input_video_path=obj.input_video_path,
        output_video_path=obj.output_video_path,
        hook_text=obj.hook_text,
        status=obj.status, progress_percent=obj.progress_percent or 0,
        render_time_ms=obj.render_time_ms,
        error_message=obj.error_message, retry_count=obj.retry_count or 0,
        queued_at=obj.queued_at.isoformat() if obj.queued_at else None,
        started_at=obj.started_at.isoformat() if obj.started_at else None,
        completed_at=obj.completed_at.isoformat() if obj.completed_at else None,
    )


# ═════════════════════════════════════════════════════════════════════════════
#  CAPTION TEMPLATES
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/caption-templates", response_model=List[CaptionTemplateResponse])
async def list_caption_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    current: dict = Depends(get_current_user),
):
    """List all active caption templates (global + user's own)."""
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        repo = RemotionCaptionTemplateRepository(session)
        templates = repo.get_all(user_id=user_id, category=category)
        return [_caption_to_response(t) for t in templates]
    finally:
        session.close()


@router.get("/caption-templates/{template_id}", response_model=CaptionTemplateResponse)
async def get_caption_template(template_id: int, _: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        obj = RemotionCaptionTemplateRepository(session).get_by_id(template_id)
        if not obj:
            raise HTTPException(404, "Caption template not found")
        return _caption_to_response(obj)
    finally:
        session.close()


@router.post("/caption-templates", response_model=CaptionTemplateResponse, status_code=201)
async def create_caption_template(body: CaptionTemplateCreate, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        data["user_id"] = user_id
        obj = RemotionCaptionTemplateRepository(session).create(data)
        return _caption_to_response(obj)
    finally:
        session.close()


@router.put("/caption-templates/{template_id}", response_model=CaptionTemplateResponse)
async def update_caption_template(template_id: int, body: CaptionTemplateUpdate, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(400, "No fields to update")
        repo = RemotionCaptionTemplateRepository(session)
        obj = repo.update(template_id, data, user_id=None if is_admin else user_id)
        if not obj:
            raise HTTPException(404, "Caption template not found or access denied")
        return _caption_to_response(obj)
    finally:
        session.close()


@router.delete("/caption-templates/{template_id}")
async def delete_caption_template(template_id: int, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RemotionCaptionTemplateRepository(session)
        if not repo.delete(template_id, user_id=None if is_admin else user_id):
            raise HTTPException(404, "Caption template not found or access denied")
        return {"status": "deleted", "id": template_id}
    finally:
        session.close()


# ═════════════════════════════════════════════════════════════════════════════
#  HOOK TEMPLATES
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/hook-templates", response_model=List[HookTemplateResponse])
async def list_hook_templates(
    category: Optional[str] = Query(None),
    current: dict = Depends(get_current_user),
):
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        repo = RemotionHookTemplateRepository(session)
        templates = repo.get_all(user_id=user_id, category=category)
        return [_hook_to_response(t) for t in templates]
    finally:
        session.close()


@router.get("/hook-templates/{template_id}", response_model=HookTemplateResponse)
async def get_hook_template(template_id: int, _: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        obj = RemotionHookTemplateRepository(session).get_by_id(template_id)
        if not obj:
            raise HTTPException(404, "Hook template not found")
        return _hook_to_response(obj)
    finally:
        session.close()


@router.post("/hook-templates", response_model=HookTemplateResponse, status_code=201)
async def create_hook_template(body: HookTemplateCreate, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        data["user_id"] = user_id
        obj = RemotionHookTemplateRepository(session).create(data)
        return _hook_to_response(obj)
    finally:
        session.close()


@router.put("/hook-templates/{template_id}", response_model=HookTemplateResponse)
async def update_hook_template(template_id: int, body: HookTemplateUpdate, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(400, "No fields to update")
        repo = RemotionHookTemplateRepository(session)
        obj = repo.update(template_id, data, user_id=None if is_admin else user_id)
        if not obj:
            raise HTTPException(404, "Hook template not found or access denied")
        return _hook_to_response(obj)
    finally:
        session.close()


@router.delete("/hook-templates/{template_id}")
async def delete_hook_template(template_id: int, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = RemotionHookTemplateRepository(session)
        if not repo.delete(template_id, user_id=None if is_admin else user_id):
            raise HTTPException(404, "Hook template not found or access denied")
        return {"status": "deleted", "id": template_id}
    finally:
        session.close()


# ═════════════════════════════════════════════════════════════════════════════
#  COMPOSITIONS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/compositions", response_model=List[CompositionResponse])
async def list_compositions(current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        repo = RemotionCompositionRepository(session)
        caption_repo = RemotionCaptionTemplateRepository(session)
        hook_repo = RemotionHookTemplateRepository(session)
        
        compositions = repo.get_all(user_id=user_id)
        results = []
        for comp in compositions:
            caption = caption_repo.get_by_id(comp.caption_template_id) if comp.caption_template_id else None
            hook = hook_repo.get_by_id(comp.hook_template_id) if comp.hook_template_id else None
            results.append(_composition_to_response(comp, caption, hook))
        return results
    finally:
        session.close()


@router.get("/compositions/{comp_id}", response_model=CompositionResponse)
async def get_composition(comp_id: int, _: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        repo = RemotionCompositionRepository(session)
        comp = repo.get_by_id(comp_id)
        if not comp:
            raise HTTPException(404, "Composition not found")
        caption_repo = RemotionCaptionTemplateRepository(session)
        hook_repo = RemotionHookTemplateRepository(session)
        caption = caption_repo.get_by_id(comp.caption_template_id) if comp.caption_template_id else None
        hook = hook_repo.get_by_id(comp.hook_template_id) if comp.hook_template_id else None
        return _composition_to_response(comp, caption, hook)
    finally:
        session.close()


@router.post("/compositions", response_model=CompositionResponse, status_code=201)
async def create_composition(body: CompositionCreate, current: dict = Depends(get_current_user)):
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        data["user_id"] = user_id
        obj = RemotionCompositionRepository(session).create(data)
        return _composition_to_response(obj)
    finally:
        session.close()


@router.put("/compositions/{comp_id}", response_model=CompositionResponse)
async def update_composition(comp_id: int, body: CompositionUpdate, current: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(400, "No fields to update")
        obj = RemotionCompositionRepository(session).update(comp_id, data)
        if not obj:
            raise HTTPException(404, "Composition not found")
        return _composition_to_response(obj)
    finally:
        session.close()


@router.delete("/compositions/{comp_id}")
async def delete_composition(comp_id: int, _: dict = Depends(require_admin)):
    session = database.get_session()
    try:
        if not RemotionCompositionRepository(session).delete(comp_id):
            raise HTTPException(404, "Composition not found")
        return {"status": "deleted", "id": comp_id}
    finally:
        session.close()


# ═════════════════════════════════════════════════════════════════════════════
#  RENDER JOBS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/render-jobs", response_model=List[RenderJobResponse])
async def list_render_jobs(
    request_log_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    _: dict = Depends(get_current_user),
):
    session = database.get_session()
    try:
        repo = RemotionRenderJobRepository(session)
        if request_log_id:
            jobs = repo.get_by_request(request_log_id)
        else:
            jobs = repo.get_pending(limit=50)
        if status:
            jobs = [j for j in jobs if j.status == status]
        return [_render_job_to_response(j) for j in jobs]
    finally:
        session.close()


@router.post("/render-jobs", response_model=RenderJobResponse, status_code=201)
async def create_render_job(body: RenderJobCreate, _: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        data = body.model_dump(exclude_unset=True)
        obj = RemotionRenderJobRepository(session).create(data)
        return _render_job_to_response(obj)
    finally:
        session.close()


@router.get("/render-jobs/stats", response_model=RenderJobStats)
async def get_render_stats(_: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        stats = RemotionRenderJobRepository(session).get_stats()
        total = sum(stats.values())
        return RenderJobStats(
            pending=stats.get("pending", 0),
            rendering=stats.get("rendering", 0),
            completed=stats.get("completed", 0),
            failed=stats.get("failed", 0),
            cancelled=stats.get("cancelled", 0),
            total=total,
        )
    finally:
        session.close()


@router.get("/render-jobs/{job_id}", response_model=RenderJobResponse)
async def get_render_job(job_id: int, _: dict = Depends(get_current_user)):
    session = database.get_session()
    try:
        obj = RemotionRenderJobRepository(session).get_by_id(job_id)
        if not obj:
            raise HTTPException(404, "Render job not found")
        return _render_job_to_response(obj)
    finally:
        session.close()
