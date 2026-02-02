import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart as LineChartIcon } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface OddsDataPoint {
    timestamp: string;
    time: string;
    [key: string]: any;
}

interface ConsolidatedLine {
    key: string;
    player: string;
    book: string;
    color: string;
}

interface ConsolidatedChartProps {
    consolidatedHistory: OddsDataPoint[];
    consolidatedViewMode: 'split' | 'combined';
    getFilteredData: (data: OddsDataPoint[]) => OddsDataPoint[];
    getConsolidatedLines: () => ConsolidatedLine[];
}

export function ConsolidatedChart({
    consolidatedHistory,
    consolidatedViewMode,
    getFilteredData,
    getConsolidatedLines
}: ConsolidatedChartProps) {
    if (consolidatedHistory.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    <LineChartIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No data yet. Start monitoring to see odds charts.</p>
                </CardContent>
            </Card>
        );
    }

    // SPLIT VIEW - Faceted by Player
    if (consolidatedViewMode === 'split') {
        const playerGroups = new Map<string, ConsolidatedLine[]>();

        getConsolidatedLines().forEach(line => {
            if (!playerGroups.has(line.player)) {
                playerGroups.set(line.player, []);
            }
            playerGroups.get(line.player)!.push(line);
        });

        return (
            <>
                {Array.from(playerGroups.entries()).map(([playerName, playerLines]) => (
                    <Card key={playerName}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LineChartIcon className="h-5 w-5" />
                                {playerName}
                            </CardTitle>
                            <CardDescription>
                                Comparing {playerLines.length} sportsbook{playerLines.length > 1 ? 's' : ''} - Click any point for details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={getFilteredData(consolidatedHistory)}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fontSize: 11 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis
                                        label={{ value: 'Decimal Odds', angle: -90, position: 'insideLeft' }}
                                        domain={['dataMin - 0.05', 'dataMax + 0.05']}
                                    />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
                                                        <p className="font-semibold mb-2 text-sm">{payload[0].payload.time}</p>
                                                        <div className="space-y-1">
                                                            {payload.map((entry, index) => {
                                                                const key = entry.dataKey as string;
                                                                const americanKey = `${key}_american`;
                                                                const bookKey = `${key}_book`;

                                                                return (
                                                                    <div key={index} className="flex items-center gap-2 text-xs">
                                                                        <div
                                                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                                                            style={{ backgroundColor: entry.color }}
                                                                        />
                                                                        <span className="font-medium">{entry.payload[bookKey]}</span>
                                                                        <span className="font-bold ml-auto">{entry.value?.toFixed(3)}</span>
                                                                        <span className="text-muted-foreground">
                                                                            ({entry.payload[americanKey]})
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: '12px' }}
                                        formatter={(value) => {
                                            const line = playerLines.find(l => l.key === value);
                                            return line ? line.book : value;
                                        }}
                                    />
                                    {playerLines.map((line) => (
                                        <Line
                                            key={line.key}
                                            type="monotone"
                                            dataKey={line.key}
                                            name={line.key}
                                            stroke={line.color}
                                            strokeWidth={3}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={true}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>

                            {/* Current Odds Summary */}
                            <div className="mt-4 p-3 bg-muted rounded-lg">
                                <p className="text-sm font-semibold mb-2">Current Odds Comparison:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {playerLines.map((line) => {
                                        const latestPoint = consolidatedHistory[consolidatedHistory.length - 1];
                                        const currentOdds = latestPoint?.[line.key];
                                        const americanOdds = latestPoint?.[`${line.key}_american`];

                                        if (!currentOdds) return null;

                                        const allOddsForPlayer = playerLines
                                            .map(l => latestPoint?.[l.key])
                                            .filter(Boolean);
                                        const bestOdds = Math.max(...allOddsForPlayer);
                                        const isBest = currentOdds === bestOdds;

                                        return (
                                            <div
                                                key={line.key}
                                                className={`p-2 rounded border-2 ${isBest ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-gray-200 dark:border-gray-700'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: line.color }}
                                                    />
                                                    <span className="text-xs font-medium">{line.book}</span>
                                                    {isBest && <span className="text-xs">🏆</span>}
                                                </div>
                                                <p className="font-mono font-bold text-sm">{currentOdds.toFixed(3)}</p>
                                                <p className="text-xs text-muted-foreground">{americanOdds}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </>
        );
    }

    // COMBINED VIEW - All on One Chart
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5" />
                    All Players & Sportsbooks - Combined
                </CardTitle>
                <CardDescription>
                    Every odds line on one chart - {getConsolidatedLines().length} total lines
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                    <LineChart data={getFilteredData(consolidatedHistory)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 11 }}
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
                                    return (
                                        <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                                            <p className="font-semibold mb-3 text-sm">{payload[0].payload.time}</p>
                                            <div className="space-y-1">
                                                {payload.map((entry, index) => {
                                                    const key = entry.dataKey as string;
                                                    const americanKey = `${key}_american`;
                                                    const playerKey = `${key}_player`;
                                                    const bookKey = `${key}_book`;

                                                    return (
                                                        <div key={index} className="flex items-center gap-2 text-xs">
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            <span className="font-medium">{entry.payload[playerKey]}</span>
                                                            <span className="text-muted-foreground">@{entry.payload[bookKey]}</span>
                                                            <span className="font-bold ml-auto">{entry.value?.toFixed(3)}</span>
                                                            <span className="text-muted-foreground">
                                                                ({entry.payload[americanKey]})
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: '10px', maxHeight: '100px', overflowY: 'auto' }}
                            formatter={(value) => {
                                const lines = getConsolidatedLines();
                                const line = lines.find(l => l.key === value);
                                if (line) {
                                    return `${line.player} @ ${line.book}`;
                                }
                                return value;
                            }}
                        />
                        {getConsolidatedLines().map((line) => (
                            <Line
                                key={line.key}
                                type="monotone"
                                dataKey={line.key}
                                name={line.key}
                                stroke={line.color}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                                connectNulls={true}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>

                <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-semibold mb-2">All Tracked Lines:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {getConsolidatedLines().map((line, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: line.color }}
                                />
                                <span className="font-medium">{line.player}</span>
                                <span className="text-muted-foreground">@ {line.book}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}