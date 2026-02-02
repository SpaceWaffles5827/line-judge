'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, Activity, ExternalLink, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Match {
    matchId: string;
    matchName: string;
    sport?: string;
    status: string;
    startTime: string;
    urlCount: number;
    currentArbitrage: any;
    totalOpportunities: number;
    activeBooks: number;
    staleBooks: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New match dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [matchName, setMatchName] = useState('');
    const [sport, setSport] = useState('');
    const [urls, setUrls] = useState<string[]>(['', '']);
    const [creating, setCreating] = useState(false);

    // Load matches on mount
    useEffect(() => {
        loadMatches();
    }, []);

    // Load matches
    const loadMatches = async () => {
        try {
            const response = await fetch(`http://localhost:8000/matches`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setMatches(data.matches || []);
            setError(null);
        } catch (error) {
            console.error('Failed to load matches:', error);
            setError('Failed to load matches. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    // Refresh matches every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            loadMatches();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Create new match
    const createMatch = async () => {
        const validUrls = urls.filter(url => url.trim() !== '');

        if (validUrls.length < 2) {
            setError('Please add at least 2 valid URLs');
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const response = await fetch(`http://localhost:8000/match/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    urls: validUrls,
                    matchName: matchName || undefined,
                    sport: sport || undefined,
                    fetchInterval: 2,
                    displayInterval: 5,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Match created successfully:', data);

            // Reset form
            setDialogOpen(false);
            setMatchName('');
            setSport('');
            setUrls(['', '']);

            // Reload matches
            await loadMatches();

            // Navigate to the match view
            router.push(`/match/${data.matchId}`);
        } catch (error) {
            console.error('Failed to create match:', error);
            setError(error instanceof Error ? error.message : 'Failed to create match');
        } finally {
            setCreating(false);
        }
    };

    // Delete match
    const deleteMatch = async (matchId: string) => {
        if (!confirm('Are you sure you want to delete this match?')) return;

        try {
            const response = await fetch(`http://localhost:8000/match/${matchId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete match');
            }

            loadMatches();
        } catch (error) {
            console.error('Failed to delete match:', error);
            setError('Failed to delete match');
        }
    };

    // Navigate to match view
    const viewMatch = (matchId: string) => {
        router.push(`/match/${matchId}`);
    };

    const addUrlField = () => setUrls([...urls, '']);
    const removeUrlField = (index: number) => setUrls(urls.filter((_, i) => i !== index));
    const updateUrl = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    if (loading) {
        return (
            <div className="container mx-auto p-8 max-w-[1400px] flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-8 max-w-[1400px]">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold mb-2">LineJudge Dashboard</h1>
                    <p className="text-muted-foreground">Monitor multiple matches for arbitrage opportunities</p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="lg">
                            <Plus className="h-4 w-4 mr-2" />
                            New Match
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Match</DialogTitle>
                            <DialogDescription>
                                Add URLs from different sportsbooks for the same match to monitor for arbitrage opportunities
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="matchName">Match Name (optional)</Label>
                                <Input
                                    id="matchName"
                                    placeholder="e.g., Lakers vs Warriors"
                                    value={matchName}
                                    onChange={(e) => setMatchName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sport">Sport (optional)</Label>
                                <Input
                                    id="sport"
                                    placeholder="e.g., NBA, Tennis, Soccer"
                                    value={sport}
                                    onChange={(e) => setSport(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Sportsbook URLs</Label>
                                {urls.map((url, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={url}
                                            onChange={(e) => updateUrl(index, e.target.value)}
                                            placeholder="https://sportsbook.example.com/event/..."
                                        />
                                        {urls.length > 2 && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => removeUrlField(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    onClick={addUrlField}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add URL
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    setError(null);
                                }}
                                disabled={creating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={createMatch}
                                disabled={creating}
                            >
                                {creating ? 'Creating...' : 'Create Match'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Error Alert */}
            {error && !dialogOpen && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Matches</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {matches.filter(m => m.status === 'running').length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {matches.reduce((sum, m) => sum + m.totalOpportunities, 0)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Arbitrage</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {matches.filter(m => m.currentArbitrage?.exists).length}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{matches.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Matches Grid */}
            {matches.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Activity className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No matches yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first match to start monitoring for arbitrage opportunities</p>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Match
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((match) => (
                        <Card key={match.matchId} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg mb-1">{match.matchName}</CardTitle>
                                        {match.sport && (
                                            <Badge variant="outline" className="mb-2">{match.sport}</Badge>
                                        )}
                                    </div>
                                    <Badge variant={match.status === 'running' ? 'default' : 'secondary'}>
                                        {match.status}
                                    </Badge>
                                </div>
                                <CardDescription>
                                    Started {new Date(match.startTime).toLocaleString()}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {/* Arbitrage Alert */}
                                    {match.currentArbitrage?.exists && (
                                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="h-4 w-4 text-green-600" />
                                                <span className="font-semibold text-sm text-green-700 dark:text-green-400">
                                                    ARBITRAGE ACTIVE
                                                </span>
                                            </div>
                                            <p className="text-2xl font-bold text-green-600">
                                                {match.currentArbitrage.profit_percentage?.toFixed(2)}%
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                ${match.currentArbitrage.profit_amount?.toFixed(2)} profit on $100
                                            </p>
                                        </div>
                                    )}

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Sportsbooks</p>
                                            <p className="font-semibold">{match.urlCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Opportunities</p>
                                            <p className="font-semibold">{match.totalOpportunities}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Active</p>
                                            <p className="font-semibold text-green-600">{match.activeBooks}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Stale</p>
                                            <p className="font-semibold text-yellow-600">{match.staleBooks}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => viewMatch(match.matchId)}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View Details
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => deleteMatch(match.matchId)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}