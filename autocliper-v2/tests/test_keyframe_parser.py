"""
Unit tests for keyframe_parser module.

Tests cover: parsing, validation, formatting, interpolation,
round-trip consistency, and edge cases.
"""

import json
import pytest

from src.infrastructure.keyframe_parser import (
    FrameData,
    KeyframeValidationError,
    parse_keyframes,
    format_keyframes,
    interpolate_frame,
)


# ─── parse_keyframes tests ───────────────────────────────────────────────────


class TestParseKeyframes:
    """Tests for parse_keyframes function."""

    def test_parse_valid_json_string(self):
        data = json.dumps([
            {"frame": 0, "scale": 0.5, "opacity": 0.0},
            {"frame": 10, "scale": 1.0, "opacity": 1.0},
        ])
        result = parse_keyframes(data)
        assert len(result) == 2
        assert result[0].frame == 0
        assert result[0].scale == 0.5
        assert result[0].opacity == 0.0
        assert result[1].frame == 10
        assert result[1].scale == 1.0

    def test_parse_dict_with_keyframes_key(self):
        data = {
            "keyframes": [
                {"frame": 0, "x": 10.0},
                {"frame": 5, "x": 50.0},
            ]
        }
        result = parse_keyframes(data)
        assert len(result) == 2
        assert result[0].x == 10.0
        assert result[1].x == 50.0

    def test_parse_list_directly(self):
        data = [
            {"frame": 0, "rotation": 0},
            {"frame": 15, "rotation": 360},
        ]
        result = parse_keyframes(data)
        assert len(result) == 2
        assert result[1].rotation == 360.0

    def test_parse_sorts_by_frame(self):
        data = [
            {"frame": 10, "scale": 2.0},
            {"frame": 0, "scale": 0.0},
            {"frame": 5, "scale": 1.0},
        ]
        result = parse_keyframes(data)
        assert [f.frame for f in result] == [0, 5, 10]

    def test_parse_defaults_missing_properties(self):
        data = [{"frame": 0}]
        result = parse_keyframes(data)
        assert result[0].scale == 1.0
        assert result[0].opacity == 1.0
        assert result[0].x == 0.0
        assert result[0].y == 0.0
        assert result[0].rotation == 0.0

    def test_parse_raises_on_missing_frame_field(self):
        data = [{"scale": 1.0, "opacity": 0.5}]
        with pytest.raises(KeyframeValidationError, match="index 0.*missing.*frame"):
            parse_keyframes(data)

    def test_parse_raises_on_non_numeric_property(self):
        data = [{"frame": 0, "scale": "big"}]
        with pytest.raises(KeyframeValidationError, match="index 0.*'scale'.*numeric"):
            parse_keyframes(data)

    def test_parse_raises_on_non_numeric_frame(self):
        data = [{"frame": "abc"}]
        with pytest.raises(KeyframeValidationError, match="index 0.*'frame'.*numeric"):
            parse_keyframes(data)

    def test_parse_raises_on_negative_frame(self):
        data = [{"frame": -1}]
        with pytest.raises(KeyframeValidationError, match="index 0.*>= 0"):
            parse_keyframes(data)

    def test_parse_raises_on_invalid_json_string(self):
        with pytest.raises(KeyframeValidationError, match="Invalid JSON"):
            parse_keyframes("{not valid json")

    def test_parse_raises_on_dict_without_keyframes_key(self):
        with pytest.raises(KeyframeValidationError, match="'keyframes' key"):
            parse_keyframes({"frames": []})

    def test_parse_raises_on_non_dict_entry(self):
        data = [{"frame": 0}, "invalid"]
        with pytest.raises(KeyframeValidationError, match="index 1.*not a dict"):
            parse_keyframes(data)

    def test_parse_empty_list(self):
        result = parse_keyframes([])
        assert result == []

    def test_parse_frame_as_float_truncates_to_int(self):
        data = [{"frame": 5.7}]
        result = parse_keyframes(data)
        assert result[0].frame == 5


# ─── format_keyframes tests ──────────────────────────────────────────────────


class TestFormatKeyframes:
    """Tests for format_keyframes function."""

    def test_format_produces_json_string(self):
        frames = [FrameData(frame=0), FrameData(frame=10, scale=2.0)]
        result = format_keyframes(frames)
        parsed = json.loads(result)
        assert isinstance(parsed, list)
        assert len(parsed) == 2

    def test_format_sorted_by_frame(self):
        frames = [FrameData(frame=10), FrameData(frame=0), FrameData(frame=5)]
        result = format_keyframes(frames)
        parsed = json.loads(result)
        assert [obj["frame"] for obj in parsed] == [0, 5, 10]

    def test_format_consistent_property_ordering(self):
        frames = [FrameData(frame=0, scale=1.5, opacity=0.8, x=10, y=20, rotation=45)]
        result = format_keyframes(frames)
        parsed = json.loads(result)
        keys = list(parsed[0].keys())
        assert keys == ["frame", "scale", "opacity", "x", "y", "rotation"]

    def test_format_compact_json(self):
        frames = [FrameData(frame=0)]
        result = format_keyframes(frames)
        # No extra whitespace in compact JSON
        assert " " not in result or result.count(" ") == 0


# ─── Round-trip tests ─────────────────────────────────────────────────────────


class TestRoundTrip:
    """Round-trip: parse(format(parse(data))) == parse(data)."""

    def test_round_trip_simple(self):
        data = [
            {"frame": 0, "scale": 0.5, "opacity": 0.0, "x": -10, "y": 30, "rotation": 90},
            {"frame": 15, "scale": 1.0, "opacity": 1.0, "x": 0, "y": 0, "rotation": 0},
        ]
        first_parse = parse_keyframes(data)
        formatted = format_keyframes(first_parse)
        second_parse = parse_keyframes(formatted)

        assert len(first_parse) == len(second_parse)
        for a, b in zip(first_parse, second_parse):
            assert a.frame == b.frame
            assert a.scale == b.scale
            assert a.opacity == b.opacity
            assert a.x == b.x
            assert a.y == b.y
            assert a.rotation == b.rotation

    def test_round_trip_with_defaults(self):
        data = [{"frame": 5}]
        first_parse = parse_keyframes(data)
        formatted = format_keyframes(first_parse)
        second_parse = parse_keyframes(formatted)
        assert first_parse[0].frame == second_parse[0].frame
        assert first_parse[0].scale == second_parse[0].scale


# ─── interpolate_frame tests ─────────────────────────────────────────────────


class TestInterpolateFrame:
    """Tests for interpolate_frame function."""

    def test_exact_keyframe_match(self):
        frames = [
            FrameData(frame=0, scale=0.0, opacity=0.0),
            FrameData(frame=10, scale=1.0, opacity=1.0),
        ]
        result = interpolate_frame(frames, 0)
        assert result.scale == 0.0
        assert result.opacity == 0.0

        result = interpolate_frame(frames, 10)
        assert result.scale == 1.0
        assert result.opacity == 1.0

    def test_linear_interpolation_midpoint(self):
        frames = [
            FrameData(frame=0, scale=0.0, x=0.0),
            FrameData(frame=10, scale=1.0, x=100.0),
        ]
        result = interpolate_frame(frames, 5)
        assert result.frame == 5
        assert result.scale == pytest.approx(0.5)
        assert result.x == pytest.approx(50.0)

    def test_linear_interpolation_quarter(self):
        frames = [
            FrameData(frame=0, opacity=0.0),
            FrameData(frame=20, opacity=1.0),
        ]
        result = interpolate_frame(frames, 5)
        assert result.opacity == pytest.approx(0.25)

    def test_before_first_keyframe(self):
        frames = [
            FrameData(frame=5, scale=2.0, opacity=0.5),
            FrameData(frame=10, scale=1.0, opacity=1.0),
        ]
        result = interpolate_frame(frames, 0)
        assert result.frame == 0
        assert result.scale == 2.0
        assert result.opacity == 0.5

    def test_after_last_keyframe(self):
        frames = [
            FrameData(frame=0, scale=0.0),
            FrameData(frame=10, scale=1.0),
        ]
        result = interpolate_frame(frames, 20)
        assert result.frame == 20
        assert result.scale == 1.0

    def test_empty_frames_returns_default(self):
        result = interpolate_frame([], 5)
        assert result.frame == 5
        assert result.scale == 1.0
        assert result.opacity == 1.0
        assert result.x == 0.0
        assert result.y == 0.0
        assert result.rotation == 0.0

    def test_single_keyframe_before(self):
        frames = [FrameData(frame=10, scale=3.0)]
        result = interpolate_frame(frames, 0)
        assert result.scale == 3.0

    def test_single_keyframe_after(self):
        frames = [FrameData(frame=10, scale=3.0)]
        result = interpolate_frame(frames, 20)
        assert result.scale == 3.0

    def test_single_keyframe_exact(self):
        frames = [FrameData(frame=10, scale=3.0)]
        result = interpolate_frame(frames, 10)
        assert result.scale == 3.0

    def test_interpolation_between_multiple_keyframes(self):
        frames = [
            FrameData(frame=0, x=0.0),
            FrameData(frame=10, x=100.0),
            FrameData(frame=20, x=200.0),
        ]
        # Between first and second
        result = interpolate_frame(frames, 5)
        assert result.x == pytest.approx(50.0)
        # Between second and third
        result = interpolate_frame(frames, 15)
        assert result.x == pytest.approx(150.0)

    def test_interpolation_formula_accuracy(self):
        """Validates: value = A + (B - A) * ((N - A_frame) / (B_frame - A_frame))"""
        frames = [
            FrameData(frame=2, scale=1.0, opacity=0.2),
            FrameData(frame=8, scale=4.0, opacity=0.8),
        ]
        # target = 5, t = (5 - 2) / (8 - 2) = 3/6 = 0.5
        result = interpolate_frame(frames, 5)
        expected_scale = 1.0 + (4.0 - 1.0) * (3 / 6)  # 2.5
        expected_opacity = 0.2 + (0.8 - 0.2) * (3 / 6)  # 0.5
        assert result.scale == pytest.approx(expected_scale)
        assert result.opacity == pytest.approx(expected_opacity)

    def test_unsorted_frames_handled(self):
        """interpolate_frame sorts internally."""
        frames = [
            FrameData(frame=10, x=100.0),
            FrameData(frame=0, x=0.0),
        ]
        result = interpolate_frame(frames, 5)
        assert result.x == pytest.approx(50.0)
