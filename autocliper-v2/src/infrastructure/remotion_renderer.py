"""
Remotion Render Worker
Background service yang poll remotion_render_jobs (status=pending)
dan menjalankan render via subprocess (npx remotion render).

Untuk saat ini, karena Remotion project belum di-bundle,
worker ini menggunakan fallback FFmpeg-based rendering yang meniru
output Remotion (overlay captions + hook di atas base clip).

Ketika Remotion project sudah siap, tinggal ganti method _render_via_remotion().
"""
import os
import json
import asyncio
import logging
import subprocess
import time
from datetime import datetime
from typing import Optional, Dict, Any

from .database import database
from .remotion_repository import (
    RemotionRenderJobRepository,
    RemotionCaptionTemplateRepository,
    RemotionHookTemplateRepository,
    RemotionCompositionRepository,
)

logger = logging.getLogger(__name__)

# Config
RENDER_POLL_INTERVAL = 5  # seconds
RENDER_CONCURRENCY = int(os.getenv("REMOTION_CONCURRENCY", "1"))
REMOTION_BUNDLE_DIR = os.getenv("REMOTION_BUNDLE_DIR", "")  # Path ke bundle, kosong = belum ada
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./tmp/output")


class RemotionRenderWorker:
    """
    Background worker yang memproses render jobs.
    Distart dari FastAPI lifespan.
    """

    def __init__(self):
        self._running = False
        self._active_renders = 0

    async def start(self):
        """Start the render worker loop."""
        self._running = True
        logger.info("🎬 Remotion render worker started")
        
        while self._running:
            try:
                await self._process_pending()
            except Exception as e:
                logger.error(f"Render worker error: {e}")
            await asyncio.sleep(RENDER_POLL_INTERVAL)

    def stop(self):
        """Stop the render worker."""
        self._running = False
        logger.info("🎬 Remotion render worker stopped")

    async def _process_pending(self):
        """Pick up pending jobs and render them."""
        if self._active_renders >= RENDER_CONCURRENCY:
            return

        session = database.get_session()
        try:
            repo = RemotionRenderJobRepository(session)
            pending = repo.get_pending(limit=RENDER_CONCURRENCY - self._active_renders)
            
            for job in pending:
                self._active_renders += 1
                try:
                    await self._render_job(job, session)
                except Exception as e:
                    logger.error(f"Render job #{job.id} failed: {e}")
                    repo.update_status(job.id, "failed", error_message=str(e))
                finally:
                    self._active_renders -= 1
        finally:
            session.close()

    async def _render_job(self, job, session):
        """Render a single job."""
        repo = RemotionRenderJobRepository(session)
        
        # Mark as rendering
        repo.update_status(job.id, "rendering", started_at=datetime.utcnow())
        logger.info(f"🎬 Rendering job #{job.id} (clip {job.clip_index})")

        start_time = time.time()

        # Load template configs
        caption_template = None
        hook_template = None

        if job.composition_id:
            comp = RemotionCompositionRepository(session).get_by_id(job.composition_id)
            if comp:
                if comp.caption_template_id:
                    caption_template = RemotionCaptionTemplateRepository(session).get_by_id(comp.caption_template_id)
                if comp.hook_template_id:
                    hook_template = RemotionHookTemplateRepository(session).get_by_id(comp.hook_template_id)

        # Override with direct template IDs if specified
        if job.caption_template_id:
            caption_template = RemotionCaptionTemplateRepository(session).get_by_id(job.caption_template_id)
        if job.hook_template_id:
            hook_template = RemotionHookTemplateRepository(session).get_by_id(job.hook_template_id)

        # Fallback to defaults
        if not caption_template:
            caption_template = RemotionCaptionTemplateRepository(session).get_default()
        if not hook_template:
            hook_template = RemotionHookTemplateRepository(session).get_default()

        # Determine output path
        input_dir = os.path.dirname(job.input_video_path)
        output_filename = f"clip_{job.clip_index}_remotion.mp4"
        output_path = os.path.join(input_dir, output_filename)

        # Try Remotion render first, fallback to FFmpeg
        success = False
        if REMOTION_BUNDLE_DIR and os.path.isdir(REMOTION_BUNDLE_DIR):
            success = await self._render_via_remotion(
                job, caption_template, hook_template, output_path
            )
        
        if not success:
            success = await self._render_via_ffmpeg(
                job, caption_template, hook_template, output_path
            )

        render_time_ms = int((time.time() - start_time) * 1000)

        if success and os.path.exists(output_path):
            repo.update_status(
                job.id, "completed",
                output_video_path=output_path,
                render_time_ms=render_time_ms,
                completed_at=datetime.utcnow(),
                progress_percent=100,
            )
            logger.info(f"✅ Render job #{job.id} completed in {render_time_ms}ms → {output_path}")
            
            # Increment composition use count
            if job.composition_id:
                RemotionCompositionRepository(session).increment_use_count(job.composition_id)
        else:
            # Retry logic
            if job.retry_count < job.max_retries:
                repo.update_status(
                    job.id, "pending",
                    retry_count=job.retry_count + 1,
                    error_message=f"Render failed, retry {job.retry_count + 1}/{job.max_retries}",
                    started_at=None,
                )
                logger.warning(f"⚠️ Render job #{job.id} failed, queued for retry")
            else:
                repo.update_status(
                    job.id, "failed",
                    error_message="Max retries exceeded",
                    render_time_ms=render_time_ms,
                )
                logger.error(f"❌ Render job #{job.id} failed after {job.max_retries} retries")

    async def _render_via_remotion(self, job, caption_template, hook_template, output_path) -> bool:
        """
        Render via Remotion CLI (npx remotion render).
        Requires bundle to be built first.
        """
        try:
            # Build input props
            props = self._build_remotion_props(job, caption_template, hook_template)
            props_json = json.dumps(props)

            cmd = [
                "npx", "remotion", "render",
                REMOTION_BUNDLE_DIR,
                "ClipComposition",
                output_path,
                "--props", props_json,
                "--codec", "h264",
                "--crf", "18",
            ]

            logger.info(f"  Running Remotion: {' '.join(cmd[:6])}...")
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, lambda: subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            ))

            if result.returncode == 0:
                return True
            else:
                logger.error(f"  Remotion stderr: {result.stderr[:500]}")
                return False

        except subprocess.TimeoutExpired:
            logger.error("  Remotion render timed out (300s)")
            return False
        except FileNotFoundError:
            logger.warning("  npx/remotion not found, falling back to FFmpeg")
            return False
        except Exception as e:
            logger.error(f"  Remotion render error: {e}")
            return False

    async def _render_via_ffmpeg(self, job, caption_template, hook_template, output_path) -> bool:
        """
        Fallback FFmpeg render: overlay hook text + styled captions on base clip.
        Simpler than Remotion but covers basic needs.
        """
        try:
            input_path = job.input_video_path
            if not os.path.exists(input_path):
                logger.error(f"  Input video not found: {input_path}")
                return False

            # Load subtitle data
            subtitles = job.subtitle_data or []
            if not subtitles and job.metadata_path and os.path.exists(job.metadata_path):
                with open(job.metadata_path, 'r') as f:
                    metadata = json.load(f)
                    subtitles = metadata.get("subtitles", [])

            # Build FFmpeg filter complex
            filters = []
            
            # Hook text overlay (first N seconds)
            if job.hook_text and hook_template:
                hook_duration = hook_template.display_duration_seconds or 3.0
                hook_color = (hook_template.color or "#FFFFFF").replace("#", "")
                hook_font_size = hook_template.font_size_keyword or 56
                
                # Escape text for FFmpeg
                hook_escaped = job.hook_text.replace("'", "\\'").replace(":", "\\:")
                
                filters.append(
                    f"drawtext=text='{hook_escaped}'"
                    f":fontsize={hook_font_size}"
                    f":fontcolor=0x{hook_color}"
                    f":x=(w-text_w)/2:y=(h-text_h)/2"
                    f":shadowcolor=black:shadowx=2:shadowy=2"
                    f":enable='between(t,0.5,{hook_duration})'"
                )

            # Caption/subtitle overlay (after hook)
            if subtitles and caption_template:
                cap_color = (caption_template.color or "#FFFFFF").replace("#", "")
                cap_font_size = caption_template.font_size or 48
                cap_y_pos = "h-120" if caption_template.position_y == "bottom" else "(h-text_h)/2"
                hook_dur = (hook_template.display_duration_seconds if hook_template else 3.0) or 3.0

                for seg in subtitles:
                    start = seg.get("start", 0)
                    end = seg.get("end", 0)
                    text = seg.get("text", "").replace("'", "\\'").replace(":", "\\:")
                    
                    if not text or end <= hook_dur:
                        continue

                    filters.append(
                        f"drawtext=text='{text}'"
                        f":fontsize={cap_font_size}"
                        f":fontcolor=0x{cap_color}"
                        f":x=(w-text_w)/2:y={cap_y_pos}"
                        f":shadowcolor=black:shadowx=1:shadowy=1"
                        f":enable='between(t,{start},{end})'"
                    )

            # Build command
            if filters:
                filter_str = ",".join(filters)
                cmd = [
                    "ffmpeg", "-y",
                    "-i", input_path,
                    "-vf", filter_str,
                    "-c:a", "copy",
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "18",
                    output_path,
                ]
            else:
                # No overlays needed, just copy
                cmd = [
                    "ffmpeg", "-y",
                    "-i", input_path,
                    "-c", "copy",
                    output_path,
                ]

            logger.info(f"  FFmpeg render: {len(filters)} filter(s)")
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, lambda: subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
            ))

            if result.returncode == 0:
                return True
            else:
                logger.error(f"  FFmpeg error: {result.stderr[:300]}")
                return False

        except Exception as e:
            logger.error(f"  FFmpeg render error: {e}")
            return False

    def _build_remotion_props(self, job, caption_template, hook_template) -> Dict[str, Any]:
        """Build the inputProps dict for Remotion render."""
        props: Dict[str, Any] = {
            "videoSrc": job.input_video_path,
            "hookText": job.hook_text or "",
            "subtitles": job.subtitle_data or [],
        }

        if caption_template:
            props["captionStyle"] = {
                "fontFamily": caption_template.font_family,
                "fontWeight": caption_template.font_weight,
                "fontSize": caption_template.font_size,
                "color": caption_template.color,
                "highlightColor": caption_template.highlight_color,
                "highlightStyle": caption_template.highlight_style,
                "outlineEnabled": bool(caption_template.outline_enabled),
                "outlineColor": caption_template.outline_color,
                "outlineWidth": caption_template.outline_width,
                "shadowEnabled": bool(caption_template.shadow_enabled),
                "shadowColor": caption_template.shadow_color,
                "shadowBlur": caption_template.shadow_blur,
                "bgEnabled": bool(caption_template.bg_enabled),
                "bgColor": caption_template.bg_color,
                "bgOpacity": caption_template.bg_opacity,
                "bgPerWord": bool(caption_template.bg_per_word),
                "positionY": caption_template.position_y,
                "positionYOffset": caption_template.position_y_offset,
                "maxWordsPerLine": caption_template.max_words_per_line,
                "animationIn": caption_template.animation_in,
                "animationInDuration": caption_template.animation_in_duration,
                "highlightTransition": caption_template.highlight_transition,
                "config": caption_template.config,
            }

        if hook_template:
            props["hookStyle"] = {
                "fontFamily": hook_template.font_family,
                "fontWeight": hook_template.font_weight,
                "fontSizeNormal": hook_template.font_size_normal,
                "fontSizeKeyword": hook_template.font_size_keyword,
                "color": hook_template.color,
                "keywordColor": hook_template.keyword_color,
                "shadowEnabled": bool(hook_template.shadow_enabled),
                "shadowColor": hook_template.shadow_color,
                "shadowBlur": hook_template.shadow_blur,
                "glowEnabled": bool(hook_template.glow_enabled),
                "glowColor": hook_template.glow_color,
                "glowRadius": hook_template.glow_radius,
                "animationType": hook_template.animation_type,
                "animationInDuration": hook_template.animation_in_duration,
                "displayDurationSeconds": hook_template.display_duration_seconds,
                "delayBeforeSeconds": hook_template.delay_before_seconds,
                "config": hook_template.config,
            }

        return props


# Singleton instance
render_worker = RemotionRenderWorker()
