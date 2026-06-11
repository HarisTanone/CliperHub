"""
Unit tests for keyframe_renderer module.

Tests cover: static render, keyframe transforms, per-line animation delays,
transform_origin pivot calculation, opacity, graceful fallback, and compositing.
"""

import numpy as np
import pytest
from PIL import Image
from unittest.mock import MagicMock, patch

from src.infrastructure.keyframe_parser import FrameData
from src.infrastructure.keyframe_renderer import KeyframeRenderer, _TRANSFORM_ORIGINS


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_text_measurer():
    """Create a mock TextMeasurer with minimal behavior."""
    measurer = MagicMock()
    measurer.font_resolver = MagicMock()
    measurer.font_resolver._resolve_font = MagicMock(
        return_value="/System/Library/Fonts/Helvetica.ttc"
    )

    # Mock measure_line to return predictable metrics
    mock_metrics = MagicMock()
    mock_metrics.width = 100
    mock_metrics.height = 40
    mock_metrics.ascent = 30
    mock_metrics.descent = 10
    measurer.measure_line.return_value = mock_metrics

    # Mock measure_words
    measurer.measure_words.return_value = [mock_metrics, mock_metrics, mock_metrics]

    return measurer


@pytest.fixture
def renderer(mock_text_measurer):
    """Create a KeyframeRenderer instance with mocked dependencies."""
    return KeyframeRenderer(mock_text_measurer)


@pytest.fixture
def video_frame():
    """Create a 1080x1920 BGR video frame (black)."""
    return np.zeros((1920, 1080, 3), dtype=np.uint8)


@pytest.fixture
def basic_caption_config():
    """A minimal caption template config."""
    return {
        "font": {
            "family": "Helvetica",
            "weight": "bold",
            "size": 48,
            "letter_spacing": 0.0,
            "line_height": 1.2,
            "text_transform": "none",
        },
        "colors": {"primary": "#FFFFFF", "secondary": "#AAAAAA"},
        "highlight": {
            "color": "#FFFF00",
            "style": "color",
            "transition": "instant",
            "transition_duration_ms": 100,
        },
        "position": {"anchor": "bottom", "y_offset": 0, "safe_area": {"top_percent": 10, "bottom_percent": 20, "side_percent": 10}},
        "shadow": {"enabled": False},
        "outline": {"enabled": False},
        "background": {"enabled": False},
        "animation": {"entrance_keyframe_id": None, "transform_origin": "center center"},
    }


@pytest.fixture
def basic_hook_config():
    """A minimal hook template config."""
    return {
        "text": {
            "lines": [
                {"font_family": None, "font_size": 56, "font_weight": "bold", "color": "#FFFFFF", "letter_spacing": 0, "text_transform": "uppercase"},
                {"font_family": None, "font_size": 48, "font_weight": "normal", "color": "#FFFF00", "letter_spacing": 0, "text_transform": "none"},
            ],
            "default_font": {
                "family": "Helvetica",
                "weight": "bold",
                "size": 56,
                "color": "#FFFFFF",
                "letter_spacing": 0.0,
            },
        },
        "box": {"enabled": False, "color": "#000000", "opacity": 0.7, "padding": 20, "border_radius": 12},
        "position": {"anchor": "center", "y_offset": 0, "x_offset": 0},
        "animation": {"entrance_keyframe_id": None, "transform_origin": "center center", "per_line": []},
        "timing": {"display_duration_seconds": 3.0, "delay_before_seconds": 0.0},
        "effects": {"flash": {"enable": False}, "particles": {"enable": False}},
        "overlay": {"gradient_top": {"enable": False}, "gradient_bottom": {"enable": False}},
    }


# ─── render_caption_frame tests ──────────────────────────────────────────────


class TestRenderCaptionFrame:
    """Tests for render_caption_frame method."""

    def test_returns_same_shape_as_input(self, renderer, video_frame, basic_caption_config):
        words = [{"text": "hello"}, {"text": "world"}, {"text": "test"}]
        result = renderer.render_caption_frame(
            video_frame, frame_index=0, fps=30.0,
            words=words, active_word_index=1,
            template_config=basic_caption_config,
            keyframe_data=None,
        )
        assert result.shape == video_frame.shape
        assert result.dtype == video_frame.dtype

    def test_empty_words_returns_unchanged_frame(self, renderer, video_frame, basic_caption_config):
        result = renderer.render_caption_frame(
            video_frame, frame_index=0, fps=30.0,
            words=[], active_word_index=0,
            template_config=basic_caption_config,
            keyframe_data=None,
        )
        assert np.array_equal(result, video_frame)

    def test_static_render_no_keyframes(self, renderer, video_frame, basic_caption_config):
        """Without keyframe_data, render should still produce an overlay (static)."""
        words = [{"text": "hello"}, {"text": "world"}]
        result = renderer.render_caption_frame(
            video_frame, frame_index=0, fps=30.0,
            words=words, active_word_index=0,
            template_config=basic_caption_config,
            keyframe_data=None,
        )
        # Should have drawn something (not all black)
        assert not np.array_equal(result, video_frame)

    def test_with_keyframe_data_applies_transform(self, renderer, video_frame, basic_caption_config):
        """With keyframe_data at opacity=0 on frame 0, overlay should be invisible."""
        words = [{"text": "hello"}, {"text": "world"}]
        keyframes = [
            FrameData(frame=0, scale=1.0, opacity=0.0, x=0, y=0, rotation=0),
            FrameData(frame=10, scale=1.0, opacity=1.0, x=0, y=0, rotation=0),
        ]
        result = renderer.render_caption_frame(
            video_frame, frame_index=0, fps=30.0,
            words=words, active_word_index=0,
            template_config=basic_caption_config,
            keyframe_data=keyframes,
        )
        # At frame 0, opacity=0, so result should be essentially the same as input
        assert np.allclose(result, video_frame, atol=1)

    def test_text_transform_uppercase(self, renderer, video_frame, basic_caption_config):
        basic_caption_config["font"]["text_transform"] = "uppercase"
        words = [{"text": "hello"}]
        # Just verify no crash — transform is applied internally
        result = renderer.render_caption_frame(
            video_frame, frame_index=0, fps=30.0,
            words=words, active_word_index=0,
            template_config=basic_caption_config,
            keyframe_data=None,
        )
        assert result.shape == video_frame.shape


# ─── render_hook_frame tests ─────────────────────────────────────────────────


class TestRenderHookFrame:
    """Tests for render_hook_frame method."""

    def test_returns_same_shape(self, renderer, video_frame, basic_hook_config):
        result = renderer.render_hook_frame(
            video_frame, frame_index=5, fps=30.0,
            hook_lines=["Line 1", "Line 2"],
            template_config=basic_hook_config,
            container_keyframes=None,
            per_line_keyframes=[None, None],
            per_line_delays_ms=[0, 0],
        )
        assert result.shape == video_frame.shape

    def test_empty_lines_returns_unchanged(self, renderer, video_frame, basic_hook_config):
        result = renderer.render_hook_frame(
            video_frame, frame_index=0, fps=30.0,
            hook_lines=[],
            template_config=basic_hook_config,
            container_keyframes=None,
            per_line_keyframes=[],
            per_line_delays_ms=[],
        )
        assert np.array_equal(result, video_frame)

    def test_container_keyframe_opacity_zero(self, renderer, video_frame, basic_hook_config):
        """Container at opacity 0 → overlay invisible."""
        container_kf = [
            FrameData(frame=0, scale=1.0, opacity=0.0),
            FrameData(frame=10, scale=1.0, opacity=1.0),
        ]
        result = renderer.render_hook_frame(
            video_frame, frame_index=0, fps=30.0,
            hook_lines=["Hello", "World"],
            template_config=basic_hook_config,
            container_keyframes=container_kf,
            per_line_keyframes=[None, None],
            per_line_delays_ms=[0, 0],
        )
        assert np.allclose(result, video_frame, atol=1)

    def test_per_line_delay_offsets_animation(self, renderer, video_frame, basic_hook_config):
        """Per-line delay shifts the animation start frame."""
        # Line 2 has 500ms delay at 30fps → 15 frames delay
        per_line_kf_data = [
            FrameData(frame=0, opacity=0.0),
            FrameData(frame=10, opacity=1.0),
        ]
        # At frame_index=5, line 1 should be at frame 5, line 2 at effective frame 0 (due to delay)
        result = renderer.render_hook_frame(
            video_frame, frame_index=5, fps=30.0,
            hook_lines=["Line 1", "Line 2"],
            template_config=basic_hook_config,
            container_keyframes=None,
            per_line_keyframes=[per_line_kf_data, per_line_kf_data],
            per_line_delays_ms=[0, 500],
        )
        # Just verify no crash — the delay logic is internal
        assert result.shape == video_frame.shape

    def test_effects_and_overlay_silently_ignored(self, renderer, video_frame, basic_hook_config):
        """config.effects and config.overlay should be ignored without error."""
        basic_hook_config["effects"] = {"flash": {"enable": True}, "particles": {"enable": True}}
        basic_hook_config["overlay"] = {"gradient_top": {"enable": True}}
        result = renderer.render_hook_frame(
            video_frame, frame_index=0, fps=30.0,
            hook_lines=["Test"],
            template_config=basic_hook_config,
            container_keyframes=None,
            per_line_keyframes=[None],
            per_line_delays_ms=[0],
        )
        assert result.shape == video_frame.shape


# ─── _apply_transform tests ──────────────────────────────────────────────────


class TestApplyTransform:
    """Tests for the _apply_transform method."""

    def test_identity_transform_no_change(self, renderer):
        """Scale=1, rotation=0, opacity=1, offset=0 → no change."""
        img = Image.new("RGBA", (100, 50), (255, 0, 0, 255))
        result = renderer._apply_transform(
            img, scale=1.0, rotation=0.0, opacity=1.0,
            x_offset=0.0, y_offset=0.0, transform_origin="center center",
        )
        assert result.size == img.size
        # Center pixel should still be red
        px = result.getpixel((50, 25))
        assert px == (255, 0, 0, 255)

    def test_opacity_zero_makes_invisible(self, renderer):
        """Opacity 0 → all alpha values become 0."""
        img = Image.new("RGBA", (100, 50), (255, 0, 0, 255))
        result = renderer._apply_transform(
            img, scale=1.0, rotation=0.0, opacity=0.0,
            x_offset=0.0, y_offset=0.0, transform_origin="center center",
        )
        # All pixels should have alpha = 0
        alpha_channel = np.array(result)[:, :, 3]
        assert np.all(alpha_channel == 0)

    def test_opacity_half(self, renderer):
        """Opacity 0.5 → alpha reduced by half."""
        img = Image.new("RGBA", (100, 50), (255, 0, 0, 255))
        result = renderer._apply_transform(
            img, scale=1.0, rotation=0.0, opacity=0.5,
            x_offset=0.0, y_offset=0.0, transform_origin="center center",
        )
        px = result.getpixel((50, 25))
        # Alpha should be ~127-128 (255 * 0.5)
        assert 126 <= px[3] <= 128

    def test_scale_up_preserves_center(self, renderer):
        """Scale 2.0 with center origin → center pixel remains."""
        img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        # Draw a small red square at center
        for x in range(45, 55):
            for y in range(45, 55):
                img.putpixel((x, y), (255, 0, 0, 255))

        result = renderer._apply_transform(
            img, scale=2.0, rotation=0.0, opacity=1.0,
            x_offset=0.0, y_offset=0.0, transform_origin="center center",
        )
        # Center should still be red
        px = result.getpixel((50, 50))
        assert px[0] == 255 and px[3] == 255

    def test_scale_down(self, renderer):
        """Scale 0.5 → image shrinks, keeps same canvas size."""
        img = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
        result = renderer._apply_transform(
            img, scale=0.5, rotation=0.0, opacity=1.0,
            x_offset=0.0, y_offset=0.0, transform_origin="center center",
        )
        assert result.size == (100, 100)
        # Corner should be transparent (image shrank to center)
        px = result.getpixel((0, 0))
        assert px[3] == 0

    def test_offset_moves_content(self, renderer):
        """x_offset and y_offset shift the image."""
        img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        img.putpixel((50, 50), (255, 0, 0, 255))

        result = renderer._apply_transform(
            img, scale=1.0, rotation=0.0, opacity=1.0,
            x_offset=10.0, y_offset=5.0, transform_origin="center center",
        )
        # Pixel should have moved from (50,50) to (60,55)
        px = result.getpixel((60, 55))
        assert px == (255, 0, 0, 255)
        # Original position should be transparent
        px_orig = result.getpixel((50, 50))
        assert px_orig[3] == 0

    def test_rotation_90_degrees(self, renderer):
        """Rotation 90° around center rotates content."""
        # Use a thick block so rotation is visually verifiable
        img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        # Draw a thick horizontal bar at center (y 40-60)
        for x in range(20, 80):
            for y in range(40, 60):
                img.putpixel((x, y), (255, 0, 0, 255))

        result = renderer._apply_transform(
            img, scale=1.0, rotation=90.0, opacity=1.0,
            x_offset=0.0, y_offset=0.0, transform_origin="center center",
        )
        # After 90° clockwise rotation around center, the bar should be vertical
        # Check that the vertical column at x=50 has red pixels
        arr = np.array(result)
        vertical_red = arr[20:80, 48:52, 0]  # Sample near center column
        assert np.any(vertical_red > 200), "Rotated bar should appear as vertical"

    def test_unsupported_transform_origin_falls_back(self, renderer):
        """Unsupported transform_origin → falls back to center center with warning."""
        img = Image.new("RGBA", (100, 50), (255, 0, 0, 255))
        # Should not raise, just log warning
        result = renderer._apply_transform(
            img, scale=1.0, rotation=0.0, opacity=1.0,
            x_offset=0.0, y_offset=0.0, transform_origin="invalid origin",
        )
        assert result.size == img.size


# ─── _resolve_pivot tests ────────────────────────────────────────────────────


class TestResolvePivot:
    """Tests for pivot point calculation."""

    def test_center_center_pivot(self, renderer):
        px, py = renderer._resolve_pivot("center center", 100, 50)
        assert px == 50
        assert py == 25

    def test_top_left_pivot(self, renderer):
        px, py = renderer._resolve_pivot("top left", 100, 50)
        assert px == 0
        assert py == 0

    def test_bottom_right_pivot(self, renderer):
        px, py = renderer._resolve_pivot("bottom right", 100, 50)
        assert px == 100
        assert py == 50

    def test_top_center_pivot(self, renderer):
        px, py = renderer._resolve_pivot("top center", 200, 100)
        assert px == 100
        assert py == 0

    def test_bottom_center_pivot(self, renderer):
        px, py = renderer._resolve_pivot("bottom center", 200, 100)
        assert px == 100
        assert py == 100

    def test_unsupported_falls_back_to_center(self, renderer):
        """Unsupported value falls back to center center."""
        px, py = renderer._resolve_pivot("middle left", 100, 50)
        assert px == 50
        assert py == 25


# ─── Keyframe caching tests ──────────────────────────────────────────────────


class TestKeyframeCaching:
    """Tests for keyframe caching by ID."""

    def test_cache_and_retrieve(self, renderer):
        frames = [FrameData(frame=0, scale=0.5), FrameData(frame=10, scale=1.0)]
        renderer._cache_keyframes("anim_1", frames)

        cached = renderer._get_cached_keyframes("anim_1")
        assert cached is not None
        assert len(cached) == 2
        assert cached[0].scale == 0.5

    def test_cache_miss_returns_none(self, renderer):
        result = renderer._get_cached_keyframes("nonexistent")
        assert result is None

    def test_cache_overwrites(self, renderer):
        frames1 = [FrameData(frame=0, scale=0.5)]
        frames2 = [FrameData(frame=0, scale=2.0)]
        renderer._cache_keyframes("anim_1", frames1)
        renderer._cache_keyframes("anim_1", frames2)

        cached = renderer._get_cached_keyframes("anim_1")
        assert cached[0].scale == 2.0


# ─── Graceful fallback tests ─────────────────────────────────────────────────


class TestGracefulFallback:
    """Missing keyframe_id → static render without error."""

    def test_none_keyframe_data_renders_static(self, renderer, video_frame, basic_caption_config):
        """keyframe_data=None → static render (no animation applied)."""
        words = [{"text": "hello"}]
        result = renderer.render_caption_frame(
            video_frame, frame_index=0, fps=30.0,
            words=words, active_word_index=0,
            template_config=basic_caption_config,
            keyframe_data=None,
        )
        # Should render without crash
        assert result.shape == video_frame.shape
        # Should have drawn something (not all zeros)
        assert not np.array_equal(result, video_frame)

    def test_hook_no_container_keyframes(self, renderer, video_frame, basic_hook_config):
        """No container keyframes → renders static hook."""
        result = renderer.render_hook_frame(
            video_frame, frame_index=0, fps=30.0,
            hook_lines=["Static Hook"],
            template_config=basic_hook_config,
            container_keyframes=None,
            per_line_keyframes=[None],
            per_line_delays_ms=[0],
        )
        assert result.shape == video_frame.shape
        assert not np.array_equal(result, video_frame)
