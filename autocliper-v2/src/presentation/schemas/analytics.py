"""
Analytics Schemas - Engagement, Audio, Stats
"""
from pydantic import BaseModel
from typing import Optional, List


class EngagementPredictRequest(BaseModel):
    hook_text: str
    duration_seconds: float
    has_trending_audio: bool = False


class AudioSuggestRequest(BaseModel):
    video_mood: str
    clip_duration: float
