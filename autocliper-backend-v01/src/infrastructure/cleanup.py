"""DriveCleanupService — Auto-delete old files from Google Drive folders."""
import asyncio
import logging

from src.config import settings
from src.domain.interfaces import IDriveClient

logger = logging.getLogger(__name__)

CLEANUP_INTERVAL = 86400  # 24 jam


class DriveCleanupService:
    def __init__(self, drive_client: IDriveClient):
        self._drive = drive_client
        self._running = False

    async def start(self) -> None:
        """Jalankan cleanup pada startup, lalu setiap 24 jam."""
        self._running = True
        logger.info("DriveCleanupService started")

        # Cleanup pertama saat startup
        await self._cleanup()

        while self._running:
            await asyncio.sleep(CLEANUP_INTERVAL)
            if self._running:
                await self._cleanup()

    def stop(self) -> None:
        self._running = False

    async def _cleanup(self) -> None:
        """Hapus file yang lebih tua dari CLEANUP_MAX_AGE_DAYS."""
        folders = ["completed", "results", "failed"]
        max_age = settings.CLEANUP_MAX_AGE_DAYS

        logger.info(f"Cleanup: menghapus file > {max_age} hari di {folders}")

        # Ambil list file di processing/ untuk skip
        processing_files = await self._drive.list_files("processing")
        processing_job_ids = set()
        for f in processing_files:
            # Extract job_id dari filename (job_xxx.m4a atau job_xxx.lock)
            job_id = f.rsplit(".", 1)[0] if "." in f else f
            processing_job_ids.add(job_id)

        total_deleted = 0

        for folder in folders:
            try:
                old_files = await self._drive.list_files_older_than(folder, max_age)
                for filename in old_files:
                    # Skip jika job masih di processing
                    job_id = filename.rsplit(".", 1)[0] if "." in filename else filename
                    if job_id in processing_job_ids:
                        logger.debug(f"Cleanup: skip {filename} (masih di processing)")
                        continue

                    try:
                        deleted = await self._drive.delete_file(filename, folder)
                        if deleted:
                            total_deleted += 1
                    except Exception as e:
                        logger.warning(
                            f"Cleanup: gagal hapus {folder}/{filename}: {e}"
                        )
            except Exception as e:
                logger.error(f"Cleanup: error di folder {folder}: {e}")

        logger.info(f"Cleanup selesai: {total_deleted} file dihapus")
