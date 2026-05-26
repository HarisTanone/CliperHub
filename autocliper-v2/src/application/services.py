"""
Application Services - Video Processing Pipeline
"""
import os
import shutil
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..domain.entities import (
    JobRequest, RequestLog, ClipData, CaptionStyle, 
    ProcessingState, ProcessingStatus, VideoInfo, SubtitleSegment
)
from ..infrastructure.repositories import CaptionStyleRepository, RequestLogRepository
from ..infrastructure.external_services import GeminiService, YouTubeDownloader
from ..infrastructure.video_processor import VideoClipper, AudioExtractor, WhisperService
from ..infrastructure.mouth_centered_face_tracker import MouthCenteredFaceTracker, MouthCenteredVideoCropper
from ..infrastructure.repositories import HookStyleRepository

# Try to import YOLOv8 + ByteTrack tracker (preferred)
try:
    from ..infrastructure.yolo_deepsort_tracker import YoloCenteredVideoCropper
    _HAS_YOLO = True
except ImportError:
    _HAS_YOLO = False
from ..infrastructure.overlay_renderer import OverlayRenderer
from ..infrastructure.database import database
from ..infrastructure.job_logger import job_logger
from ..infrastructure.job_queue import job_queue

import cv2
import numpy as np

# Setup logging
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('autocliper.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Pipeline Configuration (centralized magic numbers)
# ─────────────────────────────────────────────────────────────────────────────
PIPELINE_CONFIG = {
    "hook_duration_min": 2.0,       # seconds
    "hook_duration_max": 4.5,       # seconds
    "hook_reading_speed": 3.5,      # words per second
    "hook_padding": 0.8,            # extra seconds for fade in/out
    "words_per_chunk": 4,           # subtitle grouping
    "parallel_clips": False,        # set True for parallel processing (experimental)
    "audio_normalize": True,        # loudnorm filter
    "smart_thumbnail": True,        # pick sharpest frame for thumbnail
    "thumbnail_candidates": 5,      # number of frames to evaluate
}


def _calculate_hook_duration(hook_text: str) -> float:
    """Calculate dynamic hook duration based on word count and reading speed.
    
    Short hooks (2-3 words) → 2.0s
    Medium hooks (4-5 words) → 3.0s
    Long hooks (6-8 words) → 3.5-4.5s
    """
    words = hook_text.split()
    word_count = len(words)
    
    # Base duration from reading speed
    reading_time = word_count / PIPELINE_CONFIG["hook_reading_speed"]
    # Add padding for fade in/out
    duration = reading_time + PIPELINE_CONFIG["hook_padding"]
    
    # Clamp to min/max
    return max(
        PIPELINE_CONFIG["hook_duration_min"],
        min(PIPELINE_CONFIG["hook_duration_max"], duration)
    )


def _normalize_audio(video_path: str) -> bool:
    """Apply loudnorm audio normalization using FFmpeg 2-pass.
    
    Ensures consistent volume across all clips.
    Returns True if successful.
    """
    import subprocess
    import tempfile
    
    if not PIPELINE_CONFIG["audio_normalize"]:
        return False
    
    try:
        # Pass 1: Analyze loudness
        analyze_cmd = [
            'ffmpeg', '-i', video_path,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
            '-f', 'null', '-'
        ]
        result = subprocess.run(analyze_cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            return False
        
        # Pass 2: Apply normalization (simpler single-pass approach)
        temp_path = video_path + '.norm.mp4'
        norm_cmd = [
            'ffmpeg', '-i', video_path,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k',
            '-y', temp_path
        ]
        result = subprocess.run(norm_cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0 and os.path.exists(temp_path) and os.path.getsize(temp_path) > 1024:
            os.replace(temp_path, video_path)
            return True
        else:
            # Clean up failed attempt
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False
    except Exception as e:
        logger.warning(f"Audio normalization failed: {e}")
        return False


def _generate_smart_thumbnail(video_path: str, output_path: str) -> bool:
    """Generate thumbnail by picking the sharpest frame from multiple candidates.
    
    Evaluates frames at different timestamps and picks the one with
    highest Laplacian variance (sharpness indicator).
    """
    import cv2
    
    if not PIPELINE_CONFIG["smart_thumbnail"]:
        return False
    
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return False
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps > 0 else 0
        
        if duration < 2:
            cap.release()
            return False
        
        # Sample frames at different points (skip first 0.5s and last 0.5s)
        num_candidates = PIPELINE_CONFIG["thumbnail_candidates"]
        sample_times = [
            0.5 + (duration - 1.0) * i / (num_candidates - 1)
            for i in range(num_candidates)
        ]
        
        best_frame = None
        best_sharpness = -1
        
        for t in sample_times:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ret, frame = cap.read()
            if not ret:
                continue
            
            # Calculate sharpness using Laplacian variance
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if sharpness > best_sharpness:
                best_sharpness = sharpness
                best_frame = frame
        
        cap.release()
        
        if best_frame is not None:
            cv2.imwrite(output_path, best_frame)
            return True
        return False
    except Exception as e:
        logger.warning(f"Smart thumbnail failed: {e}")
        return False


class VideoProcessingPipeline:
    """Main video processing pipeline with modular architecture"""
    
    def __init__(self):
        self.output_dir = os.getenv("OUTPUT_DIR", "./tmp/output")
        
        # Initialize services
        self.gemini_service = GeminiService()
        self.youtube_downloader = YouTubeDownloader(self.output_dir)
        self.video_clipper = VideoClipper()
        self.audio_extractor = AudioExtractor()
        self.whisper_service = WhisperService()
        # Use YOLOv8 + DeepSORT if available, otherwise fallback to old tracker
        if _HAS_YOLO:
            logger.info("🚀 Using YOLOv8 + DeepSORT person tracker")
            self.face_tracker = None  # Not needed — YoloCropper handles tracking internally
            self.video_cropper = YoloCenteredVideoCropper(mouth_position_ratio=0.40, sample_rate=1)
            # Faster cropper for base processing (sample every 3rd frame — 3x faster)
            self.video_cropper_fast = YoloCenteredVideoCropper(mouth_position_ratio=0.40, sample_rate=3)
        else:
            logger.info("⚠️ YOLOv8 not available, using legacy MediaPipe tracker")
            self.face_tracker = MouthCenteredFaceTracker(sample_rate=1)
            self.video_cropper = MouthCenteredVideoCropper(mouth_position_ratio=0.40, sample_rate=1)
            self.video_cropper_fast = self.video_cropper
        self.overlay_renderer = OverlayRenderer()
        
        # Processing status
        self.status = ProcessingStatus(state=ProcessingState.PENDING)
    
    def process_job(self, job_request: JobRequest) -> Dict[str, Any]:
        """
        Main processing pipeline
        
        Args:
            job_request: Job request with YouTube URL and caption style
            
        Returns:
            Processing result with status and output paths
        """
        job_logger.reset(job_request.urls, user_id=job_request.user_id)

        session = database.get_session()
        request_log = None
        video_info = None
        
        try:
            # 1. Get caption style from database
            logger.info("Step 1: Getting caption style from database")
            self._update_status(ProcessingState.PENDING, "Getting caption style")
            job_logger.log("Getting caption style from database", "fetching_video")
            
            caption_repo = CaptionStyleRepository(session)
            caption_style = caption_repo.get_by_id(job_request.caption_style)
            if not caption_style:
                raise ValueError(f"Caption style {job_request.caption_style} not found")

            # Load hook style if provided
            hook_style = None
            if job_request.hook_style_id:
                hook_style = HookStyleRepository(session).get_by_id(job_request.hook_style_id)
                if not hook_style:
                    raise ValueError(f"Hook style {job_request.hook_style_id} not found")

            request_log_repo = RequestLogRepository(session)
            
            # 2. Check if URL already exists in database (cache check)
            logger.info("Step 2: Checking cache for existing video")
            job_logger.log("Checking cache for existing video", "fetching_video")
            existing_log = request_log_repo.get_by_youtube_url(job_request.urls)
            cached_video_path = None
            video_dir = None
            
            if existing_log and existing_log.output_path:
                # Check if original.mp4 still exists
                potential_path = os.path.join(existing_log.output_path, "original.mp4")
                if os.path.exists(potential_path):
                    logger.info(f"Cache HIT! Found existing video: {potential_path}")
                    job_logger.log(f"Cache HIT! Using existing video: {potential_path}", "fetching_video")
                    cached_video_path = potential_path
                    video_dir = existing_log.output_path
                    
                    # Clean up folder (delete everything except original.mp4)
                    self._cleanup_for_reprocess(video_dir)
                    logger.info("Cleaned up old processed files, keeping original.mp4")
                    job_logger.log("Cleaned up old processed files, keeping original.mp4")
            
            # 3. Download or use cached video
            if cached_video_path:
                logger.info("Step 3: Using cached video (skip download)")
                job_logger.log("Using cached video (skip download)")
                video_info = VideoInfo(
                    title="cached",
                    duration=0,
                    filepath=cached_video_path,
                    sanitized_title=os.path.basename(video_dir)
                )
            else:
                logger.info("Step 3: Downloading YouTube video")
                self._update_status(ProcessingState.DOWNLOADING, "Downloading video")
                job_logger.log("Downloading YouTube video...", "fetching_video")
                
                video_info = self.youtube_downloader.download(job_request.urls)
                video_dir = os.path.dirname(video_info.filepath)
                
                logger.info(f"Video downloaded to: {video_info.filepath}")
                job_logger.log(f"Video downloaded: {video_info.filepath}")
            
            # 4. Transcribe full video with Whisper C++ → send to Gemini AI
            logger.info("Step 4: Transcribing full video with Whisper C++ for AI analysis")
            self._update_status(ProcessingState.ANALYZING, "Transcribing full video with Whisper C++")
            job_logger.log("Transcribing full video with Whisper C++...", "analyzing_content")

            whisper_transcript = self.whisper_service.transcribe_full_video(video_info.filepath)
            if whisper_transcript:
                logger.info(f"Whisper transcript ready: {len(whisper_transcript)} chars")
                job_logger.log(f"Whisper transcript ready ({len(whisper_transcript)} chars), sending to Gemini AI")
            else:
                logger.warning("Whisper transcript empty, Gemini will fallback to YouTube captions")
                job_logger.log("⚠️ Whisper transcript empty, falling back to YouTube captions")

            clips = self.gemini_service.analyze_youtube_content(job_request.urls, video_info, whisper_transcript)
            logger.info(f"AI found {len(clips)} potential clips using Whisper transcript")
            job_logger.log(f"AI analysis complete — found {len(clips)} potential clips")
            
            # 5. Create/Update request log with AI results
            logger.info("Step 5: Saving to database")
            job_logger.log("Saving AI results to database")
            
            # Update output_path immediately since we have it
            request_log = RequestLog(
                id=None,
                youtube_url=job_request.urls,
                caption_style_id=job_request.caption_style,
                hook_style_id=job_request.hook_style_id,
                caption_response=clips,
                status=ProcessingState.PROCESSING,
                output_path=video_dir,
                user_id=job_request.user_id
            )
            saved_log = request_log_repo.create(request_log)
            request_log = saved_log

            # Update queue with actual DB job_id so cancel-by-id works
            job_queue.set_processing(job_request.urls, request_log.id)
            job_logger.set_request_id(request_log.id)
            
            # 6. Process each clip
            logger.info("Step 6: Processing clips")
            self._update_status(ProcessingState.PROCESSING, "Processing clips", 
                              total_clips=len(clips))
            job_logger.log(f"Starting clip generation — {len(clips)} clips to process", "generating_clips")
            job_logger.set_total_clips(len(clips))
            
            processed_clips = []
            
            if PIPELINE_CONFIG.get("parallel_clips") and len(clips) > 1:
                # ─── Parallel clip processing ────────────────────────────────
                from concurrent.futures import ThreadPoolExecutor as _TPE, as_completed
                max_parallel = min(3, len(clips))  # Max 3 parallel clips
                logger.info(f"⚡ Parallel processing enabled: {max_parallel} workers")
                job_logger.log(f"⚡ Parallel mode: {max_parallel} clips simultaneously")
                
                def _process_clip_wrapper(args):
                    i, clip = args
                    try:
                        output_path = self._process_single_clip(
                            video_path=video_info.filepath,
                            clip=clip,
                            caption_style=caption_style,
                            hook_style=hook_style,
                            output_dir=video_dir,
                            clip_index=i + 1,
                            all_clips=clips
                        )
                        return {"success": True, "index": clip.index, "output_path": output_path,
                                "hook": clip.hook, "duration": clip.end_time - clip.start_time, "clip_num": i + 1}
                    except Exception as e:
                        import traceback as _tb
                        error_trace = _tb.format_exc()
                        error_file = os.path.join(video_dir, f"error_clip_{i+1}.txt")
                        with open(error_file, 'w') as f:
                            f.write(f"Error processing clip {i+1}\n{error_trace}")
                        return {"success": False, "index": clip.index, "error": str(e), "clip_num": i + 1}
                
                with _TPE(max_workers=max_parallel, thread_name_prefix="clip_worker") as clip_executor:
                    futures = {clip_executor.submit(_process_clip_wrapper, (i, clip)): i 
                              for i, clip in enumerate(clips)}
                    
                    for future in as_completed(futures):
                        result = future.result()
                        if result["success"]:
                            processed_clips.append({
                                "index": result["index"],
                                "output_path": result["output_path"],
                                "hook": result["hook"],
                                "duration": result["duration"]
                            })
                            job_logger.set_clips_completed(len(processed_clips))
                            job_logger.log(f"✅ Clip {result['clip_num']} completed: {result['output_path']}")
                            logger.info(f"✅ Clip {result['clip_num']} COMPLETED (parallel)")
                        else:
                            job_logger.log(f"❌ Clip {result['clip_num']} failed: {result['error']}")
                            logger.error(f"❌ Clip {result['clip_num']} FAILED (parallel): {result['error']}")
            else:
                # ─── Sequential clip processing (default) ────────────────────
                for i, clip in enumerate(clips):
                    logger.info(f"\n{'='*60}")
                    logger.info(f"Processing clip {i+1}/{len(clips)}: {clip.start_time}s - {clip.end_time}s")
                    logger.info(f"Hook: {clip.hook}")
                    logger.info(f"{'='*60}\n")
                    self.status.clips_completed = i
                    job_logger.set_clips_completed(i)
                    job_logger.log(f"Clip {i+1}/{len(clips)}: {clip.start_time}s - {clip.end_time}s | Hook: {clip.hook}", "generating_clips")
                    
                    try:
                        output_path = self._process_single_clip(
                            video_path=video_info.filepath,
                            clip=clip,
                            caption_style=caption_style,
                            hook_style=hook_style,
                            output_dir=video_dir,
                            clip_index=i + 1,
                            all_clips=clips
                        )
                        processed_clips.append({
                            "index": clip.index,
                            "output_path": output_path,
                            "hook": clip.hook,
                            "duration": clip.end_time - clip.start_time
                        })
                        logger.info(f"\n✅ Clip {i+1} COMPLETED: {output_path}\n")
                        job_logger.set_clips_completed(i + 1)
                        job_logger.log(f"✅ Clip {i+1} completed: {output_path}")
                    except Exception as e:
                        logger.error(f"\n❌ FATAL ERROR processing clip {i+1}: {e}")
                        job_logger.log(f"❌ Clip {i+1} failed: {e}")
                        import traceback
                        error_trace = traceback.format_exc()
                        logger.error(error_trace)
                        
                        # Save error to file for debugging
                        error_file = os.path.join(video_dir, f"error_clip_{i+1}.txt")
                        with open(error_file, 'w') as f:
                            f.write(f"Error processing clip {i+1}\n")
                            f.write(f"Clip: {clip.start_time}s - {clip.end_time}s\n")
                            f.write(f"Hook: {clip.hook}\n\n")
                            f.write(error_trace)
                        logger.error(f"Error details saved to: {error_file}")
                    continue
            
            # 7. Cleanup temporary files
            logger.info("Step 7: Cleaning up temporary files")
            self._cleanup_temp_files(video_dir, video_info.filepath, processed_clips)
            
            # 8. Update final status
            request_log.status = ProcessingState.COMPLETED
            request_log.output_path = video_dir
            request_log_repo.update(request_log)
            
            self._update_status(ProcessingState.COMPLETED, "Completed",
                              clips_completed=len(processed_clips))
            job_logger.log(f"All done — {len(processed_clips)} clips processed successfully", "applying_captions")
            job_logger.mark_completed()
            
            return {
                "status": "success",
                "request_id": request_log.id,
                "clips_processed": len(processed_clips),
                "output_directory": video_dir,
                "clips": processed_clips
            }
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            self._update_status(ProcessingState.FAILED, str(e))
            job_logger.log(f"❌ Pipeline failed: {e}")
            job_logger.mark_failed(str(e))
            
            if request_log:
                request_log.status = ProcessingState.FAILED
                try:
                    request_log_repo.update(request_log)
                except Exception as update_err:
                    logger.error(f"Failed to update request_log status: {update_err}")
            
            raise
            
        finally:
            session.close()
    
    def _process_single_clip(self, video_path: str, clip: ClipData,
                             caption_style: CaptionStyle, output_dir: str,
                             clip_index: int, all_clips: List[ClipData],
                             hook_style=None) -> str:
        # Create temp directory for this clip
        temp_dir = os.path.join(output_dir, f"temp_clip_{clip_index}")
        os.makedirs(temp_dir, exist_ok=True)
        
        clipped_video_path = None
        audio_path = None
        cropped_path = None
        
        try:
            from moviepy import VideoFileClip
            
            # Ensure hook is never empty — use fallback if needed
            if not clip.hook or not clip.hook.strip():
                clip.hook = "Kamu harus tahu ini!"
                logger.warning(f"  ⚠️ Empty hook detected, using fallback: {clip.hook}")
            logger.info(f"  🎣 Hook: {clip.hook}")
            
            # Calculate dynamic hook duration based on hook text length
            hook_duration = _calculate_hook_duration(clip.hook)
            logger.info(f"  ⏱️ Dynamic hook duration: {hook_duration:.1f}s ({len(clip.hook.split())} words)")
            
            # Step 1: Cut video
            logger.info(f"  [1/6] Cutting video segment ({clip.start_time}s - {clip.end_time}s)")
            job_logger.log(f"  [Clip {clip_index}] Cutting segment {clip.start_time}s - {clip.end_time}s")
            clipped_video_path = os.path.join(temp_dir, f"clip_{clip_index}_raw.mp4")
            
            self.video_clipper.cut_video(
                video_path=video_path,
                start_time=clip.start_time,
                end_time=clip.end_time,
                output_path=clipped_video_path
            )
            logger.info(f"  ✅ Video cut completed (FFmpeg stream copy): {os.path.getsize(clipped_video_path) / 1024 / 1024:.1f}MB")
            job_logger.log(f"  [Clip {clip_index}] ✅ Video cut: {os.path.getsize(clipped_video_path) / 1024 / 1024:.1f}MB")
            
            # Step 2: Extract audio dari video yang sudah dipotong
            logger.info(f"  [2/6] Extracting audio")
            job_logger.log(f"  [Clip {clip_index}] Extracting audio")
            audio_path = os.path.join(temp_dir, f"audio_{clip_index}.wav")
            
            clipped = VideoFileClip(clipped_video_path)
            clipped.audio.write_audiofile(
                audio_path,
                fps=16000,
                nbytes=2,
                codec='pcm_s16le',
                logger=None
            )
            clipped.close()
            logger.info(f"  ✅ Audio extracted: {os.path.getsize(audio_path) / 1024 / 1024:.1f}MB")
            job_logger.log(f"  [Clip {clip_index}] ✅ Audio extracted: {os.path.getsize(audio_path) / 1024 / 1024:.1f}MB")
            
            # Step 3: Generate subtitles dengan Whisper
            logger.info(f"  [3/6] Generating subtitles with Whisper")
            job_logger.log(f"  [Clip {clip_index}] Generating subtitles with Whisper", "applying_captions")
            subtitles = self.whisper_service.generate_subtitles(audio_path)
            logger.info(f"  ✅ Subtitles generated: {len(subtitles)} segments")
            job_logger.log(f"  [Clip {clip_index}] ✅ Subtitles generated: {len(subtitles)} segments")
            
            # Subtitle dari Whisper sudah 0-based (detik 0 = awal clip).
            # Tidak perlu digeser — overlay renderer pakai current_time 0-based juga.
            # Hanya buang segment yang SELESAI sebelum hook (end <= hook_duration),
            # segment yang OVERLAP dengan hook tetap disimpan
            # agar kata pertama setelah hook tidak hilang.
            adjusted_subtitles = []
            for sub in subtitles:
                if sub["end"] <= hook_duration:
                    continue  # segment selesai sebelum hook habis, skip
                adjusted_words = [
                    w for w in sub.get("words", [])
                    if w["end"] > hook_duration  # buang kata yang selesai sebelum hook
                ]
                adjusted_subtitles.append({
                    "start": sub["start"],   # jaga timestamp asli Whisper
                    "end": sub["end"],
                    "text": sub["text"],
                    "words": adjusted_words
                })
            logger.info(f"  ✅ Subtitles adjusted: {len(adjusted_subtitles)} segments after {hook_duration:.1f}s hook")
            job_logger.log(f"  [Clip {clip_index}] ✅ Subtitles adjusted: {len(adjusted_subtitles)} segments (after {hook_duration:.1f}s hook)")
            
            # Step 4+5: Track faces (data only — NO video render)
            duration = clip.end_time - clip.start_time
            
            if _HAS_YOLO:
                # YOLOv8 + DeepSORT: track only, get data for single-pass
                logger.info(f"  [4-5/6] Tracking persons (YOLOv8+DeepSORT) — data only")
                try:
                    tracking_data = self.video_cropper.track_only(
                        video_path=clipped_video_path,
                        start_time=0,
                        end_time=duration
                    )
                    logger.info(f"  ✅ Tracking completed: {len(tracking_data['positions'])} frames")
                    job_logger.log(f"  [Clip {clip_index}] ✅ Tracking: {len(tracking_data['positions'])} frames")
                    
                    # Step 6: Single-pass crop + overlay (1x encode only!)
                    logger.info(f"  [6/6] Single-pass rendering (crop + overlay → 1x encode)")
                    job_logger.log(f"  [Clip {clip_index}] Rendering overlays (hook + captions)")
                    final_path = os.path.join(output_dir, f"clip_{clip_index}_final.mp4")
                    
                    self.overlay_renderer.render_full_overlay_on_source(
                        video_path=clipped_video_path,
                        tracking_data=tracking_data,
                        hook_text=clip.hook,
                        subtitles=adjusted_subtitles,
                        style=caption_style,
                        hook_duration=hook_duration,
                        output_path=final_path,
                        request_log_data={'caption_response': [c.__dict__ for c in all_clips]},
                        hook_style=hook_style
                    )
                    logger.info(f"  ✅ Single-pass render completed: {os.path.getsize(final_path) / 1024 / 1024:.1f}MB")
                    job_logger.log(f"  [Clip {clip_index}] ✅ Render complete: {os.path.getsize(final_path) / 1024 / 1024:.1f}MB")
                    
                except Exception as e:
                    logger.error(f"  ❌ Single-pass failed: {e}, falling back to legacy 2-pass")
                    import traceback
                    logger.error(traceback.format_exc())
                    
                    # Clean up corrupt output file before fallback
                    if os.path.exists(final_path):
                        try:
                            os.remove(final_path)
                        except OSError:
                            pass
                    
                    # Fallback to legacy 2-pass: crop → overlay (separate encodes)
                    cropped_path = os.path.join(temp_dir, f"cropped_{clip_index}.mp4")
                    
                    # Try YOLO crop
                    try:
                        self.video_cropper.crop_to_aspect_ratio(
                            video_path=clipped_video_path,
                            output_path=cropped_path,
                            start_time=0,
                            end_time=duration
                        )
                    except Exception as crop_err:
                        logger.error(f"  ❌ YOLO crop also failed: {crop_err}")
                        fallback_tracker = MouthCenteredFaceTracker(sample_rate=1)
                        fallback_cropper = MouthCenteredVideoCropper(mouth_position_ratio=0.40, sample_rate=1)
                        face_positions = fallback_tracker.track_speaking_face(clipped_video_path, 0, duration)
                        fallback_cropper.crop_to_aspect_ratio(
                            video_path=clipped_video_path,
                            face_positions=face_positions,
                            output_path=cropped_path,
                            start_time=0,
                            end_time=duration
                        )
                    
                    # Legacy overlay (2nd encode)
                    final_path = os.path.join(output_dir, f"clip_{clip_index}_final.mp4")
                    self.overlay_renderer.render_full_overlay(
                        video_path=cropped_path,
                        hook_text=clip.hook,
                        subtitles=adjusted_subtitles,
                        style=caption_style,
                        hook_duration=hook_duration,
                        output_path=final_path,
                        request_log_data={'caption_response': [c.__dict__ for c in all_clips]},
                        hook_style=hook_style
                    )
            else:
                # Legacy: separate tracking + cropping + overlay (2-pass)
                logger.info(f"  [4/6] Tracking faces with MediaPipe")
                cropped_path = os.path.join(temp_dir, f"cropped_{clip_index}.mp4")
                try:
                    face_positions = self.face_tracker.track_speaking_face(
                        clipped_video_path, start_time=0, end_time=duration
                    )
                    logger.info(f"  ✅ Face tracking completed: {len(face_positions)} positions")
                except Exception as e:
                    logger.warning(f"  ⚠️ Face tracking failed: {e}, using center crop")
                    face_positions = []
                
                logger.info(f"  [5/6] Cropping to 9:16 aspect ratio")
                try:
                    self.video_cropper.crop_to_aspect_ratio(
                        video_path=clipped_video_path,
                        face_positions=face_positions,
                        output_path=cropped_path,
                        start_time=0,
                        end_time=duration
                    )
                    logger.info(f"  ✅ Video cropped: {os.path.getsize(cropped_path) / 1024 / 1024:.1f}MB")
                except Exception as e:
                    logger.error(f"  ❌ Cropping failed: {e}")
                    raise
                
                # Step 6: Overlay hook + subtitle (legacy 2nd encode)
                logger.info(f"  [6/6] Rendering overlays (hook + subtitles)")
                final_path = os.path.join(output_dir, f"clip_{clip_index}_final.mp4")
                
                self.overlay_renderer.render_full_overlay(
                    video_path=cropped_path,
                    hook_text=clip.hook,
                    subtitles=adjusted_subtitles,
                    style=caption_style,
                    hook_duration=hook_duration,
                    output_path=final_path,
                    request_log_data={'caption_response': [c.__dict__ for c in all_clips]},
                    hook_style=hook_style
                )
                logger.info(f"  ✅ Overlays rendered: {os.path.getsize(final_path) / 1024 / 1024:.1f}MB")
            
            logger.info(f"  ✅✅✅ Clip {clip_index} FULLY completed: {final_path}")
            job_logger.log(f"  [Clip {clip_index}] ✅✅✅ Fully completed: {final_path}")

            # Audio normalization (consistent volume across clips)
            if _normalize_audio(final_path):
                logger.info(f"  🔊 Audio normalized (loudnorm -16 LUFS)")
                job_logger.log(f"  [Clip {clip_index}] 🔊 Audio normalized")
            
            # Generate smart thumbnail (pick sharpest frame)
            thumb_path = os.path.join(output_dir, f"clip_{clip_index}_thumb.jpg")
            if not _generate_smart_thumbnail(final_path, thumb_path):
                # Fallback: frame at 1s
                try:
                    import cv2 as _cv2
                    cap_t = _cv2.VideoCapture(final_path)
                    cap_t.set(_cv2.CAP_PROP_POS_MSEC, 1000)
                    ret_t, frame_t = cap_t.read()
                    if ret_t:
                        _cv2.imwrite(thumb_path, frame_t)
                    cap_t.release()
                except Exception as te:
                    logger.warning(f"  ⚠️ Thumbnail generation failed: {te}")

            return final_path
            
        except Exception as e:
            logger.error(f"  ❌❌❌ Fatal error in clip {clip_index} processing: {e}")
            import traceback
            error_trace = traceback.format_exc()
            logger.error(error_trace)
            raise
            
        finally:
            # Cleanup temp directory for this clip
            logger.info(f"  🧹 Cleaning up temp directory: {temp_dir}")
            try:
                # Close any open video handles first
                import gc
                gc.collect()
                
                # Wait a bit for file handles to release
                import time
                time.sleep(0.5)
                
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
                    logger.info(f"  ✅ Temp directory cleaned")
            except Exception as e:
                logger.warning(f"  ⚠️ Could not clean temp directory: {e}")
    
    def _cleanup_temp_files(self, video_dir: str, original_path: str, 
                           processed_clips: List[Dict]):
        """
        Clean up temporary files, keeping only original and final videos
        
        Args:
            video_dir: Video output directory
            original_path: Path to original video
            processed_clips: List of processed clip info
        """
        final_files = {os.path.basename(original_path)}
        for clip in processed_clips:
            final_files.add(os.path.basename(clip["output_path"]))
        
        for item in os.listdir(video_dir):
            item_path = os.path.join(video_dir, item)
            
            if item in final_files:
                continue
            
            try:
                if os.path.isdir(item_path):
                    # Remove temp directories
                    if item.startswith("temp_"):
                        shutil.rmtree(item_path)
                elif os.path.isfile(item_path):
                    # Remove temp files
                    if not item.endswith("_final.mp4") and item != os.path.basename(original_path):
                        os.remove(item_path)
            except Exception as e:
                logger.warning(f"Could not remove {item_path}: {e}")
    
    def _cleanup_for_reprocess(self, video_dir: str):
        """
        Clean up folder for reprocessing, keeping only original.mp4
        
        Args:
            video_dir: Video output directory
        """
        if not os.path.exists(video_dir):
            return
        
        for item in os.listdir(video_dir):
            item_path = os.path.join(video_dir, item)
            
            # Keep only original.mp4 and cached transcript
            if item == "original.mp4" or item.endswith(".json"):
                continue
            
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                elif os.path.isfile(item_path):
                    os.remove(item_path)
            except Exception as e:
                logger.warning(f"Could not remove {item_path}: {e}")
    
    def _update_status(self, state: ProcessingState, current_step: str,
                      progress: float = 0, total_clips: int = 0,
                      clips_completed: int = 0):
        """Update processing status"""
        self.status.state = state
        self.status.current_step = current_step
        self.status.progress = progress
        self.status.total_clips = total_clips
        self.status.clips_completed = clips_completed


    def process_job_base_only(self, job_request: JobRequest) -> Dict[str, Any]:
        """
        Base Processing Pipeline — NO styling applied.
        
        Runs: download → transcribe → AI analysis → clip detection → base crop render
        Does NOT apply: subtitle style, hook style, preset colors, animations, caption effects.
        
        Output: base clips (cropped 9:16, no overlays) + cached metadata for style rendering.
        """
        job_logger.reset(job_request.urls, user_id=job_request.user_id)

        session = database.get_session()
        request_log = None
        video_info = None
        
        try:
            # 1. Create a minimal request log entry
            logger.info("Step 1: Starting base processing pipeline (no styling)")
            job_logger.log("Starting base processing pipeline (no styling)", "fetching_video")
            
            request_log_repo = RequestLogRepository(session)
            
            # 2. Check cache
            logger.info("Step 2: Checking cache for existing video")
            job_logger.log("Checking cache for existing video", "fetching_video")
            existing_log = request_log_repo.get_by_youtube_url(job_request.urls)
            cached_video_path = None
            video_dir = None
            
            if existing_log and existing_log.output_path:
                potential_path = os.path.join(existing_log.output_path, "original.mp4")
                if os.path.exists(potential_path):
                    logger.info(f"Cache HIT! Found existing video: {potential_path}")
                    job_logger.log(f"Cache HIT! Using existing video: {potential_path}", "fetching_video")
                    cached_video_path = potential_path
                    video_dir = existing_log.output_path
                    self._cleanup_for_reprocess(video_dir)
            
            # 3. Download or use cached
            if cached_video_path:
                logger.info("Step 3: Using cached video (skip download)")
                job_logger.log("Using cached video (skip download)")
                video_info = VideoInfo(
                    title="cached",
                    duration=0,
                    filepath=cached_video_path,
                    sanitized_title=os.path.basename(video_dir)
                )
            else:
                logger.info("Step 3: Downloading YouTube video")
                self._update_status(ProcessingState.DOWNLOADING, "Downloading video")
                job_logger.log("Downloading YouTube video...", "fetching_video")
                video_info = self.youtube_downloader.download(job_request.urls)
                video_dir = os.path.dirname(video_info.filepath)
                logger.info(f"Video downloaded to: {video_info.filepath}")
                job_logger.log(f"Video downloaded: {video_info.filepath}")
            
            # 4. Transcribe full video with Whisper C++
            logger.info("Step 4: Transcribing full video with Whisper C++")
            self._update_status(ProcessingState.ANALYZING, "Transcribing full video")
            job_logger.log("Transcribing full video with Whisper C++...", "analyzing_content")
            
            whisper_transcript = self.whisper_service.transcribe_full_video(video_info.filepath)
            if whisper_transcript:
                logger.info(f"Whisper transcript ready: {len(whisper_transcript)} chars")
                job_logger.log(f"Whisper transcript ready ({len(whisper_transcript)} chars)")
            else:
                logger.warning("Whisper transcript empty")
                job_logger.log("⚠️ Whisper transcript empty, falling back to YouTube captions")
            
            # 5. AI clip detection
            clips = self.gemini_service.analyze_youtube_content(job_request.urls, video_info, whisper_transcript)
            logger.info(f"AI found {len(clips)} potential clips")
            job_logger.log(f"AI analysis complete — found {len(clips)} potential clips")
            
            # 6. Save to database (use caption_style=1 as placeholder for base processing)
            logger.info("Step 6: Saving to database")
            job_logger.log("Saving AI results to database")
            
            caption_style_id = job_request.caption_style if job_request.caption_style else 1
            
            request_log = RequestLog(
                id=None,
                youtube_url=job_request.urls,
                caption_style_id=caption_style_id,
                hook_style_id=None,  # No style for base processing
                caption_response=clips,
                status=ProcessingState.PROCESSING,
                output_path=video_dir,
                user_id=job_request.user_id
            )
            saved_log = request_log_repo.create(request_log)
            request_log = saved_log
            job_queue.set_processing(job_request.urls, request_log.id)
            job_logger.set_request_id(request_log.id)
            
            # 7. Process each clip — BASE ONLY (crop 9:16, no overlays)
            # Uses PARALLEL processing for speed since clips are independent
            logger.info("Step 7: Processing base clips (crop only, no styling) — PARALLEL")
            self._update_status(ProcessingState.PROCESSING, "Processing base clips",
                              total_clips=len(clips))
            job_logger.log(f"Starting base clip generation — {len(clips)} clips (parallel)", "generating_clips")
            job_logger.set_total_clips(len(clips))
            
            processed_clips = []
            
            if len(clips) > 1:
                # Parallel processing for base clips (no GPU contention since YOLO is sequential per clip)
                from concurrent.futures import ThreadPoolExecutor as _TPE, as_completed
                max_parallel = min(2, len(clips))  # 2 parallel max (memory constraint)
                logger.info(f"⚡ Parallel base processing: {max_parallel} workers")
                
                def _process_base_clip_wrapper(args):
                    i, clip = args
                    try:
                        output_path = self._process_single_clip_base(
                            video_path=video_info.filepath,
                            clip=clip,
                            output_dir=video_dir,
                            clip_index=i + 1,
                        )
                        return {"success": True, "index": clip.index, "output_path": output_path,
                                "hook": clip.hook, "duration": clip.end_time - clip.start_time,
                                "start_time": clip.start_time, "end_time": clip.end_time,
                                "score": clip.score, "keywords": clip.keywords, "clip_num": i + 1}
                    except Exception as e:
                        return {"success": False, "index": clip.index, "error": str(e), "clip_num": i + 1}
                
                with _TPE(max_workers=max_parallel, thread_name_prefix="base_clip") as executor:
                    futures = {executor.submit(_process_base_clip_wrapper, (i, clip)): i
                              for i, clip in enumerate(clips)}
                    
                    for future in as_completed(futures):
                        result = future.result()
                        if result["success"]:
                            processed_clips.append({
                                "index": result["index"],
                                "output_path": result["output_path"],
                                "hook": result["hook"],
                                "duration": result["duration"],
                                "start_time": result["start_time"],
                                "end_time": result["end_time"],
                                "score": result["score"],
                                "keywords": result["keywords"],
                            })
                            job_logger.set_clips_completed(len(processed_clips))
                            job_logger.log(f"✅ Base clip {result['clip_num']} completed")
                            logger.info(f"✅ Base clip {result['clip_num']} COMPLETED (parallel)")
                        else:
                            job_logger.log(f"❌ Base clip {result['clip_num']} failed: {result['error']}")
                            logger.error(f"❌ Base clip {result['clip_num']} FAILED: {result['error']}")
            else:
                # Single clip — sequential
                for i, clip in enumerate(clips):
                    logger.info(f"Processing base clip {i+1}/{len(clips)}: {clip.start_time}s - {clip.end_time}s")
                    self.status.clips_completed = i
                    job_logger.set_clips_completed(i)
                    job_logger.log(f"Clip {i+1}/{len(clips)}: {clip.start_time}s - {clip.end_time}s", "generating_clips")
                    
                    try:
                        output_path = self._process_single_clip_base(
                            video_path=video_info.filepath,
                            clip=clip,
                            output_dir=video_dir,
                            clip_index=i + 1,
                        )
                        processed_clips.append({
                            "index": clip.index,
                            "output_path": output_path,
                            "hook": clip.hook,
                            "duration": clip.end_time - clip.start_time,
                            "start_time": clip.start_time,
                            "end_time": clip.end_time,
                            "score": clip.score,
                            "keywords": clip.keywords,
                        })
                        logger.info(f"✅ Base clip {i+1} COMPLETED: {output_path}")
                        job_logger.set_clips_completed(i + 1)
                        job_logger.log(f"✅ Base clip {i+1} completed: {output_path}")
                    except Exception as e:
                        logger.error(f"❌ Base clip {i+1} failed: {e}")
                        job_logger.log(f"❌ Base clip {i+1} failed: {e}")
                    continue
            
            # 8. Update final status
            request_log.status = ProcessingState.COMPLETED
            request_log.output_path = video_dir
            request_log_repo.update(request_log)
            
            self._update_status(ProcessingState.COMPLETED, "Base processing completed",
                              clips_completed=len(processed_clips))
            job_logger.log(f"Base processing done — {len(processed_clips)} clips ready for styling", "applying_captions")
            job_logger.mark_completed()
            
            return {
                "status": "success",
                "request_id": request_log.id,
                "clips_processed": len(processed_clips),
                "output_directory": video_dir,
                "clips": processed_clips,
                "mode": "base_only"
            }
            
        except Exception as e:
            logger.error(f"Base pipeline error: {e}")
            self._update_status(ProcessingState.FAILED, str(e))
            job_logger.log(f"❌ Base pipeline failed: {e}")
            job_logger.mark_failed(str(e))
            
            if request_log:
                request_log.status = ProcessingState.FAILED
                try:
                    request_log_repo.update(request_log)
                except Exception:
                    pass
            raise
        finally:
            session.close()
    
    def _process_single_clip_base(self, video_path: str, clip: ClipData,
                                   output_dir: str, clip_index: int) -> str:
        """Process a single clip — BASE ONLY (crop 9:16, no overlays).
        
        Saves: base clip video + metadata JSON for later style rendering.
        """
        import json
        
        temp_dir = os.path.join(output_dir, f"temp_clip_{clip_index}")
        os.makedirs(temp_dir, exist_ok=True)
        
        try:
            from moviepy import VideoFileClip
            
            duration = clip.end_time - clip.start_time
            
            # Step 1: Cut video segment
            logger.info(f"  [1/4] Cutting video segment ({clip.start_time}s - {clip.end_time}s)")
            job_logger.log(f"  [Clip {clip_index}] Cutting segment")
            clipped_video_path = os.path.join(temp_dir, f"clip_{clip_index}_raw.mp4")
            
            self.video_clipper.cut_video(
                video_path=video_path,
                start_time=clip.start_time,
                end_time=clip.end_time,
                output_path=clipped_video_path
            )
            
            # Step 2: Extract audio + generate subtitles (cache for later style render)
            # OPTIMIZATION: Try to extract subtitles from full transcript cache first
            logger.info(f"  [2/4] Generating subtitles")
            job_logger.log(f"  [Clip {clip_index}] Generating subtitles")
            
            subtitles = self._get_subtitles_from_cache_or_whisper(
                video_path, clipped_video_path, clip, temp_dir, clip_index
            )
            logger.info(f"  ✅ Subtitles generated: {len(subtitles)} segments")
            
            # Step 3: Track person + crop to 9:16 (using FAST tracker — sample_rate=3)
            logger.info(f"  [3/4] Tracking + cropping to 9:16 (fast mode)")
            job_logger.log(f"  [Clip {clip_index}] Tracking + cropping (fast)")
            
            base_path = os.path.join(output_dir, f"clip_{clip_index}_base.mp4")
            
            if _HAS_YOLO:
                try:
                    tracking_data = self.video_cropper_fast.track_only(
                        video_path=clipped_video_path,
                        start_time=0,
                        end_time=duration
                    )
                    # Crop only — no overlays
                    self._render_base_crop(clipped_video_path, tracking_data, base_path)
                    logger.info(f"  ✅ Base crop completed (YOLO)")
                except Exception as e:
                    logger.warning(f"  ⚠️ YOLO crop failed: {e}, using center crop")
                    self._center_crop_video(clipped_video_path, base_path)
            else:
                # Legacy: MediaPipe face tracking + crop
                try:
                    face_positions = self.face_tracker.track_speaking_face(
                        clipped_video_path, start_time=0, end_time=duration
                    )
                    cropped_path = os.path.join(temp_dir, f"cropped_{clip_index}.mp4")
                    self.video_cropper.crop_to_aspect_ratio(
                        video_path=clipped_video_path,
                        face_positions=face_positions,
                        output_path=cropped_path,
                        start_time=0,
                        end_time=duration
                    )
                    # Copy to base path
                    shutil.copy2(cropped_path, base_path)
                except Exception as e:
                    logger.warning(f"  ⚠️ Face tracking failed: {e}, using center crop")
                    self._center_crop_video(clipped_video_path, base_path)
            
            # Step 4: Save metadata for later style rendering
            logger.info(f"  [4/4] Saving clip metadata")
            job_logger.log(f"  [Clip {clip_index}] Saving metadata")
            
            metadata = {
                "clip_index": clip_index,
                "start_time": clip.start_time,
                "end_time": clip.end_time,
                "duration": duration,
                "hook": clip.hook,
                "score": clip.score,
                "keywords": clip.keywords,
                "subtitles": subtitles,
                "base_video": os.path.basename(base_path),
                "source_video": os.path.basename(clipped_video_path),
            }
            
            metadata_path = os.path.join(output_dir, f"clip_{clip_index}_metadata.json")
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            
            # Keep the raw clipped video for potential re-render from source
            raw_keep_path = os.path.join(output_dir, f"clip_{clip_index}_raw.mp4")
            if not os.path.exists(raw_keep_path):
                shutil.copy2(clipped_video_path, raw_keep_path)
            
            # Generate thumbnail
            thumb_path = os.path.join(output_dir, f"clip_{clip_index}_thumb.jpg")
            _generate_smart_thumbnail(base_path, thumb_path)
            
            return base_path
            
        except Exception as e:
            logger.error(f"  ❌ Fatal error in base clip {clip_index}: {e}")
            raise
        finally:
            try:
                import gc
                gc.collect()
                import time
                time.sleep(0.3)
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
            except Exception:
                pass
    
    def _get_subtitles_from_cache_or_whisper(self, original_video_path: str,
                                               clipped_video_path: str,
                                               clip: ClipData, temp_dir: str,
                                               clip_index: int) -> list:
        """Get subtitles for a clip — tries full transcript cache first (instant),
        falls back to per-clip Whisper transcription if cache unavailable.
        
        This avoids running Whisper again for each clip when we already have
        the full video transcript cached from step 4.
        """
        import json
        from moviepy import VideoFileClip
        
        video_dir = os.path.dirname(original_video_path)
        cache_path = os.path.join(video_dir, "full_transcript.json")
        
        # Try to extract from full transcript cache (FAST — no Whisper needed)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r') as f:
                    full_data = json.load(f)
                
                segments = full_data.get("data", [])
                clip_start = clip.start_time
                clip_end = clip.end_time
                
                # Extract segments that overlap with this clip's time range
                clip_subtitles = []
                for seg in segments:
                    seg_start = float(seg[0])
                    seg_end = float(seg[1])
                    text = seg[2]
                    
                    # Check overlap
                    if seg_end > clip_start and seg_start < clip_end:
                        # Adjust timestamps to be relative to clip start (0-based)
                        adj_start = max(0, seg_start - clip_start)
                        adj_end = min(clip_end - clip_start, seg_end - clip_start)
                        
                        clip_subtitles.append({
                            "start": round(adj_start, 2),
                            "end": round(adj_end, 2),
                            "text": text,
                            "words": []  # No word-level timing from full transcript
                        })
                
                if clip_subtitles:
                    logger.info(f"  ⚡ Used cached full transcript ({len(clip_subtitles)} segments) — skipped Whisper")
                    return clip_subtitles
            except Exception as e:
                logger.warning(f"  ⚠️ Cache extraction failed: {e}, falling back to Whisper")
        
        # Fallback: Run Whisper on the clip audio (slower but has word-level timing)
        audio_path = os.path.join(temp_dir, f"audio_{clip_index}.wav")
        clipped = VideoFileClip(clipped_video_path)
        clipped.audio.write_audiofile(audio_path, fps=16000, nbytes=2, codec='pcm_s16le', logger=None)
        clipped.close()
        
        return self.whisper_service.generate_subtitles(audio_path)

    def _render_base_crop(self, video_path: str, tracking_data: Dict, output_path: str):
        """Render cropped 9:16 video from tracking data — NO overlays."""
        import subprocess
        import tempfile
        
        from ..infrastructure.yolo_deepsort_tracker import (
            SmartCropper, HeadPositioner, TransitionBlender, LayoutManager
        )
        
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
        
        head = HeadPositioner()
        cropper = SmartCropper(head)
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        stderr_file = tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False)
        
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-f', 'rawvideo', '-pix_fmt', 'bgr24',
            '-s', f'{out_w}x{out_h}', '-r', str(fps),
            '-i', '-',
            '-i', video_path,
            '-map', '0:v', '-map', '1:a?',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ]
        
        proc = subprocess.Popen(
            ffmpeg_cmd, stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL, stderr=stderr_file
        )
        
        frame_idx = 0
        pos_idx = 0
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Get tracking position for this frame
                if pos_idx < len(positions):
                    pos = positions[pos_idx]
                    pos_idx += 1
                else:
                    pos = {'persons': [], 'use_grid': False, 'speaker_id': None}
                
                persons = pos.get('persons', [])
                use_grid = pos.get('use_grid', False)
                
                if use_grid and len(persons) >= 2:
                    # Grid mode: top/bottom split
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
                elif persons:
                    # Single person mode
                    p = persons[0]
                    cropped_frame = cropper.crop_single(
                        frame, p['face_center'],
                        p.get('face_box', (0, 0, 100, 100)),
                        crop_w, crop_h, orig_w, orig_h, out_w, out_h
                    )
                else:
                    # No person detected — center crop
                    x1 = (orig_w - crop_w) // 2
                    y1 = (orig_h - crop_h) // 2
                    cropped_frame = frame[y1:y1+crop_h, x1:x1+crop_w]
                    if cropped_frame.shape[1] != out_w or cropped_frame.shape[0] != out_h:
                        cropped_frame = cv2.resize(cropped_frame, (out_w, out_h))
                
                proc.stdin.write(cropped_frame.tobytes())
                frame_idx += 1
        finally:
            cap.release()
            try:
                proc.stdin.close()
            except BrokenPipeError:
                pass
            proc.wait()
            stderr_file.close()
            try:
                os.remove(stderr_file.name)
            except:
                pass
        
        if proc.returncode != 0 or not os.path.exists(output_path):
            raise RuntimeError(f"Base crop render failed (rc={proc.returncode})")
    
    def _center_crop_video(self, video_path: str, output_path: str):
        """Simple center crop to 9:16 using FFmpeg."""
        import subprocess
        
        # Get video dimensions
        probe_cmd = ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                     '-show_entries', 'stream=width,height',
                     '-of', 'csv=p=0', video_path]
        result = subprocess.run(probe_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {result.stderr}")
        
        parts = result.stdout.strip().split(',')
        w, h = int(parts[0]), int(parts[1])
        
        # Calculate 9:16 crop
        target_ratio = 9 / 16
        current_ratio = w / h
        
        if current_ratio > target_ratio:
            # Too wide — crop width
            new_w = int(h * target_ratio)
            crop_filter = f"crop={new_w}:{h}:({w}-{new_w})/2:0"
        else:
            # Too tall — crop height
            new_h = int(w / target_ratio)
            crop_filter = f"crop={w}:{new_h}:0:({h}-{new_h})/2"
        
        cmd = [
            'ffmpeg', '-y', '-i', video_path,
            '-vf', f'{crop_filter},scale=608:1080',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
            '-c:a', 'aac', '-b:a', '192k',
            '-movflags', '+faststart',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Center crop failed: {result.stderr}")
    
    def apply_style_to_clips(self, job_id: int, caption_style_id: int,
                              hook_style_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Style Rendering Pipeline — Apply styling to existing base clips.
        
        Reads cached metadata + base clips, applies:
        - Hook overlay with selected hook style
        - Subtitle captions with selected caption style
        - All animations and effects
        
        This is a SEPARATE pipeline from base processing, enabling:
        - Fast re-render with different styles
        - Non-destructive editing
        - Reusable clip data
        """
        import json
        
        session = database.get_session()
        try:
            # Load job data
            request_log_repo = RequestLogRepository(session)
            request_log = request_log_repo.get_by_id(job_id)
            if not request_log:
                raise ValueError(f"Job {job_id} not found")
            
            video_dir = request_log.output_path
            if not video_dir or not os.path.exists(video_dir):
                raise ValueError(f"Output directory not found for job {job_id}")
            
            # Load caption style
            caption_repo = CaptionStyleRepository(session)
            caption_style = caption_repo.get_by_id(caption_style_id)
            if not caption_style:
                raise ValueError(f"Caption style {caption_style_id} not found")
            
            # Load hook style
            hook_style = None
            if hook_style_id:
                hook_style = HookStyleRepository(session).get_by_id(hook_style_id)
                if not hook_style:
                    raise ValueError(f"Hook style {hook_style_id} not found")
            
            # Find all clip metadata files
            metadata_files = sorted([
                f for f in os.listdir(video_dir)
                if f.endswith('_metadata.json')
            ])
            
            if not metadata_files:
                raise ValueError(f"No clip metadata found in {video_dir}")
            
            logger.info(f"Style render: {len(metadata_files)} clips, style={caption_style_id}, hook={hook_style_id}")
            job_logger.reset(request_log.youtube_url, user_id=request_log.user_id)
            job_logger.log(f"Starting style render — {len(metadata_files)} clips", "applying_captions")
            job_logger.set_total_clips(len(metadata_files))
            
            rendered_clips = []
            all_clips_data = []
            
            # Collect all clip data for keyword extraction
            for mf in metadata_files:
                with open(os.path.join(video_dir, mf), 'r') as f:
                    meta = json.load(f)
                    all_clips_data.append(meta)
            
            # Update keywords for hook renderer
            self.overlay_renderer.hook_renderer.update_keywords(all_clips_data)
            
            for idx, mf in enumerate(metadata_files):
                metadata_path = os.path.join(video_dir, mf)
                with open(metadata_path, 'r') as f:
                    meta = json.load(f)
                
                clip_index = meta['clip_index']
                hook_text = meta['hook']
                subtitles = meta['subtitles']
                duration = meta['duration']
                keywords = meta.get('keywords', [])
                
                # Use raw source video for best quality re-render
                raw_path = os.path.join(video_dir, f"clip_{clip_index}_raw.mp4")
                base_path = os.path.join(video_dir, meta['base_video'])
                
                # Calculate hook duration
                hook_duration = _calculate_hook_duration(hook_text)
                
                # Adjust subtitles (skip those during hook)
                adjusted_subtitles = []
                for sub in subtitles:
                    if sub["end"] <= hook_duration:
                        continue
                    adjusted_words = [
                        w for w in sub.get("words", [])
                        if w["end"] > hook_duration
                    ]
                    adjusted_subtitles.append({
                        "start": sub["start"],
                        "end": sub["end"],
                        "text": sub["text"],
                        "words": adjusted_words
                    })
                
                # Output path for styled clip
                final_path = os.path.join(video_dir, f"clip_{clip_index}_final.mp4")
                
                # Remove old styled version if exists
                if os.path.exists(final_path):
                    os.remove(final_path)
                
                job_logger.log(f"  [Clip {clip_index}] Applying style...", "applying_captions")
                
                try:
                    if _HAS_YOLO and os.path.exists(raw_path):
                        # Re-render from raw source with tracking + overlays
                        tracking_data = self.video_cropper.track_only(
                            video_path=raw_path,
                            start_time=0,
                            end_time=duration
                        )
                        
                        self.overlay_renderer.render_full_overlay_on_source(
                            video_path=raw_path,
                            tracking_data=tracking_data,
                            hook_text=hook_text,
                            subtitles=adjusted_subtitles,
                            style=caption_style,
                            hook_duration=hook_duration,
                            output_path=final_path,
                            request_log_data={'caption_response': all_clips_data},
                            hook_style=hook_style
                        )
                    elif os.path.exists(base_path):
                        # Render overlays on base cropped video
                        self.overlay_renderer.render_full_overlay(
                            video_path=base_path,
                            hook_text=hook_text,
                            subtitles=adjusted_subtitles,
                            style=caption_style,
                            hook_duration=hook_duration,
                            output_path=final_path,
                            request_log_data={'caption_response': all_clips_data},
                            hook_style=hook_style
                        )
                    else:
                        raise FileNotFoundError(f"No source video found for clip {clip_index}")
                    
                    # Audio normalization
                    if _normalize_audio(final_path):
                        logger.info(f"  🔊 Audio normalized for clip {clip_index}")
                    
                    rendered_clips.append({
                        "index": clip_index,
                        "output_path": final_path,
                        "hook": hook_text,
                        "duration": duration,
                    })
                    
                    job_logger.set_clips_completed(idx + 1)
                    job_logger.log(f"  [Clip {clip_index}] ✅ Style applied")
                    logger.info(f"✅ Style render clip {clip_index} completed")
                    
                except Exception as e:
                    logger.error(f"❌ Style render clip {clip_index} failed: {e}")
                    job_logger.log(f"  [Clip {clip_index}] ❌ Style render failed: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
            
            # Update request log with new style info
            request_log.caption_style_id = caption_style_id
            request_log.hook_style_id = hook_style_id
            request_log_repo.update(request_log)
            
            job_logger.log(f"Style render complete — {len(rendered_clips)} clips styled", "applying_captions")
            job_logger.mark_completed()
            
            return {
                "status": "success",
                "job_id": job_id,
                "clips_rendered": len(rendered_clips),
                "clips": rendered_clips,
                "caption_style_id": caption_style_id,
                "hook_style_id": hook_style_id,
            }
            
        except Exception as e:
            logger.error(f"Style render pipeline error: {e}")
            job_logger.log(f"❌ Style render failed: {e}")
            job_logger.mark_failed(str(e))
            raise
        finally:
            session.close()


# Backward compatibility alias
VideoProcessingService = VideoProcessingPipeline