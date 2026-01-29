"""
compare_odds.py - Compare odds across multiple sportsbooks in real-time with arbitrage detection
SUPPORTS 2+ SPORTSBOOKS FOR OPTIMAL ARBITRAGE DETECTION
"""
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import json
from datetime import datetime
from pathlib import Path
from scrapers import ScraperFactory
from threading import Thread, Lock
from collections import defaultdict

class OddsComparator:
    def __init__(self):
        self.odds_lock = Lock()
        self.current_odds = {}
        self.odds_history = {
            'start_time': datetime.now().isoformat(),
            'matches': [],
            'comparisons': [],
            'arbitrage_opportunities': []
        }
        self.running = True
        self.arbitrage_found = False
        
    def setup_driver(self):
        """Setup Chrome driver with options"""
        options = webdriver.ChromeOptions()
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        options.add_argument('--headless')  # Run in background
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    
    def monitor_single_match(self, url: str, match_id: int, interval: int = 1):
        """Monitor a single match in a separate thread"""
        factory = ScraperFactory()
        scraper = factory.get_scraper(url)
        
        if not scraper:
            print(f"❌ Match {match_id}: Unsupported URL")
            return
        
        sportsbook = scraper.get_sportsbook_name()
        print(f"✅ Match {match_id}: {sportsbook}")
        
        driver = self.setup_driver()
        
        try:
            driver.get(url)
            scraper.wait_for_page_load(driver)
            
            iteration = 0
            while self.running:
                odds = scraper.get_odds(driver)
                iteration += 1
                
                if odds:
                    with self.odds_lock:
                        self.current_odds[match_id] = {
                            'sportsbook': sportsbook,
                            'url': url,
                            'timestamp': datetime.now().isoformat(),
                            'odds': odds
                        }
                elif iteration % 10 == 0:
                    print(f"⚠️  Match {match_id} ({sportsbook}): Still trying to extract odds...")
                
                time.sleep(interval)
        
        except Exception as e:
            print(f"❌ Match {match_id} ({sportsbook}) error: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            driver.quit()
    
    def normalize_player_name(self, name: str) -> str:
        """Normalize player names for matching - handles both full and abbreviated names"""
        name = ' '.join(name.split()).lower()
        name = name.replace('vs', '').replace('(', '').replace(')', '').strip()
        
        parts = name.split()
        
        if len(parts) >= 2:
            first_part = parts[0].replace('.', '').strip()
            
            if len(first_part) == 1:
                return ' '.join(parts[1:])
            else:
                return parts[-1]
        
        return name
    
    def calculate_arbitrage(self, player_odds_data: dict) -> dict:
        """
        Calculate arbitrage opportunity across ALL sportsbooks
        Works with 2+ sportsbooks by finding best odds for each player
        Returns dict with arbitrage info or None if no opportunity
        """
        if len(player_odds_data) != 2:
            return None
        
        players = list(player_odds_data.keys())
        player1_books = player_odds_data[players[0]]
        player2_books = player_odds_data[players[1]]
        
        # Find best odds for each player across all books
        best_player1 = None
        best_player1_book = None
        best_player1_decimal = 0
        
        for book, data in player1_books.items():
            decimal = data['numeric']
            if decimal > best_player1_decimal:
                best_player1_decimal = decimal
                best_player1 = data
                best_player1_book = book
        
        best_player2 = None
        best_player2_book = None
        best_player2_decimal = 0
        
        for book, data in player2_books.items():
            decimal = data['numeric']
            if decimal > best_player2_decimal:
                best_player2_decimal = decimal
                best_player2 = data
                best_player2_book = book
        
        if not best_player1 or not best_player2:
            return None
        
        if best_player1_decimal <= 1 or best_player2_decimal <= 1:
            return None
        
        # IMPORTANT: Can't arbitrage if both best odds are on same book
        if best_player1_book == best_player2_book:
            return self._find_cross_book_arbitrage(player_odds_data)
        
        # Calculate implied probabilities
        implied_prob1 = 1 / best_player1_decimal
        implied_prob2 = 1 / best_player2_decimal
        
        total_prob = implied_prob1 + implied_prob2
        
        # Arbitrage exists if total probability < 1
        if total_prob < 1:
            profit_percentage = ((1 / total_prob) - 1) * 100
            
            stake1 = (implied_prob1 / total_prob) * 100
            stake2 = (implied_prob2 / total_prob) * 100
            
            payout1 = stake1 * best_player1_decimal
            payout2 = stake2 * best_player2_decimal
            profit = min(payout1, payout2) - 100
            
            return {
                'exists': True,
                'profit_percentage': profit_percentage,
                'profit_amount': profit,
                'total_stake': 100,
                'player1': {
                    'name': best_player1['original_name'],
                    'book': best_player1_book,
                    'odds': best_player1['odds'],
                    'decimal': best_player1_decimal,
                    'stake': stake1,
                    'payout': payout1
                },
                'player2': {
                    'name': best_player2['original_name'],
                    'book': best_player2_book,
                    'odds': best_player2['odds'],
                    'decimal': best_player2_decimal,
                    'stake': stake2,
                    'payout': payout2
                }
            }
        
        return None
    
    def _find_cross_book_arbitrage(self, player_odds_data: dict) -> dict:
        """
        Fallback method to find arbitrage when best odds are on same book
        Checks all cross-book combinations
        """
        players = list(player_odds_data.keys())
        player1_books = player_odds_data[players[0]]
        player2_books = player_odds_data[players[1]]
        
        best_arb = None
        
        for book1, data1 in player1_books.items():
            for book2, data2 in player2_books.items():
                if book1 == book2:
                    continue
                
                decimal1 = data1['numeric']
                decimal2 = data2['numeric']
                
                if decimal1 <= 1 or decimal2 <= 1:
                    continue
                
                implied_prob1 = 1 / decimal1
                implied_prob2 = 1 / decimal2
                total_prob = implied_prob1 + implied_prob2
                
                if total_prob < 1:
                    profit_percentage = ((1 / total_prob) - 1) * 100
                    
                    stake1 = (implied_prob1 / total_prob) * 100
                    stake2 = (implied_prob2 / total_prob) * 100
                    
                    payout1 = stake1 * decimal1
                    payout2 = stake2 * decimal2
                    profit = min(payout1, payout2) - 100
                    
                    arb_data = {
                        'exists': True,
                        'profit_percentage': profit_percentage,
                        'profit_amount': profit,
                        'total_stake': 100,
                        'player1': {
                            'name': data1['original_name'],
                            'book': book1,
                            'odds': data1['odds'],
                            'decimal': decimal1,
                            'stake': stake1,
                            'payout': payout1
                        },
                        'player2': {
                            'name': data2['original_name'],
                            'book': book2,
                            'odds': data2['odds'],
                            'decimal': decimal2,
                            'stake': stake2,
                            'payout': payout2
                        }
                    }
                    
                    if best_arb is None or arb_data['profit_percentage'] > best_arb['profit_percentage']:
                        best_arb = arb_data
        
        return best_arb
    
    def compare_and_display(self):
        """Compare odds and display differences"""
        with self.odds_lock:
            num_books = len(self.current_odds)
            if num_books < 2:
                print(f"⚠️  Waiting for data from sportsbooks... ({num_books} ready, need 2+)")
                return
            
            matches = list(self.current_odds.values())
            
            has_data = all(match.get('odds') for match in matches)
            if not has_data:
                print(f"⚠️  Waiting for odds data from all sources...")
                for idx, match in enumerate(matches, 1):
                    odds_count = len(match.get('odds', []))
                    print(f"   Match {idx} ({match['sportsbook']}): {odds_count} players found")
                return
            
            # Create player mapping
            player_odds = defaultdict(dict)
            
            for match in matches:
                sportsbook = match['sportsbook']
                for player_data in match['odds']:
                    player_name = player_data['player']
                    normalized_name = self.normalize_player_name(player_name)
                    odds_value = player_data['odds']
                    
                    player_odds[normalized_name][sportsbook] = {
                        'original_name': player_name,
                        'odds': odds_value,
                        'numeric': self.convert_odds_to_decimal(odds_value)
                    }
            
            # Check if we found matching players
            matching_players = [player for player, books in player_odds.items() if len(books) >= 2]
            
            if not matching_players:
                print(f"⚠️  No matching players found across sportsbooks")
                print(f"\n   Players found:")
                for match in matches:
                    print(f"   {match['sportsbook']}:")
                    for player_data in match['odds']:
                        normalized = self.normalize_player_name(player_data['player'])
                        print(f"     - {player_data['player']} (normalized: '{normalized}')")
                return
            
            # Calculate arbitrage
            arbitrage = self.calculate_arbitrage(player_odds)
            
            # Display comparison
            timestamp = datetime.now().strftime("%H:%M:%S")
            sportsbooks_str = ', '.join([m['sportsbook'] for m in matches])
            print(f"\n{'='*80}")
            print(f"⏰ [{timestamp}] 📊 ODDS COMPARISON ({num_books} sportsbooks)")
            print(f"{'='*80}")
            print(f"📚 Books: {sportsbooks_str}")
            
            comparison_data = {
                'timestamp': datetime.now().isoformat(),
                'players': {},
                'arbitrage': None
            }
            
            # Display individual player odds
            for player, books in player_odds.items():
                if len(books) >= 2:
                    print(f"\n🎾 Player: {list(books.values())[0]['original_name']}")
                    print("-" * 80)
                    
                    player_comparison = {}
                    best_odds = None
                    best_book = None
                    
                    # Sort books by odds (best first)
                    sorted_books = sorted(books.items(), key=lambda x: x[1]['numeric'], reverse=True)
                    
                    for sportsbook, data in sorted_books:
                        odds_str = data['odds']
                        decimal = data['numeric']
                        implied_prob = (1 / decimal) * 100 if decimal > 0 else 0
                        
                        # Mark best odds
                        marker = "⭐" if best_odds is None else "  "
                        print(f"{marker} 📚 {sportsbook:15s} → {odds_str:8s} (Decimal: {decimal:.3f}, Implied: {implied_prob:.2f}%)")
                        
                        player_comparison[sportsbook] = {
                            'odds': odds_str,
                            'decimal': decimal,
                            'implied_probability': implied_prob
                        }
                        
                        if best_odds is None:
                            best_odds = decimal
                            best_book = sportsbook
                    
                    # Show advantage of best book over others
                    if best_book and len(books) > 1:
                        print(f"\n  💰 BEST ODDS: {best_book}")
                        for book, data in books.items():
                            if book != best_book:
                                diff = best_odds - data['numeric']
                                percentage_diff = (diff / data['numeric']) * 100
                                print(f"     vs {book}: +{percentage_diff:.2f}% better")
                        
                        player_comparison['best_book'] = best_book
                    
                    comparison_data['players'][player] = player_comparison
            
            # Display arbitrage opportunity
            print(f"\n{'='*80}")
            print(f"💎 ARBITRAGE ANALYSIS")
            print(f"{'='*80}")
            
            if arbitrage:
                comparison_data['arbitrage'] = arbitrage
                self.odds_history['arbitrage_opportunities'].append({
                    'timestamp': datetime.now().isoformat(),
                    'arbitrage': arbitrage
                })
                
                if not self.arbitrage_found:
                    self.arbitrage_found = True
                    print(f"\n🚨 🚨 🚨 ARBITRAGE OPPORTUNITY DETECTED! 🚨 🚨 🚨\n")
                
                print(f"✅ ARBITRAGE EXISTS!")
                print(f"   Profit: {arbitrage['profit_percentage']:.3f}% (${arbitrage['profit_amount']:.2f} on $100)")
                print(f"\n📋 Optimal Betting Strategy (Total: ${arbitrage['total_stake']:.2f}):")
                print(f"\n   BET 1:")
                print(f"   🎾 Player:     {arbitrage['player1']['name']}")
                print(f"   📚 Sportsbook: {arbitrage['player1']['book']}")
                print(f"   💵 Odds:       {arbitrage['player1']['odds']} (Decimal: {arbitrage['player1']['decimal']:.3f})")
                print(f"   💰 Stake:      ${arbitrage['player1']['stake']:.2f}")
                print(f"   🏆 Payout:     ${arbitrage['player1']['payout']:.2f}")
                
                print(f"\n   BET 2:")
                print(f"   🎾 Player:     {arbitrage['player2']['name']}")
                print(f"   📚 Sportsbook: {arbitrage['player2']['book']}")
                print(f"   💵 Odds:       {arbitrage['player2']['odds']} (Decimal: {arbitrage['player2']['decimal']:.3f})")
                print(f"   💰 Stake:      ${arbitrage['player2']['stake']:.2f}")
                print(f"   🏆 Payout:     ${arbitrage['player2']['payout']:.2f}")
                
                print(f"\n   ✨ GUARANTEED PROFIT: ${arbitrage['profit_amount']:.2f}")
                
                print(f"\n📊 Profit for Different Stakes:")
                for stake in [100, 500, 1000, 5000, 10000]:
                    profit = (arbitrage['profit_percentage'] / 100) * stake
                    print(f"   ${stake:>6,} stake → ${profit:>8.2f} profit")
                
            else:
                print(f"❌ No arbitrage opportunity")
                print(f"   The market is efficient - no guaranteed profit available")
                
                players = list(player_odds.keys())
                if len(players) == 2:
                    p1_best = max(player_odds[players[0]].values(), key=lambda x: x['numeric'])
                    p2_best = max(player_odds[players[1]].values(), key=lambda x: x['numeric'])
                    
                    implied_total = (1 / p1_best['numeric'] + 1 / p2_best['numeric']) * 100
                    
                    print(f"\n   Best odds combination across all books:")
                    print(f"   Player 1: {p1_best['odds']} (any book)")
                    print(f"   Player 2: {p2_best['odds']} (any book)")
                    print(f"   Combined implied probability: {implied_total:.2f}%")
                    print(f"   Bookmaker margin: {implied_total - 100:.2f}%")
                    print(f"   Need: <100% for arbitrage")
                    
                    # Show how close to arbitrage
                    gap = implied_total - 100
                    if gap < 5:
                        print(f"\n   🔥 CLOSE! Only {gap:.2f}% away from arbitrage")
                    elif gap < 10:
                        print(f"\n   📊 Fairly tight market ({gap:.2f}% margin)")
            
            self.odds_history['comparisons'].append(comparison_data)
            
            print(f"\n{'='*80}\n")
    
    def convert_odds_to_decimal(self, odds_str: str) -> float:
        """Convert American odds to decimal odds"""
        try:
            odds_str = odds_str.strip().replace('+', '').replace('−', '-').replace('–', '-')
            odds = int(odds_str)
            
            if odds > 0:
                return (odds / 100) + 1
            else:
                return (100 / abs(odds)) + 1
        except:
            return 0.0
    
    def save_comparison_data(self, filename: str = None):
        """Save comparison history to JSON"""
        data_dir = Path("data")
        data_dir.mkdir(exist_ok=True)
        
        if filename is None:
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"comparison_{timestamp_str}.json"
        
        filepath = data_dir / filename
        
        self.odds_history['end_time'] = datetime.now().isoformat()
        
        with open(filepath, 'w') as f:
            json.dump(self.odds_history, f, indent=2)
        
        return filepath
    
    def run(self, urls: list, interval: int = 2, display_interval: int = 5):
        """Run comparison monitoring - supports 2+ sportsbooks"""
        print("🎾 LineJudge - Multi-Sportsbook Odds Comparison & Arbitrage Detector")
        print("=" * 80)
        print(f"📊 Comparing {len(urls)} sportsbooks")
        print(f"⏱️  Fetch interval: {interval}s | Display interval: {display_interval}s")
        print(f"💎 Arbitrage detection: ENABLED")
        print(f"🔍 Strategy: Find best odds across ALL books for each player")
        print("Press Ctrl+C to stop\n")
        
        for idx, url in enumerate(urls, 1):
            factory = ScraperFactory()
            scraper = factory.get_scraper(url)
            if scraper:
                self.odds_history['matches'].append({
                    'match_id': idx,
                    'sportsbook': scraper.get_sportsbook_name(),
                    'url': url
                })
        
        threads = []
        for idx, url in enumerate(urls, 1):
            thread = Thread(target=self.monitor_single_match, args=(url, idx, interval))
            thread.daemon = True
            thread.start()
            threads.append(thread)
        
        time.sleep(2)
        
        try:
            last_display = 0
            while True:
                current_time = time.time()
                if current_time - last_display >= display_interval:
                    self.compare_and_display()
                    last_display = current_time
                
                time.sleep(1)
        
        except KeyboardInterrupt:
            print("\n\n⏹️  Stopping comparison...")
            self.running = False
            
            for thread in threads:
                thread.join(timeout=2)
            
            if self.odds_history['comparisons']:
                filepath = self.save_comparison_data()
                print(f"💾 Comparison data saved to: {filepath}")
                print(f"📈 Total comparisons: {len(self.odds_history['comparisons'])}")
                
                if self.odds_history['arbitrage_opportunities']:
                    print(f"💎 Arbitrage opportunities found: {len(self.odds_history['arbitrage_opportunities'])}")
                    profits = [opp['arbitrage']['profit_percentage'] for opp in self.odds_history['arbitrage_opportunities']]
                    print(f"   Best profit: {max(profits):.3f}%")
                    print(f"   Average profit: {sum(profits)/len(profits):.3f}%")
                else:
                    print(f"❌ No arbitrage opportunities detected")
            else:
                print("⚠️  No comparison data collected")
            
            print("✅ Comparison complete. Thanks for using LineJudge!")

def show_help():
    """Show usage examples"""
    print("""
📖 Usage Examples:

1. Compare matches (interactive - supports 2+ sportsbooks):
   python compare_odds.py

2. Compare with custom intervals:
   python compare_odds.py --fetch-interval 2 --display-interval 10

3. Compare 3+ sportsbooks (CLI):
   python compare_odds.py \\
     "https://sportsbook.draftkings.com/event/..." \\
     "https://www.nv.betmgm.com/en/sports/events/..." \\
     "https://www.pinnacle.com/en/tennis/..."

💡 Tips:
- Works with 2 or more sportsbooks
- More sportsbooks = better chance of finding arbitrage
- The script automatically finds the best odds across all books
- Arbitrage detected when combined probability < 100%
- All data is saved to data/comparison_*.json

💎 About Arbitrage:
- Arbitrage exists when you can bet on all outcomes and guarantee profit
- With 3+ books, you get best odds from each book independently
- The tool finds optimal betting strategy automatically
- Risk-free profit if executed correctly (account for fees/limits)

🎯 Recommended Setup:
- 2 books: 15-25% chance of arbitrage
- 3 books: 35-50% chance of arbitrage
- 5+ books: 60-75% chance of arbitrage
""")

if __name__ == "__main__":
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Compare tennis odds across 2+ sportsbooks with arbitrage detection')
    parser.add_argument('urls', nargs='*', help='Match URLs to compare (2 or more)')
    parser.add_argument('--fetch-interval', type=int, default=2, help='Seconds between fetches (default: 2)')
    parser.add_argument('--display-interval', type=int, default=5, help='Seconds between displays (default: 5)')
    parser.add_argument('--help-examples', action='store_true', help='Show usage examples')
    
    args = parser.parse_args()
    
    if args.help_examples:
        show_help()
        sys.exit(0)
    
    urls = args.urls
    
    if not urls:
        print("🎾 LineJudge - Multi-Sportsbook Odds Comparison & Arbitrage Detector")
        print("=" * 80)
        print("Enter URLs for the SAME match from different sportsbooks")
        print("(Enter at least 2, more is better for arbitrage detection)\n")
        
        urls = []
        i = 1
        while True:
            url = input(f"Match URL #{i} (or press Enter to finish): ").strip()
            if not url:
                break
            urls.append(url)
            i += 1
        
        if len(urls) < 2:
            print("❌ Need at least 2 URLs to compare")
            sys.exit(1)
    
    print(f"\n🎯 Monitoring {len(urls)} sportsbooks for arbitrage opportunities...")
    comparator = OddsComparator()
    comparator.run(urls, interval=args.fetch_interval, display_interval=args.display_interval)