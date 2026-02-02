import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { convertToDecimal, getImpliedProbability, getLineColor } from '@/lib/linejudge-utils';

interface MatchData {
    sportsbook: string;
    url: string;
    timestamp: string;
    odds: Array<{ player: string; odds: string }>;
    status: string;
    iteration?: number;
    consecutive_failures?: number;
}

interface CurrentOddsDisplayProps {
    currentOdds: Record<string, MatchData>;
}

export function CurrentOddsDisplay({ currentOdds }: CurrentOddsDisplayProps) {
    return (
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
    );
}