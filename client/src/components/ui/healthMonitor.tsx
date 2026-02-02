import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface MatchData {
    sportsbook: string;
    url: string;
    timestamp: string;
    odds: Array<{ player: string; odds: string }>;
    status: string;
    iteration?: number;
    consecutive_failures?: number;
}

interface HealthMonitorProps {
    currentOdds: Record<string, MatchData>;
    matchStatus: any;
}

export function HealthMonitor({ currentOdds, matchStatus }: HealthMonitorProps) {
    return (
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
    );
}