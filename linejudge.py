from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import json
from datetime import datetime
from pathlib import Path

def setup_driver():
    """Setup Chrome driver with options"""
    options = webdriver.ChromeOptions()
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

def get_odds(driver):
    """Extract odds for both players from Match Winner market"""
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "option-panel"))
        )
        
        panels = driver.find_elements(By.CLASS_NAME, "option-panel")
        odds_data = []
        
        for panel in panels:
            try:
                accordion_header = panel.find_element(By.CSS_SELECTOR, "ds-accordion-header")
                header_text = accordion_header.text.strip()
                
                if "Match winner" in header_text:
                    options = panel.find_elements(By.CSS_SELECTOR, "ms-option")
                    
                    for option in options:
                        try:
                            player_elem = option.find_element(By.CLASS_NAME, "name")
                            player_name = player_elem.text.strip()
                            
                            odds_elem = option.find_element(By.CSS_SELECTOR, "ms-font-resizer span.custom-odds-value-style")
                            odds_value = odds_elem.text.strip()
                            
                            if player_name and odds_value:
                                odds_data.append({
                                    'player': player_name,
                                    'odds': odds_value
                                })
                        except NoSuchElementException:
                            continue
                    
                    if odds_data:
                        break
            except:
                continue
        
        return odds_data
    
    except TimeoutException:
        return []
    except Exception as e:
        return []

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
    
    driver = setup_driver()
    odds_history = {
        'url': url,
        'start_time': datetime.now().isoformat(),
        'data': []
    }
    
    try:
        print(f"📡 Loading: {url}")
        driver.get(url)
        
        print("⏳ Waiting for page to load...")
        time.sleep(5)
        
        print(f"\n👀 Monitoring odds every {interval} second(s)...")
        print("💾 Saving data for later analysis...")
        print("Press Ctrl+C to stop\n")
        print("-" * 60)
        
        last_odds = None
        
        while True:
            timestamp = datetime.now()
            odds = get_odds(driver)
            
            if odds:
                # Save to history
                data_point = {
                    'timestamp': timestamp.isoformat(),
                    'players': {}
                }
                
                for player_odds in odds:
                    data_point['players'][player_odds['player']] = player_odds['odds']
                
                odds_history['data'].append(data_point)
                
                # Only print if odds changed or every 10 iterations
                if odds != last_odds:
                    time_str = timestamp.strftime("%H:%M:%S")
                    print(f"\n⏰ [{time_str}] 📊 ODDS CHANGED")
                    for player_odds in odds:
                        print(f"  🎾 {player_odds['player']}: {player_odds['odds']}")
                    last_odds = odds
            
            time.sleep(interval)
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Stopping LineJudge...")
        
        # Save data
        if odds_history['data']:
            odds_history['end_time'] = datetime.now().isoformat()
            filepath = save_odds_data(odds_history)
            print(f"💾 Data saved to: {filepath}")
            print(f"📈 Total data points: {len(odds_history['data'])}")
            print(f"\n📊 To plot this data, run: python plot_odds.py {filepath.name}")
        else:
            print("No data collected")
    
    finally:
        driver.quit()
        print("✅ Browser closed. Thanks for using LineJudge!")

if __name__ == "__main__":
    url = input("Enter BetMGM tennis match URL (or press Enter for default): ").strip()
    
    if not url:
        url = "https://www.nv.betmgm.com/en/sports/events/carlos-alcaraz-esp-alexander-zverev-ger-18923825"
        print(f"Using default URL: {url}")
    
    monitor_odds(url, interval=1)