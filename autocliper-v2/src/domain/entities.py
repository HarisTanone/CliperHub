from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from enum import Enum
import json


class ProcessingState(Enum):
    """Processing status enum"""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    ANALYZING = "analyzing"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Font:
    id: int
    name: str
    file_name: str
    download_url: str
    created_at: Optional[datetime] = None


@dataclass
class HookStyle:
    id: int
    name: str
    config: dict = field(default_factory=dict)
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def get_config(self) -> dict:
        """Return config with defaults merged in (deep merge, no hardcode in renderer)."""
        defaults = {
            "text": {
                "fontfile": "",
                "fallback_font": "Anton",
                "font_size_normal": 36,
                "font_size_keyword": 56,
                "color": "#FFFFFF",
                "keyword_color": "#FFFFFF",
                "line_spacing": 10,
                "word_spacing": 12,
                "padding_horizontal": 80,
                "text_transform": "uppercase",  # uppercase, lowercase, capitalize, none
                "letter_spacing": 0,  # extra pixels between characters
            },
            "shadow": {
                "enable": True,
                "color": "#000000",
                "opacity": 200,
                "blur": 12,
                "alpha_multiplier": 0.3,
                "offset_y": 3,
            },
            "glow": {
                "enable": False,
                "color": "#FFFFFF",
                "opacity": 120,
                "radius": 8,
                "keyword_only": True,  # only glow on keywords
            },
            "outline": {
                "enable": False,
                "color": "#000000",
                "width": 2,
                "keyword_only": False,
            },
            "keyword": {
                "underline": {
                    "color": "#FFFFFF",
                    "opacity": 180,
                    "thickness": 3,
                    "offset_y": 8,
                },
                "background": {
                    "enable": False,
                    "color": "#000000",
                    "opacity": 150,
                    "padding_x": 8,
                    "padding_y": 4,
                    "border_radius": 6,
                },
                "scale": 1.0,  # scale factor for keywords (1.0 = normal, 1.2 = 20% bigger)
            },
            "position": {"x": "(w-text_w)/2", "y": "(h-text_h)/2"},
            "box": {"enable": False, "color": "#000000", "opacity": 128, "padding": 10,
                    "border_radius": 0, "border_color": "", "border_width": 0},
            "animation": {
                "fade_in": 0.3,
                "fade_out": 0.3,
                "type": "fade",  # fade, scale_up, slide_up, typewriter, bounce
                "scale_from": 0.8,  # for scale_up animation
                "slide_distance": 50,  # pixels for slide_up
            },
        }
        cfg = self.config or {}

        def _deep_merge(base: dict, override: dict) -> dict:
            result = dict(base)
            for k, v in override.items():
                if k in result and isinstance(result[k], dict) and isinstance(v, dict):
                    result[k] = _deep_merge(result[k], v)
                else:
                    result[k] = v
            return result

        return _deep_merge(defaults, cfg)


@dataclass
class CaptionStyle:
    id: int
    name: str
    font_id: Optional[int] = None
    font_family: str = "Arial"
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
    caption_bottom_margin: int = 60
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    # Extended style config (JSON in DB, merged with defaults here)
    config: dict = field(default_factory=dict)
    
    def get_extended_config(self) -> dict:
        """Get extended caption config with defaults for new features."""
        defaults = {
            "highlight": {
                "style": "color",  # color, background, scale, glow
                "background_color": "#FFD700",
                "background_opacity": 200,
                "background_padding_x": 6,
                "background_padding_y": 3,
                "background_radius": 4,
                "scale_factor": 1.15,  # for scale highlight style
                "glow_color": "#FFD700",
                "glow_radius": 6,
                "glow_opacity": 150,
                "transition": "instant",  # instant, smooth (smooth = 100ms blend)
            },
            "text_transform": "none",  # uppercase, lowercase, capitalize, none
            "letter_spacing": 0,
            "shadow_blur": 0,  # 0 = sharp shadow, >0 = blurred
            "animation": {
                "chunk_enter": "none",  # none, fade_up, pop, slide_left
                "chunk_exit": "none",  # none, fade_out
                "enter_duration": 0.15,  # seconds
                "exit_duration": 0.1,
            },
            "background_pill": {
                "enable": False,
                "color": "#000000",
                "opacity": 160,
                "padding_x": 16,
                "padding_y": 8,
                "border_radius": 12,
                "per_line": True,  # True = pill per line, False = one big pill
            },
        }
        cfg = self.config or {}
        
        def _deep_merge(base: dict, override: dict) -> dict:
            result = dict(base)
            for k, v in override.items():
                if k in result and isinstance(result[k], dict) and isinstance(v, dict):
                    result[k] = _deep_merge(result[k], v)
                else:
                    result[k] = v
            return result
        
        return _deep_merge(defaults, cfg)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for rendering"""
        return {
            "font_family": self.font_family,
            "font_weight": self.font_weight,
            "font_size": self.font_size,
            "color": self.color,
            "highlight_color": self.highlight_color,
            "outline_color": self.outline_color,
            "outline_width": self.outline_width,
            "shadow_color": self.shadow_color,
            "shadow_offset_x": self.shadow_offset_x,
            "shadow_offset_y": self.shadow_offset_y,
            "line_spacing": self.line_spacing,
            "caption_bottom_margin": self.caption_bottom_margin
        }


@dataclass
class ClipScores:
    """Multi-dimensional scoring for clip virality analysis"""
    viral_score: float = 0.0
    curiosity_score: float = 0.0
    emotion_score: float = 0.0
    controversy_score: float = 0.0
    story_score: float = 0.0
    
    @property
    def final_score(self) -> float:
        """Weighted final score calculation"""
        return (
            self.viral_score * 0.35 +
            self.curiosity_score * 0.25 +
            self.story_score * 0.20 +
            self.emotion_score * 0.10 +
            self.controversy_score * 0.10
        )
    
    def to_dict(self) -> dict:
        return {
            "viral_score": self.viral_score,
            "curiosity_score": self.curiosity_score,
            "emotion_score": self.emotion_score,
            "controversy_score": self.controversy_score,
            "story_score": self.story_score,
            "final_score": self.final_score,
        }


@dataclass
class ClipData:
    index: int
    start_time: float
    end_time: float
    hook: str
    score: float
    reason: str
    keywords: List[str] = field(default_factory=list)
    scores: Optional[ClipScores] = None
    chunk_id: Optional[int] = None


@dataclass
class SubtitleSegment:
    """Represents a single subtitle segment"""
    start: float
    end: float
    text: str
    words: List[dict] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "start": self.start,
            "end": self.end,
            "text": self.text,
            "words": self.words
        }


@dataclass
class ProcessingStatus:
    """Tracks the processing status of a job"""
    state: ProcessingState
    progress: float = 0.0  # 0-100
    current_step: str = ""
    error_message: Optional[str] = None
    clips_completed: int = 0
    total_clips: int = 0


@dataclass
class RequestLog:
    id: Optional[int]
    youtube_url: str
    caption_style_id: int
    caption_response: List[ClipData]
    status: ProcessingState = ProcessingState.PENDING
    output_path: Optional[str] = None
    requested_at: Optional[datetime] = None
    user_id: Optional[int] = None
    hook_style_id: Optional[int] = None


@dataclass
class JobRequest:
    urls: str
    caption_style: int
    user_id: Optional[int] = None
    hook_style_id: Optional[int] = None
    base_only: bool = False


@dataclass
class VideoInfo:
    """Information about a downloaded video"""
    title: str
    duration: float
    filepath: str
    video_id: str = ""
    sanitized_title: str = ""