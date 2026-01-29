"""
scrapers/pinnacle_scraper.py - Scraper for Pinnacle sportsbook
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.remote.webdriver import WebDriver
from typing import List, Dict
from .base_scraper import BaseScraper

class PinnacleScraper(BaseScraper):
    """Scraper for Pinnacle sportsbook"""
    
    def matches_url(self, url: str) -> bool:
        """Check if URL is from Pinnacle"""
        return 'pinnacle.com' in url.lower()
    
    def get_sportsbook_name(self) -> str:
        return "Pinnacle"
    
    def get_odds(self, driver: WebDriver) -> List[Dict[str, str]]:
        """Extract odds for both players from Match Winner market"""
        try:
            # Wait for the market groups to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "marketGroup-wMlWprW2iC"))
            )
            
            odds_data = []
            
            # Find all market groups
            market_groups = driver.find_elements(By.CLASS_NAME, "marketGroup-wMlWprW2iC")
            
            for market_group in market_groups:
                try:
                    # Find the title of the market
                    title_elem = market_group.find_element(By.CLASS_NAME, "titleText-BgvECQYfHf")
                    title_text = title_elem.text.strip()
                    
                    # Look for "Match Winner" market
                    if "Match Winner" in title_text:
                        # Find all market buttons in this group
                        buttons = market_group.find_elements(By.CLASS_NAME, "market-btn")
                        
                        for button in buttons:
                            try:
                                # Extract player name
                                player_elem = button.find_element(By.CLASS_NAME, "label-GT4CkXEOFj")
                                player_name = player_elem.text.strip()
                                
                                # Extract decimal odds
                                odds_elem = button.find_element(By.CLASS_NAME, "price-r5BU0ynJha")
                                decimal_odds = odds_elem.text.strip()
                                
                                if player_name and decimal_odds:
                                    # Convert decimal to American odds
                                    american_odds = self.decimal_to_american(float(decimal_odds))
                                    
                                    odds_data.append({
                                        'player': player_name,
                                        'odds': american_odds
                                    })
                            except (NoSuchElementException, ValueError):
                                continue
                        
                        # If we found Match Winner odds, break
                        if odds_data:
                            break
                except NoSuchElementException:
                    continue
            
            return odds_data
        
        except TimeoutException:
            return []
        except Exception as e:
            return []
    
    def decimal_to_american(self, decimal_odds: float) -> str:
        """Convert decimal odds to American odds format"""
        if decimal_odds >= 2.0:
            # Positive American odds
            american = (decimal_odds - 1) * 100
            return f"+{int(round(american))}"
        else:
            # Negative American odds
            american = -100 / (decimal_odds - 1)
            return f"{int(round(american))}"