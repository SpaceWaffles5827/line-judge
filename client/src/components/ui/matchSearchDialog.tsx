'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MatchSearchDialogProps {
    onSelectUrls: (urls: string[], matchName?: string, sport?: string) => void;
}

interface SearchResult {
    sportsbook: string;
    matches: Array<{
        url: string;
        players: string[];
        matchName: string;
        sport: string;
    }>;
    error?: string;
}

export function MatchSearchDialog({ onSelectUrls }: MatchSearchDialogProps) {
    const [open, setOpen] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedUrls, setSelectedUrls] = useState<string[]>([]);

    // Sportsbook selection
    const [sportsbooks, setSportsbooks] = useState({
        mgm: true,
        pinnacle: true,
    });

    const handleSearch = async () => {
        if (!playerName.trim()) {
            setError('Please enter a player name');
            return;
        }

        const selectedSportsbooks = Object.entries(sportsbooks)
            .filter(([_, selected]) => selected)
            .map(([name, _]) => name);

        if (selectedSportsbooks.length === 0) {
            setError('Please select at least one sportsbook');
            return;
        }

        setSearching(true);
        setError(null);
        setSearchResults([]);
        setSelectedUrls([]);

        try {
            const response = await fetch('http://localhost:8000/search/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: playerName.trim(),
                    sportsbooks: selectedSportsbooks,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || 'Search failed');
            }

            const data = await response.json();
            setSearchResults(data.results || []);

            if (data.totalMatches === 0) {
                setError('No matches found for this player');
            }
        } catch (err) {
            console.error('Search error:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setSearching(false);
        }
    };

    const toggleUrl = (url: string) => {
        setSelectedUrls(prev =>
            prev.includes(url)
                ? prev.filter(u => u !== url)
                : [...prev, url]
        );
    };

    const handleCreateMatch = () => {
        if (selectedUrls.length < 2) {
            setError('Please select at least 2 matches');
            return;
        }

        // Get match name from first result
        let matchName = '';
        let sport = '';

        for (const result of searchResults) {
            const match = result.matches.find(m => selectedUrls.includes(m.url));
            if (match) {
                matchName = match.matchName;
                sport = match.sport;
                break;
            }
        }

        onSelectUrls(selectedUrls, matchName, sport);

        // Reset
        setOpen(false);
        setPlayerName('');
        setSearchResults([]);
        setSelectedUrls([]);
        setError(null);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="lg">
                    <Search className="h-4 w-4 mr-2" />
                    Search by Player
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Search for Match by Player Name</DialogTitle>
                    <DialogDescription>
                        Enter a player's name to find their matches across multiple sportsbooks
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Search Input */}
                    <div className="space-y-2">
                        <Label htmlFor="playerName">Player Name</Label>
                        <div className="flex gap-2">
                            <Input
                                id="playerName"
                                placeholder="e.g., Djokovic, Federer, Nadal"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Button onClick={handleSearch} disabled={searching}>
                                {searching ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <Search className="h-4 w-4 mr-2" />
                                        Search
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Sportsbook Selection */}
                    <div className="space-y-2">
                        <Label>Sportsbooks to Search</Label>
                        <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="mgm"
                                    checked={sportsbooks.mgm}
                                    onCheckedChange={(checked) =>
                                        setSportsbooks(prev => ({ ...prev, mgm: checked as boolean }))
                                    }
                                />
                                <label htmlFor="mgm" className="text-sm font-medium cursor-pointer">
                                    BetMGM
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="pinnacle"
                                    checked={sportsbooks.pinnacle}
                                    onCheckedChange={(checked) =>
                                        setSportsbooks(prev => ({ ...prev, pinnacle: checked as boolean }))
                                    }
                                />
                                <label htmlFor="pinnacle" className="text-sm font-medium cursor-pointer">
                                    Pinnacle
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="space-y-3">
                            <Label>
                                Select Matches ({selectedUrls.length} selected)
                                {selectedUrls.length < 2 && (
                                    <span className="text-muted-foreground ml-2 text-xs">
                                        (Select at least 2)
                                    </span>
                                )}
                            </Label>

                            {searchResults.map((result) => (
                                <div key={result.sportsbook} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{result.sportsbook.toUpperCase()}</Badge>
                                        {result.error && (
                                            <span className="text-xs text-destructive">{result.error}</span>
                                        )}
                                        {!result.error && result.matches.length === 0 && (
                                            <span className="text-xs text-muted-foreground">No matches found</span>
                                        )}
                                    </div>

                                    {result.matches.map((match, idx) => (
                                        <Card
                                            key={idx}
                                            className={`cursor-pointer transition-colors ${selectedUrls.includes(match.url)
                                                ? 'border-primary bg-primary/5'
                                                : 'hover:border-primary/50'
                                                }`}
                                            onClick={() => toggleUrl(match.url)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold">{match.matchName}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {match.url}
                                                        </p>
                                                    </div>
                                                    <Checkbox
                                                        checked={selectedUrls.includes(match.url)}
                                                        onCheckedChange={() => toggleUrl(match.url)}
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateMatch}
                        disabled={selectedUrls.length < 2}
                    >
                        Create Match with {selectedUrls.length} URLs
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}