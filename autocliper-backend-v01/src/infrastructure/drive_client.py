"""GoogleDriveClient — Google Drive API wrapper for queue operations.

Upload menggunakan OAuth2 user token (pakai quota user).
Operasi lain (list, download, delete) pakai service account.
"""
import asyncio
import logging
import os
import pickle
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

from src.config import settings
from src.domain.interfaces import IDriveClient

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive"]
TOKEN_FILE = "token.pickle"

# Subfolder yang dibutuhkan
REQUIRED_FOLDERS = ["input", "processing", "results", "completed", "failed"]


class GoogleDriveClient(IDriveClient):
    def __init__(self):
        creds_path = settings.GOOGLE_DRIVE_CREDENTIALS_PATH
        if not os.path.exists(creds_path):
            raise FileNotFoundError(
                f"File credentials Google Drive tidak ditemukan: {creds_path}"
            )

        # Service account untuk list/download/delete
        self._sa_credentials = service_account.Credentials.from_service_account_file(
            creds_path, scopes=SCOPES
        )
        self._service = build("drive", "v3", credentials=self._sa_credentials)

        # OAuth2 user token untuk upload (pakai quota user)
        self._user_service = self._build_user_service()

        self._parent_id = settings.GOOGLE_DRIVE_PARENT_FOLDER_ID
        self._folder_cache: dict[str, str] = {}

    def _build_user_service(self):
        """Load OAuth2 user token untuk upload."""
        if not os.path.exists(TOKEN_FILE):
            logger.warning(
                f"token.pickle tidak ditemukan. Jalankan 'python auth_setup.py' dulu. "
                f"Fallback ke service account (mungkin gagal upload)."
            )
            return self._service

        with open(TOKEN_FILE, "rb") as f:
            creds = pickle.load(f)

        # Refresh jika expired
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_FILE, "wb") as f:
                pickle.dump(creds, f)

        return build("drive", "v3", credentials=creds)

    def _get_folder_id(self, folder_name: str) -> str:
        """Get or create subfolder under parent, with caching."""
        if folder_name in self._folder_cache:
            return self._folder_cache[folder_name]

        query = (
            f"name='{folder_name}' and "
            f"'{self._parent_id}' in parents and "
            f"mimeType='application/vnd.google-apps.folder' and "
            f"trashed=false"
        )
        results = (
            self._service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id, name)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files = results.get("files", [])

        if files:
            folder_id = files[0]["id"]
        else:
            metadata = {
                "name": folder_name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [self._parent_id],
            }
            folder = (
                self._user_service.files()
                .create(body=metadata, fields="id", supportsAllDrives=True)
                .execute()
            )
            folder_id = folder["id"]
            logger.info(f"Created subfolder: {folder_name} ({folder_id})")

        self._folder_cache[folder_name] = folder_id
        return folder_id

    def _ensure_folders(self) -> None:
        """Ensure all required subfolders exist."""
        for folder in REQUIRED_FOLDERS:
            self._get_folder_id(folder)

    async def upload_file(
        self, local_path: str, filename: str, folder: str = "input"
    ) -> str:
        """Upload file pakai user credentials (quota user)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._upload_file_sync, local_path, filename, folder
        )

    def _upload_file_sync(self, local_path: str, filename: str, folder: str) -> str:
        folder_id = self._get_folder_id(folder)
        metadata = {"name": filename, "parents": [folder_id]}
        media = MediaFileUpload(local_path, resumable=True)
        # Pakai user service untuk upload (pakai quota user)
        file = (
            self._user_service.files()
            .create(
                body=metadata,
                media_body=media,
                fields="id",
                supportsAllDrives=True,
            )
            .execute()
        )
        logger.info(f"Uploaded {filename} → {folder}/ (id: {file['id']})")
        return file["id"]

    async def download_file(
        self, filename: str, folder: str, local_path: str
    ) -> bool:
        """Download file dari subfolder ke path lokal."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._download_file_sync, filename, folder, local_path
        )

    def _download_file_sync(
        self, filename: str, folder: str, local_path: str
    ) -> bool:
        file_id = self._find_file_id(filename, folder)
        if not file_id:
            return False

        request = self._service.files().get_media(fileId=file_id)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()

        logger.info(f"Downloaded {filename} dari {folder}/ → {local_path}")
        return True

    async def file_exists(self, filename: str, folder: str) -> bool:
        """Cek apakah file ada di subfolder tertentu."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._file_exists_sync, filename, folder
        )

    def _file_exists_sync(self, filename: str, folder: str) -> bool:
        return self._find_file_id(filename, folder) is not None

    async def delete_file(self, filename: str, folder: str) -> bool:
        """Hapus file dari subfolder tertentu."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._delete_file_sync, filename, folder
        )

    def _delete_file_sync(self, filename: str, folder: str) -> bool:
        file_id = self._find_file_id(filename, folder)
        if not file_id:
            return False
        self._service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
        logger.info(f"Deleted {filename} dari {folder}/")
        return True

    async def list_files(
        self, folder: str, extension: Optional[str] = None
    ) -> list[str]:
        """List file names di subfolder."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._list_files_sync, folder, extension
        )

    def _list_files_sync(
        self, folder: str, extension: Optional[str] = None
    ) -> list[str]:
        folder_id = self._get_folder_id(folder)
        query = f"'{folder_id}' in parents and trashed=false"
        if extension:
            query += f" and name contains '{extension}'"

        results = (
            self._service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(name)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        return [f["name"] for f in results.get("files", [])]

    async def list_files_older_than(self, folder: str, days: int) -> list[str]:
        """List file names yang lebih tua dari N hari."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._list_files_older_than_sync, folder, days
        )

    def _list_files_older_than_sync(self, folder: str, days: int) -> list[str]:
        folder_id = self._get_folder_id(folder)
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_str = cutoff.strftime("%Y-%m-%dT%H:%M:%S")

        query = (
            f"'{folder_id}' in parents and "
            f"trashed=false and "
            f"createdTime < '{cutoff_str}'"
        )
        results = (
            self._service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(name)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        return [f["name"] for f in results.get("files", [])]

    def _find_file_id(self, filename: str, folder: str) -> Optional[str]:
        """Cari file ID berdasarkan nama dan folder."""
        folder_id = self._get_folder_id(folder)
        query = (
            f"name='{filename}' and "
            f"'{folder_id}' in parents and "
            f"trashed=false"
        )
        results = (
            self._service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files = results.get("files", [])
        return files[0]["id"] if files else None
