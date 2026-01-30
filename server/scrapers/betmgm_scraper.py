from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.remote.webdriver import WebDriver
from typing import List, Dict
from .base_scraper import BaseScraper

class BetMGMScraper(BaseScraper):
    """Scraper for BetMGM sportsbook"""
    
    def matches_url(self, url: str) -> bool:
        """Check if URL is from BetMGM"""
        return 'betmgm.com' in url.lower()
    
    def get_sportsbook_name(self) -> str:
        return "BetMGM"
    
    def get_odds(self, driver: WebDriver) -> List[Dict[str, str]]:
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
                                
                                odds_elem = option.find_element(
                                    By.CSS_SELECTOR, 
                                    "ms-font-resizer span.custom-odds-value-style"
                                )
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