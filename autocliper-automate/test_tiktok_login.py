"""
Test script to analyze TikTok login page structure
Run: python test_tiktok_login.py
"""
import asyncio
from playwright.async_api import async_playwright

async def analyze_tiktok_login():
    print("🚀 Starting TikTok login page analysis...")
    
    async with async_playwright() as p:
        # Launch visible browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},  # iPhone-like
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
        )
        page = await context.new_page()
        
        print("📱 Opening TikTok login page...")
        await page.goto("https://www.tiktok.com/login")
        await asyncio.sleep(3)
        
        print("\n" + "="*60)
        print("📋 STEP 1: Initial page elements")
        print("="*60)
        
        # Find all clickable elements with text
        buttons = await page.locator("button, div[role='button'], a").all()
        print(f"\nFound {len(buttons)} clickable elements:")
        for i, btn in enumerate(buttons[:15]):  # First 15
            try:
                text = await btn.text_content()
                if text and text.strip():
                    print(f"  [{i}] {text.strip()[:50]}")
            except:
                pass
        
        # Check for popup
        print("\n🔍 Checking for app popup...")
        popup_texts = ["Nanti saja", "Not now", "Maybe later", "Buka TikTok"]
        for text in popup_texts:
            el = page.locator(f'text="{text}"')
            if await el.count() > 0:
                print(f"  ✅ Found: '{text}'")
        
        # Wait for user to see
        print("\n⏳ Pausing 5 seconds for you to see the page...")
        await asyncio.sleep(5)
        
        # Try to click "Nanti saja" if exists
        try:
            nanti = page.locator('text="Nanti saja"')
            if await nanti.count() > 0:
                await nanti.click()
                print("✅ Clicked 'Nanti saja'")
                await asyncio.sleep(2)
        except Exception as e:
            print(f"  No popup to dismiss: {e}")
        
        print("\n" + "="*60)
        print("📋 STEP 2: Login options")
        print("="*60)
        
        # Find login options
        options = await page.locator("div").all()
        login_options = []
        for opt in options:
            try:
                text = await opt.text_content()
                if text and ("telepon" in text.lower() or "phone" in text.lower() or 
                            "email" in text.lower() or "Gunakan" in text):
                    login_options.append(text.strip()[:60])
            except:
                pass
        
        print(f"\nLogin-related options found:")
        for opt in set(login_options)[:10]:
            print(f"  • {opt}")
        
        # Click phone/email option
        print("\n🔍 Looking for phone/email login option...")
        phone_selectors = [
            'div:has-text("Gunakan nomor telepon")',
            'div:has-text("telepon/email")',
            'div:has-text("Use phone")',
        ]
        
        clicked = False
        for sel in phone_selectors:
            try:
                el = page.locator(sel).first
                if await el.count() > 0:
                    print(f"  ✅ Found and clicking: {sel}")
                    await el.click()
                    clicked = True
                    await asyncio.sleep(2)
                    break
            except Exception as e:
                print(f"  ❌ {sel}: {e}")
        
        if not clicked:
            print("  ⚠️ Could not find phone/email option automatically")
        
        print("\n" + "="*60)
        print("📋 STEP 3: Login form analysis")
        print("="*60)
        
        # Find all inputs
        inputs = await page.locator("input").all()
        print(f"\nFound {len(inputs)} input fields:")
        for i, inp in enumerate(inputs):
            try:
                inp_type = await inp.get_attribute("type") or "text"
                placeholder = await inp.get_attribute("placeholder") or ""
                name = await inp.get_attribute("name") or ""
                print(f"  [{i}] type={inp_type}, name={name}, placeholder={placeholder[:30]}")
            except:
                pass
        
        # Find all buttons
        buttons = await page.locator("button").all()
        print(f"\nFound {len(buttons)} buttons:")
        for i, btn in enumerate(buttons):
            try:
                text = await btn.text_content()
                btn_type = await btn.get_attribute("type") or ""
                disabled = await btn.is_disabled()
                print(f"  [{i}] '{text.strip()[:30]}' type={btn_type} disabled={disabled}")
            except:
                pass
        
        # Take screenshot
        await page.screenshot(path="tmp/screenshots/tiktok_login_analysis.png", full_page=True)
        print("\n📸 Screenshot saved: tmp/screenshots/tiktok_login_analysis.png")
        
        print("\n" + "="*60)
        print("🎯 RECOMMENDED SELECTORS")
        print("="*60)
        print("""
Based on analysis, try these selectors:

1. Dismiss popup:
   - 'text="Nanti saja"'
   - 'button:has-text("Nanti")'

2. Phone/Email option:
   - 'div:has-text("Gunakan nomor telepon")'
   - Look for div with "telepon/email/nama pengguna"

3. Input fields:
   - Phone: input[type="tel"] or input[placeholder*="telepon"]
   - Password: input[type="password"]

4. Login button:
   - 'button:has-text("Masuk")'
   - 'button[type="submit"]'
        """)
        
        print("\n⏳ Browser will stay open for 30 seconds for manual inspection...")
        print("   Press Ctrl+C to exit earlier")
        
        try:
            await asyncio.sleep(30)
        except KeyboardInterrupt:
            pass
        
        await browser.close()
        print("\n✅ Done!")

if __name__ == "__main__":
    asyncio.run(analyze_tiktok_login())
