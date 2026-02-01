'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Play, Square, Plus, X, TrendingUp, Activity, DollarSign, LineChart as LineChartIcon, AlertTriangle, Clock, Target, Download, Percent } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';

interface OddsDataPoint {
  timestamp: string;
  time: string;
  [key: string]: any;
}

interface PlayerOddsHistory {
  [playerName: string]: OddsDataPoint[];
}

interface MatchData {
  sportsbook: string;
  url: string;
  timestamp: string;
  odds: Array<{ player: string; odds: string }>;
  status: string;
  iteration?: number;
  consecutive_failures?: number;
}

export default function LineJudgePage() {
  const [urls, setUrls] = useState<string[]>(['', '']);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'stopped'>('idle');
  const [currentOdds, setCurrentOdds] = useState<Record<string, MatchData>>({});
  const [latestArbitrage, setLatestArbitrage] = useState<any>(null);
  const [stats, setStats] = useState({ totalComparisons: 0, totalArbitrageOpportunities: 0 });
  const [error, setError] = useState<string | null>(null);
  const [oddsHistory, setOddsHistory] = useState<PlayerOddsHistory>({});
  const [consolidatedHistory, setConsolidatedHistory] = useState<OddsDataPoint[]>([]);
  const [probabilityHistory, setProbabilityHistory] = useState<OddsDataPoint[]>([]);
  const [arbitrageHistory, setArbitrageHistory] = useState<any[]>([]);
  const [matchStatus, setMatchStatus] = useState<any>({});

  // Chart settings
  const [chartTimeframe, setChartTimeframe] = useState<'1min' | '5min' | '15min' | '30min' | '1hour' | '3hour' | 'all'>('5min');
  const [maxDataPoints, setMaxDataPoints] = useState<number>(150);
  const [consolidatedViewMode, setConsolidatedViewMode] = useState<'split' | 'combined'>('split');
  const [chartKey, setChartKey] = useState<number>(0);
  const updateCallCount = useRef<number>(0);

  const wsRef = useRef<WebSocket | null>(null);

  // Force chart re-render when probability history updates
  useEffect(() => {
    if (probabilityHistory.length > 0) {
      setChartKey(Date.now());
    }
  }, [probabilityHistory.length]);

  // Calculate how many data points to show based on timeframe
  const getDataPointsForTimeframe = (timeframe: string): number => {
    switch (timeframe) {
      case '1min': return 30;
      case '5min': return 150;
      case '15min': return 450;
      case '30min': return 900;
      case '1hour': return 1800;
      case '3hour': return 5400;
      case 'all': return Infinity;
      default: return 150;
    }
  };

  // Update max data points when timeframe changes
  useEffect(() => {
    const points = getDataPointsForTimeframe(chartTimeframe);
    setMaxDataPoints(points);
  }, [chartTimeframe]);

  // Convert American odds to decimal
  const convertToDecimal = (oddsStr: string): number => {
    try {
      const odds = parseInt(oddsStr.replace('+', '').replace('−', '-').replace('–', '-'));
      if (odds > 0) {
        return (odds / 100) + 1;
      } else {
        return (100 / Math.abs(odds)) + 1;
      }
    } catch {
      return 0;
    }
  };

  // Update odds history for graphing
  const updateOddsHistory = (currentOddsData: Record<string, MatchData>) => {
    updateCallCount.current += 1;
    const timestamp = new Date().toISOString();
    const time = new Date().toLocaleTimeString();

    console.log(`🔄 updateOddsHistory called #${updateCallCount.current} at:`, time);
    console.log('   Sources:', Object.keys(currentOddsData).length, 'sportsbooks');

    // Group odds by player
    const playerData: Record<string, any> = {};
    const consolidatedPoint: any = { timestamp, time };
    const probabilityPoint: any = { timestamp, time };

    // Track best odds per player (using normalized names as keys)
    const bestOddsPerPlayer: Record<string, {
      decimal: number;
      book: string;
      american: string;
      originalName: string;
    }> = {};

    // First pass: collect all data and normalize player names
    Object.entries(currentOddsData).forEach(([matchId, match]) => {
      if (match.odds && Array.isArray(match.odds)) {
        match.odds.forEach(({ player, odds }) => {
          // Normalize player name for consistent tracking
          const normalizedPlayer = player.trim();

          if (!playerData[normalizedPlayer]) {
            playerData[normalizedPlayer] = { timestamp, time };
          }
          const decimalOdds = convertToDecimal(odds);

          // Track best odds using normalized name
          if (!bestOddsPerPlayer[normalizedPlayer] || decimalOdds > bestOddsPerPlayer[normalizedPlayer].decimal) {
            bestOddsPerPlayer[normalizedPlayer] = {
              decimal: decimalOdds,
              book: match.sportsbook,
              american: odds,
              originalName: player
            };
          }

          // Add to player-specific data
          playerData[normalizedPlayer][match.sportsbook] = decimalOdds;
          playerData[normalizedPlayer][`${match.sportsbook}_american`] = odds;

          // Add to consolidated data
          const consolidatedKey = `${normalizedPlayer}_${match.sportsbook}`;
          consolidatedPoint[consolidatedKey] = decimalOdds;
          consolidatedPoint[`${consolidatedKey}_american`] = odds;
          consolidatedPoint[`${consolidatedKey}_player`] = normalizedPlayer;
          consolidatedPoint[`${consolidatedKey}_book`] = match.sportsbook;
        });
      }
    });

    // Calculate best odds and combined probability
    const players = Object.keys(bestOddsPerPlayer);
    console.log('   Players found:', players.length, '-', players.join(', '));

    if (players.length >= 2) {
      // Sort players to ensure consistent ordering
      const sortedPlayers = players.sort();
      const player1 = sortedPlayers[0];
      const player2 = sortedPlayers[1];

      const best1 = bestOddsPerPlayer[player1];
      const best2 = bestOddsPerPlayer[player2];

      console.log(`   Best odds: ${player1} = ${best1.decimal.toFixed(3)} @${best1.book}, ${player2} = ${best2.decimal.toFixed(3)} @${best2.book}`);

      // Store with consistent keys - use "player1" and "player2" as prefixes
      probabilityPoint.player1_best = best1.decimal;
      probabilityPoint.player1_best_book = best1.book;
      probabilityPoint.player1_best_american = best1.american;
      probabilityPoint.player1_name = player1;

      probabilityPoint.player2_best = best2.decimal;
      probabilityPoint.player2_best_book = best2.book;
      probabilityPoint.player2_best_american = best2.american;
      probabilityPoint.player2_name = player2;

      // Calculate combined implied probability
      const impliedProb1 = (1 / best1.decimal) * 100;
      const impliedProb2 = (1 / best2.decimal) * 100;
      const combinedProbability = impliedProb1 + impliedProb2;

      probabilityPoint.combinedProbability = combinedProbability;
      probabilityPoint.profit = combinedProbability < 100 ? ((100 / combinedProbability - 1) * 100) : 0;
      probabilityPoint.isArbitrage = combinedProbability < 100;

      console.log('✅ Adding complete probability point:', probabilityPoint.combinedProbability.toFixed(2) + '%', 'at', probabilityPoint.time);
    } else if (players.length === 1) {
      // Only one player found - still add a point but mark as incomplete
      const player = players[0];
      const best = bestOddsPerPlayer[player];

      probabilityPoint.player1_best = best.decimal;
      probabilityPoint.player1_best_book = best.book;
      probabilityPoint.player1_best_american = best.american;
      probabilityPoint.player1_name = player;

      probabilityPoint.combinedProbability = null;
      probabilityPoint.incomplete = true;

      console.log(`   ⚠️  Only 1 player found: ${player}`);
    } else {
      // No players - add empty point to maintain time continuity
      probabilityPoint.combinedProbability = null;
      probabilityPoint.incomplete = true;
      console.log('❌ No players found');
    }

    // Update individual player history
    setOddsHistory(prev => {
      const updated = { ...prev };
      Object.entries(playerData).forEach(([player, data]) => {
        if (!updated[player]) {
          updated[player] = [];
        }
        const newHistory = [...updated[player], data];
        updated[player] = maxDataPoints === Infinity
          ? newHistory
          : newHistory.slice(-maxDataPoints);
      });
      return updated;
    });

    // Update consolidated history
    setConsolidatedHistory(prev => {
      const newHistory = [...prev, consolidatedPoint];
      return maxDataPoints === Infinity
        ? newHistory
        : newHistory.slice(-maxDataPoints);
    });

    // Update probability history - ALWAYS add a point to maintain time continuity
    setProbabilityHistory(prev => {
      const newHistory = [...prev, probabilityPoint];
      const result = maxDataPoints === Infinity
        ? newHistory
        : newHistory.slice(-maxDataPoints);
      console.log('   Total probability points:', result.length);
      return result;
    });
  };

  // Filter data for display based on selected timeframe
  const getFilteredData = (data: OddsDataPoint[]): OddsDataPoint[] => {
    if (chartTimeframe === 'all' || !data || data.length === 0) {
      return data;
    }

    const pointsToShow = getDataPointsForTimeframe(chartTimeframe);
    return data.slice(-pointsToShow);
  };

  // Export data to JSON
  const exportData = () => {
    const exportData = {
      session: sessionId,
      exportTime: new Date().toISOString(),
      oddsHistory,
      consolidatedHistory,
      probabilityHistory,
      arbitrageHistory,
      stats,
      timeframe: chartTimeframe
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linejudge-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Connect to WebSocket
  const connectWebSocket = (sessionId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setStatus('active');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newCurrentOdds = data.currentOdds || {};

      setCurrentOdds(newCurrentOdds);
      setMatchStatus(data.matchStatus || {});

      // Update odds history for charts
      if (Object.keys(newCurrentOdds).length > 0) {
        updateOddsHistory(newCurrentOdds);
      }

      // Handle arbitrage
      if (data.latestArbitrage) {
        setLatestArbitrage(data.latestArbitrage);

        // Add to arbitrage history
        setArbitrageHistory(prev => {
          const newEntry = {
            ...data.latestArbitrage,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString()
          };
          return [...prev, newEntry].slice(-100);
        });
      }

      setStats({
        totalComparisons: data.totalComparisons || 0,
        totalArbitrageOpportunities: data.totalArbitrageOpportunities || 0,
      });
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection failed');
      setStatus('idle');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      if (status === 'active') setStatus('stopped');
    };

    wsRef.current = ws;
  };

  // Start monitoring
  const startMonitoring = async () => {
    const validUrls = urls.filter(url => url.trim() !== '');

    if (validUrls.length < 2) {
      setError('Please add at least 2 valid URLs');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      setOddsHistory({});
      setConsolidatedHistory([]);
      setProbabilityHistory([]);
      setArbitrageHistory([]);

      const response = await fetch('http://localhost:8000/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: validUrls,
          fetchInterval: 2,
          displayInterval: 5,
        }),
      });

      if (!response.ok) throw new Error('Failed to start session');

      const data = await response.json();
      setSessionId(data.sessionId);
      connectWebSocket(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
      setStatus('idle');
    }
  };

  // Stop monitoring
  const stopMonitoring = async () => {
    if (!sessionId) return;

    try {
      await fetch(`http://localhost:8000/stop?sessionId=${sessionId}`, {
        method: 'POST',
      });

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setStatus('stopped');
    } catch (err) {
      setError('Failed to stop monitoring');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const addUrlField = () => setUrls([...urls, '']);
  const removeUrlField = (index: number) => setUrls(urls.filter((_, i) => i !== index));
  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  // Get color for each player-book combination
  const getLineColor = (index: number) => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a78bfa', '#fb923c',
      '#06b6d4', '#84cc16', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
      '#14b8a6', '#eab308', '#f97316', '#dc2626', '#7c3aed', '#db2777'
    ];
    return colors[index % colors.length];
  };

  // Calculate implied probability
  const getImpliedProbability = (decimal: number): number => {
    return decimal > 0 ? (1 / decimal) * 100 : 0;
  };

  // Get duration label
  const getDurationLabel = () => {
    const labels = {
      '1min': '1 Minute',
      '5min': '5 Minutes',
      '15min': '15 Minutes',
      '30min': '30 Minutes',
      '1hour': '1 Hour',
      '3hour': '3 Hours',
      'all': 'All Data'
    };
    return labels[chartTimeframe];
  };

  // Get all unique player-book combinations for consolidated chart
  const getConsolidatedLines = () => {
    if (consolidatedHistory.length === 0) return [];

    // Look through ALL data points to find all unique lines
    const linesMap = new Map<string, { key: string; player: string; book: string }>();

    consolidatedHistory.forEach((dataPoint) => {
      Object.keys(dataPoint).forEach((key) => {
        if (key.endsWith('_player') || key.endsWith('_book') || key.endsWith('_american') || key === 'timestamp' || key === 'time') {
          return;
        }

        const playerKey = `${key}_player`;
        const bookKey = `${key}_book`;

        if (dataPoint[playerKey] && dataPoint[bookKey] && !linesMap.has(key)) {
          linesMap.set(key, {
            key,
            player: dataPoint[playerKey],
            book: dataPoint[bookKey]
          });
        }
      });
    });

    // Convert to array with colors
    const lines: Array<{ key: string; player: string; book: string; color: string }> = [];
    linesMap.forEach((value) => {
      lines.push({
        ...value,
        color: getLineColor(lines.length)
      });
    });

    return lines;
  };

  return (
    <div className="container mx-auto p-8 max-w-[1600px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">LineJudge</h1>
        <p className="text-muted-foreground">Multi-Sportsbook Arbitrage Detection with Real-Time Analytics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                {status.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Books</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(currentOdds).length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Object.values(currentOdds).filter(m => m.status === 'active').length} healthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combined Probability</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null
                ? `${probabilityHistory[probabilityHistory.length - 1].combinedProbability.toFixed(2)}%`
                : '-'}
            </div>
            <p className={`text-xs mt-1 ${probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null && probabilityHistory[probabilityHistory.length - 1].combinedProbability < 100 ? 'text-green-600 font-semibold' : 'text-muted-foreground'}`}>
              {probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null && probabilityHistory[probabilityHistory.length - 1].combinedProbability < 100
                ? '🎯 ARBITRAGE!'
                : probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability == null
                  ? 'Incomplete data'
                  : 'No arbitrage'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArbitrageOpportunities}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {arbitrageHistory.length > 0 && `Latest: ${arbitrageHistory[arbitrageHistory.length - 1]?.profit_percentage?.toFixed(2)}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Arbitrage Alert */}
      {latestArbitrage?.exists && (
        <Alert className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <TrendingUp className="h-4 w-4" />
          <AlertTitle className="text-lg font-bold">🚨 Arbitrage Opportunity Detected!</AlertTitle>
          <AlertDescription>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-4 text-lg font-semibold">
                <span>Profit: {latestArbitrage.profit_percentage?.toFixed(3)}%</span>
                <span className="text-green-600">${latestArbitrage.profit_amount?.toFixed(2)} on $100</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500">
                  <p className="text-sm font-semibold mb-2 text-blue-600">BET 1</p>
                  <p className="font-bold">{latestArbitrage.player1?.name}</p>
                  <p className="text-sm text-muted-foreground">{latestArbitrage.player1?.book}</p>
                  <p className="font-mono text-lg mt-2">{latestArbitrage.player1?.odds}</p>
                  <p className="text-sm mt-2">Decimal: {latestArbitrage.player1?.decimal?.toFixed(3)}</p>
                  <p className="text-lg font-bold mt-2 text-green-600">Stake: ${latestArbitrage.player1?.stake?.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Payout: ${latestArbitrage.player1?.payout?.toFixed(2)}</p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-500">
                  <p className="text-sm font-semibold mb-2 text-purple-600">BET 2</p>
                  <p className="font-bold">{latestArbitrage.player2?.name}</p>
                  <p className="text-sm text-muted-foreground">{latestArbitrage.player2?.book}</p>
                  <p className="font-mono text-lg mt-2">{latestArbitrage.player2?.odds}</p>
                  <p className="text-sm mt-2">Decimal: {latestArbitrage.player2?.decimal?.toFixed(3)}</p>
                  <p className="text-lg font-bold mt-2 text-green-600">Stake: ${latestArbitrage.player2?.stake?.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Payout: ${latestArbitrage.player2?.payout?.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="font-bold text-center text-lg">
                  ✨ Guaranteed Profit: ${latestArbitrage.profit_amount?.toFixed(2)}
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* URL Input Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Match URLs</CardTitle>
          <CardDescription>Add URLs from different sportsbooks for the same match</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {urls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="text"
                value={url}
                onChange={(e) => updateUrl(index, e.target.value)}
                placeholder="https://sportsbook.example.com/event/..."
                disabled={status === 'active'}
              />
              {urls.length > 2 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeUrlField(index)}
                  disabled={status === 'active'}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            onClick={addUrlField}
            disabled={status === 'active'}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add URL
          </Button>
        </CardContent>
      </Card>

      {/* Control Buttons */}
      <div className="flex gap-4 mb-8">
        <Button
          onClick={startMonitoring}
          disabled={status === 'active' || status === 'connecting'}
          size="lg"
          className="flex-1"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Monitoring
        </Button>
        <Button
          onClick={stopMonitoring}
          disabled={status !== 'active'}
          variant="destructive"
          size="lg"
          className="flex-1"
        >
          <Square className="h-4 w-4 mr-2" />
          Stop Monitoring
        </Button>
        <Button
          onClick={exportData}
          disabled={Object.keys(oddsHistory).length === 0}
          variant="outline"
          size="lg"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      {Object.keys(currentOdds).length > 0 && (
        <Tabs defaultValue="consolidated" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="consolidated">All Odds</TabsTrigger>
            <TabsTrigger value="best">Best Odds</TabsTrigger>
            <TabsTrigger value="probability">Probability %</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Arbitrage</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          {/* Consolidated Chart Tab */}
          <TabsContent value="consolidated" className="space-y-4">
            {/* Chart Timeframe Selector */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Chart Settings</CardTitle>
                    <CardDescription>View mode and timeframe controls</CardDescription>
                  </div>
                  <Badge variant="outline">{getDurationLabel()}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="viewmode">View Mode</Label>
                    <Select value={consolidatedViewMode} onValueChange={(value: any) => setConsolidatedViewMode(value)}>
                      <SelectTrigger id="viewmode">
                        <SelectValue placeholder="Select view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="split">📊 Split by Player (Recommended)</SelectItem>
                        <SelectItem value="combined">📈 Combined View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeframe">Display Timeframe</Label>
                    <Select value={chartTimeframe} onValueChange={(value: any) => setChartTimeframe(value)}>
                      <SelectTrigger id="timeframe">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1min">Last 1 Minute</SelectItem>
                        <SelectItem value="5min">Last 5 Minutes</SelectItem>
                        <SelectItem value="15min">Last 15 Minutes</SelectItem>
                        <SelectItem value="30min">Last 30 Minutes</SelectItem>
                        <SelectItem value="1hour">Last 1 Hour</SelectItem>
                        <SelectItem value="3hour">Last 3 Hours</SelectItem>
                        <SelectItem value="all">All Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Points</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {getFilteredData(consolidatedHistory).length} of {consolidatedHistory.length}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getConsolidatedLines().length} lines
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {consolidatedHistory.length > 0 ? (
              <>
                {/* SPLIT VIEW - Faceted by Player (Default/Recommended) */}
                {consolidatedViewMode === 'split' && (() => {
                  const playerGroups = new Map<string, Array<{ key: string; player: string; book: string; color: string }>>();

                  getConsolidatedLines().forEach(line => {
                    if (!playerGroups.has(line.player)) {
                      playerGroups.set(line.player, []);
                    }
                    playerGroups.get(line.player)!.push(line);
                  });

                  return Array.from(playerGroups.entries()).map(([playerName, playerLines]) => (
                    <Card key={playerName}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <LineChartIcon className="h-5 w-5" />
                          {playerName}
                        </CardTitle>
                        <CardDescription>
                          Comparing {playerLines.length} sportsbook{playerLines.length > 1 ? 's' : ''} - Click any point for details
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart data={getFilteredData(consolidatedHistory)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 11 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis
                              label={{ value: 'Decimal Odds', angle: -90, position: 'insideLeft' }}
                              domain={['dataMin - 0.05', 'dataMax + 0.05']}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
                                      <p className="font-semibold mb-2 text-sm">{payload[0].payload.time}</p>
                                      <div className="space-y-1">
                                        {payload.map((entry, index) => {
                                          const key = entry.dataKey as string;
                                          const americanKey = `${key}_american`;
                                          const bookKey = `${key}_book`;

                                          return (
                                            <div key={index} className="flex items-center gap-2 text-xs">
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: entry.color }}
                                              />
                                              <span className="font-medium">{entry.payload[bookKey]}</span>
                                              <span className="font-bold ml-auto">{entry.value?.toFixed(3)}</span>
                                              <span className="text-muted-foreground">
                                                ({entry.payload[americanKey]})
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: '12px' }}
                              formatter={(value) => {
                                const line = playerLines.find(l => l.key === value);
                                return line ? line.book : value;
                              }}
                            />
                            {playerLines.map((line) => (
                              <Line
                                key={line.key}
                                type="monotone"
                                dataKey={line.key}
                                name={line.key}
                                stroke={line.color}
                                strokeWidth={3}
                                dot={{ r: 3 }}
                                activeDot={{ r: 6 }}
                                connectNulls={true}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>

                        {/* Current Odds Summary */}
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-semibold mb-2">Current Odds Comparison:</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {playerLines.map((line) => {
                              const latestPoint = consolidatedHistory[consolidatedHistory.length - 1];
                              const currentOdds = latestPoint?.[line.key];
                              const americanOdds = latestPoint?.[`${line.key}_american`];

                              if (!currentOdds) return null;

                              const allOddsForPlayer = playerLines
                                .map(l => latestPoint?.[l.key])
                                .filter(Boolean);
                              const bestOdds = Math.max(...allOddsForPlayer);
                              const isBest = currentOdds === bestOdds;

                              return (
                                <div
                                  key={line.key}
                                  className={`p-2 rounded border-2 ${isBest ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: line.color }}
                                    />
                                    <span className="text-xs font-medium">{line.book}</span>
                                    {isBest && <span className="text-xs">🏆</span>}
                                  </div>
                                  <p className="font-mono font-bold text-sm">{currentOdds.toFixed(3)}</p>
                                  <p className="text-xs text-muted-foreground">{americanOdds}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ));
                })()}

                {/* COMBINED VIEW - All on One Chart */}
                {consolidatedViewMode === 'combined' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LineChartIcon className="h-5 w-5" />
                        All Players & Sportsbooks - Combined
                      </CardTitle>
                      <CardDescription>
                        Every odds line on one chart - {getConsolidatedLines().length} total lines
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={500}>
                        <LineChart data={getFilteredData(consolidatedHistory)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            label={{ value: 'Decimal Odds', angle: -90, position: 'insideLeft' }}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                                    <p className="font-semibold mb-3 text-sm">{payload[0].payload.time}</p>
                                    <div className="space-y-1">
                                      {payload.map((entry, index) => {
                                        const key = entry.dataKey as string;
                                        const americanKey = `${key}_american`;
                                        const playerKey = `${key}_player`;
                                        const bookKey = `${key}_book`;

                                        return (
                                          <div key={index} className="flex items-center gap-2 text-xs">
                                            <div
                                              className="w-3 h-3 rounded-full flex-shrink-0"
                                              style={{ backgroundColor: entry.color }}
                                            />
                                            <span className="font-medium">{entry.payload[playerKey]}</span>
                                            <span className="text-muted-foreground">@{entry.payload[bookKey]}</span>
                                            <span className="font-bold ml-auto">{entry.value?.toFixed(3)}</span>
                                            <span className="text-muted-foreground">
                                              ({entry.payload[americanKey]})
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '10px', maxHeight: '100px', overflowY: 'auto' }}
                            formatter={(value) => {
                              const lines = getConsolidatedLines();
                              const line = lines.find(l => l.key === value);
                              if (line) {
                                return `${line.player} @ ${line.book}`;
                              }
                              return value;
                            }}
                          />
                          {getConsolidatedLines().map((line) => (
                            <Line
                              key={line.key}
                              type="monotone"
                              dataKey={line.key}
                              name={line.key}
                              stroke={line.color}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              activeDot={{ r: 4 }}
                              connectNulls={true}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>

                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm font-semibold mb-2">All Tracked Lines:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {getConsolidatedLines().map((line, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: line.color }}
                              />
                              <span className="font-medium">{line.player}</span>
                              <span className="text-muted-foreground">@ {line.book}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <LineChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No data yet. Start monitoring to see odds charts.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Best Odds Tab - FIXED */}
          <TabsContent value="best" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Chart Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="best-timeframe">Display Timeframe</Label>
                    <Select value={chartTimeframe} onValueChange={(value: any) => setChartTimeframe(value)}>
                      <SelectTrigger id="best-timeframe">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1min">Last 1 Minute</SelectItem>
                        <SelectItem value="5min">Last 5 Minutes</SelectItem>
                        <SelectItem value="15min">Last 15 Minutes</SelectItem>
                        <SelectItem value="30min">Last 30 Minutes</SelectItem>
                        <SelectItem value="1hour">Last 1 Hour</SelectItem>
                        <SelectItem value="3hour">Last 3 Hours</SelectItem>
                        <SelectItem value="all">All Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Live Status</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {getFilteredData(probabilityHistory).length} of {probabilityHistory.length} points
                      </p>
                      {probabilityHistory.length > 0 && (
                        <>
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Last: {probabilityHistory[probabilityHistory.length - 1].time}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {probabilityHistory.length > 0 && probabilityHistory.some(p => p.player1_name && p.player2_name) ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Best Odds Across All Sportsbooks
                      </CardTitle>
                      <CardDescription>
                        Tracking the best available odds for each player over time
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{getDurationLabel()}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart key={`best-${chartKey}`} data={getFilteredData(probabilityHistory)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        label={{ value: 'Decimal Odds', angle: -90, position: 'insideLeft' }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg">
                                <p className="font-semibold mb-3">{data.time}</p>
                                <div className="space-y-2">
                                  {data.player1_name && data.player1_best && (
                                    <div className="border-b pb-2">
                                      <p className="text-sm font-bold text-blue-600">{data.player1_name}</p>
                                      <p className="text-xs">Best: {data.player1_best.toFixed(3)} @ {data.player1_best_book}</p>
                                      <p className="text-xs text-muted-foreground">({data.player1_best_american})</p>
                                    </div>
                                  )}
                                  {data.player2_name && data.player2_best && (
                                    <div className="border-b pb-2">
                                      <p className="text-sm font-bold text-green-600">{data.player2_name}</p>
                                      <p className="text-xs">Best: {data.player2_best.toFixed(3)} @ {data.player2_best_book}</p>
                                      <p className="text-xs text-muted-foreground">({data.player2_best_american})</p>
                                    </div>
                                  )}
                                  {data.combinedProbability != null && (
                                    <div className={`pt-2 ${data.combinedProbability < 100 ? 'text-green-600 font-bold' : ''}`}>
                                      <p className="text-xs">Combined: {data.combinedProbability.toFixed(2)}%</p>
                                      {data.combinedProbability < 100 && (
                                        <p className="text-xs">Profit: {data.profit?.toFixed(3)}%</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="player1_best"
                        name={probabilityHistory.find(p => p.player1_name)?.player1_name || 'Player 1'}
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="player2_best"
                        name={probabilityHistory.find(p => p.player2_name)?.player2_name || 'Player 2'}
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Current Best Odds Info */}
                  {(() => {
                    const latest = probabilityHistory[probabilityHistory.length - 1];
                    return (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {latest.player1_name && latest.player1_best && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border-2 border-blue-500">
                            <p className="text-sm font-semibold text-blue-600 mb-2">{latest.player1_name}</p>
                            <p className="text-2xl font-bold">{latest.player1_best.toFixed(3)}</p>
                            <p className="text-sm text-muted-foreground">@ {latest.player1_best_book}</p>
                            <p className="text-xs font-mono mt-1">({latest.player1_best_american})</p>
                          </div>
                        )}
                        {latest.player2_name && latest.player2_best && (
                          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-500">
                            <p className="text-sm font-semibold text-green-600 mb-2">{latest.player2_name}</p>
                            <p className="text-2xl font-bold">{latest.player2_best.toFixed(3)}</p>
                            <p className="text-sm text-muted-foreground">@ {latest.player2_best_book}</p>
                            <p className="text-xs font-mono mt-1">({latest.player2_best_american})</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No data yet. Start monitoring to see best odds charts.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Combined Probability Tab - FIXED */}
          <TabsContent value="probability" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Chart Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prob-timeframe">Display Timeframe</Label>
                    <Select value={chartTimeframe} onValueChange={(value: any) => setChartTimeframe(value)}>
                      <SelectTrigger id="prob-timeframe">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1min">Last 1 Minute</SelectItem>
                        <SelectItem value="5min">Last 5 Minutes</SelectItem>
                        <SelectItem value="15min">Last 15 Minutes</SelectItem>
                        <SelectItem value="30min">Last 30 Minutes</SelectItem>
                        <SelectItem value="1hour">Last 1 Hour</SelectItem>
                        <SelectItem value="3hour">Last 3 Hours</SelectItem>
                        <SelectItem value="all">All Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Live Status</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {getFilteredData(probabilityHistory).length} of {probabilityHistory.length} points
                      </p>
                      {probabilityHistory.length > 0 && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          Last: {probabilityHistory[probabilityHistory.length - 1].time}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {probabilityHistory.length > 0 && probabilityHistory.some(p => p.combinedProbability != null) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Percent className="h-5 w-5" />
                        Combined Probability Tracker
                      </CardTitle>
                      <CardDescription>
                        Monitor when combined probability drops below 100% (arbitrage opportunity)
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{getDurationLabel()}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart key={`prob-${chartKey}`} data={getFilteredData(probabilityHistory).filter(p => p.combinedProbability != null)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        label={{ value: 'Combined Probability %', angle: -90, position: 'insideLeft' }}
                        domain={[95, 110]}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg">
                                <p className="font-semibold mb-2">{data.time}</p>
                                <p className={`text-lg font-bold ${data.combinedProbability < 100 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.combinedProbability?.toFixed(3)}%
                                </p>
                                {data.combinedProbability < 100 && (
                                  <p className="text-sm text-green-600 mt-2">
                                    ✓ Arbitrage: {data.profit?.toFixed(3)}% profit
                                  </p>
                                )}
                                {data.combinedProbability >= 100 && (
                                  <p className="text-sm text-red-600 mt-2">
                                    ✗ No arbitrage ({(data.combinedProbability - 100).toFixed(3)}% over)
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <ReferenceLine
                        y={100}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{ value: 'Arbitrage Threshold (100%)', position: 'right', fill: '#ef4444', fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="combinedProbability"
                        name="Combined Probability"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.3}
                        strokeWidth={3}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Current Status */}
                  {probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null && (
                    <div className="mt-4">
                      {(() => {
                        const latest = probabilityHistory[probabilityHistory.length - 1];
                        const isArb = latest.combinedProbability < 100;
                        return (
                          <div className={`p-4 rounded-lg border-2 ${isArb ? 'bg-green-50 dark:bg-green-950 border-green-500' : 'bg-red-50 dark:bg-red-950 border-red-500'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold mb-1">Current Combined Probability</p>
                                <p className={`text-3xl font-bold ${isArb ? 'text-green-600' : 'text-red-600'}`}>
                                  {latest.combinedProbability.toFixed(3)}%
                                </p>
                              </div>
                              <div className="text-right">
                                {isArb ? (
                                  <>
                                    <p className="text-sm font-semibold text-green-600">🎯 ARBITRAGE!</p>
                                    <p className="text-2xl font-bold text-green-600">{latest.profit.toFixed(3)}%</p>
                                    <p className="text-xs text-muted-foreground">Profit Margin</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-semibold text-red-600">No Arbitrage</p>
                                    <p className="text-lg font-bold text-red-600">+{(latest.combinedProbability - 100).toFixed(3)}%</p>
                                    <p className="text-xs text-muted-foreground">Over 100%</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {probabilityHistory.length > 0 && !probabilityHistory.some(p => p.combinedProbability != null) && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Waiting for complete data from both players...</p>
                </CardContent>
              </Card>
            )}

            {probabilityHistory.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No data yet. Start monitoring to see probability charts.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Odds Comparison</CardTitle>
                <CardDescription>Real-time odds from all sportsbooks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.values(currentOdds).map((match, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: getLineColor(index) }}
                        />
                        <h3 className="font-semibold text-lg">{match.sportsbook}</h3>
                      </div>
                      <Badge variant={match.status === 'active' ? 'default' : match.status === 'stale' ? 'secondary' : 'destructive'}>
                        {match.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>Updated: {new Date(match.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {match.iteration && (
                        <span>Iteration: {match.iteration}</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {match.odds?.map((player, pIndex) => {
                        const decimal = convertToDecimal(player.odds);
                        const impliedProb = getImpliedProbability(decimal);

                        return (
                          <div key={pIndex} className="p-3 bg-muted rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{player.player}</span>
                              <div className="text-right">
                                <span className="font-mono font-bold text-lg">{player.odds}</span>
                                <div className="text-xs text-muted-foreground">
                                  Decimal: {decimal.toFixed(3)} | Implied: {impliedProb.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arbitrage History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Arbitrage Opportunities History</CardTitle>
                <CardDescription>All detected arbitrage opportunities this session (last 100)</CardDescription>
              </CardHeader>
              <CardContent>
                {arbitrageHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No arbitrage opportunities detected yet</p>
                ) : (
                  <div className="space-y-4">
                    {/* Arbitrage Timeline Chart */}
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={arbitrageHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                        <YAxis label={{ value: 'Profit %', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="profit_percentage"
                          stroke="#82ca9d"
                          fill="#82ca9d"
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    {/* Arbitrage List */}
                    <div className="space-y-3">
                      {arbitrageHistory.slice().reverse().map((arb, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-semibold text-lg">
                                {arb.profit_percentage?.toFixed(3)}% Profit
                              </p>
                              <p className="text-sm text-muted-foreground">{arb.time}</p>
                            </div>
                            <Badge variant="default">${arb.profit_amount?.toFixed(2)}</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="space-y-1">
                              <p className="font-medium">{arb.player1?.name}</p>
                              <p className="text-muted-foreground">{arb.player1?.book}</p>
                              <p className="font-mono">{arb.player1?.odds}</p>
                              <p>Stake: ${arb.player1?.stake?.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium">{arb.player2?.name}</p>
                              <p className="text-muted-foreground">{arb.player2?.book}</p>
                              <p className="font-mono">{arb.player2?.odds}</p>
                              <p>Stake: ${arb.player2?.stake?.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Health Monitor</CardTitle>
                <CardDescription>Monitor the health and status of all data sources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(currentOdds).map(([matchId, match]) => {
                  const statusInfo = matchStatus[matchId];
                  const isHealthy = match.status === 'active' && (!match.consecutive_failures || match.consecutive_failures === 0);

                  return (
                    <div key={matchId} className={`border rounded-lg p-4 ${isHealthy ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <h3 className="font-semibold">{match.sportsbook}</h3>
                        </div>
                        <Badge variant={isHealthy ? 'default' : 'secondary'}>
                          {match.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Last Update</p>
                          <p className="font-medium">{new Date(match.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Iterations</p>
                          <p className="font-medium">{match.iteration || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Players Found</p>
                          <p className="font-medium">{match.odds?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Failures</p>
                          <p className={`font-medium ${(match.consecutive_failures || 0) > 5 ? 'text-red-600' : ''}`}>
                            {match.consecutive_failures || 0}
                          </p>
                        </div>
                      </div>

                      {statusInfo && statusInfo.message && (
                        <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{statusInfo.message}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Session Info */}
      {sessionId && (
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Session ID: {sessionId} | Data Points: {consolidatedHistory.length} | Lines: {getConsolidatedLines().length} | Probability Points: {probabilityHistory.length}
        </div>
      )}
    </div>
  );
}