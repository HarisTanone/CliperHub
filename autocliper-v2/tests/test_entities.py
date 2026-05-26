"""
Tests for domain entities.
"""
import pytest


def test_hook_style_get_config_defaults():
    """Test HookStyle.get_config() returns defaults when config is empty."""
    from src.domain.entities import HookStyle
    
    style = HookStyle(id=1, name="test", config={})
    cfg = style.get_config()
    
    assert cfg["text"]["font_size_normal"] == 36
    assert cfg["text"]["font_size_keyword"] == 56
    assert cfg["shadow"]["enable"] is True
    assert cfg["animation"]["fade_in"] == 0.3


def test_hook_style_get_config_override():
    """Test HookStyle.get_config() merges overrides correctly."""
    from src.domain.entities import HookStyle
    
    style = HookStyle(id=1, name="test", config={
        "text": {"font_size_normal": 48, "color": "#FF0000"},
        "shadow": {"enable": False},
    })
    cfg = style.get_config()
    
    # Overridden values
    assert cfg["text"]["font_size_normal"] == 48
    assert cfg["text"]["color"] == "#FF0000"
    assert cfg["shadow"]["enable"] is False
    
    # Default values preserved
    assert cfg["text"]["font_size_keyword"] == 56
    assert cfg["shadow"]["blur"] == 12


def test_processing_state_enum():
    """Test ProcessingState enum values."""
    from src.domain.entities import ProcessingState
    
    assert ProcessingState.PENDING.value == "pending"
    assert ProcessingState.COMPLETED.value == "completed"
    assert ProcessingState("failed") == ProcessingState.FAILED


def test_caption_style_to_dict():
    """Test CaptionStyle.to_dict() returns expected keys."""
    from src.domain.entities import CaptionStyle
    
    style = CaptionStyle(
        id=1, name="test",
        font_family="Arial", font_weight="bold",
        font_size=48, color="#FFFF00",
        highlight_color="#FFF45C", outline_color="#000000",
        outline_width=3, shadow_color="#000000",
        shadow_offset_x=2, shadow_offset_y=2,
        line_spacing=1.0, caption_bottom_margin=60
    )
    d = style.to_dict()
    
    assert d["font_family"] == "Arial"
    assert d["font_size"] == 48
    assert d["color"] == "#FFFF00"
    assert "id" not in d
    assert "name" not in d


def test_subtitle_segment_to_dict():
    """Test SubtitleSegment.to_dict() serialization."""
    from src.domain.entities import SubtitleSegment
    
    seg = SubtitleSegment(
        start=1.5, end=3.2, text="Hello world",
        words=[{"word": "Hello", "start": 1.5, "end": 2.0}]
    )
    d = seg.to_dict()
    
    assert d["start"] == 1.5
    assert d["end"] == 3.2
    assert d["text"] == "Hello world"
    assert len(d["words"]) == 1
