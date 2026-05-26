"""
Tests for API security — rate limiting, path traversal, auth enforcement.
"""
import pytest
import os
import tempfile


def test_safe_file_path_blocks_traversal():
    """Test that path traversal attempts are blocked."""
    from src.presentation.api import _safe_file_path
    from fastapi import HTTPException
    
    base_dir = tempfile.mkdtemp()
    # Resolve base_dir the same way the function does (handles macOS /var -> /private/var)
    base_dir_resolved = os.path.realpath(base_dir)
    
    # Normal filename should work
    normal_path = _safe_file_path(base_dir, "clip_1_final.mp4")
    assert normal_path.startswith(base_dir_resolved)
    
    # Path traversal attempts should raise
    with pytest.raises(HTTPException) as exc_info:
        _safe_file_path(base_dir, "../../../etc/passwd")
    assert exc_info.value.status_code == 400
    
    with pytest.raises(HTTPException) as exc_info:
        _safe_file_path(base_dir, "..\\..\\windows\\system32")
    assert exc_info.value.status_code == 400
    
    with pytest.raises(HTTPException) as exc_info:
        _safe_file_path(base_dir, "/etc/passwd")
    assert exc_info.value.status_code == 400


def test_rate_limiter():
    """Test rate limiter blocks after max attempts."""
    from src.presentation.api import RateLimiter
    
    limiter = RateLimiter(max_attempts=3, window_seconds=60)
    
    # First 3 attempts should pass
    assert limiter.is_rate_limited("192.168.1.1") is False
    limiter.record_attempt("192.168.1.1")
    assert limiter.is_rate_limited("192.168.1.1") is False
    limiter.record_attempt("192.168.1.1")
    assert limiter.is_rate_limited("192.168.1.1") is False
    limiter.record_attempt("192.168.1.1")
    
    # 4th attempt should be blocked
    assert limiter.is_rate_limited("192.168.1.1") is True
    
    # Different IP should not be affected
    assert limiter.is_rate_limited("10.0.0.1") is False


def test_rate_limiter_reset():
    """Test rate limiter reset clears attempts."""
    from src.presentation.api import RateLimiter
    
    limiter = RateLimiter(max_attempts=2, window_seconds=60)
    
    limiter.record_attempt("192.168.1.1")
    limiter.record_attempt("192.168.1.1")
    assert limiter.is_rate_limited("192.168.1.1") is True
    
    limiter.reset("192.168.1.1")
    assert limiter.is_rate_limited("192.168.1.1") is False
