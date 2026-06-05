"""
Human-like Behavior Simulation for Anti-Detection
Includes typing patterns, mouse movements, scroll behavior, and random delays
"""
import asyncio
import random
import math
from typing import Tuple, List
from playwright.async_api import Page, Locator
import logging

logger = logging.getLogger(__name__)


class HumanBehavior:
    """Simulate human-like interactions with the browser"""
    
    def __init__(self, page: Page):
        self.page = page
    
    async def type_like_human(self, selector: str, text: str, 
                              min_delay: int = 50, max_delay: int = 150):
        """Type text with random delays between keystrokes"""
        element = self.page.locator(selector)
        await element.click()
        await asyncio.sleep(random.uniform(0.1, 0.3))
        
        for char in text:
            await element.press_sequentially(char, delay=random.randint(min_delay, max_delay))
            # Occasional longer pauses (thinking)
            if random.random() < 0.05:
                await asyncio.sleep(random.uniform(0.2, 0.5))
    
    async def type_in_locator(self, locator: Locator, text: str,
                              min_delay: int = 50, max_delay: int = 150):
        """Type text into a locator with human-like delays"""
        await locator.click()
        await asyncio.sleep(random.uniform(0.1, 0.3))
        
        for char in text:
            await locator.press_sequentially(char, delay=random.randint(min_delay, max_delay))
            if random.random() < 0.05:
                await asyncio.sleep(random.uniform(0.2, 0.5))
    
    async def random_delay(self, min_seconds: float = 0.5, max_seconds: float = 2.0):
        """Wait for a random duration"""
        await asyncio.sleep(random.uniform(min_seconds, max_seconds))
    
    async def click_with_delay(self, selector: str, 
                               pre_delay: Tuple[float, float] = (0.2, 0.5),
                               post_delay: Tuple[float, float] = (0.1, 0.3)):
        """Click element with human-like delays before and after"""
        await asyncio.sleep(random.uniform(*pre_delay))
        await self.page.locator(selector).click()
        await asyncio.sleep(random.uniform(*post_delay))
    
    async def click_locator_with_delay(self, locator: Locator,
                                       pre_delay: Tuple[float, float] = (0.2, 0.5),
                                       post_delay: Tuple[float, float] = (0.1, 0.3)):
        """Click locator with human-like delays"""
        await asyncio.sleep(random.uniform(*pre_delay))
        await locator.click()
        await asyncio.sleep(random.uniform(*post_delay))
    
    async def scroll_page(self, direction: str = "down", 
                          distance: int = None, 
                          speed: str = "normal"):
        """Scroll page with natural speed variation"""
        if distance is None:
            distance = random.randint(200, 500)
        
        speed_map = {
            "slow": (50, 100),
            "normal": (100, 200),
            "fast": (200, 400),
        }
        step_range = speed_map.get(speed, speed_map["normal"])
        
        scrolled = 0
        while scrolled < distance:
            step = random.randint(*step_range)
            step = min(step, distance - scrolled)
            
            delta = step if direction == "down" else -step
            await self.page.mouse.wheel(0, delta)
            scrolled += step
            
            # Random micro-pause
            await asyncio.sleep(random.uniform(0.01, 0.05))
    
    async def move_mouse_to_element(self, selector: str):
        """Move mouse to element with bezier curve (more human-like)"""
        element = self.page.locator(selector)
        box = await element.bounding_box()
        if not box:
            return
        
        target_x = box['x'] + box['width'] / 2 + random.randint(-5, 5)
        target_y = box['y'] + box['height'] / 2 + random.randint(-5, 5)
        
        # Get current mouse position (approximate)
        viewport = self.page.viewport_size
        current_x = random.randint(0, viewport['width'])
        current_y = random.randint(0, viewport['height'])
        
        # Generate bezier curve points
        points = self._bezier_curve(
            (current_x, current_y),
            (target_x, target_y),
            steps=random.randint(10, 25)
        )
        
        for x, y in points:
            await self.page.mouse.move(x, y)
            await asyncio.sleep(random.uniform(0.005, 0.02))
    
    def _bezier_curve(self, start: Tuple[float, float], end: Tuple[float, float],
                      steps: int = 20) -> List[Tuple[float, float]]:
        """Generate bezier curve points for natural mouse movement"""
        # Add random control points for curve
        ctrl1 = (
            start[0] + random.uniform(0.2, 0.4) * (end[0] - start[0]) + random.randint(-50, 50),
            start[1] + random.uniform(0.1, 0.3) * (end[1] - start[1]) + random.randint(-50, 50),
        )
        ctrl2 = (
            start[0] + random.uniform(0.6, 0.8) * (end[0] - start[0]) + random.randint(-50, 50),
            start[1] + random.uniform(0.7, 0.9) * (end[1] - start[1]) + random.randint(-50, 50),
        )
        
        points = []
        for i in range(steps + 1):
            t = i / steps
            # Cubic bezier formula
            x = (
                (1-t)**3 * start[0] +
                3 * (1-t)**2 * t * ctrl1[0] +
                3 * (1-t) * t**2 * ctrl2[0] +
                t**3 * end[0]
            )
            y = (
                (1-t)**3 * start[1] +
                3 * (1-t)**2 * t * ctrl1[1] +
                3 * (1-t) * t**2 * ctrl2[1] +
                t**3 * end[1]
            )
            points.append((x, y))
        
        return points
    
    async def hover_random_elements(self, count: int = 3, 
                                    selectors: List[str] = None):
        """Hover over random elements to simulate browsing"""
        default_selectors = ['a', 'button', 'div[role="button"]', 'img']
        selectors = selectors or default_selectors
        
        for _ in range(count):
            selector = random.choice(selectors)
            try:
                elements = await self.page.locator(selector).all()
                if elements:
                    element = random.choice(elements)
                    await element.hover()
                    await asyncio.sleep(random.uniform(0.3, 1.0))
            except Exception:
                pass
    
    async def browse_feed(self, duration_seconds: int = 30):
        """Simulate natural feed browsing behavior"""
        logger.info(f"Browsing feed for {duration_seconds} seconds...")
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < duration_seconds:
            # Random scroll
            await self.scroll_page(
                direction="down",
                distance=random.randint(300, 700),
                speed=random.choice(["slow", "normal"])
            )
            
            # Random pause to "watch" content
            await asyncio.sleep(random.uniform(2, 5))
            
            # Occasionally hover elements
            if random.random() < 0.3:
                await self.hover_random_elements(count=1)
            
            # Occasionally scroll up a bit
            if random.random() < 0.15:
                await self.scroll_page(direction="up", distance=random.randint(100, 200))
                await asyncio.sleep(random.uniform(1, 2))
    
    async def wait_for_page_idle(self, timeout: int = 5000):
        """Wait for page to become idle (network + animations)"""
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
        except Exception:
            pass
        await asyncio.sleep(random.uniform(0.3, 0.8))
    
    async def fill_form_field(self, selector: str, value: str):
        """Fill a form field with human-like behavior"""
        # First, clear the field
        element = self.page.locator(selector)
        await element.click(click_count=3)  # Triple-click to select all
        await asyncio.sleep(random.uniform(0.1, 0.2))
        await element.press("Backspace")
        await asyncio.sleep(random.uniform(0.1, 0.3))
        
        # Then type the value
        await self.type_in_locator(element, value)


class SessionWarmer:
    """Warm up a session before performing actions"""
    
    def __init__(self, page: Page):
        self.page = page
        self.human = HumanBehavior(page)
    
    async def warm_tiktok_session(self, duration_seconds: int = 45):
        """Warm up TikTok session with natural browsing"""
        logger.info(f"Warming TikTok session for {duration_seconds} seconds...")
        
        try:
            # Navigate to For You page
            await self.page.goto("https://www.tiktok.com/foryou")
            await self.human.wait_for_page_idle()
            await asyncio.sleep(random.uniform(2, 4))
            
            # Browse the feed
            await self.human.browse_feed(duration_seconds - 10)
            
            # Occasionally interact with a video
            if random.random() < 0.3:
                try:
                    # Try to like a video
                    like_buttons = await self.page.locator('[data-e2e="like-icon"]').all()
                    if like_buttons:
                        await random.choice(like_buttons).click()
                        await asyncio.sleep(random.uniform(1, 2))
                except Exception:
                    pass
            
            logger.info("Session warming completed")
        except Exception as e:
            logger.warning(f"Session warming error (non-fatal): {e}")
