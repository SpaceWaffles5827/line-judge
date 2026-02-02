import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartSettingsCard } from '@/components/ui/chartSettingsCard';

interface OddsDataPoint {
    timestamp: string;
    time: string;
    [key: string]: any;
}

interface BestOddsChartProps {
    probabilityHistory: OddsDataPoint[];
    chartTimeframe: string;
    onTimeframeChange: (value: string) => void;
    getFilteredData: (data: OddsDataPoint[]) => OddsDataPoint[];
    getDurationLabel: () => string;
    chartKey: number;
}

export function BestOddsChart({
    probabilityHistory,
    chartTimeframe,
    onTimeframeChange,
    getFilteredData,
    getDurationLabel,
    chartKey
}: BestOddsChartProps) {
    return (
        <>
            <ChartSettingsCard
                chartTimeframe={chartTimeframe}
                onTimeframeChange={onTimeframeChange}
                dataPointsInfo={{
                    filtered: getFilteredData(probabilityHistory).length,
                    total: probabilityHistory.length
                }}
                liveStatus={
                    probabilityHistory.length > 0
                        ? {
                            points: probabilityHistory.length,
                            lastTime: probabilityHistory[probabilityHistory.length - 1].time
                        }
                        : { points: 0 }
                }
            />

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
        </>
    );
}