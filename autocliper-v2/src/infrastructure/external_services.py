"""
External Services - Gemini AI and YouTube Download
"""
from google import genai
import yt_dlp
import os
import re
import json
import time
from typing import List, Dict, Any
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from ..domain.entities import ClipData, VideoInfo


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
1. Identifikasi 3-5 momen PALING MENARIK dan PALING ENGAGING dalam video
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
- score antara 0.0-1.0 berdasarkan potensi viral (hanya pilih yang score > 0.85)
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
    
    def __init__(self, output_dir: str = "./tmp/output"):
        self.output_dir = output_dir
        # Ensure /opt/homebrew/bin is in PATH for Node.js (required by EJS solver)
        homebrew_bin = '/opt/homebrew/bin'
        if homebrew_bin not in os.environ.get('PATH', ''):
            os.environ['PATH'] = f"{homebrew_bin}:{os.environ.get('PATH', '')}"
    
    def _sanitize_title(self, title: str) -> str:
        """Sanitize title for filesystem"""
        # Remove invalid characters
        sanitized = re.sub(r'[<>:"/\\|?*\n\r\t]', '', title)
        # Replace multiple spaces/underscores
        sanitized = re.sub(r'[\s_]+', '_', sanitized)
        # Limit length
        return sanitized[:80].strip('_')
    
    def download(self, url: str, output_dir: str = None) -> VideoInfo:
        """
        Download video from YouTube
        
        Args:
            url: YouTube video URL
            output_dir: Optional override for output directory
            
        Returns:
            VideoInfo with title, duration, filepath
        """
        target_dir = output_dir or self.output_dir
        os.makedirs(target_dir, exist_ok=True)
        
        # Base yt-dlp options (NO FORMAT for cookie test)
        test_opts = {
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {'youtube': {
                'player_client': ['tv', 'web', 'web_safari'],
            }},
            'remote_components': ['ejs:github'],
        }
        
        # Cookie strategy - test without format first
        cookies_opt = {}
        info = None
        
        # Try cookies.txt file first (works on servers without browser)
        # __file__ is src/infrastructure/external_services.py, go up 3 levels to project root
        _project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cookies_file = os.path.join(_project_root, 'cookies.txt')
        # Fallback: also check current working directory
        if not os.path.exists(cookies_file):
            cookies_file = os.path.join(os.getcwd(), 'cookies.txt')
        if os.path.exists(cookies_file):
            try:
                opts = {**test_opts, 'cookiefile': cookies_file}
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    print(f"[Download] ✅ Using cookies.txt file")
                    cookies_opt = {'cookiefile': cookies_file}
            except Exception as e:
                error_msg = str(e)
                if 'bot' in error_msg.lower() or 'sign in' in error_msg.lower():
                    print(f"[Cookies] ⚠️ cookies.txt: Bot detection")
        
        # Fallback: try browser cookies
        if info is None:
            for browser in ['chrome', 'safari', 'firefox']:
                try:
                    opts = {**test_opts, 'cookiesfrombrowser': (browser,)}
                    with yt_dlp.YoutubeDL(opts) as ydl:
                        info = ydl.extract_info(url, download=False)
                        print(f"[Download] ✅ Using {browser} cookies")
                        cookies_opt = {'cookiesfrombrowser': (browser,)}
                        break
                except Exception as e:
                    error_msg = str(e)
                    if 'bot' in error_msg.lower() or 'sign in' in error_msg.lower():
                        print(f"[Cookies] ⚠️ {browser}: Bot detection")
                    continue
        
        if info is None:
            raise Exception("YouTube bot detection. Upload cookies.txt atau login ke YouTube di Chrome.")
        
        title = info.get('title', 'Unknown')
        sanitized_title = self._sanitize_title(title)
        video_id = info.get('id', '')
            
        # Create output directory based on sanitized title
        video_output_dir = os.path.join(target_dir, sanitized_title)
        os.makedirs(video_output_dir, exist_ok=True)
        
        # Download video
        output_template = os.path.join(video_output_dir, 'original.%(ext)s')
        
        # Format fallback chain: try progressively simpler formats
        format_attempts = [
            'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]',
            'bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio',
            'best[ext=mp4]/best',
        ]

        info_dl = None
        last_error = None
        for fmt in format_attempts:
            ydl_opts = {
                'format': fmt,
                'quiet': True,
                'no_warnings': True,
                'extractor_args': {'youtube': {
                    'player_client': ['tv', 'web', 'web_safari'],
                }},
                'remote_components': ['ejs:github'],
                **cookies_opt,
                'outtmpl': output_template,
                'merge_output_format': 'mp4',
                'postprocessors': [{'key': 'FFmpegVideoConvertor', 'preferedformat': 'mp4'}],
            }
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info_dl = ydl.extract_info(url, download=True)

                # Verify file is not empty
                candidate = os.path.join(video_output_dir, 'original.mp4')
                if not os.path.exists(candidate):
                    for f in os.listdir(video_output_dir):
                        if f.startswith('original.'):
                            candidate = os.path.join(video_output_dir, f)
                            break
                if os.path.exists(candidate) and os.path.getsize(candidate) > 0:
                    dl_height = info_dl.get('height', 0)
                    dl_width = info_dl.get('width', 0)
                    print(f"[Download] ✅ Downloaded ({fmt}): {dl_width}x{dl_height}")
                    break
                else:
                    print(f"[Download] ⚠️ Empty file with format '{fmt}', trying next...")
                    # Remove empty file before next attempt
                    if os.path.exists(candidate):
                        os.remove(candidate)
                    info_dl = None
            except Exception as e:
                last_error = e
                print(f"[Download] ⚠️ Format '{fmt}' failed: {e}, trying next...")
                continue

        if info_dl is None:
            raise Exception(f"All download formats failed. Last error: {last_error}")

        # Find the downloaded file
        final_path = os.path.join(video_output_dir, 'original.mp4')
        if not os.path.exists(final_path):
            for f in os.listdir(video_output_dir):
                if f.startswith('original.'):
                    final_path = os.path.join(video_output_dir, f)
                    break
        
        return VideoInfo(
            title=title,
            duration=info.get('duration', 0),
            filepath=final_path,
            video_id=video_id,
            sanitized_title=sanitized_title
        )
    
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