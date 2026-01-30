"""
Debug helper to test scrapers without full monitoring
"""
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from scrapers import ScraperFactory
from datetime import datetime
import time
import random

def test_scraper(url: str):
    """Test a scraper with a single fetch"""
    print("🧪 LineJudge Scraper Tester")
    print("=" * 60)
    
    # Get scraper
    factory = ScraperFactory()
    scraper = factory.get_scraper(url)
    
    if not scraper:
        print(f"❌ No scraper found for URL: {url}")
        print(f"\n📋 Supported sportsbooks:")
        for sportsbook in factory.get_supported_sportsbooks():
            print(f"  • {sportsbook}")
        return
    
    print(f"✅ Using scraper: {scraper.get_sportsbook_name()}")
    print(f"🔗 URL: {url}\n")
    
    # Setup driver with maximum stealth
    options = Options()
    
    # Core anti-detection
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Additional stealth settings
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-infobars')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--start-maximized')
    
    # Real user agent
    options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    
    # Additional preferences to look more human
    prefs = {
        "credentials_enable_service": False,
        "profile.password_manager_enabled": False,
        "profile.default_content_setting_values.notifications": 2,
    }
    options.add_experimental_option("prefs", prefs)
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    # Execute stealth scripts
    stealth_js = """
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
    
    // Overwrite the `languages` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
    
    // Overwrite the Chrome runtime
    window.chrome = {
      runtime: {}
    };
    
    // Pass the Permissions Test.
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    """
    
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': stealth_js
    })
    
    driver.set_page_load_timeout(30)
    
    try:
        print("📡 Loading page...")
        driver.get(url)
        
        # Add random delay to seem more human
        time.sleep(random.uniform(1.5, 2.5))
        
        # Check if it's FanDuel
        if 'fanduel' in url.lower():
            print("\n" + "="*60)
            print("⚠️  FANDUEL DETECTED")
            print("="*60)
            print("If you see a CAPTCHA, complete it manually.")
            print("The scraper will keep trying to find odds automatically.")
            print("="*60 + "\n")
        
        print("🔍 Attempting to extract odds...\n")
        odds = scraper.get_odds(driver)
        
        if odds:
            print("\n✅ SUCCESS! Found odds:")
            print("-" * 60)
            for player_odds in odds:
                print(f"🎾 {player_odds['player']:30s} → {player_odds['odds']}")
            print("-" * 60)
            print(f"\n📊 Total players found: {len(odds)}")
            
            # For FanDuel, test if it keeps working
            if 'fanduel' in url.lower():
                print("\n🔄 Testing if scraping continues to work...")
                for i in range(3):
                    time.sleep(random.uniform(2, 3))
                    print(f"   Iteration {i+2}...")
                    test_odds = scraper.get_odds(driver)
                    if test_odds:
                        print(f"   ✅ Still working! Found {len(test_odds)} players")
                    else:
                        print(f"   ❌ Lost access to odds")
                        break
        else:
            print("\n❌ No odds data extracted")
            print("\n💡 Debugging tips:")
            print("  1. Check if page loaded correctly (look at browser)")
            print("  2. Verify selectors in browser console")
            print("  3. Check if 'Moneyline' market is visible")
            print("  4. Complete any CAPTCHA if present")
            
            # Offer to save page source
            save_choice = input("\n💾 Save page HTML for debugging? (y/n): ").strip().lower()
            if save_choice == 'y':
                from pathlib import Path
                
                debug_dir = Path("debug")
                debug_dir.mkdir(exist_ok=True)
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                html_file = debug_dir / f"page_source_{scraper.get_sportsbook_name().lower()}_{timestamp}.html"
                
                with open(html_file, 'w', encoding='utf-8') as f:
                    f.write(driver.page_source)
                
                print(f"\n✅ Page source saved to: {html_file}")
                print("📤 You can share this file to get help with selectors")
        
        # Keep browser open for inspection
        input("\n⏸️  Press Enter to close browser and exit...")
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Stopped by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        input("\n⏸️  Press Enter to close browser and exit...")
    
    finally:
        driver.quit()
        print("\n✅ Browser closed")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        print("Usage: python test_scraper.py <url>")
        print("\nOr enter URL now:")
        url = input("URL: ").strip()
    
    if url:
        test_scraper(url)
    else:
        print("No URL provided")