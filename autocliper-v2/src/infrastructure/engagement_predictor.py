"""
Engagement Prediction Model — predicts viral potential of clips.

Uses a scoring model based on multiple signals:
- Hook quality (length, power words, question format)
- Content signals (duration, pacing, topic relevance)
- Historical performance data (if available)
- Platform-specific factors (TikTok vs Reels vs Shorts)

This is a rule-based model that can be upgraded to ML when enough data is collected.
"""
import re
import math
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ─── Power words that drive engagement ───────────────────────────────────────
POWER_WORDS_ID = {
    "shock": ["ternyata", "rahasia", "bahaya", "jangan", "harus", "wajib", "fatal", "salah", "mitos"],
    "curiosity": ["kenapa", "gimana", "caranya", "trik", "tips", "hack", "cara"],
    "urgency": ["sekarang", "segera", "cepat", "langsung", "hari ini", "stop"],
    "emotion": ["sedih", "marah", "kaget", "takut", "senang", "bangga", "malu"],
    "value": ["gratis", "mudah", "simpel", "cepat", "murah", "hemat", "efektif"],
}

POWER_WORDS_EN = {
    "shock": ["secret", "dangerous", "never", "must", "wrong", "myth", "truth", "exposed"],
    "curiosity": ["why", "how", "trick", "hack", "method", "way", "reason"],
    "urgency": ["now", "immediately", "stop", "today", "before", "hurry"],
    "emotion": ["sad", "angry", "shocked", "scared", "happy", "proud", "embarrassed"],
    "value": ["free", "easy", "simple", "fast", "cheap", "effective", "proven"],
}


@dataclass
class EngagementScore:
    """Detailed engagement prediction with breakdown."""
    overall_score: float  # 0.0 - 1.0
    hook_score: float
    content_score: float
    timing_score: float
    platform_scores: Dict[str, float] = field(default_factory=dict)  # per platform
    factors: List[str] = field(default_factory=list)  # human-readable factors
    suggestions: List[str] = field(default_factory=list)  # improvement suggestions
    predicted_views_range: str = ""  # e.g. "10K-50K"


class EngagementPredictor:
    """Predicts engagement potential for video clips."""

    def __init__(self):
        self._history_cache: Dict[str, float] = {}  # channel -> avg engagement

    def predict(
        self,
        hook: str,
        duration: float,
        score_from_ai: float,
        keywords: List[str] = None,
        channel_name: str = "",
        language: str = "id",
    ) -> EngagementScore:
        """Predict engagement score for a clip.
        
        Args:
            hook: The hook text
            duration: Clip duration in seconds
            score_from_ai: Score from Gemini AI analysis (0-1)
            keywords: Keywords extracted by AI
            channel_name: Source channel (for historical data)
            language: Content language
            
        Returns:
            EngagementScore with detailed breakdown
        """
        factors = []
        suggestions = []

        # ─── Hook Quality Score (0-1) ────────────────────────────────────
        hook_score = self._score_hook(hook, language, factors, suggestions)

        # ─── Content Score (0-1) ─────────────────────────────────────────
        content_score = self._score_content(duration, score_from_ai, keywords, factors, suggestions)

        # ─── Timing Score (0-1) ──────────────────────────────────────────
        timing_score = self._score_timing(duration, factors, suggestions)

        # ─── Platform-specific scores ────────────────────────────────────
        platform_scores = self._score_platforms(duration, hook_score, content_score)

        # ─── Overall weighted score ──────────────────────────────────────
        overall = (
            hook_score * 0.35 +      # Hook is king for short-form
            content_score * 0.35 +   # Content quality matters equally
            timing_score * 0.15 +    # Duration optimization
            score_from_ai * 0.15     # AI confidence
        )
        overall = min(1.0, max(0.0, overall))

        # ─── Predicted views range ───────────────────────────────────────
        views_range = self._predict_views_range(overall)

        return EngagementScore(
            overall_score=round(overall, 3),
            hook_score=round(hook_score, 3),
            content_score=round(content_score, 3),
            timing_score=round(timing_score, 3),
            platform_scores=platform_scores,
            factors=factors,
            suggestions=suggestions[:3],  # Top 3 suggestions
            predicted_views_range=views_range,
        )

    def predict_batch(self, clips: List[Dict]) -> List[EngagementScore]:
        """Predict engagement for multiple clips at once."""
        return [
            self.predict(
                hook=clip.get("hook", ""),
                duration=clip.get("end_time", 0) - clip.get("start_time", 0),
                score_from_ai=clip.get("score", 0.5),
                keywords=clip.get("keywords", []),
            )
            for clip in clips
        ]

    def _score_hook(self, hook: str, language: str, factors: List, suggestions: List) -> float:
        """Score hook text quality."""
        if not hook:
            suggestions.append("Add a compelling hook text")
            return 0.2

        score = 0.5  # Base score
        words = hook.split()
        word_count = len(words)

        # Length check (3-8 words is ideal)
        if 3 <= word_count <= 8:
            score += 0.15
            factors.append("✅ Hook length optimal (3-8 words)")
        elif word_count < 3:
            score -= 0.1
            suggestions.append("Hook terlalu pendek — tambah 1-2 kata lagi")
        elif word_count > 10:
            score -= 0.15
            suggestions.append("Hook terlalu panjang — potong jadi max 8 kata")

        # Power words check
        power_words = POWER_WORDS_ID if language == "id" else POWER_WORDS_EN
        hook_lower = hook.lower()
        found_categories = set()
        for category, words_list in power_words.items():
            for pw in words_list:
                if pw in hook_lower:
                    found_categories.add(category)
                    break

        if found_categories:
            score += min(0.2, len(found_categories) * 0.08)
            factors.append(f"✅ Power words: {', '.join(found_categories)}")
        else:
            suggestions.append("Tambah power word (rahasia, kenapa, harus, dll)")

        # Question format (high engagement)
        if "?" in hook or hook_lower.startswith(("kenapa", "gimana", "why", "how")):
            score += 0.1
            factors.append("✅ Question format (high curiosity)")

        # Open loop (no answer in hook)
        if len(hook) < 50 and "?" not in hook and "!" not in hook:
            # Short declarative — could be open loop
            score += 0.05

        # Caps/emphasis
        caps_ratio = sum(1 for c in hook if c.isupper()) / max(len(hook), 1)
        if 0.1 < caps_ratio < 0.5:
            score += 0.05
            factors.append("✅ Strategic emphasis (caps)")

        return min(1.0, max(0.0, score))

    def _score_content(self, duration: float, ai_score: float, keywords: List, factors: List, suggestions: List) -> float:
        """Score content quality signals."""
        score = ai_score * 0.6  # AI score is a strong signal

        # Keywords diversity
        if keywords and len(keywords) >= 2:
            score += 0.1
            factors.append(f"✅ Rich keywords ({len(keywords)} topics)")
        elif not keywords:
            suggestions.append("Clip kurang keyword — mungkin konten terlalu generic")

        # Duration-content ratio (30-45s is sweet spot for info density)
        if 30 <= duration <= 45:
            score += 0.15
            factors.append("✅ Optimal info density (30-45s)")
        elif 45 < duration <= 60:
            score += 0.1

        # AI confidence boost
        if ai_score >= 0.9:
            score += 0.1
            factors.append("✅ High AI confidence (>90%)")

        return min(1.0, max(0.0, score))

    def _score_timing(self, duration: float, factors: List, suggestions: List) -> float:
        """Score based on duration optimization for platforms."""
        # TikTok sweet spot: 21-34 seconds
        # Reels sweet spot: 15-30 seconds
        # Shorts sweet spot: 30-58 seconds

        if 25 <= duration <= 45:
            factors.append("✅ Duration in viral sweet spot (25-45s)")
            return 0.9
        elif 15 <= duration <= 60:
            return 0.7
        elif duration < 15:
            suggestions.append("Clip terlalu pendek (<15s) — kurang waktu untuk engage")
            return 0.4
        else:
            suggestions.append("Clip >60s — pertimbangkan potong lebih pendek")
            return 0.5

    def _score_platforms(self, duration: float, hook_score: float, content_score: float) -> Dict[str, float]:
        """Platform-specific engagement predictions."""
        base = (hook_score + content_score) / 2

        # TikTok favors: short, punchy, trend-aware
        tiktok = base
        if duration <= 34:
            tiktok += 0.1
        if hook_score > 0.7:
            tiktok += 0.05

        # Reels favors: slightly longer, polished
        reels = base
        if 15 <= duration <= 45:
            reels += 0.08

        # Shorts favors: informational, longer
        shorts = base
        if 30 <= duration <= 58:
            shorts += 0.1
        if content_score > 0.7:
            shorts += 0.05

        return {
            "tiktok": round(min(1.0, tiktok), 2),
            "reels": round(min(1.0, reels), 2),
            "shorts": round(min(1.0, shorts), 2),
        }

    def _predict_views_range(self, overall_score: float) -> str:
        """Estimate views range based on overall score."""
        if overall_score >= 0.9:
            return "50K-500K+"
        elif overall_score >= 0.8:
            return "10K-100K"
        elif overall_score >= 0.7:
            return "5K-50K"
        elif overall_score >= 0.6:
            return "1K-10K"
        elif overall_score >= 0.5:
            return "500-5K"
        else:
            return "<500"


# Singleton
engagement_predictor = EngagementPredictor()
