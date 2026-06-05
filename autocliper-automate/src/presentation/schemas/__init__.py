"""
Pydantic Schemas - Request/Response Models for AutoCliper Automate
"""
from .accounts import (
    CreateAccountRequest, UpdateAccountRequest, AccountResponse,
    TriggerLoginRequest, CreateAccountResponse
)
from .uploads import (
    UploadFromClipRequestModel, BulkUploadRequestModel, UploadResponse,
    ScheduleSuggestionResponse
)
from .social import (
    CreateSocialAccountRequest, SocialAccountResponse,
    SocialUploadRequest, SocialUploadResponse
)

__all__ = [
    # Accounts
    "CreateAccountRequest", "UpdateAccountRequest", "AccountResponse",
    "TriggerLoginRequest", "CreateAccountResponse",
    # Uploads
    "UploadFromClipRequestModel", "BulkUploadRequestModel", "UploadResponse",
    "ScheduleSuggestionResponse",
    # Social
    "CreateSocialAccountRequest", "SocialAccountResponse",
    "SocialUploadRequest", "SocialUploadResponse",
]
