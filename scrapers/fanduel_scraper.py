from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.remote.webdriver import WebDriver
from typing import List, Dict
import time
from .base_scraper import BaseScraper

class FanDuelScraper(BaseScraper):
    """Scraper for FanDuel sportsbook"""
    
    def matches_url(self, url: str) -> bool:
        """Check if URL is from FanDuel"""
        return 'fanduel.com' in url.lower()
    
    def get_sportsbook_name(self) -> str:
        return "FanDuel"
    
    def get_odds(self, driver: WebDriver) -> List[Dict[str, str]]:
        """Extract odds for both players from Moneyline market"""
        max_attempts = 60  # Try for up to 60 seconds
        attempt = 0
        
        while attempt < max_attempts:
            try:
                # Look for Moneyline section with aria-label
                moneyline_elements = driver.find_elements(
                    By.CSS_SELECTOR,
                    "div[aria-label='Moneyline']"
                )
                
                if not moneyline_elements:
                    if attempt % 5 == 0:  # Print every 5 seconds
                        print(f"⏳ Looking for Moneyline section... (attempt {attempt + 1}/{max_attempts})")
                    time.sleep(1)
                    attempt += 1
                    continue
                
                moneyline_section = moneyline_elements[0]
                
                # Method 1: Extract from buttons with aria-label containing "to win"
                odds_data = []
                
                # Find buttons with odds
                odds_buttons = moneyline_section.find_elements(
                    By.CSS_SELECTOR,
                    "div[role='button'][aria-label*='to win']"
                )
                
                if odds_buttons and len(odds_buttons) >= 2:
                    for button in odds_buttons[:2]:  # Only take first 2
                        aria_label = button.get_attribute('aria-label')
                        if aria_label and 'to win' in aria_label:
                            # Parse: "Carlos Alcaraz to win, -630 Odds"
                            parts = aria_label.split(',')
                            if len(parts) >= 2:
                                player = parts[0].replace(' to win', '').strip()
                                odds = parts[1].replace(' Odds', '').strip()
                                
                                if player and (odds.startswith('+') or odds.startswith('-')):
                                    odds_data.append({
                                        'player': player,
                                        'odds': odds
                                    })
                    
                    if len(odds_data) == 2:
                        print(f"✓ Found {len(odds_data)} odds successfully")
                        return odds_data
                
                # Method 2: Find player names and odds separately
                if not odds_data:
                    # Find player names from the VS section
                    player_names = []
                    vs_elements = driver.find_elements(
                        By.CSS_SELECTOR,
                        "span[aria-label*='verse']"
                    )
                    
                    if vs_elements:
                        aria_label = vs_elements[0].get_attribute('aria-label')
                        if aria_label:
                            # Split by "verse" to get player names
                            players = aria_label.split('verse')
                            if len(players) == 2:
                                player_names = [p.strip() for p in players]
                    
                    # If that didn't work, try getting player names from role="text" spans
                    if not player_names:
                        name_spans = moneyline_section.find_elements(
                            By.CSS_SELECTOR,
                            "span[role='text']"
                        )
                        
                        for span in name_spans:
                            text = span.text.strip()
                            if text and len(text) > 2 and text not in ['vs', 'VS']:
                                player_names.append(text)
                                if len(player_names) >= 2:
                                    break
                    
                    # Get odds values from spans with specific classes
                    odds_spans = moneyline_section.find_elements(
                        By.CSS_SELECTOR,
                        "span.kv.kw"
                    )
                    
                    odds_values = []
                    for span in odds_spans:
                        text = span.text.strip()
                        if text and (text.startswith('+') or text.startswith('-')):
                            odds_values.append(text)
                            if len(odds_values) >= 2:
                                break
                    
                    # Match players with odds
                    if len(player_names) >= 2 and len(odds_values) >= 2:
                        for i in range(2):
                            odds_data.append({
                                'player': player_names[i],
                                'odds': odds_values[i]
                            })
                        
                        if len(odds_data) == 2:
                            print(f"✓ Found {len(odds_data)} odds successfully")
                            return odds_data
                
                # If we found the section but no odds, keep trying
                if attempt % 5 == 0:
                    print(f"⏳ Moneyline section found, waiting for odds to load... (attempt {attempt + 1}/{max_attempts})")
                
            except Exception as e:
                if attempt % 10 == 0:
                    print(f"⚠️  Error during attempt {attempt + 1}: {str(e)}")
            
            time.sleep(1)
            attempt += 1
        
        print("❌ Could not extract odds after maximum attempts")
        print("💡 You may need to:")
        print("   1. Complete any CAPTCHA manually")
        print("   2. Scroll to the Moneyline section")
        print("   3. Ensure the page is fully loaded")
        return []