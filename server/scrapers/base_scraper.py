from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from selenium.webdriver.remote.webdriver import WebDriver

class BaseScraper(ABC):
    """Base class for sportsbook scrapers"""
    
    @abstractmethod
    def matches_url(self, url: str) -> bool:
        """Check if this scraper can handle the given URL"""
        pass
    
    @abstractmethod
    def get_odds(self, driver: WebDriver) -> List[Dict[str, str]]:
        """Extract odds data from the page"""
        pass
    
    @abstractmethod
    def get_sportsbook_name(self) -> str:
        """Return the name of the sportsbook"""
        pass
    
    def wait_for_page_load(self, driver: WebDriver) -> None:
        """Optional: Custom wait logic for page load"""
        import time
        time.sleep(5)