from sqlalchemy import Column, Integer, String, Text, JSON, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.sql import func

from src.infrastructure.database import Base


class KeyframeRegistryModel(Base):
    """Reusable animation keyframe templates — frame-by-frame transform data."""
    __tablename__ = "keyframe_registry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, default="general")
    fps = Column(Integer, nullable=False, default=30)
    duration_frames = Column(Integer, nullable=False)
    keyframes = Column(JSON, nullable=False)
    properties = Column(JSON, nullable=False)
    transform_origin = Column(String(30), nullable=False, default="center center")
    params_hash = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class CaptionTemplateModel(Base):
    """Caption overlay style configurations — font, color, highlight, animation refs."""
    __tablename__ = "caption_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, default="general")
    thumbnail_url = Column(String(500), nullable=True)
    style_type = Column(String(20), nullable=False, default="static")
    config = Column(JSON, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class HookTemplateModel(Base):
    """Hook overlay style configurations — multi-line text, box, decorations, animations."""
    __tablename__ = "hook_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, default="general")
    thumbnail_url = Column(String(500), nullable=True)
    style_type = Column(String(20), nullable=False, default="animated")
    config = Column(JSON, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())


class StyleCompositionModel(Base):
    """Pairs a caption template + hook template into a reusable style profile."""
    __tablename__ = "style_compositions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, default="general")
    thumbnail_url = Column(String(500), nullable=True)
    caption_template_id = Column(Integer, ForeignKey("caption_templates.id", ondelete="SET NULL"), nullable=True)
    hook_template_id = Column(Integer, ForeignKey("hook_templates.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    use_count = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
