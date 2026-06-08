"""
Pydantic Schemas untuk Remotion Template API
"""
from typing import Optional, Any, List
from pydantic import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
#  Caption Template
# ─────────────────────────────────────────────────────────────────────────────

class CaptionTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str = "general"
    remotion_component: str = "KaraokeCaption"
    thumbnail_url: Optional[str] = None

    font_family: str
    font_weight: str
    font_size: int
    letter_spacing: float = 0
    text_transform: str = "none"
    line_height: float = 1.3

    color: str
    highlight_color: str
    highlight_style: str

    bg_enabled: bool = False
    bg_color: str = "#000000"
    bg_opacity: float = 0.7
    bg_padding_x: int = 12
    bg_padding_y: int = 6
    bg_border_radius: int = 8
    bg_per_word: bool = False

    outline_enabled: bool = True
    outline_color: str = "#000000"
    outline_width: int = 2

    shadow_enabled: bool = True
    shadow_color: str = "#000000"
    shadow_blur: int = 4
    shadow_offset_x: int = 0
    shadow_offset_y: int = 2

    position_y: str = "bottom"
    position_y_offset: int = 80
    max_words_per_line: int = 4
    max_lines: int = 2

    animation_in: str = "fade"
    animation_out: str = "fade"
    animation_in_duration: int = 200
    animation_out_duration: int = 150
    highlight_transition: str = "instant"
    highlight_transition_duration: int = 100

    config: Optional[Any] = None

    user_id: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    sort_order: int = 0


class CaptionTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "general"
    remotion_component: Optional[str] = "KaraokeCaption"

    font_family: Optional[str] = "Inter"
    font_weight: Optional[str] = "700"
    font_size: Optional[int] = 48
    letter_spacing: Optional[float] = 0
    text_transform: Optional[str] = "none"

    color: Optional[str] = "#FFFFFF"
    highlight_color: Optional[str] = "#FFD700"
    highlight_style: Optional[str] = "color"

    bg_enabled: Optional[bool] = False
    bg_color: Optional[str] = "#000000"
    bg_opacity: Optional[float] = 0.7
    bg_padding_x: Optional[int] = 12
    bg_padding_y: Optional[int] = 6
    bg_border_radius: Optional[int] = 8
    bg_per_word: Optional[bool] = False

    outline_enabled: Optional[bool] = True
    outline_color: Optional[str] = "#000000"
    outline_width: Optional[int] = 2

    shadow_enabled: Optional[bool] = True
    shadow_color: Optional[str] = "#000000"
    shadow_blur: Optional[int] = 4
    shadow_offset_y: Optional[int] = 2

    position_y: Optional[str] = "bottom"
    position_y_offset: Optional[int] = 80
    max_words_per_line: Optional[int] = 4

    animation_in: Optional[str] = "fade"
    animation_out: Optional[str] = "fade"
    animation_in_duration: Optional[int] = 200
    highlight_transition: Optional[str] = "instant"

    config: Optional[Any] = None


class CaptionTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    font_family: Optional[str] = None
    font_weight: Optional[str] = None
    font_size: Optional[int] = None
    color: Optional[str] = None
    highlight_color: Optional[str] = None
    highlight_style: Optional[str] = None
    bg_enabled: Optional[bool] = None
    bg_color: Optional[str] = None
    bg_opacity: Optional[float] = None
    outline_enabled: Optional[bool] = None
    outline_color: Optional[str] = None
    outline_width: Optional[int] = None
    shadow_enabled: Optional[bool] = None
    shadow_color: Optional[str] = None
    shadow_blur: Optional[int] = None
    position_y: Optional[str] = None
    position_y_offset: Optional[int] = None
    animation_in: Optional[str] = None
    animation_out: Optional[str] = None
    config: Optional[Any] = None
    is_active: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Hook Template
# ─────────────────────────────────────────────────────────────────────────────

class HookTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str = "general"
    remotion_component: str = "HookOverlay"
    thumbnail_url: Optional[str] = None

    font_family: str
    font_weight: str
    font_size_normal: int
    font_size_keyword: int
    letter_spacing: float = 0
    text_transform: str = "uppercase"

    color: str
    keyword_color: str

    box_enabled: bool = False
    box_color: str = "#000000"
    box_opacity: float = 0.6
    box_padding: int = 20
    box_border_radius: int = 12

    keyword_bg_enabled: bool = False
    keyword_bg_color: str = "#FF0000"
    keyword_bg_opacity: float = 0.8

    keyword_underline_enabled: bool = True
    keyword_underline_color: str = "#FFFFFF"
    keyword_underline_thickness: int = 3

    shadow_enabled: bool = True
    shadow_color: str = "#000000"
    shadow_blur: int = 12
    shadow_offset_y: int = 3

    glow_enabled: bool = False
    glow_color: str = "#FFFFFF"
    glow_radius: int = 8

    outline_enabled: bool = False
    outline_color: str = "#000000"
    outline_width: int = 2

    gradient_enabled: bool = False
    gradient_colors: Optional[Any] = None
    gradient_direction: str = "to right"

    position_x: str = "center"
    position_y: str = "center"
    position_y_offset: int = 0

    animation_type: str = "fade"
    animation_in_duration: int = 300
    display_duration_seconds: float = 3.0
    delay_before_seconds: float = 0.5

    config: Optional[Any] = None

    user_id: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    sort_order: int = 0


class HookTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "general"
    remotion_component: Optional[str] = "HookOverlay"

    font_family: Optional[str] = "Anton"
    font_weight: Optional[str] = "400"
    font_size_normal: Optional[int] = 36
    font_size_keyword: Optional[int] = 56
    text_transform: Optional[str] = "uppercase"

    color: Optional[str] = "#FFFFFF"
    keyword_color: Optional[str] = "#FFFFFF"

    shadow_enabled: Optional[bool] = True
    shadow_color: Optional[str] = "#000000"
    shadow_blur: Optional[int] = 12

    animation_type: Optional[str] = "fade"
    animation_in_duration: Optional[int] = 300
    display_duration_seconds: Optional[float] = 3.0

    config: Optional[Any] = None


class HookTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    font_family: Optional[str] = None
    font_size_normal: Optional[int] = None
    font_size_keyword: Optional[int] = None
    color: Optional[str] = None
    keyword_color: Optional[str] = None
    shadow_enabled: Optional[bool] = None
    animation_type: Optional[str] = None
    display_duration_seconds: Optional[float] = None
    config: Optional[Any] = None
    is_active: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Composition
# ─────────────────────────────────────────────────────────────────────────────

class CompositionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category: str = "general"

    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None

    fps: int = 30
    width: int = 1080
    height: int = 1920
    codec: str = "h264"
    crf: int = 18

    overlay_config: Optional[Any] = None

    user_id: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    use_count: int = 0
    sort_order: int = 0

    # Nested template info (populated in route)
    caption_template: Optional[CaptionTemplateResponse] = None
    hook_template: Optional[HookTemplateResponse] = None


class CompositionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = "general"
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    fps: Optional[int] = 30
    width: Optional[int] = 1080
    height: Optional[int] = 1920
    codec: Optional[str] = "h264"
    crf: Optional[int] = 18
    overlay_config: Optional[Any] = None


class CompositionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    fps: Optional[int] = None
    codec: Optional[str] = None
    crf: Optional[int] = None
    overlay_config: Optional[Any] = None
    is_active: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Render Job
# ─────────────────────────────────────────────────────────────────────────────

class RenderJobResponse(BaseModel):
    id: int
    request_log_id: int
    clip_index: int
    composition_id: Optional[int] = None
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None

    input_video_path: str
    output_video_path: Optional[str] = None
    hook_text: Optional[str] = None

    status: str
    progress_percent: int = 0
    render_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    retry_count: int = 0

    queued_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class RenderJobCreate(BaseModel):
    request_log_id: int
    clip_index: int
    composition_id: Optional[int] = None
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    input_video_path: str
    metadata_path: Optional[str] = None
    hook_text: Optional[str] = None
    subtitle_data: Optional[Any] = None


class RenderJobStats(BaseModel):
    pending: int = 0
    rendering: int = 0
    completed: int = 0
    failed: int = 0
    cancelled: int = 0
    total: int = 0
