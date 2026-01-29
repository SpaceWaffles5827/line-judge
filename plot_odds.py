"""
plot_odds.py - Professional visualization of odds data from single monitoring or comparison sessions
"""
import json
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle, Patch
from datetime import datetime
from pathlib import Path
import sys
import numpy as np

# Set professional style
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica', 'DejaVu Sans']
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 13
plt.rcParams['xtick.labelsize'] = 9
plt.rcParams['ytick.labelsize'] = 9
plt.rcParams['legend.fontsize'] = 9
plt.rcParams['figure.titlesize'] = 15

# Professional color palette
COLORS = {
    'BetMGM': '#2E7D32',      # Dark Green
    'DraftKings': '#D32F2F',   # Red
    'FanDuel': '#1565C0',      # Blue
    'Caesars': '#F57C00',      # Orange
    'PointsBet': '#7B1FA2',    # Purple
    'primary': '#1f77b4',
    'secondary': '#ff7f0e',
    'success': '#2ca02c',
    'danger': '#d62728',
    'warning': '#ff9800',
    'info': '#2196F3'
}

MARKERS = {
    'BetMGM': 'o',
    'DraftKings': 's',
    'FanDuel': '^',
    'Caesars': 'D',
    'PointsBet': 'v'
}

def convert_american_odds_to_decimal(american_odds):
    """Convert American odds to decimal for easier plotting"""
    odds_str = str(american_odds).strip().replace('−', '-').replace('–', '-')
    
    if odds_str.startswith('+'):
        odds_int = int(odds_str)
        return (odds_int / 100) + 1
    elif odds_str.startswith('-'):
        odds_int = int(odds_str)
        return (100 / abs(odds_int)) + 1
    else:
        try:
            return float(odds_str)
        except:
            return None

def load_odds_data(filename):
    """Load odds data from JSON file"""
    filepath = Path("data") / filename
    
    if not filepath.exists():
        print(f"❌ File not found: {filepath}")
        return None
    
    with open(filepath, 'r') as f:
        return json.load(f)

def is_comparison_data(data):
    """Check if data is from comparison or single monitoring"""
    return 'comparisons' in data and 'matches' in data

def format_time_axis(ax, timestamps):
    """Format time axis professionally"""
    if not timestamps:
        return
    
    duration = (timestamps[-1] - timestamps[0]).total_seconds()
    
    if duration < 300:  # Less than 5 minutes
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    elif duration < 3600:  # Less than 1 hour
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
    else:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
    
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)

def add_info_box(fig, info_text, position='bottom_right'):
    """Add professional info box to figure"""
    if position == 'bottom_right':
        fig.text(0.98, 0.02, info_text, ha='right', va='bottom',
                fontsize=9, family='monospace',
                bbox=dict(boxstyle='round,pad=0.7', 
                         facecolor='white', 
                         edgecolor='gray',
                         alpha=0.9,
                         linewidth=1))

def plot_single_odds(data):
    """Plot odds from single sportsbook monitoring with professional styling"""
    if not data or not data.get('data'):
        print("❌ No data to plot")
        return
    
    # Extract data
    timestamps = []
    players_odds_decimal = {}
    players_odds_american = {}
    
    for point in data['data']:
        timestamp = datetime.fromisoformat(point['timestamp'])
        timestamps.append(timestamp)
        
        for player, odds in point['players'].items():
            if player not in players_odds_decimal:
                players_odds_decimal[player] = []
                players_odds_american[player] = []
            
            decimal_odds = convert_american_odds_to_decimal(odds)
            players_odds_decimal[player].append(decimal_odds)
            
            odds_clean = odds.replace('+', '').replace('−', '-').replace('–', '-')
            players_odds_american[player].append(int(odds_clean))
    
    # Create figure with white background
    fig = plt.figure(figsize=(16, 11), facecolor='white')
    gs = fig.add_gridspec(3, 2, height_ratios=[2.5, 2.5, 1.2], hspace=0.4, wspace=0.35,
                          top=0.93, bottom=0.08, left=0.08, right=0.95)
    
    sportsbook = data.get('sportsbook', 'Unknown')
    fig.suptitle(f'LineJudge Odds Analysis - {sportsbook}', 
                 fontsize=18, fontweight='bold', y=0.97)
    
    # Plot 1: Decimal odds
    ax1 = fig.add_subplot(gs[0, :])
    
    player_names = list(players_odds_decimal.keys())
    for i, (player, odds) in enumerate(players_odds_decimal.items()):
        color = COLORS['primary'] if i == 0 else COLORS['secondary']
        ax1.plot(timestamps, odds, marker='o', markersize=4, 
                label=player, linewidth=2.5, color=color, alpha=0.8)
    
    ax1.set_ylabel('Decimal Odds', fontsize=12, fontweight='bold', labelpad=10)
    ax1.set_title('Decimal Odds Movement', fontsize=14, pad=20)
    ax1.legend(loc='upper left', framealpha=0.95, edgecolor='gray', fancybox=True)
    format_time_axis(ax1, timestamps)
    ax1.set_facecolor('#f8f9fa')
    ax1.tick_params(axis='both', which='major', pad=8)
    
    # Plot 2: American odds
    ax2 = fig.add_subplot(gs[1, :])
    
    for i, (player, odds) in enumerate(players_odds_american.items()):
        color = COLORS['primary'] if i == 0 else COLORS['secondary']
        ax2.plot(timestamps, odds, marker='s', markersize=4,
                label=player, linewidth=2.5, color=color, alpha=0.8)
    
    ax2.set_ylabel('American Odds', fontsize=12, fontweight='bold', labelpad=10)
    ax2.set_title('American Odds Movement', fontsize=14, pad=20)
    ax2.legend(loc='upper left', framealpha=0.95, edgecolor='gray', fancybox=True)
    ax2.axhline(y=0, color='black', linestyle='-', linewidth=1.5, alpha=0.3)
    format_time_axis(ax2, timestamps)
    ax2.set_facecolor('#f8f9fa')
    ax2.tick_params(axis='both', which='major', pad=8)
    
    # Plot 3: Odds changes summary (left)
    ax3 = fig.add_subplot(gs[2, 0])
    
    changes = []
    labels = []
    for player in player_names:
        unique_odds = len(set(players_odds_american[player]))
        changes.append(unique_odds - 1)
        # Truncate long names
        name = player.split()[-1] if len(player) > 15 else player
        labels.append(name)
    
    bars = ax3.barh(labels, changes, color=[COLORS['primary'], COLORS['secondary']], 
                    edgecolor='white', linewidth=1.5)
    ax3.set_xlabel('Number of Odds Changes', fontsize=11, fontweight='bold', labelpad=10)
    ax3.set_title('Odds Volatility', fontsize=12, pad=15)
    ax3.grid(axis='x', alpha=0.3, linestyle='--', linewidth=0.5)
    ax3.set_facecolor('#f8f9fa')
    ax3.tick_params(axis='both', which='major', pad=5)
    
    # Add value labels on bars with better spacing
    for bar in bars:
        width = bar.get_width()
        ax3.text(width + 0.3, bar.get_y() + bar.get_height()/2, 
                f'{int(width)}', ha='left', va='center', fontsize=10, fontweight='bold')
    
    # Adjust x-axis to accommodate labels
    ax3.set_xlim([0, max(changes) * 1.15])
    
    # Plot 4: Session statistics (right)
    ax4 = fig.add_subplot(gs[2, 1])
    ax4.axis('off')
    
    start_time = datetime.fromisoformat(data['start_time'])
    end_time = datetime.fromisoformat(data['end_time']) if 'end_time' in data else start_time
    duration = (end_time - start_time).total_seconds() / 60
    
    stats_text = "SESSION STATISTICS\n" + "─" * 35 + "\n\n"
    stats_text += f"Sportsbook:      {sportsbook}\n"
    stats_text += f"Start Time:      {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
    stats_text += f"Duration:        {duration:.1f} minutes\n"
    stats_text += f"Data Points:     {len(data['data'])}\n"
    stats_text += f"Players:         {len(player_names)}\n\n"
    
    for i, player in enumerate(player_names):
        # Truncate player name if too long
        display_name = player[:25] + "..." if len(player) > 25 else player
        stats_text += f"\n{display_name}:\n"
        stats_text += f"  Start:  {data['data'][0]['players'][player]}\n"
        stats_text += f"  End:    {data['data'][-1]['players'][player]}\n"
    
    ax4.text(0.05, 0.5, stats_text, fontsize=9.5, family='monospace',
            verticalalignment='center',
            bbox=dict(boxstyle='round,pad=1', facecolor='white', 
                     edgecolor='gray', alpha=0.9, linewidth=1))
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    
    # Save plot
    plots_dir = Path("plots")
    plots_dir.mkdir(exist_ok=True)
    
    plot_filename = f"odds_analysis_{sportsbook.lower().replace(' ', '_')}_{start_time.strftime('%Y%m%d_%H%M%S')}.png"
    plot_path = plots_dir / plot_filename
    plt.savefig(plot_path, dpi=300, bbox_inches='tight', facecolor='white', pad_inches=0.3)
    
    print(f"📊 Plot saved to: {plot_path}")
    plt.show()

def plot_comparison_odds(data):
    """Plot professional comparison across multiple sportsbooks"""
    if not data or not data.get('comparisons'):
        print("❌ No comparison data to plot")
        return
    
    comparisons = data['comparisons']
    
    # Extract data
    all_players = list(comparisons[0]['players'].keys()) if comparisons else []
    all_sportsbooks = set()
    
    for comp in comparisons:
        for player_data in comp.get('players', {}).values():
            for key in player_data.keys():
                if key not in ['best_book', 'advantage', 'implied_probability']:
                    all_sportsbooks.add(key)
    
    all_sportsbooks = sorted(list(all_sportsbooks))
    timestamps = [datetime.fromisoformat(comp['timestamp']) for comp in comparisons]
    
    # Determine layout
    has_arbitrage = bool(data.get('arbitrage_opportunities'))
    num_rows = 4 if has_arbitrage else 3
    height_ratios = [2.5, 2.5, 1.2, 1.5][:num_rows] if has_arbitrage else [2.5, 2.5, 1.2]
    
    # Create figure
    fig = plt.figure(figsize=(18, 7 if not has_arbitrage else 9.5), facecolor='white')
    gs = fig.add_gridspec(num_rows, 2, height_ratios=height_ratios,
                          hspace=0.45, wspace=0.3,
                          top=0.94, bottom=0.07, left=0.07, right=0.96)
    
    sportsbooks_str = ' vs '.join([m['sportsbook'] for m in data.get('matches', [])])
    fig.suptitle(f'LineJudge Multi-Sportsbook Analysis - {sportsbooks_str}', 
                 fontsize=18, fontweight='bold', y=0.97)
    
    # Plot 1 & 2: Odds for each player (side by side)
    for player_idx, player in enumerate(all_players):
        ax = fig.add_subplot(gs[0, player_idx])
        
        for book in all_sportsbooks:
            odds_decimal = []
            valid_times = []
            
            for i, comp in enumerate(comparisons):
                player_data = comp.get('players', {}).get(player, {})
                if book in player_data and 'decimal' in player_data[book]:
                    odds_decimal.append(player_data[book]['decimal'])
                    valid_times.append(timestamps[i])
            
            if odds_decimal:
                color = COLORS.get(book, '#000000')
                marker = MARKERS.get(book, 'o')
                ax.plot(valid_times, odds_decimal, 
                       marker=marker, markersize=5,
                       label=book, linewidth=2.5, 
                       color=color, alpha=0.85)
        
        ax.set_ylabel('Decimal Odds', fontsize=11, fontweight='bold', labelpad=10)
        ax.set_title(f'Player {player_idx + 1}: {player.title()}', 
                    fontsize=13, pad=18, fontweight='bold')
        ax.legend(loc='best', framealpha=0.95, edgecolor='gray', ncol=1, fancybox=True)
        format_time_axis(ax, timestamps)
        ax.set_facecolor('#f8f9fa')
        ax.tick_params(axis='both', which='major', pad=8)
    
    # Plot 3: Arbitrage indicator (full width)
    ax3 = fig.add_subplot(gs[1, :])
    
    implied_totals = []
    arb_exists_list = []
    
    for comp in comparisons:
        players_list = list(comp.get('players', {}).keys())
        if len(players_list) == 2:
            best_odds = []
            for player in players_list:
                player_data = comp['players'][player]
                max_decimal = 0
                for book in all_sportsbooks:
                    if book in player_data and 'decimal' in player_data[book]:
                        max_decimal = max(max_decimal, player_data[book]['decimal'])
                best_odds.append(max_decimal)
            
            if len(best_odds) == 2 and all(o > 0 for o in best_odds):
                implied_total = (1/best_odds[0] + 1/best_odds[1]) * 100
                implied_totals.append(implied_total)
                arb_exists_list.append(implied_total < 100)
            else:
                implied_totals.append(None)
                arb_exists_list.append(False)
        else:
            implied_totals.append(None)
            arb_exists_list.append(False)
    
    valid_times = [t for t, p in zip(timestamps, implied_totals) if p is not None]
    valid_implied = [p for p in implied_totals if p is not None]
    valid_arb = [a for a, p in zip(arb_exists_list, implied_totals) if p is not None]
    
    if valid_implied:
        # Create line plot
        ax3.plot(valid_times, valid_implied, color='#424242', 
                linewidth=2.5, alpha=0.6, zorder=1)
        
        # Add scatter points with colors
        colors_scatter = [COLORS['success'] if arb else COLORS['danger'] for arb in valid_arb]
        ax3.scatter(valid_times, valid_implied, c=colors_scatter, 
                   s=80, alpha=0.8, edgecolors='white', linewidth=1.5, zorder=2)
        
        # Add 100% threshold line
        ax3.axhline(y=100, color=COLORS['info'], linestyle='--', 
                   linewidth=2.5, label='Break-even (100%)', alpha=0.8, zorder=0)
        
        # Shade arbitrage regions
        for i in range(len(valid_times)-1):
            if valid_arb[i] and valid_arb[i+1]:
                ax3.axvspan(valid_times[i], valid_times[i+1], 
                           alpha=0.1, color=COLORS['success'], zorder=0)
        
        ax3.set_ylabel('Combined Probability (%)', fontsize=11, fontweight='bold', labelpad=10)
        ax3.set_title('Market Efficiency & Arbitrage Indicator', fontsize=13, pad=18)
        
        # Custom legend
        legend_elements = [
            Patch(facecolor=COLORS['success'], label='Arbitrage Exists (<100%)', alpha=0.8),
            Patch(facecolor=COLORS['danger'], label='No Arbitrage (>100%)', alpha=0.8),
            plt.Line2D([0], [0], color=COLORS['info'], linestyle='--', 
                      linewidth=2.5, label='Break-even')
        ]
        ax3.legend(handles=legend_elements, loc='upper right', 
                  framealpha=0.95, edgecolor='gray', fancybox=True)
        
        format_time_axis(ax3, timestamps)
        ax3.set_facecolor('#f8f9fa')
        ax3.tick_params(axis='both', which='major', pad=8)
        
        # Add y-axis limit with padding
        y_min = min(valid_implied) - 1
        y_max = max(valid_implied) + 1
        ax3.set_ylim([y_min, y_max])
    
    # Plot 4: Best value distribution (left)
    ax4 = fig.add_subplot(gs[2, 0])
    
    best_books = {}
    for comp in comparisons:
        for player_data in comp.get('players', {}).values():
            if 'best_book' in player_data:
                book = player_data['best_book']
                best_books[book] = best_books.get(book, 0) + 1
    
    if best_books:
        books = list(best_books.keys())
        counts = list(best_books.values())
        colors_bars = [COLORS.get(book, '#666666') for book in books]
        
        bars = ax4.barh(books, counts, color=colors_bars, alpha=0.85, 
                       edgecolor='white', linewidth=1.5)
        
        ax4.set_xlabel('Times Offering Best Value', fontsize=11, fontweight='bold', labelpad=10)
        ax4.set_title('Best Value Distribution', fontsize=12, pad=15)
        ax4.grid(axis='x', alpha=0.3, linestyle='--', linewidth=0.5)
        ax4.set_facecolor('#f8f9fa')
        ax4.tick_params(axis='both', which='major', pad=5)
        
        # Add percentage labels with better spacing
        total = sum(counts)
        max_count = max(counts)
        for bar in bars:
            width = bar.get_width()
            percentage = (width / total) * 100
            label_x = width + (max_count * 0.02)  # Dynamic spacing based on max value
            ax4.text(label_x, bar.get_y() + bar.get_height()/2,
                    f' {int(width)} ({percentage:.1f}%)',
                    ha='left', va='center', fontsize=9.5, fontweight='bold')
        
        # Adjust x-axis limit to accommodate labels
        ax4.set_xlim([0, max_count * 1.25])
    
    # Plot 5: Session statistics (right)
    ax5 = fig.add_subplot(gs[2, 1])
    ax5.axis('off')
    
    start_time = datetime.fromisoformat(data['start_time'])
    end_time = datetime.fromisoformat(data['end_time']) if 'end_time' in data else start_time
    duration = (end_time - start_time).total_seconds() / 60
    
    arb_count = len(data.get('arbitrage_opportunities', []))
    arb_opps = data.get('arbitrage_opportunities', [])
    
    stats_text = "SESSION STATISTICS\n" + "─" * 40 + "\n\n"
    stats_text += f"Sportsbooks:     {sportsbooks_str}\n"
    stats_text += f"Start Time:      {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
    stats_text += f"Duration:        {duration:.1f} minutes\n"
    stats_text += f"Comparisons:     {len(comparisons)}\n"
    stats_text += f"Players:         {len(all_players)}\n\n"
    
    stats_text += "ARBITRAGE ANALYSIS\n" + "─" * 40 + "\n"
    stats_text += f"Opportunities:   {arb_count}\n"
    
    if arb_opps:
        profits = [opp['arbitrage']['profit_percentage'] for opp in arb_opps]
        stats_text += f"Best Profit:     {max(profits):.3f}%\n"
        stats_text += f"Avg Profit:      {sum(profits)/len(profits):.3f}%\n"
        stats_text += f"Min Profit:      {min(profits):.3f}%\n"
    else:
        stats_text += "Status:          No opportunities\n"
    
    ax5.text(0.05, 0.5, stats_text, fontsize=9.5, family='monospace',
            verticalalignment='center',
            bbox=dict(boxstyle='round,pad=1', facecolor='white',
                     edgecolor='gray', alpha=0.9, linewidth=1))
    
    # Plot 6: Arbitrage profit timeline (if exists)
    if has_arbitrage and arb_opps:
        ax6 = fig.add_subplot(gs[3, :])
        
        arb_times = [datetime.fromisoformat(opp['timestamp']) for opp in arb_opps]
        arb_profits = [opp['arbitrage']['profit_percentage'] for opp in arb_opps]
        
        # Create filled area chart
        ax6.fill_between(arb_times, 0, arb_profits, 
                        alpha=0.3, color='gold', label='Profit %')
        ax6.plot(arb_times, arb_profits, marker='*', markersize=12,
                color='#F57F17', linewidth=2.5, label='Arbitrage Opportunity',
                markeredgecolor='white', markeredgewidth=1.5)
        
        ax6.set_ylabel('Profit Percentage (%)', fontsize=11, fontweight='bold', labelpad=10)
        ax6.set_title('💎 Arbitrage Profit Timeline', fontsize=13, pad=18, 
                     color='#F57F17', fontweight='bold')
        ax6.legend(loc='upper left', framealpha=0.95, edgecolor='gray', fancybox=True)
        ax6.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
        ax6.axhline(y=0, color='black', linestyle='-', linewidth=1, alpha=0.3)
        format_time_axis(ax6, arb_times)
        ax6.set_facecolor('#fffef0')
        ax6.tick_params(axis='both', which='major', pad=8)
        
        # Highlight max profit point with better annotation spacing
        max_idx = arb_profits.index(max(arb_profits))
        ax6.scatter([arb_times[max_idx]], [arb_profits[max_idx]], 
                   s=300, c='red', marker='*', zorder=5,
                   edgecolors='white', linewidth=2)
        ax6.annotate(f'Peak: {arb_profits[max_idx]:.3f}%',
                    xy=(arb_times[max_idx], arb_profits[max_idx]),
                    xytext=(15, 15), textcoords='offset points',
                    fontsize=10, fontweight='bold',
                    bbox=dict(boxstyle='round,pad=0.6', facecolor='yellow', alpha=0.9),
                    arrowprops=dict(arrowstyle='->', color='red', lw=2))
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    
    # Save plot
    plots_dir = Path("plots")
    plots_dir.mkdir(exist_ok=True)
    
    plot_filename = f"comparison_analysis_{start_time.strftime('%Y%m%d_%H%M%S')}.png"
    plot_path = plots_dir / plot_filename
    plt.savefig(plot_path, dpi=300, bbox_inches='tight', facecolor='white', pad_inches=0.3)
    
    print(f"📊 Plot saved to: {plot_path}")
    plt.show()

def print_single_summary(data):
    """Print professional summary for single monitoring"""
    if not data or not data.get('data'):
        return
    
    print("\n" + "=" * 70)
    print("📊 SINGLE SPORTSBOOK ANALYSIS SUMMARY")
    print("=" * 70)
    
    print(f"\n📚 Sportsbook: {data.get('sportsbook', 'Unknown')}")
    start_time = datetime.fromisoformat(data['start_time'])
    print(f"⏰ Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    if 'end_time' in data:
        end_time = datetime.fromisoformat(data['end_time'])
        duration = (end_time - start_time).total_seconds() / 60
        print(f"⏱️  Duration: {duration:.1f} minutes")
    
    print(f"📈 Data Points: {len(data['data'])}")
    
    all_players = set()
    for point in data['data']:
        all_players.update(point['players'].keys())
    
    print(f"\n👥 Players Tracked: {len(all_players)}")
    print("-" * 70)
    
    for player in all_players:
        odds_values = []
        for point in data['data']:
            if player in point['players']:
                odds_values.append(point['players'][player])
        
        if odds_values:
            changes = len(set(odds_values)) - 1
            print(f"\n🎾 {player}")
            print(f"   Opening:      {odds_values[0]}")
            print(f"   Closing:      {odds_values[-1]}")
            print(f"   Changes:      {changes}")
            print(f"   Volatility:   {'High' if changes > 5 else 'Medium' if changes > 2 else 'Low'}")
    
    print("\n" + "=" * 70)

def print_comparison_summary(data):
    """Print professional summary for comparison"""
    if not data or not data.get('comparisons'):
        return
    
    print("\n" + "=" * 70)
    print("📊 MULTI-SPORTSBOOK COMPARISON SUMMARY")
    print("=" * 70)
    
    matches = data.get('matches', [])
    sportsbooks = [m['sportsbook'] for m in matches]
    print(f"\n📚 Sportsbooks: {' vs '.join(sportsbooks)}")
    
    start_time = datetime.fromisoformat(data['start_time'])
    print(f"⏰ Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    if 'end_time' in data:
        end_time = datetime.fromisoformat(data['end_time'])
        duration = (end_time - start_time).total_seconds() / 60
        print(f"⏱️  Duration: {duration:.1f} minutes")
    
    comparisons = data['comparisons']
    print(f"📈 Comparisons: {len(comparisons)}")
    
    print("\n" + "─" * 70)
    print("💎 ARBITRAGE ANALYSIS")
    print("─" * 70)
    
    arb_opps = data.get('arbitrage_opportunities', [])
    print(f"Opportunities Detected: {len(arb_opps)}")
    
    if arb_opps:
        profits = [opp['arbitrage']['profit_percentage'] for opp in arb_opps]
        print(f"Best Profit:            {max(profits):.3f}%")
        print(f"Average Profit:         {sum(profits)/len(profits):.3f}%")
        print(f"Minimum Profit:         {min(profits):.3f}%")
        
        # Show best opportunity details
        best_opp = max(arb_opps, key=lambda x: x['arbitrage']['profit_percentage'])
        print(f"\n🏆 Best Opportunity:")
        print(f"   Time:    {datetime.fromisoformat(best_opp['timestamp']).strftime('%H:%M:%S')}")
        print(f"   Profit:  {best_opp['arbitrage']['profit_percentage']:.3f}%")
        print(f"   Player 1: {best_opp['arbitrage']['player1']['name']} @ {best_opp['arbitrage']['player1']['book']}")
        print(f"   Player 2: {best_opp['arbitrage']['player2']['name']} @ {best_opp['arbitrage']['player2']['book']}")
    else:
        print("Status:                 ❌ No opportunities found")
    
    print("\n" + "─" * 70)
    print("💰 BEST VALUE ANALYSIS")
    print("─" * 70)
    
    best_books = {}
    for comp in comparisons:
        for player_data in comp.get('players', {}).values():
            if 'best_book' in player_data:
                book = player_data['best_book']
                best_books[book] = best_books.get(book, 0) + 1
    
    if best_books:
        total = sum(best_books.values())
        for book, count in sorted(best_books.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total) * 100
            bar = '█' * int(percentage / 2)
            print(f"{book:15s} {bar:50s} {count:3d} times ({percentage:5.1f}%)")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    print("\n🎾 LineJudge Professional Odds Visualization Tool")
    print("=" * 70)
    
    if len(sys.argv) < 2:
        data_dir = Path("data")
        if data_dir.exists():
            json_files = sorted(list(data_dir.glob("*.json")), 
                              key=lambda x: x.stat().st_mtime, reverse=True)
            if json_files:
                print("\n📁 Available Data Files (Most Recent First):\n")
                for i, file in enumerate(json_files, 1):
                    mtime = datetime.fromtimestamp(file.stat().st_mtime)
                    file_type = "🔀 Comparison" if "comparison" in file.name else "📊 Single"
                    size = file.stat().st_size / 1024
                    print(f"  {i:2d}. {file_type} | {file.name:45s} | {mtime.strftime('%m/%d %H:%M')} | {size:6.1f} KB")
                
                print("\n" + "─" * 70)
                choice = input("Enter file number (or filename): ").strip()
                
                try:
                    file_idx = int(choice) - 1
                    if 0 <= file_idx < len(json_files):
                        filename = json_files[file_idx].name
                    else:
                        print("❌ Invalid selection")
                        sys.exit(1)
                except ValueError:
                    filename = choice if choice.endswith('.json') else f"{choice}.json"
            else:
                print("❌ No data files found in ./data directory")
                print("💡 Run monitor_single.py or compare_odds.py first to collect data")
                sys.exit(1)
        else:
            print("❌ No data directory found")
            print("💡 Run monitor_single.py or compare_odds.py first to collect data")
            sys.exit(1)
    else:
        filename = sys.argv[1]
    
    # Load data
    data = load_odds_data(filename)
    
    if data:
        # Determine data type and plot
        if is_comparison_data(data):
            print(f"\n✅ Detected: Comparison Data")
            print_comparison_summary(data)
            print("\n📊 Generating professional comparison visualization...")
            plot_comparison_odds(data)
        else:
            print(f"\n✅ Detected: Single Sportsbook Data")
            print_single_summary(data)
            print("\n📊 Generating professional visualization...")
            plot_single_odds(data)
        
        print("\n✨ Visualization complete!")