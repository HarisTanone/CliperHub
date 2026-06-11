"""Test: Gemini limits + subtitle availability"""
from google import genai
from youtube_transcript_api import YouTubeTranscriptApi

client = genai.Client(api_key='AIzaSyAxdTWVR8jKyKN7xN_zl1JxfZzXpmNy0PU')

print('=' * 70)
print('GEMINI MODEL INFO')
print('=' * 70)

try:
    model = client.models.get(model='gemini-2.5-flash')
    print(f"Model: {model.name}")
    print(f"Display Name: {model.display_name}")
    print(f"Input Token Limit: {model.input_token_limit:,}")
    print(f"Output Token Limit: {model.output_token_limit:,}")
except Exception as e:
    print(f"Model info error: {e}")

print()
print('=' * 70)
print('TOKEN USAGE FOR THIS VIDEO')
print('=' * 70)

api = YouTubeTranscriptApi()
transcript = api.fetch('x7OTyfWxJkk', languages=['id', 'en'])
entries = list(transcript)
full_text = ' '.join([e.text for e in entries])

print(f"Full transcript: {len(full_text):,} characters")
print(f"Full transcript: ~{len(full_text.split()):,} words")

try:
    count_result = client.models.count_tokens(
        model='gemini-2.5-flash',
        contents=full_text
    )
    print(f"Actual token count (transcript only): {count_result.total_tokens:,}")
    print(f"With prompt (~2000 tokens): ~{count_result.total_tokens + 2000:,} tokens total")
    print(f"Percentage of 1M context: {(count_result.total_tokens + 2000) / 1048576 * 100:.1f}%")
except Exception as e:
    print(f"Token count error: {e}")

print()
print('=' * 70)
print('GEMINI 2.5 FLASH - RATE LIMITS')
print('=' * 70)
print("""
FREE TIER (API Key tanpa billing):
  - Requests per minute (RPM): 10
  - Requests per day (RPD): 1,500  
  - Tokens per minute (TPM): 250,000
  - Context window: 1,048,576 tokens (1 JUTA!)
  - Max output per response: 65,536 tokens

PAID TIER (Pay-as-you-go, dengan billing aktif):
  - RPM: 2,000
  - RPD: unlimited
  - TPM: 4,000,000
  - Pricing:
    Input  < 200K tokens: $0.15 / 1M tokens
    Input  > 200K tokens: $0.35 / 1M tokens
    Output (non-thinking): $0.60 / 1M tokens
    Output (thinking):     $3.50 / 1M tokens

UNTUK VIDEO INI (59 menit podcast):
  - 1 analysis = ~17,000-22,000 input tokens
  - Free tier bisa: ~10 video per menit, ~1,500 per hari
  - Cost (paid): ~$0.003 per video analysis (~Rp 50)
""")

print('=' * 70)
print('SUBTITLE / CAPTION AVAILABILITY')
print('=' * 70)
print("""
+---------------------------+-------------------+-------------------+
| Feature                   | YouTube Captions  | Whisper C++       |
+---------------------------+-------------------+-------------------+
| Segment timestamps        | YES (start+dur)   | YES               |
| Word-level timestamps     | NO                | YES (per kata)    |
| Karaoke highlighting      | TIDAK BISA        | BISA              |
| Processing time           | INSTANT (API)     | 15-45s per clip   |
| Accuracy (Indonesian)     | ~85%              | ~92% (medium)     |
| Cost                      | FREE              | CPU time          |
| Dependency                | Internet          | Local binary      |
+---------------------------+-------------------+-------------------+

KESIMPULAN:
  - YouTube captions BISA dipakai untuk:
    * AI analysis (mencari momen viral) 
    * Basic subtitle display (tanpa karaoke)
    * Context untuk Gemini prompt
    
  - Whisper C++ TETAP DIBUTUHKAN untuk:
    * Karaoke-style word highlighting
    * Presisi timing per kata
    * Video tanpa YouTube captions
""")
