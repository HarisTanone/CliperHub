"""
Job Queue — sequential video processing queue.
One video processes at a time; others wait in line.

This module now delegates to redis_job_queue which provides:
- Redis persistence (crash-safe)
- Automatic fallback to in-memory if Redis unavailable
"""
from .redis_job_queue import RedisJobQueue, QueuedJob, job_queue

# Re-export for backward compatibility
__all__ = ["QueuedJob", "job_queue", "RedisJobQueue"]
