"""
Browser Manager for Playwright
Handles browser pool, fingerprint injection, and context management
Enhanced anti-detection for TikTok
"""
import asyncio
import os
import logging
import random
import hashlib
import time
from typing import Dict, Optional, Any
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from contextlib import asynccontextmanager

from ..domain.entities import BrowserFingerprint

logger = logging.getLogger(__name__)


class BrowserManager:
    """Manages browser instances and contexts for anti-detection"""
    
    def __init__(self):
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._browser_visible: Optional[Browser] = None  # Non-headless browser for verification
        self._contexts: Dict[str, BrowserContext] = {}
        self._lock = asyncio.Lock()
        self._last_context_time: Dict[str, float] = {}  # Track last use time per fingerprint
        self._global_last_request = 0  # Global rate limiting
        
        # Configuration - more conservative for TikTok
        self.headless = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
        self.slow_mo = int(os.getenv("PLAYWRIGHT_SLOW_MO", "150"))  # Increased for more human-like
        self.timeout = int(os.getenv("PLAYWRIGHT_TIMEOUT", "90000"))  # 90 seconds
        self.user_data_dir = os.getenv("BROWSER_USER_DATA_DIR", "./tmp/browser_data")
        self.min_context_interval = int(os.getenv("MIN_CONTEXT_INTERVAL", "60"))  # 60 seconds between contexts
        self.min_global_interval = int(os.getenv("MIN_GLOBAL_INTERVAL", "30"))  # 30 seconds global
        
        # Ensure user data dir exists
        os.makedirs(self.user_data_dir, exist_ok=True)
    
    async def initialize(self, headless: bool = None):
        """Initialize Playwright and browser"""
        if headless is None:
            headless = self.headless
            
        if self._playwright is None:
            self._playwright = await async_playwright().start()
        
        # Initialize headless browser
        if headless and self._browser is None:
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                slow_mo=self.slow_mo,
                args=self._get_browser_args(headless=True)
            )
            logger.info("Headless browser initialized")
        
        # Initialize visible browser (for verification/manual login)
        if not headless and self._browser_visible is None:
            self._browser_visible = await self._playwright.chromium.launch(
                headless=False,
                slow_mo=self.slow_mo,
                args=self._get_browser_args(headless=False)
            )
            logger.info("Visible browser initialized (for verification)")
    
    def _get_browser_args(self, headless: bool = True) -> list:
        """Get browser launch arguments for enhanced anti-detection"""
        args = [
            # Core anti-detection
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process,AutomationControlled',
            '--disable-site-isolation-trials',
            
            # Sandbox settings
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            
            # Startup settings
            '--no-first-run',
            '--no-service-autorun',
            '--password-store=basic',
            '--disable-default-apps',
            '--no-default-browser-check',
            
            # Background process settings
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-networking',
            
            # UI settings
            '--disable-infobars',
            '--window-position=0,0',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            
            # Network settings
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-ipc-flooding-protection',
            
            # Features to disable
            '--disable-features=TranslateUI,BlinkGenPropertyTrees',
            '--disable-hang-monitor',
            '--disable-sync',
            '--metrics-recording-only',
            
            # WebRTC leak prevention
            '--disable-webrtc-hw-encoding',
            '--disable-webrtc-hw-decoding',
            '--enforce-webrtc-ip-permission-check',
            
            # Additional anti-fingerprinting
            '--disable-reading-from-canvas',
            '--disable-3d-apis',
            '--disable-notifications',
            '--disable-component-extensions-with-background-pages',
            '--disable-extensions-file-access-check',
            
            # Language
            '--lang=id-ID',
            '--accept-lang=id-ID,id,en-US,en',
        ]
        
        if headless:
            args.extend([
                '--headless=new',  # Use new headless mode
                '--disable-gpu',
                '--disable-accelerated-2d-canvas',
                '--no-zygote',
                '--single-process',
            ])
        else:
            args.extend([
                '--start-maximized',
                '--enable-gpu-rasterization',
            ])
        
        return args
    
    async def create_context(
        self, 
        fingerprint: BrowserFingerprint,
        proxy_url: str = None,
        cookies: list = None,
        local_storage: dict = None,
        headless: bool = None,  # Override headless setting
    ) -> tuple[BrowserContext, str]:
        """Create a new browser context with fingerprint and optional proxy"""
        
        if headless is None:
            headless = self.headless
        
        # Rate limiting - wait if too many requests
        await self._enforce_rate_limit(fingerprint.fingerprint_id)
        
        await self.initialize(headless=headless)
        
        # Select appropriate browser
        browser = self._browser if headless else self._browser_visible
        if browser is None:
            await self.initialize(headless=headless)
            browser = self._browser if headless else self._browser_visible
        
        context_id = f"ctx_{fingerprint.fingerprint_id}_{id(asyncio.current_task())}"
        
        # Build context options
        context_options = {
            "viewport": {
                "width": fingerprint.viewport_width,
                "height": fingerprint.viewport_height,
            },
            "user_agent": fingerprint.user_agent,
            "device_scale_factor": fingerprint.device_scale_factor,
            "is_mobile": fingerprint.is_mobile,
            "has_touch": fingerprint.has_touch,
            "locale": fingerprint.locale,
            "timezone_id": fingerprint.timezone,
            "color_scheme": "light",
            "ignore_https_errors": True,
            "java_script_enabled": True,
            "accept_downloads": True,
            "bypass_csp": True,
        }
        
        # Add geolocation for Indonesia
        context_options["geolocation"] = {"latitude": -6.2088, "longitude": 106.8456}
        context_options["permissions"] = ["geolocation"]
        
        # Add proxy if provided
        if proxy_url:
            context_options["proxy"] = self._parse_proxy_url(proxy_url)
        
        # Add extra headers to look more like real browser
        # Note: Don't add Upgrade-Insecure-Requests as it causes CORS issues with Google
        extra_headers = fingerprint.extra_headers or {}
        extra_headers.update({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": f"{fingerprint.locale},en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            # Removed: "Upgrade-Insecure-Requests": "1" - causes CORS issues with Google
        })
        context_options["extra_http_headers"] = extra_headers
        
        # Create context
        async with self._lock:
            context = await browser.new_context(**context_options)
            
            # Inject stealth scripts
            await self._inject_stealth_scripts(context, fingerprint)
            
            # Restore cookies if provided
            if cookies:
                await context.add_cookies(cookies)
            
            self._contexts[context_id] = context
            self._last_context_time[fingerprint.fingerprint_id] = asyncio.get_event_loop().time()
        
        logger.info(f"Created browser context: {context_id}")
        return context, context_id
    
    async def _enforce_rate_limit(self, fingerprint_id: str):
        """Enforce rate limiting between context creations - enhanced for TikTok"""
        current_time = time.time()
        
        # Global rate limiting (applies to all contexts)
        global_elapsed = current_time - self._global_last_request
        if global_elapsed < self.min_global_interval:
            global_wait = self.min_global_interval - global_elapsed + random.uniform(5, 15)
            logger.info(f"Global rate limit: waiting {global_wait:.1f}s")
            await asyncio.sleep(global_wait)
        
        # Per-fingerprint rate limiting
        last_time = self._last_context_time.get(fingerprint_id, 0)
        elapsed = current_time - last_time
        
        if elapsed < self.min_context_interval:
            wait_time = self.min_context_interval - elapsed + random.uniform(10, 30)
            logger.info(f"Fingerprint rate limit: waiting {wait_time:.1f}s before creating context")
            await asyncio.sleep(wait_time)
        
        # Update global timestamp
        self._global_last_request = time.time()
    
    async def _inject_stealth_scripts(self, context: BrowserContext, 
                                      fingerprint: BrowserFingerprint):
        """Inject JavaScript to mask automation detection - Enhanced for TikTok webmssdk bypass"""
        
        # WebGL spoofing
        webgl_vendor = fingerprint.webgl_vendor or "Google Inc. (NVIDIA)"
        webgl_renderer = fingerprint.webgl_renderer or "ANGLE (NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)"
        
        # Generate consistent but unique identifiers for this session
        session_seed = random.randint(1000000, 9999999)
        
        # Comprehensive stealth script - Enhanced for TikTok webmssdk bypass
        stealth_script = f"""
        // ============================================
        // COMPREHENSIVE STEALTH SCRIPT FOR TIKTOK
        // Enhanced for webmssdk bypass
        // ============================================
        
        const sessionSeed = {session_seed};
        
        // 1. Remove webdriver flag - Multiple methods
        Object.defineProperty(navigator, 'webdriver', {{
            get: () => undefined,
            configurable: true
        }});
        
        // Also delete it if it exists
        delete Object.getPrototypeOf(navigator).webdriver;
        
        // 2. Override navigator properties
        Object.defineProperty(navigator, 'languages', {{
            get: () => ['{fingerprint.locale.split("-")[0]}', '{fingerprint.locale}', 'en-US', 'en'],
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'platform', {{
            get: () => '{fingerprint.platform}',
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {8 if not fingerprint.is_mobile else 4},
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {8 if not fingerprint.is_mobile else 4},
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'maxTouchPoints', {{
            get: () => {10 if fingerprint.has_touch else 0},
            configurable: true
        }});
        
        // 3. Override connection info - Important for TikTok
        Object.defineProperty(navigator, 'connection', {{
            get: () => ({{
                effectiveType: '4g',
                rtt: {random.randint(20, 100)},
                downlink: {random.uniform(5, 20):.1f},
                saveData: false,
                type: 'wifi',
                downlinkMax: Infinity,
                onchange: null
            }}),
            configurable: true
        }});
        
        // 4. WebGL spoofing - Enhanced with debug info
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {{
            if (parameter === 37445) return '{webgl_vendor}';
            if (parameter === 37446) return '{webgl_renderer}';
            if (parameter === 7936) return '{webgl_vendor}'; // VENDOR
            if (parameter === 7937) return '{webgl_renderer}'; // RENDERER
            return getParameter.apply(this, arguments);
        }};
        
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        if (getParameter2) {{
            WebGL2RenderingContext.prototype.getParameter = function(parameter) {{
                if (parameter === 37445) return '{webgl_vendor}';
                if (parameter === 37446) return '{webgl_renderer}';
                if (parameter === 7936) return '{webgl_vendor}';
                if (parameter === 7937) return '{webgl_renderer}';
                return getParameter2.apply(this, arguments);
            }};
        }}
        
        // Also override getExtension for WEBGL_debug_renderer_info
        const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
        WebGLRenderingContext.prototype.getExtension = function(name) {{
            if (name === 'WEBGL_debug_renderer_info') {{
                return {{
                    UNMASKED_VENDOR_WEBGL: 37445,
                    UNMASKED_RENDERER_WEBGL: 37446
                }};
            }}
            return originalGetExtension.apply(this, arguments);
        }};
        
        // 5. Chrome plugins mock - More realistic
        Object.defineProperty(navigator, 'plugins', {{
            get: () => {{
                const plugins = [
                    {{ 
                        name: 'Chrome PDF Plugin', 
                        filename: 'internal-pdf-viewer',
                        description: 'Portable Document Format',
                        length: 1,
                        item: (i) => null,
                        namedItem: (name) => null,
                        [Symbol.iterator]: function* () {{}}
                    }},
                    {{ 
                        name: 'Chrome PDF Viewer', 
                        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                        description: '',
                        length: 1,
                        item: (i) => null,
                        namedItem: (name) => null,
                        [Symbol.iterator]: function* () {{}}
                    }},
                    {{ 
                        name: 'Native Client', 
                        filename: 'internal-nacl-plugin',
                        description: '',
                        length: 2,
                        item: (i) => null,
                        namedItem: (name) => null,
                        [Symbol.iterator]: function* () {{}}
                    }}
                ];
                plugins.length = 3;
                plugins.item = (i) => plugins[i] || null;
                plugins.namedItem = (name) => plugins.find(p => p.name === name) || null;
                plugins.refresh = () => {{}};
                return plugins;
            }},
            configurable: true
        }});
        
        // 6. MimeTypes mock
        Object.defineProperty(navigator, 'mimeTypes', {{
            get: () => {{
                const mimeTypes = [
                    {{ type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' }},
                    {{ type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }}
                ];
                mimeTypes.length = 2;
                mimeTypes.item = (i) => mimeTypes[i] || null;
                mimeTypes.namedItem = (name) => mimeTypes.find(m => m.type === name) || null;
                return mimeTypes;
            }},
            configurable: true
        }});
        
        // 7. Permission API mock - Enhanced
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => {{
            if (parameters.name === 'notifications') {{
                return Promise.resolve({{ state: 'prompt', onchange: null }});
            }}
            if (parameters.name === 'geolocation') {{
                return Promise.resolve({{ state: 'granted', onchange: null }});
            }}
            if (parameters.name === 'microphone' || parameters.name === 'camera') {{
                return Promise.resolve({{ state: 'prompt', onchange: null }});
            }}
            return originalQuery.call(navigator.permissions, parameters);
        }};
        
        // 8. Screen properties - with orientation
        Object.defineProperty(screen, 'colorDepth', {{
            get: () => {fingerprint.color_depth},
            configurable: true
        }});
        
        Object.defineProperty(screen, 'pixelDepth', {{
            get: () => {fingerprint.color_depth},
            configurable: true
        }});
        
        Object.defineProperty(screen, 'width', {{
            get: () => {fingerprint.viewport_width},
            configurable: true
        }});
        
        Object.defineProperty(screen, 'height', {{
            get: () => {fingerprint.viewport_height},
            configurable: true
        }});
        
        Object.defineProperty(screen, 'availWidth', {{
            get: () => {fingerprint.viewport_width},
            configurable: true
        }});
        
        Object.defineProperty(screen, 'availHeight', {{
            get: () => {fingerprint.viewport_height - 40},
            configurable: true
        }});
        
        // Screen orientation
        Object.defineProperty(screen, 'orientation', {{
            get: () => ({{
                type: 'landscape-primary',
                angle: 0,
                onchange: null,
                lock: () => Promise.resolve(),
                unlock: () => {{}}
            }}),
            configurable: true
        }});
        
        // 9. Disable automation detection objects - Comprehensive
        const deleteProps = [
            'cdc_adoQpoasnfa76pfcZLmcfl_Array',
            'cdc_adoQpoasnfa76pfcZLmcfl_Promise', 
            'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
            '__webdriver_evaluate',
            '__selenium_evaluate',
            '__webdriver_script_function',
            '__webdriver_script_func',
            '__webdriver_script_fn',
            '__fxdriver_evaluate',
            '__driver_unwrapped',
            '__webdriver_unwrapped',
            '__driver_evaluate',
            '__selenium_unwrapped',
            '__fxdriver_unwrapped',
            '_Selenium_IDE_Recorder',
            '_selenium',
            'calledSelenium',
            '$chrome_asyncScriptInfo',
            '$cdc_asdjflasutopfhvcZLmcfl_'
        ];
        
        deleteProps.forEach(prop => {{
            try {{ delete window[prop]; }} catch(e) {{}}
            try {{ delete document[prop]; }} catch(e) {{}}
        }});
        
        // 10. Override toString for functions - More robust
        const nativeToString = Function.prototype.toString;
        const customFunctions = new WeakSet();
        
        Function.prototype.toString = function() {{
            if (customFunctions.has(this)) {{
                return 'function () {{ [native code] }}';
            }}
            return nativeToString.call(this);
        }};
        customFunctions.add(Function.prototype.toString);
        
        // 11. Canvas fingerprint randomization - Subtle noise
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {{
            if (type === 'image/png' || !type) {{
                try {{
                    const ctx = this.getContext('2d');
                    if (ctx && this.width > 0 && this.height > 0) {{
                        const imageData = ctx.getImageData(0, 0, Math.min(this.width, 100), Math.min(this.height, 100));
                        const data = imageData.data;
                        // Add very subtle noise based on session seed
                        for (let i = 0; i < data.length; i += 4) {{
                            if ((i + sessionSeed) % 1000 === 0) {{
                                data[i] = data[i] ^ 1;
                            }}
                        }}
                        ctx.putImageData(imageData, 0, 0);
                    }}
                }} catch(e) {{}}
            }}
            return originalToDataURL.apply(this, arguments);
        }};
        customFunctions.add(HTMLCanvasElement.prototype.toDataURL);
        
        // 12. AudioContext fingerprint - Subtle modification
        try {{
            const originalGetChannelData = AudioBuffer.prototype.getChannelData;
            AudioBuffer.prototype.getChannelData = function() {{
                const array = originalGetChannelData.apply(this, arguments);
                // Add very subtle noise
                for (let i = 0; i < array.length; i += 100) {{
                    array[i] = array[i] + (sessionSeed % 1000) * 0.0000001;
                }}
                return array;
            }};
            customFunctions.add(AudioBuffer.prototype.getChannelData);
        }} catch(e) {{}}
        
        // 13. Battery API (return undefined for privacy)
        try {{
            delete navigator.getBattery;
            Object.defineProperty(navigator, 'getBattery', {{
                get: () => undefined,
                configurable: true
            }});
        }} catch(e) {{}}
        
        // 14. Prevent iframe detection
        try {{
            Object.defineProperty(window, 'parent', {{
                get: () => window,
                configurable: true
            }});
            Object.defineProperty(window, 'top', {{
                get: () => window,
                configurable: true
            }});
            Object.defineProperty(window, 'frameElement', {{
                get: () => null,
                configurable: true
            }});
        }} catch(e) {{}}
        
        // 15. Hide chrome automation extensions - Realistic chrome object
        window.chrome = {{
            app: {{
                isInstalled: false,
                InstallState: {{ DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }},
                RunningState: {{ CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }}
            }},
            runtime: {{
                OnInstalledReason: {{ CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' }},
                OnRestartRequiredReason: {{ APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }},
                PlatformArch: {{ ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }},
                PlatformNaclArch: {{ ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' }},
                PlatformOs: {{ ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }},
                RequestUpdateCheckStatus: {{ NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }},
                connect: () => ({{ onDisconnect: {{ addListener: () => {{}} }}, onMessage: {{ addListener: () => {{}} }}, postMessage: () => {{}} }}),
                sendMessage: () => {{}},
                id: undefined
            }},
            csi: () => ({{}}),
            loadTimes: () => ({{}})
        }};
        
        // 16. Override Error stack traces to hide Playwright
        const originalError = Error;
        window.Error = function(...args) {{
            const error = new originalError(...args);
            const stack = error.stack;
            if (stack) {{
                error.stack = stack.replace(/playwright|puppeteer|webdriver/gi, 'native');
            }}
            return error;
        }};
        window.Error.prototype = originalError.prototype;
        
        // 17. Performance timing - Make it look natural
        try {{
            const originalNow = Performance.prototype.now;
            let offset = Math.random() * 0.1;
            Performance.prototype.now = function() {{
                return originalNow.call(this) + offset;
            }};
        }} catch(e) {{}}
        
        // 18. Override console methods to not leak info
        const originalConsoleDebug = console.debug;
        console.debug = function(...args) {{
            const filtered = args.filter(arg => {{
                if (typeof arg === 'string') {{
                    return !arg.toLowerCase().includes('puppeteer') && 
                           !arg.toLowerCase().includes('playwright') &&
                           !arg.toLowerCase().includes('webdriver');
                }}
                return true;
            }});
            return originalConsoleDebug.apply(console, filtered);
        }};
        
        // 19. Mock Notification API
        if (!window.Notification) {{
            window.Notification = {{
                permission: 'default',
                requestPermission: () => Promise.resolve('default')
            }};
        }}
        
        // 20. Override Date.prototype.getTimezoneOffset for Indonesia
        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {{
            return -420; // UTC+7 (Indonesia WIB)
        }};
        
        // 21. WebRTC leak prevention
        try {{
            const originalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = function(...args) {{
                const pc = new originalRTCPeerConnection(...args);
                const originalCreateOffer = pc.createOffer.bind(pc);
                pc.createOffer = function(options) {{
                    if (options) {{
                        options.iceRestart = false;
                    }}
                    return originalCreateOffer(options);
                }};
                return pc;
            }};
            window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
        }} catch(e) {{}}
        
        // 22. Block some TikTok detection endpoints (if they try to detect from JS)
        const originalFetch = window.fetch;
        window.fetch = async function(url, options) {{
            const urlStr = typeof url === 'string' ? url : url.url;
            // Don't block, just let it through naturally
            return originalFetch.apply(this, arguments);
        }};
        
        // 23. Make document.hasFocus() always return true when visible
        const originalHasFocus = document.hasFocus;
        document.hasFocus = function() {{
            if (document.visibilityState === 'visible') {{
                return true;
            }}
            return originalHasFocus.call(this);
        }};
        
        // 24. Override navigator.userAgent to ensure consistency
        Object.defineProperty(navigator, 'userAgent', {{
            get: () => '{fingerprint.user_agent}',
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'appVersion', {{
            get: () => '{fingerprint.user_agent.replace("Mozilla/", "")}',
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'vendor', {{
            get: () => 'Google Inc.',
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'vendorSub', {{
            get: () => '',
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'productSub', {{
            get: () => '20030107',
            configurable: true
        }});
        
        // Done
        // console.log('Stealth scripts v2 loaded successfully');
        """
        
        await context.add_init_script(stealth_script)
    
    def _parse_proxy_url(self, proxy_url: str) -> dict:
        """Parse proxy URL into Playwright format"""
        # Format: protocol://user:pass@host:port
        if "://" not in proxy_url:
            proxy_url = f"http://{proxy_url}"
        
        from urllib.parse import urlparse
        parsed = urlparse(proxy_url)
        
        proxy_config = {
            "server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"
        }
        
        if parsed.username and parsed.password:
            proxy_config["username"] = parsed.username
            proxy_config["password"] = parsed.password
        
        return proxy_config
    
    async def get_page(self, context_id: str) -> Optional[Page]:
        """Get or create a page in the context"""
        context = self._contexts.get(context_id)
        if not context:
            return None
        
        pages = context.pages
        if pages:
            return pages[0]
        
        page = await context.new_page()
        page.set_default_timeout(self.timeout)
        return page
    
    async def close_context(self, context_id: str):
        """Close and cleanup a browser context"""
        async with self._lock:
            context = self._contexts.pop(context_id, None)
            if context:
                await context.close()
                logger.info(f"Closed browser context: {context_id}")
    
    async def close_all(self):
        """Close all contexts and the browser"""
        async with self._lock:
            for context_id, context in list(self._contexts.items()):
                try:
                    await context.close()
                except Exception as e:
                    logger.warning(f"Error closing context {context_id}: {e}")
            
            self._contexts.clear()
            
            if self._browser:
                await self._browser.close()
                self._browser = None
            
            if self._playwright:
                await self._playwright.stop()
                self._playwright = None
            
            logger.info("Browser manager shutdown complete")
    
    @asynccontextmanager
    async def context_session(
        self,
        fingerprint: BrowserFingerprint,
        proxy_url: str = None,
        cookies: list = None,
    ):
        """Context manager for browser sessions"""
        context, context_id = await self.create_context(
            fingerprint=fingerprint,
            proxy_url=proxy_url,
            cookies=cookies,
        )
        try:
            yield context, context_id
        finally:
            await self.close_context(context_id)
    
    def get_active_contexts_count(self) -> int:
        """Get number of active browser contexts"""
        return len(self._contexts)


# Singleton instance
browser_manager = BrowserManager()
