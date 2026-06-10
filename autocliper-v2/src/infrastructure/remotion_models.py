"""
SQLAlchemy Models untuk Remotion Template System
Tabel: remotion_caption_templates, remotion_hook_templates,
       remotion_compositions, remotion_render_jobs
"""
from sqlalchemy import (
    Column, Integer, String, Float, Text, JSON, Boolean,
    TIMESTAMP, ForeignKey, Index
)
from sqlalchemy.sql import func
from .database import Base


class RemotionCaptionTemplateModel(Base):
    __tablename__ = "remotion_caption_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default=None)
    category = Column(String(50), default="general")
    remotion_component = Column(String(100), nullable=False, default="KaraokeCaption")
    thumbnail_url = Column(String(500), default=None)
    preview_css = Column(Text, default=None)

    # Font
    font_family = Column(String(100), nullable=False, default="Inter")
    font_weight = Column(String(20), nullable=False, default="700")
    font_size = Column(Integer, nullable=False, default=48)
    letter_spacing = Column(Float, default=0)
    text_transform = Column(String(20), default="none")
    line_height = Column(Float, default=1.3)

    # Colors
    color = Column(String(20), nullable=False, default="#FFFFFF")
    highlight_color = Column(String(20), nullable=False, default="#FFD700")
    highlight_style = Column(String(30), nullable=False, default="color")

    # Background
    bg_enabled = Column(Boolean, default=False)
    bg_color = Column(String(20), default="#000000")
    bg_opacity = Column(Float, default=0.7)
    bg_padding_x = Column(Integer, default=12)
    bg_padding_y = Column(Integer, default=6)
    bg_border_radius = Column(Integer, default=8)
    bg_per_word = Column(Boolean, default=False)

    # Outline
    outline_enabled = Column(Boolean, default=True)
    outline_color = Column(String(20), default="#000000")
    outline_width = Column(Integer, default=2)

    # Shadow
    shadow_enabled = Column(Boolean, default=True)
    shadow_color = Column(String(20), default="#000000")
    shadow_blur = Column(Integer, default=4)
    shadow_offset_x = Column(Integer, default=0)
    shadow_offset_y = Column(Integer, default=2)

    # Position
    position_y = Column(String(20), nullable=False, default="bottom")
    position_y_offset = Column(Integer, default=80)
    max_words_per_line = Column(Integer, default=4)
    max_lines = Column(Integer, default=2)

    # Animation
    animation_in = Column(String(30), default="fade")
    animation_out = Column(String(30), default="fade")
    animation_in_duration = Column(Integer, default=200)
    animation_out_duration = Column(Integer, default=150)
    highlight_transition = Column(String(30), default="instant")
    highlight_transition_duration = Column(Integer, default=100)

    # Display mode: word_by_word, phrase, sentence
    display_mode = Column(String(20), nullable=False, default="phrase")

    # Extended
    config = Column(JSON, default=None)

    # Metadata
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=None)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class RemotionHookTemplateModel(Base):
    __tablename__ = "remotion_hook_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default=None)
    category = Column(String(50), default="general")
    remotion_component = Column(String(100), nullable=False, default="HookOverlay")
    thumbnail_url = Column(String(500), default=None)
    preview_css = Column(Text, default=None)

    # Font
    font_family = Column(String(100), nullable=False, default="Anton")
    font_weight = Column(String(20), nullable=False, default="400")
    font_size_normal = Column(Integer, nullable=False, default=36)
    font_size_keyword = Column(Integer, nullable=False, default=56)
    letter_spacing = Column(Float, default=0)
    text_transform = Column(String(20), default="uppercase")

    # Colors
    color = Column(String(20), nullable=False, default="#FFFFFF")
    keyword_color = Column(String(20), nullable=False, default="#FFFFFF")

    # Box
    box_enabled = Column(Boolean, default=False)
    box_color = Column(String(20), default="#000000")
    box_opacity = Column(Float, default=0.6)
    box_padding = Column(Integer, default=20)
    box_border_radius = Column(Integer, default=12)
    box_border_color = Column(String(20), default=None)
    box_border_width = Column(Integer, default=0)

    # Keyword background
    keyword_bg_enabled = Column(Boolean, default=False)
    keyword_bg_color = Column(String(20), default="#FF0000")
    keyword_bg_opacity = Column(Float, default=0.8)
    keyword_bg_padding_x = Column(Integer, default=8)
    keyword_bg_padding_y = Column(Integer, default=4)
    keyword_bg_border_radius = Column(Integer, default=6)

    # Keyword underline
    keyword_underline_enabled = Column(Boolean, default=True)
    keyword_underline_color = Column(String(20), default="#FFFFFF")
    keyword_underline_thickness = Column(Integer, default=3)
    keyword_underline_offset = Column(Integer, default=8)

    # Shadow
    shadow_enabled = Column(Boolean, default=True)
    shadow_color = Column(String(20), default="#000000")
    shadow_blur = Column(Integer, default=12)
    shadow_offset_y = Column(Integer, default=3)

    # Glow
    glow_enabled = Column(Boolean, default=False)
    glow_color = Column(String(20), default="#FFFFFF")
    glow_radius = Column(Integer, default=8)
    glow_keyword_only = Column(Boolean, default=True)

    # Outline
    outline_enabled = Column(Boolean, default=False)
    outline_color = Column(String(20), default="#000000")
    outline_width = Column(Integer, default=2)

    # Gradient
    gradient_enabled = Column(Boolean, default=False)
    gradient_colors = Column(JSON, default=None)
    gradient_direction = Column(String(20), default="to right")

    # Position
    position_x = Column(String(20), nullable=False, default="center")
    position_y = Column(String(20), nullable=False, default="center")
    position_y_offset = Column(Integer, default=0)

    # Animation
    animation_type = Column(String(30), default="fade")
    animation_in_duration = Column(Integer, default=300)
    animation_out_duration = Column(Integer, default=300)
    scale_from = Column(Float, default=0.8)

    # Timing
    display_duration_seconds = Column(Float, default=3.0)
    delay_before_seconds = Column(Float, default=0.5)

    # Extended
    config = Column(JSON, default=None)

    # Metadata
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=None)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class RemotionCompositionModel(Base):
    __tablename__ = "remotion_compositions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, default=None)
    thumbnail_url = Column(String(500), default=None)
    category = Column(String(50), default="general")

    caption_template_id = Column(Integer, ForeignKey("remotion_caption_templates.id", ondelete="SET NULL"), default=None)
    hook_template_id = Column(Integer, ForeignKey("remotion_hook_templates.id", ondelete="SET NULL"), default=None)

    fps = Column(Integer, nullable=False, default=30)
    width = Column(Integer, nullable=False, default=1080)
    height = Column(Integer, nullable=False, default=1920)
    codec = Column(String(20), nullable=False, default="h264")
    crf = Column(Integer, default=18)
    pixel_format = Column(String(20), default="yuv420p")
    overlay_config = Column(JSON, default=None)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=None)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    use_count = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class RemotionRenderJobModel(Base):
    __tablename__ = "remotion_render_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_log_id = Column(Integer, ForeignKey("request_log.id", ondelete="CASCADE"), nullable=False)
    clip_index = Column(Integer, nullable=False)
    composition_id = Column(Integer, ForeignKey("remotion_compositions.id", ondelete="SET NULL"), default=None)
    caption_template_id = Column(Integer, ForeignKey("remotion_caption_templates.id", ondelete="SET NULL"), default=None)
    hook_template_id = Column(Integer, ForeignKey("remotion_hook_templates.id", ondelete="SET NULL"), default=None)

    input_video_path = Column(String(500), nullable=False)
    metadata_path = Column(String(500), default=None)
    hook_text = Column(Text, default=None)
    subtitle_data = Column(JSON, default=None)
    output_video_path = Column(String(500), default=None)

    status = Column(String(30), nullable=False, default="pending")
    progress_percent = Column(Integer, default=0)
    render_time_ms = Column(Integer, default=None)
    error_message = Column(Text, default=None)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=2)

    queued_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    started_at = Column(TIMESTAMP, default=None)
    completed_at = Column(TIMESTAMP, default=None)
