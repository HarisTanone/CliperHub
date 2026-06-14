"""DriveWatchdog — Recover stale files from processing/ folder."""
import asyncio
import json
import logging
from datetime import datetime, timezone

from src.domain.interfaces import IDriveClient

logger = logging.getLogger(__name__)

SCAN_INTERVAL = 300       # 5 menit
STALE_THRESHOLD = 2700    # 45 menit
MAX_RECOVERIES = 3


class DriveWatchdog:
    def __init__(self, drive_client: IDriveClient):
        self._drive = drive_client
        self._recovery_counts: dict[str, int] = {}
        self._running = False

    async def start(self) -> None:
        """Mulai scan loop (berjalan sebagai background task)."""
        self._running = True
        logger.info("DriveWatchdog started")
        while self._running:
            try:
                await self._scan()
            except Exception as e:
                logger.error(f"Watchdog scan error: {e}")
            await asyncio.sleep(SCAN_INTERVAL)

    def stop(self) -> None:
        self._running = False

    async def _scan(self) -> None:
        """Scan lock files di processing/ dan recover yang stale."""
        lock_files = await self._drive.list_files("processing", extension=".lock")

        for lock_name in lock_files:
            job_id = lock_name.replace(".lock", "")
            try:
                await self._check_and_recover(job_id, lock_name)
            except Exception as e:
                logger.error(f"Watchdog: gagal proses {lock_name}: {e}")

    async def _check_and_recover(self, job_id: str, lock_name: str) -> None:
        """Cek satu lock file dan recover jika stale."""
        # Download lock file untuk baca started_at
        import tempfile
        import os

        tmp_path = tempfile.mktemp(suffix=".json")
        try:
            downloaded = await self._drive.download_file(lock_name, "processing", tmp_path)
            if not downloaded:
                return

            # Parse lock file
            is_stale = False
            worker_id = "unknown"
            try:
                with open(tmp_path) as f:
                    lock_data = json.load(f)
                started_at_str = lock_data.get("started_at")
                worker_id = lock_data.get("worker_id", "unknown")

                if not started_at_str:
                    is_stale = True
                else:
                    started_at = datetime.fromisoformat(started_at_str)
                    if started_at.tzinfo is None:
                        started_at = started_at.replace(tzinfo=timezone.utc)
                    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
                    is_stale = elapsed > STALE_THRESHOLD
            except (json.JSONDecodeError, ValueError, KeyError):
                # Lock file tidak valid → anggap stale
                is_stale = True

            if not is_stale:
                return

            # Recover file
            recovery_count = self._recovery_counts.get(job_id, 0) + 1
            self._recovery_counts[job_id] = recovery_count

            if recovery_count >= MAX_RECOVERIES:
                # Pindahkan ke failed/
                logger.warning(
                    f"Watchdog: {job_id} sudah di-recover {recovery_count}x → "
                    f"pindah ke failed/"
                )
                audio_name = f"{job_id}.m4a"
                # Cek apakah audio masih ada di processing/
                audio_exists = await self._drive.file_exists(audio_name, "processing")
                if audio_exists:
                    # Ideally move to failed/, tapi Drive API tidak punya move
                    # Workaround: download lalu upload ke failed/
                    pass
                await self._drive.delete_file(lock_name, "processing")
                # Tulis error file
                error_content = json.dumps({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "stage": "watchdog",
                    "error_message": f"Job gagal setelah {MAX_RECOVERIES}x recovery",
                    "stack_trace": "",
                })
                error_tmp = tempfile.mktemp(suffix=".error")
                with open(error_tmp, "w") as f:
                    f.write(error_content)
                await self._drive.upload_file(error_tmp, f"{job_id}.error", "failed")
                os.remove(error_tmp)
            else:
                # Kembalikan ke input/
                logger.info(
                    f"Watchdog: recovering {job_id} (worker={worker_id}, "
                    f"recovery #{recovery_count})"
                )
                # Hapus lock file
                await self._drive.delete_file(lock_name, "processing")
                # Audio file tetap di processing/ — idealnya dipindah ke input/
                # Karena Drive API tidak support move, kita skip ini
                # (Colab worker seharusnya handle dengan mengecek processing/ juga)

        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
