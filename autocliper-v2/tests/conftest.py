"""
Test configuration and shared fixtures.
"""
import os
import pytest

# Set test environment variables before importing app modules
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("YOUTUBE_API_KEY", "test-youtube-key")
os.environ.setdefault("OUTPUT_DIR", "./tmp/test_output")


@pytest.fixture
def auth_token():
    """Generate a valid JWT token for testing."""
    from src.infrastructure.auth import create_access_token
    return create_access_token({
        "sub": "1",
        "username": "testuser",
        "role": "user",
    })


@pytest.fixture
def admin_token():
    """Generate a valid admin JWT token for testing."""
    from src.infrastructure.auth import create_access_token
    return create_access_token({
        "sub": "1",
        "username": "admin",
        "role": "admin",
    })
