"""Application configuration — environment-based (local M1 vs production server)."""
import os

from pydantic_settings import BaseSettings

PIPELINE_ENV = os.getenv("PIPELINE_ENV", "local")


class Settings(BaseSettings):
    # Environment
    PIPELINE_ENV: str = "local"

    # Database
    DATABASE_URL: str = "mysql+aiomysql://customer_user:sayapsuci!%40%23@100.64.5.96:3306/autoclip_v1"

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"

    # === Job Concurrency ===
    MAX_CONCURRENT_JOBS: int = 1 if PIPELINE_ENV == "local" else 8
    MAX_WHISPER_PARALLEL: int = 1 if PIPELINE_ENV == "local" else 4
    MAX_RENDER_WORKERS: int = 2 if PIPELINE_ENV == "local" else 6

    # === Limits ===
    MAX_VIDEO_DURATION: int = 300 if PIPELINE_ENV == "local" else 3600  # 5 min local, 60 min prod
    DOWNLOAD_TIMEOUT: int = 300 if PIPELINE_ENV == "local" else 600
    MIN_CLIP_DURATION: float = 5.0

    # === Paths ===
    OUTPUT_DIR: str = "tmp/output"
    DOWNLOAD_DIR: str = "tmp/downloads"
    WAV_DIR: str = "/tmp/pipeline/wav" if PIPELINE_ENV == "local" else "/dev/shm/pipeline_wav"

    # === Whisper (local whisper.cpp) ===
    WHISPER_MODEL_PATH: str = ""
    WHISPER_BINARY_PATH: str = ""
    WHISPER_THREADS: int = 4 if PIPELINE_ENV == "local" else 6
    WHISPER_USE_GPU: bool = False if PIPELINE_ENV == "local" else True

    # === Download ===
    USE_ARIA2C: bool = False if PIPELINE_ENV == "local" else True

    # Cleanup
    CLEANUP_MAX_AGE_DAYS: int = 7

    @property
    def is_local(self) -> bool:
        return self.PIPELINE_ENV == "local"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
