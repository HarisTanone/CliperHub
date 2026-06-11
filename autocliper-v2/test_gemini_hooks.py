"""Test: Gemini API analysis for YouTube video hooks"""
import json
import re
from google import genai
from youtube_transcript_api import YouTubeTranscriptApi
from googleapiclient.discovery import build

# Config
API_KEY = 'AIzaSyAxdTWVR8jKyKN7xN_zl1JxfZzXpmNy0PU'
YT_API_KEY = 'AIzaSyC13YCs51_MALX_xGdKjZEKIq0PK-8O56g'
VIDEO_ID = 'x7OTyfWxJkk'

client = genai.Client(api_key=API_KEY)

# ═══════════════════════════════════════════════════════════
# 1. GET VIDEO METADATA
# ═══════════════════════════════════════════════════════════
print('=' * 70)
print('VIDEO METADATA')
print('=' * 70)

youtube = build('youtube', 'v3', developerKey=YT_API_KEY)
response = youtube.videos().list(part='snippet,contentDetails,statistics', id=VIDEO_ID).execute()
video = response['items'][0]
snippet = video['snippet']
stats = video.get('statistics', {})

# Parse duration
dur_str = video['contentDetails']['duration']
match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', dur_str)
hours = int(match.group(1) or 0)
minutes = int(match.group(2) or 0)
seconds = int(match.group(3) or 0)
total_seconds = hours * 3600 + minutes * 60 + seconds

print(f"Title:     {snippet['title']}")
print(f"Channel:   {snippet['channelTitle']}")
print(f"Duration:  {total_seconds}s ({hours}h {minutes}m {seconds}s)")
print(f"Views:     {int(stats.get('viewCount', 0)):,}")
print(f"Likes:     {int(stats.get('likeCount', 0)):,}")
print(f"Published: {snippet['publishedAt']}")

# ═══════════════════════════════════════════════════════════
# 2. GET CAPTIONS
# ═══════════════════════════════════════════════════════════
print()
print('=' * 70)
print('CAPTIONS (first 30 segments)')
print('=' * 70)

api = YouTubeTranscriptApi()
transcript = api.fetch(VIDEO_ID, languages=['id', 'en'])
entries = list(transcript)
print(f"Total segments: {len(entries)}")
print(f"Estimated duration from captions: {entries[-1].start:.0f}s")
print()
for entry in entries[:30]:
    mins = int(entry.start // 60)
    secs = int(entry.start % 60)
    print(f"  [{mins:02d}:{secs:02d}] {entry.text}")
print(f"  ... ({len(entries) - 30} more segments)")

# ═══════════════════════════════════════════════════════════
# 3. GEMINI ANALYSIS - TOP 10 HOOKS
# ═══════════════════════════════════════════════════════════ 
print()
print('=' * 70)
print('GEMINI ANALYSIS - TOP 10 HOOKS')
print('=' * 70)

# Build full transcript
transcript_text = '\n'.join([f"[{e.start:.1f}s] {e.text}" for e in entries])

prompt = """Kamu adalah AI analis video viral. Analisis transcript video podcast ini dan temukan 10 momen TERBAIK yang berpotensi viral sebagai short video.

VIDEO METADATA:
- Title: """ + snippet['title'] + """
- Channel: """ + snippet['channelTitle'] + """
- Duration: """ + str(total_seconds) + """ seconds
- Views: """ + str(int(stats.get('viewCount', 0))) + """

TRANSCRIPT:
""" + transcript_text + """

TUGAS:
1. Temukan 10 momen PALING VIRAL dari transcript ini
2. Setiap clip harus 45-90 detik
3. Beri MULTI-SCORE untuk setiap kandidat

KRITERIA SCORING (0.0 - 1.0):
- viral_score: Seberapa besar potensi viral
- curiosity_score: Seberapa bikin penasaran
- emotion_score: Seberapa kuat emosi
- controversy_score: Seberapa kontroversial
- story_score: Seberapa kuat narasi

ATURAN HOOK:
- 3-8 kata saja (max 50 karakter)
- BRUTAL SINGKAT, bikin berhenti scroll
- OPEN LOOP - jangan kasih jawaban
- Bahasa Indonesia

FORMAT RESPONSE (JSON ONLY):
{
  "status": 200,
  "data": [
    {
      "index": 1,
      "start_time": 125.0,
      "end_time": 180.0,
      "hook": "Hook brutal singkat",
      "keywords": ["KATA1", "KATA2"],
      "viral_score": 0.91,
      "curiosity_score": 0.85,
      "emotion_score": 0.72,
      "controversy_score": 0.65,
      "story_score": 0.88,
      "reason": "Alasan singkat"
    }
  ]
}

PENTING:
- Urut dari score tertinggi
- CLIP TIDAK BOLEH OVERLAP
- Durasi minimal 45 detik
- HANYA RETURN JSON"""

print("\nSending to Gemini 3.5 Flash...")
response = client.models.generate_content(
    model='gemini-3.5-flash',
    contents=prompt
)

# Parse response
json_match = re.search(r'\{[\s\S]*"data"[\s\S]*\}', response.text)
if json_match:
    result = json.loads(json_match.group())
    clips = result.get('data', [])
    
    print(f"\nFound {len(clips)} clips!\n")
    
    for clip in clips:
        # Calculate final score
        final = (clip.get('viral_score', 0) * 0.35 + 
                 clip.get('curiosity_score', 0) * 0.25 + 
                 clip.get('story_score', 0) * 0.20 + 
                 clip.get('emotion_score', 0) * 0.10 + 
                 clip.get('controversy_score', 0) * 0.10)
        
        start_min = int(clip['start_time'] // 60)
        start_sec = int(clip['start_time'] % 60)
        end_min = int(clip['end_time'] // 60)
        end_sec = int(clip['end_time'] % 60)
        duration = clip['end_time'] - clip['start_time']
        
        print(f"  #{clip['index']} -----------------------------------------------")
        print(f"  Hook: \"{clip['hook']}\"")
        print(f"  Time: {start_min:02d}:{start_sec:02d} -> {end_min:02d}:{end_sec:02d} ({duration:.0f}s)")
        print(f"  Final: {final:.2f} | Viral: {clip.get('viral_score',0):.2f} | Curiosity: {clip.get('curiosity_score',0):.2f}")
        print(f"  Emotion: {clip.get('emotion_score',0):.2f} | Controversy: {clip.get('controversy_score',0):.2f} | Story: {clip.get('story_score',0):.2f}")
        print(f"  Keywords: {clip.get('keywords', [])}")
        print(f"  Reason: {clip.get('reason', '')}")
        print()
else:
    print("Failed to parse Gemini response")
    print(response.text[:2000])

print('=' * 70)
print('DONE')
print('=' * 70)
