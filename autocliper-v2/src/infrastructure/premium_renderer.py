"""
Premium Renderer v2 — Cinematic-quality hook & caption rendering system.

Redesigned from scratch for viral-quality output:
- Multiple animation presets (20+ types)
- True glow, gradient text, advanced shadows
- Keyword highlight system (TikTok/MrBeast/Hormozi styles)
- Background pills, badges, swipe animations
- Emoji & icon support
- Smart contrast detection
- Mobile-first readability
- All configurable via database JSON

Architecture:
- AnimationEngine: handles all motion/easing
- TextEffects: glow, gradient, outline, shadow
- HighlightSystem: keyword emphasis effects
- CaptionRenderer: word-level karaoke with animations
- HookRenderer: cinematic hook overlays
"""
import os
import math
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from dataclasses import dataclass, field


# ═══════════════════════════════════════════════════════════════════════════════
#  EASING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3

def ease_out_elastic(t: float) -> float:
    if t == 0 or t == 1:
        return t
    p = 0.3
    return math.pow(2, -10 * t) * math.sin((t - p / 4) * (2 * math.pi) / p) + 1

def ease_out_bounce(t: float) -> float:
    if t < 1 / 2.75:
        return 7.5625 * t * t
    elif t < 2 / 2.75:
        t -= 1.5 / 2.75
        return 7.5625 * t * t + 0.75
    elif t < 2.5 / 2.75:
        t -= 2.25 / 2.75
        return 7.5625 * t * t + 0.9375
    else:
        t -= 2.625 / 2.75
        return 7.5625 * t * t + 0.984375

def ease_out_back(t: float) -> float:
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)

def ease_in_out_quad(t: float) -> float:
    return 2 * t * t if t < 0.5 else 1 - pow(-2 * t + 2, 2) / 2

EASING_FUNCTIONS = {
    "linear": lambda t: t,
    "ease_out": ease_out_cubic,
    "ease_out_cubic": ease_out_cubic,
    "ease_out_elastic": ease_out_elastic,
    "ease_out_bounce": ease_out_bounce,
    "ease_out_back": ease_out_back,
    "ease_in_out": ease_in_out_quad,
}


# ═══════════════════════════════════════════════════════════════════════════════
#  ANIMATION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class AnimationState:
    """Current animation state for a frame."""
    alpha: float = 1.0
    scale: float = 1.0
    offset_x: float = 0.0
    offset_y: float = 0.0
    rotation: float = 0.0
    blur: float = 0.0
    # Per-word stagger
    word_reveal_progress: float = 1.0  # 0-1, how many words visible


class AnimationEngine:
    """Computes animation state for any given time."""

    PRESETS = {
        "fade": {"enter": "fade", "exit": "fade"},
        "scale_up": {"enter": "scale_up", "exit": "fade"},
        "pop_in": {"enter": "pop_in", "exit": "scale_down"},
        "bounce": {"enter": "bounce", "exit": "fade"},
        "elastic": {"enter": "elastic", "exit": "fade"},
        "slide_up": {"enter": "slide_up", "exit": "slide_down"},
        "slide_down": {"enter": "slide_down", "exit": "slide_up"},
        "slide_left": {"enter": "slide_left", "exit": "slide_right"},
        "slide_right": {"enter": "slide_right", "exit": "slide_left"},
        "blur_reveal": {"enter": "blur_reveal", "exit": "blur_out"},
        "typewriter": {"enter": "typewriter", "exit": "fade"},
        "zoom_burst": {"enter": "zoom_burst", "exit": "scale_down"},
        "cinematic_slow": {"enter": "cinematic_slow", "exit": "fade"},
        "glitch": {"enter": "glitch", "exit": "fade"},
        "shake": {"enter": "shake", "exit": "fade"},
        "stagger_words": {"enter": "stagger_words", "exit": "fade"},
        "kinetic": {"enter": "kinetic", "exit": "fade"},
        "rotation_intro": {"enter": "rotation_intro", "exit": "fade"},
    }

    def compute(self, current_time: float, total_duration: float, config: dict) -> AnimationState:
        """Compute animation state for current time."""
        state = AnimationState()
        
        anim_type = config.get("type", "fade")
        fade_in = config.get("fade_in", 0.3)
        fade_out = config.get("fade_out", 0.3)
        easing_name = config.get("easing", "ease_out_cubic")
        easing = EASING_FUNCTIONS.get(easing_name, ease_out_cubic)

        # Determine phase
        if current_time < fade_in:
            # ENTER phase
            raw_progress = current_time / fade_in if fade_in > 0 else 1.0
            progress = easing(raw_progress)
            self._apply_enter(state, anim_type, progress, config)
        elif current_time > (total_duration - fade_out):
            # EXIT phase
            raw_progress = (total_duration - current_time) / fade_out if fade_out > 0 else 1.0
            raw_progress = max(0.0, min(1.0, raw_progress))
            progress = easing(raw_progress)
            self._apply_exit(state, anim_type, progress, config)
        else:
            # HOLD phase — fully visible
            state.alpha = 1.0
            state.scale = 1.0

        return state

    def _apply_enter(self, state: AnimationState, anim_type: str, progress: float, config: dict):
        """Apply enter animation."""
        state.alpha = progress

        if anim_type in ("fade",):
            pass  # alpha only
        elif anim_type == "scale_up":
            scale_from = config.get("scale_from", 0.7)
            state.scale = scale_from + (1.0 - scale_from) * progress
        elif anim_type in ("pop_in", "bounce"):
            # Overshoot then settle
            if progress < 0.7:
                state.scale = progress / 0.7 * 1.15
            else:
                state.scale = 1.15 - (progress - 0.7) / 0.3 * 0.15
            state.alpha = min(1.0, progress * 2)
        elif anim_type == "elastic":
            state.scale = ease_out_elastic(progress)
            state.alpha = min(1.0, progress * 1.5)
        elif anim_type == "slide_up":
            dist = config.get("slide_distance", 60)
            state.offset_y = dist * (1.0 - progress)
        elif anim_type == "slide_down":
            dist = config.get("slide_distance", 60)
            state.offset_y = -dist * (1.0 - progress)
        elif anim_type == "slide_left":
            dist = config.get("slide_distance", 80)
            state.offset_x = -dist * (1.0 - progress)
        elif anim_type == "slide_right":
            dist = config.get("slide_distance", 80)
            state.offset_x = dist * (1.0 - progress)
        elif anim_type == "blur_reveal":
            state.blur = 12 * (1.0 - progress)
        elif anim_type == "typewriter":
            state.alpha = 1.0
            state.word_reveal_progress = progress
        elif anim_type == "zoom_burst":
            state.scale = 2.0 - progress  # Start at 2x, settle to 1x
            state.alpha = progress
        elif anim_type == "cinematic_slow":
            state.scale = 0.95 + 0.05 * progress
            state.alpha = progress ** 0.5  # Slow fade
        elif anim_type == "glitch":
            if progress < 0.8:
                # Random offset jitter
                jitter = math.sin(progress * 50) * 5 * (1 - progress)
                state.offset_x = jitter
                state.alpha = 0.7 + 0.3 * progress
            else:
                state.alpha = 1.0
        elif anim_type == "shake":
            if progress < 0.6:
                shake = math.sin(progress * 40) * 4 * (1 - progress)
                state.offset_x = shake
            state.alpha = min(1.0, progress * 2)
        elif anim_type == "stagger_words":
            state.alpha = 1.0
            state.word_reveal_progress = progress
        elif anim_type == "kinetic":
            state.scale = 0.5 + 0.5 * progress
            state.offset_y = 30 * (1.0 - progress)
            state.alpha = progress
        elif anim_type == "rotation_intro":
            state.rotation = -15 * (1.0 - progress)
            state.scale = 0.8 + 0.2 * progress
            state.alpha = progress

    def _apply_exit(self, state: AnimationState, anim_type: str, progress: float, config: dict):
        """Apply exit animation (progress goes 1→0 as time runs out)."""
        state.alpha = progress
        if anim_type in ("scale_down",):
            state.scale = progress
        elif anim_type in ("slide_down",):
            state.offset_y = 40 * (1.0 - progress)
        elif anim_type in ("slide_up",):
            state.offset_y = -40 * (1.0 - progress)
        elif anim_type == "blur_out":
            state.blur = 8 * (1.0 - progress)


# ═══════════════════════════════════════════════════════════════════════════════
#  TEXT EFFECTS ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

class TextEffects:
    """Renders advanced text effects: glow, gradient, outline, shadow."""

    @staticmethod
    def draw_glow(draw: ImageDraw, x: int, y: int, text: str, font: ImageFont,
                  color: Tuple, radius: int = 8, opacity: int = 150):
        """True glow effect using concentric rings with decreasing opacity."""
        r, g, b = color[:3]
        for ring in range(radius, 0, -1):
            ring_alpha = int(opacity * (ring / radius) * 0.4)
            ring_color = (r, g, b, ring_alpha)
            # Draw at multiple angles for smooth circle
            for angle in range(0, 360, 30):
                dx = int(ring * math.cos(math.radians(angle)))
                dy = int(ring * math.sin(math.radians(angle)))
                draw.text((x + dx, y + dy), text, font=font, fill=ring_color)

    @staticmethod
    def draw_neon_glow(draw: ImageDraw, x: int, y: int, text: str, font: ImageFont,
                       color: Tuple, radius: int = 12, intensity: float = 1.0):
        """Neon glow — brighter core, softer outer ring."""
        r, g, b = color[:3]
        # Outer glow (soft)
        for ring in range(radius, 0, -2):
            alpha = int(80 * intensity * (ring / radius) ** 2)
            for angle in range(0, 360, 45):
                dx = int(ring * math.cos(math.radians(angle)))
                dy = int(ring * math.sin(math.radians(angle)))
                draw.text((x + dx, y + dy), text, font=font, fill=(r, g, b, alpha))
        # Inner bright core
        for d in range(-2, 3):
            for d2 in range(-2, 3):
                draw.text((x + d, y + d2), text, font=font, fill=(r, g, b, int(200 * intensity)))

    @staticmethod
    def draw_outline(draw: ImageDraw, x: int, y: int, text: str, font: ImageFont,
                     color: Tuple, width: int = 2):
        """Multi-pass outline for crisp stroke."""
        r, g, b = color[:3]
        fill = (r, g, b, 255)
        for dx in range(-width, width + 1):
            for dy in range(-width, width + 1):
                if dx * dx + dy * dy <= width * width:
                    draw.text((x + dx, y + dy), text, font=font, fill=fill)

    @staticmethod
    def draw_shadow(draw: ImageDraw, x: int, y: int, text: str, font: ImageFont,
                    color: Tuple, blur: int = 8, offset_x: int = 0, offset_y: int = 3,
                    opacity: int = 180):
        """Soft shadow with configurable blur."""
        r, g, b = color[:3]
        if blur <= 0:
            # Sharp shadow
            draw.text((x + offset_x, y + offset_y), text, font=font, fill=(r, g, b, opacity))
            return
        # Blurred shadow via concentric passes
        for ring in range(blur, 0, -2):
            alpha = int(opacity * (ring / blur) * 0.3)
            for angle in range(0, 360, 60):
                dx = offset_x + int(ring * 0.5 * math.cos(math.radians(angle)))
                dy = offset_y + int(ring * 0.5 * math.sin(math.radians(angle)))
                draw.text((x + dx, y + dy), text, font=font, fill=(r, g, b, alpha))

    @staticmethod
    def draw_long_shadow(draw: ImageDraw, x: int, y: int, text: str, font: ImageFont,
                         color: Tuple, length: int = 8, angle: float = 135):
        """Long directional shadow (popular in modern design)."""
        r, g, b = color[:3]
        rad = math.radians(angle)
        for i in range(length, 0, -1):
            alpha = int(120 * (i / length))
            dx = int(i * math.cos(rad))
            dy = int(i * math.sin(rad))
            draw.text((x + dx, y + dy), text, font=font, fill=(r, g, b, alpha))


# ═══════════════════════════════════════════════════════════════════════════════
#  HIGHLIGHT SYSTEM (for active karaoke words)
# ═══════════════════════════════════════════════════════════════════════════════

class HighlightSystem:
    """Renders keyword/active-word highlight effects."""

    @staticmethod
    def draw_background_pill(draw: ImageDraw, x: int, y: int, w: int, h: int,
                             color: Tuple, radius: int = 6, padding_x: int = 6, padding_y: int = 3):
        """Rounded rectangle background behind word."""
        rect = [x - padding_x, y - padding_y, x + w + padding_x, y + h + padding_y]
        draw.rounded_rectangle(rect, radius=radius, fill=color)

    @staticmethod
    def draw_underline_animated(draw: ImageDraw, x: int, y: int, w: int,
                                color: Tuple, thickness: int = 3, progress: float = 1.0):
        """Animated underline that sweeps from left to right."""
        actual_w = int(w * progress)
        draw.line([(x, y), (x + actual_w, y)], fill=color, width=thickness)

    @staticmethod
    def draw_highlight_swipe(draw: ImageDraw, x: int, y: int, w: int, h: int,
                             color: Tuple, progress: float = 1.0):
        """Highlight swipe animation (like a marker)."""
        actual_w = int(w * progress)
        rect = [x, y + h - 6, x + actual_w, y + h]
        draw.rectangle(rect, fill=color)


# ═══════════════════════════════════════════════════════════════════════════════
#  SMART CONTRAST
# ═══════════════════════════════════════════════════════════════════════════════

class SmartContrast:
    """Analyzes frame brightness and adjusts text rendering for readability."""

    @staticmethod
    def analyze_region(frame: np.ndarray, y_start: int, y_end: int) -> float:
        """Returns average brightness (0-255) of a region."""
        region = frame[max(0, y_start):min(frame.shape[0], y_end), :]
        if region.size == 0:
            return 128
        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY) if len(region.shape) == 3 else region
        return float(np.mean(gray))

    @staticmethod
    def get_shadow_intensity(brightness: float) -> float:
        """Higher shadow on bright backgrounds, lower on dark."""
        # Bright bg (>150) needs strong shadow, dark bg (<80) needs less
        if brightness > 150:
            return 1.0
        elif brightness > 100:
            return 0.7
        else:
            return 0.4

    @staticmethod
    def should_dim_background(brightness: float) -> bool:
        """Whether to add a dim overlay behind text for readability."""
        return brightness > 120


# ═══════════════════════════════════════════════════════════════════════════════
#  PREMIUM HOOK RENDERER
# ═══════════════════════════════════════════════════════════════════════════════

class PremiumHookRenderer:
    """Cinematic hook text renderer with full animation & effects support.
    
    All settings come from HookStyle.config JSON in database.
    Supports 18+ animation types, glow, gradient, outline, keyword pills, etc.
    """

    def __init__(self):
        from .overlay_renderer import TextRenderer
        self.text_renderer = TextRenderer()
        self.animation_engine = AnimationEngine()
        self.important_keywords: List[str] = []

    def update_keywords(self, caption_response_data: list):
        """Extract keywords from AI response."""
        all_keywords = set()
        for item in caption_response_data:
            keywords = item.get('keywords', [])
            for kw in keywords:
                if isinstance(kw, str) and kw.strip():
                    all_keywords.add(kw.upper().strip())
        self.important_keywords = list(all_keywords)

    def render(self, frame: np.ndarray, hook_text: str, hook_style,
               current_time: float = 0.0, hook_duration: float = 3.0) -> np.ndarray:
        """Render hook overlay on frame with premium effects.
        
        This is the main entry point — replaces create_hook_frame.
        """
        if not hook_text or not hook_text.strip():
            return frame

        height, width = frame.shape[:2]
        # Defensive: support both get_config() method and direct config dict access
        if hook_style and hasattr(hook_style, 'get_config'):
            cfg = hook_style.get_config()
        elif hook_style and hasattr(hook_style, 'config') and isinstance(hook_style.config, dict):
            cfg = self._merge_config_with_defaults(hook_style.config)
        else:
            cfg = self._default_config()
        text_cfg = cfg["text"]
        shadow_cfg = cfg["shadow"]
        glow_cfg = cfg.get("glow", {})
        outline_cfg = cfg.get("outline", {})
        keyword_cfg = cfg["keyword"]
        box_cfg = cfg["box"]
        anim_cfg = cfg["animation"]

        # ── Text transform ────────────────────────────────────────────────
        transform = text_cfg.get("text_transform", "uppercase")
        if transform == "uppercase":
            hook_text = hook_text.upper()
        elif transform == "lowercase":
            hook_text = hook_text.lower()
        elif transform == "capitalize":
            hook_text = hook_text.title()

        # ── Compute animation state ──────────────────────────────────────
        anim_state = self.animation_engine.compute(current_time, hook_duration, anim_cfg)
        
        if anim_state.alpha <= 0.01:
            return frame  # Fully transparent, skip rendering

        # ── Setup PIL canvas ──────────────────────────────────────────────
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb).convert('RGBA')
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # ── Smart contrast: dim background if needed ──────────────────────
        text_region_y = int(height * 0.3), int(height * 0.7)
        brightness = SmartContrast.analyze_region(frame, *text_region_y)
        shadow_intensity = SmartContrast.get_shadow_intensity(brightness)

        # ── Font setup ────────────────────────────────────────────────────
        fontfile = text_cfg.get("fontfile", "")
        fallback = text_cfg.get("fallback_font", "Anton")
        # DB font sizes are Remotion reference values (~360px preview width)
        # Scale to actual render resolution
        render_scale = width / 360.0
        size_normal = int(text_cfg.get("font_size_normal", 48) * render_scale)
        size_keyword = int(text_cfg.get("font_size_keyword", 72) * render_scale)
        keyword_scale = keyword_cfg.get("scale", 1.0)

        def get_font(is_keyword: bool) -> ImageFont.FreeTypeFont:
            size = int(size_keyword * keyword_scale) if is_keyword else size_normal
            if fontfile:
                return self.text_renderer.get_font_from_path(fontfile, size)
            return self.text_renderer.get_font(fallback, size, "bold")

        # ── Build word metrics ────────────────────────────────────────────
        words = hook_text.split()
        word_spacing = text_cfg.get("word_spacing", 12)
        padding_h = text_cfg.get("padding_horizontal", 70)

        word_data = []
        for word in words:
            is_kw = word.upper() in self.important_keywords or word in self.important_keywords
            font = get_font(is_kw)
            bbox = draw.textbbox((0, 0), word, font=font)
            word_data.append({
                "text": word, "font": font,
                "width": bbox[2] - bbox[0], "height": bbox[3] - bbox[1],
                "is_keyword": is_kw,
            })

        # ── Layout into lines ─────────────────────────────────────────────
        max_width = width - padding_h * 2
        lines = self._layout_lines(word_data, max_width, word_spacing)
        if not lines:
            return frame

        line_spacing = text_cfg.get("line_spacing", 14)
        line_heights = [max(w["height"] for w in line) for line in lines]
        total_height = sum(line_heights) + line_spacing * (len(lines) - 1)

        # ── Position ──────────────────────────────────────────────────────
        pos_cfg = cfg.get("position", {})
        pos_x_expr = pos_cfg.get("x", "(w-text_w)/2")
        pos_y_expr = pos_cfg.get("y", "(h-text_h)/2")
        max_line_w = max(
            sum(w["width"] for w in line) + (len(line) - 1) * word_spacing
            for line in lines
        )

        def eval_pos(expr, text_w, text_h):
            try:
                return int(eval(expr, {"w": width, "h": height, "text_w": text_w, "text_h": text_h}))
            except:
                return (height - text_h) // 2 if 'h' in expr else (width - text_w) // 2

        start_y = eval_pos(pos_y_expr, max_line_w, int(total_height))

        # ── Background dim (smart contrast) ───────────────────────────────
        if SmartContrast.should_dim_background(brightness) and not box_cfg.get("enable"):
            dim_rect = [0, start_y - 30, width, start_y + int(total_height) + 30]
            draw.rectangle(dim_rect, fill=(0, 0, 0, int(80 * shadow_intensity)))

        # ── Box background ────────────────────────────────────────────────
        if box_cfg.get("enable"):
            pad = box_cfg.get("padding", 20)
            radius = box_cfg.get("border_radius", 0)
            box_color = (*self._hex_to_rgb(box_cfg.get("color", "#000000")), box_cfg.get("opacity", 200))
            box_rect = [
                (width - max_line_w) // 2 - pad, start_y - pad,
                (width + max_line_w) // 2 + pad, start_y + int(total_height) + pad
            ]
            if radius > 0:
                draw.rounded_rectangle(box_rect, radius=radius, fill=box_color)
            else:
                draw.rectangle(box_rect, fill=box_color)
            # Border
            border_color = box_cfg.get("border_color", "")
            border_width = box_cfg.get("border_width", 0)
            if border_color and border_width > 0:
                bc = (*self._hex_to_rgb(border_color), 255)
                if radius > 0:
                    draw.rounded_rectangle(box_rect, radius=radius, outline=bc, width=border_width)
                else:
                    draw.rectangle(box_rect, outline=bc, width=border_width)

        # ── Typewriter: determine visible words ───────────────────────────
        total_words = sum(len(line) for line in lines)
        visible_words = int(total_words * anim_state.word_reveal_progress) if anim_state.word_reveal_progress < 1.0 else total_words

        # ── Draw words ────────────────────────────────────────────────────
        current_y = start_y
        word_idx = 0
        
        for line_i, line in enumerate(lines):
            line_width = sum(w["width"] for w in line) + (len(line) - 1) * word_spacing
            current_x = eval_pos(pos_x_expr, line_width, line_heights[line_i])

            for ws in line:
                if word_idx >= visible_words:
                    break
                word_idx += 1

                is_kw = ws["is_keyword"]
                text_color = self._hex_to_rgb(text_cfg["keyword_color"]) if is_kw else self._hex_to_rgb(text_cfg["color"])

                # Keyword background pill
                kw_bg = keyword_cfg.get("background", {})
                if is_kw and kw_bg.get("enable"):
                    pill_color = (*self._hex_to_rgb(kw_bg.get("color", "#000000")), kw_bg.get("opacity", 150))
                    HighlightSystem.draw_background_pill(
                        draw, current_x, current_y, ws["width"], ws["height"],
                        pill_color, kw_bg.get("border_radius", 6),
                        kw_bg.get("padding_x", 8), kw_bg.get("padding_y", 4)
                    )

                # Glow
                if glow_cfg.get("enable") and (not glow_cfg.get("keyword_only", True) or is_kw):
                    glow_color = self._hex_to_rgb(glow_cfg.get("color", "#FFFFFF"))
                    glow_type = glow_cfg.get("type", "soft")
                    if glow_type == "neon":
                        TextEffects.draw_neon_glow(
                            draw, current_x, current_y, ws["text"], ws["font"],
                            glow_color, glow_cfg.get("radius", 10),
                            glow_cfg.get("opacity", 150) / 255.0
                        )
                    else:
                        TextEffects.draw_glow(
                            draw, current_x, current_y, ws["text"], ws["font"],
                            glow_color, glow_cfg.get("radius", 8), glow_cfg.get("opacity", 150)
                        )

                # Shadow
                if shadow_cfg.get("enable"):
                    s_color = self._hex_to_rgb(shadow_cfg.get("color", "#000000"))
                    TextEffects.draw_shadow(
                        draw, current_x, current_y, ws["text"], ws["font"],
                        s_color, shadow_cfg.get("blur", 8), 0, shadow_cfg.get("offset_y", 3),
                        int(shadow_cfg.get("opacity", 180) * shadow_intensity)
                    )

                # Outline
                if outline_cfg.get("enable") and (not outline_cfg.get("keyword_only") or is_kw):
                    o_color = self._hex_to_rgb(outline_cfg.get("color", "#000000"))
                    TextEffects.draw_outline(
                        draw, current_x, current_y, ws["text"], ws["font"],
                        o_color, outline_cfg.get("width", 2)
                    )

                # Main text
                draw.text((current_x, current_y), ws["text"], font=ws["font"],
                          fill=(*text_color, 255))

                # Keyword underline
                ul_cfg = keyword_cfg.get("underline", {})
                if is_kw and ul_cfg.get("thickness", 0) > 0 and ul_cfg.get("opacity", 0) > 0:
                    ul_color = (*self._hex_to_rgb(ul_cfg.get("color", "#FFFFFF")), ul_cfg.get("opacity", 180))
                    ul_y = current_y + ws["height"] + ul_cfg.get("offset_y", 8)
                    draw.line([(current_x, ul_y), (current_x + ws["width"], ul_y)],
                              fill=ul_color, width=ul_cfg.get("thickness", 3))

                current_x += ws["width"] + word_spacing

            current_y += line_heights[line_i] + line_spacing

        # ── Apply animation transforms ────────────────────────────────────
        # Alpha
        if anim_state.alpha < 1.0:
            r, g, b, a = overlay.split()
            a = a.point(lambda x: int(x * anim_state.alpha))
            overlay = Image.merge('RGBA', (r, g, b, a))

        # Scale
        if anim_state.scale != 1.0 and anim_state.scale > 0.1:
            new_w = int(width * anim_state.scale)
            new_h = int(height * anim_state.scale)
            scaled = overlay.resize((new_w, new_h), Image.LANCZOS)
            new_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            paste_x = (width - new_w) // 2
            paste_y = (height - new_h) // 2
            new_overlay.paste(scaled, (paste_x, paste_y))
            overlay = new_overlay

        # Offset (slide animations)
        if anim_state.offset_x != 0 or anim_state.offset_y != 0:
            shifted = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            shifted.paste(overlay, (int(anim_state.offset_x), int(anim_state.offset_y)))
            overlay = shifted

        # Blur (blur_reveal animation)
        if anim_state.blur > 0:
            overlay = overlay.filter(ImageFilter.GaussianBlur(radius=anim_state.blur))

        # ── Composite ─────────────────────────────────────────────────────
        result = Image.alpha_composite(pil_image, overlay)
        return cv2.cvtColor(np.array(result.convert('RGB')), cv2.COLOR_RGB2BGR)

    def _layout_lines(self, word_data: List[Dict], max_width: int, word_spacing: int) -> List[List[Dict]]:
        """Layout words into lines. Keywords get their own line for emphasis."""
        lines = []
        current_line = []
        for ws in word_data:
            if ws["is_keyword"]:
                if current_line:
                    lines.append(current_line)
                lines.append([ws])
                current_line = []
            else:
                test_w = sum(w["width"] for w in current_line + [ws]) + len(current_line) * word_spacing
                if test_w <= max_width:
                    current_line.append(ws)
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = [ws]
        if current_line:
            lines.append(current_line)
        return lines

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        h = hex_color.lstrip('#')
        if len(h) < 6:
            h = h + '0' * (6 - len(h))
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

    def _default_config(self):
        from ..domain.entities import HookStyle
        return HookStyle(id=0, name="default").get_config()

    def _merge_config_with_defaults(self, user_config: dict) -> dict:
        """Merge user config dict with defaults when get_config() is unavailable."""
        defaults = self._default_config()
        result = {}
        for key, default_val in defaults.items():
            user_val = user_config.get(key, {})
            if isinstance(default_val, dict) and isinstance(user_val, dict):
                merged = {**default_val}
                for k2, v2 in user_val.items():
                    if isinstance(v2, dict) and isinstance(merged.get(k2), dict):
                        merged[k2] = {**merged[k2], **v2}
                    else:
                        merged[k2] = v2
                result[key] = merged
            else:
                result[key] = user_val if user_val else default_val
        return result


# ═══════════════════════════════════════════════════════════════════════════════
#  PREMIUM CAPTION RENDERER
# ═══════════════════════════════════════════════════════════════════════════════

class PremiumCaptionRenderer:
    """Premium karaoke subtitle renderer with word-level animations.
    
    Features:
    - Word-level highlight with multiple styles (color, pill, scale, glow)
    - Chunk enter/exit animations
    - Background pills per line
    - Smart contrast adaptation
    - Smooth highlight transitions
    """

    def __init__(self):
        from .overlay_renderer import TextRenderer
        self.text_renderer = TextRenderer()
        self.animation_engine = AnimationEngine()
        self._chunk_start_time: Optional[float] = None

    def render(self, frame: np.ndarray, text: str, style,
               current_time: float = None, words: List[Dict] = None,
               chunk_start: float = None, chunk_end: float = None) -> np.ndarray:
        """Render subtitle overlay with premium effects."""
        if not text or not text.strip():
            return frame

        height, width = frame.shape[:2]
        ext_cfg = style.get_extended_config()
        highlight_cfg = ext_cfg.get("highlight", {})
        pill_cfg = ext_cfg.get("background_pill", {})
        anim_cfg = ext_cfg.get("animation", {})
        text_transform = ext_cfg.get("text_transform", "none")

        # ── Text transform ────────────────────────────────────────────────
        if text_transform == "uppercase":
            text = text.upper()
            if words:
                words = [{**w, "word": w["word"].upper()} for w in words]
        elif text_transform == "lowercase":
            text = text.lower()
            if words:
                words = [{**w, "word": w["word"].lower()} for w in words]

        # ── Setup ─────────────────────────────────────────────────────────
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb).convert('RGBA')
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Font — DB font sizes are Remotion reference values (~360px preview width)
        # Use same reference as hook renderer for consistent proportions
        scaled_font_size = max(24, int(style.font_size * (width / 360)))
        font = self.text_renderer.get_font(style.font_family, scaled_font_size, style.font_weight)

        # Colors
        text_color = self._hex_to_rgb(style.color)
        highlight_color = self._hex_to_rgb(style.highlight_color)
        outline_color = self._hex_to_rgb(style.outline_color)
        shadow_color = self._hex_to_rgb(style.shadow_color)

        # ── Smart contrast ────────────────────────────────────────────────
        caption_region_y = height - style.caption_bottom_margin - 100
        brightness = SmartContrast.analyze_region(frame, caption_region_y, height)
        shadow_mult = SmartContrast.get_shadow_intensity(brightness)

        # ── Layout ────────────────────────────────────────────────────────
        max_width = width - 40
        if words and len(words) > 0:
            lines = self._wrap_words(words, font, max_width, draw)
            karaoke_mode = True
        else:
            lines = [[{"word": text, "start": 0, "end": 999}]]
            karaoke_mode = False

        line_height = int(scaled_font_size * style.line_spacing)
        total_height = len(lines) * line_height
        start_y = height - style.caption_bottom_margin - total_height

        # ── Chunk enter animation ─────────────────────────────────────────
        chunk_alpha = 1.0
        chunk_offset_y = 0
        chunk_scale = 1.0
        chunk_enter = anim_cfg.get("chunk_enter", "none")
        enter_dur = anim_cfg.get("enter_duration", 0.12)

        if chunk_start is not None and current_time is not None and chunk_enter != "none":
            elapsed = current_time - chunk_start
            if elapsed < enter_dur:
                progress = ease_out_cubic(elapsed / enter_dur)
                if chunk_enter == "fade_up":
                    chunk_alpha = progress
                    chunk_offset_y = int(20 * (1 - progress))
                elif chunk_enter == "pop":
                    chunk_scale = 0.8 + 0.2 * ease_out_back(progress)
                    chunk_alpha = min(1.0, progress * 2)
                elif chunk_enter == "slide_left":
                    chunk_alpha = progress
                    # Applied per-line below

        # ── Background pill (per line or full block) ──────────────────────
        if pill_cfg.get("enable"):
            pill_color = (*self._hex_to_rgb(pill_cfg.get("color", "#000000")), pill_cfg.get("opacity", 160))
            pill_px = pill_cfg.get("padding_x", 16)
            pill_py = pill_cfg.get("padding_y", 8)
            pill_radius = pill_cfg.get("border_radius", 12)

            if pill_cfg.get("per_line", True):
                for i, line in enumerate(lines):
                    line_text = " ".join(w["word"] for w in line)
                    bbox = draw.textbbox((0, 0), line_text, font=font)
                    lw = bbox[2] - bbox[0]
                    ly = start_y + i * line_height + chunk_offset_y
                    lx = (width - lw) // 2
                    rect = [lx - pill_px, ly - pill_py, lx + lw + pill_px, ly + bbox[3] - bbox[1] + pill_py]
                    draw.rounded_rectangle(rect, radius=pill_radius, fill=pill_color)
            else:
                rect = [(width - max_width) // 2 - pill_px, start_y - pill_py,
                        (width + max_width) // 2 + pill_px, start_y + total_height + pill_py]
                draw.rounded_rectangle(rect, radius=pill_radius, fill=pill_color)

        # ── Draw words ────────────────────────────────────────────────────
        for i, line in enumerate(lines):
            line_text = " ".join(w["word"] for w in line)
            bbox = draw.textbbox((0, 0), line_text, font=font)
            line_width = bbox[2] - bbox[0]
            x = (width - line_width) // 2
            y = start_y + i * line_height + chunk_offset_y

            if karaoke_mode:
                current_x = x
                for word_obj in line:
                    word_text = word_obj["word"]
                    
                    # Determine if word is active
                    is_active = False
                    if current_time is not None:
                        POST_OFFSET = 0.08
                        is_active = word_obj["start"] <= current_time <= word_obj["end"] + POST_OFFSET

                    # Choose highlight style
                    hl_style = highlight_cfg.get("style", "color")
                    w_bbox = draw.textbbox((0, 0), word_text, font=font)
                    w_width = w_bbox[2] - w_bbox[0]
                    w_height = w_bbox[3] - w_bbox[1]

                    if is_active and hl_style == "background":
                        # Background pill on active word
                        bg_color = (*self._hex_to_rgb(highlight_cfg.get("background_color", "#FFD700")),
                                    highlight_cfg.get("background_opacity", 200))
                        bg_px = highlight_cfg.get("background_padding_x", 6)
                        bg_py = highlight_cfg.get("background_padding_y", 3)
                        bg_r = highlight_cfg.get("background_radius", 4)
                        HighlightSystem.draw_background_pill(
                            draw, current_x, y, w_width, w_height,
                            bg_color, bg_r, bg_px, bg_py
                        )

                    if is_active and hl_style == "glow":
                        glow_color = self._hex_to_rgb(highlight_cfg.get("glow_color", "#FFD700"))
                        TextEffects.draw_glow(
                            draw, current_x, y, word_text, font,
                            glow_color, highlight_cfg.get("glow_radius", 6),
                            highlight_cfg.get("glow_opacity", 150)
                        )

                    # Shadow
                    if style.shadow_offset_x != 0 or style.shadow_offset_y != 0:
                        s_blur = ext_cfg.get("shadow_blur", 0)
                        TextEffects.draw_shadow(
                            draw, current_x, y, word_text, font,
                            shadow_color, s_blur, style.shadow_offset_x, style.shadow_offset_y,
                            int(180 * shadow_mult)
                        )

                    # Outline
                    if style.outline_width > 0:
                        TextEffects.draw_outline(
                            draw, current_x, y, word_text, font,
                            outline_color, style.outline_width
                        )

                    # Main text color
                    color = highlight_color if is_active else text_color
                    draw.text((current_x, y), word_text, font=font, fill=(*color, 255))

                    # Space width
                    sp_bbox = draw.textbbox((0, 0), " ", font=font)
                    current_x += w_width + (sp_bbox[2] - sp_bbox[0])
            else:
                # Non-karaoke: simple render
                if style.outline_width > 0:
                    TextEffects.draw_outline(draw, x, y, line_text, font, outline_color, style.outline_width)
                draw.text((x, y), line_text, font=font, fill=(*text_color, 255))

        # ── Apply chunk animation ─────────────────────────────────────────
        if chunk_alpha < 1.0:
            r, g, b, a = overlay.split()
            a = a.point(lambda px: int(px * chunk_alpha))
            overlay = Image.merge('RGBA', (r, g, b, a))

        if chunk_scale != 1.0:
            new_w = int(width * chunk_scale)
            new_h = int(height * chunk_scale)
            scaled = overlay.resize((new_w, new_h), Image.LANCZOS)
            new_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            new_overlay.paste(scaled, ((width - new_w) // 2, (height - new_h) // 2))
            overlay = new_overlay

        # ── Composite ─────────────────────────────────────────────────────
        result = Image.alpha_composite(pil_image, overlay)
        return cv2.cvtColor(np.array(result.convert('RGB')), cv2.COLOR_RGB2BGR)

    def _wrap_words(self, words: List[Dict], font, max_width: int, draw) -> List[List[Dict]]:
        """Wrap words into lines based on max width."""
        lines = []
        current_line = []
        current_width = 0
        space_w = draw.textbbox((0, 0), " ", font=font)[2]

        for w in words:
            w_bbox = draw.textbbox((0, 0), w["word"], font=font)
            w_width = w_bbox[2] - w_bbox[0]
            test_width = current_width + w_width + (space_w if current_line else 0)

            if test_width <= max_width or not current_line:
                current_line.append(w)
                current_width = test_width
            else:
                lines.append(current_line)
                current_line = [w]
                current_width = w_width

        if current_line:
            lines.append(current_line)
        return lines

    def _hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        h = hex_color.lstrip('#')
        if len(h) < 6:
            h = h + '0' * (6 - len(h))
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
