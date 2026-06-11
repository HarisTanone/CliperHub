"""
Keyframe JSON parser, formatter, and interpolator.

Validates and normalizes keyframe JSON data. Provides linear interpolation
between defined frames for the Keyframe Animation System.
"""

import json
from dataclasses import dataclass
from typing import List, Union


@dataclass
class FrameData:
    """Represents a single keyframe with transform properties."""
    frame: int
    scale: float = 1.0
    opacity: float = 1.0
    x: float = 0.0
    y: float = 0.0
    rotation: float = 0.0


class KeyframeValidationError(ValueError):
    """Raised when keyframe data is malformed."""
    pass


# Transform properties that can be animated (excluding 'frame')
_TRANSFORM_PROPERTIES = ("scale", "opacity", "x", "y", "rotation")


def parse_keyframes(data: Union[str, dict, list]) -> List[FrameData]:
    """
    Parse and validate keyframe JSON.

    Accepts:
      - JSON string: parsed first
      - dict with 'keyframes' key: extracts the array
      - list: treated as the keyframe array directly

    Raises KeyframeValidationError on invalid data.
    Returns a list of FrameData sorted by frame number.
    """
    # Step 1: Resolve input to a list of raw keyframe dicts
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except (json.JSONDecodeError, TypeError) as e:
            raise KeyframeValidationError(f"Invalid JSON string: {e}")

    if isinstance(data, dict):
        if "keyframes" in data:
            data = data["keyframes"]
        else:
            raise KeyframeValidationError(
                "Dict input must contain a 'keyframes' key with an array value."
            )

    if not isinstance(data, list):
        raise KeyframeValidationError(
            f"Expected a list of keyframe objects, got {type(data).__name__}."
        )

    # Step 2: Validate each entry and build FrameData objects
    frames: List[FrameData] = []
    for idx, entry in enumerate(data):
        if not isinstance(entry, dict):
            raise KeyframeValidationError(
                f"Keyframe entry at index {idx} is not a dict."
            )

        # Validate 'frame' field presence
        if "frame" not in entry:
            raise KeyframeValidationError(
                f"Keyframe entry at index {idx} is missing the 'frame' field."
            )

        # Validate 'frame' is a non-negative integer
        frame_val = entry["frame"]
        if not isinstance(frame_val, (int, float)):
            raise KeyframeValidationError(
                f"Keyframe entry at index {idx}: 'frame' must be numeric, "
                f"got {type(frame_val).__name__}."
            )
        frame_int = int(frame_val)
        if frame_int < 0:
            raise KeyframeValidationError(
                f"Keyframe entry at index {idx}: 'frame' must be >= 0, got {frame_int}."
            )

        # Validate transform properties are numeric if present
        kwargs = {"frame": frame_int}
        for prop in _TRANSFORM_PROPERTIES:
            if prop in entry:
                val = entry[prop]
                if not isinstance(val, (int, float)):
                    raise KeyframeValidationError(
                        f"Keyframe entry at index {idx}: property '{prop}' must be "
                        f"numeric, got '{val}' ({type(val).__name__})."
                    )
                kwargs[prop] = float(val)

        frames.append(FrameData(**kwargs))

    # Step 3: Sort by frame number
    frames.sort(key=lambda f: f.frame)

    return frames


def format_keyframes(frames: List[FrameData]) -> str:
    """
    Produce canonical JSON string sorted by frame number.

    Output uses consistent property ordering:
    frame, scale, opacity, x, y, rotation.
    """
    sorted_frames = sorted(frames, key=lambda f: f.frame)
    output = []
    for f in sorted_frames:
        # Maintain canonical property order
        obj = {
            "frame": f.frame,
            "scale": f.scale,
            "opacity": f.opacity,
            "x": f.x,
            "y": f.y,
            "rotation": f.rotation,
        }
        output.append(obj)

    return json.dumps(output, separators=(",", ":"))


def interpolate_frame(frames: List[FrameData], target_frame: int) -> FrameData:
    """
    Linearly interpolate between nearest defined frames for target_frame index.

    Rules:
    - If frames is empty, returns default FrameData at target_frame.
    - If target_frame matches an exact keyframe, returns that keyframe's values.
    - If target_frame is before the first keyframe, returns first keyframe values.
    - If target_frame is after the last keyframe, returns last keyframe values.
    - Otherwise, linearly interpolates between the two nearest keyframes.
    - Division by zero case (A_frame == B_frame): returns A keyframe values.
    """
    if not frames:
        return FrameData(frame=target_frame)

    # Sort frames by frame number
    sorted_frames = sorted(frames, key=lambda f: f.frame)

    # Before first keyframe -> use first keyframe values
    if target_frame <= sorted_frames[0].frame:
        first = sorted_frames[0]
        return FrameData(
            frame=target_frame,
            scale=first.scale,
            opacity=first.opacity,
            x=first.x,
            y=first.y,
            rotation=first.rotation,
        )

    # After last keyframe -> use last keyframe values
    if target_frame >= sorted_frames[-1].frame:
        last = sorted_frames[-1]
        return FrameData(
            frame=target_frame,
            scale=last.scale,
            opacity=last.opacity,
            x=last.x,
            y=last.y,
            rotation=last.rotation,
        )

    # Find the two surrounding keyframes
    frame_a = sorted_frames[0]
    frame_b = sorted_frames[-1]

    for i in range(len(sorted_frames) - 1):
        if sorted_frames[i].frame <= target_frame <= sorted_frames[i + 1].frame:
            frame_a = sorted_frames[i]
            frame_b = sorted_frames[i + 1]
            break

    # Exact match
    if frame_a.frame == target_frame:
        return FrameData(
            frame=target_frame,
            scale=frame_a.scale,
            opacity=frame_a.opacity,
            x=frame_a.x,
            y=frame_a.y,
            rotation=frame_a.rotation,
        )
    if frame_b.frame == target_frame:
        return FrameData(
            frame=target_frame,
            scale=frame_b.scale,
            opacity=frame_b.opacity,
            x=frame_b.x,
            y=frame_b.y,
            rotation=frame_b.rotation,
        )

    # Division by zero guard
    denominator = frame_b.frame - frame_a.frame
    if denominator == 0:
        return FrameData(
            frame=target_frame,
            scale=frame_a.scale,
            opacity=frame_a.opacity,
            x=frame_a.x,
            y=frame_a.y,
            rotation=frame_a.rotation,
        )

    # Linear interpolation: value = A + (B - A) * ((N - A_frame) / (B_frame - A_frame))
    t = (target_frame - frame_a.frame) / denominator

    return FrameData(
        frame=target_frame,
        scale=frame_a.scale + (frame_b.scale - frame_a.scale) * t,
        opacity=frame_a.opacity + (frame_b.opacity - frame_a.opacity) * t,
        x=frame_a.x + (frame_b.x - frame_a.x) * t,
        y=frame_a.y + (frame_b.y - frame_a.y) * t,
        rotation=frame_a.rotation + (frame_b.rotation - frame_a.rotation) * t,
    )
