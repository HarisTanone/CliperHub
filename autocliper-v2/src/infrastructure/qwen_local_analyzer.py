"""
Qwen Local Analyzer — Local AI fallback via Ollama (qwen3:4b)

Used as automatic fallback when Gemini API fails (429, 503, quota exceeded).
Connects to local Ollama server at http://localhost:11434.

Performance:
  - Pass #1: ~60s per chunk (vs Gemini ~3s)
  - Pass #2: ~45s (vs Gemini ~3s)
  - Total for 5 chunks: ~6-8 minutes (vs Gemini ~30s)
  - But: FREE, no quota limits, works offline

Key settings for qwen3:
  - think: False  → disables reasoning/thinking mode (critical for speed)
  - format: json  → forces JSON-only output
  - temperature: 0.3 → low creativity, high accuracy
"""
import os
import re
import json
import logging
import time
from typing import List, Dict, Any, Optional

import requests

from ..domain.entities import ClipData, ClipScores
from ..domain.interfaces import IAIAnalyzer

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────────────────────
QWEN_CONFIG = {
    "base_url": os.getenv("OLLAMA_URL", "http://localhost:11434"),
    "model": os.getenv("QWEN_MODEL", "qwen2.5:14b"),  # Default: qwen2.5:14b
    "temperature": 0.3,
    "num_predict_pass1": 3000,
    "num_predict_pass2": 4000,
    "timeout": 300,              # 5 minutes (configurable via QWEN_TIMEOUT)
    "think": False,              # disable thinking mode
    "max_candidates_pass1": 10,
    "retry_on_parse_fail": 2,
}


class QwenLocalAnalyzer(IAIAnalyzer):
    """Local Qwen2.5:14b implementation via Ollama for chunked multi-pass analysis.
    
    Acts as fallback when Gemini is unavailable, or as primary for Pass #1 in hybrid mode.
    Produces identical JSON format to GeminiChunkedAnalyzer.
    """
    
    def __init__(self, base_url: str = None, model: str = None, timeout: int = None):
        self.base_url = base_url or QWEN_CONFIG["base_url"]
        self.model = model or QWEN_CONFIG["model"]
        self.timeout = timeout or QWEN_CONFIG["timeout"]
        self.chat_url = f"{self.base_url}/api/chat"
    
    def _verify_connection(self):
        """Check if Ollama server is running and model is available."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if resp.status_code == 200:
                models = [m['name'] for m in resp.json().get('models', [])]
                # Check both exact match and base name match
                model_base = self.model.split(':')[0]
                available = any(model_base in m for m in models)
                if available:
                    logger.info(f"[QwenLocal] ✅ Connected to Ollama, model '{self.model}' available")
                else:
                    logger.warning(f"[QwenLocal] ⚠️ Model '{self.model}' not found. Available: {models}")
                    raise ConnectionError(f"Model {self.model} not available in Ollama")
            else:
                raise ConnectionError(f"Ollama returned status {resp.status_code}")
        except requests.ConnectionError:
            raise ConnectionError(
                f"Cannot connect to Ollama at {self.base_url}. "
                "Make sure 'ollama serve' is running."
            )
    
    def _chat(self, prompt: str, max_tokens: int = 1200) -> str:
        """Send a chat request to Ollama and return the response text."""
        payload = {
            'model': self.model,
            'messages': [{'role': 'user', 'content': prompt}],
            'stream': False,
            'format': 'json',
            'think': QWEN_CONFIG["think"],
            'options': {
                'temperature': QWEN_CONFIG["temperature"],
                'num_predict': max_tokens,
            }
        }
        
        resp = requests.post(
            self.chat_url,
            json=payload,
            timeout=self.timeout
        )
        resp.raise_for_status()
        
        result = resp.json()
        return result.get('message', {}).get('content', '')
    
    # ─── IAIAnalyzer Interface ───────────────────────────────────────────────
    def analyze_video(self, video_path: str) -> List[Dict[str, Any]]:
        """Legacy interface — not used in chunked flow."""
        return []
    
    def analyze_candidates(self, transcript_chunk: str, metadata: Dict[str, Any],
                           chunk_id: int, chunk_start_time: float) -> List[ClipData]:
        """Pass #1: Find candidate clips in a single chunk using Qwen local.
        
        Includes retry on parse failure (truncated JSON is common with smaller models).
        """
        max_retries = QWEN_CONFIG.get("retry_on_parse_fail", 2)
        
        for attempt in range(max_retries):
            prompt = self._build_pass1_prompt(metadata, chunk_id, chunk_start_time, transcript_chunk)
            
            logger.info(f"[QwenLocal] Pass #1 chunk {chunk_id} — sending to {self.model}..."
                       f"{' (retry ' + str(attempt + 1) + ')' if attempt > 0 else ''}")
            start = time.time()
            
            try:
                output = self._chat(prompt, max_tokens=QWEN_CONFIG["num_predict_pass1"])
                elapsed = time.time() - start
                logger.info(f"[QwenLocal] Pass #1 chunk {chunk_id} — response in {elapsed:.1f}s ({len(output)} chars)")
                
                candidates = self._parse_pass1_response(output, chunk_id)
                if candidates:
                    return candidates
                
                # Parse returned empty — might be truncated JSON, retry with more tokens
                if attempt < max_retries - 1:
                    logger.warning(f"[QwenLocal] Pass #1 chunk {chunk_id}: 0 candidates (possibly truncated), retrying...")
                    # Increase token budget for retry
                    QWEN_CONFIG["num_predict_pass1"] = min(QWEN_CONFIG["num_predict_pass1"] + 1000, 5000)
                    time.sleep(2)
                    continue
                    
            except requests.exceptions.ReadTimeout:
                elapsed = time.time() - start
                logger.error(f"[QwenLocal] Pass #1 chunk {chunk_id}: Timeout after {elapsed:.0f}s")
                if attempt < max_retries - 1:
                    logger.info(f"[QwenLocal] Retrying chunk {chunk_id}...")
                    time.sleep(3)
                    continue
                raise
            except Exception as e:
                logger.error(f"[QwenLocal] Pass #1 chunk {chunk_id} error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                raise
        
        logger.warning(f"[QwenLocal] Pass #1 chunk {chunk_id}: All {max_retries} attempts returned 0 candidates")
        return []
    
    def rank_candidates(self, candidates: List[ClipData], metadata: Dict[str, Any],
                        transcript_snippets: Dict[int, str]) -> List[ClipData]:
        """Pass #2: Final ranking with hooks and keywords using Qwen local.
        
        Includes retry on parse failure.
        """
        max_retries = QWEN_CONFIG.get("retry_on_parse_fail", 2)
        
        for attempt in range(max_retries):
            prompt = self._build_pass2_prompt(metadata, candidates, transcript_snippets)
            
            logger.info(f"[QwenLocal] Pass #2 — ranking {len(candidates)} candidates..."
                       f"{' (retry ' + str(attempt + 1) + ')' if attempt > 0 else ''}")
            start = time.time()
            
            try:
                output = self._chat(prompt, max_tokens=QWEN_CONFIG["num_predict_pass2"])
                elapsed = time.time() - start
                logger.info(f"[QwenLocal] Pass #2 — response in {elapsed:.1f}s ({len(output)} chars)")
                
                result = self._parse_pass2_response(output)
                if result:
                    return result
                
                if attempt < max_retries - 1:
                    logger.warning(f"[QwenLocal] Pass #2: 0 results (possibly truncated), retrying...")
                    QWEN_CONFIG["num_predict_pass2"] = min(QWEN_CONFIG["num_predict_pass2"] + 1000, 6000)
                    time.sleep(2)
                    continue
                    
            except requests.exceptions.ReadTimeout:
                logger.error(f"[QwenLocal] Pass #2: Timeout")
                if attempt < max_retries - 1:
                    time.sleep(3)
                    continue
                raise
            except Exception as e:
                logger.error(f"[QwenLocal] Pass #2 error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                raise
        
        logger.warning(f"[QwenLocal] Pass #2: All attempts failed, returning empty")
        return []
    
    # ─── Pass #1 Prompt (optimized for smaller model) ────────────────────────
    def _build_pass1_prompt(self, metadata: Dict[str, Any], chunk_id: int,
                            chunk_start_time: float, transcript_chunk: str) -> str:
        """Build Pass #1 prompt — adaptive based on model size."""
        max_candidates = QWEN_CONFIG.get("max_candidates_pass1", 5)
        model = QWEN_CONFIG["model"].lower()
        
        # Determine if model is "large" (>= 8B) or "small" (< 8B)
        is_large_model = any(size in model for size in ['8b', '14b', '32b', '70b', '72b'])
        
        if is_large_model:
            # Large model: can handle full transcript + complex instructions
            max_chars = 30000
            if len(transcript_chunk) > max_chars:
                transcript_chunk = transcript_chunk[:max_chars] + "\n...(truncated)"
            
            return f"""Kamu analis video viral profesional. Analisis transcript berikut dan cari momen terbaik untuk short video.

VIDEO: {metadata.get('title', 'Unknown')} ({metadata.get('duration', 0)}s)
CHUNK #{chunk_id} (mulai dari {chunk_start_time:.0f}s)

TUGAS: Cari maksimal {max_candidates} momen PALING VIRAL (30-60 detik each).
Score 0.0-1.0 untuk setiap dimensi: viral, curiosity, emotion, controversy, story.

KRITERIA MOMEN VIRAL:
- Pernyataan kontroversial atau shocking
- Informasi yang sangat valuable
- Momen emosional kuat
- Tips actionable
- Cerita engaging / relatable

HANYA RETURN JSON (tanpa text lain):
{{"status":200,"chunk_id":{chunk_id},"candidates":[{{"start_time":float,"end_time":float,"viral_score":float,"curiosity_score":float,"emotion_score":float,"controversy_score":float,"story_score":float,"brief_reason":"alasan singkat kenapa viral"}}]}}

ATURAN:
- timestamp HARUS ABSOLUT (bukan relatif dari awal chunk)
- durasi setiap clip 30-60 detik
- jangan potong di tengah kalimat
- score harus realistis (jangan semua 0.9)

TRANSCRIPT:
{transcript_chunk}"""
        else:
            # Small model (4B): ultra-simplified, truncated transcript
            max_chars = 6000
            if len(transcript_chunk) > max_chars:
                transcript_chunk = transcript_chunk[:max_chars] + "\n..."
            
            return f"""Find {max_candidates} best viral moments. Return JSON only.

Video: {metadata.get('title', 'Unknown')} (starts at {chunk_start_time:.0f}s)

Return this exact JSON format:
{{"status":200,"chunk_id":{chunk_id},"candidates":[{{"start_time":100.0,"end_time":145.0,"viral_score":0.8,"curiosity_score":0.7,"emotion_score":0.6,"controversy_score":0.5,"story_score":0.7,"brief_reason":"why this moment is viral"}}]}}

Rules:
- Each clip 30-60 seconds
- Use actual timestamps from transcript (NOT the example above)
- Return ONLY valid JSON, nothing else
- brief_reason must describe the actual content

Transcript:
{transcript_chunk}"""
    
    # ─── Pass #2 Prompt (optimized for smaller model) ────────────────────────
    def _build_pass2_prompt(self, metadata: Dict[str, Any], candidates: List[ClipData],
                            transcript_snippets: Dict[int, str]) -> str:
        """Build Pass #2 prompt optimized for qwen3:4b."""
        # Build compact candidate list
        candidate_lines = []
        for i, clip in enumerate(candidates):
            snippet = transcript_snippets.get(i, "")[:200]
            score_str = ""
            if clip.scores:
                score_str = (f"v={clip.scores.viral_score:.1f} c={clip.scores.curiosity_score:.1f} "
                             f"e={clip.scores.emotion_score:.1f}")
            candidate_lines.append(
                f"#{i+1}: [{clip.start_time:.0f}s-{clip.end_time:.0f}s] {score_str} | {clip.reason[:60]}"
                f"\n  Text: {snippet}..."
            )
        
        candidates_text = "\n".join(candidate_lines)
        max_final = 10
        
        return f"""Kamu analis video viral FINAL. Pilih {max_final} clip TERBAIK, buat hook + keywords.

VIDEO: {metadata.get('title', 'Unknown')} ({metadata.get('duration', 0)}s)

KANDIDAT:
{candidates_text}

TUGAS:
1. Pilih {max_final} terbaik
2. Buat hook: 3-8 kata, BRUTAL, bikin scroll stop, OPEN LOOP
3. Keywords: 2-4 kata POWERFUL dari hook, UPPERCASE

HANYA RETURN JSON:
{{"status":200,"language":"id","data":[{{"index":1,"start_time":float,"end_time":float,"hook":"3-8 kata max 50 char","keywords":["KATA1","KATA2"],"viral_score":float,"curiosity_score":float,"emotion_score":float,"controversy_score":float,"story_score":float,"reason":"string"}}]}}

ATURAN HOOK: bahasa sama dgn video, OPEN LOOP (jangan kasih jawaban), max 50 karakter."""
    
    # ─── Response Parsers (same logic as GeminiChunkedAnalyzer) ───────────────
    def _parse_pass1_response(self, response_text: str, chunk_id: int) -> List[ClipData]:
        """Parse Pass #1 response into ClipData with multi-scores."""
        try:
            # Log full response for debugging (Qwen often returns unexpected format)
            logger.info(f"[QwenLocal] Pass1 chunk {chunk_id} raw response ({len(response_text)} chars): "
                       f"{response_text[:500]}...")
            
            json_match = re.search(r'\{[\s\S]*"candidates"[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                # Try parsing entire response as JSON
                result = json.loads(response_text)
            
            candidates_raw = result.get("candidates", [])
            logger.info(f"[QwenLocal] Pass1 chunk {chunk_id}: parsed JSON OK, "
                       f"found {len(candidates_raw)} candidates in response")
            
            if not candidates_raw:
                # Log what keys ARE in the response to debug
                logger.warning(f"[QwenLocal] Pass1 chunk {chunk_id}: 'candidates' is empty. "
                              f"Response keys: {list(result.keys())}")
                # Try alternative key names that Qwen might use
                for alt_key in ['data', 'clips', 'results', 'moments']:
                    alt_data = result.get(alt_key, [])
                    if alt_data and isinstance(alt_data, list):
                        logger.info(f"[QwenLocal] Found data under key '{alt_key}' instead of 'candidates'")
                        candidates_raw = alt_data
                        break
            
            clips = []
            for i, cand in enumerate(candidates_raw):
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
                    hook="",
                    score=scores.final_score,
                    reason=cand.get("brief_reason", cand.get("reason", "")),
                    keywords=[],
                    scores=scores,
                    chunk_id=chunk_id,
                ))
            
            return clips
            
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"[QwenLocal] Pass1 parse failed for chunk {chunk_id}: {e}")
            logger.error(f"[QwenLocal] Full response: {response_text[:1000]}")
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
            
            clips.sort(key=lambda c: c.scores.final_score if c.scores else c.score, reverse=True)
            for i, clip in enumerate(clips):
                clip.index = i + 1
            
            return clips
            
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"[QwenLocal] Pass2 parse failed: {e}")
            logger.debug(f"[QwenLocal] Response: {response_text[:300]}")
            return []


def is_ollama_available(model: str = None) -> bool:
    """Quick check if Ollama is running and model is available."""
    model = model or QWEN_CONFIG["model"]
    try:
        resp = requests.get(f"{QWEN_CONFIG['base_url']}/api/tags", timeout=3)
        if resp.status_code == 200:
            models = [m['name'] for m in resp.json().get('models', [])]
            model_base = model.split(':')[0]
            return any(model_base in m for m in models)
    except:
        pass
    return False
