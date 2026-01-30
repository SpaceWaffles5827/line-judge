from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.remote.webdriver import WebDriver
from typing import List, Dict
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
        try:
            # Wait for Moneyline section to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div[aria-label='Moneyline']"))
            )
            
            moneyline_section = driver.find_element(By.CSS_SELECTOR, "div[aria-label='Moneyline']")
            odds_data = []
            
            # Method 1: Extract from buttons with aria-label containing "to win"
            try:
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
                        return odds_data
            except NoSuchElementException:
                pass
            
            # Method 2: Find player names and odds separately
            if not odds_data:
                player_names = []
                
                # Try getting player names from VS section
                try:
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
                except NoSuchElementException:
                    pass
                
                # If that didn't work, try getting player names from role="text" spans
                if not player_names:
                    try:
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
                    except NoSuchElementException:
                        pass
                
                # Get odds values from spans with specific classes
                odds_values = []
                try:
                    odds_spans = moneyline_section.find_elements(
                        By.CSS_SELECTOR,
                        "span.kv.kw"
                    )
                    
                    for span in odds_spans:
                        text = span.text.strip()
                        if text and (text.startswith('+') or text.startswith('-')):
                            odds_values.append(text)
                            if len(odds_values) >= 2:
                                break
                except NoSuchElementException:
                    pass
                
                # Match players with odds
                if len(player_names) >= 2 and len(odds_values) >= 2:
                    for i in range(2):
                        odds_data.append({
                            'player': player_names[i],
                            'odds': odds_values[i]
                        })
            
            return odds_data
        
        except TimeoutException:
            return []
        except Exception as e:
            return []