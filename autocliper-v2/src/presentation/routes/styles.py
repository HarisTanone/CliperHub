"""
Style Routes - Fonts, Hook Styles, Caption Styles
"""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends

from ..schemas.styles import (
    FontResponse, FontCreateModel, FontUpdateModel,
    HookStyleResponse, HookStyleCreateModel, HookStyleUpdateModel,
    CaptionStyleResponse, CaptionStyleCreateModel, CaptionStyleUpdateModel
)
from ..dependencies import get_current_user, require_admin
from ...infrastructure.database import database
from ...infrastructure.repositories import (
    FontRepository, HookStyleRepository, CaptionStyleRepository
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

def _font_to_response(f) -> FontResponse:
    return FontResponse(
        id=f.id,
        name=f.name,
        file_name=f.file_name,
        download_url=f.download_url,
        created_at=f.created_at.isoformat() if f.created_at else None
    )


def _hook_style_to_response(s) -> HookStyleResponse:
    return HookStyleResponse(
        id=s.id,
        name=s.name,
        config=s.config,
        is_active=s.is_active,
        created_at=s.created_at.isoformat() if s.created_at else None,
        updated_at=s.updated_at.isoformat() if s.updated_at else None
    )


def _caption_style_to_response(s) -> CaptionStyleResponse:
    # Parse config JSON if it's a string
    config_data = None
    if hasattr(s, 'config') and s.config:
        import json
        if isinstance(s.config, str):
            try:
                config_data = json.loads(s.config)
            except (json.JSONDecodeError, TypeError):
                config_data = None
        elif isinstance(s.config, dict):
            config_data = s.config

    return CaptionStyleResponse(
        id=s.id,
        name=s.name,
        font_id=s.font_id,
        font_family=s.font_family,
        font_weight=s.font_weight,
        font_size=s.font_size,
        color=s.color,
        highlight_color=s.highlight_color,
        outline_color=s.outline_color,
        outline_width=s.outline_width,
        shadow_color=s.shadow_color,
        shadow_offset_x=s.shadow_offset_x,
        shadow_offset_y=s.shadow_offset_y,
        line_spacing=s.line_spacing,
        caption_bottom_margin=s.caption_bottom_margin,
        user_id=s.user_id,
        config=config_data
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Fonts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/fonts/", response_model=List[FontResponse])
async def list_fonts(_: dict = Depends(get_current_user)):
    """List all fonts."""
    session = database.get_session()
    try:
        fonts = FontRepository(session).get_all()
        return [_font_to_response(f) for f in fonts]
    finally:
        session.close()


@router.get("/fonts/{font_id}", response_model=FontResponse)
async def get_font(font_id: int, _: dict = Depends(get_current_user)):
    """Get font by ID."""
    session = database.get_session()
    try:
        font = FontRepository(session).get_by_id(font_id)
        if not font:
            raise HTTPException(status_code=404, detail="Font not found")
        return _font_to_response(font)
    finally:
        session.close()


@router.post("/fonts/", response_model=FontResponse, status_code=201)
async def create_font(body: FontCreateModel, _: dict = Depends(require_admin)):
    """Create a new font (admin only)."""
    session = database.get_session()
    try:
        repo = FontRepository(session)
        font = repo.create({
            "name": body.name,
            "file_name": body.file_name,
            "download_url": body.download_url
        })
        return _font_to_response(font)
    finally:
        session.close()


@router.put("/fonts/{font_id}", response_model=FontResponse)
async def update_font(font_id: int, body: FontUpdateModel, _: dict = Depends(require_admin)):
    """Update font (admin only)."""
    session = database.get_session()
    try:
        repo = FontRepository(session)
        font = repo.update(font_id, body.model_dump(exclude_unset=True))
        if not font:
            raise HTTPException(status_code=404, detail="Font not found")
        return _font_to_response(font)
    finally:
        session.close()


@router.delete("/fonts/{font_id}")
async def delete_font(font_id: int, _: dict = Depends(require_admin)):
    """Delete font (admin only)."""
    session = database.get_session()
    try:
        repo = FontRepository(session)
        if not repo.delete(font_id):
            raise HTTPException(status_code=404, detail="Font not found")
        return {"status": "deleted", "font_id": font_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Hook Styles
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hook-styles/", response_model=List[HookStyleResponse])
async def list_hook_styles(_: dict = Depends(get_current_user)):
    """List all hook styles."""
    session = database.get_session()
    try:
        styles = HookStyleRepository(session).get_all()
        return [_hook_style_to_response(s) for s in styles]
    finally:
        session.close()


@router.get("/hook-styles/{style_id}", response_model=HookStyleResponse)
async def get_hook_style(style_id: int, _: dict = Depends(get_current_user)):
    """Get hook style by ID."""
    session = database.get_session()
    try:
        style = HookStyleRepository(session).get_by_id(style_id)
        if not style:
            raise HTTPException(status_code=404, detail="Hook style not found")
        return _hook_style_to_response(style)
    finally:
        session.close()


@router.post("/hook-styles/", response_model=HookStyleResponse, status_code=201)
async def create_hook_style(body: HookStyleCreateModel, _: dict = Depends(require_admin)):
    """Create a new hook style (admin only)."""
    session = database.get_session()
    try:
        style = HookStyleRepository(session).create({
            "name": body.name,
            "config": body.config,
            "is_active": body.is_active
        })
        return _hook_style_to_response(style)
    finally:
        session.close()


@router.put("/hook-styles/{style_id}", response_model=HookStyleResponse)
async def update_hook_style(style_id: int, body: HookStyleUpdateModel, _: dict = Depends(require_admin)):
    """Update hook style (admin only)."""
    session = database.get_session()
    try:
        repo = HookStyleRepository(session)
        style = repo.update(style_id, body.model_dump(exclude_unset=True))
        if not style:
            raise HTTPException(status_code=404, detail="Hook style not found")
        return _hook_style_to_response(style)
    finally:
        session.close()


@router.delete("/hook-styles/{style_id}")
async def delete_hook_style(style_id: int, _: dict = Depends(require_admin)):
    """Delete hook style (admin only)."""
    session = database.get_session()
    try:
        repo = HookStyleRepository(session)
        if not repo.delete(style_id):
            raise HTTPException(status_code=404, detail="Hook style not found")
        return {"status": "deleted", "style_id": style_id}
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
#  Caption Styles
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/caption-styles/", response_model=List[CaptionStyleResponse])
async def list_caption_styles(current: dict = Depends(get_current_user)):
    """List caption styles (global + user's own)."""
    session = database.get_session()
    try:
        repo = CaptionStyleRepository(session)
        user_id = int(current["sub"])
        is_admin = current.get("role") == "admin"
        styles = repo.get_all(user_id=user_id, is_admin=is_admin)
        return [_caption_style_to_response(s) for s in styles]
    finally:
        session.close()


@router.get("/caption-styles/{style_id}", response_model=CaptionStyleResponse)
async def get_caption_style(style_id: int, _: dict = Depends(get_current_user)):
    """Get caption style by ID."""
    session = database.get_session()
    try:
        style = CaptionStyleRepository(session).get_by_id(style_id)
        if not style:
            raise HTTPException(status_code=404, detail="Caption style not found")
        return _caption_style_to_response(style)
    finally:
        session.close()


@router.post("/caption-styles/", response_model=CaptionStyleResponse, status_code=201)
async def create_caption_style(body: CaptionStyleCreateModel, current: dict = Depends(get_current_user)):
    """Create a new caption style."""
    user_id = int(current["sub"])
    session = database.get_session()
    try:
        repo = CaptionStyleRepository(session)
        
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
        
        style = repo.create(data)
        return _caption_style_to_response(style)
    finally:
        session.close()


@router.put("/caption-styles/{style_id}", response_model=CaptionStyleResponse)
async def update_caption_style(
    style_id: int,
    body: CaptionStyleUpdateModel,
    current: dict = Depends(get_current_user)
):
    """Update caption style (owner or admin)."""
    user_id = int(current["sub"])
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = CaptionStyleRepository(session)
        update_data = body.model_dump(exclude_unset=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Resolve font_family if font_id is being updated
        if "font_id" in update_data and update_data["font_id"]:
            font = FontRepository(session).get_by_id(update_data["font_id"])
            if not font:
                raise HTTPException(status_code=400, detail=f"Font {update_data['font_id']} not found")
            update_data["font_family"] = font.name
        
        style = repo.update(style_id, update_data, user_id=user_id, is_admin=is_admin)
        if not style:
            raise HTTPException(status_code=404, detail="Caption style not found or access denied")
        return _caption_style_to_response(style)
    finally:
        session.close()


@router.delete("/caption-styles/{style_id}")
async def delete_caption_style(style_id: int, current: dict = Depends(get_current_user)):
    """Delete caption style (owner or admin)."""
    user_id = int(current["sub"])
    is_admin = current.get("role") == "admin"
    session = database.get_session()
    try:
        repo = CaptionStyleRepository(session)
        if not repo.delete(style_id, user_id=user_id, is_admin=is_admin):
            raise HTTPException(status_code=404, detail="Caption style not found or access denied")
        return {"status": "deleted", "style_id": style_id}
    finally:
        session.close()
