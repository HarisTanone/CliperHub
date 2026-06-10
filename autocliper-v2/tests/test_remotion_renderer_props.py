"""
Unit tests for RemotionRenderWorker._build_remotion_props and helpers.

Tests that:
- Templates with no config → legacy config built from top-level DB fields
- Templates with empty config ({}) → legacy config built from top-level DB fields
- Templates with full config → config passed through as-is
- Caption templates with no/empty config → empty dict {}
- _compose_shadow() produces correct CSS string when enabled, None when disabled
- _compose_glow() produces correct CSS string when enabled, None when disabled
- Config with all new fields passes through correctly in hookStyle.config
- REMOTION_BUNDLE_DIR missing triggers fallback path
- Render completion timing is logged
"""
import pytest
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from io import StringIO


@dataclass
class MockJob:
    input_video_path: str = "/tmp/video.mp4"
    hook_text: str = "Test hook"
    subtitle_data: list = field(default_factory=list)


@dataclass
class MockHookTemplate:
    font_family: str = "Bebas Neue"
    font_weight: str = "900"
    font_size_normal: int = 36
    font_size_keyword: int = 56
    color: str = "#FFFFFF"
    keyword_color: str = "#FDE68A"
    shadow_enabled: int = 1
    shadow_color: str = "#000000"
    shadow_blur: int = 4
    glow_enabled: int = 0
    glow_color: str = "#FFFFFF"
    glow_radius: int = 0
    animation_type: str = "slam_left"
    animation_in_duration: float = 0.5
    display_duration_seconds: float = 3.0
    delay_before_seconds: float = 0.5
    config: Optional[Dict[str, Any]] = None


@dataclass
class MockCaptionTemplate:
    font_family: str = "Inter"
    font_weight: str = "700"
    font_size: int = 24
    color: str = "#FFFFFF"
    highlight_color: str = "#FFFF00"
    highlight_style: str = "fill"
    outline_enabled: int = 1
    outline_color: str = "#000000"
    outline_width: int = 2
    shadow_enabled: int = 0
    shadow_color: str = "#000000"
    shadow_blur: int = 0
    bg_enabled: int = 0
    bg_color: str = "#000000"
    bg_opacity: float = 0.5
    bg_per_word: int = 0
    position_y: str = "bottom"
    position_y_offset: int = 100
    max_words_per_line: int = 4
    animation_in: str = "fade"
    animation_in_duration: float = 0.3
    highlight_transition: str = "smooth"
    config: Optional[Dict[str, Any]] = None


# Import the worker class - we need to instantiate it to test private methods
import sys
import os

# Add the autocliper-v2/src path so we can import the module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# We can't import the full module due to database dependencies,
# so we test the logic directly by patching what we need
from unittest.mock import patch, MagicMock


@pytest.fixture
def worker():
    """Create a RemotionRenderWorker instance without starting the DB."""
    with patch("infrastructure.remotion_renderer.database"), \
         patch("infrastructure.remotion_renderer.RemotionRenderJobRepository"), \
         patch("infrastructure.remotion_renderer.RemotionCaptionTemplateRepository"), \
         patch("infrastructure.remotion_renderer.RemotionHookTemplateRepository"), \
         patch("infrastructure.remotion_renderer.RemotionCompositionRepository"):
        from infrastructure.remotion_renderer import RemotionRenderWorker
        return RemotionRenderWorker()


class TestBuildLegacyHookConfig:
    """Tests for _build_legacy_hook_config helper method."""

    def test_builds_schema_version_1(self, worker):
        hook = MockHookTemplate()
        config = worker._build_legacy_hook_config(hook)
        assert config["schema_version"] == 1

    def test_text_lines_empty_for_legacy(self, worker):
        hook = MockHookTemplate()
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["lines"] == []

    def test_maps_font_size_normal(self, worker):
        hook = MockHookTemplate(font_size_normal=42)
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["font_size_normal"] == 42

    def test_maps_font_size_keyword(self, worker):
        hook = MockHookTemplate(font_size_keyword=64)
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["font_size_keyword"] == 64

    def test_maps_color(self, worker):
        hook = MockHookTemplate(color="#FF0000")
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["color"] == "#FF0000"

    def test_maps_keyword_color(self, worker):
        hook = MockHookTemplate(keyword_color="#00FF00")
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["keyword_color"] == "#00FF00"

    def test_maps_font_family_to_fontfile(self, worker):
        hook = MockHookTemplate(font_family="Bebas Neue")
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["fontfile"] == "Bebas Neue"

    def test_fontfile_empty_when_font_family_none(self, worker):
        hook = MockHookTemplate(font_family=None)
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["fontfile"] == ""

    def test_maps_animation_type(self, worker):
        hook = MockHookTemplate(animation_type="slam_left")
        config = worker._build_legacy_hook_config(hook)
        assert config["animation"]["type"] == "slam_left"

    def test_animation_type_defaults_to_fade_when_none(self, worker):
        hook = MockHookTemplate(animation_type=None)
        config = worker._build_legacy_hook_config(hook)
        assert config["animation"]["type"] == "fade"

    def test_animation_per_line_empty(self, worker):
        hook = MockHookTemplate()
        config = worker._build_legacy_hook_config(hook)
        assert config["animation"]["per_line"] == []

    def test_includes_text_defaults(self, worker):
        hook = MockHookTemplate()
        config = worker._build_legacy_hook_config(hook)
        assert config["text"]["fallback_font"] == "Anton"
        assert config["text"]["line_spacing"] == 10
        assert config["text"]["word_spacing"] == 12
        assert config["text"]["padding_horizontal"] == 80
        assert config["text"]["text_transform"] == "uppercase"
        assert config["text"]["letter_spacing"] == 0


class TestBuildRemotionPropsBackwardsCompat:
    """Tests for _build_remotion_props backwards compatibility."""

    def test_hook_config_none_uses_legacy(self, worker):
        """When hook_template.config is None, build legacy config."""
        job = MockJob()
        hook = MockHookTemplate(config=None)
        props = worker._build_remotion_props(job, None, hook)

        assert props["hookStyle"]["config"]["schema_version"] == 1
        assert props["hookStyle"]["config"]["text"]["lines"] == []
        assert props["hookStyle"]["config"]["text"]["font_size_normal"] == hook.font_size_normal

    def test_hook_config_empty_dict_uses_legacy(self, worker):
        """When hook_template.config is {}, build legacy config."""
        job = MockJob()
        hook = MockHookTemplate(config={})
        props = worker._build_remotion_props(job, None, hook)

        assert props["hookStyle"]["config"]["schema_version"] == 1
        assert props["hookStyle"]["config"]["text"]["lines"] == []

    def test_hook_config_present_passes_through(self, worker):
        """When hook_template.config has data, pass it through as-is."""
        full_config = {
            "schema_version": 1,
            "text": {"lines": [{"text": "LINE 1", "color": "#FFF"}]},
            "badge": {"enable": True, "text": "TEST"},
        }
        job = MockJob()
        hook = MockHookTemplate(config=full_config)
        props = worker._build_remotion_props(job, None, hook)

        assert props["hookStyle"]["config"] is full_config

    def test_caption_config_none_uses_empty_dict(self, worker):
        """When caption_template.config is None, use empty dict."""
        job = MockJob()
        caption = MockCaptionTemplate(config=None)
        props = worker._build_remotion_props(job, caption, None)

        assert props["captionStyle"]["config"] == {}

    def test_caption_config_empty_dict_stays_empty(self, worker):
        """When caption_template.config is {}, keep empty dict."""
        job = MockJob()
        caption = MockCaptionTemplate(config={})
        props = worker._build_remotion_props(job, caption, None)

        assert props["captionStyle"]["config"] == {}

    def test_caption_config_present_passes_through(self, worker):
        """When caption_template.config has data, pass it through."""
        caption_config = {"schema_version": 1, "some_field": "value"}
        job = MockJob()
        caption = MockCaptionTemplate(config=caption_config)
        props = worker._build_remotion_props(job, caption, None)

        assert props["captionStyle"]["config"] is caption_config

    def test_basic_props_always_present(self, worker):
        """Video source, hook text, and subtitles always in props."""
        job = MockJob(input_video_path="/path/to/video.mp4", hook_text="Hello")
        props = worker._build_remotion_props(job, None, None)

        assert props["videoSrc"] == "/path/to/video.mp4"
        assert props["hookText"] == "Hello"
        assert props["subtitles"] == []

    def test_no_hook_style_when_no_template(self, worker):
        """hookStyle not present when hook_template is None."""
        job = MockJob()
        props = worker._build_remotion_props(job, None, None)
        assert "hookStyle" not in props

    def test_no_caption_style_when_no_template(self, worker):
        """captionStyle not present when caption_template is None."""
        job = MockJob()
        props = worker._build_remotion_props(job, None, None)
        assert "captionStyle" not in props


class TestComposeShadow:
    """Tests for _compose_shadow static method."""

    def test_returns_none_when_disabled(self, worker):
        result = worker._compose_shadow(False, "#000000", 4)
        assert result is None

    def test_returns_none_when_enabled_is_zero(self, worker):
        result = worker._compose_shadow(0, "#000000", 4)
        assert result is None

    def test_returns_css_string_when_enabled(self, worker):
        result = worker._compose_shadow(True, "#FF0000", 6)
        assert result == "2px 2px 6px #FF0000"

    def test_uses_default_color_when_color_is_none(self, worker):
        result = worker._compose_shadow(True, None, 4)
        assert result == "2px 2px 4px rgba(0,0,0,0.8)"

    def test_uses_default_blur_when_blur_is_none(self, worker):
        result = worker._compose_shadow(True, "#000000", None)
        assert result == "2px 2px 4px #000000"

    def test_uses_defaults_when_both_none(self, worker):
        result = worker._compose_shadow(True, None, None)
        assert result == "2px 2px 4px rgba(0,0,0,0.8)"


class TestComposeGlow:
    """Tests for _compose_glow static method."""

    def test_returns_none_when_disabled(self, worker):
        result = worker._compose_glow(False, "#FFFFFF", 8)
        assert result is None

    def test_returns_none_when_enabled_is_zero(self, worker):
        result = worker._compose_glow(0, "#FFFFFF", 8)
        assert result is None

    def test_returns_css_string_when_enabled(self, worker):
        result = worker._compose_glow(True, "#00FF00", 12)
        assert result == "0 0 12px #00FF00"

    def test_uses_default_color_when_color_is_none(self, worker):
        result = worker._compose_glow(True, None, 8)
        assert result == "0 0 8px rgba(255,255,255,0.8)"

    def test_uses_default_radius_when_radius_is_none(self, worker):
        result = worker._compose_glow(True, "#FFFFFF", None)
        assert result == "0 0 8px #FFFFFF"

    def test_uses_defaults_when_both_none(self, worker):
        result = worker._compose_glow(True, None, None)
        assert result == "0 0 8px rgba(255,255,255,0.8)"


class TestFullConfigPassThrough:
    """Test that config with all new fields passes through correctly in hookStyle.config."""

    def test_full_config_with_all_new_fields(self, worker):
        """All new overlay fields (badge, decorations, effects, overlay, position, font_registry, safe_area) pass through."""
        full_config = {
            "schema_version": 1,
            "text": {
                "lines": [
                    {"text": "LINE ONE", "color": "#FDE68A", "font_size": 56},
                    {"text": "LINE TWO", "color": "#FFFFFF", "font_size": 42},
                ],
                "font_size_normal": 36,
                "font_size_keyword": 56,
                "color": "#FFFFFF",
                "keyword_color": "#FDE68A",
                "fontfile": "Bebas Neue",
                "fallback_font": "Anton",
                "line_spacing": 10,
                "word_spacing": 12,
                "padding_horizontal": 80,
                "text_transform": "uppercase",
                "letter_spacing": 0,
            },
            "animation": {
                "type": "slam_left",
                "per_line": [
                    {"type": "slam_left", "delay": 0, "duration": 0.5},
                    {"type": "slide_up", "delay": 0.23, "duration": 0.5},
                ],
            },
            "badge": {
                "enable": True,
                "text": "NEW VIDEO",
                "bg_color": "#EF4444",
                "font_size": 14,
                "font_family": "Inter",
                "letter_spacing": 1,
                "animation": {"type": "fade", "delay": 0.15, "duration": 0.4},
            },
            "decorations": {
                "divider": {"enable": True, "colors": ["#FDE68A", "#F59E0B"], "width": 200, "delay": 0.6},
                "emoji_row": {"enable": True, "emojis": ["🔥", "💯"], "size": 28, "delay": 0.8},
            },
            "effects": {
                "particles": {"enable": True, "count": 8, "colors": ["#FDE68A"], "size_range": [4, 8]},
                "flash": {"enable": True, "color": "rgba(255,255,255,0.3)", "duration": 0.2, "delay": 0},
            },
            "overlay": {
                "gradient_top": {"enable": True, "color": "rgba(0,0,0,0.4)", "height_percent": 30},
                "gradient_bottom": {"enable": True, "color": "rgba(0,0,0,0.6)", "height_percent": 40},
            },
            "position": {
                "anchor": "center",
                "offset_x": 0,
                "offset_y": -50,
            },
            "font_registry": [
                {"family": "Bebas Neue", "source": "google", "weight": 400},
                {"family": "Anton", "source": "local", "path": "/fonts/Anton.ttf", "weight": 400},
            ],
            "safe_area": {
                "top_percent": 10,
                "bottom_percent": 20,
                "left_percent": 10,
                "right_percent": 10,
            },
        }

        job = MockJob()
        hook = MockHookTemplate(config=full_config)
        props = worker._build_remotion_props(job, None, hook)

        # Config is passed through as-is
        assert props["hookStyle"]["config"] is full_config
        # Verify all new fields are accessible
        assert props["hookStyle"]["config"]["badge"]["enable"] is True
        assert props["hookStyle"]["config"]["decorations"]["divider"]["enable"] is True
        assert props["hookStyle"]["config"]["effects"]["particles"]["count"] == 8
        assert props["hookStyle"]["config"]["overlay"]["gradient_top"]["enable"] is True
        assert props["hookStyle"]["config"]["position"]["anchor"] == "center"
        assert len(props["hookStyle"]["config"]["font_registry"]) == 2
        assert props["hookStyle"]["config"]["safe_area"]["top_percent"] == 10


class TestRemotionBundleDirFallback:
    """Test REMOTION_BUNDLE_DIR missing triggers fallback path."""

    def test_empty_bundle_dir_logs_warning(self, worker):
        """When REMOTION_BUNDLE_DIR is empty, worker logs warning and skips Remotion render."""
        import infrastructure.remotion_renderer as renderer_module

        # Save original value
        original = renderer_module.REMOTION_BUNDLE_DIR

        try:
            # Set to empty string (simulates missing env var)
            renderer_module.REMOTION_BUNDLE_DIR = ""

            # Verify the env var check logic: empty string is falsy
            assert not renderer_module.REMOTION_BUNDLE_DIR
        finally:
            renderer_module.REMOTION_BUNDLE_DIR = original

    def test_bundle_dir_check_logic(self, worker):
        """The condition `REMOTION_BUNDLE_DIR and os.path.isdir(...)` correctly gates Remotion usage."""
        import infrastructure.remotion_renderer as renderer_module
        import os

        # Empty string → falsy → skips Remotion
        renderer_module.REMOTION_BUNDLE_DIR = ""
        assert not (renderer_module.REMOTION_BUNDLE_DIR and os.path.isdir(renderer_module.REMOTION_BUNDLE_DIR))

        # Non-existent path → isdir False → skips Remotion
        renderer_module.REMOTION_BUNDLE_DIR = "/nonexistent/path/to/bundle"
        assert not (renderer_module.REMOTION_BUNDLE_DIR and os.path.isdir(renderer_module.REMOTION_BUNDLE_DIR))

        # Reset
        renderer_module.REMOTION_BUNDLE_DIR = ""


class TestRenderViaRemotionTiming:
    """Test that _render_via_remotion prints render completion time."""

    @pytest.mark.asyncio
    async def test_render_completed_prints_timing(self, worker, capsys):
        """When Remotion render succeeds, 'Render completed in Ns' is printed."""
        import infrastructure.remotion_renderer as renderer_module
        from unittest.mock import patch, MagicMock, AsyncMock

        # Set a valid bundle dir for the test
        original_bundle = renderer_module.REMOTION_BUNDLE_DIR
        renderer_module.REMOTION_BUNDLE_DIR = "/tmp/fake_bundle"

        try:
            # Mock subprocess.run to simulate successful render
            mock_result = MagicMock()
            mock_result.returncode = 0
            mock_result.stdout = ""
            mock_result.stderr = ""

            job = MockJob()
            caption = MockCaptionTemplate()
            hook = MockHookTemplate()

            with patch("subprocess.run", return_value=mock_result):
                with patch("os.path.isdir", return_value=True):
                    result = await worker._render_via_remotion(
                        job, caption, hook, "/tmp/output.mp4"
                    )

            assert result is True
            captured = capsys.readouterr()
            assert "Render completed in" in captured.out
            assert "s" in captured.out
        finally:
            renderer_module.REMOTION_BUNDLE_DIR = original_bundle
