"""
Keyframe Animation System Routes — Full CRUD for all 4 resource types.

Endpoints:
  /keyframes           — Keyframe Registry (reusable animation templates)
  /caption-templates   — Caption overlay style configurations
  /hook-templates      — Hook overlay style configurations
  /style-compositions  — Paired caption + hook style profiles
"""
import math
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query

from ..schemas.keyframes import (
    KeyframeCreate,
    KeyframeUpdate,
    KeyframeResponse,
    CaptionTemplateCreate,
    CaptionTemplateUpdate,
    CaptionTemplateResponse,
    HookTemplateCreate,
    HookTemplateUpdate,
    HookTemplateResponse,
    StyleCompositionCreate,
    StyleCompositionUpdate,
    StyleCompositionResponse,
)
from ..dependencies import get_current_user
from ...infrastructure.database import database
from ...infrastructure.keyframe_repository import (
    KeyframeRegistryRepository,
    CaptionTemplateRepository,
    HookTemplateRepository,
    StyleCompositionRepository,
)
from ...infrastructure.keyframe_models import (
    KeyframeRegistryModel,
    CaptionTemplateModel,
    HookTemplateModel,
    StyleCompositionModel,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _paginated_response(items, total: int, page: int, per_page: int) -> dict:
    """Wrap list results in standard paginated response."""
    total_pages = math.ceil(total / per_page) if per_page > 0 else 0
    return {
        "success": True,
        "data": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


def _success(data) -> dict:
    """Wrap single-item results."""
    return {"success": True, "data": data}


def _keyframe_to_dict(model: KeyframeRegistryModel) -> dict:
    return KeyframeResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        category=model.category,
        fps=model.fps,
        duration_frames=model.duration_frames,
        keyframes=model.keyframes or [],
        properties=model.properties or [],
        transform_origin=model.transform_origin or "center center",
        params_hash=model.params_hash,
        is_active=model.is_active,
        created_at=model.created_at,
        updated_at=model.updated_at,
    ).model_dump()


def _caption_to_dict(model: CaptionTemplateModel) -> dict:
    return CaptionTemplateResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        category=model.category or "general",
        thumbnail_url=model.thumbnail_url,
        style_type=model.style_type or "animated",
        config=model.config,
        user_id=model.user_id,
        is_active=model.is_active,
        is_default=model.is_default,
        sort_order=model.sort_order or 0,
        created_at=model.created_at,
        updated_at=model.updated_at,
    ).model_dump()


def _hook_to_dict(model: HookTemplateModel) -> dict:
    return HookTemplateResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        category=model.category or "general",
        thumbnail_url=model.thumbnail_url,
        style_type=model.style_type or "animated",
        config=model.config,
        user_id=model.user_id,
        is_active=model.is_active,
        is_default=model.is_default,
        sort_order=model.sort_order or 0,
        created_at=model.created_at,
        updated_at=model.updated_at,
    ).model_dump()


def _composition_to_dict(model: StyleCompositionModel) -> dict:
    return StyleCompositionResponse(
        id=model.id,
        name=model.name,
        description=model.description,
        category=model.category or "general",
        thumbnail_url=model.thumbnail_url,
        caption_template_id=model.caption_template_id,
        hook_template_id=model.hook_template_id,
        user_id=model.user_id,
        is_active=model.is_active,
        is_default=model.is_default,
        use_count=model.use_count or 0,
        sort_order=model.sort_order or 0,
        created_at=model.created_at,
        updated_at=model.updated_at,
    ).model_dump()


def _count_query(session, model_class, **filters) -> int:
    """Get total count for pagination with applied filters."""
    q = session.query(model_class)
    for attr, value in filters.items():
        if value is not None:
            q = q.filter(getattr(model_class, attr) == value)
    return q.count()


# ─────────────────────────────────────────────────────────────────────────────
#  Keyframe Registry CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/keyframes")
async def list_keyframes(
    category: Optional[str] = Query(None),
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    """List keyframe registry entries (paginated, filtered)."""
    session = database.get_session()
    try:
        repo = KeyframeRegistryRepository(session)
        items = repo.get_all(
            category=category,
            is_active=is_active,
            page=page,
            per_page=per_page,
        )
        filters = {"is_active": is_active}
        if category is not None:
            filters["category"] = category
        total = _count_query(session, KeyframeRegistryModel, **filters)
        return _paginated_response(
            [_keyframe_to_dict(i) for i in items], total, page, per_page
        )
    finally:
        session.close()


@router.get("/keyframes/{keyframe_id}")
async def get_keyframe(keyframe_id: int, _: dict = Depends(get_current_user)):
    """Get single keyframe registry entry."""
    session = database.get_session()
    try:
        model = KeyframeRegistryRepository(session).get_by_id(keyframe_id)
        if not model:
            raise HTTPException(status_code=404, detail="Keyframe not found")
        return _success(_keyframe_to_dict(model))
    finally:
        session.close()


@router.post("/keyframes", status_code=201)
async def create_keyframe(body: KeyframeCreate, _: dict = Depends(get_current_user)):
    """Create new keyframe registry entry."""
    session = database.get_session()
    try:
        repo = KeyframeRegistryRepository(session)
        data = body.model_dump()
        # Serialize nested pydantic models to dicts for JSON columns
        data["keyframes"] = [f.model_dump() for f in body.keyframes]
        model = repo.create(data)
        return _success(_keyframe_to_dict(model))
    finally:
        session.close()


@router.put("/keyframes/{keyframe_id}")
async def update_keyframe(
    keyframe_id: int, body: KeyframeUpdate, _: dict = Depends(get_current_user)
):
    """Update keyframe registry entry."""
    session = database.get_session()
    try:
        repo = KeyframeRegistryRepository(session)
        data = body.model_dump(exclude_unset=True)
        # Serialize nested pydantic models if keyframes is present
        if "keyframes" in data and data["keyframes"] is not None:
            data["keyframes"] = [f.model_dump() for f in body.keyframes]
        model = repo.update(keyframe_id, data)
        if not model:
            raise HTTPException(status_code=404, detail="Keyframe not found")
        return _success(_keyframe_to_dict(model))
    finally:
        session.close()


@router.delete("/keyframes/{keyframe_id}")
async def delete_keyframe(keyframe_id: int, _: dict = Depends(get_current_user)):
    """Soft-delete keyframe registry entry (sets is_active=false)."""
    session = database.get_session()
    try:
        repo = KeyframeRegistryRepository(session)
        if not repo.soft_delete(keyframe_id):
            raise HTTPException(status_code=404, detail="Keyframe not found")
        return _success({"id": keyframe_id, "deleted": True})
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Caption Templates CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/caption-templates")
async def list_caption_templates(
    category: Optional[str] = Query(None),
    style_type: Optional[str] = Query(None),
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List caption templates (paginated, filtered). Shows user's own + system presets."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = CaptionTemplateRepository(session)
        items = repo.get_all(
            user_id=user_id,
            category=category,
            style_type=style_type,
            is_active=is_active,
            page=page,
            per_page=per_page,
        )
        # Count with same filters (user's own + system presets)
        from sqlalchemy import or_
        q = session.query(CaptionTemplateModel)
        q = q.filter(CaptionTemplateModel.is_active == is_active)
        q = q.filter(
            or_(
                CaptionTemplateModel.user_id == user_id,
                CaptionTemplateModel.user_id == None,
            )
        )
        if category is not None:
            q = q.filter(CaptionTemplateModel.category == category)
        if style_type is not None:
            q = q.filter(CaptionTemplateModel.style_type == style_type)
        total = q.count()
        return _paginated_response(
            [_caption_to_dict(i) for i in items], total, page, per_page
        )
    finally:
        session.close()


@router.get("/caption-templates/{template_id}")
async def get_caption_template(
    template_id: int, _: dict = Depends(get_current_user)
):
    """Get single caption template."""
    session = database.get_session()
    try:
        model = CaptionTemplateRepository(session).get_by_id(template_id)
        if not model:
            raise HTTPException(status_code=404, detail="Caption template not found")
        return _success(_caption_to_dict(model))
    finally:
        session.close()


@router.post("/caption-templates", status_code=201)
async def create_caption_template(
    body: CaptionTemplateCreate, current_user: dict = Depends(get_current_user)
):
    """Create new caption template."""
    session = database.get_session()
    try:
        repo = CaptionTemplateRepository(session)
        data = body.model_dump()
        # Serialize config to dict for JSON column
        data["config"] = body.config.model_dump()
        # Set user_id from JWT if not explicitly provided
        if data.get("user_id") is None:
            data["user_id"] = int(current_user["sub"])
        model = repo.create(data)
        return _success(_caption_to_dict(model))
    finally:
        session.close()


@router.put("/caption-templates/{template_id}")
async def update_caption_template(
    template_id: int,
    body: CaptionTemplateUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update caption template (ownership check enforced)."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = CaptionTemplateRepository(session)
        data = body.model_dump(exclude_unset=True)
        # Serialize config if present
        if "config" in data and data["config"] is not None:
            data["config"] = body.config.model_dump()
        model = repo.update(template_id, data, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=404,
                detail="Caption template not found or access denied",
            )
        return _success(_caption_to_dict(model))
    finally:
        session.close()


@router.delete("/caption-templates/{template_id}")
async def delete_caption_template(
    template_id: int, current_user: dict = Depends(get_current_user)
):
    """Soft-delete caption template (ownership check enforced)."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = CaptionTemplateRepository(session)
        if not repo.soft_delete(template_id, user_id=user_id):
            raise HTTPException(
                status_code=404,
                detail="Caption template not found or access denied",
            )
        return _success({"id": template_id, "deleted": True})
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Hook Templates CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hook-templates")
async def list_hook_templates(
    category: Optional[str] = Query(None),
    style_type: Optional[str] = Query(None),
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List hook templates (paginated, filtered). Shows user's own + system presets."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = HookTemplateRepository(session)
        items = repo.get_all(
            user_id=user_id,
            category=category,
            style_type=style_type,
            is_active=is_active,
            page=page,
            per_page=per_page,
        )
        # Count with same filters
        from sqlalchemy import or_
        q = session.query(HookTemplateModel)
        q = q.filter(HookTemplateModel.is_active == is_active)
        q = q.filter(
            or_(
                HookTemplateModel.user_id == user_id,
                HookTemplateModel.user_id == None,
            )
        )
        if category is not None:
            q = q.filter(HookTemplateModel.category == category)
        if style_type is not None:
            q = q.filter(HookTemplateModel.style_type == style_type)
        total = q.count()
        return _paginated_response(
            [_hook_to_dict(i) for i in items], total, page, per_page
        )
    finally:
        session.close()


@router.get("/hook-templates/{template_id}")
async def get_hook_template(
    template_id: int, _: dict = Depends(get_current_user)
):
    """Get single hook template."""
    session = database.get_session()
    try:
        model = HookTemplateRepository(session).get_by_id(template_id)
        if not model:
            raise HTTPException(status_code=404, detail="Hook template not found")
        return _success(_hook_to_dict(model))
    finally:
        session.close()


@router.post("/hook-templates", status_code=201)
async def create_hook_template(
    body: HookTemplateCreate, current_user: dict = Depends(get_current_user)
):
    """Create new hook template."""
    session = database.get_session()
    try:
        repo = HookTemplateRepository(session)
        data = body.model_dump()
        # Serialize config to dict for JSON column
        data["config"] = body.config.model_dump()
        # Set user_id from JWT if not explicitly provided
        if data.get("user_id") is None:
            data["user_id"] = int(current_user["sub"])
        model = repo.create(data)
        return _success(_hook_to_dict(model))
    finally:
        session.close()


@router.put("/hook-templates/{template_id}")
async def update_hook_template(
    template_id: int,
    body: HookTemplateUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update hook template (ownership check enforced)."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = HookTemplateRepository(session)
        data = body.model_dump(exclude_unset=True)
        # Serialize config if present
        if "config" in data and data["config"] is not None:
            data["config"] = body.config.model_dump()
        model = repo.update(template_id, data, user_id=user_id)
        if not model:
            raise HTTPException(
                status_code=404,
                detail="Hook template not found or access denied",
            )
        return _success(_hook_to_dict(model))
    finally:
        session.close()


@router.delete("/hook-templates/{template_id}")
async def delete_hook_template(
    template_id: int, current_user: dict = Depends(get_current_user)
):
    """Soft-delete hook template (ownership check enforced)."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = HookTemplateRepository(session)
        if not repo.soft_delete(template_id, user_id=user_id):
            raise HTTPException(
                status_code=404,
                detail="Hook template not found or access denied",
            )
        return _success({"id": template_id, "deleted": True})
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Style Compositions CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/style-compositions")
async def list_style_compositions(
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List style compositions (paginated). Shows user's own + system presets."""
    session = database.get_session()
    try:
        user_id = int(current_user["sub"])
        repo = StyleCompositionRepository(session)
        items = repo.get_all(
            user_id=user_id,
            is_active=is_active,
            page=page,
            per_page=per_page,
        )
        # Count with same filters
        from sqlalchemy import or_
        q = session.query(StyleCompositionModel)
        q = q.filter(StyleCompositionModel.is_active == is_active)
        q = q.filter(
            or_(
                StyleCompositionModel.user_id == user_id,
                StyleCompositionModel.user_id == None,
            )
        )
        total = q.count()
        return _paginated_response(
            [_composition_to_dict(i) for i in items], total, page, per_page
        )
    finally:
        session.close()


@router.get("/style-compositions/{composition_id}")
async def get_style_composition(
    composition_id: int, _: dict = Depends(get_current_user)
):
    """Get single style composition."""
    session = database.get_session()
    try:
        model = StyleCompositionRepository(session).get_by_id(composition_id)
        if not model:
            raise HTTPException(
                status_code=404, detail="Style composition not found"
            )
        return _success(_composition_to_dict(model))
    finally:
        session.close()


@router.post("/style-compositions", status_code=201)
async def create_style_composition(
    body: StyleCompositionCreate, current_user: dict = Depends(get_current_user)
):
    """Create new style composition."""
    session = database.get_session()
    try:
        repo = StyleCompositionRepository(session)
        data = body.model_dump()
        # Set user_id from JWT if not explicitly provided
        if data.get("user_id") is None:
            data["user_id"] = int(current_user["sub"])
        model = repo.create(data)
        return _success(_composition_to_dict(model))
    finally:
        session.close()


@router.put("/style-compositions/{composition_id}")
async def update_style_composition(
    composition_id: int,
    body: StyleCompositionUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update style composition."""
    session = database.get_session()
    try:
        repo = StyleCompositionRepository(session)
        data = body.model_dump(exclude_unset=True)
        model = repo.update(composition_id, data)
        if not model:
            raise HTTPException(
                status_code=404, detail="Style composition not found"
            )
        return _success(_composition_to_dict(model))
    finally:
        session.close()


@router.delete("/style-compositions/{composition_id}")
async def delete_style_composition(
    composition_id: int, _: dict = Depends(get_current_user)
):
    """Soft-delete style composition (sets is_active=false)."""
    session = database.get_session()
    try:
        repo = StyleCompositionRepository(session)
        if not repo.soft_delete(composition_id):
            raise HTTPException(
                status_code=404, detail="Style composition not found"
            )
        return _success({"id": composition_id, "deleted": True})
    finally:
        session.close()
