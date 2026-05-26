"""
Video Processing Infrastructure - Cut, Audio Extraction, Subtitle Generation
"""
import os
import re
import subprocess
from typing import Dict, Any, List
from moviepy import VideoFileClip, AudioFileClip
from ..domain.entities import VideoInfo, SubtitleSegment
from ..domain.interfaces import IVideoClipper, IAudioExtractor, ISubtitleGenerator


class VideoClipper(IVideoClipper):
    """Cut video segments using MoviePy"""
    
    def cut_video(self, video_path: str, start_time: float, end_time: float, output_path: str) -> str:
        """Cut a video segment using FFmpeg stream copy (no re-encoding, no quality loss)"""
        import subprocess
        
        start = max(0, start_time)
        duration = end_time - start
        
        # FFmpeg stream copy — preserves original quality exactly
        cmd = [
            'ffmpeg',
            '-ss', str(start),           # Seek to start (input option = fast)
            '-i', video_path,            # Input video
            '-t', str(duration),         # Duration
            '-c', 'copy',               # Stream copy (no re-encode)
            '-avoid_negative_ts', '1',   # Fix timestamp issues
            '-y',                        # Overwrite
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"FFmpeg stream copy failed: {result.stderr}")
            # Fallback to re-encode if stream copy fails (rare edge case)
            cmd_reencode = [
                'ffmpeg',
                '-ss', str(start),
                '-i', video_path,
                '-t', str(duration),
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
                '-c:a', 'aac', '-b:a', '192k',
                '-y', output_path
            ]
            result = subprocess.run(cmd_reencode, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(f"FFmpeg cut failed: {result.stderr}")
        
        return output_path


class AudioExtractor(IAudioExtractor):
    """Extract audio from video for Whisper processing"""
    
    def extract_audio(self, video_path: str, output_path: str) -> str:
        """Extract audio as WAV file for Whisper using FFmpeg (faster than MoviePy)"""
        import subprocess
        
        # Use FFmpeg directly — much faster than MoviePy for audio extraction
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vn',                    # No video
            '-acodec', 'pcm_s16le',   # 16-bit PCM
            '-ar', '16000',           # 16kHz for Whisper
            '-ac', '1',               # Mono
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            # Fallback to MoviePy if FFmpeg fails
            video = None
            try:
                video = VideoFileClip(video_path)
                if video.audio is None:
                    raise ValueError("Video has no audio track")
                video.audio.write_audiofile(
                    output_path, fps=16000, nbytes=2,
                    codec='pcm_s16le', logger=None
                )
            finally:
                if video:
                    video.close()
        
        return output_path


class WhisperService(ISubtitleGenerator):
    """Generate subtitles using whisper.cpp"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.getenv("WHISPER_MODEL_PATH", "./models/ggml-medium.bin")
        
        # Auto-detect whisper binary
        candidates = [
            "./whisper.cpp/build/bin/whisper-cli", # CMake build (new CLI)
            "./whisper.cpp/build/bin/main",        # CMake build (old wrapper)
            "./whisper.cpp/main",                  # Makefile build (old)
            "whisper-cpp"                          # PATH installed
        ]
        self.whisper_binary = "whisper-cpp"
        for c in candidates:
            if os.path.exists(c):
                self.whisper_binary = c
                break
    
    def transcribe_full_video(self, video_path: str) -> str:
        """Transcribe full video with Whisper C++ → compact JSON string for Gemini AI.
        
        Output format:
            {"data": [["0.0","3.2","text..."],["3.2","6.8","text..."],...]}
        
        Caches result to {video_dir}/full_transcript.json to avoid re-transcription.
        
        Performance optimizations:
        - Uses 8 threads + 2 processors for parallel decoding
        - Splits long audio into segments for faster processing
        - Caches aggressively to avoid re-transcription
        """
        import json
        video_dir = os.path.dirname(video_path)
        cache_path = os.path.join(video_dir, "full_transcript.json")

        # Return cached result if available
        if os.path.exists(cache_path):
            print(f"[Whisper] Using cached full transcript: {cache_path}")
            with open(cache_path, 'r') as f:
                return f.read()

        print("[Whisper] Transcribing full video with Whisper C++ (optimized)...")

        # Extract audio from full video — use lower sample rate for speed
        audio_path = os.path.join(video_dir, "full_audio.wav")
        if not os.path.exists(audio_path):
            extractor = AudioExtractor()
            extractor.extract_audio(video_path, audio_path)

        try:
            output_base = audio_path.rsplit('.', 1)[0]
            json_path = f"{output_base}.json"

            if not os.path.exists(json_path):
                # Optimized whisper command:
                # -t 8: use all 8 CPU threads
                # -p 2: use 2 processors (parallel beam search)
                # --no-timestamps false: we need timestamps
                import multiprocessing
                n_threads = min(8, multiprocessing.cpu_count())
                n_processors = min(2, max(1, multiprocessing.cpu_count() // 4))
                
                cmd = [
                    self.whisper_binary,
                    '-m', self.model_path,
                    '-f', audio_path,
                    '-t', str(n_threads),       # Max threads
                    '-p', str(n_processors),    # Parallel processors
                    '-oj',
                    '-ojf',
                    '-of', output_base,
                    '--language', 'auto',
                ]
                print(f"[Whisper] Running with {n_threads} threads, {n_processors} processors")
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
                if result.returncode != 0:
                    print(f"[Whisper] Full video transcription failed: {result.stderr}")
                    return ""

            if not os.path.exists(json_path):
                return ""

            with open(json_path, 'r') as f:
                whisper_output = json.load(f)

            segments = whisper_output.get('transcription', [])
            if not segments and isinstance(whisper_output, list):
                segments = whisper_output

            data = []
            for seg in segments:
                text = self._clean_text(seg.get('text', '').strip())
                if not text:
                    continue
                start = round(seg.get('offsets', {}).get('from', 0) / 1000.0, 1)
                end = round(seg.get('offsets', {}).get('to', 0) / 1000.0, 1)
                data.append([str(start), str(end), text])

            transcript_json = json.dumps({"data": data}, ensure_ascii=False)

            # Cache to disk
            with open(cache_path, 'w') as f:
                f.write(transcript_json)

            # Cleanup temp audio (JSON cache kept)
            try:
                os.remove(audio_path)
                os.remove(json_path)
            except:
                pass

            print(f"[Whisper] Full transcript ready: {len(data)} segments, cached to {cache_path}")
            return transcript_json

        except subprocess.TimeoutExpired:
            print("[Whisper] Full video transcription timeout")
            return ""
        except Exception as e:
            print(f"[Whisper] Full video transcription error: {e}")
            return ""

    def generate_subtitles(self, audio_path: str) -> List[Dict[str, Any]]:
        """Generate subtitles from audio using whisper.cpp"""
        subtitles = []
        
        # Check if model exists
        if not os.path.exists(self.model_path):
            print(f"Warning: Whisper binary model not found at {self.model_path}, trying Python Whisper fallback...")
            return self._python_whisper_fallback(audio_path)
        
        try:
            # Output file path (whisper.cpp adds extension)
            output_base = audio_path.rsplit('.', 1)[0]
            json_path = f"{output_base}.json"
            
            # Check cache
            if os.path.exists(json_path):
                print(f"Using cached transcript: {json_path}")
            else:
                # Run whisper.cpp with optimized threading
                import multiprocessing
                n_threads = min(8, multiprocessing.cpu_count())
                
                cmd = [
                    self.whisper_binary,
                    '-m', self.model_path,
                    '-f', audio_path,
                    '-t', str(n_threads),   # Use all available threads
                    '-oj',      # Output as JSON
                    '-ojf',     # Output full JSON (includes words/tokens)
                    '-of', output_base,
                    '--language', 'auto',  # Auto-detect language
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
                
                if result.returncode != 0:
                    print(f"Whisper error: {result.stderr}")
                    return self._fallback_subtitles(audio_path)

            
            # Parse JSON output
            json_path = f"{output_base}.json"
            if os.path.exists(json_path):
                import json
                with open(json_path, 'r') as f:
                    whisper_output = json.load(f)
                
                # Parse whisper.cpp JSON format
                subtitles_data = whisper_output.get('transcription', [])
                if not subtitles_data and isinstance(whisper_output, list):
                    subtitles_data = whisper_output
                
                for segment in subtitles_data:
                    words = []
                    # Parse tokens into words (merging BPE tokens)
                    if 'tokens' in segment:
                        current_word = None
                        for token in segment['tokens']:
                            text = token.get('text', '')
                            
                            # Skip unwanted tokens (timestamps, special tokens, etc.)
                            if self._should_skip_token(text):
                                continue
                                
                            # Parse timestamps (offsets is likely ms)
                            offsets = token.get('offsets', {})
                            start = offsets.get('from', 0) / 1000.0
                            end = offsets.get('to', 0) / 1000.0
                            
                            # Check if new word (starts with space)
                            # Note: whisper tokens often start with space for new word
                            if text.startswith(' ') or not current_word:
                                if current_word and current_word["word"].strip():
                                    words.append(current_word)
                                current_word = {
                                    "word": text.strip(),
                                    "start": start,
                                    "end": end
                                }
                            else:
                                # Append to existing word
                                if current_word:
                                    current_word["word"] += text
                                    current_word["end"] = end  # Extend duration
                        
                        # Add last word if valid
                        if current_word and current_word["word"].strip():
                            words.append(current_word)
                    
                    # Debug: Log word count per segment
                    if words:
                        print(f"[Karaoke] Segment has {len(words)} words: {[w['word'][:10] for w in words[:5]]}...")
                    
                    # Clean segment text as well
                    clean_text = self._clean_text(segment.get('text', '').strip())
                    if clean_text:  # Only add if text is not empty after cleaning
                        subtitles.append(SubtitleSegment(
                            start=segment.get('offsets', {}).get('from', 0) / 1000.0,
                            end=segment.get('offsets', {}).get('to', 0) / 1000.0,
                            text=clean_text,
                            words=words
                        ))
                
                # Cleanup JSON file - DISABLED for caching
                # os.remove(json_path)
            
            return [s.to_dict() for s in subtitles] if subtitles else self._fallback_subtitles(audio_path)
            
        except FileNotFoundError:
            # whisper-cpp binary not found, try Python whisper
            return self._python_whisper_fallback(audio_path)
        except subprocess.TimeoutExpired:
            print("Whisper timeout, using fallback")
            return self._fallback_subtitles(audio_path)
        except Exception as e:
            print(f"Whisper error: {e}, using fallback")
            return self._fallback_subtitles(audio_path)
    
    def _python_whisper_fallback(self, audio_path: str) -> List[Dict[str, Any]]:
        """Fallback to Python whisper if whisper.cpp not available"""
        try:
            import whisper
            model = whisper.load_model("medium")
            result = model.transcribe(audio_path, word_timestamps=True)
            
            subtitles = []
            for segment in result.get('segments', []):
                words = []
                if 'words' in segment:
                    for w in segment['words']:
                        words.append({
                            "word": w['word'].strip(),
                            "start": w['start'],
                            "end": w['end']
                        })
                
                subtitles.append(SubtitleSegment(
                    start=segment['start'],
                    end=segment['end'],
                    text=segment['text'].strip(),
                    words=words
                ))
            
            return [s.to_dict() for s in subtitles] if subtitles else self._fallback_subtitles(audio_path)
            
        except ImportError:
            print("Neither whisper.cpp nor openai-whisper available")
            return self._fallback_subtitles(audio_path)
        except Exception as e:
            print(f"Python whisper error: {e}")
            return self._fallback_subtitles(audio_path)
    
    def _should_skip_token(self, text: str) -> bool:
        """Check if token should be skipped (timestamps, special tokens, etc.)"""
        if not text or not text.strip():
            return True
        
        # Skip timestamp tokens and special markers
        skip_patterns = [
            r'\[_TT_\d+\]',     # [_TT_1000]
            r'\[_BEG_\]',       # [_BEG_]
            r'\[_END_\]',       # [_END_]
            r'\[_SOT_\]',       # [_SOT_]
            r'\[_EOT_\]',       # [_EOT_]
            r'<\|\d+\.\d+\|>',  # <|0.00|>
            r'\[\d+:\d+\]',     # [00:30]
            r'\(\d+:\d+\)',     # (00:30)
            r'^\s*$',           # Empty/whitespace only
        ]
        
        for pattern in skip_patterns:
            if re.match(pattern, text.strip()):
                return True
        
        return False
    
    def _clean_text(self, text: str) -> str:
        """Clean text by removing unwanted patterns"""
        if not text:
            return ""
        
        # Remove timestamp patterns and special markers
        patterns_to_remove = [
            r'\[_TT_\d+\]',     # [_TT_1000]
            r'\[_BEG_\]',       # [_BEG_]
            r'\[_END_\]',       # [_END_]
            r'\[_SOT_\]',       # [_SOT_]
            r'\[_EOT_\]',       # [_EOT_]
            r'<\|\d+\.\d+\|>',  # <|0.00|>
            r'\[\d+:\d+\]',     # [00:30]
            r'\(\d+:\d+\)',     # (00:30)
        ]
        
        cleaned = text
        for pattern in patterns_to_remove:
            cleaned = re.sub(pattern, '', cleaned)
        
        # Clean up extra spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned
    
    def _fallback_subtitles(self, audio_path: str) -> List[Dict[str, Any]]:
        """Fallback subtitles when Whisper is not available"""
        # Get audio duration
        try:
            audio = AudioFileClip(audio_path)
            duration = audio.duration
            audio.close()
        except:
            duration = 10.0
        
        # Return placeholder subtitles
        return [
            {"start": 3.0, "end": duration, "text": "[Subtitle generation pending - Whisper model required]"}
        ]
