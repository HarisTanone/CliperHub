"""
Comprehensive test suite for AutoCliper v2 improvements.
Run with: python -m pytest tests/test_comprehensive.py -v
Or directly: python tests/test_comprehensive.py
"""
import sys
import os
import time
import numpy as np

# Setup environment before imports
os.environ['JWT_SECRET_KEY'] = f'test_key_{int(time.time())}'
os.environ['JWT_REFRESH_SECRET_KEY'] = f'refresh_key_{int(time.time())}'
os.environ['DATABASE_URL'] = 'sqlite:///test_comprehensive.db'
os.environ['GEMINI_API_KEY'] = 'test'
os.environ['YOUTUBE_API_KEY'] = 'test'

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

PASS = 0
FAIL = 0


def test(name):
    """Decorator-like context for test reporting."""
    global PASS, FAIL
    class _Ctx:
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            global PASS, FAIL
            if exc_type:
                FAIL += 1
                print(f'  ❌ {name}: {exc_val}')
                return True  # Suppress exception
            PASS += 1
            print(f'  ✅ {name}')
            return False
    return _Ctx()


def run_all():
    global PASS, FAIL

    # ═══════════════════════════════════════════════════════════════════════
    print('═' * 60)
    print('  TEST 1: Domain Entities')
    print('═' * 60)

    from src.domain.entities import HookStyle, CaptionStyle, ClipData, JobRequest

    with test('HookStyle deep merge — new fields'):
        hs = HookStyle(id=1, name='t', config={'glow': {'enable': True, 'color': '#FF0000'}})
        cfg = hs.get_config()
        assert cfg['glow']['enable'] == True
        assert cfg['glow']['color'] == '#FF0000'
        assert cfg['glow']['radius'] == 8  # default
        assert cfg['outline']['enable'] == False  # default
        assert cfg['keyword']['background']['enable'] == False
        assert cfg['animation']['type'] == 'fade'  # default

    with test('HookStyle empty config = all defaults'):
        hs2 = HookStyle(id=2, name='empty')
        cfg2 = hs2.get_config()
        assert cfg2['text']['fallback_font'] == 'Anton'
        assert cfg2['shadow']['enable'] == True
        assert cfg2['glow']['enable'] == False
        assert cfg2['animation']['fade_in'] == 0.3

    with test('CaptionStyle extended config merge'):
        cs = CaptionStyle(id=1, name='t', config={
            'highlight': {'style': 'glow', 'glow_color': '#00FF00'},
            'background_pill': {'enable': True, 'color': '#111111'}
        })
        ext = cs.get_extended_config()
        assert ext['highlight']['style'] == 'glow'
        assert ext['highlight']['glow_color'] == '#00FF00'
        assert ext['highlight']['glow_radius'] == 6
        assert ext['background_pill']['enable'] == True
        assert ext['background_pill']['color'] == '#111111'
        assert ext['background_pill']['border_radius'] == 12

    with test('CaptionStyle empty config backward compat'):
        cs2 = CaptionStyle(id=2, name='empty')
        ext2 = cs2.get_extended_config()
        assert ext2['highlight']['style'] == 'color'
        assert ext2['background_pill']['enable'] == False
        assert ext2['animation']['chunk_enter'] == 'none'

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 2: Authentication System')
    print('═' * 60)

    from src.infrastructure import auth
    auth._revoked_refresh_tokens.clear()

    with test('Token pair creation'):
        access, refresh = auth.create_token_pair({'sub': '1', 'username': 'admin', 'role': 'admin'})
        assert access and refresh and access != refresh

    with test('Access token decode'):
        p = auth.decode_access_token(access)
        assert p['sub'] == '1' and p['type'] == 'access'

    with test('Refresh token decode'):
        p = auth.decode_refresh_token(refresh)
        assert p['sub'] == '1' and p['type'] == 'refresh' and p.get('jti')

    with test('Cross-type rejection'):
        assert auth.decode_access_token(refresh) is None
        assert auth.decode_refresh_token(access) is None

    with test('Token rotation'):
        # Use a fresh token for rotation test
        _, fresh_r = auth.create_token_pair({'sub': '10', 'username': 'rot', 'role': 'user'})
        result = auth.rotate_refresh_token(fresh_r)
        assert result is not None
        new_a, new_r, _ = result
        assert new_a and new_r

    with test('Old token revoked after rotation'):
        assert auth.rotate_refresh_token(fresh_r) is None

    with test('New token valid after rotation'):
        result2 = auth.rotate_refresh_token(new_r)
        assert result2 is not None

    with test('Explicit revocation'):
        _, r = auth.create_token_pair({'sub': '2', 'username': 'x', 'role': 'user'})
        auth.revoke_refresh_token(r)
        assert auth.decode_refresh_token(r) is None

    with test('Password hash/verify'):
        h = auth.hash_password('test123')
        assert auth.verify_password('test123', h)
        assert not auth.verify_password('wrong', h)

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 3: Redis Job Queue (fallback mode)')
    print('═' * 60)

    from src.infrastructure.job_queue import job_queue, QueuedJob

    with test('Queue initialization'):
        status = job_queue.get_status()
        assert 'backend' in status
        assert status['backend'] in ('redis', 'memory')

    with test('Enqueue jobs'):
        jr1 = JobRequest(urls='https://youtube.com/watch?v=aaa', caption_style=1, user_id=1)
        jr2 = JobRequest(urls='https://youtube.com/watch?v=bbb', caption_style=1, user_id=1)
        job_queue.enqueue(QueuedJob(job_request=jr1))
        job_queue.enqueue(QueuedJob(job_request=jr2))
        assert job_queue.is_queued('https://youtube.com/watch?v=aaa')
        assert job_queue.is_queued('https://youtube.com/watch?v=bbb')

    with test('Not queued check'):
        assert not job_queue.is_queued('https://youtube.com/watch?v=zzz')

    with test('Set processing'):
        job_queue.set_processing('https://youtube.com/watch?v=aaa', 42)
        assert job_queue.is_processing('https://youtube.com/watch?v=aaa')
        assert job_queue.is_processing_job_id(42)
        assert not job_queue.is_queued('https://youtube.com/watch?v=aaa')

    with test('Cancel queued job'):
        assert job_queue.cancel('https://youtube.com/watch?v=bbb')
        assert not job_queue.is_queued('https://youtube.com/watch?v=bbb')

    with test('Clear processing'):
        job_queue.set_processing(None)
        assert not job_queue.is_processing('https://youtube.com/watch?v=aaa')

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 4: Premium Renderer — Animation Engine')
    print('═' * 60)

    from src.infrastructure.premium_renderer import (
        AnimationEngine, AnimationState, TextEffects, SmartContrast,
        PremiumHookRenderer, PremiumCaptionRenderer,
        ease_out_cubic, ease_out_elastic, ease_out_bounce
    )

    engine = AnimationEngine()

    with test('Fade animation'):
        s = engine.compute(0.15, 3.0, {'type': 'fade', 'fade_in': 0.3, 'fade_out': 0.3})
        assert 0.0 < s.alpha <= 1.0  # Partially faded in
        assert s.scale == 1.0

    with test('Scale up animation'):
        s = engine.compute(0.3, 3.0, {'type': 'scale_up', 'fade_in': 0.3, 'fade_out': 0.3, 'scale_from': 0.7})
        assert s.alpha > 0.9
        assert s.scale > 0.95

    with test('Bounce animation'):
        s = engine.compute(0.15, 3.0, {'type': 'bounce', 'fade_in': 0.3, 'fade_out': 0.3})
        assert s.scale > 0.9
        assert s.alpha > 0.5

    with test('Slide up animation'):
        s = engine.compute(0.1, 3.0, {'type': 'slide_up', 'fade_in': 0.3, 'fade_out': 0.3, 'slide_distance': 60})
        assert s.offset_y > 0  # Still sliding

    with test('Typewriter animation'):
        s = engine.compute(0.25, 3.0, {'type': 'typewriter', 'fade_in': 0.5, 'fade_out': 0.3})
        assert 0.0 < s.word_reveal_progress <= 1.0

    with test('Blur reveal animation'):
        s = engine.compute(0.1, 3.0, {'type': 'blur_reveal', 'fade_in': 0.3, 'fade_out': 0.3})
        assert s.blur > 0

    with test('Glitch animation'):
        s = engine.compute(0.1, 3.0, {'type': 'glitch', 'fade_in': 0.3, 'fade_out': 0.3})
        assert s.alpha > 0

    with test('Hold phase (fully visible)'):
        s = engine.compute(1.5, 3.0, {'type': 'scale_up', 'fade_in': 0.3, 'fade_out': 0.3})
        assert s.alpha == 1.0
        assert s.scale == 1.0

    with test('Exit phase'):
        s = engine.compute(2.85, 3.0, {'type': 'fade', 'fade_in': 0.3, 'fade_out': 0.3})
        assert s.alpha < 1.0  # Fading out

    with test('Easing functions'):
        assert ease_out_cubic(0) == 0
        assert ease_out_cubic(1) == 1
        assert 0.8 < ease_out_cubic(0.5) < 0.95
        assert ease_out_elastic(1) == 1
        assert ease_out_bounce(1) == 1.0

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 5: Premium Renderer — Smart Contrast')
    print('═' * 60)

    with test('Bright background detection'):
        bright_frame = np.ones((100, 100, 3), dtype=np.uint8) * 220
        b = SmartContrast.analyze_region(bright_frame, 0, 100)
        assert b > 200
        assert SmartContrast.get_shadow_intensity(b) == 1.0
        assert SmartContrast.should_dim_background(b) == True

    with test('Dark background detection'):
        dark_frame = np.ones((100, 100, 3), dtype=np.uint8) * 30
        b = SmartContrast.analyze_region(dark_frame, 0, 100)
        assert b < 50
        assert SmartContrast.get_shadow_intensity(b) == 0.4
        assert SmartContrast.should_dim_background(b) == False

    with test('Mid-tone background'):
        mid_frame = np.ones((100, 100, 3), dtype=np.uint8) * 130
        b = SmartContrast.analyze_region(mid_frame, 0, 100)
        assert 100 < b < 150
        assert SmartContrast.should_dim_background(b) == True

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 6: Premium Hook Renderer — Full Render')
    print('═' * 60)

    hook_renderer = PremiumHookRenderer()
    hook_renderer.important_keywords = ['RAHASIA', 'DIET']

    with test('Basic hook render (fade)'):
        frame = np.zeros((1920, 1080, 3), dtype=np.uint8)
        style = HookStyle(id=1, name='test', config={'animation': {'type': 'fade', 'fade_in': 0.3, 'fade_out': 0.3}})
        result = hook_renderer.render(frame, 'Rahasia diet tanpa lapar', style, 1.5, 3.0)
        assert result.shape == (1920, 1080, 3)
        assert np.count_nonzero(result) > 0

    with test('Hook with glow + bounce'):
        style = HookStyle(id=2, name='glow', config={
            'glow': {'enable': True, 'color': '#00D4FF', 'opacity': 150, 'radius': 8, 'keyword_only': True},
            'animation': {'type': 'bounce', 'fade_in': 0.3, 'fade_out': 0.3}
        })
        result = hook_renderer.render(frame, 'Rahasia diet', style, 0.5, 3.0)
        assert np.count_nonzero(result) > 0

    with test('Hook with outline + keyword pill'):
        style = HookStyle(id=3, name='pill', config={
            'outline': {'enable': True, 'color': '#000000', 'width': 2},
            'keyword': {'background': {'enable': True, 'color': '#E84545', 'opacity': 200, 'border_radius': 6}},
            'animation': {'type': 'scale_up', 'fade_in': 0.4, 'scale_from': 0.7}
        })
        result = hook_renderer.render(frame, 'Rahasia diet tanpa lapar', style, 0.8, 3.0)
        assert np.count_nonzero(result) > 0

    with test('Hook with slide_up animation'):
        style = HookStyle(id=4, name='slide', config={
            'animation': {'type': 'slide_up', 'fade_in': 0.3, 'fade_out': 0.3, 'slide_distance': 50}
        })
        result = hook_renderer.render(frame, 'Test slide', style, 0.1, 3.0)
        assert result.shape == (1920, 1080, 3)

    with test('Hook with typewriter'):
        style = HookStyle(id=5, name='tw', config={
            'animation': {'type': 'typewriter', 'fade_in': 0.5, 'fade_out': 0.3}
        })
        result = hook_renderer.render(frame, 'Satu dua tiga empat', style, 0.25, 3.0)
        assert np.count_nonzero(result) > 0

    with test('Hook fully transparent at t=0'):
        style = HookStyle(id=6, name='t0', config={'animation': {'type': 'fade', 'fade_in': 0.3}})
        result = hook_renderer.render(frame, 'Test', style, 0.0, 3.0)
        # At t=0, alpha should be 0 → frame unchanged
        assert np.array_equal(result, frame)

    with test('Hook with box + border'):
        style = HookStyle(id=7, name='box', config={
            'box': {'enable': True, 'color': '#1E1B4B', 'opacity': 200, 'padding': 20, 'border_radius': 12, 'border_color': '#A78BFA', 'border_width': 2}
        })
        result = hook_renderer.render(frame, 'Box test', style, 1.5, 3.0)
        assert np.count_nonzero(result) > 0

    with test('Hook text_transform lowercase'):
        style = HookStyle(id=8, name='lower', config={'text': {'text_transform': 'lowercase'}})
        # Can't easily verify text content from pixels, but ensure no crash
        result = hook_renderer.render(frame, 'SHOULD BE LOWER', style, 1.5, 3.0)
        assert result.shape == (1920, 1080, 3)

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 7: Premium Caption Renderer — Full Render')
    print('═' * 60)

    caption_renderer = PremiumCaptionRenderer()
    frame = np.zeros((1920, 1080, 3), dtype=np.uint8)

    with test('Basic caption render'):
        style = CaptionStyle(id=1, name='basic', font_family='Arial', font_size=48,
                             color='#FFFFFF', highlight_color='#FFD700',
                             outline_color='#000000', outline_width=2,
                             shadow_color='#000000', shadow_offset_x=2, shadow_offset_y=2,
                             line_spacing=1.3, caption_bottom_margin=80)
        words = [{'word': 'hello', 'start': 0.0, 'end': 0.5}, {'word': 'world', 'start': 0.5, 'end': 1.0}]
        result = caption_renderer.render(frame, 'hello world', style, 0.3, words)
        assert np.count_nonzero(result) > 0

    with test('Caption with background pill'):
        style = CaptionStyle(id=2, name='pill', font_family='Arial', font_size=48,
                             color='#FFFFFF', highlight_color='#FFD700',
                             outline_color='#000000', outline_width=0,
                             shadow_color='#000000', shadow_offset_x=0, shadow_offset_y=0,
                             line_spacing=1.3, caption_bottom_margin=80,
                             config={'background_pill': {'enable': True, 'color': '#000000', 'opacity': 180, 'border_radius': 10}})
        result = caption_renderer.render(frame, 'pill test', style, 0.3, words)
        assert np.count_nonzero(result) > 0

    with test('Caption with glow highlight'):
        style = CaptionStyle(id=3, name='glow', font_family='Arial', font_size=48,
                             color='#FFFFFF', highlight_color='#00FF00',
                             outline_color='#000000', outline_width=2,
                             shadow_color='#000000', shadow_offset_x=2, shadow_offset_y=2,
                             line_spacing=1.3, caption_bottom_margin=80,
                             config={'highlight': {'style': 'glow', 'glow_color': '#00FF00', 'glow_radius': 8}})
        result = caption_renderer.render(frame, 'glow test', style, 0.3, words)
        assert np.count_nonzero(result) > 0

    with test('Caption with background highlight'):
        style = CaptionStyle(id=4, name='bg_hl', font_family='Arial', font_size=48,
                             color='#FFFFFF', highlight_color='#FFD700',
                             outline_color='#000000', outline_width=0,
                             shadow_color='#000000', shadow_offset_x=0, shadow_offset_y=0,
                             line_spacing=1.3, caption_bottom_margin=80,
                             config={'highlight': {'style': 'background', 'background_color': '#FFD700', 'background_opacity': 200}})
        result = caption_renderer.render(frame, 'bg highlight', style, 0.3, words)
        assert np.count_nonzero(result) > 0

    with test('Caption chunk enter animation (pop)'):
        style = CaptionStyle(id=5, name='pop', font_family='Arial', font_size=48,
                             color='#FFFFFF', highlight_color='#FFD700',
                             outline_color='#000000', outline_width=2,
                             shadow_color='#000000', shadow_offset_x=2, shadow_offset_y=2,
                             line_spacing=1.3, caption_bottom_margin=80,
                             config={'animation': {'chunk_enter': 'pop', 'enter_duration': 0.1}})
        result = caption_renderer.render(frame, 'pop test', style, 0.05, words, chunk_start=0.0)
        assert np.count_nonzero(result) > 0

    with test('Caption with uppercase transform'):
        style = CaptionStyle(id=6, name='upper', font_family='Arial', font_size=48,
                             color='#FFFFFF', highlight_color='#FFD700',
                             outline_color='#000000', outline_width=0,
                             shadow_color='#000000', shadow_offset_x=0, shadow_offset_y=0,
                             line_spacing=1.3, caption_bottom_margin=80,
                             config={'text_transform': 'uppercase'})
        result = caption_renderer.render(frame, 'should be upper', style, 0.3, words)
        assert np.count_nonzero(result) > 0

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 8: Engagement Predictor')
    print('═' * 60)

    from src.infrastructure.engagement_predictor import engagement_predictor

    with test('Basic prediction'):
        result = engagement_predictor.predict(
            hook='Kenapa anak jadi GTM?', duration=35.0,
            score_from_ai=0.92, keywords=['GTM'], language='id'
        )
        assert 0.7 < result.overall_score <= 1.0
        assert result.platform_scores['tiktok'] > 0
        assert result.predicted_views_range != ''

    with test('Low quality prediction'):
        result = engagement_predictor.predict(
            hook='a', duration=5.0, score_from_ai=0.3, keywords=[], language='id'
        )
        assert result.overall_score < 0.5
        assert len(result.suggestions) > 0

    with test('Batch prediction'):
        clips = [
            {'hook': 'Rahasia sukses', 'start_time': 0, 'end_time': 35, 'score': 0.9, 'keywords': ['RAHASIA']},
            {'hook': 'Tips mudah', 'start_time': 40, 'end_time': 80, 'score': 0.7, 'keywords': ['TIPS']},
        ]
        results = engagement_predictor.predict_batch(clips)
        assert len(results) == 2
        assert results[0].overall_score > results[1].overall_score

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 9: Trending Audio Service')
    print('═' * 60)

    from src.infrastructure.trending_audio import trending_audio_service

    with test('Get categories'):
        cats = trending_audio_service.get_categories()
        assert 'motivational' in cats
        assert 'dramatic' in cats
        assert len(cats) >= 7

    with test('Suggest audio category'):
        result = trending_audio_service.suggest_audio_category(
            hook='Kenapa anak jadi GTM?', keywords=['GTM', 'anak'], duration=35.0
        )
        assert 'recommended_category' in result
        assert 'suggested_bpm' in result

    with test('Get trending sounds'):
        sounds = trending_audio_service.get_trending_sounds(limit=5)
        assert len(sounds) <= 5
        assert all('name' in s for s in sounds)

    with test('Filter by category'):
        sounds = trending_audio_service.get_trending_sounds(category='dramatic')
        assert all(s['category'] == 'dramatic' for s in sounds)

    with test('Suggest for clips'):
        clips = [{'hook': 'Bahaya!', 'keywords': ['BAHAYA'], 'start_time': 0, 'end_time': 30}]
        suggestions = trending_audio_service.suggest_for_clips(clips)
        assert len(suggestions) == 1
        assert 'recommended_category' in suggestions[0]

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 10: WebSocket Manager')
    print('═' * 60)

    from src.infrastructure.websocket_manager import ws_manager

    with test('Manager initialization'):
        assert ws_manager.total_connections == 0

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print('  TEST 11: Frontend Build')
    print('═' * 60)

    with test('Frontend builds successfully'):
        import subprocess
        result = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'autocliper-v2-FE'),
            capture_output=True, text=True, timeout=30
        )
        assert result.returncode == 0, f'Build failed: {result.stderr[-200:]}'

    # ═══════════════════════════════════════════════════════════════════════
    print()
    print('═' * 60)
    print(f'  RESULTS: {PASS} passed, {FAIL} failed')
    print('═' * 60)

    # Cleanup
    try:
        os.remove('test_comprehensive.db')
    except:
        pass

    return FAIL == 0


if __name__ == '__main__':
    success = run_all()
    sys.exit(0 if success else 1)
