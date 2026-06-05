#!/usr/bin/env python3
"""
Comprehensive TikTok Login Test Script
Tests all login types: manual, phone, email, username
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
from src.infrastructure.repositories import FingerprintRepository, TikTokAccountRepository, SessionRepository
from src.infrastructure.database import database
from src.domain.entities import TikTokAccount, LoginType, AccountStatus

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def test_manual_login():
    """Test manual login flow - opens browser for user to login"""
    logger.info("=" * 60)
    logger.info("TEST 1: Manual Login")
    logger.info("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        
        # Get a desktop fingerprint
        fingerprint = fp_repo.get_random_desktop()
        if not fingerprint:
            logger.error("No desktop fingerprint available!")
            return False
        
        logger.info(f"Using fingerprint: {fingerprint.fingerprint_id}")
        logger.info(f"  - User Agent: {fingerprint.user_agent[:80]}...")
        logger.info(f"  - Viewport: {fingerprint.viewport_width}x{fingerprint.viewport_height}")
        logger.info(f"  - WebGL: {fingerprint.webgl_vendor}")
        logger.info(f"  - Is Mobile: {fingerprint.is_mobile}")
        
        # Test manual login - this opens browser
        logger.info("\nOpening browser for manual login...")
        logger.info("Please login to TikTok manually within 60 seconds...")
        
        result = await tiktok_automation.manual_login(
            account_id=999,  # Dummy ID for test
            fingerprint=fingerprint,
            timeout=60  # 60 seconds to login
        )
        
        logger.info(f"\nManual Login Result:")
        logger.info(f"  - Success: {result.get('success')}")
        logger.info(f"  - Username: {result.get('tiktok_username')}")
        logger.info(f"  - Message: {result.get('message', 'N/A')}")
        logger.info(f"  - Error Code: {result.get('error_code', 'N/A')}")
        
        if result.get('cookies'):
            logger.info(f"  - Cookies captured: {len(result['cookies'])} cookies")
        
        return result.get('success', False)
        
    except Exception as e:
        logger.error(f"Manual login test error: {e}", exc_info=True)
        return False
    finally:
        session.close()


async def test_auto_login_phone(phone: str, password: str):
    """Test auto login with phone number"""
    logger.info("=" * 60)
    logger.info("TEST 2: Auto Login with Phone")
    logger.info("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        
        # Get a desktop fingerprint
        fingerprint = fp_repo.get_random_desktop()
        if not fingerprint:
            logger.error("No desktop fingerprint available!")
            return False
        
        logger.info(f"Using fingerprint: {fingerprint.fingerprint_id}")
        
        # Create mock account
        account = TikTokAccount(
            id=998,
            user_id=1,
            account_name="Test Phone Login",
            login_type=LoginType.PHONE,
            login_identifier=phone,
            password_encrypted="",  # Will use plaintext for test
            status=AccountStatus.ACTIVE,
        )
        
        # We need to encrypt the password - let's use the encryption service
        from src.infrastructure.encryption import encryption_service
        account.password_encrypted = encryption_service.encrypt(password)
        
        logger.info(f"\nAttempting phone login...")
        logger.info(f"  - Phone: {phone[:3]}***{phone[-4:]}")
        
        result = await tiktok_automation.login(
            account=account,
            fingerprint=fingerprint,
            wait_for_verification=True,
            verification_timeout=120  # 2 minutes for verification
        )
        
        logger.info(f"\nPhone Login Result:")
        logger.info(f"  - Success: {result.get('success')}")
        logger.info(f"  - Username: {result.get('tiktok_username')}")
        logger.info(f"  - Message: {result.get('message', 'N/A')}")
        logger.info(f"  - Error Code: {result.get('error_code', 'N/A')}")
        logger.info(f"  - Needs Verification: {result.get('needs_verification', False)}")
        logger.info(f"  - Verification Type: {result.get('verification_type', 'N/A')}")
        
        if result.get('screenshot_path'):
            logger.info(f"  - Screenshot: {result['screenshot_path']}")
        
        return result.get('success', False)
        
    except Exception as e:
        logger.error(f"Phone login test error: {e}", exc_info=True)
        return False
    finally:
        session.close()


async def test_auto_login_email(email: str, password: str):
    """Test auto login with email"""
    logger.info("=" * 60)
    logger.info("TEST 3: Auto Login with Email")
    logger.info("=" * 60)
    
    session = database.get_session()
    try:
        fp_repo = FingerprintRepository(session)
        
        # Get a desktop fingerprint
        fingerprint = fp_repo.get_random_desktop()
        if not fingerprint:
            logger.error("No desktop fingerprint available!")
            return False
        
        logger.info(f"Using fingerprint: {fingerprint.fingerprint_id}")
        
        # Create mock account
        from src.infrastructure.encryption import encryption_service
        
        account = TikTokAccount(
            id=997,
            user_id=1,
            account_name="Test Email Login",
            login_type=LoginType.EMAIL,
            login_identifier=email,
            password_encrypted=encryption_service.encrypt(password),
            status=AccountStatus.ACTIVE,
        )
        
        logger.info(f"\nAttempting email login...")
        logger.info(f"  - Email: {email[:3]}***@{email.split('@')[1] if '@' in email else '???'}")
        
        result = await tiktok_automation.login(
            account=account,
            fingerprint=fingerprint,
            wait_for_verification=True,
            verification_timeout=120
        )
        
        logger.info(f"\nEmail Login Result:")
        logger.info(f"  - Success: {result.get('success')}")
        logger.info(f"  - Username: {result.get('tiktok_username')}")
        logger.info(f"  - Message: {result.get('message', 'N/A')}")
        logger.info(f"  - Error Code: {result.get('error_code', 'N/A')}")
        logger.info(f"  - Needs Verification: {result.get('needs_verification', False)}")
        
        if result.get('screenshot_path'):
            logger.info(f"  - Screenshot: {result['screenshot_path']}")
        
        return result.get('success', False)
        
    except Exception as e:
        logger.error(f"Email login test error: {e}", exc_info=True)
        return False
    finally:
        session.close()


async def test_stealth_detection():
    """Test if stealth scripts are working by checking browser fingerprint"""
    logger.info("=" * 60)
    logger.info("TEST: Stealth Detection Check")
    logger.info("=" * 60)
    
    session = database.get_session()
    context = None
    context_id = None
    
    try:
        fp_repo = FingerprintRepository(session)
        fingerprint = fp_repo.get_random_desktop()
        
        if not fingerprint:
            logger.error("No fingerprint available!")
            return False
        
        logger.info(f"Creating browser with fingerprint: {fingerprint.fingerprint_id}")
        
        # Create visible browser context
        context, context_id = await browser_manager.create_context(
            fingerprint=fingerprint,
            headless=False
        )
        
        page = await browser_manager.get_page(context_id)
        
        # Navigate to bot detection test site
        logger.info("Navigating to bot detection test...")
        await page.goto("https://bot.sannysoft.com/")
        await asyncio.sleep(5)
        
        # Take screenshot
        screenshot_path = "./tmp/screenshots/stealth_test.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        logger.info(f"Screenshot saved: {screenshot_path}")
        
        # Check for webdriver detection
        webdriver_check = await page.evaluate("() => navigator.webdriver")
        logger.info(f"navigator.webdriver = {webdriver_check}")
        
        # Check chrome object
        chrome_check = await page.evaluate("() => typeof window.chrome !== 'undefined'")
        logger.info(f"window.chrome exists = {chrome_check}")
        
        # Check plugins
        plugins_count = await page.evaluate("() => navigator.plugins.length")
        logger.info(f"navigator.plugins.length = {plugins_count}")
        
        # Check WebGL
        webgl_vendor = await page.evaluate("""
            () => {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                if (gl) {
                    const ext = gl.getExtension('WEBGL_debug_renderer_info');
                    if (ext) {
                        return gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
                    }
                }
                return 'N/A';
            }
        """)
        logger.info(f"WebGL Vendor = {webgl_vendor}")
        
        webgl_renderer = await page.evaluate("""
            () => {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                if (gl) {
                    const ext = gl.getExtension('WEBGL_debug_renderer_info');
                    if (ext) {
                        return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
                    }
                }
                return 'N/A';
            }
        """)
        logger.info(f"WebGL Renderer = {webgl_renderer}")
        
        # Keep browser open for 10 seconds for manual inspection
        logger.info("\nBrowser open for manual inspection (10 seconds)...")
        await asyncio.sleep(10)
        
        return webdriver_check is None or webdriver_check == False
        
    except Exception as e:
        logger.error(f"Stealth test error: {e}", exc_info=True)
        return False
    finally:
        if context_id:
            await browser_manager.close_context(context_id)
        session.close()


async def main():
    """Main test runner"""
    print("\n" + "=" * 60)
    print("AUTOCLIPER TIKTOK LOGIN COMPREHENSIVE TEST")
    print("=" * 60 + "\n")
    
    # Parse arguments
    import argparse
    parser = argparse.ArgumentParser(description='Test TikTok login')
    parser.add_argument('--test', choices=['manual', 'phone', 'email', 'stealth', 'all'], 
                       default='stealth', help='Test type to run')
    parser.add_argument('--phone', help='Phone number for phone login test')
    parser.add_argument('--email', help='Email for email login test')
    parser.add_argument('--password', help='Password for auto login tests')
    
    args = parser.parse_args()
    
    results = {}
    
    try:
        if args.test in ['stealth', 'all']:
            results['stealth'] = await test_stealth_detection()
        
        if args.test in ['manual', 'all']:
            results['manual'] = await test_manual_login()
        
        if args.test in ['phone', 'all'] and args.phone and args.password:
            results['phone'] = await test_auto_login_phone(args.phone, args.password)
        
        if args.test in ['email', 'all'] and args.email and args.password:
            results['email'] = await test_auto_login_email(args.email, args.password)
        
    finally:
        await browser_manager.close_all()
    
    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    for test_name, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        print(f"  {test_name}: {status}")
    
    all_passed = all(results.values()) if results else False
    print("\n" + ("ALL TESTS PASSED!" if all_passed else "SOME TESTS FAILED"))
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
