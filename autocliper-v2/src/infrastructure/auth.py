"""
Authentication module — JWT tokens (access + refresh) + password hashing
"""
import os
import logging
import secrets
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# ─── Config ────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is required. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
    )

REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", SECRET_KEY + "_refresh")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))  # 30 min (short-lived)
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_REFRESH_EXPIRE_MINUTES", "10080"))  # 7 days


# ─── In-memory refresh token blacklist (for rotation invalidation) ───────────
# In production, use Redis. For now, in-memory set with TTL cleanup.
_revoked_refresh_tokens: set = set()
_revoked_cleanup_counter: int = 0


def _cleanup_revoked():
    """Periodically trim the revoked set to prevent memory leak."""
    global _revoked_cleanup_counter
    _revoked_cleanup_counter += 1
    if _revoked_cleanup_counter > 1000:
        _revoked_refresh_tokens.clear()  # Full reset every 1000 revocations
        _revoked_cleanup_counter = 0


# ─── Password helpers ────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ─── JWT helpers ─────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a refresh token with a unique jti for rotation tracking."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES))
    jti = secrets.token_urlsafe(32)  # Unique token ID for rotation
    to_encode.update({"exp": expire, "type": "refresh", "jti": jti})
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Returns the decoded payload or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Accept tokens without type field (backward compat) or with type=access
        if payload.get("type", "access") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and validate a refresh token. Returns None if invalid/expired/revoked."""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        jti = payload.get("jti")
        if jti and jti in _revoked_refresh_tokens:
            logger.warning(f"Attempted reuse of revoked refresh token jti={jti[:8]}...")
            return None
        return payload
    except JWTError:
        return None


def revoke_refresh_token(token: str):
    """Revoke a refresh token by its jti (rotation: old token becomes invalid)."""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM],
                             options={"verify_exp": False})
        jti = payload.get("jti")
        if jti:
            _revoked_refresh_tokens.add(jti)
            _cleanup_revoked()
    except JWTError:
        pass


def create_token_pair(data: dict) -> Tuple[str, str]:
    """Create both access and refresh tokens. Returns (access_token, refresh_token)."""
    access = create_access_token(data)
    refresh = create_refresh_token(data)
    return access, refresh


def rotate_refresh_token(old_refresh_token: str) -> Optional[Tuple[str, str, dict]]:
    """Rotate: validate old refresh token, revoke it, issue new pair.
    
    Returns (new_access, new_refresh, payload) or None if invalid.
    """
    payload = decode_refresh_token(old_refresh_token)
    if not payload:
        return None
    
    # Revoke the old refresh token
    revoke_refresh_token(old_refresh_token)
    
    # Issue new pair with same user data
    user_data = {
        "sub": payload.get("sub"),
        "username": payload.get("username"),
        "role": payload.get("role"),
    }
    access, refresh = create_token_pair(user_data)
    return access, refresh, payload
