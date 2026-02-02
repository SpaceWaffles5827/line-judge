import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

interface ArbitrageHistoryProps {
    arbitrageHistory: any[];
}

export function ArbitrageHistory({ arbitrageHistory }: ArbitrageHistoryProps) {
    return (
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
    );
}