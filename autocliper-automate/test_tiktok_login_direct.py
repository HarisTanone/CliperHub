#!/usr/bin/env python3
"""
Direct TikTok Login Test
Tests the login flow directly without API
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.infrastructure.browser_manager import browser_manager
from src.infrastructure.tiktok_automation import tiktok_automation
from src.infrastructure.repositories import FingerprintRepository
from src.infrastructure.database import database
from src.infrastructure.encryption import encryption_service
from src.domain.entities import TikTokAccount, LoginType, AccountStatus

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def test_phone_login(phone: str, password: str):
    """Test auto login with phone - visible browser for verification"""
    print("\n" + "=" * 60)
    print("TEST: Phone Login (Non-Headless)")
    print("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        fingerprint = fp_repo.get_random_desktop()
        
        if not fingerprint:
            print("ERROR: No desktop fingerprint available!")
            return None
        
        print(f"Using fingerprint: {fingerprint.fingerprint_id}")
        print(f"  - User Agent: {fingerprint.user_agent[:60]}...")
        print(f"  - Viewport: {fingerprint.viewport_width}x{fingerprint.viewport_height}")
        print(f"  - WebGL: {fingerprint.webgl_vendor}")
        
        # Create mock account
        account = TikTokAccount(
            id=999,
            user_id=1,
            account_name="Test Phone Login",
            login_type=LoginType.PHONE,
            login_identifier=phone,
            password_encrypted=encryption_service.encrypt(password),
            status=AccountStatus.ACTIVE,
        )
        
        print(f"\nAttempting phone login for: {phone[:3]}***{phone[-4:]}")
        print("Browser will open - you may need to complete verification if prompted...")
        
        result = await tiktok_automation.login(
            account=account,
            fingerprint=fingerprint,
            wait_for_verification=True,
            verification_timeout=180  # 3 minutes for verification
        )
        
        print("\n" + "-" * 40)
        print("LOGIN RESULT:")
        print("-" * 40)
        print(f"Success: {result.get('success')}")
        print(f"Username: {result.get('tiktok_username', 'N/A')}")
        print(f"Message: {result.get('message', 'N/A')}")
        print(f"Error Code: {result.get('error_code', 'N/A')}")
        print(f"Needs Verification: {result.get('needs_verification', False)}")
        print(f"Verification Type: {result.get('verification_type', 'N/A')}")
        
        if result.get('screenshot_path'):
            print(f"Screenshot: {result['screenshot_path']}")
        
        if result.get('cookies'):
            print(f"Cookies captured: {len(result['cookies'])} cookies")
        
        return result
        
    except Exception as e:
        logger.error(f"Phone login test error: {e}", exc_info=True)
        return None
    finally:
        session.close()


async def test_email_login(email: str, password: str):
    """Test auto login with email"""
    print("\n" + "=" * 60)
    print("TEST: Email Login (Non-Headless)")
    print("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        fingerprint = fp_repo.get_random_desktop()
        
        if not fingerprint:
            print("ERROR: No desktop fingerprint available!")
            return None
        
        print(f"Using fingerprint: {fingerprint.fingerprint_id}")
        
        # Create mock account
        account = TikTokAccount(
            id=998,
            user_id=1,
            account_name="Test Email Login",
            login_type=LoginType.EMAIL,
            login_identifier=email,
            password_encrypted=encryption_service.encrypt(password),
            status=AccountStatus.ACTIVE,
        )
        
        print(f"\nAttempting email login for: {email}")
        print("Browser will open - you may need to complete verification if prompted...")
        
        result = await tiktok_automation.login(
            account=account,
            fingerprint=fingerprint,
            wait_for_verification=True,
            verification_timeout=180
        )
        
        print("\n" + "-" * 40)
        print("LOGIN RESULT:")
        print("-" * 40)
        print(f"Success: {result.get('success')}")
        print(f"Username: {result.get('tiktok_username', 'N/A')}")
        print(f"Message: {result.get('message', 'N/A')}")
        print(f"Error Code: {result.get('error_code', 'N/A')}")
        print(f"Needs Verification: {result.get('needs_verification', False)}")
        
        if result.get('screenshot_path'):
            print(f"Screenshot: {result['screenshot_path']}")
        
        if result.get('cookies'):
            print(f"Cookies captured: {len(result['cookies'])} cookies")
        
        return result
        
    except Exception as e:
        logger.error(f"Email login test error: {e}", exc_info=True)
        return None
    finally:
        session.close()


async def test_manual_login():
    """Test manual login - opens browser for user"""
    print("\n" + "=" * 60)
    print("TEST: Manual Login")
    print("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        fingerprint = fp_repo.get_random_desktop()
        
        if not fingerprint:
            print("ERROR: No desktop fingerprint available!")
            return None
        
        print(f"Using fingerprint: {fingerprint.fingerprint_id}")
        print("\nOpening browser for manual login...")
        print("Please login to TikTok manually within 2 minutes...")
        
        result = await tiktok_automation.manual_login(
            account_id=997,
            fingerprint=fingerprint,
            timeout=120  # 2 minutes
        )
        
        print("\n" + "-" * 40)
        print("MANUAL LOGIN RESULT:")
        print("-" * 40)
        print(f"Success: {result.get('success')}")
        print(f"Username: {result.get('tiktok_username', 'N/A')}")
        print(f"Message: {result.get('message', 'N/A')}")
        print(f"Error Code: {result.get('error_code', 'N/A')}")
        
        if result.get('cookies'):
            print(f"Cookies captured: {len(result['cookies'])} cookies")
        
        return result
        
    except Exception as e:
        logger.error(f"Manual login test error: {e}", exc_info=True)
        return None
    finally:
        session.close()


async def main():
    import argparse
    parser = argparse.ArgumentParser(description='Test TikTok login')
    parser.add_argument('--type', choices=['phone', 'email', 'manual'], required=True,
                       help='Login type to test')
    parser.add_argument('--phone', help='Phone number (for phone login)')
    parser.add_argument('--email', help='Email (for email login)')
    parser.add_argument('--password', help='Password (for auto login)')
    
    args = parser.parse_args()
    
    result = None
    
    try:
        if args.type == 'phone':
            if not args.phone or not args.password:
                print("ERROR: --phone and --password required for phone login")
                return 1
            result = await test_phone_login(args.phone, args.password)
            
        elif args.type == 'email':
            if not args.email or not args.password:
                print("ERROR: --email and --password required for email login")
                return 1
            result = await test_email_login(args.email, args.password)
            
        elif args.type == 'manual':
            result = await test_manual_login()
    
    finally:
        await browser_manager.close_all()
    
    if result and result.get('success'):
        print("\n✓ LOGIN SUCCESSFUL!")
        return 0
    else:
        print("\n✗ LOGIN FAILED")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
