"""
TikTok Automation Service
Handles login, session validation, and video upload
"""
import asyncio
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from playwright.async_api import Page, BrowserContext, TimeoutError as PlaywrightTimeout

from ..domain.entities import TikTokAccount, TikTokSession, UploadJob, BrowserFingerprint
from .browser_manager import browser_manager
from .human_behavior import HumanBehavior, SessionWarmer
from .encryption import encryption_service

logger = logging.getLogger(__name__)


class TikTokAutomation:
    """TikTok browser automation"""
    
    TIKTOK_URL = "https://www.tiktok.com"
    LOGIN_URL = "https://www.tiktok.com/login"
    UPLOAD_URL = "https://www.tiktok.com/upload"
    
    def __init__(self):
        self.screenshot_dir = os.getenv("SCREENSHOT_DIR", "./tmp/screenshots")
        os.makedirs(self.screenshot_dir, exist_ok=True)
        self._manual_login_contexts: Dict[str, Any] = {}  # Track open manual login browsers
    
    async def manual_login(
        self,
        account_id: int,
        fingerprint: BrowserFingerprint,
        timeout: int = 300,  # 5 minutes to login manually
    ) -> Dict[str, Any]:
        """
        Open browser for manual login
        User logs in manually, system captures cookies when login detected
        
        Returns:
            Dict with success, cookies, tiktok_username, or error info
        """
        logger.info(f"Opening browser for manual login (account_id: {account_id})")
        
        context = None
        context_id = None
        
        try:
            # Create VISIBLE browser context for manual login
            context, context_id = await browser_manager.create_context(
                fingerprint=fingerprint,
                headless=False,  # Must be visible for manual login
            )
            
            page = await browser_manager.get_page(context_id)
            human = HumanBehavior(page)
            
            # Navigate to TikTok login page
            await page.goto(self.LOGIN_URL)
            await human.wait_for_page_idle()
            
            logger.info(f"Browser opened at {self.LOGIN_URL}. Waiting for user to login...")
            logger.info(f"User has {timeout} seconds to complete login manually.")
            
            # Wait for user to complete login
            start_time = asyncio.get_event_loop().time()
            check_interval = 2  # Check every 2 seconds
            
            while asyncio.get_event_loop().time() - start_time < timeout:
                # Check if user is now logged in
                if await self._is_logged_in(page):
                    logger.info("Manual login detected! Capturing session...")
                    
                    # Extract session data
                    cookies = await context.cookies()
                    tiktok_username = await self._get_username(page)
                    
                    logger.info(f"Manual login successful! Username: @{tiktok_username}")
                    
                    return {
                        "success": True,
                        "cookies": cookies,
                        "tiktok_username": tiktok_username,
                        "fingerprint_id": fingerprint.id,
                        "login_method": "manual",
                    }
                
                # Check if still on login page or navigated away
                current_url = page.url
                if "/login" not in current_url and self.TIKTOK_URL in current_url:
                    # User navigated away from login, might be logged in
                    await asyncio.sleep(2)
                    if await self._is_logged_in(page):
                        cookies = await context.cookies()
                        tiktok_username = await self._get_username(page)
                        
                        return {
                            "success": True,
                            "cookies": cookies,
                            "tiktok_username": tiktok_username,
                            "fingerprint_id": fingerprint.id,
                            "login_method": "manual",
                        }
                
                await asyncio.sleep(check_interval)
            
            # Timeout
            screenshot_path = await self._take_screenshot(page, f"manual_login_timeout_{account_id}")
            return {
                "success": False,
                "message": f"Manual login timeout ({timeout}s). Please try again.",
                "screenshot_path": screenshot_path,
                "error_code": "MANUAL_LOGIN_TIMEOUT",
            }
            
        except Exception as e:
            logger.error(f"Manual login error: {e}", exc_info=True)
            return {
                "success": False,
                "message": str(e),
                "error_code": "MANUAL_LOGIN_ERROR",
            }
        finally:
            if context_id:
                await browser_manager.close_context(context_id)
    
    async def login(
        self, 
        account: TikTokAccount, 
        fingerprint: BrowserFingerprint,
        existing_session: TikTokSession = None,
        wait_for_verification: bool = True,
        verification_timeout: int = 180  # 3 minutes to complete verification
    ) -> Dict[str, Any]:
        """
        Login to TikTok account
        Returns session data (cookies, localStorage, etc.) or error info
        
        If verification is needed and wait_for_verification=True:
        - Browser stays open (visible) for user to complete verification
        - Waits up to verification_timeout seconds for user to complete
        """
        logger.info(f"Starting login for account: {account.account_name}")
        
        context = None
        context_id = None
        
        try:
            # Create browser context - use VISIBLE browser so user can complete verification
            # This is important for captcha/SMS verification
            cookies = existing_session.cookies if existing_session and existing_session.is_valid else None
            context, context_id = await browser_manager.create_context(
                fingerprint=fingerprint,
                proxy_url=account.proxy_url,
                cookies=cookies if isinstance(cookies, list) else None,
                headless=False,  # VISIBLE browser for login - user may need to complete verification
            )
            
            page = await browser_manager.get_page(context_id)
            human = HumanBehavior(page)
            
            # Try to restore session first
            if existing_session and existing_session.cookies:
                logger.info("Attempting to restore session from cookies...")
                await page.goto(self.TIKTOK_URL)
                await human.wait_for_page_idle()
                
                # Check if logged in
                if await self._is_logged_in(page):
                    logger.info("Session restored successfully")
                    return {
                        "success": True,
                        "session_restored": True,
                        "cookies": await context.cookies(),
                        "tiktok_username": await self._get_username(page),
                    }
            
            # Fresh login required
            logger.info(f"Fresh login required (type: {account.login_type})")
            await page.goto(self.LOGIN_URL)
            await human.wait_for_page_idle()
            await asyncio.sleep(2)
            
            # Decrypt password
            password = encryption_service.decrypt(account.password_encrypted)
            
            # Select login method and perform login
            if account.login_type == "email":
                result = await self._login_with_email(page, human, account.login_identifier, password)
            elif account.login_type == "username":
                result = await self._login_with_username(page, human, account.login_identifier, password)
            elif account.login_type == "phone":
                result = await self._login_with_phone(page, human, account.login_identifier, password)
            else:
                raise ValueError(f"Unknown login type: {account.login_type}")
            
            if not result.get("success"):
                return result
            
            # Wait for login to complete
            await asyncio.sleep(3)
            
            # Check for login error messages first
            login_error = await self._check_login_error(page)
            if login_error:
                logger.warning(f"Login error detected: {login_error}")
                screenshot_path = await self._take_screenshot(page, f"login_error_{account.id}")
                return {
                    "success": False,
                    "message": login_error,
                    "screenshot_path": screenshot_path,
                    "error_code": "INVALID_CREDENTIALS",
                }
            
            # Check for verification/captcha
            verification = await self._check_verification(page)
            if verification:
                logger.info(f"Verification required: {verification}")
                screenshot_path = await self._take_screenshot(page, f"verification_{account.id}")
                
                if wait_for_verification:
                    # Wait for user to complete verification
                    logger.info(f"Waiting up to {verification_timeout}s for user to complete verification...")
                    
                    verification_complete = await self._wait_for_verification_complete(
                        page, context, verification_timeout
                    )
                    
                    if verification_complete:
                        logger.info("Verification completed successfully!")
                        cookies = await context.cookies()
                        tiktok_username = await self._get_username(page)
                        
                        return {
                            "success": True,
                            "cookies": cookies,
                            "tiktok_username": tiktok_username,
                            "fingerprint_id": fingerprint.id,
                            "verification_completed": True,
                        }
                    else:
                        return {
                            "success": False,
                            "needs_verification": True,
                            "verification_type": verification,
                            "screenshot_path": screenshot_path,
                            "message": f"Verification timeout. Please try again.",
                        }
                else:
                    return {
                        "success": False,
                        "needs_verification": True,
                        "verification_type": verification,
                        "screenshot_path": screenshot_path,
                        "message": f"Verification required: {verification}",
                    }
            
            # Verify login success
            if not await self._is_logged_in(page):
                screenshot_path = await self._take_screenshot(page, f"login_failed_{account.id}")
                return {
                    "success": False,
                    "message": "Login failed. Check your credentials.",
                    "screenshot_path": screenshot_path,
                }
            
            # Extract session data
            cookies = await context.cookies()
            tiktok_username = await self._get_username(page)
            
            logger.info(f"Login successful for {account.account_name} (@{tiktok_username})")
            
            return {
                "success": True,
                "cookies": cookies,
                "tiktok_username": tiktok_username,
                "fingerprint_id": fingerprint.id,
            }
            
        except PlaywrightTimeout as e:
            logger.error(f"Timeout during login: {e}")
            return {
                "success": False,
                "message": f"Timeout: {str(e)}",
                "error_code": "TIMEOUT",
            }
        except Exception as e:
            logger.error(f"Login error: {e}", exc_info=True)
            return {
                "success": False,
                "message": str(e),
                "error_code": "LOGIN_ERROR",
            }
        finally:
            if context_id:
                await browser_manager.close_context(context_id)
    
    async def _wait_for_verification_complete(
        self, 
        page: Page, 
        context: BrowserContext,
        timeout: int = 180
    ) -> bool:
        """
        Wait for user to complete verification (captcha, SMS, etc.)
        Returns True if verification completed and user is logged in
        """
        logger.info("Waiting for verification to complete...")
        
        start_time = asyncio.get_event_loop().time()
        check_interval = 2  # Check every 2 seconds
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            # Check if logged in now
            if await self._is_logged_in(page):
                return True
            
            # Check if still on verification
            verification = await self._check_verification(page)
            if not verification:
                # No verification screen, check if logged in
                await asyncio.sleep(1)
                if await self._is_logged_in(page):
                    return True
            
            await asyncio.sleep(check_interval)
        
        return False
    
    async def _login_with_email(self, page: Page, human: HumanBehavior, 
                                email: str, password: str) -> Dict[str, Any]:
        """Login using email - navigates directly to email login page"""
        try:
            # Navigate directly to email login page (bypasses main login page navigation)
            EMAIL_LOGIN_URL = "https://www.tiktok.com/login/phone-or-email/email"
            
            if EMAIL_LOGIN_URL not in page.url:
                logger.info(f"Navigating to email login page: {EMAIL_LOGIN_URL}")
                await page.goto(EMAIL_LOGIN_URL)
                await asyncio.sleep(2)
            
            # Wait for page to stabilize
            await asyncio.sleep(1)
            
            # Find email/username input - based on Playwright MCP analysis
            # The input has placeholder="Email or username"
            email_selectors = [
                'input[placeholder="Email or username"]',
                'input[placeholder*="Email"]',
                'input[placeholder*="email"]',
                'input[name="username"]',
                'input[type="text"]',
            ]
            
            email_input = None
            for selector in email_selectors:
                try:
                    locator = page.locator(selector)
                    if await locator.count() > 0:
                        email_input = locator.first
                        logger.info(f"Found email input with selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not email_input:
                screenshot_path = await self._take_screenshot(page, "login_no_email_input")
                return {"success": False, "message": f"Could not find email input field. Screenshot: {screenshot_path}"}
            
            # Type email
            await human.type_in_locator(email_input, email)
            await asyncio.sleep(0.5)
            
            # Find password input - based on Playwright MCP analysis
            # The input has placeholder="Password" and type="password"
            password_selectors = [
                'input[placeholder="Password"]',
                'input[type="password"]',
            ]
            
            password_input = None
            for selector in password_selectors:
                try:
                    locator = page.locator(selector)
                    if await locator.count() > 0:
                        password_input = locator.first
                        logger.info(f"Found password input with selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not password_input:
                screenshot_path = await self._take_screenshot(page, "login_no_password_input")
                return {"success": False, "message": f"Could not find password input. Screenshot: {screenshot_path}"}
            
            await human.type_in_locator(password_input, password)
            await asyncio.sleep(0.5)
            
            # Click login button - based on Playwright MCP analysis
            # The button has text "Log in" and is initially disabled until form is filled
            login_selectors = [
                'button:has-text("Log in")',
                'button:has-text("Masuk")',
                'button[type="submit"]',
                'button[data-e2e="login-button"]',
            ]
            
            clicked = False
            for selector in login_selectors:
                try:
                    login_button = page.locator(selector)
                    if await login_button.count() > 0:
                        btn = login_button.first
                        # Wait a moment for button to become enabled after typing
                        await asyncio.sleep(0.5)
                        if await btn.is_enabled():
                            await human.click_locator_with_delay(btn)
                            logger.info(f"Clicked login button: {selector}")
                            clicked = True
                            break
                except Exception:
                    continue
            
            if not clicked:
                screenshot_path = await self._take_screenshot(page, "login_no_submit_button")
                return {"success": False, "message": f"Could not find enabled login button. Screenshot: {screenshot_path}"}
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Email login error: {e}")
            await self._take_screenshot(page, "email_login_error")
            return {"success": False, "message": str(e)}
    
    async def _login_with_username(self, page: Page, human: HumanBehavior,
                                   username: str, password: str) -> Dict[str, Any]:
        """Login using username - similar to email flow"""
        return await self._login_with_email(page, human, username, password)
    
    async def _login_with_phone(self, page: Page, human: HumanBehavior,
                                phone: str, password: str) -> Dict[str, Any]:
        """Login using phone number - navigates directly to phone+password login page"""
        try:
            # Navigate directly to phone+password login page (bypasses navigation through main login)
            PHONE_PASSWORD_URL = "https://www.tiktok.com/login/phone-or-email/phone-password"
            
            if PHONE_PASSWORD_URL not in page.url:
                logger.info(f"Navigating to phone password login page: {PHONE_PASSWORD_URL}")
                await page.goto(PHONE_PASSWORD_URL)
                await asyncio.sleep(2)
            
            # Wait for page to stabilize
            await asyncio.sleep(1)
            
            # Dismiss "Buka TikTok" / "Open TikTok app" popup if present
            try:
                dismiss_buttons = [
                    'button:has-text("Nanti saja")',
                    'button:has-text("Not now")',
                    'button:has-text("Maybe later")',
                    'div:has-text("Nanti saja")',
                    '[data-e2e="modal-close-button"]',
                ]
                for selector in dismiss_buttons:
                    btn = page.locator(selector)
                    if await btn.count() > 0:
                        await btn.first.click()
                        logger.info("Dismissed app popup")
                        await asyncio.sleep(1)
                        break
            except Exception:
                pass
            
            # Find phone input - based on Playwright MCP analysis
            # The input has placeholder="Phone number"
            phone_selectors = [
                'input[placeholder="Phone number"]',
                'input[placeholder*="Phone"]',
                'input[placeholder*="phone"]',
                'input[placeholder*="Nomor telepon"]',
                'input[placeholder*="telepon"]',
                'input[name="mobile"]',
                'input[type="tel"]',
            ]
            
            phone_input = None
            for selector in phone_selectors:
                try:
                    locator = page.locator(selector)
                    if await locator.count() > 0:
                        phone_input = locator.first
                        logger.info(f"Found phone input with selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not phone_input:
                screenshot_path = await self._take_screenshot(page, "login_no_phone_input")
                return {"success": False, "message": f"Could not find phone input field. Screenshot: {screenshot_path}"}
            
            # Type phone number
            await human.type_in_locator(phone_input, phone)
            await asyncio.sleep(0.5)
            
            # Find password input - based on Playwright MCP analysis
            # The input has placeholder="Password" and type="password"
            password_selectors = [
                'input[placeholder="Password"]',
                'input[type="password"]',
            ]
            
            password_input = None
            for selector in password_selectors:
                try:
                    locator = page.locator(selector)
                    if await locator.count() > 0:
                        password_input = locator.first
                        logger.info(f"Found password input with selector: {selector}")
                        break
                except Exception:
                    continue
            
            if not password_input:
                screenshot_path = await self._take_screenshot(page, "login_no_password_input")
                return {"success": False, "message": f"Could not find password input. Screenshot: {screenshot_path}"}
            
            await human.type_in_locator(password_input, password)
            await asyncio.sleep(0.5)
            
            # Click login button - based on Playwright MCP analysis
            # The button has text "Log in" and is initially disabled until form is filled
            login_selectors = [
                'button:has-text("Log in")',
                'button:has-text("Masuk")',
                'button[type="submit"]',
                'button[data-e2e="login-button"]',
            ]
            
            clicked = False
            for selector in login_selectors:
                try:
                    login_button = page.locator(selector)
                    if await login_button.count() > 0:
                        btn = login_button.first
                        # Wait a moment for button to become enabled after typing
                        await asyncio.sleep(0.5)
                        if await btn.is_enabled():
                            await human.click_locator_with_delay(btn)
                            logger.info(f"Clicked login button: {selector}")
                            clicked = True
                            break
                except Exception:
                    continue
            
            if not clicked:
                screenshot_path = await self._take_screenshot(page, "login_no_submit_button")
                return {"success": False, "message": f"Could not find enabled login button. Screenshot: {screenshot_path}"}
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Phone login error: {e}")
            await self._take_screenshot(page, "phone_login_error")
            return {"success": False, "message": str(e)}
    
    async def _is_logged_in(self, page: Page) -> bool:
        """Check if currently logged in"""
        try:
            # Look for avatar/profile indicators
            indicators = [
                '[data-e2e="profile-icon"]',
                '[data-e2e="nav-profile"]',
                'div[class*="DivProfileContainer"]',
                'img[alt*="avatar"]',
            ]
            
            for selector in indicators:
                if await page.locator(selector).count() > 0:
                    return True
            
            # Check URL - if redirected to home/foryou, likely logged in
            if "/login" not in page.url and ("foryou" in page.url or page.url == f"{self.TIKTOK_URL}/"):
                # Double-check by looking for login button
                login_button = page.locator('button:has-text("Log in"), a:has-text("Log in")')
                if await login_button.count() == 0:
                    return True
            
            return False
        except Exception:
            return False
    
    async def _get_username(self, page: Page) -> Optional[str]:
        """Extract TikTok username from page"""
        try:
            # Try profile link
            profile_link = page.locator('a[href*="/@"]').first
            if await profile_link.count() > 0:
                href = await profile_link.get_attribute("href")
                if href and "/@" in href:
                    return href.split("/@")[1].split("?")[0].split("/")[0]
            
            # Try navigating to profile
            await page.goto(f"{self.TIKTOK_URL}/profile")
            await asyncio.sleep(2)
            
            # Extract from URL
            if "/@" in page.url:
                return page.url.split("/@")[1].split("?")[0].split("/")[0]
            
            return None
        except Exception:
            return None
    
    async def _check_verification(self, page: Page) -> Optional[str]:
        """Check if verification is required"""
        try:
            verification_indicators = {
                "captcha": ['iframe[src*="captcha"]', '[class*="captcha"]', '#captcha'],
                "sms_otp": ['input[placeholder*="code"]', '[data-e2e="verify-code"]'],
                "email_otp": ['[class*="email-verify"]', 'text=check your email'],
                "phone": ['[data-e2e="verify-phone"]', 'text=verify your phone'],
                "suspicious_login": ['text=unusual activity', 'text=new device'],
            }
            
            for verify_type, selectors in verification_indicators.items():
                for selector in selectors:
                    try:
                        if await page.locator(selector).count() > 0:
                            return verify_type
                    except Exception:
                        continue
            
            return None
        except Exception:
            return None
    
    async def _check_login_error(self, page: Page) -> Optional[str]:
        """Check for login error messages displayed by TikTok"""
        try:
            # Common TikTok login error messages
            error_patterns = [
                # Rate limiting - Indonesian (most common issue)
                ('Frekuensi kunjungan terlalu sering', 'RATE_LIMITED: Frekuensi kunjungan terlalu sering. Silakan tunggu beberapa menit dan coba lagi dengan akun/IP berbeda.'),
                ('frekuensi', 'RATE_LIMITED: Terlalu banyak percobaan. Coba lagi nanti.'),
                ('account-api error', 'RATE_LIMITED: TikTok API error. Coba lagi dalam beberapa menit.'),
                ('Too many attempts', 'RATE_LIMITED: Too many login attempts. Please try again later.'),
                ('rate limit', 'RATE_LIMITED: Too many requests. Please try again later.'),
                # English errors
                ('Incorrect password', 'INVALID_CREDENTIALS: Incorrect password. Please try again.'),
                ('incorrect password', 'INVALID_CREDENTIALS: Incorrect password. Please try again.'),
                ('Password incorrect', 'INVALID_CREDENTIALS: Incorrect password. Please try again.'),
                ('Wrong password', 'INVALID_CREDENTIALS: Incorrect password. Please try again.'),
                ('User not found', 'INVALID_CREDENTIALS: User not found. Check your phone number.'),
                ('user does not exist', 'INVALID_CREDENTIALS: User not found. Check your credentials.'),
                ('Account not found', 'INVALID_CREDENTIALS: Account not found. Check your credentials.'),
                ('Invalid phone', 'INVALID_CREDENTIALS: Invalid phone number format.'),
                ('temporarily locked', 'ACCOUNT_LOCKED: Account temporarily locked. Try again later.'),
                ('suspended', 'ACCOUNT_SUSPENDED: Account has been suspended.'),
                ('banned', 'ACCOUNT_BANNED: Account has been banned.'),
                # Indonesian errors
                ('Kata sandi salah', 'INVALID_CREDENTIALS: Kata sandi salah. Coba lagi.'),
                ('Pengguna tidak ditemukan', 'INVALID_CREDENTIALS: Pengguna tidak ditemukan.'),
                ('Terlalu banyak percobaan', 'RATE_LIMITED: Terlalu banyak percobaan. Coba lagi nanti.'),
            ]
            
            # Check for error status element (based on Playwright MCP analysis - June 2026)
            # TikTok uses role="status" for error messages now
            status_selectors = [
                '[role="status"]',
                'status',  # Some browsers expose this
                '[role="alert"]',
                '.tiktok-error',
                'div[class*="error"]',
                'div[class*="Error"]',
            ]
            
            for selector in status_selectors:
                try:
                    status_elem = page.locator(selector)
                    if await status_elem.count() > 0:
                        status_text = await status_elem.first.text_content()
                        if status_text:
                            logger.info(f"Found status message: {status_text}")
                            # Match against known errors
                            for pattern, message in error_patterns:
                                if pattern.lower() in status_text.lower():
                                    return message
                            # Return the raw status if it seems like an error
                            error_keywords = ['error', 'incorrect', 'wrong', 'invalid', 'failed', 'salah', 'gagal', 'frekuensi', 'sering', 'limit', 'banned', 'suspended', 'attempts remaining']
                            if any(word in status_text.lower() for word in error_keywords):
                                return f"INVALID_CREDENTIALS: {status_text}"
                except Exception:
                    continue
            
            # Check page body text for error patterns
            try:
                page_content = await page.content()
                page_text = await page.locator('body').text_content() or ""
                for pattern, message in error_patterns:
                    if pattern.lower() in page_text.lower() or pattern.lower() in page_content.lower():
                        logger.info(f"Found error pattern in page: {pattern}")
                        return message
            except Exception:
                pass
            
            # Also check for any visible error text elements
            for pattern, message in error_patterns:
                try:
                    error_locator = page.locator(f'text="{pattern}"')
                    if await error_locator.count() > 0:
                        return message
                except Exception:
                    continue
            
            return None
        except Exception as e:
            logger.warning(f"Error checking login error: {e}")
            return None
    
    async def _take_screenshot(self, page: Page, name: str) -> str:
        """Take screenshot for debugging"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{timestamp}.png"
        path = os.path.join(self.screenshot_dir, filename)
        await page.screenshot(path=path, full_page=True)
        logger.info(f"Screenshot saved: {path}")
        return path
    
    async def validate_session(
        self,
        account: TikTokAccount,
        session: TikTokSession,
        fingerprint: BrowserFingerprint
    ) -> Dict[str, Any]:
        """Validate if a session is still valid"""
        logger.info(f"Validating session for account: {account.account_name}")
        
        context = None
        context_id = None
        
        try:
            # Create context with saved cookies
            context, context_id = await browser_manager.create_context(
                fingerprint=fingerprint,
                proxy_url=account.proxy_url,
                cookies=session.cookies if isinstance(session.cookies, list) else [],
            )
            
            page = await browser_manager.get_page(context_id)
            human = HumanBehavior(page)
            
            # Navigate to TikTok
            await page.goto(self.TIKTOK_URL)
            await human.wait_for_page_idle()
            await asyncio.sleep(2)
            
            # Check if logged in
            is_valid = await self._is_logged_in(page)
            
            if is_valid:
                # Get fresh cookies
                cookies = await context.cookies()
                return {
                    "valid": True,
                    "cookies": cookies,
                }
            else:
                return {
                    "valid": False,
                    "reason": "Session expired or invalid",
                }
                
        except Exception as e:
            logger.error(f"Session validation error: {e}")
            return {
                "valid": False,
                "reason": str(e),
            }
        finally:
            if context_id:
                await browser_manager.close_context(context_id)
    
    async def upload_video(
        self,
        account: TikTokAccount,
        job: UploadJob,
        session: TikTokSession,
        fingerprint: BrowserFingerprint,
        on_progress: callable = None
    ) -> Dict[str, Any]:
        """
        Upload video to TikTok
        
        Args:
            account: TikTok account to use
            job: Upload job with video details
            session: Valid TikTok session
            fingerprint: Browser fingerprint
            on_progress: Callback for progress updates
        
        Returns:
            Dict with success status, video ID, URL, or error info
        """
        logger.info(f"Starting upload for job {job.id} to account {account.account_name}")
        
        context = None
        context_id = None
        
        try:
            # Create browser context
            context, context_id = await browser_manager.create_context(
                fingerprint=fingerprint,
                proxy_url=account.proxy_url,
                cookies=session.cookies if isinstance(session.cookies, list) else [],
            )
            
            page = await browser_manager.get_page(context_id)
            human = HumanBehavior(page)
            warmer = SessionWarmer(page)
            
            # Update progress
            if on_progress:
                await on_progress(5, "Warming up session...")
            
            # Warm up session
            warm_up_seconds = int(os.getenv("SESSION_WARM_UP_SECONDS", "45"))
            await warmer.warm_tiktok_session(warm_up_seconds)
            
            if on_progress:
                await on_progress(15, "Navigating to upload page...")
            
            # Navigate to upload page
            await page.goto(self.UPLOAD_URL)
            await human.wait_for_page_idle()
            await asyncio.sleep(2)
            
            # Check if still logged in
            if not await self._is_logged_in(page):
                return {
                    "success": False,
                    "error_code": "SESSION_EXPIRED",
                    "message": "Session expired during upload",
                }
            
            if on_progress:
                await on_progress(25, "Selecting video file...")
            
            # Upload video file
            file_input = page.locator('input[type="file"]').first
            await file_input.set_input_files(job.video_path)
            
            if on_progress:
                await on_progress(40, "Waiting for video to process...")
            
            # Wait for video to process
            await self._wait_for_video_processing(page)
            
            if on_progress:
                await on_progress(60, "Entering caption...")
            
            # Enter caption
            if job.caption:
                caption_editor = page.locator('[data-e2e="caption-editor"], div[contenteditable="true"]').first
                await caption_editor.click()
                await human.type_in_locator(caption_editor, job.caption[:2200])  # TikTok limit
            
            if on_progress:
                await on_progress(70, "Adding hashtags...")
            
            # Add hashtags
            if job.hashtags:
                hashtag_text = " ".join([f"#{tag.strip('#')}" for tag in job.hashtags[:10]])
                caption_editor = page.locator('[data-e2e="caption-editor"], div[contenteditable="true"]').first
                await caption_editor.press("End")
                await human.type_in_locator(caption_editor, f" {hashtag_text}")
            
            if on_progress:
                await on_progress(80, "Configuring privacy settings...")
            
            # Set privacy level
            if job.privacy_level != "public":
                await self._set_privacy(page, job.privacy_level)
            
            if on_progress:
                await on_progress(90, "Publishing video...")
            
            # Click publish
            await human.random_delay(1, 2)
            publish_button = page.locator('button:has-text("Post"), button[data-e2e="post-button"]').first
            await human.click_locator_with_delay(publish_button)
            
            # Wait for upload to complete
            await self._wait_for_upload_complete(page)
            
            # Check for errors
            error = await self._check_upload_error(page)
            if error:
                screenshot_path = await self._take_screenshot(page, f"upload_error_{job.id}")
                return {
                    "success": False,
                    "error_code": "UPLOAD_FAILED",
                    "message": error,
                    "screenshot_path": screenshot_path,
                }
            
            # Extract video ID and URL
            video_id, video_url = await self._extract_video_info(page, account.tiktok_username)
            
            if on_progress:
                await on_progress(100, "Upload complete!")
            
            logger.info(f"Upload successful: {video_url}")
            
            return {
                "success": True,
                "tiktok_video_id": video_id,
                "tiktok_url": video_url,
            }
            
        except PlaywrightTimeout as e:
            logger.error(f"Upload timeout: {e}")
            return {
                "success": False,
                "error_code": "TIMEOUT",
                "message": f"Upload timeout: {str(e)}",
            }
        except Exception as e:
            logger.error(f"Upload error: {e}", exc_info=True)
            return {
                "success": False,
                "error_code": "UPLOAD_ERROR",
                "message": str(e),
            }
        finally:
            if context_id:
                await browser_manager.close_context(context_id)
    
    async def _wait_for_video_processing(self, page: Page, timeout: int = 120):
        """Wait for video to finish processing on TikTok"""
        logger.info("Waiting for video processing...")
        
        # Wait for processing indicators to appear and then disappear
        processing_selectors = [
            '[data-e2e="uploading"]',
            'text=Uploading',
            'text=Processing',
            '.upload-progress',
        ]
        
        # Wait for upload to start
        await asyncio.sleep(3)
        
        # Wait for processing to complete
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout:
            is_processing = False
            for selector in processing_selectors:
                try:
                    if await page.locator(selector).count() > 0:
                        is_processing = True
                        break
                except Exception:
                    continue
            
            if not is_processing:
                # Check if ready to post
                try:
                    post_button = page.locator('button:has-text("Post"), button[data-e2e="post-button"]')
                    if await post_button.is_enabled():
                        logger.info("Video processing complete")
                        return
                except Exception:
                    pass
            
            await asyncio.sleep(2)
        
        raise TimeoutError("Video processing timeout")
    
    async def _wait_for_upload_complete(self, page: Page, timeout: int = 60):
        """Wait for upload to complete after clicking publish"""
        logger.info("Waiting for upload to complete...")
        
        success_selectors = [
            'text=posted',
            'text=Published',
            '[data-e2e="upload-success"]',
        ]
        
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout:
            for selector in success_selectors:
                try:
                    if await page.locator(selector).count() > 0:
                        logger.info("Upload confirmed complete")
                        return
                except Exception:
                    continue
            
            await asyncio.sleep(2)
        
        # If no success message but no error either, consider it done
        logger.warning("No explicit success message, assuming upload complete")
    
    async def _check_upload_error(self, page: Page) -> Optional[str]:
        """Check for upload errors"""
        error_selectors = [
            '[data-e2e="upload-error"]',
            '.error-message',
            'text=failed',
            'text=Error',
        ]
        
        for selector in error_selectors:
            try:
                error_el = page.locator(selector)
                if await error_el.count() > 0:
                    return await error_el.first.text_content()
            except Exception:
                continue
        
        return None
    
    async def _extract_video_info(self, page: Page, username: str) -> tuple:
        """Extract video ID and URL after upload"""
        try:
            # Try to find the video link
            video_link = page.locator(f'a[href*="/@{username}/video/"]').first
            if await video_link.count() > 0:
                href = await video_link.get_attribute("href")
                video_id = href.split("/video/")[1].split("?")[0]
                video_url = f"https://www.tiktok.com/@{username}/video/{video_id}"
                return video_id, video_url
            
            # Alternative: check page URL
            if "/video/" in page.url:
                video_id = page.url.split("/video/")[1].split("?")[0]
                video_url = page.url.split("?")[0]
                return video_id, video_url
            
            # Generate placeholder
            video_id = f"pending_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            video_url = f"https://www.tiktok.com/@{username}"
            return video_id, video_url
            
        except Exception as e:
            logger.warning(f"Could not extract video info: {e}")
            return "unknown", f"https://www.tiktok.com/@{username}"
    
    async def _set_privacy(self, page: Page, privacy_level: str):
        """Set video privacy level"""
        try:
            # Click privacy dropdown
            privacy_selector = page.locator('[data-e2e="who-can-watch"]')
            if await privacy_selector.count() > 0:
                await privacy_selector.click()
                await asyncio.sleep(0.5)
                
                # Select privacy option
                option_map = {
                    "friends": 'text=Friends',
                    "private": 'text=Only me',
                }
                
                option = option_map.get(privacy_level)
                if option:
                    await page.locator(option).click()
                    await asyncio.sleep(0.5)
        except Exception as e:
            logger.warning(f"Could not set privacy level: {e}")


# Singleton instance
tiktok_automation = TikTokAutomation()
