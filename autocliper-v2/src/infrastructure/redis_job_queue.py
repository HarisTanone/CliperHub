"""
Redis-backed Job Queue — persistent, crash-safe video processing queue.

Falls back to in-memory queue if Redis is unavailable.
One video processes at a time; others wait in line.
"""
import asyncio
import threading
import logging
import json
import os
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime

from ..domain.entities import JobRequest

logger = logging.getLogger(__name__)

REDIS_QUEUE_KEY = "autocliper:job_queue"
REDIS_PROCESSING_KEY = "autocliper:processing"
REDIS_PENDING_KEY = "autocliper:pending"


def _get_redis_client():
    """Get Redis client or None if unavailable."""
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None
    try:
        import redis
        client = redis.from_url(redis_url, decode_responses=True)
        client.ping()
        return client
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}), falling back to in-memory queue")
        return None


@dataclass
class QueuedJob:
    job_request: JobRequest
    queued_at: str = field(default_factory=lambda: datetime.now().isoformat())
    log_id: Optional[int] = None

    def to_json(self) -> str:
        return json.dumps({
            "urls": self.job_request.urls,
            "caption_style": self.job_request.caption_style,
            "user_id": self.job_request.user_id,
            "hook_style_id": self.job_request.hook_style_id,
            "base_only": self.job_request.base_only,
            "queued_at": self.queued_at,
            "log_id": self.log_id,
        })

    @classmethod
    def from_json(cls, data: str) -> "QueuedJob":
        d = json.loads(data)
        job_request = JobRequest(
            urls=d["urls"],
            caption_style=d["caption_style"],
            user_id=d.get("user_id"),
            hook_style_id=d.get("hook_style_id"),
            base_only=d.get("base_only", False),
        )
        return cls(
            job_request=job_request,
            queued_at=d.get("queued_at", datetime.now().isoformat()),
            log_id=d.get("log_id"),
        )


class RedisJobQueue:
    """Redis-backed job queue with in-memory fallback."""

    def __init__(self):
        self._redis = _get_redis_client()
        self._use_redis = self._redis is not None
        
        # In-memory fallback (also used as async bridge even with Redis)
        self._async_queue: Optional[asyncio.Queue] = None
        self._processing_url: Optional[str] = None
        self._processing_job_id: Optional[int] = None
        self._pending: List[QueuedJob] = []
        self._lock = threading.Lock()
        
        if self._use_redis:
            logger.info("✅ Redis job queue initialized")
            # Restore pending list from Redis on startup
            self._restore_from_redis()
        else:
            logger.info("⚠️ Using in-memory job queue (Redis unavailable)")

    def _restore_from_redis(self):
        """Restore pending jobs from Redis on startup."""
        try:
            # Check if there was a job being processed when server crashed
            processing_data = self._redis.get(REDIS_PROCESSING_KEY)
            if processing_data:
                d = json.loads(processing_data)
                self._processing_url = d.get("url")
                self._processing_job_id = d.get("job_id")
                logger.info(f"  Restored processing state: {self._processing_url}")
            
            # Restore pending queue
            pending_items = self._redis.lrange(REDIS_QUEUE_KEY, 0, -1)
            for item in pending_items:
                try:
                    job = QueuedJob.from_json(item)
                    self._pending.append(job)
                except Exception as e:
                    logger.warning(f"  Failed to restore queued job: {e}")
            
            if self._pending:
                logger.info(f"  Restored {len(self._pending)} pending job(s) from Redis")
        except Exception as e:
            logger.error(f"Failed to restore from Redis: {e}")

    def _get_async_queue(self) -> asyncio.Queue:
        if self._async_queue is None:
            self._async_queue = asyncio.Queue()
        return self._async_queue

    @property
    def processing_url(self) -> Optional[str]:
        return self._processing_url

    def set_processing(self, url: Optional[str], job_id: Optional[int] = None):
        with self._lock:
            self._processing_url = url
            self._processing_job_id = job_id
            if url:
                self._pending = [j for j in self._pending if j.job_request.urls != url]
                # Update Redis
                if self._use_redis:
                    try:
                        self._redis.set(REDIS_PROCESSING_KEY, json.dumps({"url": url, "job_id": job_id}))
                        # Remove from Redis queue
                        self._sync_pending_to_redis()
                    except Exception as e:
                        logger.warning(f"Redis set_processing error: {e}")
            else:
                # Clear processing state
                if self._use_redis:
                    try:
                        self._redis.delete(REDIS_PROCESSING_KEY)
                    except Exception:
                        pass

    def is_processing(self, url: str) -> bool:
        return self._processing_url == url

    def is_processing_job_id(self, job_id: int) -> bool:
        return self._processing_job_id == job_id

    def is_queued(self, url: str) -> bool:
        with self._lock:
            return any(j.job_request.urls == url for j in self._pending)

    def enqueue(self, job: QueuedJob):
        with self._lock:
            self._pending.append(job)
            # Persist to Redis
            if self._use_redis:
                try:
                    self._redis.rpush(REDIS_QUEUE_KEY, job.to_json())
                except Exception as e:
                    logger.warning(f"Redis enqueue error: {e}")
        
        # Also push to async queue for the worker
        try:
            loop = asyncio.get_running_loop()
            loop.call_soon_threadsafe(self._get_async_queue().put_nowait, job)
        except RuntimeError:
            self._get_async_queue().put_nowait(job)

    async def dequeue(self) -> QueuedJob:
        return await self._get_async_queue().get()

    def cancel(self, url: str) -> bool:
        """Remove a pending job from queue."""
        with self._lock:
            before = len(self._pending)
            self._pending = [j for j in self._pending if j.job_request.urls != url]
            removed = len(self._pending) < before
            if removed and self._use_redis:
                try:
                    self._sync_pending_to_redis()
                except Exception as e:
                    logger.warning(f"Redis cancel sync error: {e}")
            return removed

    def get_pending(self) -> List[QueuedJob]:
        with self._lock:
            return list(self._pending)

    def get_status(self) -> Dict:
        with self._lock:
            return {
                "processing_url": self._processing_url,
                "queue_length": len(self._pending),
                "backend": "redis" if self._use_redis else "memory",
                "pending": [
                    {
                        "url": j.job_request.urls,
                        "caption_style": j.job_request.caption_style,
                        "queued_at": j.queued_at,
                    }
                    for j in self._pending
                ],
            }

    def _sync_pending_to_redis(self):
        """Sync in-memory pending list to Redis (full replace)."""
        if not self._use_redis:
            return
        try:
            pipe = self._redis.pipeline()
            pipe.delete(REDIS_QUEUE_KEY)
            for job in self._pending:
                pipe.rpush(REDIS_QUEUE_KEY, job.to_json())
            pipe.execute()
        except Exception as e:
            logger.warning(f"Redis sync error: {e}")


# Singleton — replaces the old in-memory job_queue
job_queue = RedisJobQueue()
