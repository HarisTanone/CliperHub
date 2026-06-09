"""
Overlay Renderer Infrastructure - Hook and Subtitle rendering with database styles
"""
import os
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoFileClip, CompositeVideoClip, TextClip, ColorClip
from ..domain.entities import CaptionStyle, HookStyle
from ..domain.interfaces import IOverlayRenderer

# Import premium renderers
from .premium_renderer import PremiumHookRenderer, PremiumCaptionRenderer


class TextRenderer:
    """Helper class for rendering text with PIL for better control"""

    FALLBACK_FONT = "/System/Library/Fonts/Helvetica.ttc"
    LOCAL_FONT_DIR = os.path.join(os.getcwd(), "assets", "fonts")

    def __init__(self):
        self.font_cache = {}

    def get_font(self, font_family: str, font_size: int, font_weight: str = "normal") -> ImageFont.FreeTypeFont:
        cache_key = f"{font_family}_{font_size}_{font_weight}"
        if cache_key not in self.font_cache:
            font_path = self._resolve_font(font_family)
            try:
                self.font_cache[cache_key] = ImageFont.truetype(font_path, font_size)
            except Exception:
                self.font_cache[cache_key] = ImageFont.load_default()
        return self.font_cache[cache_key]

    def get_font_from_path(self, fontfile: str, font_size: int) -> ImageFont.FreeTypeFont:
        """Load font directly from a file path (absolute or relative to assets/fonts)."""
        cache_key = f"path:{fontfile}_{font_size}"
        if cache_key not in self.font_cache:
            # Try absolute path first
            candidates = [fontfile]
            # Try relative to assets/fonts
            candidates.append(os.path.join(self.LOCAL_FONT_DIR, os.path.basename(fontfile)))
            # Try stripping leading slash (e.g. /fonts/Foo.ttf → assets/fonts/Foo.ttf)
            candidates.append(os.path.join(self.LOCAL_FONT_DIR, fontfile.lstrip('/').split('/')[-1]))
            loaded = None
            for path in candidates:
                if os.path.exists(path):
                    try:
                        loaded = ImageFont.truetype(path, font_size)
                        break
                    except Exception:
                        continue
            self.font_cache[cache_key] = loaded or ImageFont.load_default()
        return self.font_cache[cache_key]

    def _resolve_font(self, font_family: str) -> str:
        """Resolve font path: check local assets first, then DB, then system fallback."""
        os.makedirs(self.LOCAL_FONT_DIR, exist_ok=True)

        # 1. Check if any .ttf/.otf in local assets matches font_family name
        for fname in os.listdir(self.LOCAL_FONT_DIR):
            if font_family.lower().replace(' ', '') in fname.lower().replace(' ', '') \
                    and fname.lower().endswith(('.ttf', '.otf', '.ttc')):
                return os.path.join(self.LOCAL_FONT_DIR, fname)

        # 2. Look up in DB by name and download if needed
        db_path = self._resolve_from_db(font_family)
        if db_path:
            return db_path

        # 3. System font fallback
        for font_dir in ["/System/Library/Fonts", "/Library/Fonts",
                         os.path.expanduser("~/Library/Fonts"), "/usr/share/fonts"]:
            for ext in ('.ttf', '.ttc', '.otf'):
                for candidate in [font_family, f"{font_family} Bold"]:
                    path = os.path.join(font_dir, f"{candidate}{ext}")
                    if os.path.exists(path):
                        return path

        return self.FALLBACK_FONT

    def _resolve_from_db(self, font_family: str) -> str:
        """Look up font in DB by name, check local file, download if missing."""
        try:
            from ..infrastructure.database import database, FontModel
            session = database.get_session()
            try:
                # Match by name (case-insensitive contains)
                font = session.query(FontModel).filter(
                    FontModel.name.ilike(f"%{font_family}%")
                ).first()
                if not font:
                    return None
                local_path = os.path.join(self.LOCAL_FONT_DIR, font.file_name)
                if os.path.exists(local_path):
                    return local_path
                # File not local — download now
                return self._download_font(font.download_url, local_path)
            finally:
                session.close()
        except Exception as e:
            print(f"[Font] DB lookup failed: {e}")
            return None

    def _download_font(self, url: str, target_path: str) -> str:
        import requests
        print(f"[Font] Downloading {os.path.basename(target_path)} from {url}")
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                with open(target_path, 'wb') as f:
                    f.write(response.content)
                print(f"[Font] ✅ Downloaded {os.path.basename(target_path)}")
                return target_path
            print(f"[Font] ❌ Download failed: HTTP {response.status_code}")
        except Exception as e:
            print(f"[Font] ❌ Download error: {e}")
        return self.FALLBACK_FONT

    def hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def hex_to_rgba(self, hex_color: str, alpha: int = 255) -> Tuple[int, int, int, int]:
        return (*self.hex_to_rgb(hex_color), alpha)


class HookRenderer:
    """Render hook text overlay with style from database"""

    def __init__(self):
        self.text_renderer = TextRenderer()
        self.important_keywords = []

    def _style_to_dict(self, hook_style: HookStyle) -> dict:
        """Convert HookStyle entity to internal style dict — all values from JSON config."""
        # Defensive: support both get_config() method and direct config dict access
        if hasattr(hook_style, 'get_config'):
            cfg = hook_style.get_config()
        elif hasattr(hook_style, 'config') and isinstance(hook_style.config, dict):
            # Fallback: construct config with defaults manually
            cfg = self._merge_hook_defaults(hook_style.config)
        else:
            # Last resort: use all defaults
            cfg = self._merge_hook_defaults({})
        text = cfg["text"]
        shadow = cfg["shadow"]
        underline = cfg["keyword"]["underline"]
        keyword_bg = cfg["keyword"].get("background", {})
        keyword_scale = cfg["keyword"].get("scale", 1.0)
        box = cfg["box"]
        animation = cfg["animation"]
        position = cfg["position"]
        glow = cfg.get("glow", {})
        outline = cfg.get("outline", {})
        return {
            # text
            "text_color":        self._hex_to_rgb(text["color"]),
            "keyword_color":     self._hex_to_rgb(text["keyword_color"]),
            "font_size_normal":  text["font_size_normal"],
            "font_size_keyword": text["font_size_keyword"],
            "fontfile":          text["fontfile"],
            "fallback_font":     text["fallback_font"],
            "line_spacing":      text["line_spacing"],
            "word_spacing":      text["word_spacing"],
            "padding_horizontal": text["padding_horizontal"],
            "text_transform":    text.get("text_transform", "uppercase"),
            "letter_spacing":    text.get("letter_spacing", 0),
            # shadow
            "shadow_enable":     shadow["enable"],
            "shadow_color":      (*self._hex_to_rgb(shadow["color"]), shadow["opacity"]),
            "shadow_blur":       shadow["blur"],
            "shadow_alpha_mult": shadow["alpha_multiplier"],
            "shadow_offset_y":   shadow["offset_y"],
            # glow (new)
            "glow_enable":       glow.get("enable", False),
            "glow_color":        (*self._hex_to_rgb(glow.get("color", "#FFFFFF")), glow.get("opacity", 120)),
            "glow_radius":       glow.get("radius", 8),
            "glow_keyword_only": glow.get("keyword_only", True),
            # outline (new)
            "outline_enable":    outline.get("enable", False),
            "outline_color":     self._hex_to_rgb(outline.get("color", "#000000")),
            "outline_width":     outline.get("width", 2),
            "outline_keyword_only": outline.get("keyword_only", False),
            # keyword underline
            "underline_color":   (*self._hex_to_rgb(underline["color"]), underline["opacity"]),
            "underline_thickness": underline["thickness"],
            "underline_offset_y":  underline["offset_y"],
            # keyword background (new)
            "keyword_bg_enable": keyword_bg.get("enable", False),
            "keyword_bg_color":  (*self._hex_to_rgb(keyword_bg.get("color", "#000000")), keyword_bg.get("opacity", 150)),
            "keyword_bg_padding_x": keyword_bg.get("padding_x", 8),
            "keyword_bg_padding_y": keyword_bg.get("padding_y", 4),
            "keyword_bg_radius": keyword_bg.get("border_radius", 6),
            # keyword scale
            "keyword_scale":     keyword_scale,
            # box
            "box_enable":  box["enable"],
            "box_color":   (*self._hex_to_rgb(box["color"]), box["opacity"]),
            "box_padding": box["padding"],
            "box_radius":  box.get("border_radius", 0),
            "box_border_color": self._hex_to_rgb(box["border_color"]) if box.get("border_color") else None,
            "box_border_width": box.get("border_width", 0),
            # animation (enhanced)
            "fade_in":  animation["fade_in"],
            "fade_out": animation["fade_out"],
            "anim_type": animation.get("type", "fade"),  # fade, scale_up, slide_up, typewriter, bounce
            "anim_scale_from": animation.get("scale_from", 0.8),
            "anim_slide_distance": animation.get("slide_distance", 50),
            # position
            "position_x": position["x"],
            "position_y": position["y"],
        }

    def _merge_hook_defaults(self, user_config: dict) -> dict:
        """Merge user config with hook style defaults (same logic as HookStyle.get_config)."""
        defaults = {
            "text": {
                "fontfile": "", "fallback_font": "Anton",
                "font_size_normal": 36, "font_size_keyword": 56,
                "color": "#FFFFFF", "keyword_color": "#FFFFFF",
                "line_spacing": 10, "word_spacing": 12,
                "padding_horizontal": 80, "text_transform": "uppercase",
                "letter_spacing": 0,
            },
            "shadow": {
                "enable": True, "color": "#000000", "opacity": 200,
                "blur": 12, "alpha_multiplier": 0.3, "offset_y": 3,
            },
            "glow": {
                "enable": False, "color": "#FFFFFF", "opacity": 120,
                "radius": 8, "keyword_only": True,
            },
            "outline": {
                "enable": False, "color": "#000000", "width": 2,
                "keyword_only": False,
            },
            "keyword": {
                "underline": {"color": "#FFD700", "opacity": 200, "thickness": 3, "offset_y": 6},
                "background": {"enable": False, "color": "#000000", "opacity": 150,
                               "padding_x": 8, "padding_y": 4, "border_radius": 6},
                "scale": 1.0,
            },
            "box": {
                "enable": False, "color": "#000000", "opacity": 0,
                "padding": 0, "border_radius": 0, "border_color": None, "border_width": 0,
            },
            "animation": {"fade_in": 0.3, "fade_out": 0.3, "type": "fade"},
            "position": {"y_ratio": 0.15, "max_width_ratio": 0.85},
        }
        # Deep merge user_config into defaults
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

    def _hex_to_rgb(self, hex_color: str):
        h = hex_color.lstrip('#')
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
    
    def analyze_hooks_for_keywords(self, caption_response_data: list) -> list:
        """Extract keywords directly from clip data (already provided by Gemini).
        
        No extra API call needed — keywords are embedded in each clip's data
        from the initial analysis prompt.
        """
        all_keywords = set()
        for item in caption_response_data:
            # Get pre-extracted keywords from Gemini response
            keywords = item.get('keywords', [])
            if keywords:
                for kw in keywords:
                    if isinstance(kw, str) and kw.strip():
                        all_keywords.add(kw.upper().strip())
            
            # Also extract obvious keywords from hook text as fallback
            hook = item.get('hook', '')
            if hook and not keywords:
                # Simple heuristic: words > 4 chars that are likely important
                for word in hook.upper().split():
                    word = word.strip('?!.,')
                    if len(word) > 4 and word not in {'YANG', 'DARI', 'UNTUK', 'DENGAN', 'BISA', 'AKAN', 'HARUS', 'TIDAK'}:
                        all_keywords.add(word)
        
        result = list(all_keywords)
        if result:
            print(f"[Keywords] Extracted {len(result)} keywords from AI response: {result[:8]}...")
        return result
    
    def _get_default_keywords(self) -> list:
        """Fallback keywords if AI analysis fails"""
        return []
    
    def update_keywords(self, caption_response_data: list):
        self.important_keywords = self.analyze_hooks_for_keywords(caption_response_data)

    def create_hook_frame(self, frame: np.ndarray, hook_text: str,
                          hook_style: HookStyle = None,
                          current_time: float = 0.0,
                          hook_duration: float = 3.0) -> np.ndarray:
        height, width = frame.shape[:2]

        # Always build style through get_config() — no hardcode fallback dict
        if hook_style is None:
            hook_style = HookStyle(id=0, name="default")
        style = self._style_to_dict(hook_style)

        # ── Resolve font ──────────────────────────────────────────────────────
        fontfile = style["fontfile"]
        fallback_font = style["fallback_font"]
        
        # Adaptive font size: scale to video resolution + scale down if text too long
        # DB values (font_size_normal/keyword) are Remotion reference values designed
        # for ~360px preview. Scale up to actual video resolution (1080px).
        # Factor: target_width / reference_width = 1080 / 360 = 3.0
        render_scale = width / 360.0
        base_size_normal = int(style["font_size_normal"] * render_scale)
        base_size_keyword = int(style["font_size_keyword"] * render_scale)
        font_scale = self._calculate_font_scale(hook_text, width, style)

        def _get_word_font(is_important: bool) -> ImageFont.FreeTypeFont:
            size = int((base_size_keyword if is_important else base_size_normal) * font_scale)
            if fontfile:
                return self.text_renderer.get_font_from_path(fontfile, size)
            return self.text_renderer.get_font(fallback_font, size, "bold")

        # ── Convert to PIL ────────────────────────────────────────────────────
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Apply text transform from config
        text_transform = style.get("text_transform", "uppercase")
        if text_transform == "uppercase":
            hook_text = hook_text.upper()
        elif text_transform == "lowercase":
            hook_text = hook_text.lower()
        elif text_transform == "capitalize":
            hook_text = hook_text.title()
        # "none" = keep as-is
        
        words = hook_text.split()
        word_spacing = style["word_spacing"]
        padding_h = style["padding_horizontal"]

        # ── Build per-word metrics ────────────────────────────────────────────
        word_styles = []
        for word in words:
            is_important = word in self.important_keywords
            font = _get_word_font(is_important)
            bbox = draw.textbbox((0, 0), word, font=font)
            word_styles.append({
                "text": word,
                "font": font,
                "width": bbox[2] - bbox[0],
                "height": bbox[3] - bbox[1],
                "is_important": is_important,
            })

        lines = self._layout_words(word_styles, width - padding_h, word_spacing)
        if not lines:
            return frame

        line_spacing = style["line_spacing"]
        line_heights = [max(w["height"] for w in line) for line in lines]
        total_height = sum(line_heights) + line_spacing * (len(lines) - 1)

        # ── Resolve position ──────────────────────────────────────────────────
        def _eval_pos(expr: str, w: int, h: int, text_w: int, text_h: int) -> int:
            try:
                return int(eval(expr, {"w": w, "h": h, "text_w": text_w, "text_h": text_h}))
            except Exception:
                return (h - text_h) // 2 if 'h' in expr else (w - text_w) // 2

        max_line_w = max(
            sum(w["width"] for w in line) + (len(line) - 1) * word_spacing
            for line in lines
        )
        start_y = _eval_pos(style["position_y"], width, height, max_line_w, int(total_height))

        # ── Box background ─────────────────────────────────────────────────────
        if style["box_enable"]:
            pad = style["box_padding"]
            draw.rectangle(
                [max(0, (width - max_line_w) // 2 - pad),
                 max(0, start_y - pad),
                 min(width, (width + max_line_w) // 2 + pad),
                 min(height, start_y + int(total_height) + pad)],
                fill=style["box_color"]
            )

        # ── Draw each line ────────────────────────────────────────────────────
        current_y = start_y
        for i, line in enumerate(lines):
            line_width = sum(w["width"] for w in line) + (len(line) - 1) * word_spacing
            line_height = line_heights[i]
            current_x = _eval_pos(style["position_x"], width, height, line_width, line_height)

            for ws in line:
                color = style["keyword_color"] if ws["is_important"] else style["text_color"]
                should_outline = style["outline_enable"] and (not style["outline_keyword_only"] or ws["is_important"])
                should_glow = style["glow_enable"] and (not style["glow_keyword_only"] or ws["is_important"])

                # Keyword background pill
                if ws["is_important"] and style["keyword_bg_enable"]:
                    px = style["keyword_bg_padding_x"]
                    py = style["keyword_bg_padding_y"]
                    r = style["keyword_bg_radius"]
                    bg_rect = [current_x - px, current_y - py,
                               current_x + ws["width"] + px, current_y + ws["height"] + py]
                    if r > 0:
                        draw.rounded_rectangle(bg_rect, radius=r, fill=style["keyword_bg_color"])
                    else:
                        draw.rectangle(bg_rect, fill=style["keyword_bg_color"])

                # Glow effect (rendered before shadow for layering)
                if should_glow:
                    glow_radius = style["glow_radius"]
                    glow_color = style["glow_color"]
                    for gr in range(glow_radius, 0, -2):
                        alpha = int(glow_color[3] * (gr / glow_radius) * 0.3)
                        gc = (*glow_color[:3], alpha)
                        for dx in range(-gr, gr + 1, 3):
                            for dy in range(-gr, gr + 1, 3):
                                draw.text((current_x + dx, current_y + dy),
                                          ws["text"], font=ws["font"], fill=gc)

                # Shadow
                if style["shadow_enable"]:
                    blur = style["shadow_blur"]
                    alpha_mult = style["shadow_alpha_mult"]
                    offset_y = style["shadow_offset_y"]
                    for blur_offset in range(blur, 0, -2):
                        alpha = int(style["shadow_color"][3] * (blur_offset / blur) * alpha_mult)
                        shadow_color = (*style["shadow_color"][:3], alpha)
                        for dx in range(-blur_offset, blur_offset + 1, 2):
                            for dy in range(-blur_offset, blur_offset + 1, 2):
                                if dx != 0 or dy != 0:
                                    draw.text((current_x + dx, current_y + dy + offset_y),
                                              ws["text"], font=ws["font"], fill=shadow_color)

                # Outline/stroke
                if should_outline:
                    ow = style["outline_width"]
                    oc = (*style["outline_color"], 255)
                    for dx in range(-ow, ow + 1):
                        for dy in range(-ow, ow + 1):
                            if dx != 0 or dy != 0:
                                draw.text((current_x + dx, current_y + dy),
                                          ws["text"], font=ws["font"], fill=oc)

                # Main text
                draw.text((current_x, current_y), ws["text"], font=ws["font"], fill=color)

                # Keyword underline
                if ws["is_important"] and style["underline_thickness"] > 0:
                    ul_y = current_y + ws["height"] + style["underline_offset_y"]
                    draw.line(
                        [(current_x, ul_y), (current_x + ws["width"], ul_y)],
                        fill=style["underline_color"],
                        width=style["underline_thickness"]
                    )

                current_x += ws["width"] + word_spacing

            current_y += line_height + line_spacing

        # ── Animation (enhanced) ─────────────────────────────────────────────
        fade_in = style["fade_in"]
        fade_out = style["fade_out"]
        anim_type = style["anim_type"]
        alpha_mult = 1.0
        y_offset = 0
        scale_factor = 1.0

        if anim_type == "fade":
            if fade_in > 0 and current_time < fade_in:
                alpha_mult = current_time / fade_in
            elif fade_out > 0 and current_time > (hook_duration - fade_out):
                alpha_mult = (hook_duration - current_time) / fade_out
        elif anim_type == "scale_up":
            scale_from = style["anim_scale_from"]
            if fade_in > 0 and current_time < fade_in:
                progress = current_time / fade_in
                alpha_mult = progress
                scale_factor = scale_from + (1.0 - scale_from) * progress
            if fade_out > 0 and current_time > (hook_duration - fade_out):
                progress = (hook_duration - current_time) / fade_out
                alpha_mult = progress
        elif anim_type == "slide_up":
            slide_dist = style["anim_slide_distance"]
            if fade_in > 0 and current_time < fade_in:
                progress = current_time / fade_in
                alpha_mult = progress
                y_offset = int(slide_dist * (1.0 - progress))
            if fade_out > 0 and current_time > (hook_duration - fade_out):
                progress = (hook_duration - current_time) / fade_out
                alpha_mult = progress
                y_offset = -int(slide_dist * (1.0 - progress))
        elif anim_type == "bounce":
            if fade_in > 0 and current_time < fade_in:
                progress = current_time / fade_in
                # Elastic bounce: overshoot then settle
                import math
                bounce = 1.0 + math.sin(progress * math.pi * 2) * 0.1 * (1.0 - progress)
                alpha_mult = min(1.0, progress * 1.5)
                scale_factor = bounce
            if fade_out > 0 and current_time > (hook_duration - fade_out):
                alpha_mult = (hook_duration - current_time) / fade_out
        elif anim_type == "typewriter":
            # Reveal words one by one
            if fade_in > 0 and current_time < fade_in:
                alpha_mult = 1.0  # No fade, just reveal
            if fade_out > 0 and current_time > (hook_duration - fade_out):
                alpha_mult = (hook_duration - current_time) / fade_out

        alpha_mult = max(0.0, min(1.0, alpha_mult))

        # Apply alpha
        if alpha_mult < 1.0:
            r, g, b, a = overlay.split()
            a = a.point(lambda x: int(x * alpha_mult))
            overlay = Image.merge('RGBA', (r, g, b, a))

        # Apply scale transform
        if scale_factor != 1.0 and scale_factor > 0:
            new_w = int(overlay.width * scale_factor)
            new_h = int(overlay.height * scale_factor)
            scaled = overlay.resize((new_w, new_h), Image.LANCZOS)
            # Center the scaled overlay
            paste_x = (width - new_w) // 2
            paste_y = (height - new_h) // 2
            new_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            new_overlay.paste(scaled, (paste_x, paste_y))
            overlay = new_overlay

        # Apply Y offset (for slide animation)
        if y_offset != 0:
            shifted = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            shifted.paste(overlay, (0, y_offset))
            overlay = shifted

        # ── Composite ────────────────────────────────────────────────────────
        pil_image = pil_image.convert('RGBA')
        result = Image.alpha_composite(pil_image, overlay)
        return cv2.cvtColor(np.array(result.convert('RGB')), cv2.COLOR_RGB2BGR)
    
    def _calculate_font_scale(self, hook_text: str, frame_width: int, style: dict) -> float:
        """Calculate font scale factor to prevent text overflow.
        
        If the hook text would exceed the available width at full size,
        scale down proportionally. Never scale below 0.6 (60%).
        """
        words = hook_text.upper().split()
        word_count = len(words)
        padding = style["padding_horizontal"]
        available_width = frame_width - padding * 2
        
        # Estimate total text width at full size (using render-scaled values)
        render_scale = frame_width / 360.0
        avg_char_width = int(style["font_size_normal"] * render_scale) * 0.6
        total_chars = sum(len(w) for w in words) + word_count - 1  # spaces
        estimated_width = total_chars * avg_char_width
        
        # If text fits in 2 lines, no scaling needed
        if estimated_width <= available_width * 2.5:
            return 1.0
        
        # Scale down to fit in ~3 lines max
        scale = (available_width * 3.0) / estimated_width
        return max(0.6, min(1.0, scale))
    
    def _layout_words(self, word_styles, max_width, word_spacing=12):
        """Smart layout: put important words on their own lines"""
        lines = []
        current_line = []

        for ws in word_styles:
            if ws["is_important"]:
                if current_line:
                    lines.append(current_line)
                lines.append([ws])
                current_line = []
            else:
                test_width = sum(w["width"] for w in current_line + [ws]) + len(current_line) * word_spacing
                if test_width <= max_width:
                    current_line.append(ws)
                else:
                    if current_line:
                        lines.append(current_line)
                    current_line = [ws]

        if current_line:
            lines.append(current_line)

        return lines
    
class SubtitleRenderer:
    """Render subtitles with dynamic style from database"""
    
    def __init__(self):
        self.text_renderer = TextRenderer()
    
    def create_subtitle_frame(self, frame: np.ndarray, text: str, style: CaptionStyle, 
                             current_time: float = None, words: List[Dict] = None) -> np.ndarray:
        """
        Add subtitle overlay to a single frame
        """
        if not text or not text.strip():
            return frame
        
        height, width = frame.shape[:2]
        
        # Convert to PIL
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb).convert('RGBA')
        
        # Create overlay
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Get font - scale font size for video resolution
        # Base font size from DB is for reference, scale for actual video size
        scaled_font_size = max(24, int(style.font_size * (width / 400)))  # Scale based on width
        font = self.text_renderer.get_font(
            style.font_family, 
            scaled_font_size, 
            style.font_weight
        )
        
        # Word wrap
        max_width = width - 40  # Padding on sides
        
        # If words metadata is present, use it for wrapping
        if words and len(words) > 0:
            lines = self._wrap_words(words, font, max_width, draw)
            karaoke_mode = True
        else:
            lines = self._wrap_text(text, font, max_width, draw)
            karaoke_mode = False
        
        # Calculate total text height with proper line spacing
        base_line_height = scaled_font_size
        line_height = int(base_line_height * style.line_spacing)
        total_height = len(lines) * line_height
        
        # Position at bottom with margin
        start_y = height - style.caption_bottom_margin - total_height
        
        # Colors
        text_color = self.text_renderer.hex_to_rgb(style.color)
        highlight_color = self.text_renderer.hex_to_rgb(style.highlight_color)
        outline_color = self.text_renderer.hex_to_rgb(style.outline_color)
        shadow_color = self.text_renderer.hex_to_rgb(style.shadow_color)
        
        # Draw each line
        for i, line in enumerate(lines):
            y = start_y + i * line_height
            
            if karaoke_mode:
                # Calculate total line width first
                line_text = " ".join([w['word'] for w in line])
                bbox = draw.textbbox((0, 0), line_text, font=font)
                line_width = bbox[2] - bbox[0]
                x = (width - line_width) // 2
                
                # Draw word by word
                current_x = x
                for word_obj in line:
                    word_text = word_obj['word']
                    
                    # Karaoke highlight: aktif tepat saat kata diucapkan.
                    # POST_OFFSET 80ms agar highlight tidak langsung hilang saat
                    # transisi ke kata berikutnya — terasa lebih natural.
                    # Tidak ada PRE_OFFSET agar subtitle tidak muncul sebelum diucapkan.
                    is_active = False
                    if current_time is not None:
                        POST_OFFSET = 0.08
                        is_active = word_obj['start'] <= current_time <= word_obj['end'] + POST_OFFSET
                    
                    color = highlight_color if is_active else text_color
                    
                    # Draw word
                    self._draw_text_with_style(
                        draw, current_x, y, word_text, font, color, 
                        outline_color, style.outline_width, 
                        shadow_color, style.shadow_offset_x, style.shadow_offset_y
                    )
                    
                    # Advance cursor (measure word + space)
                    w_bbox = draw.textbbox((0, 0), word_text, font=font)
                    w_width = w_bbox[2] - w_bbox[0]
                    space_bbox = draw.textbbox((0, 0), " ", font=font)
                    space_width = space_bbox[2] - space_bbox[0]
                    
                    current_x += w_width + space_width
                    
            else:
                # Standard rendering (line by line)
                if isinstance(line, list): line = " ".join([w['word'] for w in line])
                
                bbox = draw.textbbox((0, 0), line, font=font)
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                
                self._draw_text_with_style(
                    draw, x, y, line, font, text_color, 
                    outline_color, style.outline_width, 
                    shadow_color, style.shadow_offset_x, style.shadow_offset_y
                )
        
        # Composite
        result = Image.alpha_composite(pil_image, overlay)
        result_rgb = result.convert('RGB')
        
        return cv2.cvtColor(np.array(result_rgb), cv2.COLOR_RGB2BGR)
    
    def _draw_text_with_style(self, draw, x, y, text, font, color, outline_color, outline_width, shadow_color, shadow_x, shadow_y):
        """Helper to draw text with shadow and outline (optimized)"""
        # Shadow
        if shadow_x != 0 or shadow_y != 0:
            draw.text((x + shadow_x, y + shadow_y), text, font=font, fill=shadow_color)
        
        # Outline — use stroke_width if available (Pillow 8.0+), else manual
        if outline_width > 0:
            try:
                draw.text((x, y), text, font=font, fill=color,
                          stroke_width=outline_width, stroke_fill=outline_color)
                return  # stroke_width handles both outline and main text
            except TypeError:
                # Fallback for older Pillow: draw at cardinal directions only (4 draws vs O(n²))
                for ox, oy in [(-outline_width, 0), (outline_width, 0),
                               (0, -outline_width), (0, outline_width),
                               (-outline_width, -outline_width), (outline_width, -outline_width),
                               (-outline_width, outline_width), (outline_width, outline_width)]:
                    draw.text((x + ox, y + oy), text, font=font, fill=outline_color)
        
        # Main text
        draw.text((x, y), text, font=font, fill=color)

    def _wrap_words(self, words: List[Dict], font: ImageFont.FreeTypeFont, 
                   max_width: int, draw: ImageDraw.Draw) -> List[List[Dict]]:
        """Wrap words list to fit max width"""
        lines = []
        current_line = []
        
        for word in words:
            # Check width if we add this word
            test_line = current_line + [word]
            test_text = " ".join([w['word'] for w in test_line])
            
            bbox = draw.textbbox((0, 0), test_text, font=font)
            line_width = bbox[2] - bbox[0]
            
            if line_width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(current_line)
                current_line = [word]
        
        if current_line:
            lines.append(current_line)
        
        return lines

    def _wrap_text(self, text: str, font: ImageFont.FreeTypeFont, 
                   max_width: int, draw: ImageDraw.Draw) -> List[str]:
        """Wrap text to fit within max width"""
        words = text.split()
        lines = []
        current_line = []
        
        for word in words:
            test_line = ' '.join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            line_width = bbox[2] - bbox[0]
            
            if line_width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                current_line = [word]
        
        if current_line:
            lines.append(' '.join(current_line))
        
        return lines


class OverlayRenderer(IOverlayRenderer):
    """Main overlay renderer combining hook and subtitles.
    
    Uses PremiumHookRenderer and PremiumCaptionRenderer for cinematic-quality output.
    Falls back to legacy renderers if premium fails.
    """
    
    def __init__(self):
        self.hook_renderer = HookRenderer()  # Legacy (kept as fallback)
        self.subtitle_renderer = SubtitleRenderer()  # Legacy (kept as fallback)
        # Premium renderers (primary)
        self.premium_hook = PremiumHookRenderer()
        self.premium_caption = PremiumCaptionRenderer()
        self._use_premium = True  # Set False to revert to legacy
    
    def render_hook(self, video_path: str, hook_text: str, duration: float = 3.0, 
                    output_path: str = None) -> str:
        """
        Render hook text overlay on video for the first N seconds
        
        Args:
            video_path: Source video path
            hook_text: Hook text to display
            duration: Duration to show hook (seconds)
            output_path: Output path (optional)
            
        Returns:
            Path to video with hook overlay
        """
        if output_path is None:
            output_path = video_path.rsplit('.', 1)[0] + '_hook.mp4'
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        hook_frames = int(duration * fps)
        
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not out.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Add hook on first N seconds
            if frame_idx < hook_frames:
                frame = self.hook_renderer.create_hook_frame(
                    frame, hook_text, None,
                    current_time=frame_idx / fps, hook_duration=duration
                )
            
            out.write(frame)
            frame_idx += 1
        
        cap.release()
        out.release()
        
        # Add audio back
        self._copy_audio(video_path, output_path)
        
        return output_path
    
    def render_subtitles(self, video_path: str, subtitles: List[Dict], 
                         style: Dict[str, Any], start_offset: float = 3.0,
                         output_path: str = None) -> str:
        """
        Render subtitles with style from database
        
        Args:
            video_path: Source video path
            subtitles: List of subtitle segments with start, end, text
            style: Caption style dict or CaptionStyle object
            start_offset: Time offset to start showing subtitles
            output_path: Output path (optional)
            
        Returns:
            Path to video with subtitles
        """
        if output_path is None:
            output_path = video_path.rsplit('.', 1)[0] + '_subtitled.mp4'
        
        # Convert dict to CaptionStyle if needed
        if isinstance(style, dict):
            caption_style = CaptionStyle(
                id=0, 
                name="dynamic",
                **{k: v for k, v in style.items() if k not in ['id', 'name', 'created_at']}
            )
        else:
            caption_style = style
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not out.isOpened():
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        # Adjust subtitles for offset (subtitle starts after hook ends)
        adjusted_subtitles = []
        for sub in subtitles:
            if sub["end"] > start_offset:
                # Adjust words if present
                adjusted_words = []
                if "words" in sub and sub["words"]:
                    for w in sub["words"]:
                        if w["end"] > start_offset:
                            adjusted_words.append({
                                "word": w["word"],
                                "start": max(w["start"], start_offset) - start_offset,
                                "end": w["end"] - start_offset
                            })
                
                adjusted_subtitles.append({
                    "start": max(sub["start"], start_offset) - start_offset,
                    "end": sub["end"] - start_offset,
                    "text": sub["text"],
                    "words": adjusted_words
                })
        
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            current_time = frame_idx / fps
            
            # Skip subtitle rendering during hook time
            if current_time >= start_offset:
                # Find current subtitle using binary search
                adjusted_time = current_time - start_offset
                current_subtitle = None
                lo, hi = 0, len(adjusted_subtitles) - 1
                while lo <= hi:
                    mid = (lo + hi) // 2
                    sub = adjusted_subtitles[mid]
                    if sub["end"] <= adjusted_time:
                        lo = mid + 1
                    elif sub["start"] > adjusted_time:
                        hi = mid - 1
                    else:
                        current_subtitle = sub
                        break
                
                if current_subtitle:
                    frame = self.subtitle_renderer.create_subtitle_frame(
                        frame, 
                        current_subtitle["text"], 
                        caption_style,
                        current_time=adjusted_time,
                        words=current_subtitle.get("words", [])
                    )
            
            out.write(frame)
            frame_idx += 1
        
        cap.release()
        out.release()
        
        # Add audio back
        self._copy_audio(video_path, output_path)
        
        return output_path
    
    def _group_words_to_chunks(self, subtitles: List[Dict], words_per_chunk: int = 4) -> List[Dict]:
        """
        Group subtitle words into chunks with dynamic pause detection.
        Each chunk maintains word-level timing for karaoke sync.
        
        Args:
            subtitles: Original subtitle segments with words metadata
            words_per_chunk: Target words per chunk (default 4, lebih dinamis)
            
        Returns:
            New subtitle list with dynamic chunks
        """
        # Collect all words from all segments
        all_words = []
        for sub in subtitles:
            if "words" in sub and sub["words"]:
                for word in sub["words"]:
                    if word.get("word", "").strip():
                        all_words.append(word)
        
        if not all_words:
            return subtitles
        
        # Dynamic chunking with pause detection
        chunks = []
        current_chunk = []
        PAUSE_THRESHOLD = 0.5  # Jeda > 0.5s = chunk baru
        
        for i, word in enumerate(all_words):
            # Cek jeda dengan kata sebelumnya
            if current_chunk:
                prev_word = current_chunk[-1]
                pause = word["start"] - prev_word["end"]
                
                # Mulai chunk baru jika:
                # 1. Jeda > 0.5s (natural pause)
                # 2. Sudah mencapai target words_per_chunk
                if pause > PAUSE_THRESHOLD or len(current_chunk) >= words_per_chunk:
                    # Simpan chunk sebelumnya
                    chunk_text = " ".join(w["word"] for w in current_chunk)
                    chunks.append({
                        "start": current_chunk[0]["start"],
                        "end": current_chunk[-1]["end"],
                        "text": chunk_text,
                        "words": current_chunk
                    })
                    current_chunk = []
            
            current_chunk.append(word)
        
        # Simpan chunk terakhir
        if current_chunk:
            chunk_text = " ".join(w["word"] for w in current_chunk)
            chunks.append({
                "start": current_chunk[0]["start"],
                "end": current_chunk[-1]["end"],
                "text": chunk_text,
                "words": current_chunk
            })
        
        return chunks
    
    def render_full_overlay(self, video_path: str, hook_text: str, subtitles: List[Dict],
                            style: CaptionStyle, hook_duration: float = 3.0,
                            output_path: str = None, request_log_data: Dict = None,
                            hook_style: HookStyle = None) -> str:
        import subprocess
        
        if output_path is None:
            output_path = video_path.rsplit('.', 1)[0] + '_final.mp4'
        
        # Update keywords based on caption_response if available
        if request_log_data and 'caption_response' in request_log_data:
            self.hook_renderer.update_keywords(request_log_data['caption_response'])
            self.premium_hook.update_keywords(request_log_data['caption_response'])
        
        # Group subtitles into 4-word chunks with dynamic pause detection
        chunked_subtitles = self._group_words_to_chunks(subtitles, words_per_chunk=4)
        print(f"[Subtitle] Grouped {len(subtitles)} segments into {len(chunked_subtitles)} dynamic chunks (target 4 words/chunk)")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        hook_frames = int(hook_duration * fps)
        
        # HD output via FFmpeg pipe instead of OpenCV VideoWriter
        ffmpeg_cmd = [
            'ffmpeg',
            '-f', 'rawvideo',
            '-pix_fmt', 'bgr24',
            '-s', f'{width}x{height}',
            '-r', str(fps),
            '-i', '-',                    # Read from stdin pipe
            '-c:v', 'libx264',
            '-preset', 'fast',            # Fast encode, same visual quality
            '-crf', '18',                 # High quality, smaller file
            '-tune', 'film',              # Optimal for real-world video content
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-y',
            output_path
        ]
        
        # Write stderr to temp file to avoid pipe deadlock
        import tempfile
        stderr_file = tempfile.NamedTemporaryFile(mode='w', suffix='_ffmpeg_stderr.log', delete=False)
        
        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=stderr_file
        )
        
        frame_idx = 0
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                current_time = frame_idx / fps
                
                # Render hook for first N seconds (PREMIUM renderer)
                if frame_idx < hook_frames and hook_text and hook_text.strip():
                    if self._use_premium:
                        try:
                            frame = self.premium_hook.render(
                                frame, hook_text, hook_style,
                                current_time=current_time, hook_duration=hook_duration
                            )
                        except Exception as e:
                            # Fallback to legacy
                            frame = self.hook_renderer.create_hook_frame(
                                frame, hook_text, hook_style,
                                current_time=current_time, hook_duration=hook_duration
                            )
                    else:
                        frame = self.hook_renderer.create_hook_frame(
                            frame, hook_text, hook_style,
                            current_time=current_time, hook_duration=hook_duration
                        )
                else:
                    current_subtitle = None
                    lo, hi = 0, len(chunked_subtitles) - 1
                    while lo <= hi:
                        mid = (lo + hi) // 2
                        sub = chunked_subtitles[mid]
                        if sub["end"] <= current_time:
                            lo = mid + 1
                        elif sub["start"] > current_time:
                            hi = mid - 1
                        else:
                            current_subtitle = sub
                            break

                    if current_subtitle:
                        if self._use_premium:
                            try:
                                frame = self.premium_caption.render(
                                    frame, current_subtitle["text"], style,
                                    current_time=current_time,
                                    words=current_subtitle.get("words", []),
                                    chunk_start=current_subtitle.get("start"),
                                    chunk_end=current_subtitle.get("end"),
                                )
                            except Exception:
                                frame = self.subtitle_renderer.create_subtitle_frame(
                                    frame, current_subtitle["text"], style,
                                    current_time=current_time,
                                    words=current_subtitle.get("words", [])
                                )
                        else:
                            frame = self.subtitle_renderer.create_subtitle_frame(
                                frame, current_subtitle["text"], style,
                                current_time=current_time,
                                words=current_subtitle.get("words", [])
                            )

                # Write to FFmpeg pipe
                try:
                    proc.stdin.write(frame.tobytes())
                except BrokenPipeError:
                    print(f"[Overlay] ❌ FFmpeg pipe broken at frame {frame_idx}")
                    break
                frame_idx += 1
        finally:
            cap.release()
            try:
                proc.stdin.close()
            except BrokenPipeError:
                pass
            proc.wait()
            stderr_file.close()
        
        # Check FFmpeg result BEFORE proceeding
        ffmpeg_ok = proc.returncode == 0
        if not ffmpeg_ok:
            stderr_msg = ""
            try:
                with open(stderr_file.name, 'r') as f:
                    stderr_msg = f.read()[-500:]
                print(f"[Overlay] ❌ FFmpeg failed (rc={proc.returncode}): {stderr_msg}")
            except:
                pass
        
        # Clean up stderr temp file
        try:
            os.remove(stderr_file.name)
        except:
            pass
        
        # Verify output file is valid before audio merge
        if not ffmpeg_ok or not os.path.exists(output_path) or os.path.getsize(output_path) < 1024:
            raise RuntimeError(
                f"FFmpeg overlay render failed (rc={proc.returncode}). "
                f"Output file missing or corrupt: {output_path}"
            )
        
        print(f"[Overlay] ✅ Rendered {frame_idx} frames with hook + subtitles in HD")
        
        # Add audio back
        self._copy_audio(video_path, output_path)
        
        return output_path

    def render_full_overlay_on_source(self, video_path: str, tracking_data: Dict,
                                       hook_text: str, subtitles: List[Dict],
                                       style: CaptionStyle, hook_duration: float = 3.0,
                                       output_path: str = None,
                                       request_log_data: Dict = None,
                                       hook_style: HookStyle = None) -> str:
        import subprocess
        import tempfile
        
        # Lazily import cropper components
        from ..infrastructure.yolo_deepsort_tracker import (
            SmartCropper, HeadPositioner, TransitionBlender, LayoutManager
        )
        
        if output_path is None:
            output_path = video_path.rsplit('.', 1)[0] + '_final.mp4'
        
        # Update keywords based on caption_response if available
        if request_log_data and 'caption_response' in request_log_data:
            self.hook_renderer.update_keywords(request_log_data['caption_response'])
            self.premium_hook.update_keywords(request_log_data['caption_response'])
        
        # Group subtitles into 4-word chunks with dynamic pause detection
        chunked_subtitles = self._group_words_to_chunks(subtitles, words_per_chunk=4)
        print(f"[SinglePass] Grouped {len(subtitles)} segments into {len(chunked_subtitles)} dynamic chunks (target 4 words/chunk)")
        
        # Extract tracking dimensions
        fps = tracking_data['fps']
        orig_w = tracking_data['orig_w']
        orig_h = tracking_data['orig_h']
        out_w = tracking_data['out_w']
        out_h = tracking_data['out_h']
        half_h = tracking_data['half_h']
        crop_w = tracking_data['crop_w']
        crop_h = tracking_data['crop_h']
        grid_ratio = tracking_data['grid_ratio']
        positions = tracking_data['positions']
        
        hook_frames = int(hook_duration * fps)
        
        # Initialize cropper components
        head = HeadPositioner()
        cropper = SmartCropper(head)
        blender = TransitionBlender(crossfade_frames=12)
        

        
        # Open source video
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        # FFmpeg writer — SINGLE encode, HD quality
        ffmpeg_cmd = [
            'ffmpeg',
            '-f', 'rawvideo',
            '-pix_fmt', 'bgr24',
            '-s', f'{out_w}x{out_h}',
            '-r', str(fps),
            '-i', '-',                    # Read from stdin pipe
            '-c:v', 'libx264',
            '-preset', 'fast',            # Fast encode, same visual quality as slow
            '-crf', '18',                 # High quality, smaller file
            '-tune', 'film',              # Optimal for real-world video
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-y',
            output_path
        ]
        
        stderr_file = tempfile.NamedTemporaryFile(mode='w', suffix='_ffmpeg_single.log', delete=False)
        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=stderr_file
        )
        
        frame_idx = 0
        pos_idx = 0
        written = 0
        grid_frames = 0
        single_frames = 0
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                current_time = frame_idx / fps
                
                # ── Step A: CROP frame to 9:16 using tracking data ──
                if pos_idx < len(positions):
                    pos = positions[pos_idx]
                    pos_idx += 1
                else:
                    pos = {'persons': [], 'use_grid': False, 'speaker_id': None}
                
                persons = pos.get('persons', [])
                use_grid = pos.get('use_grid', False)
                
                if use_grid and len(persons) >= 2:
                    mode = 'grid'
                    top_person = pos.get('top_person', persons[0])
                    bottom_person = pos.get('bottom_person', persons[1])
                    
                    top_cell = cropper.crop_person_cell(
                        frame, top_person, grid_ratio, orig_w, orig_h,
                        out_w, half_h, headroom=0.30,
                        track_id=top_person.get('track_id', -1)
                    )
                    bottom_cell = cropper.crop_person_cell(
                        frame, bottom_person, grid_ratio, orig_w, orig_h,
                        out_w, half_h, headroom=0.28,
                        track_id=bottom_person.get('track_id', -1)
                    )
                    
                    cropped_frame = np.vstack([top_cell, bottom_cell])
                    cv2.line(cropped_frame, (0, half_h), (out_w, half_h),
                             (30, 30, 30), 2)
                    grid_frames += 1
                else:
                    mode = 'single'
                    if persons:
                        p = persons[0]
                        cropped_frame = cropper.crop_single(
                            frame, p['face_center'], 
                            p.get('face_box', (0, 0, 100, 100)),
                            crop_w, crop_h, orig_w, orig_h, out_w, out_h
                        )
                    else:
                        cx = orig_w // 2
                        cy = int(orig_h * 0.45)
                        x1 = max(0, cx - crop_w // 2)
                        y1 = max(0, cy - crop_h // 2)
                        x1 = min(x1, orig_w - crop_w)
                        y1 = min(y1, orig_h - crop_h)
                        cropped_frame = cv2.resize(
                            frame[y1:y1+crop_h, x1:x1+crop_w],
                            (out_w, out_h), interpolation=cv2.INTER_LINEAR
                        )
                    single_frames += 1
                
                # Apply transition blending
                cropped_frame = blender.blend(mode, frame_idx, cropped_frame)
                
                # ── Step B: OVERLAY (hook + subtitles) on cropped frame ──
                if frame_idx < hook_frames and hook_text and hook_text.strip():
                    if self._use_premium:
                        try:
                            cropped_frame = self.premium_hook.render(
                                cropped_frame, hook_text, hook_style,
                                current_time=current_time, hook_duration=hook_duration
                            )
                        except Exception:
                            cropped_frame = self.hook_renderer.create_hook_frame(
                                cropped_frame, hook_text, hook_style,
                                current_time=current_time, hook_duration=hook_duration
                            )
                    else:
                        cropped_frame = self.hook_renderer.create_hook_frame(
                            cropped_frame, hook_text, hook_style,
                            current_time=current_time, hook_duration=hook_duration
                        )
                else:
                    current_subtitle = None
                    # Binary search for current subtitle (O(log n) vs O(n))
                    lo, hi = 0, len(chunked_subtitles) - 1
                    while lo <= hi:
                        mid = (lo + hi) // 2
                        sub = chunked_subtitles[mid]
                        if sub["end"] <= current_time:
                            lo = mid + 1
                        elif sub["start"] > current_time:
                            hi = mid - 1
                        else:
                            current_subtitle = sub
                            break

                    if current_subtitle:
                        if self._use_premium:
                            try:
                                cropped_frame = self.premium_caption.render(
                                    cropped_frame, current_subtitle["text"], style,
                                    current_time=current_time,
                                    words=current_subtitle.get("words", []),
                                    chunk_start=current_subtitle.get("start"),
                                    chunk_end=current_subtitle.get("end"),
                                )
                            except Exception:
                                cropped_frame = self.subtitle_renderer.create_subtitle_frame(
                                    cropped_frame, current_subtitle["text"], style,
                                    current_time=current_time,
                                    words=current_subtitle.get("words", [])
                                )
                        else:
                            cropped_frame = self.subtitle_renderer.create_subtitle_frame(
                                cropped_frame, current_subtitle["text"], style,
                                current_time=current_time,
                                words=current_subtitle.get("words", [])
                            )
                
                # ── Write to FFmpeg (single encode) ──
                try:
                    proc.stdin.write(cropped_frame.tobytes())
                except BrokenPipeError:
                    print(f"[SinglePass] ❌ FFmpeg pipe broken at frame {frame_idx}")
                    break
                written += 1
                frame_idx += 1
                
        finally:
            cap.release()
            try:
                proc.stdin.close()
            except BrokenPipeError:
                pass
            proc.wait()
            stderr_file.close()
        
        # Check FFmpeg result BEFORE proceeding
        ffmpeg_ok = proc.returncode == 0
        if not ffmpeg_ok:
            stderr_msg = ""
            try:
                with open(stderr_file.name, 'r') as f:
                    stderr_msg = f.read()[-500:]
                print(f"[SinglePass] ❌ FFmpeg failed (rc={proc.returncode}): {stderr_msg}")
            except:
                pass
        
        try:
            os.remove(stderr_file.name)
        except:
            pass
        
        # Verify output file is valid before audio merge
        if not ffmpeg_ok or not os.path.exists(output_path) or os.path.getsize(output_path) < 1024:
            raise RuntimeError(
                f"FFmpeg single-pass render failed (rc={proc.returncode}). "
                f"Output file missing or corrupt: {output_path}"
            )
        
        print(f"[SinglePass] ✅ Rendered {written} frames "
              f"(single: {single_frames}, grid: {grid_frames}) — 1x encode only!")
        
        # Add audio back from source
        self._copy_audio(video_path, output_path)
        
        return output_path
    
    def _copy_audio(self, source_path: str, target_path: str):
        """Copy audio from source video to target using FFmpeg"""
        try:
            import subprocess
            
            # Check if source has audio
            source = VideoFileClip(source_path)
            has_audio = source.audio is not None
            source.close()
            
            if not has_audio:
                print("Source video has no audio")
                return
            
            # Use FFmpeg to copy audio stream directly (faster and more reliable)
            # IMPORTANT: source input options must come before -i source_path
            temp_path = target_path + '.with_audio.mp4'
            
            cmd = [
                'ffmpeg',
                '-i', target_path,      # Input 0: Video without audio
                '-i', source_path,      # Input 1: Source with audio
                '-map', '0:v:0',        # Take video from first input
                '-map', '1:a:0',        # Take audio from second input
                '-c:v', 'copy',         # Copy video codec (no re-encode)
                '-c:a', 'aac',          # Encode audio as AAC
                '-b:a', '192k',         # Audio bitrate
                '-shortest',            # Match shortest stream
                '-y',                   # Overwrite output
                temp_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                os.replace(temp_path, target_path)
                print(f"Audio successfully added to {os.path.basename(target_path)}")
            else:
                print(f"FFmpeg error: {result.stderr}")
                # Fallback to MoviePy method
                self._copy_audio_moviepy(source_path, target_path)
                
        except Exception as e:
            print(f"Warning: Could not copy audio with FFmpeg: {e}")
            # Fallback to MoviePy method
            self._copy_audio_moviepy(source_path, target_path)
    
    def _copy_audio_moviepy(self, source_path: str, target_path: str):
        """Fallback method using MoviePy"""
        try:
            source = VideoFileClip(source_path)
            if source.audio is not None:
                target = VideoFileClip(target_path)
                final = target.with_audio(source.audio)
                
                temp_path = target_path + '.temp.mp4'
                final.write_videofile(
                    temp_path,
                    codec='libx264',
                    audio_codec='aac',
                    bitrate='5000k',
                    logger=None
                )
                
                source.close()
                target.close()
                final.close()
                
                os.replace(temp_path, target_path)
                print(f"Audio added using MoviePy to {os.path.basename(target_path)}")
            else:
                source.close()
        except Exception as e:
            print(f"MoviePy audio copy failed: {e}")
