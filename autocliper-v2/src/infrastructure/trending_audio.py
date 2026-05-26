"""
Trending Audio Service — suggests and matches trending sounds for clips.

Provides:
- Curated list of trending audio categories
- Audio mood detection from clip content
- Suggestions based on hook keywords and content type
- Integration-ready for future TikTok/Reels API

Note: Actual trending audio data requires platform API access.
This module provides the framework and rule-based suggestions.
"""
import os
import re
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class TrendingAudio:
    """Represents a trending audio/sound."""
    id: str
    name: str
    artist: str = ""
    category: str = ""  # motivational, funny, dramatic, chill, hype
    mood: str = ""
    bpm_range: str = ""  # e.g. "120-140"
    duration_range: str = ""  # e.g. "15-30s"
    platform: str = "all"  # tiktok, reels, shorts, all
    trending_score: float = 0.0  # 0-1
    usage_count: str = ""  # e.g. "1.2M"
    tags: List[str] = field(default_factory=list)


# ─── Curated trending audio categories ──────────────────────────────────────
# These represent common audio patterns that perform well on short-form platforms
AUDIO_CATEGORIES = {
    "motivational": {
        "description": "Uplifting, inspirational background music",
        "best_for": ["tips", "tutorial", "transformation", "success story"],
        "mood_keywords": ["semangat", "motivasi", "sukses", "tips", "cara", "rahasia"],
        "suggested_bpm": "100-130",
    },
    "dramatic": {
        "description": "Intense, attention-grabbing sounds",
        "best_for": ["reveal", "shocking fact", "controversy", "before/after"],
        "mood_keywords": ["ternyata", "bahaya", "jangan", "fatal", "shocking", "exposed"],
        "suggested_bpm": "80-120",
    },
    "funny": {
        "description": "Comedic, lighthearted audio",
        "best_for": ["comedy", "relatable", "meme", "reaction"],
        "mood_keywords": ["lucu", "kocak", "ngakak", "relate", "funny"],
        "suggested_bpm": "110-140",
    },
    "chill": {
        "description": "Relaxed, lo-fi style background",
        "best_for": ["storytelling", "vlog", "aesthetic", "day in life"],
        "mood_keywords": ["cerita", "pengalaman", "journey", "story", "life"],
        "suggested_bpm": "70-100",
    },
    "hype": {
        "description": "High energy, bass-heavy beats",
        "best_for": ["challenge", "trend", "dance", "sports", "gaming"],
        "mood_keywords": ["challenge", "trend", "viral", "epic", "insane"],
        "suggested_bpm": "130-160",
    },
    "emotional": {
        "description": "Touching, sentimental music",
        "best_for": ["personal story", "family", "loss", "gratitude"],
        "mood_keywords": ["sedih", "haru", "keluarga", "ibu", "ayah", "sayang"],
        "suggested_bpm": "60-90",
    },
    "educational": {
        "description": "Clean, neutral background for info content",
        "best_for": ["explainer", "how-to", "science", "tech"],
        "mood_keywords": ["fakta", "ilmu", "penjelasan", "data", "research"],
        "suggested_bpm": "90-120",
    },
}


class TrendingAudioService:
    """Service for suggesting trending audio based on clip content."""

    def __init__(self):
        self._trending_cache: List[TrendingAudio] = []
        self._last_refresh: Optional[datetime] = None

    def suggest_audio_category(
        self,
        hook: str,
        keywords: List[str] = None,
        duration: float = 30.0,
        language: str = "id",
    ) -> Dict:
        """Suggest the best audio category for a clip based on its content.
        
        Returns:
            Dict with category, confidence, alternatives, and reasoning
        """
        hook_lower = hook.lower() if hook else ""
        all_keywords = set((keywords or []) + hook_lower.split())

        scores = {}
        for cat_name, cat_info in AUDIO_CATEGORIES.items():
            score = 0.0
            matches = []
            
            for mood_kw in cat_info["mood_keywords"]:
                if mood_kw in hook_lower or mood_kw in " ".join(all_keywords).lower():
                    score += 0.3
                    matches.append(mood_kw)
            
            # Duration fit
            if cat_name in ("hype", "funny") and duration <= 30:
                score += 0.1
            elif cat_name in ("chill", "emotional", "educational") and duration >= 30:
                score += 0.1
            
            scores[cat_name] = {"score": score, "matches": matches}

        # Sort by score
        ranked = sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)
        
        best_cat = ranked[0][0] if ranked[0][1]["score"] > 0 else "motivational"
        best_score = ranked[0][1]["score"]
        
        # If no strong match, default based on content type
        if best_score == 0:
            if "?" in hook:
                best_cat = "educational"
            elif any(w in hook_lower for w in ["tips", "cara", "tutorial"]):
                best_cat = "motivational"
            else:
                best_cat = "dramatic"  # Safe default for attention

        alternatives = [r[0] for r in ranked[1:4] if r[1]["score"] > 0]

        return {
            "recommended_category": best_cat,
            "category_info": AUDIO_CATEGORIES[best_cat],
            "confidence": min(1.0, best_score + 0.3),  # Base confidence
            "alternatives": alternatives,
            "reasoning": f"Based on hook keywords matching '{best_cat}' mood",
            "suggested_bpm": AUDIO_CATEGORIES[best_cat]["suggested_bpm"],
        }

    def suggest_for_clips(self, clips: List[Dict]) -> List[Dict]:
        """Suggest audio categories for multiple clips."""
        return [
            {
                "clip_index": clip.get("index", i + 1),
                **self.suggest_audio_category(
                    hook=clip.get("hook", ""),
                    keywords=clip.get("keywords", []),
                    duration=clip.get("end_time", 30) - clip.get("start_time", 0),
                )
            }
            for i, clip in enumerate(clips)
        ]

    def get_categories(self) -> Dict:
        """Get all available audio categories with descriptions."""
        return AUDIO_CATEGORIES

    def get_trending_sounds(self, category: str = None, platform: str = "all", limit: int = 10) -> List[Dict]:
        """Get currently trending sounds.
        
        Note: In production, this would fetch from TikTok/Reels API.
        Currently returns curated suggestions.
        """
        # Placeholder trending sounds (would be fetched from API in production)
        sounds = [
            {"name": "Original Sound - Motivational", "category": "motivational", "usage": "2.1M", "platform": "tiktok"},
            {"name": "Dramatic Reveal", "category": "dramatic", "usage": "890K", "platform": "all"},
            {"name": "Lo-fi Study Beats", "category": "chill", "usage": "1.5M", "platform": "reels"},
            {"name": "Epic Cinematic", "category": "dramatic", "usage": "3.2M", "platform": "all"},
            {"name": "Funny Sound Effect", "category": "funny", "usage": "5.7M", "platform": "tiktok"},
            {"name": "Emotional Piano", "category": "emotional", "usage": "1.8M", "platform": "all"},
            {"name": "Bass Drop Hype", "category": "hype", "usage": "4.1M", "platform": "tiktok"},
            {"name": "Clean Explainer BG", "category": "educational", "usage": "670K", "platform": "shorts"},
        ]

        if category:
            sounds = [s for s in sounds if s["category"] == category]
        if platform != "all":
            sounds = [s for s in sounds if s["platform"] in (platform, "all")]

        return sounds[:limit]


# Singleton
trending_audio_service = TrendingAudioService()
