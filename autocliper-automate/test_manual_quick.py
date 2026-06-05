#!/usr/bin/env python3
"""Quick manual login test with short timeout"""
import asyncio
import os
import sys
from dotenv import load_dotenv
load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.infrastructure.browser_manager import browser_manager
from src.infrastructure.tiktok_automation import tiktok_automation
from src.infrastructure.repositories import FingerprintRepository
from src.infrastructure.database import database

async def test():
    print("=" * 60)
    print("TEST: Manual Login (30 second timeout)")
    print("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        fingerprint = fp_repo.get_random_desktop()
        
        print(f"Using fingerprint: {fingerprint.fingerprint_id}")
        print("Browser will open - you have 30 seconds to login manually...")
        print("(This is just a test to verify browser opens correctly)")
        
        result = await tiktok_automation.manual_login(
            account_id=997,
            fingerprint=fingerprint,
            timeout=30  # Short timeout for testing
        )
        
        print("\n" + "-" * 40)
        print(f"Success: {result.get('success')}")
        print(f"Username: {result.get('tiktok_username', 'N/A')}")
        print(f"Error Code: {result.get('error_code', 'N/A')}")
        print(f"Message: {result.get('message', 'N/A')}")
        
        return result
    finally:
        session.close()
        await browser_manager.close_all()

if __name__ == "__main__":
    asyncio.run(test())
