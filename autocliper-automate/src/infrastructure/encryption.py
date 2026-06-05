"""
Encryption Service for password storage
Uses Fernet symmetric encryption (AES-128-CBC with HMAC)
"""
import os
import logging
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


class EncryptionService:
    """Service for encrypting/decrypting sensitive data like passwords"""
    
    def __init__(self):
        self._key = os.getenv("ENCRYPTION_KEY")
        if not self._key:
            raise RuntimeError(
                "ENCRYPTION_KEY environment variable is required. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        
        try:
            self._fernet = Fernet(self._key.encode() if isinstance(self._key, str) else self._key)
        except Exception as e:
            raise RuntimeError(f"Invalid ENCRYPTION_KEY format: {e}")
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext string, returns base64-encoded ciphertext"""
        if not plaintext:
            return ""
        encrypted = self._fernet.encrypt(plaintext.encode())
        return encrypted.decode()
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext, returns plaintext string"""
        if not ciphertext:
            return ""
        try:
            decrypted = self._fernet.decrypt(ciphertext.encode())
            return decrypted.decode()
        except InvalidToken:
            logger.error("Failed to decrypt: Invalid token (wrong key or corrupted data)")
            raise ValueError("Unable to decrypt data - invalid token")
    
    @staticmethod
    def generate_key() -> str:
        """Generate a new Fernet key"""
        return Fernet.generate_key().decode()


# Singleton instance
encryption_service = EncryptionService()
