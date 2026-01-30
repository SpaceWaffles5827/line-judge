'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Play, Square, Plus, X, TrendingUp, Activity, DollarSign } from 'lucide-react';

export default function LineJudgePage() {
  const [urls, setUrls] = useState<string[]>(['', '']);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'stopped'>('idle');
  const [currentOdds, setCurrentOdds] = useState<any>({});
  const [latestArbitrage, setLatestArbitrage] = useState<any>(null);
  const [stats, setStats] = useState({ totalComparisons: 0, totalArbitrageOpportunities: 0 });
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket
  const connectWebSocket = (sessionId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setStatus('active');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setCurrentOdds(data.currentOdds || {});
      setLatestArbitrage(data.latestArbitrage || null);
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

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">LineJudge</h1>
        <p className="text-muted-foreground">Multi-Sportsbook Arbitrage Detection</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
            <CardTitle className="text-sm font-medium">Comparisons</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalComparisons}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArbitrageOpportunities}</div>
          </CardContent>
        </Card>
      </div>

      {/* Arbitrage Alert */}
      {latestArbitrage?.exists && (
        <Alert className="mb-8 border-yellow-500 bg-yellow-50">
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Arbitrage Opportunity Detected!</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <p className="font-semibold">
                Profit: {latestArbitrage.profit_percentage?.toFixed(3)}%
                (${latestArbitrage.profit_amount?.toFixed(2)} on $100)
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-white rounded border">
                  <p className="text-sm font-semibold mb-1">Bet 1</p>
                  <p className="text-xs">{latestArbitrage.player1?.name}</p>
                  <p className="text-xs text-muted-foreground">{latestArbitrage.player1?.book}</p>
                  <p className="font-mono mt-1">{latestArbitrage.player1?.odds}</p>
                  <p className="text-sm mt-1">Stake: ${latestArbitrage.player1?.stake?.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-white rounded border">
                  <p className="text-sm font-semibold mb-1">Bet 2</p>
                  <p className="text-xs">{latestArbitrage.player2?.name}</p>
                  <p className="text-xs text-muted-foreground">{latestArbitrage.player2?.book}</p>
                  <p className="font-mono mt-1">{latestArbitrage.player2?.odds}</p>
                  <p className="text-sm mt-1">Stake: ${latestArbitrage.player2?.stake?.toFixed(2)}</p>
                </div>
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
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Odds Display */}
      {Object.keys(currentOdds).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Odds</CardTitle>
            <CardDescription>Live odds from all sportsbooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.values(currentOdds).map((match: any, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{match.sportsbook}</h3>
                  <Badge variant={match.status === 'active' ? 'default' : 'secondary'}>
                    {match.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Updated: {new Date(match.timestamp).toLocaleTimeString()}
                </p>
                <div className="space-y-2">
                  {match.odds?.map((player: any, pIndex: number) => (
                    <div key={pIndex} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span>{player.player}</span>
                      <span className="font-mono font-bold">{player.odds}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Session Info */}
      {sessionId && (
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Session ID: {sessionId}
        </div>
      )}
    </div>
  );
}