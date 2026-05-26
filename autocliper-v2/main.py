import os
# Suppress MediaPipe and TensorFlow logs BEFORE importing anything
os.environ['GLOG_minloglevel'] = '3'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['MEDIAPIPE_DISABLE_GPU'] = '1'
os.environ['GLOG_logtostderr'] = '0'
os.environ['GLOG_stderrthreshold'] = '3'

import sys
import warnings
warnings.filterwarnings('ignore')

from dotenv import load_dotenv
load_dotenv()

# Validate required environment variables early
_required_env = ["DATABASE_URL", "JWT_SECRET_KEY", "GEMINI_API_KEY"]
_missing = [v for v in _required_env if not os.getenv(v)]
if _missing:
    print(f"❌ Missing required environment variables: {', '.join(_missing)}")
    print("   Copy .env.example to .env and fill in the values.")
    sys.exit(1)

import uvicorn
from src.presentation.api import app

if __name__ == "__main__":
    import logging
    logging.getLogger('mediapipe').setLevel(logging.CRITICAL)
    logging.getLogger('absl').setLevel(logging.CRITICAL)
    logging.getLogger('tensorflow').setLevel(logging.CRITICAL)
    logging.getLogger('google').setLevel(logging.CRITICAL)

    # Filter out noisy polling endpoints from access log
    class _PollFilter(logging.Filter):
        _SKIP = ("/api/v1/jobs/logs", "/api/v1/jobs/queue")
        def filter(self, record):
            msg = record.getMessage()
            return not any(skip in msg for skip in self._SKIP)

    logging.getLogger("uvicorn.access").addFilter(_PollFilter())

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
        timeout_keep_alive=300,
        h11_max_incomplete_event_size=16 * 1024 * 1024,
        workers=1,
    )
