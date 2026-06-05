"""
API Dependencies - Auth
"""
import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Import auth from autocliper-v2 (shared JWT secret)
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'autocliper-v2'))
try:
    from src.infrastructure.auth import decode_access_token
except ImportError:
    # Fallback: implement minimal JWT decode
    from jose import jwt, JWTError
    
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("SECRET_KEY"))
    ALGORITHM = "HS256"
    
    def decode_access_token(token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type", "access") != "access":
                return None
            return payload
        except JWTError:
            return None


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
    """Same as get_current_user but requires role == 'admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
