"""
Pydantic v2 Schemas untuk Keyframe Animation System API

Covers all 4 resource types:
- Keyframe Registry (reusable animation templates)
- Caption Templates (caption overlay styles)
- Hook Templates (hook overlay styles)
- Style Compositions (paired caption + hook)

Includes config JSON validation with nested models, list query params,
and 422 error response with field-level details.
"""
from datetime import datetime
from typing import Optional, List, Literal, Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ─────────────────────────────────────────────────────────────────────────────
#  Shared / Common Schemas
# ─────────────────────────────────────────────────────────────────────────────

VALID_TRANSFORM_PROPERTIES = {"scale", "opacity", "x", "y", "rotation"}


class ValidationErrorDetail(BaseModel):
    """Single field-level validation error."""
    field: str
    message: str


class ErrorResponse(BaseModel):
    """Standard 422 error response with field-level details."""
    success: bool = False
    error: str
    details: Optional[List[ValidationErrorDetail]] = None


class ListQueryParams(BaseModel):
    """Query parameters for paginated list endpoints."""
    category: Optional[str] = None
    style_type: Optional[str] = None
    is_active: bool = True
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper."""
    items: List[Any]
    total: int
    page: int
    per_page: int
    total_pages: int


# ─────────────────────────────────────────────────────────────────────────────
#  Keyframe Registry Schemas
# ─────────────────────────────────────────────────────────────────────────────

class KeyframeFrameObject(BaseModel):
    """Single frame in the keyframes array."""
    frame: int = Field(..., ge=0)
    scale: Optional[float] = None
    opacity: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    rotation: Optional[float] = None

    model_config = {"extra": "allow"}


class KeyframeCreate(BaseModel):
    """Request body for creating a keyframe registry entry."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    category: str = Field(default="general", max_length=50)
    fps: int = Field(default=30, ge=1, le=120)
    duration_frames: int = Field(..., ge=1)
    keyframes: List[KeyframeFrameObject] = Field(..., min_length=1)
    properties: List[str] = Field(..., min_length=1)
    transform_origin: str = Field(default="center center", max_length=30)
    params_hash: str = Field(..., min_length=1, max_length=64)

    @field_validator("properties")
    @classmethod
    def validate_properties(cls, v: List[str]) -> List[str]:
        invalid = set(v) - VALID_TRANSFORM_PROPERTIES
        if invalid:
            raise ValueError(
                f"Invalid properties: {invalid}. "
                f"Must be subset of {VALID_TRANSFORM_PROPERTIES}"
            )
        return v

    @field_validator("keyframes")
    @classmethod
    def validate_keyframes(cls, v: List[KeyframeFrameObject]) -> List[KeyframeFrameObject]:
        if not v:
            raise ValueError("keyframes must contain at least one frame object")
        for i, frame_obj in enumerate(v):
            if frame_obj.frame < 0:
                raise ValueError(f"keyframes[{i}].frame must be >= 0")
        return v


class KeyframeUpdate(BaseModel):
    """Request body for updating a keyframe registry entry (all optional)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)
    fps: Optional[int] = Field(default=None, ge=1, le=120)
    duration_frames: Optional[int] = Field(default=None, ge=1)
    keyframes: Optional[List[KeyframeFrameObject]] = None
    properties: Optional[List[str]] = None
    transform_origin: Optional[str] = Field(default=None, max_length=30)
    params_hash: Optional[str] = Field(default=None, max_length=64)
    is_active: Optional[bool] = None

    @field_validator("properties")
    @classmethod
    def validate_properties(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        invalid = set(v) - VALID_TRANSFORM_PROPERTIES
        if invalid:
            raise ValueError(
                f"Invalid properties: {invalid}. "
                f"Must be subset of {VALID_TRANSFORM_PROPERTIES}"
            )
        return v

    @field_validator("keyframes")
    @classmethod
    def validate_keyframes(
        cls, v: Optional[List[KeyframeFrameObject]]
    ) -> Optional[List[KeyframeFrameObject]]:
        if v is None:
            return v
        if len(v) == 0:
            raise ValueError("keyframes must contain at least one frame object")
        return v


class KeyframeResponse(BaseModel):
    """Response body for a keyframe registry entry."""
    id: int
    name: str
    description: Optional[str] = None
    category: str = "general"
    fps: int = 30
    duration_frames: int
    keyframes: List[KeyframeFrameObject]
    properties: List[str]
    transform_origin: str = "center center"
    params_hash: str
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Caption Template Config — Nested Models
# ─────────────────────────────────────────────────────────────────────────────

class FontConfig(BaseModel):
    """Caption template font configuration."""
    family: str = Field(..., min_length=1)
    weight: str = Field(default="700")
    size: int = Field(..., ge=8, le=200)
    letter_spacing: float = Field(default=0)
    line_height: float = Field(default=1.3)
    text_transform: Literal["none", "uppercase", "lowercase"] = "none"

    model_config = {"extra": "allow"}


class ColorsConfig(BaseModel):
    """Caption template colors configuration."""
    primary: str = Field(..., min_length=1)
    secondary: Optional[str] = None
    background: Optional[str] = None

    model_config = {"extra": "allow"}


class HighlightConfig(BaseModel):
    """Caption template highlight configuration."""
    color: str = Field(..., min_length=1)
    style: Literal["color", "background", "glow", "scale", "underline"] = "color"
    transition: Literal["instant", "smooth", "bounce"] = "instant"
    transition_duration_ms: int = Field(default=100, ge=50, le=500)

    model_config = {"extra": "allow"}


class BackgroundConfig(BaseModel):
    """Caption template background configuration."""
    enabled: bool = False
    color: Optional[str] = None
    opacity: Optional[float] = Field(default=None, ge=0, le=1)
    padding_x: Optional[int] = None
    padding_y: Optional[int] = None
    border_radius: Optional[int] = None
    per_word: Optional[bool] = None

    model_config = {"extra": "allow"}


class OutlineConfig(BaseModel):
    """Caption template outline configuration."""
    enabled: bool = False
    color: Optional[str] = None
    width: Optional[int] = Field(default=None, ge=0, le=20)

    model_config = {"extra": "allow"}


class ShadowConfig(BaseModel):
    """Caption template shadow configuration."""
    enabled: bool = False
    color: Optional[str] = None
    blur: Optional[int] = Field(default=None, ge=0)
    offset_x: Optional[int] = None
    offset_y: Optional[int] = None

    model_config = {"extra": "allow"}


class PositionConfig(BaseModel):
    """Shared position configuration."""
    x: Optional[str] = None
    y: Optional[str] = None
    y_offset: Optional[int] = None

    model_config = {"extra": "allow"}


class DisplayConfig(BaseModel):
    """Caption template display configuration."""
    max_lines: int = Field(default=2, ge=1, le=3)
    max_line_width_percent: float = Field(default=80, ge=50, le=100)
    overflow_behavior: Literal["wrap", "truncate", "scale_down"] = "wrap"
    words_per_segment: int = Field(default=5, ge=3, le=10)

    model_config = {"extra": "allow"}


class CaptionAnimationConfig(BaseModel):
    """Caption template animation configuration."""
    entrance_keyframe_id: Optional[int] = None
    exit_keyframe_id: Optional[int] = None
    highlight_keyframe_id: Optional[int] = None
    transform_origin: Optional[str] = None

    model_config = {"extra": "allow"}


class CaptionConfigSchema(BaseModel):
    """Complete caption template config JSON structure."""
    font: FontConfig
    colors: ColorsConfig
    highlight: HighlightConfig
    background: Optional[BackgroundConfig] = None
    outline: Optional[OutlineConfig] = None
    shadow: Optional[ShadowConfig] = None
    position: Optional[PositionConfig] = None
    display: Optional[DisplayConfig] = None
    animation: Optional[CaptionAnimationConfig] = None

    model_config = {"extra": "allow"}


# ─────────────────────────────────────────────────────────────────────────────
#  Caption Template Schemas
# ─────────────────────────────────────────────────────────────────────────────

class CaptionTemplateCreate(BaseModel):
    """Request body for creating a caption template."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    category: str = Field(default="general", max_length=50)
    style_type: Literal["animated", "static"] = "animated"
    config: CaptionConfigSchema
    user_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_static_no_animation(self):
        """If style_type is static, animation should be null or have no keyframe IDs."""
        if self.style_type == "static" and self.config.animation is not None:
            anim = self.config.animation
            if any([
                anim.entrance_keyframe_id,
                anim.exit_keyframe_id,
                anim.highlight_keyframe_id
            ]):
                raise ValueError(
                    "Static style_type cannot have keyframe ID references in animation config"
                )
        return self


class CaptionTemplateUpdate(BaseModel):
    """Request body for updating a caption template (all optional)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)
    style_type: Optional[Literal["animated", "static"]] = None
    config: Optional[CaptionConfigSchema] = None
    user_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)


class CaptionTemplateResponse(BaseModel):
    """Response body for a caption template."""
    id: int
    name: str
    description: Optional[str] = None
    category: str = "general"
    thumbnail_url: Optional[str] = None
    style_type: str = "animated"
    config: Any
    user_id: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Hook Template Config — Nested Models
# ─────────────────────────────────────────────────────────────────────────────

class DefaultFontConfig(BaseModel):
    """Hook template default font configuration."""
    family: str = Field(..., min_length=1)
    weight: str = Field(default="700")
    size: int = Field(default=48, ge=8, le=200)
    color: str = Field(default="#FFFFFF")
    letter_spacing: float = Field(default=0)

    model_config = {"extra": "allow"}


class HookLineStyle(BaseModel):
    """Single line style override in hook text config."""
    font_family: Optional[str] = None
    font_size: Optional[int] = Field(default=None, ge=8, le=200)
    font_weight: Optional[str] = None
    color: Optional[str] = None
    letter_spacing: Optional[float] = None
    text_transform: Optional[str] = None

    model_config = {"extra": "allow"}


class HookTextConfig(BaseModel):
    """Hook template text configuration."""
    lines: List[HookLineStyle] = Field(default_factory=list, max_length=6)
    default_font: DefaultFontConfig

    model_config = {"extra": "allow"}

    @field_validator("lines")
    @classmethod
    def validate_lines_max(cls, v: List[HookLineStyle]) -> List[HookLineStyle]:
        if len(v) > 6:
            raise ValueError("lines array cannot exceed 6 entries")
        return v


class HookBoxConfig(BaseModel):
    """Hook template box/background configuration."""
    enabled: bool = False
    color: Optional[str] = None
    opacity: Optional[float] = Field(default=None, ge=0, le=1)
    padding: Optional[int] = None
    border_radius: Optional[int] = None

    model_config = {"extra": "allow"}


class HookPerLineAnimation(BaseModel):
    """Per-line animation entry for hook templates."""
    keyframe_id: Optional[int] = None
    delay_ms: int = Field(default=0, ge=0, le=5000)
    transform_origin: Optional[str] = None

    model_config = {"extra": "allow"}


class HookAnimationConfig(BaseModel):
    """Hook template animation configuration."""
    entrance_keyframe_id: Optional[int] = None
    transform_origin: Optional[str] = None
    per_line: List[HookPerLineAnimation] = Field(default_factory=list)

    model_config = {"extra": "allow"}


class HookTimingConfig(BaseModel):
    """Hook template timing configuration."""
    display_duration_seconds: float = Field(default=3.0, ge=1.0, le=10.0)
    delay_before_seconds: float = Field(default=0.5, ge=0, le=5.0)

    model_config = {"extra": "allow"}


class DividerDecoration(BaseModel):
    """Hook divider decoration."""
    enable: bool = False
    colors: Optional[List[str]] = None
    width: Optional[int] = None
    height: Optional[int] = None
    keyframe_id: Optional[int] = None

    model_config = {"extra": "allow"}


class EmojiRowDecoration(BaseModel):
    """Hook emoji row decoration."""
    enable: bool = False
    emojis: List[str] = Field(default_factory=list, max_length=10)
    keyframe_id: Optional[int] = None

    model_config = {"extra": "allow"}

    @field_validator("emojis")
    @classmethod
    def validate_emojis_max(cls, v: List[str]) -> List[str]:
        if len(v) > 10:
            raise ValueError("emojis array cannot exceed 10 entries")
        return v


class BadgeDecoration(BaseModel):
    """Hook badge decoration."""
    enable: bool = False
    text: Optional[str] = Field(default=None, max_length=30)
    bg_color: Optional[str] = None
    font_size: Optional[int] = None
    keyframe_id: Optional[int] = None

    model_config = {"extra": "allow"}


class HookDecorationsConfig(BaseModel):
    """Hook template decorations configuration."""
    divider: Optional[DividerDecoration] = None
    emoji_row: Optional[EmojiRowDecoration] = None
    badge: Optional[BadgeDecoration] = None

    model_config = {"extra": "allow"}


class HookConfigSchema(BaseModel):
    """Complete hook template config JSON structure."""
    text: HookTextConfig
    box: Optional[HookBoxConfig] = None
    position: Optional[PositionConfig] = None
    animation: Optional[HookAnimationConfig] = None
    decorations: Optional[HookDecorationsConfig] = None
    effects: Optional[Any] = None  # Reserved for future (flash, particles)
    overlay: Optional[Any] = None  # Reserved for future (gradient_top, gradient_bottom)
    timing: Optional[HookTimingConfig] = None

    model_config = {"extra": "allow"}


# ─────────────────────────────────────────────────────────────────────────────
#  Hook Template Schemas
# ─────────────────────────────────────────────────────────────────────────────

class HookTemplateCreate(BaseModel):
    """Request body for creating a hook template."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    category: str = Field(default="general", max_length=50)
    style_type: Literal["animated", "static"] = "animated"
    config: HookConfigSchema
    user_id: Optional[int] = None


class HookTemplateUpdate(BaseModel):
    """Request body for updating a hook template (all optional)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)
    style_type: Optional[Literal["animated", "static"]] = None
    config: Optional[HookConfigSchema] = None
    user_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)


class HookTemplateResponse(BaseModel):
    """Response body for a hook template."""
    id: int
    name: str
    description: Optional[str] = None
    category: str = "general"
    thumbnail_url: Optional[str] = None
    style_type: str = "animated"
    config: Any
    user_id: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Style Composition Schemas
# ─────────────────────────────────────────────────────────────────────────────

class StyleCompositionCreate(BaseModel):
    """Request body for creating a style composition."""
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    category: str = Field(default="general", max_length=50)
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    user_id: Optional[int] = None


class StyleCompositionUpdate(BaseModel):
    """Request body for updating a style composition (all optional)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    user_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)


class StyleCompositionResponse(BaseModel):
    """Response body for a style composition."""
    id: int
    name: str
    description: Optional[str] = None
    category: str = "general"
    thumbnail_url: Optional[str] = None
    caption_template_id: Optional[int] = None
    hook_template_id: Optional[int] = None
    user_id: Optional[int] = None
    is_active: bool = True
    is_default: bool = False
    use_count: int = 0
    sort_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
