"""
YouTube Automation Service
Handles login, session validation, and Shorts upload
Level 1 - Easiest Platform

Uses PERSISTENT browser profiles to avoid Google login issues.
Each account gets its own user data directory that persists across sessions.
"""
import asyncio
import os
import logging
import shutil
import subprocess
import platform
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from playwright.async_api import async_playwright, Page, BrowserContext, Browser, TimeoutError as PlaywrightTimeout

from ..domain.entities import SocialAccount, SocialSession, SocialUploadJob, BrowserFingerprint
from .browser_manager import browser_manager
from .human_behavior import HumanBehavior

logger = logging.getLogger(__name__)


def kill_chrome_processes():
    """
    Force kill all Google Chrome processes to free up the profile.
    This is needed because Playwright can't access a profile that's in use.
    """
    system = platform.system()
    
    try:
        if system == "Darwin":  # macOS
            # Kill Chrome gracefully first
            subprocess.run(["osascript", "-e", 'quit app "Google Chrome"'], 
                         capture_output=True, timeout=5)
            asyncio.get_event_loop().run_until_complete(asyncio.sleep(2))
            
            # Force kill if still running
            result = subprocess.run(["pgrep", "-f", "Google Chrome"], capture_output=True)
            if result.returncode == 0:
                subprocess.run(["pkill", "-9", "-f", "Google Chrome"], capture_output=True)
                logger.info("Force killed Google Chrome processes")
            
        elif system == "Linux":
            subprocess.run(["pkill", "-9", "chrome"], capture_output=True)
            subprocess.run(["pkill", "-9", "google-chrome"], capture_output=True)
            logger.info("Killed Chrome processes on Linux")
            
        elif system == "Windows":
            subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], 
                         capture_output=True, shell=True)
            logger.info("Killed Chrome processes on Windows")
        
        # Wait for processes to fully terminate
        import time
        time.sleep(2)
        
    except Exception as e:
        logger.warning(f"Error killing Chrome: {e}")


async def kill_chrome_async():
    """Async version of kill_chrome_processes"""
    system = platform.system()
    
    try:
        if system == "Darwin":  # macOS
            # Try graceful quit first
            proc = await asyncio.create_subprocess_exec(
                "osascript", "-e", 'quit app "Google Chrome"',
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await asyncio.wait_for(proc.wait(), timeout=5)
            await asyncio.sleep(2)
            
            # Check if still running and force kill
            check = await asyncio.create_subprocess_exec(
                "pgrep", "-f", "Google Chrome",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL
            )
            stdout, _ = await check.communicate()
            
            if stdout:
                kill = await asyncio.create_subprocess_exec(
                    "pkill", "-9", "-f", "Google Chrome",
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL
                )
                await kill.wait()
                logger.info("Force killed Google Chrome processes")
            
        elif system == "Linux":
            for name in ["chrome", "google-chrome"]:
                proc = await asyncio.create_subprocess_exec(
                    "pkill", "-9", name,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL
                )
                await proc.wait()
            logger.info("Killed Chrome processes on Linux")
            
        elif system == "Windows":
            proc = await asyncio.create_subprocess_shell(
                "taskkill /F /IM chrome.exe",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await proc.wait()
            logger.info("Killed Chrome processes on Windows")
        
        # Wait for processes to fully terminate
        await asyncio.sleep(2)
        logger.info("Chrome processes terminated")
        
    except asyncio.TimeoutError:
        logger.warning("Timeout while trying to quit Chrome gracefully, force killing...")
        if system == "Darwin":
            proc = await asyncio.create_subprocess_exec(
                "pkill", "-9", "-f", "Google Chrome",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await proc.wait()
    except Exception as e:
        logger.warning(f"Error killing Chrome: {e}")


class YouTubeAutomation:
    """YouTube browser automation for Shorts upload using persistent browser profiles"""
    
    YOUTUBE_URL = "https://www.youtube.com"
    STUDIO_URL = "https://studio.youtube.com"
    LOGIN_URL = "https://accounts.google.com/signin"
    UPLOAD_URL = "https://www.youtube.com/upload"
    
    def __init__(self):
        self.screenshot_dir = os.getenv("SCREENSHOT_DIR", "./tmp/screenshots")
        self.user_data_base = os.getenv("YOUTUBE_USER_DATA_DIR", "./tmp/youtube_profiles")
        os.makedirs(self.screenshot_dir, exist_ok=True)
        os.makedirs(self.user_data_base, exist_ok=True)
        self._manual_login_contexts: Dict[str, Any] = {}
        self._playwright = None
        self._persistent_contexts: Dict[int, BrowserContext] = {}
    
    def _get_user_data_dir(self, account_id: int) -> str:
        """Get persistent user data directory for an account"""
        return os.path.join(self.user_data_base, f"account_{account_id}")
    
    async def _get_playwright(self):
        """Get or create playwright instance"""
        if self._playwright is None:
            self._playwright = await async_playwright().start()
        return self._playwright
    
    async def _create_persistent_context(
        self,
        account_id: int,
        fingerprint: BrowserFingerprint,
        headless: bool = False,
        use_system_chrome: bool = True,
    ) -> BrowserContext:
        """
        Create a persistent browser context with user data directory.
        This preserves Google login across sessions.
        
        Args:
            account_id: Account ID for profile directory
            fingerprint: Browser fingerprint settings
            headless: Run without visible window
            use_system_chrome: Use installed Google Chrome instead of Chromium
        """
        playwright = await self._get_playwright()
        
        # Determine which user data directory to use
        use_default_profile = os.getenv("USE_CHROME_DEFAULT_PROFILE", "false").lower() == "true"
        
        if use_default_profile:
            # Use the main Chrome profile (already logged in to Google)
            # macOS default Chrome profile location
            user_data_dir = os.path.expanduser("~/Library/Application Support/Google/Chrome")
            logger.info(f"Using default Chrome profile at: {user_data_dir}")
            
            # IMPORTANT: Kill Chrome before accessing its profile
            logger.info("Closing Google Chrome to access profile...")
            await kill_chrome_async()
        else:
            # Use separate profile per account
            user_data_dir = self._get_user_data_dir(account_id)
            os.makedirs(user_data_dir, exist_ok=True)
        
        # Find Google Chrome executable path
        chrome_paths = [
            # macOS
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            # Linux
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            # Windows
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ]
        
        chrome_executable = None
        if use_system_chrome:
            for path in chrome_paths:
                if os.path.exists(path):
                    chrome_executable = path
                    logger.info(f"Found Google Chrome at: {chrome_executable}")
                    break
        
        # Browser args for anti-detection
        browser_args = [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process,AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-service-autorun',
            '--password-store=basic',
            '--disable-default-apps',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-popup-blocking',
            '--ignore-certificate-errors',
            '--lang=id-ID',
            '--accept-lang=id-ID,id,en-US,en',
        ]
        
        if not headless:
            browser_args.extend([
                '--start-maximized',
                '--enable-gpu-rasterization',
            ])
        else:
            browser_args.extend([
                '--headless=new',
                '--disable-gpu',
            ])
        
        # If using default Chrome profile, use specific profile directory
        if use_default_profile:
            browser_args.append('--profile-directory=Default')
        
        # Create persistent context with system Chrome or Chromium
        context = await playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=headless,
            slow_mo=100,
            args=browser_args,
            channel="chrome" if use_system_chrome and chrome_executable else None,
            executable_path=chrome_executable if use_system_chrome and chrome_executable else None,
            viewport={"width": fingerprint.viewport_width, "height": fingerprint.viewport_height},
            user_agent=fingerprint.user_agent,
            locale=fingerprint.locale,
            timezone_id=fingerprint.timezone,
            color_scheme="light",
            ignore_https_errors=True,
            accept_downloads=True,
            geolocation={"latitude": -6.2088, "longitude": 106.8456},
            permissions=["geolocation"],
        )
        
        # Inject stealth scripts
        await self._inject_stealth_scripts(context, fingerprint)
        
        browser_type = "Google Chrome" if chrome_executable else "Chromium"
        profile_type = "default Chrome profile" if use_default_profile else f"account_{account_id}"
        logger.info(f"Created {browser_type} context with {profile_type}")
        return context
    
    async def _inject_stealth_scripts(self, context: BrowserContext, fingerprint: BrowserFingerprint):
        """Inject stealth scripts to avoid detection"""
        stealth_script = """
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
        });
        delete Object.getPrototypeOf(navigator).webdriver;
        
        // Chrome plugins mock
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                const plugins = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' }
                ];
                plugins.length = 3;
                return plugins;
            },
            configurable: true
        });
        
        // Hide chrome automation
        window.chrome = {
            app: { isInstalled: false },
            runtime: { connect: () => ({}), sendMessage: () => {} }
        };
        
        // Override permission query
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (params) => {
            if (params.name === 'notifications') {
                return Promise.resolve({ state: 'prompt', onchange: null });
            }
            return originalQuery.call(navigator.permissions, params);
        };
        """
        await context.add_init_script(stealth_script)
    
    async def close_persistent_context(self, account_id: int):
        """Close a persistent context for an account"""
        if account_id in self._persistent_contexts:
            try:
                await self._persistent_contexts[account_id].close()
            except:
                pass
            del self._persistent_contexts[account_id]
    
    async def check_session_status(self, account_id: int, fingerprint: BrowserFingerprint) -> Dict[str, Any]:
        """
        Check if a persistent session exists and is logged in.
        Returns session status without opening visible browser.
        """
        user_data_dir = self._get_user_data_dir(account_id)
        
        # Check if profile directory exists
        if not os.path.exists(user_data_dir):
            return {
                "has_profile": False,
                "logged_in": False,
                "message": "No browser profile found. Please setup the account first."
            }
        
        # Try to check login status using headless browser
        context = None
        try:
            context = await self._create_persistent_context(account_id, fingerprint, headless=True)
            page = context.pages[0] if context.pages else await context.new_page()
            
            await page.goto(self.YOUTUBE_URL, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            logged_in = await self._is_logged_in(page)
            channel_name = await self._get_channel_name(page) if logged_in else None
            
            return {
                "has_profile": True,
                "logged_in": logged_in,
                "channel_name": channel_name,
                "message": "Session is active" if logged_in else "Session expired. Please login again."
            }
        except Exception as e:
            logger.error(f"Error checking session: {e}")
            return {
                "has_profile": True,
                "logged_in": False,
                "message": f"Error checking session: {str(e)}"
            }
        finally:
            if context:
                await context.close()

    async def setup_account(
        self,
        account_id: int,
        fingerprint: BrowserFingerprint,
        timeout: int = 300,
    ) -> Dict[str, Any]:
        """
        Open browser for user to login to Google/YouTube manually.
        The session is saved in a persistent profile for future use.
        
        This only needs to be done ONCE per account.
        """
        logger.info(f"Opening browser for YouTube account setup (account_id: {account_id})")
        
        context = None
        
        try:
            # Create VISIBLE persistent context for manual login
            context = await self._create_persistent_context(
                account_id=account_id,
                fingerprint=fingerprint,
                headless=False,  # User needs to see browser to login
            )
            
            page = context.pages[0] if context.pages else await context.new_page()
            human = HumanBehavior(page)
            
            # Navigate to YouTube
            await page.goto(self.YOUTUBE_URL)
            await human.wait_for_page_idle()
            
            logger.info(f"Browser opened at {self.YOUTUBE_URL}. Waiting for user to login...")
            logger.info(f"User has {timeout} seconds to complete login manually.")
            
            start_time = asyncio.get_event_loop().time()
            check_interval = 3
            
            while asyncio.get_event_loop().time() - start_time < timeout:
                if await self._is_logged_in(page):
                    logger.info("Manual login detected! Session saved to profile.")
                    
                    channel_name = await self._get_channel_name(page)
                    
                    logger.info(f"Setup complete! Channel: {channel_name}")
                    
                    # Session is automatically saved in user_data_dir
                    return {
                        "success": True,
                        "platform_username": channel_name,
                        "fingerprint_id": fingerprint.id,
                        "login_method": "persistent_profile",
                        "message": "Account setup successful. You can now upload videos."
                    }
                
                await asyncio.sleep(check_interval)
            
            screenshot_path = await self._take_screenshot(page, f"yt_setup_timeout_{account_id}")
            return {
                "success": False,
                "message": f"Setup timeout ({timeout}s). Please try again.",
                "screenshot_path": screenshot_path,
                "error_code": "SETUP_TIMEOUT",
            }
            
        except Exception as e:
            logger.error(f"Account setup error: {e}", exc_info=True)
            return {
                "success": False,
                "message": str(e),
                "error_code": "SETUP_ERROR",
            }
        finally:
            if context:
                await context.close()

    async def manual_login(
        self,
        account_id: int,
        fingerprint: BrowserFingerprint,
        timeout: int = 300,
    ) -> Dict[str, Any]:
        """
        Alias for setup_account for backward compatibility.
        Open browser for manual Google/YouTube login.
        """
        return await self.setup_account(account_id, fingerprint, timeout)


    async def login(
        self, 
        account: SocialAccount, 
        fingerprint: BrowserFingerprint,
        existing_session: SocialSession = None,
        wait_for_verification: bool = True,
        verification_timeout: int = 180
    ) -> Dict[str, Any]:
        """
        Login to YouTube/Google account using persistent browser profile.
        
        For YouTube, we always use persistent profiles because:
        1. Google blocks Playwright automation for login
        2. Persistent profiles keep session across restarts
        3. User only needs to login ONCE
        """
        logger.info(f"Starting YouTube login for account: {account.account_name}")
        
        # Check if already logged in via persistent profile
        status = await self.check_session_status(account.id, fingerprint)
        
        if status.get("logged_in"):
            logger.info(f"Already logged in as: {status.get('channel_name')}")
            return {
                "success": True,
                "session_restored": True,
                "platform_username": status.get("channel_name"),
                "login_method": "persistent_profile",
            }
        
        # Need to setup account (manual login)
        return await self.setup_account(account.id, fingerprint, verification_timeout)


    async def validate_session(
        self,
        account: SocialAccount,
        session: SocialSession,
        fingerprint: BrowserFingerprint
    ) -> Dict[str, Any]:
        """Validate YouTube session is still active using persistent profile"""
        logger.info(f"Validating YouTube session for: {account.account_name}")
        
        status = await self.check_session_status(account.id, fingerprint)
        
        if status.get("logged_in"):
            return {
                "valid": True,
                "platform_username": status.get("channel_name"),
            }
        
        return {
            "valid": False,
            "reason": status.get("message", "Session expired or invalid"),
        }


    async def upload_video(
        self,
        account: SocialAccount,
        job: SocialUploadJob,
        session: SocialSession,
        fingerprint: BrowserFingerprint,
        on_progress: callable = None,
    ) -> Dict[str, Any]:
        """
        Upload video as YouTube Short using persistent browser profile.
        Uses YouTube Studio for upload.
        
        The persistent profile preserves Google login, so no manual login needed
        after initial setup.
        """
        logger.info(f"Starting YouTube Shorts upload for job {job.id}")
        
        if not os.path.exists(job.video_path):
            return {
                "success": False,
                "message": f"Video file not found: {job.video_path}",
                "error_code": "FILE_NOT_FOUND",
            }
        
        # Check if profile exists
        user_data_dir = self._get_user_data_dir(account.id)
        if not os.path.exists(user_data_dir):
            return {
                "success": False,
                "message": "Account not setup. Please run 'Setup Account' first to login to Google.",
                "error_code": "ACCOUNT_NOT_SETUP",
            }
        
        context = None
        
        try:
            if on_progress:
                await on_progress(5, "Opening browser...")
            
            # Use persistent context - this preserves Google login!
            # Run headless for actual uploads (no need for user to see)
            context = await self._create_persistent_context(
                account_id=account.id,
                fingerprint=fingerprint,
                headless=True,  # Headless for automated upload
            )
            
            page = context.pages[0] if context.pages else await context.new_page()
            human = HumanBehavior(page)
            
            if on_progress:
                await on_progress(10, "Opening YouTube Studio...")
            
            # Go to YouTube Studio
            await page.goto(self.STUDIO_URL, wait_until="domcontentloaded", timeout=60000)
            await human.wait_for_page_idle()
            await asyncio.sleep(5)  # Wait longer for Studio to fully load
            
            # Check if logged in
            if not await self._is_logged_in_studio(page):
                # Session expired - need to re-setup
                screenshot_path = await self._take_screenshot(page, f"yt_session_expired_{job.id}")
                return {
                    "success": False,
                    "message": "Google session expired. Please run 'Setup Account' again to re-login.",
                    "screenshot_path": screenshot_path,
                    "error_code": "SESSION_EXPIRED",
                }
            
            # Wait for the CREATE button to appear (it loads dynamically)
            await asyncio.sleep(3)
            
            if on_progress:
                await on_progress(15, "Clicking upload button...")
            
            # Click create/upload button
            upload_clicked = await self._click_upload_button(page, human)
            if not upload_clicked:
                screenshot_path = await self._take_screenshot(page, f"yt_no_upload_{job.id}")
                return {
                    "success": False,
                    "message": "Could not find upload button",
                    "screenshot_path": screenshot_path,
                    "error_code": "UPLOAD_BUTTON_NOT_FOUND",
                }
            
            await asyncio.sleep(2)
            
            if on_progress:
                await on_progress(20, "Selecting video file...")
            
            # Upload file
            file_input = page.locator('input[type="file"]')
            await file_input.set_input_files(job.video_path)
            
            if on_progress:
                await on_progress(30, "Video uploading...")
            
            # Wait for upload dialog
            await asyncio.sleep(3)
            
            # Fill in details
            if on_progress:
                await on_progress(40, "Filling video details...")
            
            await self._fill_video_details(page, human, job)
            
            if on_progress:
                await on_progress(50, "Waiting for video processing...")
            
            # Wait for video to process
            await self._wait_for_processing(page, on_progress)
            
            if on_progress:
                await on_progress(70, "Setting visibility...")
            
            # Go through the steps
            await self._complete_upload_steps(page, human, job)
            
            if on_progress:
                await on_progress(90, "Publishing...")
            
            # Get video URL
            video_url = await self._get_published_url(page)
            video_id = self._extract_video_id(video_url) if video_url else None
            
            if on_progress:
                await on_progress(100, "Upload complete!")
            
            logger.info(f"YouTube upload successful: {video_url}")
            
            return {
                "success": True,
                "platform_video_id": video_id,
                "platform_url": video_url,
            }
            
        except PlaywrightTimeout as e:
            logger.error(f"Timeout during upload: {e}")
            if context:
                page = context.pages[0] if context.pages else None
                if page:
                    await self._take_screenshot(page, f"yt_upload_timeout_{job.id}")
            return {
                "success": False,
                "message": f"Timeout: {str(e)}",
                "error_code": "TIMEOUT",
            }
        except Exception as e:
            logger.error(f"Upload error: {e}", exc_info=True)
            if context:
                try:
                    page = context.pages[0] if context.pages else None
                    if page:
                        await self._take_screenshot(page, f"yt_upload_error_{job.id}")
                except:
                    pass
            return {
                "success": False,
                "message": str(e),
                "error_code": "UPLOAD_ERROR",
            }
        finally:
            if context:
                await context.close()
    
    async def _wait_for_processing(self, page: Page, on_progress: callable = None):
        """Wait for YouTube to process the video"""
        max_wait = 600  # 10 minutes max
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < max_wait:
            # Check for processing indicators
            processing_text = page.locator('text=/Processing|Uploading|Checking/i')
            if await processing_text.count() == 0:
                # No processing indicator = done
                break
            
            # Check for completion indicators
            checks_complete = page.locator('text=/Checks complete|No issues found/i')
            if await checks_complete.count() > 0:
                break
            
            await asyncio.sleep(5)
            
            # Update progress
            elapsed = asyncio.get_event_loop().time() - start_time
            progress_pct = min(65, 50 + int(elapsed / max_wait * 20))
            if on_progress:
                await on_progress(progress_pct, "Processing video...")
        
        await asyncio.sleep(2)  # Extra wait after processing


    async def _is_logged_in(self, page: Page) -> bool:
        """Check if logged in to YouTube"""
        try:
            # First check if there's a sign-in button (means NOT logged in)
            signin_selectors = [
                'a[href*="accounts.google.com/ServiceLogin"]',
                'a.yt-spec-button-shape-next[href*="accounts.google.com"]',
                'ytd-button-renderer a[href*="accounts.google.com"]',
                'tp-yt-paper-button[aria-label="Sign in"]',
            ]
            
            for selector in signin_selectors:
                signin = page.locator(selector)
                if await signin.count() > 0:
                    logger.debug(f"Sign-in button found: {selector} - user NOT logged in")
                    return False
            
            # Check for actual avatar button with user image (not the generic menu)
            # The avatar button in signed-in state has an actual image
            avatar_img = page.locator('#avatar-btn img, button#avatar-btn yt-img-shadow img')
            if await avatar_img.count() > 0:
                # Verify it has a src attribute (real avatar, not placeholder)
                src = await avatar_img.first.get_attribute('src')
                if src and 'ggpht.com' in src:
                    logger.info("User avatar found - logged in!")
                    return True
            
            # Also check for channel switcher which only appears when logged in
            channel_name = page.locator('yt-formatted-string#channel-name')
            if await channel_name.count() > 0:
                logger.info("Channel name found - logged in!")
                return True
            
            # Check cookies for Google auth indicators
            cookies = await page.context.cookies()
            google_auth_cookies = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-3PSID']
            has_auth_cookies = any(
                cookie.get('name') in google_auth_cookies 
                for cookie in cookies
            )
            
            if has_auth_cookies:
                logger.info("Google auth cookies found - logged in!")
                return True
            
            logger.debug("No login indicators found")
            return False
        except Exception as e:
            logger.error(f"is_logged_in check error: {e}")
            return False
    
    async def _is_logged_in_studio(self, page: Page) -> bool:
        """Check if logged in to YouTube Studio"""
        try:
            # YouTube Studio requires login - check for studio-specific elements
            # The create/upload button only appears when logged in
            studio_indicators = [
                'ytcp-button#create-icon',  # Create button
                '#upload-icon',  # Upload icon
                'ytcp-uploads-dialog',  # Upload dialog
                'iron-icon#upload-icon',  # Upload icon variant
            ]
            
            for selector in studio_indicators:
                if await page.locator(selector).count() > 0:
                    logger.info(f"Studio indicator found: {selector} - logged in!")
                    return True
            
            # Check for avatar in studio
            avatar = page.locator('#avatar-btn')
            if await avatar.count() > 0:
                # Verify it has an actual avatar image
                img = page.locator('#avatar-btn img')
                if await img.count() > 0:
                    src = await img.first.get_attribute('src')
                    if src and 'ggpht.com' in src:
                        logger.info("Studio avatar found - logged in!")
                        return True
            
            # Check cookies for Google auth indicators
            cookies = await page.context.cookies()
            google_auth_cookies = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-3PSID']
            has_auth_cookies = any(
                cookie.get('name') in google_auth_cookies 
                for cookie in cookies
            )
            
            if has_auth_cookies:
                logger.info("Google auth cookies found - logged in!")
                return True
            
            # Check for "Choose an account" or sign-in prompts (means NOT logged in)
            signin_prompts = [
                'text="Choose an account"',
                'text="Sign in"',
                '[data-identifier]',  # Account picker
            ]
            
            for selector in signin_prompts:
                if await page.locator(selector).count() > 0:
                    logger.debug(f"Sign-in prompt found: {selector} - NOT logged in")
                    return False
            
            logger.debug("No studio login indicators found")
            return False
        except Exception as e:
            logger.error(f"is_logged_in_studio check error: {e}")
            return False
    
    async def _get_channel_name(self, page: Page) -> Optional[str]:
        """Get YouTube channel name"""
        try:
            # Click avatar to see channel name
            avatar = page.locator('#avatar-btn').first
            if await avatar.count() > 0:
                await avatar.click()
                await asyncio.sleep(1)
                
                # Look for channel name in dropdown
                channel_name = page.locator('yt-formatted-string#channel-name').first
                if await channel_name.count() > 0:
                    name = await channel_name.inner_text()
                    # Close dropdown
                    await page.keyboard.press('Escape')
                    return name.strip()
                
                await page.keyboard.press('Escape')
            
            return None
        except Exception:
            return None


    async def _click_upload_button(self, page: Page, human: HumanBehavior) -> bool:
        """Click the upload/create button in YouTube Studio"""
        try:
            # Wait a bit for page to fully load
            await asyncio.sleep(3)
            
            # Take debug screenshot before trying
            await self._take_screenshot(page, "yt_before_click_upload")
            
            # FIRST: Dismiss any feature discovery callouts/tooltips that might block clicks
            try:
                # Try to close any overlay/callout by clicking dismiss or pressing Escape
                dismiss_selectors = [
                    'ytcp-feature-discovery-callout button',
                    'ytcp-feature-discovery-callout [aria-label="Close"]',
                    'ytcp-feature-discovery-callout [aria-label="Dismiss"]',
                    '.ytcp-feature-discovery-callout button',
                    'button[aria-label="Got it"]',
                    'button[aria-label="Mengerti"]',
                    '#dismiss-button',
                ]
                
                for sel in dismiss_selectors:
                    dismiss_btn = page.locator(sel)
                    if await dismiss_btn.count() > 0:
                        logger.info(f"Found dismiss button: {sel}, clicking...")
                        await dismiss_btn.first.click(force=True)
                        await asyncio.sleep(1)
                        break
                
                # Also try pressing Escape to close any popups
                await page.keyboard.press('Escape')
                await asyncio.sleep(0.5)
                await page.keyboard.press('Escape')
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.debug(f"No callout to dismiss: {e}")
            
            # YouTube Studio CREATE button selectors (updated for 2024/2025/2026)
            # The button is typically in the top navigation
            create_selectors = [
                # Modern YouTube Studio selectors
                'ytcp-button#create-icon',
                '#create-icon',
                '[id="create-icon"]',
                'ytcp-icon-button#create-icon',
                
                # Button with icon
                'button:has(iron-icon#upload-icon)',
                'ytcp-button:has(#upload-icon)',
                '#upload-icon',
                'iron-icon#upload-icon',
                
                # Aria labels (English & Indonesian)
                'button[aria-label="Create"]',
                'button[aria-label="Buat"]',
                'button[aria-label="Upload videos"]',
                'button[aria-label="Upload video"]',
                'button[aria-label="Unggah video"]',
                
                # New button styles
                '.ytcp-button-shape-default-overlay',
                'ytcp-button[icon="yt-icons:file-upload"]',
                
                # Try the navigation area
                '#navigation-drawer ytcp-button',
                'ytcp-app-bar ytcp-button',
            ]
            
            for selector in create_selectors:
                btn = page.locator(selector)
                count = await btn.count()
                if count > 0:
                    logger.info(f"Found create button with selector '{selector}': count={count}")
                    
                    # Use force=True to click even if element is obscured
                    try:
                        await btn.first.click(force=True, timeout=5000)
                    except Exception as click_err:
                        logger.warning(f"Normal click failed, trying JS click: {click_err}")
                        # Fallback to JavaScript click
                        await page.evaluate('''(selector) => {
                            const el = document.querySelector(selector);
                            if (el) el.click();
                        }''', selector)
                    
                    await asyncio.sleep(2)
                    
                    # Wait for dropdown menu to appear
                    await asyncio.sleep(1)
                    
                    # Click "Upload videos" in dropdown - multiple selectors
                    upload_options = [
                        'tp-yt-paper-item:has-text("Upload videos")',
                        'tp-yt-paper-item:has-text("Upload video")',
                        'tp-yt-paper-item:has-text("Unggah video")',
                        '#text-item-0',
                        'tp-yt-paper-item#text-item-0',
                        'ytcp-text-menu tp-yt-paper-item:first-child',
                        '[test-id="upload-videos-button"]',
                        'tp-yt-paper-listbox tp-yt-paper-item:first-child',
                        'ytcp-text-dropdown-trigger:has-text("Upload")',
                    ]
                    
                    for upload_sel in upload_options:
                        upload_opt = page.locator(upload_sel)
                        ucount = await upload_opt.count()
                        if ucount > 0:
                            logger.info(f"Found upload option '{upload_sel}': count={ucount}")
                            try:
                                await upload_opt.first.click(force=True, timeout=5000)
                            except:
                                await page.evaluate('''(selector) => {
                                    const el = document.querySelector(selector);
                                    if (el) el.click();
                                }''', upload_sel.split(':has-text')[0] if ':has-text' in upload_sel else upload_sel)
                            logger.info("Clicked upload option successfully")
                            return True
                    
                    # If no dropdown appeared, maybe direct upload was triggered
                    file_input = page.locator('input[type="file"]')
                    if await file_input.count() > 0:
                        logger.info("File input found directly after clicking create")
                        return True
            
            # If no selector worked, try keyboard shortcut (Ctrl+U or Cmd+U for upload)
            logger.info("Trying keyboard shortcut for upload...")
            await page.keyboard.press('Control+u')
            await asyncio.sleep(2)
            file_input = page.locator('input[type="file"]')
            if await file_input.count() > 0:
                logger.info("File input appeared after keyboard shortcut")
                return True
            
            # Try clicking directly on the page to find any upload related element
            all_buttons = page.locator('ytcp-button, button')
            btn_count = await all_buttons.count()
            logger.info(f"Total buttons found on page: {btn_count}")
            
            # Log all button aria-labels for debugging
            for i in range(min(btn_count, 20)):  # Check first 20 buttons
                try:
                    label = await all_buttons.nth(i).get_attribute('aria-label')
                    text = await all_buttons.nth(i).inner_text()
                    if label or text:
                        logger.info(f"Button {i}: aria-label='{label}', text='{text[:50] if text else ''}'")
                except:
                    pass
            
            logger.warning("Could not find create/upload button")
            return False
        except Exception as e:
            logger.error(f"Click upload error: {e}")
            return False
    
    async def _fill_video_details(self, page: Page, human: HumanBehavior, 
                                   job: SocialUploadJob) -> None:
        """
        Fill in video title and description.
        
        YouTube Shorts format:
        - Title: The hook/caption (catchy one-liner)
        - Description: Original video title + hashtags
        """
        try:
            # Wait for dialog
            await page.wait_for_selector('#textbox', timeout=30000)
            
            # Title input (first textbox)
            # Use caption as title (the hook) - this is the catchy headline
            title_box = page.locator('#textbox').first
            if await title_box.count() > 0:
                await title_box.click()
                await page.keyboard.press('Control+A')
                
                # Title = Hook/Caption (the catchy one-liner)
                title = job.caption or job.title or f"Short #{job.clip_index or 1}"
                # Truncate to 100 chars for YouTube title limit
                if len(title) > 100:
                    title = title[:97] + "..."
                
                await human.type_in_locator(title_box, title)
                logger.info(f"Set video title: {title}")
            
            await asyncio.sleep(0.5)
            
            # Description (second textbox)
            # Description = Original title + hashtags
            desc_boxes = page.locator('#textbox')
            if await desc_boxes.count() > 1:
                desc_box = desc_boxes.nth(1)
                await desc_box.click()
                
                # Build description with original title and hashtags
                description_parts = []
                
                # Add original video title if available (from video_path folder name)
                if job.video_path:
                    import os
                    folder_name = os.path.basename(os.path.dirname(job.video_path))
                    # Clean up folder name (replace underscores with spaces)
                    original_title = folder_name.replace('_', ' ')
                    if original_title and original_title != 'output':
                        description_parts.append(original_title)
                
                # Add the hook/caption if different from title
                if job.title and job.title != job.caption:
                    description_parts.append(job.title)
                
                # Add hashtags
                if job.hashtags:
                    tags = ' '.join([f'#{t.lstrip("#")}' for t in job.hashtags])
                    description_parts.append(tags)
                
                description = '\n\n'.join(description_parts)
                
                if description:
                    await human.type_in_locator(desc_box, description)
                    logger.info(f"Set video description: {description[:100]}...")
            
        except Exception as e:
            logger.error(f"Fill details error: {e}")


    async def _complete_upload_steps(self, page: Page, human: HumanBehavior,
                                      job: SocialUploadJob) -> None:
        """Complete upload wizard steps"""
        try:
            # Made for kids selection
            if job.made_for_kids:
                kids_yes = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_MFK"]')
            else:
                kids_yes = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]')
            
            if await kids_yes.count() > 0:
                await human.click_locator_with_delay(kids_yes.first)
            
            await asyncio.sleep(1)
            
            # Click NEXT buttons to go through steps
            for _ in range(3):  # Details -> Monetization -> Visibility
                next_btn = page.locator('#next-button, button:has-text("Next")')
                if await next_btn.count() > 0:
                    await human.click_locator_with_delay(next_btn.first)
                    await asyncio.sleep(2)
            
            # Set visibility
            visibility_map = {
                'public': 'PUBLIC',
                'unlisted': 'UNLISTED',
                'private': 'PRIVATE',
            }
            
            visibility = visibility_map.get(job.privacy_level, 'PUBLIC')
            visibility_radio = page.locator(f'tp-yt-paper-radio-button[name="{visibility}"]')
            if await visibility_radio.count() > 0:
                await human.click_locator_with_delay(visibility_radio.first)
            
            await asyncio.sleep(1)
            
            # Click Publish/Save
            publish_btn = page.locator('#done-button, button:has-text("Publish"), button:has-text("Save")')
            if await publish_btn.count() > 0:
                await human.click_locator_with_delay(publish_btn.first)
            
            # Wait for publish to complete
            await asyncio.sleep(5)
            
        except Exception as e:
            logger.error(f"Complete steps error: {e}")
    
    async def _get_published_url(self, page: Page) -> Optional[str]:
        """Get the URL of published video"""
        try:
            # Look for video link in success dialog
            link_selectors = [
                'a.style-scope.ytcp-video-info',
                'a[href*="youtu.be"]',
                'a[href*="youtube.com/shorts"]',
                'span.video-url-fadeable',
            ]
            
            for selector in link_selectors:
                link = page.locator(selector).first
                if await link.count() > 0:
                    href = await link.get_attribute('href')
                    if href:
                        return href
                    text = await link.inner_text()
                    if text and ('youtu' in text or 'shorts' in text):
                        return text
            
            return None
        except Exception:
            return None
    
    def _extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from YouTube URL"""
        if not url:
            return None
        
        import re
        patterns = [
            r'youtu\.be/([a-zA-Z0-9_-]+)',
            r'youtube\.com/shorts/([a-zA-Z0-9_-]+)',
            r'youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
            r'v=([a-zA-Z0-9_-]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    async def _take_screenshot(self, page: Page, name: str) -> str:
        """Take screenshot and return path"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{name}_{timestamp}.png"
            filepath = os.path.join(self.screenshot_dir, filename)
            await page.screenshot(path=filepath)
            logger.info(f"Screenshot saved: {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            return ""


# Singleton instance
youtube_automation = YouTubeAutomation()
