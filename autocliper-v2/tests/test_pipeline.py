"""
Tests for pipeline utilities — hook duration, audio normalization, thumbnail.
"""
import pytest


def test_hook_duration_short():
    """Short hooks (1-2 words) get minimum duration."""
    from src.application.services import _calculate_hook_duration
    
    duration = _calculate_hook_duration("Kenapa?")
    assert duration == 2.0  # minimum


def test_hook_duration_medium():
    """Medium hooks (4-5 words) get proportional duration."""
    from src.application.services import _calculate_hook_duration
    
    duration = _calculate_hook_duration("Kenapa anak jadi GTM sekarang")
    assert 2.0 <= duration <= 3.5


def test_hook_duration_long():
    """Long hooks (8+ words) get longer duration but capped."""
    from src.application.services import _calculate_hook_duration
    
    duration = _calculate_hook_duration(
        "Ini adalah rahasia besar yang tidak pernah diceritakan oleh siapapun sebelumnya di dunia"
    )
    assert duration <= 4.5  # max cap


def test_hook_duration_scales_with_words():
    """Duration should increase with word count."""
    from src.application.services import _calculate_hook_duration
    
    short = _calculate_hook_duration("Kenapa?")
    medium = _calculate_hook_duration("Kenapa anak jadi GTM?")
    long = _calculate_hook_duration("Ini rahasia besar yang tidak pernah diceritakan siapapun sebelumnya")
    
    assert short <= medium <= long


def test_pipeline_config_exists():
    """Pipeline config should have all expected keys."""
    from src.application.services import PIPELINE_CONFIG
    
    expected_keys = [
        "hook_duration_min", "hook_duration_max", "hook_reading_speed",
        "hook_padding", "words_per_chunk", "parallel_clips",
        "audio_normalize", "smart_thumbnail", "thumbnail_candidates",
    ]
    for key in expected_keys:
        assert key in PIPELINE_CONFIG, f"Missing config key: {key}"


def test_clip_data_keywords():
    """ClipData should support keywords field."""
    from src.domain.entities import ClipData
    
    # With keywords
    clip = ClipData(
        index=1, start_time=0, end_time=30,
        hook="Kenapa anak GTM?", score=0.9, reason="test",
        keywords=["GTM"]
    )
    assert clip.keywords == ["GTM"]
    
    # Without keywords (default empty)
    clip2 = ClipData(
        index=2, start_time=30, end_time=60,
        hook="Test", score=0.8, reason="test"
    )
    assert clip2.keywords == []


def test_clip_overlap_removal():
    """Overlapping clips should be removed (keep higher score)."""
    from src.domain.entities import ClipData
    from src.infrastructure.external_services import GeminiService
    
    # Create overlapping clips (clip 2 overlaps >50% with clip 1)
    clips = [
        ClipData(index=1, start_time=0, end_time=50, hook="A", score=0.95, reason=""),
        ClipData(index=2, start_time=10, end_time=40, hook="B", score=0.90, reason=""),  # 100% inside clip 1
        ClipData(index=3, start_time=80, end_time=120, hook="C", score=0.88, reason=""),  # no overlap
    ]
    
    service = GeminiService.__new__(GeminiService)  # skip __init__
    result = service._remove_overlapping_clips(clips)
    
    # Clip 2 should be removed (fully inside clip 1)
    assert len(result) == 2
    assert result[0].hook == "A"
    assert result[1].hook == "C"
