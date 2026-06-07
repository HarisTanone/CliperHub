"""
External Services - Gemini AI and YouTube Download
"""
from google import genai
import yt_dlp
import os
import re
import json
import time
import shutil
from typing import List, Dict, Any
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from ..domain.entities import ClipData, VideoInfo


class DownloadQualityError(Exception):
    """Raised when video cannot be downloaded in minimum 1080p quality."""
    pass


class GeminiService:
    """AI service for video analysis using Gemini 2.5-flash"""
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        youtube_api_key = os.getenv("YOUTUBE_API_KEY")
        if not youtube_api_key:
            raise ValueError("YOUTUBE_API_KEY environment variable is required")
        
        self.client = genai.Client(api_key=api_key)
        self.youtube = build('youtube', 'v3', developerKey=youtube_api_key)
        self.model_name = 'gemini-2.5-flash'
    
    def analyze_video(self, video_path: str = None, youtube_url: str = None) -> List[ClipData]:
        """
        Analyze video to find best clip segments for short video content
        
        Args:
            video_path: Path to local video file (optional, not used)
            youtube_url: YouTube URL for direct analysis (preferred)
            
        Returns:
            List of ClipData with best moments
        """
        prompt = self._build_analysis_prompt()
        
        try:
            if video_path and os.path.exists(video_path):
                # Upload video file for better analysis (preferred)
                return self._analyze_with_file(video_path, prompt)
            elif youtube_url:
                # Fallback to URL-based analysis (less accurate)
                print(f"Warning: Analyzing YouTube URL directly: {youtube_url}")
                return self._analyze_with_url(youtube_url, prompt)
            else:
                raise ValueError("Either video_path or youtube_url is required")
                
        except Exception as e:
            print(f"Gemini error: {e}, using fallback analysis")
            return self._fallback_analysis()
    
    def _build_analysis_prompt(self) -> str:
        """Build the analysis prompt for Gemini — includes keyword extraction"""
        return """Analisis video ini untuk mencari potongan clip terbaik yang bisa dijadikan short video viral.

TUGAS:
1. Identifikasi 8-10 momen PALING MENARIK dan PALING ENGAGING dalam video
2. Setiap clip harus memiliki durasi 30-60 detik (PENDEK dan PADAT)
3. Ambil HANYA bagian DAGING / INTI pembahasan. BUANG SEMUA:
   - Basa-basi, intro, outro, sapaan, dan filler
   - Momen diam, "ehm", "eee", atau jeda panjang
   - Transisi antar topik yang tidak substansial
   - Bagian yang mengulang poin yang sama
4. Pilih HANYA momen yang BENAR-BENAR MENARIK dengan kriteria:
   - Kalimat pembuka yang sangat menarik dan bikin penasaran (hook kuat)
   - Pernyataan kontroversial, mengejutkan, atau shocking
   - Informasi yang sangat valuable, insightful, atau mind-blowing
   - Momen emosional yang kuat atau sangat lucu
   - Tips atau tutorial yang actionable dan langsung bisa dipraktekkan
   - Cerita atau pengalaman yang relatable dan engaging
5. Jika ada segment panjang yang bagus, PECAH menjadi beberapa clip pendek (30-60 detik)
6. CLIP TIDAK BOLEH OVERLAP — setiap clip harus punya timestamp yang TIDAK tumpang tindih

FORMAT RESPONSE (JSON VALID):
```json
{
"status": 200,
"language": "id",
"data": [
    {
        "index": 1,
        "start_time": 0.0,
        "end_time": 45.0,
        "hook": "Hook BRUTAL SINGKAT 3-8 kata (max 50 karakter). Lihat ATURAN HOOK di bawah.",
        "keywords": ["KATA1", "KATA2", "KATA3"],
        "score": 0.92,
        "reason": "Alasan singkat mengapa clip ini bagus untuk viral"
    }
]
}
```

FIELD "language": Deteksi bahasa utama video ("id" untuk Indonesia, "en" untuk English, dll).
FIELD "keywords": Untuk SETIAP clip, pilih 2-4 kata PALING POWERFUL dari hook-nya yang layak di-highlight.
  Fokus pada kata yang: emosional, urgency, value, atau curiosity.
  Contoh: hook "Kenapa anak jadi GTM?" → keywords: ["GTM"]
  Contoh: hook "Rahasia diet tanpa lapar" → keywords: ["RAHASIA", "DIET"]

ATURAN HOOK (WAJIB DIIKUTI):
Hook bukan tempat jelasin — hook itu NARIK LEHER orang biar berhenti scroll.
- HARUS 3-8 kata saja (max 50 karakter). BRUTAL SINGKAT.
- SATU IDE saja. Jangan campur emosi + edukasi + cerita.
- HARUS bikin penasaran / ke-trigger. Pilih salah satu:
  • Shock: "Dipaksa makan bisa bikin trauma"
  • Question: "Kenapa anak jadi GTM?"
  • Warning: "Jangan paksa anak makan"
  • Fakta: "80% otak terbentuk di usia ini"
- HARUS relatable (orang mikir "ini gue banget")
- OPEN LOOP — jangan kasih jawaban di hook
  ❌ "Ini penyebab anak GTM karena pola makan salah"
  ✅ "Kenapa anak jadi GTM?"
- Tulis hook dalam BAHASA YANG SAMA dengan video (jika video bahasa Indonesia, hook bahasa Indonesia)

PENTING SEKALI — ATURAN PEMOTONGAN:
- start_time dan end_time dalam DETIK (float)
- Durasi clip HARUS 30-60 detik (TIDAK BOLEH lebih dari 60 detik!)
- CLIP TIDAK BOLEH OVERLAP — pastikan end_time clip N < start_time clip N+1
- score antara 0.0-1.0 berdasarkan potensi viral (hanya pilih yang score > 0.75)
- Urut berdasarkan score tertinggi
- HANYA RETURN JSON, tanpa text tambahan
- Gunakan timestamp dari captions untuk akurasi timing
- Lebih baik sedikit tapi berkualitas tinggi daripada banyak tapi biasa saja
- PRIORITASKAN konten yang PADAT dan BERISI, bukan yang panjang

ATURAN PALING PENTING — JANGAN POTONG DI TENGAH KALIMAT ATAU TOPIK:
- start_time HARUS dimulai tepat sebelum kalimat pertama yang kuat dimulai
  (beri ruang 1-2 detik sebelum kalimat inti dimulai jika memungkinkan)
- end_time HARUS selesai SETELAH kalimat terakhir yang penting TUNTAS diucapkan
  (beri ruang 1-2 detik setelah kalimat terakhir selesai)
- JANGAN potong di tengah kalimat, di tengah argumen, atau saat pembicara
  sedang menyampaikan poin penting
- Pastikan inti / daging dari pembahasan terpotong UTUH — jika sebuah
  pernyataan penting membutuhkan 5 kalimat untuk lengkap, ambil semua 5 kalimat
- Lebih baik durasi sedikit lebih panjang daripada memotong topik inti

Analisis konten ini sekarang:"""
    
    def _analyze_with_file(self, video_path: str, prompt: str) -> List[ClipData]:
        """Analyze video using file upload"""
        print(f"Uploading video for analysis: {video_path}")
        
        # Upload the video file
        video_file = self.client.files.upload(path=video_path)
        
        # Wait for file to be processed
        while video_file.state == "PROCESSING":
            print("Video processing...")
            time.sleep(5)
            video_file = self.client.files.get(name=video_file.name)
        
        if video_file.state == "FAILED":
            raise ValueError(f"Video processing failed: {video_file.state}")
        
        # Generate content with video
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[video_file, prompt]
        )
        
        # Clean up uploaded file
        try:
            self.client.files.delete(name=video_file.name)
        except:
            pass
        
        return self._parse_response(response.text)
    
    def analyze_youtube_content(self, youtube_url: str, video_info: VideoInfo, whisper_transcript: str = "") -> List[ClipData]:
        """Analyze YouTube video using Whisper transcript + YouTube metadata.
        
        Args:
            youtube_url: YouTube video URL
            video_info: VideoInfo from downloader
            whisper_transcript: JSON string from WhisperService.transcribe_full_video()
                                Format: {"data": [["start","end","text"],...] }
                                Falls back to YouTube captions if empty.
        """
        try:
            # Extract video ID from URL
            video_id = self._extract_video_id(youtube_url)
            if not video_id:
                raise ValueError("Could not extract video ID from URL")

            # Always get metadata (title, duration, views — context for AI)
            metadata = self._get_youtube_metadata(video_id)

            # Decide transcript source
            if whisper_transcript:
                transcript = whisper_transcript
                transcript_label = "WHISPER TRANSCRIPT (accurate, word-level timing)"
                print("🎤 Using Whisper C++ transcript for AI analysis")
            else:
                transcript = self._get_youtube_captions(video_id)
                transcript_label = "YOUTUBE CAPTIONS"
                print("⚠️  Whisper transcript unavailable, falling back to YouTube captions")

            # Build analysis prompt with metadata + transcript
            prompt = self._build_analysis_prompt()
            content = f"""VIDEO METADATA:
- Title: {metadata.get('title', video_info.title)}
- Duration: {metadata.get('duration', video_info.duration)} seconds
- Channel: {metadata.get('channel_title', 'Unknown')}
- Views: {metadata.get('view_count', 0):,}
- Description: {metadata.get('description', '')[:200]}...

{transcript_label}:
{transcript}"""
            
            full_prompt = f"{prompt}\n\n{content}"
            
            print("🚀 Analyzing with Whisper transcript + YouTube Data API v3 (metadata)")
            
            # Retry logic for quota limits
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = self.client.models.generate_content(
                        model=self.model_name,
                        contents=full_prompt
                    )
                    print("✅ Gemini analysis successful!")
                    return self._parse_response(response.text)
                    
                except Exception as e:
                    error_str = str(e)
                    if "429" in error_str and "retry" in error_str.lower():
                        # Extract retry delay from error message
                        import re
                        delay_match = re.search(r'retry in ([0-9.]+)s', error_str)
                        delay = float(delay_match.group(1)) if delay_match else 5.0
                        
                        if attempt < max_retries - 1:
                            print(f"⏳ Quota exceeded, retrying in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                            time.sleep(delay + 1)  # Add 1 second buffer
                            continue
                    
                    # If not a retry-able error or max retries reached
                    raise e
            
            # This should not be reached, but just in case
            raise Exception("Max retries exceeded")
            
        except Exception as e:
            print(f"❌ YouTube captions analysis failed: {e}")
            return self._fallback_analysis()
    
    def _extract_video_id(self, youtube_url: str) -> str:
        """Extract video ID from YouTube URL"""
        patterns = [
            r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
            r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, youtube_url)
            if match:
                return match.group(1)
        return ""
    
    def _get_youtube_captions(self, video_id: str) -> str:
        """Get captions using youtube-transcript-api (OAuth not required)"""
        try:
            api = YouTubeTranscriptApi()
            
            # Try to get transcript in Indonesian first, then English
            languages = ['id', 'en']
            
            for lang in languages:
                try:
                    transcript_obj = api.fetch(video_id, languages=[lang])
                    transcript_list = list(transcript_obj)  # FetchedTranscript is iterable
                    
                    # Format transcript with timestamps
                    formatted_transcript = []
                    for entry in transcript_list:
                        start_time = entry.start
                        text = entry.text.strip()
                        formatted_transcript.append(f"[{start_time:.1f}s] {text}")
                    
                    result = "\n".join(formatted_transcript)
                    print(f"✅ Got YouTube captions ({lang}): {len(transcript_list)} segments")
                    return result
                    
                except Exception as e:
                    print(f"Failed to get {lang} captions: {e}")
                    continue
            
            raise Exception("No captions available in any language")
            
        except Exception as e:
            print(f"❌ YouTube captions failed: {e}")
            return ""

    
    def _get_youtube_metadata(self, video_id: str) -> Dict[str, Any]:
        """Get video metadata from YouTube Data API v3"""
        try:
            response = self.youtube.videos().list(
                part='snippet,contentDetails,statistics',
                id=video_id
            ).execute()
            
            if not response.get('items'):
                return {}
            
            video = response['items'][0]
            snippet = video['snippet']
            content_details = video['contentDetails']
            statistics = video.get('statistics', {})
            
            # Parse duration (PT4M13S format)
            duration_str = content_details['duration']
            duration_seconds = self._parse_duration(duration_str)
            
            return {
                'title': snippet['title'],
                'description': snippet['description'],
                'duration': duration_seconds,
                'channel_title': snippet['channelTitle'],
                'published_at': snippet['publishedAt'],
                'view_count': int(statistics.get('viewCount', 0)),
                'like_count': int(statistics.get('likeCount', 0)),
                'tags': snippet.get('tags', [])
            }
            
        except Exception as e:
            print(f"❌ YouTube metadata failed: {e}")
            return {}
    
    def _parse_duration(self, duration_str: str) -> int:
        """Parse YouTube duration format (PT4M13S) to seconds"""
        import re
        
        # PT4M13S -> 4*60 + 13 = 253 seconds
        pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
        match = re.match(pattern, duration_str)
        
        if not match:
            return 0
        
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        
        return hours * 3600 + minutes * 60 + seconds
    
    def analyze_transcript(self, transcript: str) -> List[ClipData]:
        """LEGACY: Analyze video transcript (kept for backward compatibility)"""
        prompt = self._build_analysis_prompt()
        full_prompt = f"{prompt}\n\nTRANSCRIPT:\n{transcript}"
        print("📝 Using legacy transcript analysis...")
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=full_prompt
            )
            print("✅ Gemini analysis successful!")
            return self._parse_response(response.text)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "quota" in error_str.lower():
                print(f"❌ Gemini quota exceeded: {e}")
            else:
                print(f"❌ Gemini error: {e}")
            return self._fallback_analysis()

    def _analyze_with_url(self, youtube_url: str, prompt: str) -> List[ClipData]:
        """Analyze video using YouTube URL (less accurate)"""
        full_prompt = f"{prompt}\n\nURL Video: {youtube_url}"
        
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=full_prompt
        )
        return self._parse_response(response.text)
    
    def _parse_response(self, response_text: str) -> List[ClipData]:
        """Parse Gemini response to ClipData list with keywords and overlap validation"""
        try:
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*"data"[\s\S]*\}', response_text)
            if json_match:
                json_str = json_match.group()
                result = json.loads(json_str)
            else:
                # Try parsing entire response as JSON
                result = json.loads(response_text)
            
            clips = []
            for clip_data in result.get("data", []):
                # Extract keywords from AI response
                keywords = clip_data.get("keywords", [])
                if isinstance(keywords, list):
                    keywords = [str(k).upper().strip() for k in keywords if k]
                else:
                    keywords = []
                
                clips.append(ClipData(
                    index=clip_data.get("index", len(clips) + 1),
                    start_time=float(clip_data.get("start_time", 0)),
                    end_time=float(clip_data.get("end_time", 30)),
                    hook=clip_data.get("hook", "").strip()[:50] or "Kamu harus tahu ini!",
                    score=float(clip_data.get("score", 0.5)),
                    reason=clip_data.get("reason", ""),
                    keywords=keywords,
                ))
            
            # Sort by score descending
            clips.sort(key=lambda x: x.score, reverse=True)
            
            # Remove overlapping clips (keep higher score)
            clips = self._remove_overlapping_clips(clips)
            
            return clips if clips else self._fallback_analysis()
            
            return clips if clips else self._fallback_analysis()
            
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Response text: {response_text[:500]}")
            return self._fallback_analysis()
    
    def _fallback_analysis(self) -> List[ClipData]:
        """Fallback analysis when Gemini fails"""
        return [
            ClipData(
                index=1,
                start_time=0.0,
                end_time=90.0,
                hook="Kamu harus tahu ini!",
                score=0.85,
                reason="Fallback clip - Gemini quota exceeded",
                keywords=["HARUS", "TAHU"],
            ),
            ClipData(
                index=2,
                start_time=90.0,
                end_time=180.0,
                hook="Ini penting banget!",
                score=0.82,
                reason="Fallback clip - Gemini quota exceeded",
                keywords=["PENTING"],
            )
        ]
    
    def _remove_overlapping_clips(self, clips: List[ClipData]) -> List[ClipData]:
        """Remove overlapping clips, keeping higher-scored ones.
        
        Clips are already sorted by score descending.
        A clip is removed if it overlaps >50% with any already-accepted clip.
        """
        if not clips:
            return clips
        
        accepted = []
        for clip in clips:
            overlap_found = False
            for existing in accepted:
                # Calculate overlap
                overlap_start = max(clip.start_time, existing.start_time)
                overlap_end = min(clip.end_time, existing.end_time)
                overlap_duration = max(0, overlap_end - overlap_start)
                
                clip_duration = clip.end_time - clip.start_time
                if clip_duration > 0 and overlap_duration / clip_duration > 0.5:
                    overlap_found = True
                    break
            
            if not overlap_found:
                accepted.append(clip)
        
        # Re-index
        for i, clip in enumerate(accepted):
            clip.index = i + 1
        
        return accepted


class YouTubeDownloader:
    """Download videos from YouTube using yt-dlp"""
    
    # Quality thresholds
    MIN_HEIGHT = 1080
    MIN_BITRATE = 2000  # kbps — log warning if below (not hard reject, karena AV1 low bitrate = OK)
    MAX_FILESIZE_MB = 5000  # 5GB — tolak video yang terlalu besar sebelum download
    
    def __init__(self, output_dir: str = "./tmp/output"):
        self.output_dir = output_dir
        self._format_cache = {}  # video_id -> (formats, timestamp)
        self._cache_ttl = 86400  # 24 hours
        # Ensure /opt/homebrew/bin is in PATH for Node.js (required by EJS solver)
        homebrew_bin = '/opt/homebrew/bin'
        if homebrew_bin not in os.environ.get('PATH', ''):
            os.environ['PATH'] = f"{homebrew_bin}:{os.environ.get('PATH', '')}"
    
    def _sanitize_title(self, title: str) -> str:
        """Sanitize title for filesystem"""
        sanitized = re.sub(r'[<>:"/\\|?*\n\r\t]', '', title)
        sanitized = re.sub(r'[\s_]+', '_', sanitized)
        return sanitized[:80].strip('_')
    
    def _score_format(self, fmt: dict) -> tuple:
        """Score a video format for sorting. Higher tuple = better.
        
        Sort priority: height → fps → bitrate
        
        Rationale:
        - height: resolusi utama (1080p vs 1440p vs 4K)
        - fps: 60fps jauh lebih smooth dari 30fps untuk Shorts/Reels
        - bitrate: faktor tambahan — BUKAN utama karena bitrate lintas codec
          tidak setara (AV1 1500kbps ≈ H264 2500kbps secara visual)
        """
        height = fmt.get('height') or 0
        fps = fmt.get('fps') or 30
        tbr = fmt.get('tbr') or fmt.get('vbr') or 0
        
        return (height, fps, tbr)
    
    def _select_best_format(self, formats: list):
        """Dynamically select the best video format.
        
        Strategy:
        1. Filter formats with height >= 1080
        2. Skip HLS/SABR format IDs (91-96) — unreliable, often "downloaded file is empty"
        3. Sort by: height → fps → bitrate (codec agnostic)
        4. Pick the best one
        
        Returns best format dict or None if no qualifying format exists.
        """
        if not formats:
            return None
        
        # HLS format IDs that are known to be unreliable (YouTube SABR streaming)
        UNRELIABLE_FORMAT_IDS = {'91', '92', '93', '94', '95', '96'}
        
        # Filter: video streams with height >= 1080, skip unreliable HLS
        video_formats = []
        skipped_hls = []
        for fmt in formats:
            # Skip audio-only, storyboard, or non-video
            if fmt.get('vcodec') in (None, 'none'):
                continue
            
            height = fmt.get('height') or 0
            if height < self.MIN_HEIGHT:
                continue
            
            # Skip unreliable HLS/SABR formats
            fmt_id = str(fmt.get('format_id', ''))
            if fmt_id in UNRELIABLE_FORMAT_IDS:
                skipped_hls.append(fmt)
                continue
            
            video_formats.append(fmt)
        
        if skipped_hls:
            print(f"[Probe] Skipped {len(skipped_hls)} unreliable HLS format(s): "
                  f"{[f.get('format_id') for f in skipped_hls]}")
        
        if not video_formats:
            # If ONLY HLS formats available >= 1080p, use them as last resort
            if skipped_hls:
                print(f"[Probe] ⚠️ Only HLS formats available >= 1080p, using as fallback")
                video_formats = skipped_hls
            else:
                return None
        
        # Sort by score (descending): height → fps → bitrate
        video_formats.sort(key=self._score_format, reverse=True)
        
        # Log top candidates for debugging
        print(f"[Probe] Found {len(video_formats)} formats >= {self.MIN_HEIGHT}p:")
        for i, fmt in enumerate(video_formats[:5]):
            h = fmt.get('height', '?')
            tbr = fmt.get('tbr') or fmt.get('vbr') or 0
            vcodec = fmt.get('vcodec', '?')
            fps = fmt.get('fps', '?')
            fmt_id = fmt.get('format_id', '?')
            filesize = fmt.get('filesize') or fmt.get('filesize_approx') or 0
            size_mb = filesize / 1024 / 1024 if filesize else 0
            print(f"  [{i+1}] {fmt_id}: {h}p {vcodec} {fps}fps {tbr:.0f}kbps ~{size_mb:.0f}MB")
        
        # Pick best
        best = video_formats[0]
        best_tbr = best.get('tbr') or best.get('vbr') or 0
        
        # Log bitrate warning (informational, not a hard reject)
        if best_tbr > 0 and best_tbr < self.MIN_BITRATE:
            print(f"[Probe] ⚠️ Bitrate {best_tbr:.0f}kbps < {self.MIN_BITRATE}kbps "
                  f"(codec: {best.get('vcodec', '?')} — mungkin masih OK untuk codec modern)")
        
        return best
    
    def _estimate_filesize(self, fmt: dict, duration: float) -> float:
        """Estimate file size in MB from format metadata.
        
        Returns estimated size in MB, or 0 if cannot estimate.
        """
        # Try exact filesize first
        filesize = fmt.get('filesize') or fmt.get('filesize_approx')
        if filesize:
            return filesize / 1024 / 1024
        
        # Estimate from bitrate + duration
        tbr = fmt.get('tbr') or fmt.get('vbr') or 0
        if tbr > 0 and duration > 0:
            # tbr is in kbps, duration in seconds
            # size_bytes = (tbr * 1000 / 8) * duration
            # Add ~15% for audio
            size_bytes = (tbr * 1000 / 8) * duration * 1.15
            return size_bytes / 1024 / 1024
        
        return 0
    
    def _ffprobe_validate(self, video_path: str) -> dict:
        """Validate downloaded video using ffprobe.
        
        Returns dict with: width, height, codec, duration, bitrate
        More accurate than yt-dlp metadata for actual output file.
        """
        import subprocess
        
        try:
            cmd = [
                'ffprobe', '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height,codec_name,r_frame_rate,bit_rate',
                '-show_entries', 'format=duration,size',
                '-of', 'json',
                video_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                print(f"[ffprobe] ⚠️ Failed: {result.stderr[:200]}")
                return {}
            
            data = json.loads(result.stdout)
            stream = data.get('streams', [{}])[0] if data.get('streams') else {}
            fmt = data.get('format', {})
            
            # Parse frame rate (e.g. "30/1" or "60000/1001")
            fps = 0
            r_frame_rate = stream.get('r_frame_rate', '0/1')
            if '/' in r_frame_rate:
                num, den = r_frame_rate.split('/')
                fps = round(int(num) / int(den)) if int(den) > 0 else 0
            
            info = {
                'width': int(stream.get('width', 0)),
                'height': int(stream.get('height', 0)),
                'codec': stream.get('codec_name', ''),
                'fps': fps,
                'duration': float(fmt.get('duration', 0)),
                'size_mb': int(fmt.get('size', 0)) / 1024 / 1024,
                'bitrate': int(stream.get('bit_rate', 0)) / 1000 if stream.get('bit_rate') else 0,
            }
            
            print(f"[ffprobe] ✅ Validated: {info['width']}x{info['height']} "
                  f"{info['codec']} {info['fps']}fps {info['duration']:.1f}s "
                  f"{info['size_mb']:.1f}MB")
            
            return info
            
        except Exception as e:
            print(f"[ffprobe] ⚠️ Error: {e}")
            return {}
    
    def _get_cached_formats(self, video_id: str):
        """Get cached format probe results (TTL: 24h)."""
        if video_id in self._format_cache:
            formats, cached_at = self._format_cache[video_id]
            if time.time() - cached_at < self._cache_ttl:
                print(f"[Probe] Cache HIT for {video_id} ({len(formats)} formats)")
                return formats
            else:
                del self._format_cache[video_id]
        return None
    
    def _cache_formats(self, video_id: str, formats: list):
        """Cache format probe results."""
        self._format_cache[video_id] = (formats, time.time())
        # Evict old entries if cache grows too large
        if len(self._format_cache) > 100:
            oldest_key = min(self._format_cache, key=lambda k: self._format_cache[k][1])
            del self._format_cache[oldest_key]
    
    def download(self, url: str, output_dir: str = None) -> VideoInfo:
        """
        Download video from YouTube with pre-flight quality validation.
        
        Flow:
        1. Probe available formats (no download)
        2. Check if 1080p+ with acceptable bitrate exists
        3. If not → FAIL immediately (2-3 seconds, no bandwidth wasted)
        4. If yes → download using best format ID directly
        
        Args:
            url: YouTube video URL
            output_dir: Optional override for output directory
            
        Returns:
            VideoInfo with title, duration, filepath
            
        Raises:
            DownloadQualityError: If no 1080p+ format available
        """
        target_dir = output_dir or self.output_dir
        os.makedirs(target_dir, exist_ok=True)
        
        # ─── Step 1: Establish cookie/auth strategy ─────────────────────────────
        cookies_opt = {}
        info = None
        
        probe_opts = {
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {'youtube': {
                # IMPORTANT: Use 'tv' + 'android_sdkless' clients only.
                # - 'tv' provides full DASH formats including 1080p (format 137, 248, 399)
                # - 'web' forces SABR streaming on many videos (only HLS/storyboard)
                # - 'android' requires PO Token (403 without it)
                # - 'ios' may have limited formats
                'player_client': ['tv', 'android_sdkless'],
            }},
        }
        
        # Try cookies.txt file first
        _project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cookies_file = os.path.join(_project_root, 'cookies.txt')
        if not os.path.exists(cookies_file):
            cookies_file = os.path.join(os.getcwd(), 'cookies.txt')
        
        if os.path.exists(cookies_file):
            try:
                opts = {**probe_opts, 'cookiefile': cookies_file}
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    print(f"[Download] ✅ Using cookies.txt file")
                    cookies_opt = {'cookiefile': cookies_file}
            except Exception as e:
                if 'bot' in str(e).lower() or 'sign in' in str(e).lower():
                    print(f"[Cookies] ⚠️ cookies.txt: Bot detection")
        
        # Fallback: try browser cookies
        if info is None:
            for browser in ['chrome', 'safari', 'firefox']:
                try:
                    opts = {**probe_opts, 'cookiesfrombrowser': (browser,)}
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        info = ydl.extract_info(url, download=False)
                        print(f"[Download] ✅ Using {browser} cookies")
                        cookies_opt = {'cookiesfrombrowser': (browser,)}
                        break
                except Exception as e:
                    if 'bot' in str(e).lower() or 'sign in' in str(e).lower():
                        print(f"[Cookies] ⚠️ {browser}: Bot detection")
                    continue
        
        if info is None:
            raise Exception("YouTube bot detection. Upload cookies.txt atau login ke YouTube di Chrome.")
        
        title = info.get('title', 'Unknown')
        sanitized_title = self._sanitize_title(title)
        video_id = info.get('id', '')
        duration = info.get('duration', 0)
        
        # ─── Step 2: Pre-flight format probe ────────────────────────────────────
        # Check if 1080p+ exists BEFORE downloading (saves bandwidth + time)
        
        formats = self._get_cached_formats(video_id)
        if formats is None:
            formats = info.get('formats', [])
            if video_id:
                self._cache_formats(video_id, formats)
        
        print(f"[Probe] Analyzing {len(formats)} available formats for: {title}")
        
        # Dynamic format selection — find best format >= 1080p
        best_format = self._select_best_format(formats)
        
        if best_format is None:
            # No 1080p format available — get best available for error message
            all_heights = sorted(set(
                f.get('height', 0) for f in formats 
                if f.get('vcodec') not in (None, 'none') and f.get('height')
            ), reverse=True)
            
            best_available = f"{all_heights[0]}p" if all_heights else "unknown"
            error_msg = (
                f"❌ DOWNLOAD GAGAL: Video tidak tersedia dalam kualitas >= 1080p. "
                f"Kualitas tertinggi: {best_available}. "
                f"Minimum yang diterima: 1080p dengan bitrate >= {self.MIN_BITRATE}kbps. "
                f"URL: {url}"
            )
            print(f"[Probe] {error_msg}")
            raise DownloadQualityError(error_msg)
        
        # We have a qualifying format — log it
        best_height = best_format.get('height', 0)
        best_tbr = best_format.get('tbr') or best_format.get('vbr') or 0
        best_vcodec = best_format.get('vcodec', 'unknown')
        best_format_id = best_format.get('format_id', '')
        best_fps = best_format.get('fps', 30)
        print(f"[Probe] ✅ Best format selected: {best_format_id} "
              f"({best_height}p, {best_vcodec}, {best_fps}fps, {best_tbr:.0f}kbps)")
        
        # ─── Step 2b: Estimate filesize — reject if too large ───────────────────
        estimated_mb = self._estimate_filesize(best_format, duration)
        if estimated_mb > 0:
            print(f"[Probe] Estimated file size: {estimated_mb:.0f}MB (max: {self.MAX_FILESIZE_MB}MB)")
            if estimated_mb > self.MAX_FILESIZE_MB:
                raise DownloadQualityError(
                    f"❌ DOWNLOAD GAGAL: Estimasi ukuran file terlalu besar ({estimated_mb:.0f}MB, "
                    f"max {self.MAX_FILESIZE_MB}MB). Video mungkin terlalu panjang ({duration/60:.0f} menit). "
                    f"URL: {url}"
                )
        
        # ─── Step 3: Download with selected format ──────────────────────────────
        
        video_output_dir = os.path.join(target_dir, sanitized_title)
        os.makedirs(video_output_dir, exist_ok=True)
        output_template = os.path.join(video_output_dir, 'original.%(ext)s')
        
        # Build format string: best_format_id + best audio
        # Use format ID directly for precision, with fallback chain
        format_string = (
            f"{best_format_id}+bestaudio[ext=m4a]/"
            f"{best_format_id}+bestaudio/"
            f"bestvideo[height>={self.MIN_HEIGHT}]+bestaudio/best"
        )
        
        ydl_opts = {
            'format': format_string,
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {'youtube': {
                # Same client strategy as probe — tv + android_sdkless
                'player_client': ['tv', 'android_sdkless'],
            }},
            **cookies_opt,
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'postprocessors': [{'key': 'FFmpegVideoConvertor', 'preferedformat': 'mp4'}],
        }
        
        info_dl = None
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dl = ydl.extract_info(url, download=True)
        except Exception as e:
            last_error = str(e)
            print(f"[Download] ⚠️ Primary format failed: {last_error}, trying fallback...")
            
            # Fallback: try different format strings with all clients
            fallback_formats = [
                f'bestvideo[height>={self.MIN_HEIGHT}]+bestaudio/best',
                'bestvideo+bestaudio/best',
                'best[ext=mp4]/best',
            ]
            for fallback_fmt in fallback_formats:
                try:
                    ydl_opts['format'] = fallback_fmt
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info_dl = ydl.extract_info(url, download=True)
                    break
                except Exception as e2:
                    print(f"[Download] ⚠️ Fallback '{fallback_fmt}' failed: {e2}")
                    continue
        
        if info_dl is None:
            # All download attempts failed — cleanup
            if os.path.exists(video_output_dir):
                shutil.rmtree(video_output_dir, ignore_errors=True)
            raise DownloadQualityError(
                f"❌ DOWNLOAD GAGAL: Format 1080p tersedia tapi download gagal. URL: {url}"
            )
        
        # ─── Step 4: Post-download validation with ffprobe ────────────────────────
        
        final_path = os.path.join(video_output_dir, 'original.mp4')
        if not os.path.exists(final_path):
            for f in os.listdir(video_output_dir):
                if f.startswith('original.'):
                    final_path = os.path.join(video_output_dir, f)
                    break
        
        if not os.path.exists(final_path) or os.path.getsize(final_path) == 0:
            if os.path.exists(video_output_dir):
                shutil.rmtree(video_output_dir, ignore_errors=True)
            raise DownloadQualityError(
                f"❌ DOWNLOAD GAGAL: File kosong setelah download. URL: {url}"
            )
        
        # Validate actual file using ffprobe (more accurate than yt-dlp metadata)
        probe_info = self._ffprobe_validate(final_path)
        
        if probe_info:
            actual_height = probe_info.get('height', 0)
            actual_width = probe_info.get('width', 0)
            actual_codec = probe_info.get('codec', '')
            
            # Final resolution check using ffprobe data
            if actual_height > 0 and actual_height < self.MIN_HEIGHT and actual_width < 1920:
                if os.path.exists(video_output_dir):
                    shutil.rmtree(video_output_dir, ignore_errors=True)
                raise DownloadQualityError(
                    f"❌ DOWNLOAD GAGAL: ffprobe resolusi actual {actual_width}x{actual_height} < 1080p "
                    f"(probe bilang tersedia tapi download dapat kualitas rendah). URL: {url}"
                )
            
            print(f"[Download] ✅ ffprobe validated: {actual_width}x{actual_height} "
                  f"{actual_codec} — OK")
        else:
            # ffprobe failed — fallback to yt-dlp metadata
            dl_height = info_dl.get('height', 0) or 0
            dl_width = info_dl.get('width', 0) or 0
            print(f"[Download] ⚠️ ffprobe unavailable, using yt-dlp metadata: {dl_width}x{dl_height}")
            
            if dl_height > 0 and dl_height < self.MIN_HEIGHT and dl_width < 1920:
                if os.path.exists(video_output_dir):
                    shutil.rmtree(video_output_dir, ignore_errors=True)
                raise DownloadQualityError(
                    f"❌ DOWNLOAD GAGAL: Resolusi actual {dl_width}x{dl_height} < 1080p. URL: {url}"
                )
        
        # ─── Step 5: Ensure H.264 codec compatibility (only for AV1) ────────────
        final_path = self._ensure_h264_codec(final_path, video_output_dir)
        
        return VideoInfo(
            title=title,
            duration=duration,
            filepath=final_path,
            video_id=video_id,
            sanitized_title=sanitized_title
        )
    
    def _ensure_h264_codec(self, video_path: str, output_dir: str) -> str:
        """Check if video is AV1 codec and re-encode to H.264 if needed.
        
        AV1 codec is not well supported by OpenCV/MoviePy, causing decode errors.
        This method detects AV1 and re-encodes to H.264 for compatibility.
        
        Args:
            video_path: Path to the video file
            output_dir: Directory to save the re-encoded video
            
        Returns:
            Path to the video file (original if H.264, or re-encoded if was AV1)
        """
        import subprocess
        
        if not os.path.exists(video_path):
            return video_path
        
        # Check video codec using ffprobe
        try:
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-select_streams', 'v:0', 
                 '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', video_path],
                capture_output=True, text=True, timeout=30
            )
            codec = result.stdout.strip().lower()
            print(f"[Download] Video codec detected: {codec}")
            
            # If codec is H.264 (avc1/h264) or VP9, no need to re-encode
            if codec in ['h264', 'avc1', 'vp9', 'vp8']:
                print(f"[Download] ✅ Codec {codec} is compatible, no re-encoding needed")
                return video_path
            
            # If codec is AV1, re-encode to H.264
            if 'av1' in codec or 'av01' in codec:
                print(f"[Download] ⚠️ AV1 codec detected, re-encoding to H.264 for compatibility...")
                
                h264_path = os.path.join(output_dir, 'original_h264.mp4')
                
                # Re-encode with FFmpeg to H.264
                # Use -c:v libx264 with good quality preset
                cmd = [
                    'ffmpeg', '-y', '-i', video_path,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
                    '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart',
                    h264_path
                ]
                
                print(f"[Download] Running: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)  # 30 min timeout
                
                if result.returncode == 0 and os.path.exists(h264_path) and os.path.getsize(h264_path) > 0:
                    # Remove original AV1 file and rename H.264 to original
                    os.remove(video_path)
                    final_path = os.path.join(output_dir, 'original.mp4')
                    os.rename(h264_path, final_path)
                    print(f"[Download] ✅ Re-encoded to H.264 successfully: {final_path}")
                    return final_path
                else:
                    print(f"[Download] ❌ Re-encoding failed: {result.stderr}")
                    # Keep original file if re-encoding fails
                    if os.path.exists(h264_path):
                        os.remove(h264_path)
                    return video_path
            
            # Unknown codec, try to use as-is
            print(f"[Download] Unknown codec {codec}, using as-is")
            return video_path
            
        except subprocess.TimeoutExpired:
            print(f"[Download] ⚠️ Codec detection timeout, using video as-is")
            return video_path
        except Exception as e:
            print(f"[Download] ⚠️ Error checking codec: {e}, using video as-is")
            return video_path
    
    def get_video_metadata(self, url: str) -> Dict[str, Any]:
        """Get video metadata without downloading"""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'video_id': info.get('id', ''),
                'description': info.get('description', ''),
                'uploader': info.get('uploader', ''),
                'view_count': info.get('view_count', 0)
            }