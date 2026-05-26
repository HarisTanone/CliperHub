"""
Tests for authentication module.
"""
import pytest
from datetime import timedelta


def test_hash_and_verify_password():
    """Test password hashing and verification."""
    from src.infrastructure.auth import hash_password, verify_password
    
    password = "test_password_123"
    hashed = hash_password(password)
    
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_verify_password_invalid_hash():
    """Test verify_password with invalid hash doesn't crash."""
    from src.infrastructure.auth import verify_password
    
    assert verify_password("test", "not-a-valid-hash") is False
    assert verify_password("test", "") is False


def test_create_and_decode_token():
    """Test JWT token creation and decoding."""
    from src.infrastructure.auth import create_access_token, decode_access_token
    
    payload = {"sub": "42", "username": "testuser", "role": "user"}
    token = create_access_token(payload)
    
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["username"] == "testuser"
    assert decoded["role"] == "user"
    assert "exp" in decoded


def test_decode_invalid_token():
    """Test decoding an invalid token returns None."""
    from src.infrastructure.auth import decode_access_token
    
    assert decode_access_token("invalid.token.here") is None
    assert decode_access_token("") is None


def test_token_expiry():
    """Test that expired tokens are rejected."""
    from src.infrastructure.auth import create_access_token, decode_access_token
    
    # Create a token that expired 1 hour ago
    token = create_access_token(
        {"sub": "1", "username": "test", "role": "user"},
        expires_delta=timedelta(hours=-1)
    )
    
    assert decode_access_token(token) is None
