"""JobService — Application layer orchestrator for the full pipeline.

New architecture (v0.2):
  validate → download → YouTube Transcript API → Gemini (1 pass)
  → silence detection → trim clips → Whisper per clip (local)
  → Gemini highlight pass → assemble final JSON
"""
import asyncio
import json
import logging
import os
import secrets
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from src.config import settings
from src.domain.entities import Clip, Job, JobStatus, Subtitle, Word
from src.domain.interfaces import (
    IDownloader,
    IGeminiAnalyzer,
    IJobRepository,
    IRenderer,
    ITranscriptFetcher,
    IValidator,
    IWhisperLocal,
)
from src.infrastructure.step_timer import StepTimer

logger = logging.getLogger(__name__)

# Semaphore untuk membatasi concurrent pipeline jobs
MAX_CONCURRENT_JOBS = settings.MAX_CONCURRENT_JOBS
_pipeline_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)


class JobService:
    def __init__(
        self,
        job_repo: IJobRepository,
        downloader: IDownloader,
        transcript_fetcher: ITranscriptFetcher,
        gemini_analyzer: IGeminiAnalyzer,
        whisper_local: IWhisperLocal,
        renderer: IRenderer,
        validator: IValidator,
    ):
        self._repo = job_repo
        self._downloader = downloader
        self._transcript = transcript_fetcher
        self._gemini = gemini_analyzer
        self._whisper = whisper_local
        self._renderer = renderer
        self._validator = validator

    def _generate_job_id(self) -> str:
        return f"job_{secrets.token_hex(6)}"

    def _calc_max_clips(self, duration: float) -> int:
        """Dynamic max clips based on video duration."""
        if duration < 180:
            return 2
        elif duration < 600:
            return 5
        elif duration < 1800:
            return 8
        else:
            return 10

    async def create_job(self, youtube_url: str) -> Job:
        """Validasi URL, buat job record, dan start pipeline di background."""
        existing = await self._repo.get_by_url_active(youtube_url)
        if existing:
            return existing

        job_id = self._generate_job_id()
        job = Job(job_id=job_id, youtube_url=youtube_url)
        await self._repo.create(job)

        asyncio.create_task(self._run_pipeline_guarded(job_id, youtube_url))
        return job

    async def _run_pipeline_guarded(self, job_id: str, url: str) -> None:
        """Wrapper dengan semaphore untuk limit concurrency."""
        async with _pipeline_semaphore:
            await self._run_pipeline(job_id, url)

    async def get_job(self, job_id: str) -> Optional[Job]:
        return await self._repo.get_by_job_id(job_id)

    async def _run_pipeline(self, job_id: str, url: str) -> None:
        """Full pipeline v0.2: tanpa Colab, tanpa Google Drive."""
        video_path = f"{settings.DOWNLOAD_DIR}/{job_id}.mp4"

        try:
            # Step 1: Validate
            await self._repo.update_status(job_id, JobStatus.VALIDATING)
            async with StepTimer(job_id, "validate"):
                valid, error, duration = await self._downloader.validate_url(url)
            if not valid:
                await self._repo.update_status(job_id, JobStatus.FAILED, error)
                return

            # Step 2: Download video
            await self._repo.update_status(job_id, JobStatus.DOWNLOADING)
            async with StepTimer(job_id, "download"):
                await self._downloader.download_video(url, video_path)

            # Step 3: Fetch YouTube transcript (instan, tanpa Whisper)
            await self._repo.update_status(job_id, JobStatus.TRANSCRIBING)
            async with StepTimer(job_id, "transcript"):
                transcript = await self._transcript.fetch_transcript(url)
            if not transcript or not transcript.get("segments"):
                await self._repo.update_status(
                    job_id, JobStatus.FAILED,
                    "Gagal mendapatkan transcript dari YouTube. "
                    "Video mungkin tidak memiliki caption/subtitle."
                )
                return

            # Use transcript duration if video duration not available
            if not duration:
                duration = transcript.get("duration", 0)

            # Step 4: Gemini analysis (1 pass)
            await self._repo.update_status(job_id, JobStatus.ANALYZING)
            max_clips = self._calc_max_clips(duration)
            async with StepTimer(job_id, "gemini_analysis"):
                gemini_result = await self._gemini.analyze(transcript, duration, max_clips)

            if "clips" not in gemini_result or not gemini_result["clips"]:
                await self._repo.update_status(
                    job_id, JobStatus.FAILED, "Gemini tidak menghasilkan clip candidates"
                )
                return

            # Step 5: Apply time padding + validate clips
            clips = self._prepare_clips(gemini_result["clips"], duration)
            if not clips:
                await self._repo.update_status(
                    job_id, JobStatus.FAILED, "Tidak ada clip valid setelah validasi"
                )
                return

            # Step 6: Trim clips (FFmpeg)
            await self._repo.update_status(job_id, JobStatus.RENDERING)
            output_dir = f"{settings.OUTPUT_DIR}/{job_id}"
            os.makedirs(output_dir, exist_ok=True)

            total = len(clips)
            await self._repo.update_render_progress(job_id, f"0/{total}")

            async with StepTimer(job_id, f"trim_{total}_clips"):
                trim_results = await self._trim_all_clips(
                    job_id, video_path, clips, output_dir
                )

            # Step 7: Whisper per clip (local, word-level timestamps)
            await self._repo.update_status(job_id, JobStatus.WHISPER)
            async with StepTimer(job_id, f"whisper_{total}_clips"):
                clips_with_words = await self._whisper_all_clips(
                    job_id, clips, output_dir, trim_results
                )

            # Step 8: Assemble final JSON
            await self._repo.update_status(job_id, JobStatus.ASSEMBLING)
            async with StepTimer(job_id, "assemble"):
                final_data = self._assemble_final_json(
                    job_id, transcript, clips_with_words
                )

            # Store in database
            await self._repo.update_clips_data(job_id, final_data)

            success_count = sum(1 for c in clips_with_words if c.get("_success"))
            fail_count = total - success_count
            await self._repo.update_clips_count(job_id, total, success_count, fail_count)

            if success_count > 0:
                await self._repo.update_status(job_id, JobStatus.COMPLETED)
            else:
                await self._repo.update_status(
                    job_id, JobStatus.FAILED, "Semua clip gagal diproses"
                )

        except Exception as e:
            logger.exception(f"Pipeline error for {job_id}")
            await self._repo.update_status(job_id, JobStatus.FAILED, str(e)[:512])

    def _prepare_clips(self, raw_clips: list[dict], duration: float) -> list[Clip]:
        """Apply time padding and validate clips."""
        clips: list[Clip] = []

        for c in raw_clips:
            # Time padding: -0.5s start, +1.0s end
            start = max(0, c.get("start", 0) - 0.5)
            end = min(duration, c.get("end", 0) + 1.0)

            clip = Clip(
                rank=c.get("rank", len(clips) + 1),
                score=c.get("score", 0),
                start=round(start, 2),
                end=round(end, 2),
                hook=c.get("hook", ""),
                reason=c.get("reason", ""),
            )

            # Validate
            clip_duration = clip.end - clip.start
            if clip_duration < settings.MIN_CLIP_DURATION:
                logger.warning(f"Clip #{clip.rank} terlalu pendek: {clip_duration:.1f}s")
                continue
            if clip.start >= clip.end:
                continue
            if clip.end > duration + 5:  # 5s tolerance
                continue

            clips.append(clip)

        return clips

    async def _trim_all_clips(
        self, job_id: str, video_path: str, clips: list[Clip], output_dir: str
    ) -> dict[int, bool]:
        """Trim all clips in parallel. Returns {rank: success}."""
        total = len(clips)
        results: dict[int, bool] = {}
        done_count = 0

        workers = min(settings.MAX_RENDER_WORKERS, total)
        loop = asyncio.get_event_loop()

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {}
            for clip in clips:
                out_path = f"{output_dir}/clip_{clip.rank:02d}.mp4"
                future = executor.submit(
                    self._trim_clip_sync, video_path, clip, out_path
                )
                futures[future] = clip.rank

            for future in as_completed(futures):
                rank = futures[future]
                try:
                    future.result()
                    results[rank] = True
                except Exception as e:
                    results[rank] = False
                    logger.error(f"[{job_id}] Clip #{rank} trim gagal: {e}")

                done_count += 1
                await self._repo.update_render_progress(
                    job_id, f"{done_count}/{total}"
                )

        return results

    def _trim_clip_sync(self, video_path: str, clip: Clip, output_path: str) -> None:
        """Synchronous trim wrapper."""
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(
                self._renderer.trim_clip(video_path, clip, output_path)
            )
        finally:
            loop.close()

    async def _whisper_all_clips(
        self,
        job_id: str,
        clips: list[Clip],
        output_dir: str,
        trim_results: dict[int, bool],
    ) -> list[dict]:
        """Run Whisper on each trimmed clip for word-level timestamps (parallel)."""
        whisper_semaphore = asyncio.Semaphore(settings.MAX_WHISPER_PARALLEL)
        clips_with_words: list[dict] = [None] * len(clips)

        async def process_clip(idx: int, clip: Clip):
            clip_data = {
                "rank": clip.rank,
                "score": clip.score,
                "start": clip.start,
                "end": clip.end,
                "hook": clip.hook,
                "reason": clip.reason,
                "_success": False,
            }

            if not trim_results.get(clip.rank, False):
                return clip_data

            clip_path = f"{output_dir}/clip_{clip.rank:02d}.mp4"
            if not os.path.exists(clip_path):
                return clip_data

            async with whisper_semaphore:
                try:
                    logger.info(f"[{job_id}] Whisper clip #{clip.rank}...")
                    segments = await self._whisper.transcribe_clip(clip_path)

                    # Adjust timestamps: relative → absolute
                    adjusted_segments = []
                    for seg in segments:
                        adjusted_seg = {
                            "start": round(seg["start"] + clip.start, 2),
                            "end": round(seg["end"] + clip.start, 2),
                            "text": seg["text"],
                            "words": [],
                        }
                        for w in seg.get("words", []):
                            adjusted_seg["words"].append({
                                "word": w["word"],
                                "start": round(w["start"] + clip.start, 2),
                                "end": round(w["end"] + clip.start, 2),
                                "highlight": False,
                            })
                        adjusted_segments.append(adjusted_seg)

                    clip_data["subtitles"] = adjusted_segments
                    clip_data["_success"] = True

                except Exception as e:
                    logger.error(f"[{job_id}] Whisper clip #{clip.rank} gagal: {e}")

            return clip_data

        # Run whisper parallel (limited by MAX_WHISPER_PARALLEL)
        tasks = [process_clip(i, clip) for i, clip in enumerate(clips)]
        results = await asyncio.gather(*tasks)
        clips_with_words = list(results)

        # Highlight pass: ask Gemini to mark important words
        await self._apply_highlights(job_id, clips_with_words)

        return clips_with_words

    async def _apply_highlights(self, job_id: str, clips: list[dict]) -> None:
        """Use Gemini to mark highlight words in subtitles (with rate limit handling)."""
        async def highlight_clip(clip: dict):
            if not clip.get("_success") or not clip.get("subtitles"):
                return

            all_words = []
            for sub in clip["subtitles"]:
                for w in sub.get("words", []):
                    all_words.append(w["word"])

            if not all_words:
                return

            full_text = " ".join(all_words)

            try:
                highlight_result = await self._gemini_highlight(full_text, clip["hook"])
                highlight_words = set(highlight_result)
                for sub in clip["subtitles"]:
                    for w in sub.get("words", []):
                        word_clean = w["word"].strip().lower()
                        if word_clean in highlight_words:
                            w["highlight"] = True
            except Exception as e:
                logger.warning(f"[{job_id}] Highlight clip #{clip['rank']} gagal: {e}")
                self._apply_rule_based_highlights(clip)

        # Process in batches of 4 with delay to avoid rate limiting
        batch_size = 4
        for i in range(0, len(clips), batch_size):
            batch = clips[i:i + batch_size]
            await asyncio.gather(*[highlight_clip(c) for c in batch])
            # Delay between batches to respect rate limits (5 req/min free tier)
            if i + batch_size < len(clips):
                await asyncio.sleep(12)

    async def _gemini_highlight(self, text: str, hook: str) -> list[str]:
        """Ask Gemini which words to highlight."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._gemini_highlight_sync, text, hook
        )

    def _gemini_highlight_sync(self, text: str, hook: str) -> list[str]:
        """Synchronous Gemini call for word highlights."""
        from google import genai

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        prompt = f"""Dari teks berikut, pilih kata-kata yang paling penting dan emosional untuk di-highlight dalam subtitle video pendek.

Hook video: "{hook}"

Teks lengkap:
{text}

Pilih 15-25% kata yang:
- Kata kunci emosional
- Angka/statistik penting
- Nama orang/tempat
- Kata aksi/impact

OUTPUT: JSON array berisi kata-kata yang harus di-highlight (lowercase, tanpa duplikat):
["kata1", "kata2", "kata3"]

HANYA return JSON array, tanpa teks lain."""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )

        if not response or not response.text:
            return []

        text_result = response.text.strip()
        # Remove markdown fences
        if text_result.startswith("```"):
            lines = text_result.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text_result = "\n".join(lines)

        try:
            words = json.loads(text_result)
            if isinstance(words, list):
                return [w.lower().strip() for w in words if isinstance(w, str)]
        except json.JSONDecodeError:
            pass

        return []

    def _apply_rule_based_highlights(self, clip: dict) -> None:
        """Fallback: highlight words based on simple rules."""
        # Highlight words from hook
        hook_words = set(clip.get("hook", "").lower().split())

        for sub in clip.get("subtitles", []):
            for w in sub.get("words", []):
                word_lower = w["word"].strip().lower()
                # Highlight if word appears in hook or is a number
                if word_lower in hook_words or word_lower.isdigit():
                    w["highlight"] = True

    def _assemble_final_json(
        self, job_id: str, transcript: dict, clips_with_words: list[dict]
    ) -> dict:
        """Assemble final JSON in the same format as before."""
        final_clips = []
        for clip in clips_with_words:
            if not clip.get("_success"):
                continue

            subtitles = []
            for sub in clip.get("subtitles", []):
                words = [
                    {
                        "word": w["word"],
                        "start": w["start"],
                        "end": w["end"],
                        "highlight": w.get("highlight", False),
                    }
                    for w in sub.get("words", [])
                ]
                subtitles.append({
                    "start": sub["start"],
                    "end": sub["end"],
                    "text": sub["text"],
                    "words": words,
                })

            final_clips.append({
                "rank": clip["rank"],
                "score": clip["score"],
                "start": clip["start"],
                "end": clip["end"],
                "hook": clip["hook"],
                "reason": clip["reason"],
                "subtitles": subtitles,
            })

        return {
            "version": "1.0",
            "video_id": job_id,
            "language": transcript.get("language", "id"),
            "error": None,
            "clips": final_clips,
        }
