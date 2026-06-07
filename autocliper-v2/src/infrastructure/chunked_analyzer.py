"""
Chunked AI Analyzer — Multi-Pass Transcript Analysis

Architecture:
  Whisper Full Transcript
       ↓
  STEP 4a: Transcript Chunk Builder (4000 words/chunk, 200 word overlap)
       ↓
  STEP 4b: AI Pass #1 — Candidate Detection (3 concurrent chunks)
       ↓
  STEP 4c: Candidate Aggregator (sort, dedup, remove overlap → Top 30)
       ↓
  STEP 4d: AI Pass #2 — Final Ranking (Top 15 clips with hooks & keywords)
       ↓
  Output: List[ClipData]

Provider interface allows swapping Gemini ↔ Local Qwen3 without refactor.
"""
import os
import re
import json
import time
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..domain.entities import ClipData, ClipScores, VideoInfo
from ..domain.interfaces import IAIAnalyzer

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────────────────────
CHUNK_CONFIG = {
    "target_words": 4000,
    "min_words": 3500,
    "max_words": 4500,
    "overlap_words": 200,
    "max_candidates_per_chunk": 10,
    "max_concurrent_chunks": 3,
    "max_candidates_after_aggregation": 40,
    "max_final_clips": 10,
    "retry_max": 1,
    "retry_delay_base": 2.0,  # seconds, exponential backoff
}

# Score weights for final_score calculation
SCORE_WEIGHTS = {
    "viral": 0.35,
    "curiosity": 0.25,
    "story": 0.20,
    "emotion": 0.10,
    "controversy": 0.10,
}


# ─────────────────────────────────────────────────────────────────────────────
#  Data Classes
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class TranscriptChunk:
    """A chunk of transcript with metadata"""
    chunk_id: int
    start_time: float  # absolute seconds
    end_time: float    # absolute seconds
    word_count: int
    segments: List[List[str]]  # [["start","end","text"], ...]
    
    def to_json(self) -> str:
        """Convert to compact JSON for AI prompt"""
        return json.dumps({"data": self.segments}, ensure_ascii=False)
    
    def to_text(self) -> str:
        """Convert to plain text with timestamps (lighter for small models)."""
        lines = []
        for seg in self.segments:
            start = seg[0] if len(seg) > 0 else "0"
            text = seg[2] if len(seg) > 2 else ""
            lines.append(f"[{start}s] {text}")
        return "\n".join(lines)


@dataclass
class ChunkResult:
    """Result from Pass #1 for a single chunk"""
    chunk_id: int
    success: bool
    candidates: List[ClipData] = field(default_factory=list)
    error: Optional[str] = None
    retries_used: int = 0


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 4a: Transcript Chunk Builder
# ─────────────────────────────────────────────────────────────────────────────
class TranscriptChunkBuilder:
    """Splits full Whisper transcript into overlapping chunks of ~4000 words."""
    
    def __init__(self, target_words: int = None, overlap_words: int = None):
        self.target_words = target_words or CHUNK_CONFIG["target_words"]
        self.overlap_words = overlap_words or CHUNK_CONFIG["overlap_words"]
    
    def build_chunks(self, transcript_json: str) -> List[TranscriptChunk]:
        """Parse Whisper transcript and split into chunks.
        
        Args:
            transcript_json: JSON string with format {"data": [["start","end","text"], ...]}
            
        Returns:
            List of TranscriptChunk objects
        """
        try:
            data = json.loads(transcript_json)
            segments = data.get("data", [])
        except (json.JSONDecodeError, TypeError):
            logger.error("Failed to parse transcript JSON for chunking")
            return []
        
        if not segments:
            return []
        
        chunks = []
        chunk_id = 1
        i = 0  # current segment index
        
        while i < len(segments):
            chunk_segments = []
            word_count = 0
            chunk_start_time = float(segments[i][0])
            
            # Fill chunk until target words reached
            j = i
            while j < len(segments) and word_count < self.target_words:
                seg = segments[j]
                text = seg[2] if len(seg) > 2 else ""
                words_in_seg = len(text.split())
                chunk_segments.append(seg)
                word_count += words_in_seg
                j += 1
            
            chunk_end_time = float(chunk_segments[-1][1]) if chunk_segments else 0.0
            
            chunks.append(TranscriptChunk(
                chunk_id=chunk_id,
                start_time=chunk_start_time,
                end_time=chunk_end_time,
                word_count=word_count,
                segments=chunk_segments,
            ))
            
            # Move forward, but overlap by going back overlap_words
            # Find how many segments to go back for overlap
            overlap_word_count = 0
            overlap_start = j
            for k in range(j - 1, i - 1, -1):
                seg_text = segments[k][2] if len(segments[k]) > 2 else ""
                overlap_word_count += len(seg_text.split())
                if overlap_word_count >= self.overlap_words:
                    overlap_start = k
                    break
            
            # Next chunk starts at overlap_start (unless we're at the end)
            if j >= len(segments):
                break
            i = overlap_start
            chunk_id += 1
        
        logger.info(f"[ChunkBuilder] Split transcript into {len(chunks)} chunks "
                    f"(target: {self.target_words} words/chunk, overlap: {self.overlap_words})")
        for c in chunks:
            logger.info(f"  Chunk {c.chunk_id}: {c.start_time:.0f}s - {c.end_time:.0f}s "
                        f"({c.word_count} words, {len(c.segments)} segments)")
        
        return chunks


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 4c: Candidate Aggregator
# ─────────────────────────────────────────────────────────────────────────────
class CandidateAggregator:
    """Aggregates candidates from all chunks, removes overlaps, sorts by score."""
    
    def __init__(self, max_candidates: int = None):
        self.max_candidates = max_candidates or CHUNK_CONFIG["max_candidates_after_aggregation"]
    
    def aggregate(self, chunk_results: List[ChunkResult]) -> List[ClipData]:
        """Merge all chunk candidates, deduplicate, remove overlaps, take top N.
        
        Args:
            chunk_results: Results from Pass #1 (per chunk)
            
        Returns:
            Top N non-overlapping candidates sorted by final_score
        """
        # Collect all successful candidates
        all_candidates = []
        for result in chunk_results:
            if result.success:
                all_candidates.extend(result.candidates)
        
        if not all_candidates:
            logger.warning("[Aggregator] No candidates found from any chunk")
            return []
        
        logger.info(f"[Aggregator] Total raw candidates: {len(all_candidates)}")
        
        # Sort by final_score (from ClipScores) descending
        all_candidates.sort(
            key=lambda c: c.scores.final_score if c.scores else c.score,
            reverse=True
        )
        
        # Remove overlapping clips (>50% overlap → drop lower score)
        filtered = self._remove_overlaps(all_candidates)
        logger.info(f"[Aggregator] After overlap removal: {len(filtered)}")
        
        # Take top N
        top_candidates = filtered[:self.max_candidates]
        logger.info(f"[Aggregator] Top {len(top_candidates)} candidates selected for Pass #2")
        
        return top_candidates
    
    def _remove_overlaps(self, clips: List[ClipData]) -> List[ClipData]:
        """Remove clips that overlap >50% with a higher-scored clip."""
        if not clips:
            return clips
        
        accepted = []
        for clip in clips:
            overlap_found = False
            clip_duration = clip.end_time - clip.start_time
            if clip_duration <= 0:
                continue
            
            for existing in accepted:
                overlap_start = max(clip.start_time, existing.start_time)
                overlap_end = min(clip.end_time, existing.end_time)
                overlap_duration = max(0, overlap_end - overlap_start)
                
                if overlap_duration / clip_duration > 0.5:
                    overlap_found = True
                    break
            
            if not overlap_found:
                accepted.append(clip)
        
        return accepted


# ─────────────────────────────────────────────────────────────────────────────
#  Gemini AI Provider (implements IAIAnalyzer for Pass #1 and Pass #2)
# ─────────────────────────────────────────────────────────────────────────────
class GeminiChunkedAnalyzer(IAIAnalyzer):
    """Gemini 2.5-flash implementation for chunked multi-pass analysis."""
    
    def __init__(self):
        from google import genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        self.client = genai.Client(api_key=api_key)
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    def analyze_video(self, video_path: str) -> List[Dict[str, Any]]:
        """Legacy interface — not used in chunked flow."""
        return []
    
    def analyze_candidates(self, transcript_chunk: str, metadata: Dict[str, Any],
                           chunk_id: int, chunk_start_time: float) -> List[ClipData]:
        """Pass #1: Find candidate clips in a single chunk."""
        prompt = self._build_pass1_prompt(metadata, chunk_id, chunk_start_time)
        full_prompt = f"{prompt}\n\nTRANSCRIPT CHUNK #{chunk_id}:\n{transcript_chunk}"
        
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=full_prompt
        )
        
        return self._parse_pass1_response(response.text, chunk_id)
    
    def rank_candidates(self, candidates: List[ClipData], metadata: Dict[str, Any],
                        transcript_snippets: Dict[int, str]) -> List[ClipData]:
        """Pass #2: Final ranking with hooks and keywords."""
        prompt = self._build_pass2_prompt(metadata, candidates, transcript_snippets)
        
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt
        )
        
        return self._parse_pass2_response(response.text)
    
    # ─── Pass #1 Prompt ──────────────────────────────────────────────────────
    def _build_pass1_prompt(self, metadata: Dict[str, Any], chunk_id: int,
                            chunk_start_time: float) -> str:
        return f"""Kamu adalah AI analis video viral. Tugasmu: temukan SEMUA momen yang berpotensi viral dalam chunk transcript ini.

VIDEO METADATA:
- Title: {metadata.get('title', 'Unknown')}
- Duration: {metadata.get('duration', 0)} seconds
- Channel: {metadata.get('channel_title', 'Unknown')}
- Views: {metadata.get('view_count', 0):,}

CHUNK INFO:
- Chunk #{chunk_id}
- Start time: {chunk_start_time:.0f}s

TUGAS:
1. Cari maksimal {CHUNK_CONFIG['max_candidates_per_chunk']} momen TERBAIK dalam chunk ini
2. Setiap momen harus 30-60 detik
3. BERIKAN MULTI-SCORE untuk setiap kandidat

KRITERIA SCORING (0.0 - 1.0):
- viral_score: Seberapa besar potensi viral (hook kuat, shareable)
- curiosity_score: Seberapa bikin penasaran (open loop, cliffhanger)
- emotion_score: Seberapa kuat emosi (lucu, sedih, marah, takjub)
- controversy_score: Seberapa kontroversial/debatable
- story_score: Seberapa kuat narasi/cerita (relatable, punya arc)

FORMAT RESPONSE (JSON VALID SAJA, tanpa text lain):
```json
{{
  "status": 200,
  "chunk_id": {chunk_id},
  "candidates": [
    {{
      "start_time": 125.0,
      "end_time": 168.0,
      "viral_score": 0.91,
      "curiosity_score": 0.95,
      "emotion_score": 0.62,
      "controversy_score": 0.48,
      "story_score": 0.88,
      "brief_reason": "Pernyataan shocking tentang X"
    }}
  ]
}}
```

ATURAN PENTING:
- start_time dan end_time dalam DETIK (float, timestamp ABSOLUT dari video)
- Durasi 30-60 detik per kandidat
- JANGAN potong di tengah kalimat
- Beri ruang 1-2 detik sebelum kalimat inti dimulai
- Beri ruang 1-2 detik setelah kalimat terakhir selesai
- Score HARUS realistis (bukan semua 0.9+)
- CLIP TIDAK BOLEH OVERLAP dalam chunk yang sama
- HANYA RETURN JSON, tanpa text tambahan apapun"""
    
    # ─── Pass #2 Prompt ──────────────────────────────────────────────────────
    def _build_pass2_prompt(self, metadata: Dict[str, Any], candidates: List[ClipData],
                            transcript_snippets: Dict[int, str]) -> str:
        # Build candidate list with transcript context
        candidate_list = []
        for i, clip in enumerate(candidates):
            score_info = ""
            if clip.scores:
                score_info = (f"viral={clip.scores.viral_score:.2f}, "
                              f"curiosity={clip.scores.curiosity_score:.2f}, "
                              f"emotion={clip.scores.emotion_score:.2f}, "
                              f"controversy={clip.scores.controversy_score:.2f}, "
                              f"story={clip.scores.story_score:.2f}")
            
            snippet = transcript_snippets.get(i, "")
            candidate_list.append(
                f"  #{i+1}: [{clip.start_time:.0f}s - {clip.end_time:.0f}s] "
                f"Scores: {score_info}\n"
                f"      Reason: {clip.reason}\n"
                f"      Transcript: {snippet[:300]}..."
            )
        
        candidates_text = "\n".join(candidate_list)
        max_final = CHUNK_CONFIG["max_final_clips"]
        
        return f"""Kamu adalah AI analis video viral TAHAP FINAL. Dari {len(candidates)} kandidat clip yang sudah terfilter, pilih {max_final} TERBAIK dan buat hook + keywords.

VIDEO METADATA:
- Title: {metadata.get('title', 'Unknown')}
- Duration: {metadata.get('duration', 0)} seconds  
- Channel: {metadata.get('channel_title', 'Unknown')}
- Views: {metadata.get('view_count', 0):,}
- Description: {metadata.get('description', '')[:200]}

KANDIDAT CLIPS:
{candidates_text}

TUGAS:
1. Pilih {max_final} clip TERBAIK dari kandidat di atas
2. Untuk SETIAP clip yang dipilih, buat:
   - hook: 3-8 kata, BRUTAL SINGKAT, bikin berhenti scroll
   - keywords: 2-4 kata PALING POWERFUL dari hook untuk di-highlight
   - Adjust timing jika perlu (JANGAN potong kalimat)
3. UPDATE SCORE jika perlu setelah melihat konteks lebih luas

ATURAN HOOK (WAJIB):
- 3-8 kata saja (max 50 karakter)
- SATU IDE saja
- Bikin penasaran / ke-trigger (Shock / Question / Warning / Fakta)
- OPEN LOOP — jangan kasih jawaban
- Tulis dalam BAHASA yang sama dengan video
  
ATURAN KEYWORDS:
- 2-4 kata dari hook yang layak di-highlight
- Fokus: emosional, urgency, value, curiosity
- UPPERCASE

FORMAT RESPONSE (JSON VALID SAJA):
```json
{{
  "status": 200,
  "language": "id",
  "data": [
    {{
      "index": 1,
      "start_time": 125.0,
      "end_time": 168.0,
      "hook": "Hook brutal singkat",
      "keywords": ["KATA1", "KATA2"],
      "viral_score": 0.91,
      "curiosity_score": 0.95,
      "emotion_score": 0.62,
      "controversy_score": 0.48,
      "story_score": 0.88,
      "reason": "Alasan singkat"
    }}
  ]
}}
```

ATURAN:
- Urut berdasarkan final_score tertinggi (weighted: viral*0.35 + curiosity*0.25 + story*0.20 + emotion*0.10 + controversy*0.10)
- CLIP TIDAK BOLEH OVERLAP
- HANYA RETURN JSON, tanpa text tambahan"""
    
    # ─── Response Parsers ────────────────────────────────────────────────────
    def _parse_pass1_response(self, response_text: str, chunk_id: int) -> List[ClipData]:
        """Parse Pass #1 response into ClipData with multi-scores."""
        try:
            json_match = re.search(r'\{[\s\S]*"candidates"[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = json.loads(response_text)
            
            clips = []
            for i, cand in enumerate(result.get("candidates", [])):
                scores = ClipScores(
                    viral_score=float(cand.get("viral_score", 0.5)),
                    curiosity_score=float(cand.get("curiosity_score", 0.5)),
                    emotion_score=float(cand.get("emotion_score", 0.5)),
                    controversy_score=float(cand.get("controversy_score", 0.5)),
                    story_score=float(cand.get("story_score", 0.5)),
                )
                
                clips.append(ClipData(
                    index=i + 1,
                    start_time=float(cand.get("start_time", 0)),
                    end_time=float(cand.get("end_time", 30)),
                    hook="",  # Hook is generated in Pass #2
                    score=scores.final_score,
                    reason=cand.get("brief_reason", ""),
                    keywords=[],
                    scores=scores,
                    chunk_id=chunk_id,
                ))
            
            return clips
            
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"[Pass1] Failed to parse response for chunk {chunk_id}: {e}")
            logger.debug(f"[Pass1] Response: {response_text[:500]}")
            return []
    
    def _parse_pass2_response(self, response_text: str) -> List[ClipData]:
        """Parse Pass #2 response into final ClipData with hooks and keywords."""
        try:
            json_match = re.search(r'\{[\s\S]*"data"[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = json.loads(response_text)
            
            clips = []
            for clip_data in result.get("data", []):
                keywords = clip_data.get("keywords", [])
                if isinstance(keywords, list):
                    keywords = [str(k).upper().strip() for k in keywords if k]
                else:
                    keywords = []
                
                scores = ClipScores(
                    viral_score=float(clip_data.get("viral_score", 0.5)),
                    curiosity_score=float(clip_data.get("curiosity_score", 0.5)),
                    emotion_score=float(clip_data.get("emotion_score", 0.5)),
                    controversy_score=float(clip_data.get("controversy_score", 0.5)),
                    story_score=float(clip_data.get("story_score", 0.5)),
                )
                
                clips.append(ClipData(
                    index=clip_data.get("index", len(clips) + 1),
                    start_time=float(clip_data.get("start_time", 0)),
                    end_time=float(clip_data.get("end_time", 30)),
                    hook=clip_data.get("hook", "").strip()[:50] or "Kamu harus tahu ini!",
                    score=scores.final_score,
                    reason=clip_data.get("reason", ""),
                    keywords=keywords,
                    scores=scores,
                ))
            
            # Sort by final_score descending
            clips.sort(key=lambda c: c.scores.final_score if c.scores else c.score, reverse=True)
            
            # Re-index
            for i, clip in enumerate(clips):
                clip.index = i + 1
            
            return clips
            
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"[Pass2] Failed to parse response: {e}")
            logger.debug(f"[Pass2] Response: {response_text[:500]}")
            return []


# ─────────────────────────────────────────────────────────────────────────────
#  Main Orchestrator: ChunkedAnalysisPipeline
# ─────────────────────────────────────────────────────────────────────────────
class ChunkedAnalysisPipeline:
    """Orchestrates the full multi-pass analysis pipeline.
    
    Usage:
        pipeline = ChunkedAnalysisPipeline()
        clips = pipeline.analyze(whisper_transcript_json, metadata)
    """
    
    def __init__(self, provider: IAIAnalyzer = None, progress_callback=None):
        """Initialize with an AI provider (defaults to GeminiChunkedAnalyzer).
        
        Auto-fallback: If Gemini fails on all retries AND Ollama is available locally,
        automatically switches to QwenLocalAnalyzer for remaining work.
        
        Args:
            provider: AI provider implementation (default: GeminiChunkedAnalyzer)
            progress_callback: Optional callable(message: str) for real-time progress updates
        """
        self.provider = provider or GeminiChunkedAnalyzer()
        self._fallback_provider = None  # Lazy-loaded when needed
        self.chunk_builder = TranscriptChunkBuilder()
        self.aggregator = CandidateAggregator()
        self.max_concurrent = CHUNK_CONFIG["max_concurrent_chunks"]
        self.max_final = CHUNK_CONFIG["max_final_clips"]
        self._progress = progress_callback or (lambda msg: None)
        self._gemini_failed_all = False  # Track if Gemini is completely down
    
    def _get_fallback_provider(self) -> Optional[IAIAnalyzer]:
        """Lazy-load QwenLocalAnalyzer if Ollama is available."""
        if self._fallback_provider is not None:
            return self._fallback_provider
        
        try:
            from .qwen_local_analyzer import QwenLocalAnalyzer, is_ollama_available
            if is_ollama_available():
                self._fallback_provider = QwenLocalAnalyzer()
                logger.info("[Fallback] ✅ Qwen3:4b local fallback available via Ollama")
                return self._fallback_provider
            else:
                logger.warning("[Fallback] ⚠️ Ollama not available, no fallback")
                return None
        except Exception as e:
            logger.warning(f"[Fallback] ⚠️ Cannot initialize QwenLocal: {e}")
            return None
    
    def analyze(self, whisper_transcript: str, metadata: Dict[str, Any],
                full_transcript_json: str = None) -> List[ClipData]:
        """Run full multi-pass analysis pipeline.
        
        Args:
            whisper_transcript: JSON string from Whisper ({"data": [...]})
            metadata: Video metadata dict
            full_transcript_json: Original transcript for snippet extraction (same as whisper_transcript if not provided)
            
        Returns:
            Final list of ClipData (max 15 clips, ranked by final_score)
        """
        if not full_transcript_json:
            full_transcript_json = whisper_transcript
        
        # ─── STEP 4a: Build Chunks ───────────────────────────────────────────
        logger.info("=" * 60)
        logger.info("[Chunked Analysis] STEP 4a: Building transcript chunks")
        self._progress("📦 Building transcript chunks...")
        chunks = self.chunk_builder.build_chunks(whisper_transcript)
        
        if not chunks:
            logger.error("[Chunked Analysis] No chunks built — transcript may be empty")
            return []
        
        self._progress(f"📦 Transcript split into {len(chunks)} chunks (~{chunks[0].word_count} words each)")
        
        # If only 1 chunk and it's small, no need for multi-pass
        if len(chunks) == 1 and chunks[0].word_count < 2000:
            logger.info("[Chunked Analysis] Small transcript, using single-pass for efficiency")
        
        # ─── STEP 4b: Pass #1 — Candidate Detection (concurrent) ────────────
        logger.info(f"[Chunked Analysis] STEP 4b: Pass #1 — {len(chunks)} chunks, "
                    f"max {self.max_concurrent} concurrent")
        self._progress(f"🔍 Pass #1: Scanning {len(chunks)} chunks for viral moments (max {self.max_concurrent} concurrent)...")
        
        chunk_results = self._run_pass1_concurrent(chunks, metadata)
        
        # Count results
        total_candidates = sum(len(r.candidates) for r in chunk_results if r.success)
        failed_chunks = sum(1 for r in chunk_results if not r.success)
        logger.info(f"[Chunked Analysis] Pass #1 complete: {total_candidates} candidates "
                    f"from {len(chunks) - failed_chunks}/{len(chunks)} chunks")
        self._progress(f"🔍 Pass #1 done: {total_candidates} candidates from {len(chunks) - failed_chunks}/{len(chunks)} chunks")
        
        if total_candidates == 0:
            logger.error("[Chunked Analysis] No candidates found in any chunk")
            self._progress("❌ AI analysis gagal: tidak ada clip yang ditemukan")
            raise RuntimeError(
                "AI analysis gagal: Gemini 503 (high demand) dan Qwen fallback "
                "tidak menghasilkan candidates. Coba lagi nanti."
            )
        
        # ─── STEP 4c: Aggregation ────────────────────────────────────────────
        logger.info("[Chunked Analysis] STEP 4c: Aggregating candidates")
        self._progress(f"🧹 Aggregating {total_candidates} candidates → removing overlaps...")
        top_candidates = self.aggregator.aggregate(chunk_results)
        
        if not top_candidates:
            logger.error("[Chunked Analysis] Aggregator returned empty")
            return []
        
        self._progress(f"🧹 Top {len(top_candidates)} candidates selected for final ranking")
        
        # ─── STEP 4d: Pass #2 — Final Ranking ────────────────────────────────
        logger.info(f"[Chunked Analysis] STEP 4d: Pass #2 — Ranking {len(top_candidates)} candidates")
        self._progress(f"🏆 Pass #2: Final ranking + hook generation for {len(top_candidates)} candidates...")
        
        # Extract transcript snippets for each candidate
        transcript_snippets = self._extract_snippets(top_candidates, full_transcript_json)
        
        final_clips = self._run_pass2(top_candidates, metadata, transcript_snippets)
        
        if not final_clips:
            # Fallback: use Pass #1 results with generated hooks
            logger.warning("[Chunked Analysis] Pass #2 failed, using Pass #1 results as fallback")
            self._progress("⚠️ Pass #2 failed, using Pass #1 results as fallback")
            final_clips = self._fallback_from_candidates(top_candidates)
        
        self._progress(f"✅ Analysis complete — {len(final_clips)} final clips with hooks & multi-scores")
        logger.info(f"[Chunked Analysis] DONE — {len(final_clips)} final clips")
        logger.info("=" * 60)
        
        return final_clips
    
    # ─── Pass #1 Execution (hybrid concurrency) ──────────────────────────────
    def _run_pass1_concurrent(self, chunks: List[TranscriptChunk],
                              metadata: Dict[str, Any]) -> List[ChunkResult]:
        """Run Pass #1 on all chunks with bounded concurrency."""
        results: List[ChunkResult] = []
        
        with ThreadPoolExecutor(max_workers=self.max_concurrent,
                                thread_name_prefix="pass1") as executor:
            futures = {
                executor.submit(self._process_single_chunk, chunk, metadata): chunk
                for chunk in chunks
            }
            
            for future in as_completed(futures):
                chunk = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                    if result.success:
                        logger.info(f"  ✅ Chunk {chunk.chunk_id}: {len(result.candidates)} candidates")
                    else:
                        logger.warning(f"  ❌ Chunk {chunk.chunk_id} failed: {result.error}")
                except Exception as e:
                    results.append(ChunkResult(
                        chunk_id=chunk.chunk_id,
                        success=False,
                        error=str(e)
                    ))
                    logger.error(f"  ❌ Chunk {chunk.chunk_id} exception: {e}")
        
        return results
    
    def _process_single_chunk(self, chunk: TranscriptChunk,
                              metadata: Dict[str, Any]) -> ChunkResult:
        """Process a single chunk with retry logic + auto-fallback to local AI."""
        max_retries = CHUNK_CONFIG["retry_max"]
        delay_base = CHUNK_CONFIG["retry_delay_base"]
        
        # Try primary provider (Gemini) first
        for attempt in range(max_retries):
            try:
                candidates = self.provider.analyze_candidates(
                    transcript_chunk=chunk.to_json(),
                    metadata=metadata,
                    chunk_id=chunk.chunk_id,
                    chunk_start_time=chunk.start_time,
                )
                
                # Validate timestamps are within chunk bounds (with some tolerance)
                valid_candidates = []
                for c in candidates:
                    # Allow 5s tolerance outside chunk bounds (overlap region)
                    if c.start_time >= (chunk.start_time - 5) and c.end_time <= (chunk.end_time + 5):
                        valid_candidates.append(c)
                    else:
                        logger.debug(f"  Discarded out-of-bounds candidate: "
                                     f"{c.start_time:.0f}-{c.end_time:.0f}s "
                                     f"(chunk: {chunk.start_time:.0f}-{chunk.end_time:.0f}s)")
                
                return ChunkResult(
                    chunk_id=chunk.chunk_id,
                    success=True,
                    candidates=valid_candidates,
                    retries_used=attempt,
                )
                
            except Exception as e:
                error_str = str(e)
                is_retriable = ("429" in error_str or "500" in error_str or 
                                "503" in error_str or "timeout" in error_str.lower())
                
                if is_retriable and attempt < max_retries - 1:
                    delay = delay_base * (2 ** attempt)
                    logger.info(f"  ⏳ Chunk {chunk.chunk_id} retry {attempt + 1}/{max_retries} "
                                f"in {delay:.1f}s ({error_str[:80]})")
                    time.sleep(delay)
                    continue
                
                # All retries exhausted for primary provider — try fallback
                logger.warning(f"  ⚠️ Chunk {chunk.chunk_id}: Primary provider failed after {attempt + 1} attempts")
                break
        
        # ─── Fallback to local Qwen ─────────────────────────────────────────
        fallback = self._get_fallback_provider()
        if fallback:
            try:
                logger.info(f"  🔄 Chunk {chunk.chunk_id}: Falling back to local Qwen3:4b...")
                self._progress(f"🔄 Chunk {chunk.chunk_id}: Gemini failed, using local Qwen3:4b...")
                
                candidates = fallback.analyze_candidates(
                    transcript_chunk=chunk.to_text(),
                    metadata=metadata,
                    chunk_id=chunk.chunk_id,
                    chunk_start_time=chunk.start_time,
                )
                
                valid_candidates = []
                for c in candidates:
                    if c.start_time >= (chunk.start_time - 5) and c.end_time <= (chunk.end_time + 5):
                        valid_candidates.append(c)
                
                logger.info(f"  ✅ Chunk {chunk.chunk_id}: Qwen3 fallback succeeded ({len(valid_candidates)} candidates)")
                self._progress(f"✅ Chunk {chunk.chunk_id}: Qwen3 fallback — {len(valid_candidates)} candidates")
                
                return ChunkResult(
                    chunk_id=chunk.chunk_id,
                    success=True,
                    candidates=valid_candidates,
                    retries_used=max_retries,
                )
            except Exception as fallback_err:
                logger.error(f"  ❌ Chunk {chunk.chunk_id}: Fallback also failed: {fallback_err}")
        
        # Both primary and fallback failed
        return ChunkResult(
            chunk_id=chunk.chunk_id,
            success=False,
            error=f"Primary and fallback failed: {error_str[:150]}",
            retries_used=max_retries,
        )
    
    # ─── Pass #2 Execution ───────────────────────────────────────────────────
    def _run_pass2(self, candidates: List[ClipData], metadata: Dict[str, Any],
                   transcript_snippets: Dict[int, str]) -> List[ClipData]:
        """Run Pass #2 with retry + auto-fallback to local Qwen."""
        max_retries = CHUNK_CONFIG["retry_max"]
        delay_base = CHUNK_CONFIG["retry_delay_base"]
        
        # Try primary provider
        for attempt in range(max_retries):
            try:
                result = self.provider.rank_candidates(candidates, metadata, transcript_snippets)
                if result:
                    return result[:self.max_final]
            except Exception as e:
                error_str = str(e)
                if attempt < max_retries - 1:
                    delay = delay_base * (2 ** attempt)
                    logger.info(f"  ⏳ Pass #2 retry {attempt + 1}/{max_retries} in {delay:.1f}s")
                    time.sleep(delay)
                    continue
                logger.error(f"[Pass2] Primary provider failed: {error_str[:200]}")
        
        # ─── Fallback to local Qwen for Pass #2 ─────────────────────────────
        fallback = self._get_fallback_provider()
        if fallback:
            try:
                logger.info("[Pass2] 🔄 Falling back to local Qwen3:4b for final ranking...")
                self._progress("🔄 Pass #2: Gemini failed, using local Qwen3:4b for ranking...")
                
                result = fallback.rank_candidates(candidates, metadata, transcript_snippets)
                if result:
                    logger.info(f"[Pass2] ✅ Qwen3 fallback succeeded: {len(result)} clips")
                    self._progress(f"✅ Pass #2: Qwen3 fallback — {len(result)} final clips")
                    return result[:self.max_final]
            except Exception as fallback_err:
                logger.error(f"[Pass2] Fallback also failed: {fallback_err}")
        
        return []
    
    # ─── Helpers ─────────────────────────────────────────────────────────────
    def _extract_snippets(self, candidates: List[ClipData],
                          transcript_json: str) -> Dict[int, str]:
        """Extract transcript text around each candidate's timestamps."""
        try:
            data = json.loads(transcript_json)
            segments = data.get("data", [])
        except (json.JSONDecodeError, TypeError):
            return {}
        
        snippets = {}
        for i, clip in enumerate(candidates):
            # Find segments that fall within clip's time range
            clip_segments = []
            for seg in segments:
                seg_start = float(seg[0])
                seg_end = float(seg[1])
                # Segment overlaps with clip
                if seg_end > clip.start_time and seg_start < clip.end_time:
                    clip_segments.append(seg[2] if len(seg) > 2 else "")
            
            snippets[i] = " ".join(clip_segments)
        
        return snippets
    
    def _fallback_from_candidates(self, candidates: List[ClipData]) -> List[ClipData]:
        """Generate basic hooks from candidates when Pass #2 fails."""
        final = candidates[:self.max_final]
        for i, clip in enumerate(final):
            clip.index = i + 1
            if not clip.hook:
                clip.hook = "Kamu harus tahu ini!"
            if not clip.keywords:
                # Extract first 2 significant words from reason
                words = [w for w in clip.reason.split() if len(w) > 3][:2]
                clip.keywords = [w.upper() for w in words] if words else ["PENTING"]
        return final
