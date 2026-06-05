"""
Pydantic Schemas - Request/Response Models
"""
from .auth import (
    LoginRequest, TokenResponse, RefreshTokenRequest,
    ChangePasswordRequest, ProfileUpdateRequest
)
from .users import CreateUserRequest, UpdateUserRequest, UserResponse
from .jobs import (
    JobRequestModel, BatchJobResponse, JobResponse, JobStatusResponse,
    JobHistoryResponse, ClipInfo, AnalyzeRequest, AnalyzeResponse,
    ClipCandidate, ProcessSelectedRequest, PreviewRequest, PreviewResponse,
    BaseProcessRequest, BaseProcessResponse, ApplyStyleRequest, ApplyStyleResponse,
    BaseClipInfo, BaseJobDetailResponse
)
from .styles import (
    FontResponse, FontCreateModel, FontUpdateModel,
    HookStyleResponse, HookStyleCreateModel, HookStyleUpdateModel,
    CaptionStyleResponse, CaptionStyleCreateModel, CaptionStyleUpdateModel
)
from .analytics import EngagementPredictRequest, AudioSuggestRequest

__all__ = [
    # Auth
    "LoginRequest", "TokenResponse", "RefreshTokenRequest",
    "ChangePasswordRequest", "ProfileUpdateRequest",
    # Users
    "CreateUserRequest", "UpdateUserRequest", "UserResponse",
    # Jobs
    "JobRequestModel", "BatchJobResponse", "JobResponse", "JobStatusResponse",
    "JobHistoryResponse", "ClipInfo", "AnalyzeRequest", "AnalyzeResponse",
    "ClipCandidate", "ProcessSelectedRequest", "PreviewRequest", "PreviewResponse",
    "BaseProcessRequest", "BaseProcessResponse", "ApplyStyleRequest", "ApplyStyleResponse",
    "BaseClipInfo", "BaseJobDetailResponse",
    # Styles
    "FontResponse", "FontCreateModel", "FontUpdateModel",
    "HookStyleResponse", "HookStyleCreateModel", "HookStyleUpdateModel",
    "CaptionStyleResponse", "CaptionStyleCreateModel", "CaptionStyleUpdateModel",
    # Analytics
    "EngagementPredictRequest", "AudioSuggestRequest",
]
