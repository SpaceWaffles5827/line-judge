from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.remote.webdriver import WebDriver
from typing import List, Dict
import time
from .base_scraper import BaseScraper

class DraftKingsScraper(BaseScraper):
    """Scraper for DraftKings sportsbook"""
    
    def matches_url(self, url: str) -> bool:
        """Check if URL is from DraftKings"""
        return 'draftkings.com' in url.lower()
    
    def get_sportsbook_name(self) -> str:
        return "DraftKings"
    
    def wait_for_page_load(self, driver: WebDriver) -> None:
        """DraftKings may need extra time for dynamic content"""
        time.sleep(6)
    
    def get_odds(self, driver: WebDriver) -> List[Dict[str, str]]:
        """Extract odds for both players from DraftKings match page"""
        try:
            # Wait for the moneyline section to load
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".cb-market__button"))
            )
            
            odds_data = []
            
            # Find all market buttons in the Moneyline section
            market_buttons = driver.find_elements(By.CSS_SELECTOR, ".cb-market__button")
            
            for button in market_buttons[:2]:  # Only get first 2 for match winner
                try:
                    # Get player name
                    player_elem = button.find_element(By.CSS_SELECTOR, ".cb-market__button-title")
                    player_name = player_elem.text.strip()
                    
                    # Get odds value
                    odds_elem = button.find_element(By.CSS_SELECTOR, ".cb-market__button-odds")
                    odds_value = odds_elem.text.strip()
                    
                    if player_name and odds_value:
                        odds_data.append({
                            'player': player_name,
                            'odds': odds_value
                        })
                        
                except NoSuchElementException:
                    continue
            
            # If we got exactly 2 players, return them
            if len(odds_data) == 2:
                return odds_data
            
            # Try alternative approach if first method didn't work
            return self._try_alternative_selectors(driver)
        
        except TimeoutException:
            return self._try_alternative_selectors(driver)
        except Exception as e:
            return []
    
    def _try_alternative_selectors(self, driver: WebDriver) -> List[Dict[str, str]]:
        """Try alternative selector patterns for DraftKings"""
        odds_data = []
        
        try:
            # Look for participant names in the scoreboard
            participants = driver.find_elements(By.CSS_SELECTOR, ".participantName__5lZjN")
            
            # Look for odds in market buttons
            odds_buttons = driver.find_elements(By.CSS_SELECTOR, "[data-testid='button-odds-market-board']")
            
            if len(participants) >= 2 and len(odds_buttons) >= 2:
                for i in range(min(2, len(participants), len(odds_buttons))):
                    player_name = participants[i].text.strip()
                    odds_value = odds_buttons[i].text.strip()
                    
                    if player_name and odds_value:
                        odds_data.append({
                            'player': player_name,
                            'odds': odds_value
                        })
        except:
            pass
        
        # Final fallback: try to find any button with title and odds
        if not odds_data:
            try:
                buttons = driver.find_elements(By.CSS_SELECTOR, "[data-testid='component-builder-market-button']")
                
                for button in buttons[:2]:
                    try:
                        title = button.find_element(By.CSS_SELECTOR, "[data-testid='button-title-market-board']").text.strip()
                        odds = button.find_element(By.CSS_SELECTOR, "[data-testid='button-odds-market-board']").text.strip()
                        
                        if title and odds:
                            odds_data.append({
                                'player': title,
                                'odds': odds
                            })
                    except:
                        continue
            except:
                pass
        
        return odds_data