"""
Keyframe Renderer — Applies pre-computed keyframe transforms to text overlays.

Reads Keyframe_JSON data and renders caption/hook overlays frame-by-frame using PIL.
No browser engine, React, or Remotion required at render time.
"""

import logging
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .keyframe_parser import FrameData, interpolate_frame
from .text_measurer import TextMeasurer

logger = logging.getLogger(__name__)

# Video target resolution
_VIDEO_WIDTH = 1080
_VIDEO_HEIGHT = 1920

# Supported transform_origin values and their normalized (x_ratio, y_ratio)
_TRANSFORM_ORIGINS = {
    "center center": (0.5, 0.5),
    "top left": (0.0, 0.0),
    "top center": (0.5, 0.0),
    "top right": (1.0, 0.0),
    "bottom left": (0.0, 1.0),
    "bottom center": (0.5, 1.0),
    "bottom right": (1.0, 1.0),
}


class KeyframeRenderer:
    """
    Core rendering engine for keyframe-based text overlays.

    Applies per-frame transforms (scale, rotation, opacity, offset) to
    text rendered with PIL, then composites onto the numpy video frame.
    """

    def __init__(self, text_measurer: TextMeasurer):
        self._text_measurer = text_measurer
        self._keyframe_cache: Dict[str, List[FrameData]] = {}

    def _cache_keyframes(self, cache_key: str, keyframe_data: List[FrameData]) -> None:
        """Cache parsed keyframe data by a unique key."""
        self._keyframe_cache[cache_key] = keyframe_data

    def _get_cached_keyframes(self, cache_key: str) -> Optional[List[FrameData]]:
        """Retrieve cached keyframe data."""
        return self._keyframe_cache.get(cache_key)

    def render_caption_frame(
        self,
        frame: np.ndarray,
        frame_index: int,
        fps: float,
        words: List[Dict],
        active_word_index: int,
        template_config: dict,
        keyframe_data: Optional[List[FrameData]],
    ) -> np.ndarray:
        """
        Render word-level karaoke captions onto a video frame.

        Args:
            frame: BGR numpy array (h, w, 3 or 4).
            frame_index: Current video frame index (0-based).
            fps: Video FPS for timing calculations.
            words: List of word dicts, each with 'text' key.
            active_word_index: Index of the currently highlighted word.
            template_config: Caption template config JSON (font, colors, highlight, etc.)
            keyframe_data: Parsed keyframe frames for entrance animation, or None for static.

        Returns:
            Modified frame with caption overlay composited.
        """
        if not words:
            return frame

        # Extract config sections
        font_cfg = template_config.get("font", {})
        colors_cfg = template_config.get("colors", {})
        highlight_cfg = template_config.get("highlight", {})
        position_cfg = template_config.get("position", {})
        shadow_cfg = template_config.get("shadow", {})
        outline_cfg = template_config.get("outline", {})
        background_cfg = template_config.get("background", {})

        # Font setup
        font_family = font_cfg.get("family", "Helvetica")
        font_size = font_cfg.get("size", 48)
        font_weight = font_cfg.get("weight", "bold")
        letter_spacing = font_cfg.get("letter_spacing", 0.0)
        text_transform = font_cfg.get("text_transform", "none")

        # Resolve font path
        font_path = self._resolve_font_path(font_family)
        font = self._load_font(font_path, font_size)

        # Colors
        primary_color = self._hex_to_rgba(colors_cfg.get("primary", "#FFFFFF"))
        highlight_color = self._hex_to_rgba(highlight_cfg.get("color", "#FFFF00"))

        # Apply text transform to words
        word_texts = [self._apply_text_transform(w.get("text", ""), text_transform) for w in words]

        # Measure words for positioning
        word_metrics = self._text_measurer.measure_words(word_texts, font_path, font_size, letter_spacing)
        space_width = self._text_measurer.measure_line(" ", font_path, font_size, letter_spacing).width

        # Calculate total line width
        total_width = sum(m.width for m in word_metrics) + space_width * (len(word_texts) - 1)
        line_height = word_metrics[0].height if word_metrics else font_size

        # Position calculation (centered horizontally, anchor-based vertically)
        anchor = position_cfg.get("anchor", "bottom")
        y_offset_config = position_cfg.get("y_offset", 0)
        safe_area = position_cfg.get("safe_area", {})
        top_percent = safe_area.get("top_percent", 10)
        bottom_percent = safe_area.get("bottom_percent", 20)

        # Canvas: full video size RGBA
        canvas = Image.new("RGBA", (_VIDEO_WIDTH, _VIDEO_HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)

        # Compute caption vertical position
        caption_y = self._compute_y_position(anchor, y_offset_config, line_height, top_percent, bottom_percent)

        # Center caption horizontally
        caption_x = (_VIDEO_WIDTH - total_width) // 2

        # Draw each word
        current_x = caption_x
        for i, (word_text, metrics) in enumerate(zip(word_texts, word_metrics)):
            is_active = (i == active_word_index)
            color = highlight_color if is_active else primary_color

            # Draw outline if enabled
            if outline_cfg.get("enabled", False):
                outline_color = self._hex_to_rgba(outline_cfg.get("color", "#000000"))
                outline_width = outline_cfg.get("width", 2)
                for dx in range(-outline_width, outline_width + 1):
                    for dy in range(-outline_width, outline_width + 1):
                        if dx != 0 or dy != 0:
                            draw.text((current_x + dx, caption_y + dy), word_text,
                                      font=font, fill=outline_color)

            # Draw shadow if enabled
            if shadow_cfg.get("enabled", False):
                shadow_color = self._hex_to_rgba(shadow_cfg.get("color", "#000000"),
                                                 int(shadow_cfg.get("opacity", 0.5) * 255) if isinstance(shadow_cfg.get("opacity"), float) else 128)
                sx = shadow_cfg.get("offset_x", 2)
                sy = shadow_cfg.get("offset_y", 2)
                draw.text((current_x + sx, caption_y + sy), word_text,
                          font=font, fill=shadow_color)

            # Draw word
            draw.text((current_x, caption_y), word_text, font=font, fill=color)
            current_x += metrics.width + space_width

        # Apply keyframe transform if available
        if keyframe_data:
            transform_origin = template_config.get("animation", {}).get("transform_origin", "center center")
            interpolated = interpolate_frame(keyframe_data, frame_index)
            canvas = self._apply_transform(
                canvas,
                scale=interpolated.scale,
                rotation=interpolated.rotation,
                opacity=interpolated.opacity,
                x_offset=interpolated.x,
                y_offset=interpolated.y,
                transform_origin=transform_origin,
            )
        else:
            # Static — just ensure full opacity (no transform needed)
            pass

        # Composite onto video frame
        return self._composite_onto_frame(frame, canvas)

    def render_hook_frame(
        self,
        frame: np.ndarray,
        frame_index: int,
        fps: float,
        hook_lines: List[str],
        template_config: dict,
        container_keyframes: Optional[List[FrameData]],
        per_line_keyframes: List[Optional[List[FrameData]]],
        per_line_delays_ms: List[int],
    ) -> np.ndarray:
        """
        Render multi-line hook text with container + per-line animations.

        Args:
            frame: BGR numpy array.
            frame_index: Current video frame index.
            fps: Video FPS.
            hook_lines: List of text strings, one per line.
            template_config: Hook template config JSON.
            container_keyframes: Keyframe data for the overall container entrance.
            per_line_keyframes: Per-line keyframe data (list aligned with hook_lines).
            per_line_delays_ms: Per-line delay in ms (list aligned with hook_lines).

        Returns:
            Modified frame with hook overlay composited.
        """
        if not hook_lines:
            return frame

        # Extract config
        text_cfg = template_config.get("text", {})
        box_cfg = template_config.get("box", {})
        position_cfg = template_config.get("position", {})
        animation_cfg = template_config.get("animation", {})

        default_font = text_cfg.get("default_font", {})
        lines_style = text_cfg.get("lines", [])

        # Default font settings
        default_family = default_font.get("family", "Helvetica")
        default_size = default_font.get("size", 56)
        default_weight = default_font.get("weight", "bold")
        default_color = default_font.get("color", "#FFFFFF")
        default_letter_spacing = default_font.get("letter_spacing", 0.0)

        # Render each line independently onto its own canvas for per-line animation
        line_images: List[Image.Image] = []
        line_heights: List[int] = []
        line_widths: List[int] = []

        for idx, line_text in enumerate(hook_lines):
            # Get per-line style (fallback to defaults)
            line_style = lines_style[idx] if idx < len(lines_style) else {}
            font_family = line_style.get("font_family") or default_family
            font_size = line_style.get("font_size") or default_size
            font_weight = line_style.get("font_weight") or default_weight
            color_hex = line_style.get("color") or default_color
            l_spacing = line_style.get("letter_spacing") if line_style.get("letter_spacing") is not None else default_letter_spacing
            text_transform = line_style.get("text_transform") or "none"

            # Apply text transform
            display_text = self._apply_text_transform(line_text, text_transform)

            # Resolve font and measure
            font_path = self._resolve_font_path(font_family)
            font = self._load_font(font_path, font_size)
            metrics = self._text_measurer.measure_line(display_text, font_path, font_size, l_spacing)

            # Create a canvas for this line (with generous padding for transforms)
            padding = 40
            line_canvas_w = metrics.width + padding * 2
            line_canvas_h = metrics.height + padding * 2
            line_canvas = Image.new("RGBA", (line_canvas_w, line_canvas_h), (0, 0, 0, 0))
            line_draw = ImageDraw.Draw(line_canvas)

            color_rgba = self._hex_to_rgba(color_hex)
            line_draw.text((padding, padding), display_text, font=font, fill=color_rgba)

            # Apply per-line keyframe transform if available
            per_line_kf = per_line_keyframes[idx] if idx < len(per_line_keyframes) else None
            delay_ms = per_line_delays_ms[idx] if idx < len(per_line_delays_ms) else 0

            if per_line_kf:
                # Calculate effective frame index with delay offset
                delay_frames = int((delay_ms / 1000.0) * fps)
                effective_frame = max(0, frame_index - delay_frames)

                # Get per-line transform origin
                per_line_anim = animation_cfg.get("per_line", [])
                line_transform_origin = "center center"
                if idx < len(per_line_anim):
                    line_transform_origin = per_line_anim[idx].get("transform_origin") or "center center"

                interpolated = interpolate_frame(per_line_kf, effective_frame)
                line_canvas = self._apply_transform(
                    line_canvas,
                    scale=interpolated.scale,
                    rotation=interpolated.rotation,
                    opacity=interpolated.opacity,
                    x_offset=interpolated.x,
                    y_offset=interpolated.y,
                    transform_origin=line_transform_origin,
                )

            line_images.append(line_canvas)
            line_heights.append(metrics.height)
            line_widths.append(metrics.width)

        # Compose all lines into a single container canvas
        line_gap = 10
        total_content_height = sum(line_heights) + line_gap * (len(hook_lines) - 1)
        max_line_width = max(line_widths) if line_widths else 0

        # Box padding
        box_enabled = box_cfg.get("enabled", False)
        box_padding = box_cfg.get("padding", 20) if box_enabled else 0

        container_w = max_line_width + box_padding * 2 + 80  # Extra space for transforms
        container_h = total_content_height + box_padding * 2 + 80
        container = Image.new("RGBA", (container_w, container_h), (0, 0, 0, 0))

        # Draw box background if enabled
        if box_enabled:
            box_draw = ImageDraw.Draw(container)
            box_color_hex = box_cfg.get("color", "#000000")
            box_opacity = box_cfg.get("opacity", 0.7)
            box_radius = box_cfg.get("border_radius", 12)
            box_rgba = self._hex_to_rgba(box_color_hex, int(box_opacity * 255))

            box_x0 = (container_w - max_line_width - box_padding * 2) // 2
            box_y0 = (container_h - total_content_height - box_padding * 2) // 2
            box_x1 = box_x0 + max_line_width + box_padding * 2
            box_y1 = box_y0 + total_content_height + box_padding * 2

            box_draw.rounded_rectangle(
                [box_x0, box_y0, box_x1, box_y1],
                radius=box_radius,
                fill=box_rgba,
            )

        # Paste each line image centered in the container
        current_y = (container_h - total_content_height) // 2
        for idx, (line_img, lh) in enumerate(zip(line_images, line_heights)):
            # Center the line image horizontally in the container
            paste_x = (container_w - line_img.width) // 2
            paste_y = current_y - 40  # Adjust for padding in line canvas
            container.paste(line_img, (paste_x, paste_y), line_img)
            current_y += lh + line_gap

        # Apply container-level keyframe transform
        if container_keyframes:
            container_transform_origin = animation_cfg.get("transform_origin") or "center center"
            interpolated = interpolate_frame(container_keyframes, frame_index)
            container = self._apply_transform(
                container,
                scale=interpolated.scale,
                rotation=interpolated.rotation,
                opacity=interpolated.opacity,
                x_offset=interpolated.x,
                y_offset=interpolated.y,
                transform_origin=container_transform_origin,
            )

        # Position the container on the full video canvas
        full_canvas = Image.new("RGBA", (_VIDEO_WIDTH, _VIDEO_HEIGHT), (0, 0, 0, 0))
        anchor = position_cfg.get("anchor", "center")
        y_offset_config = position_cfg.get("y_offset", 0)
        x_offset_config = position_cfg.get("x_offset", 0)

        paste_x = (_VIDEO_WIDTH - container.width) // 2 + x_offset_config
        paste_y = self._compute_container_y(anchor, y_offset_config, container.height)

        # Clamp to frame bounds
        paste_x = max(0, min(paste_x, _VIDEO_WIDTH - container.width))
        paste_y = max(0, min(paste_y, _VIDEO_HEIGHT - container.height))

        full_canvas.paste(container, (paste_x, paste_y), container)

        return self._composite_onto_frame(frame, full_canvas)

    def _apply_transform(
        self,
        img: Image.Image,
        scale: float,
        rotation: float,
        opacity: float,
        x_offset: float,
        y_offset: float,
        transform_origin: str,
    ) -> Image.Image:
        """
        Apply scale, rotation, opacity, and offset transforms to a PIL Image.

        Transform origin determines the pivot point for scale and rotation.
        Process: translate to origin → apply transform → translate back.

        Args:
            img: RGBA PIL image.
            scale: Scale factor (1.0 = original size).
            rotation: Rotation in degrees.
            opacity: Opacity (0.0 = invisible, 1.0 = fully opaque).
            x_offset: Horizontal offset in pixels.
            y_offset: Vertical offset in pixels.
            transform_origin: Pivot point descriptor string.

        Returns:
            Transformed RGBA PIL image (same size as input).
        """
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        w, h = img.size

        # Resolve transform origin to pivot coordinates
        pivot_x, pivot_y = self._resolve_pivot(transform_origin, w, h)

        result = img.copy()

        # Apply scale
        if scale != 1.0 and scale > 0:
            new_w = max(1, int(round(w * scale)))
            new_h = max(1, int(round(h * scale)))
            scaled = img.resize((new_w, new_h), Image.BICUBIC)

            # Reposition so the pivot stays at the same location
            result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            # The pivot in the scaled image
            scaled_pivot_x = int(round(pivot_x * scale))
            scaled_pivot_y = int(round(pivot_y * scale))
            # Paste offset: original pivot - scaled pivot
            paste_x = int(pivot_x - scaled_pivot_x)
            paste_y = int(pivot_y - scaled_pivot_y)
            result.paste(scaled, (paste_x, paste_y), scaled)

        # Apply rotation
        if rotation != 0.0:
            # Rotate around the pivot point
            # PIL rotates around center by default, so we need to handle the pivot
            rotated = result.rotate(
                -rotation,  # PIL rotates counter-clockwise, CSS clockwise
                resample=Image.BICUBIC,
                expand=False,
                center=(pivot_x, pivot_y),
            )
            result = rotated

        # Apply opacity
        if opacity < 1.0:
            alpha = result.split()[3]
            alpha = alpha.point(lambda a: int(a * max(0.0, min(1.0, opacity))))
            result.putalpha(alpha)

        # Apply offset
        if x_offset != 0 or y_offset != 0:
            offset_result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            paste_x = int(round(x_offset))
            paste_y = int(round(y_offset))
            offset_result.paste(result, (paste_x, paste_y), result)
            result = offset_result

        return result

    def _resolve_pivot(self, transform_origin: str, width: int, height: int) -> Tuple[int, int]:
        """
        Convert transform_origin string to pixel coordinates.

        Supports: "center center", "top left", "top center", "top right",
                  "bottom left", "bottom center", "bottom right".
        Falls back to "center center" with warning for unsupported values.
        """
        ratios = _TRANSFORM_ORIGINS.get(transform_origin)
        if ratios is None:
            logger.warning(
                f"Unsupported transform_origin '{transform_origin}', "
                f"falling back to 'center center'"
            )
            ratios = _TRANSFORM_ORIGINS["center center"]

        return (int(round(width * ratios[0])), int(round(height * ratios[1])))

    def _compute_y_position(
        self, anchor: str, y_offset: int, line_height: int,
        top_percent: int, bottom_percent: int
    ) -> int:
        """Compute vertical position for caption based on anchor and safe area."""
        safe_top = int(_VIDEO_HEIGHT * top_percent / 100)
        safe_bottom = int(_VIDEO_HEIGHT * (100 - bottom_percent) / 100)

        if anchor == "top":
            return safe_top + y_offset
        elif anchor == "center":
            return (_VIDEO_HEIGHT - line_height) // 2 + y_offset
        else:  # "bottom" (default)
            return safe_bottom - line_height + y_offset

    def _compute_container_y(self, anchor: str, y_offset: int, container_height: int) -> int:
        """Compute vertical position for hook container."""
        if anchor == "top":
            return 100 + y_offset  # Safe area from top
        elif anchor == "bottom":
            return _VIDEO_HEIGHT - container_height - 200 + y_offset
        else:  # "center"
            return (_VIDEO_HEIGHT - container_height) // 2 + y_offset

    def _composite_onto_frame(self, frame: np.ndarray, overlay: Image.Image) -> np.ndarray:
        """
        Composite an RGBA PIL overlay onto a BGR numpy video frame using alpha blending.
        """
        # Convert video frame from BGR to RGBA
        if frame.shape[2] == 3:
            frame_rgba = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
        else:
            frame_rgba = frame.copy()

        # Convert to PIL
        frame_pil = Image.fromarray(frame_rgba)

        # Resize overlay if dimensions differ (safety)
        if overlay.size != frame_pil.size:
            overlay = overlay.resize(frame_pil.size, Image.BICUBIC)

        # Alpha composite
        composited = Image.alpha_composite(frame_pil, overlay)

        # Convert back to numpy BGR
        result = np.array(composited)
        if frame.shape[2] == 3:
            result = cv2.cvtColor(result, cv2.COLOR_RGBA2BGR)

        return result

    def _resolve_font_path(self, font_family: str) -> str:
        """Resolve font family to a file path using the text_measurer's font_resolver."""
        try:
            resolver = self._text_measurer.font_resolver
            if hasattr(resolver, '_resolve_font'):
                path = resolver._resolve_font(font_family)
                if path:
                    return path
        except Exception as e:
            logger.warning(f"Font resolution failed for '{font_family}': {e}")

        # Fallback
        return "/System/Library/Fonts/Helvetica.ttc"

    def _load_font(self, font_path: str, font_size: int) -> ImageFont.FreeTypeFont:
        """Load a font, with fallback to default."""
        try:
            return ImageFont.truetype(font_path, font_size)
        except Exception:
            return ImageFont.load_default()

    def _hex_to_rgba(
        self, hex_color: str, alpha: int = 255
    ) -> Tuple[int, int, int, int]:
        """Convert hex color string to RGBA tuple."""
        hex_color = hex_color.lstrip("#")
        if len(hex_color) == 6:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            return (r, g, b, alpha)
        elif len(hex_color) == 8:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            a = int(hex_color[6:8], 16)
            return (r, g, b, a)
        return (255, 255, 255, alpha)

    def _apply_text_transform(self, text: str, transform: str) -> str:
        """Apply text-transform CSS-like operation."""
        if transform == "uppercase":
            return text.upper()
        elif transform == "lowercase":
            return text.lower()
        return text
