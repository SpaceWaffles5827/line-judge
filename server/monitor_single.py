from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import json
from datetime import datetime
from pathlib import Path
from scrapers import ScraperFactory

def setup_driver():
    """Setup Chrome driver with options"""
    options = webdriver.ChromeOptions()
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def save_odds_data(odds_history, filename="odds_data.json"):
    """Save odds history to JSON file"""
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    
    filepath = data_dir / filename
    with open(filepath, 'w') as f:
        json.dump(odds_history, f, indent=2)
    
    return filepath

def monitor_odds(url, interval=1):
    """Monitor odds at specified interval and save data"""
    print("🎾 LineJudge - Tennis Odds Monitor")
    print("=" * 60)
    
    # Get the appropriate scraper for this URL
    factory = ScraperFactory()
    scraper = factory.get_scraper(url)
    
    if not scraper:
        print(f"❌ ERROR: Unsupported sportsbook URL")
        print(f"\n📋 Supported sportsbooks:")
        for sportsbook in factory.get_supported_sportsbooks():
            print(f"  • {sportsbook}")
        return
    
    print(f"✅ Detected sportsbook: {scraper.get_sportsbook_name()}")
    
    driver = setup_driver()
    odds_history = {
        'sportsbook': scraper.get_sportsbook_name(),
        'url': url,
        'start_time': datetime.now().isoformat(),
        'data': []
    }
    
    try:
        print(f"📡 Loading: {url}")
        driver.get(url)
        
        print("⏳ Waiting for page to load...")
        scraper.wait_for_page_load(driver)
        
        print(f"\n👀 Monitoring odds every {interval} second(s)...")
        print("💾 Saving data for later analysis...")
        print("Press Ctrl+C to stop\n")
        print("-" * 60)
        
        last_odds = None
        iteration = 0
        
        while True:
            timestamp = datetime.now()
            odds = scraper.get_odds(driver)
            iteration += 1
            
            if odds:
                # Save to history
                data_point = {
                    'timestamp': timestamp.isoformat(),
                    'players': {}
                }
                
                for player_odds in odds:
                    data_point['players'][player_odds['player']] = player_odds['odds']
                
                odds_history['data'].append(data_point)
                
                # Print if odds changed or every 10 iterations
                if odds != last_odds or iteration % 10 == 0:
                    time_str = timestamp.strftime("%H:%M:%S")
                    status = "ODDS CHANGED" if odds != last_odds else "Update"
                    print(f"\n⏰ [{time_str}] 📊 {status}")
                    for player_odds in odds:
                        print(f"  🎾 {player_odds['player']}: {player_odds['odds']}")
                    last_odds = odds
            else:
                if iteration % 10 == 0:
                    time_str = timestamp.strftime("%H:%M:%S")
                    print(f"\n⏰ [{time_str}] ⚠️  No odds data found (still monitoring...)")
            
            time.sleep(interval)
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Stopping LineJudge...")
        
        # Save data
        if odds_history['data']:
            odds_history['end_time'] = datetime.now().isoformat()
            
            # Generate filename with sportsbook and timestamp
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"odds_{scraper.get_sportsbook_name().lower()}_{timestamp_str}.json"
            
            filepath = save_odds_data(odds_history, filename)
            print(f"💾 Data saved to: {filepath}")
            print(f"📈 Total data points: {len(odds_history['data'])}")
            print(f"\n📊 To plot this data, run: python plot_odds.py {filepath.name}")
        else:
            print("⚠️  No data collected")
    
    finally:
        driver.quit()
        print("✅ Browser closed. Thanks for using LineJudge!")

def show_examples():
    """Show example URLs for supported sportsbooks"""
    print("\n📋 Example URLs:")
    print("\n  BetMGM:")
    print("  https://www.nv.betmgm.com/en/sports/events/...")
    print("\n  DraftKings:")
    print("  https://sportsbook.draftkings.com/event/...")
    print()

if __name__ == "__main__":
    print("🎾 LineJudge - Multi-Sportsbook Tennis Odds Monitor")
    print("=" * 60)
    
    factory = ScraperFactory()
    print(f"✅ Supported sportsbooks: {', '.join(factory.get_supported_sportsbooks())}")
    print()
    
    url = input("Enter tennis match URL (or 'examples' for help): ").strip()
    
    if url.lower() == 'examples':
        show_examples()
        url = input("Enter tennis match URL: ").strip()
    
    if not url:
        print("❌ No URL provided. Exiting.")
    else:
        monitor_odds(url, interval=1)