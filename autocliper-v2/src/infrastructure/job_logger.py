"""
In-memory job logger — stores logs for the latest processing job only.
Resets every time a new job starts.

Now with WebSocket push: every log/state change is broadcast to connected clients.
"""
import asyncio
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable

STAGE_KEYS = ["fetching_video", "analyzing_content", "generating_clips", "applying_captions"]

STAGE_LABELS = {
    "fetching_video": "Fetching Video",
    "analyzing_content": "Analyzing Content",
    "generating_clips": "Generating Clips",
    "applying_captions": "Applying Captions",
}


class JobLogger:
    def __init__(self):
        self._reset_state()
        self._owner_user_id: Optional[int] = None
        self._ws_broadcast: Optional[Callable] = None
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_ws_broadcaster(self, broadcast_fn: Callable, loop: asyncio.AbstractEventLoop):
        """Set the WebSocket broadcast function (called from api.py on startup)."""
        self._ws_broadcast = broadcast_fn
        self._event_loop = loop

    def _push_ws(self):
        """Push current state to WebSocket clients (non-blocking from worker thread)."""
        if not self._ws_broadcast or not self._event_loop:
            return
        try:
            state = self.get_state()
            asyncio.run_coroutine_threadsafe(
                self._ws_broadcast(state, self._owner_user_id),
                self._event_loop
            )
        except Exception:
            pass  # Never block pipeline for WS errors

    def _reset_state(self):
        self._youtube_url: str = ""
        self._started_at: Optional[str] = None
        self._finished_at: Optional[str] = None
        self._status: str = "idle"
        self._current_stage: str = ""
        self._total_clips: int = 0
        self._clips_completed: int = 0
        self._error: Optional[str] = None
        self._request_id: Optional[int] = None
        self._logs: List[Dict[str, Any]] = []
        self._stage_meta: Dict[str, Dict] = {
            key: {"status": "pending", "started_at": None, "finished_at": None}
            for key in STAGE_KEYS
        }

    def reset(self, youtube_url: str, user_id: Optional[int] = None):
        self._reset_state()
        self._youtube_url = youtube_url
        self._started_at = datetime.now().isoformat()
        self._status = "processing"
        self._owner_user_id = user_id
        self._push_ws()

    def log(self, message: str, stage_key: str = None):
        if stage_key and stage_key != self._current_stage:
            if self._current_stage and self._current_stage in self._stage_meta:
                self._stage_meta[self._current_stage]["status"] = "done"
                self._stage_meta[self._current_stage]["finished_at"] = datetime.now().isoformat()
            self._current_stage = stage_key
            if stage_key in self._stage_meta:
                self._stage_meta[stage_key]["status"] = "active"
                self._stage_meta[stage_key]["started_at"] = datetime.now().isoformat()

        self._logs.append({
            "stage_key": self._current_stage,
            "stage_label": STAGE_LABELS.get(self._current_stage, self._current_stage),
            "message": message,
            "timestamp": datetime.now().isoformat(),
        })
        self._push_ws()

    def set_total_clips(self, total: int):
        self._total_clips = total
        self._push_ws()

    def set_request_id(self, request_id: int):
        self._request_id = request_id
        self._push_ws()

    def set_clips_completed(self, count: int):
        self._clips_completed = count
        self._push_ws()

    def mark_completed(self):
        self._status = "completed"
        self._finished_at = datetime.now().isoformat()
        if self._current_stage in self._stage_meta:
            self._stage_meta[self._current_stage]["status"] = "done"
            self._stage_meta[self._current_stage]["finished_at"] = self._finished_at
        self._push_ws()

    def mark_failed(self, error: str):
        self._status = "failed"
        self._error = error
        self._finished_at = datetime.now().isoformat()
        if self._current_stage in self._stage_meta:
            self._stage_meta[self._current_stage]["status"] = "error"
            self._stage_meta[self._current_stage]["finished_at"] = self._finished_at
        self._push_ws()

    def get_state(self) -> Dict[str, Any]:
        stages = []
        for key in STAGE_KEYS:
            meta = self._stage_meta[key]
            stage_logs = [
                {"message": e["message"], "timestamp": e["timestamp"]}
                for e in self._logs if e["stage_key"] == key
            ]
            stages.append({
                "key": key,
                "label": STAGE_LABELS[key],
                "status": meta["status"],
                "started_at": meta["started_at"],
                "finished_at": meta["finished_at"],
                "logs": stage_logs,
            })

        return {
            "youtube_url": self._youtube_url,
            "status": self._status,
            "current_stage": STAGE_LABELS.get(self._current_stage, ""),
            "current_stage_key": self._current_stage,
            "total_clips": self._total_clips,
            "clips_completed": self._clips_completed,
            "started_at": self._started_at,
            "finished_at": self._finished_at,
            "error": self._error,
            "request_id": self._request_id,
            "stages": stages,
        }


# Singleton
job_logger = JobLogger()
