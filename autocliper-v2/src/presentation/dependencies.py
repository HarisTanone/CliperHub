"""
API Dependencies - Auth, Rate Limiting, Common Utils
"""
import os
import time
from collections import defaultdict
from typing import Dict, List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..infrastructure.auth import decode_access_token


# ─────────────────────────────────────────────────────────────────────────────
#  Rate Limiter (in-memory, per-IP)
# ─────────────────────────────────────────────────────────────────────────────
class RateLimiter:
    """Simple in-memory rate limiter for login endpoint."""
    
    def __init__(self, max_attempts: int = 5, window_seconds: int = 300):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, List[float]] = defaultdict(list)
    
    def is_rate_limited(self, key: str) -> bool:
        now = time.time()
        # Clean old entries
        self._attempts[key] = [
            t for t in self._attempts[key]
            if now - t < self.window_seconds
        ]
        return len(self._attempts[key]) >= self.max_attempts
    
    def record_attempt(self, key: str):
        self._attempts[key].append(time.time())
    
    def reset(self, key: str):
        self._attempts.pop(key, None)


# Singleton rate limiter for login
login_limiter = RateLimiter(max_attempts=5, window_seconds=300)


# ─────────────────────────────────────────────────────────────────────────────
#  Auth Dependencies
# ─────────────────────────────────────────────────────────────────────────────
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Decode JWT and return the payload dict. Raises 401 on any error."""
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Same as get_current_user but also requires role == 'admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
#  Path Security Helper
# ─────────────────────────────────────────────────────────────────────────────
def safe_file_path(base_dir: str, filename: str) -> str:
    """Resolve file path safely, preventing path traversal attacks."""
    # Reject obviously malicious filenames
    if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Resolve and verify the path stays within base_dir
    resolved = os.path.realpath(os.path.join(base_dir, filename))
    base_resolved = os.path.realpath(base_dir)
    
    if not resolved.startswith(base_resolved + os.sep) and resolved != base_resolved:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    return resolved
