'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Square, Activity, DollarSign, Target, Download, Percent } from 'lucide-react';
import { StatsCard } from '@/components/ui/statsCard';
import { ArbitrageAlert } from '@/components/ui/arbitrageAlert';
import { UrlInputCard } from '@/components/ui/urlInputCard';
import { ChartSettingsCard } from '@/components/ui/chartSettingsCard';
import { CurrentOddsDisplay } from '@/components/ui/currentOddsDisplay';
import { HealthMonitor } from '@/components/ui/healthMonitor';
import { ArbitrageHistory } from '@/components/ui/arbitrageHistory';
import { BestOddsChart } from '@/components/ui/bestOddsChart';
import { ProbabilityChart } from '@/components/ui/probabilityChart';
import { ConsolidatedChart } from '@/components/ui/consolidatedChart';
import {
  convertToDecimal,
  getImpliedProbability,
  getLineColor,
  getDurationLabel,
  getDataPointsForTimeframe
} from '@/lib/linejudge-utils';

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

  // Update max data points when timeframe changes
  useEffect(() => {
    const points = getDataPointsForTimeframe(chartTimeframe);
    setMaxDataPoints(points);
  }, [chartTimeframe]);

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
        <StatsCard
          title="Status"
          icon={Activity}
          badge={{
            text: status.toUpperCase(),
            variant: status === 'active' ? 'default' : 'secondary'
          }}
        />

        <StatsCard
          title="Active Books"
          icon={Target}
          value={Object.keys(currentOdds).length}
          subtitle={`${Object.values(currentOdds).filter(m => m.status === 'active').length} healthy`}
        />

        <StatsCard
          title="Combined Probability"
          icon={Percent}
          value={
            probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null
              ? `${probabilityHistory[probabilityHistory.length - 1].combinedProbability.toFixed(2)}%`
              : '-'
          }
          subtitle={
            probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null && probabilityHistory[probabilityHistory.length - 1].combinedProbability < 100
              ? '🎯 ARBITRAGE!'
              : probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability == null
                ? 'Incomplete data'
                : 'No arbitrage'
          }
          subtitleClassName={
            probabilityHistory.length > 0 && probabilityHistory[probabilityHistory.length - 1].combinedProbability != null && probabilityHistory[probabilityHistory.length - 1].combinedProbability < 100
              ? 'text-green-600 font-semibold'
              : 'text-muted-foreground'
          }
        />

        <StatsCard
          title="Opportunities"
          icon={DollarSign}
          value={stats.totalArbitrageOpportunities}
          subtitle={
            arbitrageHistory.length > 0
              ? `Latest: ${arbitrageHistory[arbitrageHistory.length - 1]?.profit_percentage?.toFixed(2)}%`
              : undefined
          }
        />
      </div>

      {/* Arbitrage Alert */}
      <ArbitrageAlert arbitrage={latestArbitrage} />

      {/* URL Input Card */}
      <UrlInputCard
        urls={urls}
        status={status}
        onUrlsChange={setUrls}
      />

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
            <ChartSettingsCard
              chartTimeframe={chartTimeframe}
              onTimeframeChange={(value: any) => setChartTimeframe(value)}
              viewMode={consolidatedViewMode}
              onViewModeChange={(value: any) => setConsolidatedViewMode(value)}
              dataPointsInfo={{
                filtered: getFilteredData(consolidatedHistory).length,
                total: consolidatedHistory.length,
                lines: getConsolidatedLines().length
              }}
              durationLabel={getDurationLabel(chartTimeframe)}
              showDurationBadge={true}
            />

            <ConsolidatedChart
              consolidatedHistory={consolidatedHistory}
              consolidatedViewMode={consolidatedViewMode}
              getFilteredData={getFilteredData}
              getConsolidatedLines={getConsolidatedLines}
            />
          </TabsContent>

          {/* Best Odds Tab */}
          <TabsContent value="best" className="space-y-4">
            <BestOddsChart
              probabilityHistory={probabilityHistory}
              chartTimeframe={chartTimeframe}
              onTimeframeChange={(value: any) => setChartTimeframe(value)}
              getFilteredData={getFilteredData}
              getDurationLabel={() => getDurationLabel(chartTimeframe)}
              chartKey={chartKey}
            />
          </TabsContent>

          {/* Combined Probability Tab */}
          <TabsContent value="probability" className="space-y-4">
            <ProbabilityChart
              probabilityHistory={probabilityHistory}
              chartTimeframe={chartTimeframe}
              onTimeframeChange={(value: any) => setChartTimeframe(value)}
              getFilteredData={getFilteredData}
              getDurationLabel={() => getDurationLabel(chartTimeframe)}
              chartKey={chartKey}
            />
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <CurrentOddsDisplay currentOdds={currentOdds} />
          </TabsContent>

          {/* Arbitrage History Tab */}
          <TabsContent value="history" className="space-y-4">
            <ArbitrageHistory arbitrageHistory={arbitrageHistory} />
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <HealthMonitor
              currentOdds={currentOdds}
              matchStatus={matchStatus}
            />
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