import json
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from pathlib import Path
import sys

def convert_american_odds_to_decimal(american_odds):
    """Convert American odds to decimal for easier plotting"""
    odds_str = str(american_odds).strip()
    
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

def plot_odds(data):
    """Create a plot of odds over time"""
    if not data or not data.get('data'):
        print("❌ No data to plot")
        return
    
    # Extract data
    timestamps = []
    players_odds = {}
    
    for point in data['data']:
        timestamp = datetime.fromisoformat(point['timestamp'])
        timestamps.append(timestamp)
        
        for player, odds in point['players'].items():
            if player not in players_odds:
                players_odds[player] = []
            
            # Convert American odds to decimal
            decimal_odds = convert_american_odds_to_decimal(odds)
            players_odds[player].append(decimal_odds)
    
    # Create the plot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))
    fig.suptitle('🎾 LineJudge - Tennis Odds Analysis', fontsize=16, fontweight='bold')
    
    # Plot 1: Decimal odds over time
    colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']
    for i, (player, odds) in enumerate(players_odds.items()):
        ax1.plot(timestamps, odds, marker='o', markersize=3, 
                label=player, linewidth=2, color=colors[i % len(colors)])
    
    ax1.set_xlabel('Time', fontsize=12)
    ax1.set_ylabel('Decimal Odds', fontsize=12)
    ax1.set_title('Odds Movement Over Time (Decimal Format)', fontsize=14)
    ax1.legend(loc='best', fontsize=10)
    ax1.grid(True, alpha=0.3)
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    # Plot 2: American odds over time
    for point in data['data']:
        timestamp = datetime.fromisoformat(point['timestamp'])
        for player, odds in point['players'].items():
            if player not in players_odds:
                continue
            
    # For American odds, we'll just show the values
    for i, (player, _) in enumerate(players_odds.items()):
        american_odds = [int(data['data'][j]['players'][player].replace('+', '').replace('-', '')) * 
                        (-1 if data['data'][j]['players'][player].startswith('-') else 1)
                        for j in range(len(data['data']))]
        ax2.plot(timestamps, american_odds, marker='o', markersize=3,
                label=player, linewidth=2, color=colors[i % len(colors)])
    
    ax2.set_xlabel('Time', fontsize=12)
    ax2.set_ylabel('American Odds', fontsize=12)
    ax2.set_title('Odds Movement Over Time (American Format)', fontsize=14)
    ax2.legend(loc='best', fontsize=10)
    ax2.grid(True, alpha=0.3)
    ax2.axhline(y=0, color='black', linestyle='--', linewidth=1, alpha=0.5)
    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    # Add info text
    start_time = datetime.fromisoformat(data['start_time'])
    end_time = datetime.fromisoformat(data['end_time']) if 'end_time' in data else start_time
    duration = (end_time - start_time).total_seconds() / 60
    
    info_text = f"Start: {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
    info_text += f"Duration: {duration:.1f} minutes\n"
    info_text += f"Data points: {len(data['data'])}"
    
    fig.text(0.99, 0.01, info_text, ha='right', va='bottom', 
             fontsize=9, bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    
    # Save the plot
    plots_dir = Path("plots")
    plots_dir.mkdir(exist_ok=True)
    
    plot_filename = f"odds_plot_{start_time.strftime('%Y%m%d_%H%M%S')}.png"
    plot_path = plots_dir / plot_filename
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    
    print(f"📊 Plot saved to: {plot_path}")
    
    # Show the plot
    plt.show()

def print_summary(data):
    """Print summary statistics"""
    if not data or not data.get('data'):
        return
    
    print("\n" + "=" * 60)
    print("📊 ODDS SUMMARY")
    print("=" * 60)
    
    start_time = datetime.fromisoformat(data['start_time'])
    print(f"⏰ Session started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    if 'end_time' in data:
        end_time = datetime.fromisoformat(data['end_time'])
        duration = (end_time - start_time).total_seconds() / 60
        print(f"⏱️  Duration: {duration:.1f} minutes")
    
    print(f"📈 Total data points: {len(data['data'])}")
    
    # Get all unique players
    all_players = set()
    for point in data['data']:
        all_players.update(point['players'].keys())
    
    print(f"\n👥 Players tracked: {len(all_players)}")
    
    # For each player, show odds range
    for player in all_players:
        odds_values = []
        for point in data['data']:
            if player in point['players']:
                odds_str = point['players'][player]
                odds_values.append(odds_str)
        
        if odds_values:
            print(f"\n🎾 {player}:")
            print(f"   Starting odds: {odds_values[0]}")
            print(f"   Ending odds: {odds_values[-1]}")
            print(f"   Odds changes: {len(set(odds_values)) - 1}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # List available data files
        data_dir = Path("data")
        if data_dir.exists():
            json_files = list(data_dir.glob("*.json"))
            if json_files:
                print("📁 Available data files:")
                for i, file in enumerate(json_files, 1):
                    print(f"  {i}. {file.name}")
                
                choice = input("\nEnter file number to plot (or filename): ").strip()
                
                try:
                    file_idx = int(choice) - 1
                    if 0 <= file_idx < len(json_files):
                        filename = json_files[file_idx].name
                    else:
                        print("Invalid selection")
                        sys.exit(1)
                except ValueError:
                    filename = choice if choice.endswith('.json') else f"{choice}.json"
            else:
                print("❌ No data files found in ./data directory")
                print("Run linejudge.py first to collect data")
                sys.exit(1)
        else:
            print("❌ No data directory found")
            print("Run linejudge.py first to collect data")
            sys.exit(1)
    else:
        filename = sys.argv[1]
    
    # Load and plot data
    data = load_odds_data(filename)
    
    if data:
        print_summary(data)
        print("\n📊 Generating plot...")
        plot_odds(data)