import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Percent } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts';
import { ChartSettingsCard } from '@/components/ui/chartSettingsCard';

interface OddsDataPoint {
    timestamp: string;
    time: string;
    [key: string]: any;
}

interface ProbabilityChartProps {
    probabilityHistory: OddsDataPoint[];
    chartTimeframe: string;
    onTimeframeChange: (value: string) => void;
    getFilteredData: (data: OddsDataPoint[]) => OddsDataPoint[];
    getDurationLabel: () => string;
    chartKey: number;
}

export function ProbabilityChart({
    probabilityHistory,
    chartTimeframe,
    onTimeframeChange,
    getFilteredData,
    getDurationLabel,
    chartKey
}: ProbabilityChartProps) {
    return (
        <>
            <ChartSettingsCard
                chartTimeframe={chartTimeframe}
                onTimeframeChange={onTimeframeChange}
                liveStatus={
                    probabilityHistory.length > 0
                        ? {
                            points: getFilteredData(probabilityHistory).length,
                            lastTime: probabilityHistory[probabilityHistory.length - 1].time
                        }
                        : { points: 0 }
                }
            />

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
        </>
    );
}