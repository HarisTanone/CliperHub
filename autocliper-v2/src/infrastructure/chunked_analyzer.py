"""
Chunked AI Analyzer — Multi-Pass Transcript Analysis (Hybrid Architecture)

Architecture:
  Whisper Full Transcript
       ↓
  STEP 4a: Transcript Chunk Builder (4000 words/chunk, 200 word overlap)
       ↓
  STEP 4b: AI Pass #1 — Candidate Detection
           Hybrid Mode: Qwen primary (sequential), Gemini fallback
           Standard Mode: Gemini primary (3 concurrent), Qwen fallback
       ↓
  STEP 4c: Candidate Aggregator (sort, dedup, remove overlap → Top 40)
       ↓
  STEP 4d: AI Pass #2 — Final Ranking (Top 10 clips with hooks & keywords)
           Both modes: Gemini primary, Qwen fallback
       ↓
  Output: List[ClipData]

Toggle via USE_QWEN_FOR_PASS1 env var:
  - "true"/"1"/"yes" → Hybrid Mode (Qwen Pass #1, Gemini Pass #2)
  - "false"/"0"/"no"/absent → Standard Mode (Gemini both)
"""
import os
import re
import json
import time
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests as http_requests

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
    "max_concurrent_chunks_gemini": 3,
    "max_concurrent_chunks_qwen": 1,
    "max_candidates_after_aggregation": 40,
    "max_final_clips": 10,
    "retry_max": 1,
    "retry_delay_base": 2.0,  # seconds, exponential backoff
    "health_check_timeout": 10,  # seconds for Qwen availability check
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
#  Pipeline Mode & Configuration
# ─────────────────────────────────────────────────────────────────────────────
class PipelineMode(Enum):
    """Operating mode for the analysis pipeline."""
    HYBRID = "hybrid"      # Pass1=Qwen, Pass2=Gemini
    STANDARD = "standard"  # Pass1=Gemini, Pass2=Gemini


@dataclass
class ProviderConfig:
    """Configuration resolved at pipeline initialization."""
    mode: PipelineMode
    pass1_primary: IAIAnalyzer
    pass1_fallback: Optional[IAIAnalyzer]
    pass2_primary: IAIAnalyzer
    pass2_fallback: Optional[IAIAnalyzer]
    qwen_available: bool
    qwen_timeout: int    # seconds per Qwen request
    gemini_timeout: int  # seconds per Gemini request
    max_concurrent_chunks: int  # 1 for Qwen primary, 3 for Gemini primary


@dataclass
class PassExecutionSummary:
    """Summary of Pass #1 or Pass #2 execution for logging."""
    total_chunks: int
    primary_success: int
    fallback_success: int
    failed: int
    failed_chunk_ids: List[int] = field(default_factory=list)
    failed_reasons: Dict[int, str] = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
#  Qwen Availability Check
# ─────────────────────────────────────────────────────────────────────────────
def check_qwen_availability(
    base_url: str = None,
    model: str = None,
    health_check_timeout: int = None,
) -> Tuple[bool, str]:
    """Check if Ollama is reachable and the configured model is loaded.
    
    Returns:
        (is_available, reason) — reason explains why unavailable if False
    """
    base_url = base_url or os.getenv("OLLAMA_URL", "http://localhost:11434")
    model = model or os.getenv("QWEN_MODEL", "qwen2.5:14b")
    health_check_timeout = health_check_timeout or CHUNK_CONFIG["health_check_timeout"]
    
    try:
        resp = http_requests.get(f"{base_url}/api/tags", timeout=health_check_timeout)
        if resp.status_code != 200:
            return False, f"Ollama returned HTTP {resp.status_code} at {base_url}"
        
        models = [m['name'] for m in resp.json().get('models', [])]
        model_base = model.split(':')[0]
        available = any(model_base in m for m in models)
        
        if available:
            return True, f"Model '{model}' available at {base_url}"
        else:
            return False, (f"Model '{model}' not found in Ollama. "
                          f"Available models: {models}")
    except http_requests.ConnectionError:
        return False, f"Cannot connect to Ollama at {base_url}"
    except http_requests.Timeout:
        return False, f"Ollama health check timed out ({health_check_timeout}s) at {base_url}"
    except Exception as e:
        return False, f"Ollama check failed: {e}"


def _parse_timeout_env(env_name: str, default: int) -> int:
    """Parse a timeout environment variable, returning default on invalid input."""
    raw = os.getenv(env_name, "")
    if not raw:
        return default
    try:
        value = int(raw)
        if value <= 0:
            raise ValueError("non-positive")
        return value
    except (ValueError, TypeError):
        logger.warning(f"[Config] ⚠️ {env_name}='{raw}' is invalid (non-numeric or non-positive), "
                      f"using default {default}s")
        return default


def _parse_mode_env() -> PipelineMode:
    """Parse USE_QWEN_FOR_PASS1 env var and return the target mode."""
    raw = os.getenv("USE_QWEN_FOR_PASS1", "").strip().lower()
    
    if raw in ("true", "1", "yes"):
        return PipelineMode.HYBRID
    elif raw in ("false", "0", "no", ""):
        return PipelineMode.STANDARD
    else:
        logger.warning(f"[Config] ⚠️ USE_QWEN_FOR_PASS1='{raw}' is unrecognized, "
                      f"defaulting to Standard Mode")
        return PipelineMode.STANDARD


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
2. Setiap momen harus 45-90 detik (WAJIB minimal 45 detik!)
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
- Durasi MINIMAL 45 detik, MAKSIMAL 90 detik per kandidat (WAJIB!)
- JANGAN potong di tengah kalimat, topik, atau cerita yang sedang berjalan
- Mulai dari awal topik/kalimat, akhiri saat topik selesai atau ada jeda/perpindahan topik
- Pastikan cerita atau poin yang disampaikan LENGKAP, tidak nanggung
- Beri ruang 2 detik sebelum kalimat inti dimulai
- Beri ruang 2 detik setelah kalimat terakhir selesai
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
#  Provider Executor — Retry + Fallback + Timeout Logic
# ─────────────────────────────────────────────────────────────────────────────
class ProviderExecutor:
    """Executes AI provider calls with retry, timeout, and fallback logic."""
    
    def __init__(self, progress_callback=None, job_id: Optional[int] = None):
        self._progress = progress_callback or (lambda msg: None)
        self.job_id = job_id
    
    def execute_pass1(
        self,
        chunk: 'TranscriptChunk',
        metadata: Dict[str, Any],
        primary: IAIAnalyzer,
        fallback: Optional[IAIAnalyzer],
        primary_timeout: int,
        fallback_timeout: int,
        primary_name: str = "Primary",
        fallback_name: str = "Fallback",
    ) -> ChunkResult:
        """Execute Pass #1 for a single chunk with retry + fallback.
        
        Fallback triggers on:
        - Exception (connection error, timeout, HTTP error)
        - Primary returns 0 candidates after all retries (empty result = quality failure)
        """
        max_retries = CHUNK_CONFIG["retry_max"]
        delay_base = CHUNK_CONFIG["retry_delay_base"]
        
        # Determine transcript format based on provider type
        from .qwen_local_analyzer import QwenLocalAnalyzer
        is_qwen_primary = isinstance(primary, QwenLocalAnalyzer)
        transcript_text = chunk.to_text() if is_qwen_primary else chunk.to_json()
        
        # ─── Try primary provider ────────────────────────────────────────────
        last_error = ""
        for attempt in range(max_retries + 1):
            try:
                candidates = primary.analyze_candidates(
                    transcript_chunk=transcript_text,
                    metadata=metadata,
                    chunk_id=chunk.chunk_id,
                    chunk_start_time=chunk.start_time,
                )
                
                # Validate timestamps within chunk bounds (5s tolerance)
                valid_candidates = self._validate_candidates(candidates, chunk)
                
                # Filter out clips that are too short (< 25s)
                min_duration = 25.0
                valid_candidates = [c for c in valid_candidates 
                                   if (c.end_time - c.start_time) >= min_duration]
                
                if valid_candidates:
                    return ChunkResult(
                        chunk_id=chunk.chunk_id,
                        success=True,
                        candidates=valid_candidates,
                        retries_used=attempt,
                    )
                
                # Primary returned 0 valid candidates — treat as failure, try fallback
                last_error = f"0 valid candidates (>={min_duration}s) after validation"
                logger.warning(f"  ⚠️ Chunk {chunk.chunk_id}: {primary_name} returned 0 valid candidates")
                break
                
            except Exception as e:
                last_error = str(e)
                is_retriable = self._is_retriable_error(last_error)
                
                if is_retriable and attempt < max_retries:
                    delay = delay_base * (2 ** attempt)
                    logger.info(f"  ⏳ Chunk {chunk.chunk_id} retry {attempt + 1}/{max_retries} "
                                f"in {delay:.1f}s ({last_error[:80]})")
                    time.sleep(delay)
                    continue
                
                # Log the fallback event
                self._log_fallback(
                    source=primary_name,
                    target=fallback_name,
                    reason=self._classify_error(last_error),
                    chunk_id=chunk.chunk_id,
                )
                break
        
        # ─── Try fallback provider ───────────────────────────────────────────
        if fallback:
            try:
                is_qwen_fallback = isinstance(fallback, QwenLocalAnalyzer)
                fallback_transcript = chunk.to_text() if is_qwen_fallback else chunk.to_json()
                
                self._progress(f"🔄 Chunk {chunk.chunk_id}: {primary_name} failed, "
                              f"fallback to {fallback_name}")
                logger.info(f"  🔄 Chunk {chunk.chunk_id}: Falling back to {fallback_name}...")
                
                candidates = fallback.analyze_candidates(
                    transcript_chunk=fallback_transcript,
                    metadata=metadata,
                    chunk_id=chunk.chunk_id,
                    chunk_start_time=chunk.start_time,
                )
                
                valid_candidates = self._validate_candidates(candidates, chunk)
                # Filter short clips
                min_duration = 25.0
                valid_candidates = [c for c in valid_candidates 
                                   if (c.end_time - c.start_time) >= min_duration]
                
                if valid_candidates:
                    logger.info(f"  ✅ Chunk {chunk.chunk_id}: {fallback_name} fallback succeeded "
                               f"({len(valid_candidates)} candidates)")
                    self._progress(f"✅ Chunk {chunk.chunk_id}: {fallback_name} fallback — "
                                  f"{len(valid_candidates)} candidates")
                    
                    return ChunkResult(
                        chunk_id=chunk.chunk_id,
                        success=True,
                        candidates=valid_candidates,
                        retries_used=max_retries,
                    )
                else:
                    logger.warning(f"  ⚠️ Chunk {chunk.chunk_id}: {fallback_name} also returned 0 valid candidates")
            except Exception as fallback_err:
                logger.error(f"  ❌ Chunk {chunk.chunk_id}: Fallback also failed: {fallback_err}")
        
        # Both primary and fallback failed
        return ChunkResult(
            chunk_id=chunk.chunk_id,
            success=False,
            error=f"Primary ({primary_name}) and fallback ({fallback_name}) failed: {last_error[:150]}",
            retries_used=max_retries,
        )
    
    def execute_pass2(
        self,
        candidates: List[ClipData],
        metadata: Dict[str, Any],
        transcript_snippets: Dict[int, str],
        primary: IAIAnalyzer,
        fallback: Optional[IAIAnalyzer],
        primary_timeout: int,
        fallback_timeout: int,
        max_final: int,
        primary_name: str = "Gemini",
        fallback_name: str = "Qwen",
    ) -> List[ClipData]:
        """Execute Pass #2 with retry + fallback. Returns empty list on total failure."""
        max_retries = CHUNK_CONFIG["retry_max"]
        delay_base = CHUNK_CONFIG["retry_delay_base"]
        
        # ─── Try primary provider ────────────────────────────────────────────
        for attempt in range(max_retries + 1):
            try:
                result = primary.rank_candidates(candidates, metadata, transcript_snippets)
                if result:
                    return result[:max_final]
            except Exception as e:
                error_str = str(e)
                if attempt < max_retries:
                    delay = delay_base * (2 ** attempt)
                    logger.info(f"  ⏳ Pass #2 retry {attempt + 1}/{max_retries} in {delay:.1f}s")
                    time.sleep(delay)
                    continue
                
                self._log_fallback(
                    source=primary_name,
                    target=fallback_name,
                    reason=self._classify_error(error_str),
                    chunk_id=None,
                    pass_label="Pass_2",
                )
                logger.error(f"[Pass2] Primary ({primary_name}) failed: {error_str[:200]}")
        
        # ─── Try fallback provider ───────────────────────────────────────────
        if fallback:
            try:
                logger.info(f"[Pass2] 🔄 Falling back to {fallback_name} for final ranking...")
                self._progress(f"🔄 Pass #2: {primary_name} failed, using {fallback_name} for ranking...")
                
                result = fallback.rank_candidates(candidates, metadata, transcript_snippets)
                if result:
                    logger.info(f"[Pass2] ✅ {fallback_name} fallback succeeded: {len(result)} clips")
                    self._progress(f"✅ Pass #2: {fallback_name} fallback — {len(result)} final clips")
                    return result[:max_final]
            except Exception as fallback_err:
                logger.error(f"[Pass2] Fallback ({fallback_name}) also failed: {fallback_err}")
                self._log_fallback(
                    source=fallback_name,
                    target="fallback_from_candidates",
                    reason=self._classify_error(str(fallback_err)),
                    chunk_id=None,
                    pass_label="Pass_2",
                )
        
        return []
    
    # ─── Helpers ─────────────────────────────────────────────────────────────
    def _validate_candidates(self, candidates: List[ClipData],
                             chunk: 'TranscriptChunk') -> List[ClipData]:
        """Validate candidate timestamps are within chunk bounds (5s tolerance)."""
        valid = []
        for c in candidates:
            if c.start_time >= (chunk.start_time - 5) and c.end_time <= (chunk.end_time + 5):
                valid.append(c)
            else:
                logger.debug(f"  Discarded out-of-bounds candidate: "
                             f"{c.start_time:.0f}-{c.end_time:.0f}s "
                             f"(chunk: {chunk.start_time:.0f}-{chunk.end_time:.0f}s)")
        return valid
    
    def _is_retriable_error(self, error_str: str) -> bool:
        """Check if error is retriable (connection, timeout, 429/503)."""
        lower = error_str.lower()
        return any(x in lower for x in ["429", "500", "503", "timeout", "connection"])
    
    def _classify_error(self, error_str: str) -> str:
        """Classify error into a category for logging."""
        lower = error_str.lower()
        if "timeout" in lower:
            return "timeout_exceeded"
        elif "connection" in lower:
            return "connection_error"
        elif "429" in lower or "503" in lower or "500" in lower:
            return "http_error"
        else:
            return "unknown_error"
    
    def _log_fallback(self, source: str, target: str, reason: str,
                      chunk_id: Optional[int], pass_label: str = None):
        """Log structured fallback event at WARNING level."""
        event = {
            "event": "provider_fallback",
            "source_provider": source,
            "target_provider": target,
            "reason": reason,
            "job_id": self.job_id,
            "chunk_id": chunk_id if chunk_id is not None else pass_label,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.warning(f"[Fallback] {json.dumps(event, ensure_ascii=False)}")


# ─────────────────────────────────────────────────────────────────────────────
#  Main Orchestrator: ChunkedAnalysisPipeline
# ─────────────────────────────────────────────────────────────────────────────
class ChunkedAnalysisPipeline:
    """Orchestrates the full multi-pass analysis pipeline with hybrid provider support.
    
    Modes:
      - HYBRID: Pass #1 uses Qwen (local, sequential), Pass #2 uses Gemini
      - STANDARD: Both passes use Gemini (concurrent Pass #1)
    
    Usage:
        pipeline = ChunkedAnalysisPipeline()
        clips = pipeline.analyze(whisper_transcript_json, metadata)
    """
    
    def __init__(self, progress_callback=None, job_id: Optional[int] = None):
        """Initialize with auto-resolved provider configuration.
        
        Reads environment variables:
          - USE_QWEN_FOR_PASS1: "true"/"1"/"yes" → Hybrid Mode
          - QWEN_TIMEOUT: seconds (default 300)
          - GEMINI_TIMEOUT: seconds (default 60)
          - QWEN_MODEL: Ollama model name (default "qwen2.5:14b")
          - OLLAMA_URL: Ollama server URL (default "http://localhost:11434")
        
        Args:
            progress_callback: Optional callable(message: str) for real-time progress updates
            job_id: Optional job ID for structured logging
        """
        self._progress = progress_callback or (lambda msg: None)
        self.job_id = job_id
        self.chunk_builder = TranscriptChunkBuilder()
        self.aggregator = CandidateAggregator()
        self.max_final = CHUNK_CONFIG["max_final_clips"]
        
        # Resolve configuration (env vars + availability check)
        self.config = self._resolve_config()
        self.max_concurrent = self.config.max_concurrent_chunks
        
        # Initialize executor
        self.executor = ProviderExecutor(
            progress_callback=self._progress,
            job_id=job_id,
        )
        
        logger.info(f"[Pipeline] ✅ Mode: {self.config.mode.value.upper()} | "
                   f"Pass1: {self._provider_name(self.config.pass1_primary)} | "
                   f"Pass2: {self._provider_name(self.config.pass2_primary)} | "
                   f"Concurrency: {self.config.max_concurrent_chunks}")
    
    def _resolve_config(self) -> ProviderConfig:
        """Resolve provider configuration from environment variables."""
        # Parse timeouts
        qwen_timeout = _parse_timeout_env("QWEN_TIMEOUT", 300)
        gemini_timeout = _parse_timeout_env("GEMINI_TIMEOUT", 60)
        
        # Parse target mode
        target_mode = _parse_mode_env()
        
        # Initialize Gemini (always needed)
        gemini = GeminiChunkedAnalyzer()
        
        # Check if hybrid mode is requested
        if target_mode == PipelineMode.HYBRID:
            # Check Qwen availability
            is_available, reason = check_qwen_availability()
            
            if is_available:
                from .qwen_local_analyzer import QwenLocalAnalyzer
                qwen = QwenLocalAnalyzer(timeout=qwen_timeout)
                
                logger.info(f"[Config] ✅ Hybrid Mode activated — Qwen available ({reason})")
                self._progress("🔧 Hybrid Mode: Qwen untuk Pass #1, Gemini untuk Pass #2")
                
                return ProviderConfig(
                    mode=PipelineMode.HYBRID,
                    pass1_primary=qwen,
                    pass1_fallback=gemini,
                    pass2_primary=gemini,
                    pass2_fallback=qwen,
                    qwen_available=True,
                    qwen_timeout=qwen_timeout,
                    gemini_timeout=gemini_timeout,
                    max_concurrent_chunks=CHUNK_CONFIG["max_concurrent_chunks_qwen"],
                )
            else:
                # Qwen unavailable — downgrade to Standard
                logger.warning(f"[Config] ⚠️ Hybrid Mode requested but Qwen unavailable: {reason}")
                logger.warning("[Config] ⚠️ Downgrading to Standard Mode for this job")
                self._progress(f"⚠️ Hybrid→Standard: Qwen unavailable ({reason})")
        
        # Standard Mode (or downgraded from Hybrid)
        # Try to load Qwen as fallback (best effort)
        qwen_fallback = None
        qwen_available = False
        if target_mode == PipelineMode.STANDARD:
            # In standard mode, check Qwen availability for fallback use
            is_available, _ = check_qwen_availability()
            if is_available:
                try:
                    from .qwen_local_analyzer import QwenLocalAnalyzer
                    qwen_fallback = QwenLocalAnalyzer(timeout=qwen_timeout)
                    qwen_available = True
                except Exception:
                    pass
        
        logger.info("[Config] Standard Mode — Gemini primary for both passes")
        
        return ProviderConfig(
            mode=PipelineMode.STANDARD,
            pass1_primary=gemini,
            pass1_fallback=qwen_fallback,
            pass2_primary=gemini,
            pass2_fallback=qwen_fallback,
            qwen_available=qwen_available,
            qwen_timeout=qwen_timeout,
            gemini_timeout=gemini_timeout,
            max_concurrent_chunks=CHUNK_CONFIG["max_concurrent_chunks_gemini"],
        )
    
    def _provider_name(self, provider: Optional[IAIAnalyzer]) -> str:
        """Get human-readable name for a provider."""
        if provider is None:
            return "None"
        class_name = type(provider).__name__
        if "Qwen" in class_name:
            return "Qwen2.5:14b (local)"
        elif "Gemini" in class_name:
            return "Gemini 2.5-flash"
        return class_name
    
    def analyze(self, whisper_transcript: str, metadata: Dict[str, Any],
                full_transcript_json: str = None) -> List[ClipData]:
        """Run full multi-pass analysis pipeline.
        
        Args:
            whisper_transcript: JSON string from Whisper ({"data": [...]})
            metadata: Video metadata dict
            full_transcript_json: Original transcript for snippet extraction (same as whisper_transcript if not provided)
            
        Returns:
            Final list of ClipData (max 10 clips, ranked by final_score)
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
        
        # ─── STEP 4b: Pass #1 — Candidate Detection ─────────────────────────
        pass1_primary_name = self._provider_name(self.config.pass1_primary)
        
        if self.config.mode == PipelineMode.HYBRID:
            est_time = f"~{len(chunks) * 3} min"
            self._progress(f"🔍 Pass #1: Scanning {len(chunks)} chunks with local Qwen2.5:14b ({est_time})...")
        else:
            est_time = f"~{len(chunks) * 3} sec"
            self._progress(f"🔍 Pass #1: Scanning {len(chunks)} chunks with Gemini ({est_time})...")
        
        logger.info(f"[Chunked Analysis] STEP 4b: Pass #1 — {len(chunks)} chunks | "
                    f"Primary: {pass1_primary_name} | Concurrency: {self.max_concurrent}")
        
        chunk_results = self._run_pass1(chunks, metadata)
        
        # Build execution summary
        summary = self._build_summary(chunk_results)
        logger.info(f"[Chunked Analysis] Pass #1 summary: "
                    f"primary={summary.primary_success}, fallback={summary.fallback_success}, "
                    f"failed={summary.failed} (total={summary.total_chunks})")
        
        total_candidates = sum(len(r.candidates) for r in chunk_results if r.success)
        successful_chunks = summary.primary_success + summary.fallback_success
        
        # Handle partial/total failure
        if total_candidates == 0:
            logger.error("[Chunked Analysis] No candidates found in any chunk — total failure")
            self._progress(f"❌ Pass #1 total failure: 0/{summary.total_chunks} chunks succeeded")
            raise RuntimeError(
                f"AI analysis gagal: Pass #1 total failure — 0/{summary.total_chunks} chunks "
                f"berhasil. Primary ({pass1_primary_name}) dan fallback gagal semua."
            )
        
        if summary.failed > 0:
            self._progress(f"⚠️ Pass #1 partial: {successful_chunks}/{summary.total_chunks} "
                          f"chunks succeeded, {summary.failed} failed")
            logger.warning(f"[Chunked Analysis] ⚠️ Partial failure — "
                          f"failed chunks: {summary.failed_chunk_ids}, "
                          f"reasons: {summary.failed_reasons}")
        
        self._progress(f"🔍 Pass #1 done: {total_candidates} candidates from "
                      f"{successful_chunks}/{summary.total_chunks} chunks "
                      f"(primary: {summary.primary_success}, fallback: {summary.fallback_success})")
        
        # ─── STEP 4c: Aggregation ────────────────────────────────────────────
        logger.info("[Chunked Analysis] STEP 4c: Aggregating candidates")
        self._progress(f"🧹 Aggregating {total_candidates} candidates → removing overlaps...")
        top_candidates = self.aggregator.aggregate(chunk_results)
        
        if not top_candidates:
            logger.error("[Chunked Analysis] Aggregator returned empty")
            return []
        
        self._progress(f"🧹 Top {len(top_candidates)} candidates selected for final ranking")
        
        # ─── STEP 4d: Pass #2 — Final Ranking ────────────────────────────────
        pass2_primary_name = self._provider_name(self.config.pass2_primary)
        logger.info(f"[Chunked Analysis] STEP 4d: Pass #2 — Ranking {len(top_candidates)} "
                    f"candidates with {pass2_primary_name}")
        self._progress(f"🏆 Pass #2: Final ranking + hook generation with {pass2_primary_name}...")
        
        # Extract transcript snippets for each candidate
        transcript_snippets = self._extract_snippets(top_candidates, full_transcript_json)
        
        final_clips = self._run_pass2(top_candidates, metadata, transcript_snippets)
        
        if not final_clips:
            # Fallback: use Pass #1 results with generated hooks
            logger.warning("[Chunked Analysis] Pass #2 failed completely, using fallback_from_candidates")
            self._progress("⚠️ Pass #2 failed, using Pass #1 results as fallback")
            final_clips = self._fallback_from_candidates(top_candidates)
        
        self._progress(f"✅ Analysis complete — {len(final_clips)} final clips with hooks & multi-scores")
        logger.info(f"[Chunked Analysis] DONE — {len(final_clips)} final clips")
        logger.info("=" * 60)
        
        return final_clips
    
    # ─── Pass #1 Execution ───────────────────────────────────────────────────
    def _run_pass1(self, chunks: List[TranscriptChunk],
                   metadata: Dict[str, Any]) -> List[ChunkResult]:
        """Run Pass #1 on all chunks with mode-appropriate concurrency."""
        results: List[ChunkResult] = []
        
        primary_name = self._provider_name(self.config.pass1_primary)
        fallback_name = self._provider_name(self.config.pass1_fallback) if self.config.pass1_fallback else "None"
        
        if self.max_concurrent <= 1:
            # Sequential processing (Qwen primary — don't overwhelm Ollama)
            for chunk in chunks:
                result = self._process_single_chunk(chunk, metadata, primary_name, fallback_name)
                results.append(result)
                if result.success:
                    logger.info(f"  ✅ Chunk {chunk.chunk_id}: {len(result.candidates)} candidates")
                else:
                    logger.warning(f"  ❌ Chunk {chunk.chunk_id} failed: {result.error}")
        else:
            # Concurrent processing (Gemini primary)
            with ThreadPoolExecutor(max_workers=self.max_concurrent,
                                    thread_name_prefix="pass1") as pool:
                futures = {
                    pool.submit(self._process_single_chunk, chunk, metadata,
                               primary_name, fallback_name): chunk
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
    
    def _process_single_chunk(self, chunk: TranscriptChunk, metadata: Dict[str, Any],
                              primary_name: str, fallback_name: str) -> ChunkResult:
        """Process a single chunk via ProviderExecutor."""
        return self.executor.execute_pass1(
            chunk=chunk,
            metadata=metadata,
            primary=self.config.pass1_primary,
            fallback=self.config.pass1_fallback,
            primary_timeout=self.config.qwen_timeout if self.config.mode == PipelineMode.HYBRID else self.config.gemini_timeout,
            fallback_timeout=self.config.gemini_timeout if self.config.mode == PipelineMode.HYBRID else self.config.qwen_timeout,
            primary_name=primary_name,
            fallback_name=fallback_name,
        )
    # ─── Pass #2 Execution ───────────────────────────────────────────────────
    def _run_pass2(self, candidates: List[ClipData], metadata: Dict[str, Any],
                   transcript_snippets: Dict[int, str]) -> List[ClipData]:
        """Run Pass #2 via ProviderExecutor with retry + fallback."""
        primary_name = self._provider_name(self.config.pass2_primary)
        fallback_name = self._provider_name(self.config.pass2_fallback) if self.config.pass2_fallback else "None"
        
        return self.executor.execute_pass2(
            candidates=candidates,
            metadata=metadata,
            transcript_snippets=transcript_snippets,
            primary=self.config.pass2_primary,
            fallback=self.config.pass2_fallback,
            primary_timeout=self.config.gemini_timeout,
            fallback_timeout=self.config.qwen_timeout,
            max_final=self.max_final,
            primary_name=primary_name,
            fallback_name=fallback_name,
        )
    
    # ─── Summary Builder ─────────────────────────────────────────────────────
    def _build_summary(self, chunk_results: List[ChunkResult]) -> PassExecutionSummary:
        """Build execution summary from chunk results."""
        max_retries = CHUNK_CONFIG["retry_max"]
        primary_success = 0
        fallback_success = 0
        failed = 0
        failed_ids = []
        failed_reasons = {}
        
        for r in chunk_results:
            if r.success:
                if r.retries_used >= max_retries:
                    fallback_success += 1
                else:
                    primary_success += 1
            else:
                failed += 1
                failed_ids.append(r.chunk_id)
                failed_reasons[r.chunk_id] = r.error or "unknown"
        
        return PassExecutionSummary(
            total_chunks=len(chunk_results),
            primary_success=primary_success,
            fallback_success=fallback_success,
            failed=failed,
            failed_chunk_ids=failed_ids,
            failed_reasons=failed_reasons,
        )
    
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
