/**
 * Convert American odds to decimal format
 */
export function convertToDecimal(oddsStr: string): number {
  try {
    const odds = parseInt(
      oddsStr.replace("+", "").replace("−", "-").replace("–", "-"),
    );
    if (odds > 0) {
      return odds / 100 + 1;
    } else {
      return 100 / Math.abs(odds) + 1;
    }
  } catch {
    return 0;
  }
}

/**
 * Calculate implied probability from decimal odds
 */
export function getImpliedProbability(decimal: number): number {
  return decimal > 0 ? (1 / decimal) * 100 : 0;
}

/**
 * Get color for chart lines (cycles through predefined colors)
 */
export function getLineColor(index: number): string {
  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7c7c",
    "#a78bfa",
    "#fb923c",
    "#06b6d4",
    "#84cc16",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#eab308",
    "#f97316",
    "#dc2626",
    "#7c3aed",
    "#db2777",
  ];
  return colors[index % colors.length];
}

/**
 * Get human-readable label for timeframe
 */
export function getDurationLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    "1min": "1 Minute",
    "5min": "5 Minutes",
    "15min": "15 Minutes",
    "30min": "30 Minutes",
    "1hour": "1 Hour",
    "3hour": "3 Hours",
    all: "All Data",
  };
  return labels[timeframe] || "5 Minutes";
}

/**
 * Calculate how many data points to show based on timeframe
 */
export function getDataPointsForTimeframe(timeframe: string): number {
  switch (timeframe) {
    case "1min":
      return 30;
    case "5min":
      return 150;
    case "15min":
      return 450;
    case "30min":
      return 900;
    case "1hour":
      return 1800;
    case "3hour":
      return 5400;
    case "all":
      return Infinity;
    default:
      return 150;
  }
}
