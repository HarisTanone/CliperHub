"""
Text Measurer Infrastructure - PIL-based text measurement for accurate positioning.

Uses the same font files as the renderer to ensure measurement/render consistency.
Accounts for letter_spacing which is critical for templates with non-zero spacing.
"""
from dataclasses import dataclass
from typing import List

from PIL import Image, ImageDraw, ImageFont


@dataclass
class TextMetrics:
    """Pixel-accurate text dimensions for a measured text string."""
    width: int
    height: int
    ascent: int
    descent: int


class TextMeasurer:
    """
    PIL-based text measurement for accurate positioning.
    
    Uses the same font files as the overlay renderer to ensure measured
    dimensions match rendered dimensions exactly. The letter_spacing parameter
    is critical — without it, templates with non-zero letter_spacing will have
    incorrect measured widths vs rendered widths.
    """

    def __init__(self, font_resolver):
        """
        Initialize TextMeasurer with a font resolver.
        
        Args:
            font_resolver: A TextRenderer instance used to resolve font family
                          names to actual .ttf/.otf file paths and load fonts.
        """
        self.font_resolver = font_resolver
        self._font_cache = {}

    def _get_font(self, font_path: str, font_size: int) -> ImageFont.FreeTypeFont:
        """Load a font from path with caching."""
        cache_key = f"{font_path}_{font_size}"
        if cache_key not in self._font_cache:
            try:
                self._font_cache[cache_key] = ImageFont.truetype(font_path, font_size)
            except Exception:
                self._font_cache[cache_key] = ImageFont.load_default()
        return self._font_cache[cache_key]

    def _compute_letter_spacing_extra(self, text: str, letter_spacing: float) -> int:
        """
        Compute extra width from letter_spacing.
        
        For N characters, total extra width is (N - 1) * letter_spacing pixels.
        This compensates for the spacing applied between each character pair
        during rendering.
        """
        char_count = len(text)
        if char_count <= 1:
            return 0
        return int(round((char_count - 1) * letter_spacing))

    def measure_line(self, text: str, font_path: str, font_size: int,
                     letter_spacing: float = 0) -> TextMetrics:
        """
        Measure a single line of text.
        
        Uses PIL's font.getbbox() for base width measurement, then adds
        letter_spacing pixel compensation: (N-1) * letter_spacing.
        Height is derived from font metrics (ascent + descent).
        
        Args:
            text: The text string to measure.
            font_path: Path to the .ttf/.otf font file.
            font_size: Font size in pixels.
            letter_spacing: Extra spacing between characters in pixels.
            
        Returns:
            TextMetrics with width, height, ascent, and descent.
        """
        if not text:
            font = self._get_font(font_path, font_size)
            ascent, descent = font.getmetrics()
            return TextMetrics(width=0, height=ascent + descent, ascent=ascent, descent=descent)

        font = self._get_font(font_path, font_size)
        
        # Get bounding box: (left, top, right, bottom)
        bbox = font.getbbox(text)
        base_width = bbox[2] - bbox[0]
        
        # Add letter_spacing compensation
        spacing_extra = self._compute_letter_spacing_extra(text, letter_spacing)
        total_width = base_width + spacing_extra
        
        # Get font metrics for consistent height
        ascent, descent = font.getmetrics()
        height = ascent + descent

        return TextMetrics(
            width=total_width,
            height=height,
            ascent=ascent,
            descent=descent
        )

    def measure_words(self, words: List[str], font_path: str, font_size: int,
                      letter_spacing: float = 0) -> List[TextMetrics]:
        """
        Measure each word individually.
        
        Args:
            words: List of word strings to measure.
            font_path: Path to the .ttf/.otf font file.
            font_size: Font size in pixels.
            letter_spacing: Extra spacing between characters in pixels.
            
        Returns:
            List of TextMetrics, one per word.
        """
        return [
            self.measure_line(word, font_path, font_size, letter_spacing)
            for word in words
        ]

    def wrap_text(self, text: str, font_path: str, font_size: int,
                  max_width: int, letter_spacing: float = 0) -> List[str]:
        """
        Wrap text into lines that fit within max_width.
        
        Uses a greedy algorithm: adds words to the current line until the next
        word would exceed max_width (including letter_spacing for the full line),
        then starts a new line.
        
        Args:
            text: The text to wrap.
            font_path: Path to the .ttf/.otf font file.
            font_size: Font size in pixels.
            max_width: Maximum line width in pixels.
            letter_spacing: Extra spacing between characters in pixels.
            
        Returns:
            List of line strings that each fit within max_width.
        """
        if not text or not text.strip():
            return []

        words = text.split()
        if not words:
            return []

        lines = []
        current_line_words = []

        for word in words:
            # Build test line with this word added
            test_line_words = current_line_words + [word]
            test_text = " ".join(test_line_words)
            
            # Measure the full test line including letter_spacing
            metrics = self.measure_line(test_text, font_path, font_size, letter_spacing)

            if metrics.width <= max_width:
                current_line_words.append(word)
            else:
                # Word doesn't fit — start new line
                if current_line_words:
                    lines.append(" ".join(current_line_words))
                    current_line_words = [word]
                else:
                    # Single word exceeds max_width — place it on its own line
                    lines.append(word)
                    current_line_words = []

        # Flush remaining words
        if current_line_words:
            lines.append(" ".join(current_line_words))

        return lines
