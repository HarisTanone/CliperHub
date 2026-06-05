"""
Style Schemas - Fonts, Hook Styles, Caption Styles
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any


# ─── Font ────────────────────────────────────────────────────────────────────

class FontResponse(BaseModel):
    id: int
    name: str
    file_name: str
    download_url: Optional[str] = None
    created_at: Optional[str] = None


class FontCreateModel(BaseModel):
    name: str
    file_name: str
    download_url: Optional[str] = None


class FontUpdateModel(BaseModel):
    name: Optional[str] = None
    file_name: Optional[str] = None
    download_url: Optional[str] = None


# ─── Hook Style ──────────────────────────────────────────────────────────────

class HookStyleResponse(BaseModel):
    id: int
    name: str
    config: Dict[str, Any]
    is_active: bool = True
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


# ─── Caption Style ───────────────────────────────────────────────────────────

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
