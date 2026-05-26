"""
WebSocket Manager — real-time bidirectional communication for job progress.

Replaces SSE polling with persistent WebSocket connections.
Each authenticated user gets their own channel.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per user."""

    def __init__(self):
        # user_id -> set of WebSocket connections
        self._connections: Dict[int, Set] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket, user_id: int):
        """Register a new WebSocket connection for a user."""
        await websocket.accept()
        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = set()
            self._connections[user_id].add(websocket)
        logger.info(f"WebSocket connected: user={user_id}, total={self.total_connections}")

    async def disconnect(self, websocket, user_id: int):
        """Remove a WebSocket connection."""
        async with self._lock:
            if user_id in self._connections:
                self._connections[user_id].discard(websocket)
                if not self._connections[user_id]:
                    del self._connections[user_id]
        logger.debug(f"WebSocket disconnected: user={user_id}")

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self._connections.values())

    async def send_to_user(self, user_id: int, data: dict):
        """Send a message to all connections of a specific user."""
        connections = self._connections.get(user_id, set()).copy()
        dead = []
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.get(user_id, set()).discard(ws)

    async def broadcast(self, data: dict, exclude_user: Optional[int] = None):
        """Broadcast a message to all connected users."""
        for user_id, connections in list(self._connections.items()):
            if exclude_user and user_id == exclude_user:
                continue
            for ws in connections.copy():
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

    async def broadcast_job_progress(self, job_state: dict, owner_user_id: Optional[int] = None):
        """Broadcast job progress to relevant users.
        
        - Owner gets full details
        - Other users get summary (queue position updates)
        """
        # Send full state to job owner
        if owner_user_id:
            await self.send_to_user(owner_user_id, {
                "type": "job_progress",
                "data": job_state,
            })
        
        # Send queue update to all users
        await self.broadcast({
            "type": "queue_update",
            "data": {
                "processing": job_state.get("youtube_url"),
                "status": job_state.get("status"),
                "current_stage": job_state.get("current_stage"),
                "clips_completed": job_state.get("clips_completed", 0),
                "total_clips": job_state.get("total_clips", 0),
            }
        }, exclude_user=owner_user_id)

    async def notify_job_completed(self, user_id: int, job_id: int, youtube_url: str, clips_count: int):
        """Notify user that their job completed."""
        await self.send_to_user(user_id, {
            "type": "job_completed",
            "data": {
                "job_id": job_id,
                "youtube_url": youtube_url,
                "clips_count": clips_count,
                "timestamp": datetime.now().isoformat(),
            }
        })

    async def notify_job_failed(self, user_id: int, job_id: int, youtube_url: str, error: str):
        """Notify user that their job failed."""
        await self.send_to_user(user_id, {
            "type": "job_failed",
            "data": {
                "job_id": job_id,
                "youtube_url": youtube_url,
                "error": error,
                "timestamp": datetime.now().isoformat(),
            }
        })


# Singleton
ws_manager = ConnectionManager()
