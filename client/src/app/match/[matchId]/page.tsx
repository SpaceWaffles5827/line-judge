'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';

// Import the existing page component (we'll need to refactor it to accept match data)
// For now, let's create a simpler view that connects to the existing match
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCard } from '@/components/ui/statsCard';
import { ArbitrageAlert } from '@/components/ui/arbitrageAlert';
import { CurrentOddsDisplay } from '@/components/ui/currentOddsDisplay';
import { HealthMonitor } from '@/components/ui/healthMonitor';
import { ArbitrageHistory } from '@/components/ui/arbitrageHistory';
import { BestOddsChart } from '@/components/ui/bestOddsChart';
import { ProbabilityChart } from '@/components/ui/probabilityChart';
import { ConsolidatedChart } from '@/components/ui/consolidatedChart';
import { ChartSettingsCard } from '@/components/ui/chartSettingsCard';
import { Target, Percent, DollarSign } from 'lucide-react';
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

interface MatchData {
    sportsbook: string;
    url: string;
    timestamp: string;
    odds: Array<{ player: string; odds: string }>;
    status: string;
    iteration?: number;
    consecutive_failures?: number;
}

export default function MatchViewPage({ params }: { params: Promise<{ matchId: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [matchInfo, setMatchInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Match data state (from WebSocket)
    const [currentOdds, setCurrentOdds] = useState<Record<string, MatchData>>({});
    const [latestArbitrage, setLatestArbitrage] = useState<any>(null);
    const [stats, setStats] = useState({ totalComparisons: 0, totalArbitrageOpportunities: 0 });
    const [oddsHistory, setOddsHistory] = useState<any>({});
    const [consolidatedHistory, setConsolidatedHistory] = useState<OddsDataPoint[]>([]);
    const [probabilityHistory, setProbabilityHistory] = useState<OddsDataPoint[]>([]);
    const [arbitrageHistory, setArbitrageHistory] = useState<any[]>([]);
    const [matchStatus, setMatchStatus] = useState<any>({});

    // Chart settings
    const [chartTimeframe, setChartTimeframe] = useState<'1min' | '5min' | '15min' | '30min' | '1hour' | '3hour' | 'all'>('5min');
    const [maxDataPoints, setMaxDataPoints] = useState<number>(150);
    const [consolidatedViewMode, setConsolidatedViewMode] = useState<'split' | 'combined'>('split');
    const [chartKey, setChartKey] = useState<number>(0);

    // Load initial match info
    useEffect(() => {
        const loadMatchInfo = async () => {
            try {
                const response = await fetch(`http://localhost:8000/match/${resolvedParams.matchId}`);

                if (!response.ok) {
                    throw new Error('Match not found');
                }

                const data = await response.json();
                setMatchInfo(data);

                // Set initial data
                setCurrentOdds(data.currentOdds || {});
                setLatestArbitrage(data.latestArbitrage);
                setStats({
                    totalComparisons: data.totalComparisons || 0,
                    totalArbitrageOpportunities: data.totalArbitrageOpportunities || 0
                });
                setMatchStatus(data.matchStatus || {});

                setLoading(false);
            } catch (error) {
                console.error('Failed to load match info:', error);
                setLoading(false);
            }
        };

        loadMatchInfo();
    }, [resolvedParams.matchId]);

    // Connect to WebSocket for real-time updates
    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:8000/ws`);

        ws.onopen = () => {
            console.log('WebSocket connected for match view');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Only process updates for this match
            if (data.matchId !== resolvedParams.matchId) return;

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
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
        };

        return () => {
            ws.close();
        };
    }, [resolvedParams.matchId]);

    // Update max data points when timeframe changes
    useEffect(() => {
        const points = getDataPointsForTimeframe(chartTimeframe);
        setMaxDataPoints(points);
    }, [chartTimeframe]);

    // Force chart re-render when probability history updates
    useEffect(() => {
        if (probabilityHistory.length > 0) {
            setChartKey(Date.now());
        }
    }, [probabilityHistory.length]);

    // Update odds history for graphing (same as original page)
    const updateOddsHistory = (currentOddsData: Record<string, MatchData>) => {
        const timestamp = new Date().toISOString();
        const time = new Date().toLocaleTimeString();

        const playerData: Record<string, any> = {};
        const consolidatedPoint: any = { timestamp, time };
        const probabilityPoint: any = { timestamp, time };

        const bestOddsPerPlayer: Record<string, {
            decimal: number;
            book: string;
            american: string;
            originalName: string;
        }> = {};

        Object.entries(currentOddsData).forEach(([matchId, match]) => {
            if (match.odds && Array.isArray(match.odds)) {
                match.odds.forEach(({ player, odds }) => {
                    const normalizedPlayer = player.trim();

                    if (!playerData[normalizedPlayer]) {
                        playerData[normalizedPlayer] = { timestamp, time };
                    }
                    const decimalOdds = convertToDecimal(odds);

                    if (!bestOddsPerPlayer[normalizedPlayer] || decimalOdds > bestOddsPerPlayer[normalizedPlayer].decimal) {
                        bestOddsPerPlayer[normalizedPlayer] = {
                            decimal: decimalOdds,
                            book: match.sportsbook,
                            american: odds,
                            originalName: player
                        };
                    }

                    playerData[normalizedPlayer][match.sportsbook] = decimalOdds;
                    playerData[normalizedPlayer][`${match.sportsbook}_american`] = odds;

                    const consolidatedKey = `${normalizedPlayer}_${match.sportsbook}`;
                    consolidatedPoint[consolidatedKey] = decimalOdds;
                    consolidatedPoint[`${consolidatedKey}_american`] = odds;
                    consolidatedPoint[`${consolidatedKey}_player`] = normalizedPlayer;
                    consolidatedPoint[`${consolidatedKey}_book`] = match.sportsbook;
                });
            }
        });

        const players = Object.keys(bestOddsPerPlayer);

        if (players.length >= 2) {
            const sortedPlayers = players.sort();
            const player1 = sortedPlayers[0];
            const player2 = sortedPlayers[1];

            const best1 = bestOddsPerPlayer[player1];
            const best2 = bestOddsPerPlayer[player2];

            probabilityPoint.player1_best = best1.decimal;
            probabilityPoint.player1_best_book = best1.book;
            probabilityPoint.player1_best_american = best1.american;
            probabilityPoint.player1_name = player1;

            probabilityPoint.player2_best = best2.decimal;
            probabilityPoint.player2_best_book = best2.book;
            probabilityPoint.player2_best_american = best2.american;
            probabilityPoint.player2_name = player2;

            const impliedProb1 = (1 / best1.decimal) * 100;
            const impliedProb2 = (1 / best2.decimal) * 100;
            const combinedProbability = impliedProb1 + impliedProb2;

            probabilityPoint.combinedProbability = combinedProbability;
            probabilityPoint.profit = combinedProbability < 100 ? ((100 / combinedProbability - 1) * 100) : 0;
            probabilityPoint.isArbitrage = combinedProbability < 100;
        } else if (players.length === 1) {
            const player = players[0];
            const best = bestOddsPerPlayer[player];

            probabilityPoint.player1_best = best.decimal;
            probabilityPoint.player1_best_book = best.book;
            probabilityPoint.player1_best_american = best.american;
            probabilityPoint.player1_name = player;

            probabilityPoint.combinedProbability = null;
            probabilityPoint.incomplete = true;
        } else {
            probabilityPoint.combinedProbability = null;
            probabilityPoint.incomplete = true;
        }

        setOddsHistory((prev: any) => {
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

        setConsolidatedHistory(prev => {
            const newHistory = [...prev, consolidatedPoint];
            return maxDataPoints === Infinity
                ? newHistory
                : newHistory.slice(-maxDataPoints);
        });

        setProbabilityHistory(prev => {
            const newHistory = [...prev, probabilityPoint];
            return maxDataPoints === Infinity
                ? newHistory
                : newHistory.slice(-maxDataPoints);
        });
    };

    const getFilteredData = (data: OddsDataPoint[]): OddsDataPoint[] => {
        if (chartTimeframe === 'all' || !data || data.length === 0) {
            return data;
        }
        const pointsToShow = getDataPointsForTimeframe(chartTimeframe);
        return data.slice(-pointsToShow);
    };

    const getConsolidatedLines = () => {
        if (consolidatedHistory.length === 0) return [];

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

        const lines: Array<{ key: string; player: string; book: string; color: string }> = [];
        linesMap.forEach((value) => {
            lines.push({
                ...value,
                color: getLineColor(lines.length)
            });
        });

        return lines;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading match...</p>
                </div>
            </div>
        );
    }

    if (!matchInfo) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Match Not Found</h2>
                    <Button onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b">
                <div className="container mx-auto p-4 max-w-[1600px]">
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/dashboard')}
                        className="mb-2"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold">{matchInfo.matchName}</h2>
                        {matchInfo.sport && (
                            <p className="text-muted-foreground">{matchInfo.sport}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="container mx-auto p-8 max-w-[1600px]">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatsCard
                        title="Status"
                        icon={Activity}
                        badge={{
                            text: matchInfo.status.toUpperCase(),
                            variant: matchInfo.status === 'running' ? 'default' : 'secondary'
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

                        <TabsContent value="overview" className="space-y-4">
                            <CurrentOddsDisplay currentOdds={currentOdds} />
                        </TabsContent>

                        <TabsContent value="history" className="space-y-4">
                            <ArbitrageHistory arbitrageHistory={arbitrageHistory} />
                        </TabsContent>

                        <TabsContent value="health" className="space-y-4">
                            <HealthMonitor
                                currentOdds={currentOdds}
                                matchStatus={matchStatus}
                            />
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    );
}