import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ChartSettingsCardProps {
    chartTimeframe: string;
    onTimeframeChange: (value: string) => void;
    viewMode?: 'split' | 'combined';
    onViewModeChange?: (value: string) => void;
    dataPointsInfo?: {
        filtered: number;
        total: number;
        lines?: number;
    };
    liveStatus?: {
        points: number;
        lastTime?: string;
    };
    durationLabel?: string;
    showDurationBadge?: boolean;
}

export function ChartSettingsCard({
    chartTimeframe,
    onTimeframeChange,
    viewMode,
    onViewModeChange,
    dataPointsInfo,
    liveStatus,
    durationLabel,
    showDurationBadge = false
}: ChartSettingsCardProps) {
    return (
        <Card>
            <CardHeader>
                {showDurationBadge ? (
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Chart Settings</CardTitle>
                            <CardDescription>View mode and timeframe controls</CardDescription>
                        </div>
                        {durationLabel && <Badge variant="outline">{durationLabel}</Badge>}
                    </div>
                ) : (
                    <CardTitle className="text-sm">Chart Settings</CardTitle>
                )}
            </CardHeader>
            <CardContent>
                <div className={`grid grid-cols-1 ${viewMode !== undefined ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                    {/* View Mode - only shown if provided */}
                    {viewMode !== undefined && onViewModeChange && (
                        <div className="space-y-2">
                            <Label htmlFor="viewmode">View Mode</Label>
                            <Select value={viewMode} onValueChange={onViewModeChange}>
                                <SelectTrigger id="viewmode">
                                    <SelectValue placeholder="Select view" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="split">📊 Split by Player (Recommended)</SelectItem>
                                    <SelectItem value="combined">📈 Combined View</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Timeframe */}
                    <div className="space-y-2">
                        <Label htmlFor="timeframe">Display Timeframe</Label>
                        <Select value={chartTimeframe} onValueChange={onTimeframeChange}>
                            <SelectTrigger id="timeframe">
                                <SelectValue placeholder="Select timeframe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1min">Last 1 Minute</SelectItem>
                                <SelectItem value="5min">Last 5 Minutes</SelectItem>
                                <SelectItem value="15min">Last 15 Minutes</SelectItem>
                                <SelectItem value="30min">Last 30 Minutes</SelectItem>
                                <SelectItem value="1hour">Last 1 Hour</SelectItem>
                                <SelectItem value="3hour">Last 3 Hours</SelectItem>
                                <SelectItem value="all">All Data</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Data Points Info - only shown if provided */}
                    {dataPointsInfo && (
                        <div className="space-y-2">
                            <Label>Data Points</Label>
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">
                                    {dataPointsInfo.filtered} of {dataPointsInfo.total}
                                </p>
                                {dataPointsInfo.lines !== undefined && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {dataPointsInfo.lines} lines
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Live Status - only shown if provided */}
                    {liveStatus && (
                        <div className="space-y-2">
                            <Label>Live Status</Label>
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">
                                    {liveStatus.points} points
                                </p>
                                {liveStatus.lastTime && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        Last: {liveStatus.lastTime}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}