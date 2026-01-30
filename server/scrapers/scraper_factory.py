from typing import Optional, List
from .base_scraper import BaseScraper
from .betmgm_scraper import BetMGMScraper
from .draftkings_scraper import DraftKingsScraper
from .pinnacle_scraper import PinnacleScraper
from .fanduel_scraper import FanDuelScraper

class ScraperFactory:
    """Factory to create appropriate scraper based on URL"""
    
    def __init__(self):
        self.scrapers: List[BaseScraper] = [
            BetMGMScraper(),
            DraftKingsScraper(),
            PinnacleScraper(),
            FanDuelScraper(),
            # Add more scrapers here as needed
        ]
    
    def get_scraper(self, url: str) -> Optional[BaseScraper]:
        """Get the appropriate scraper for the given URL"""
        for scraper in self.scrapers:
            if scraper.matches_url(url):
                return scraper
        return None
    
    def get_supported_sportsbooks(self) -> List[str]:
        """Get list of supported sportsbook names"""
        return [scraper.get_sportsbook_name() for scraper in self.scrapers]