import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingUp } from 'lucide-react';

interface ArbitrageData {
    exists: boolean;
    profit_percentage?: number;
    profit_amount?: number;
    player1?: {
        name: string;
        book: string;
        odds: string;
        decimal?: number;
        stake?: number;
        payout?: number;
    };
    player2?: {
        name: string;
        book: string;
        odds: string;
        decimal?: number;
        stake?: number;
        payout?: number;
    };
}

interface ArbitrageAlertProps {
    arbitrage: ArbitrageData | null;
}

export function ArbitrageAlert({ arbitrage }: ArbitrageAlertProps) {
    if (!arbitrage?.exists) return null;

    return (
        <Alert className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <TrendingUp className="h-4 w-4" />
            <AlertTitle className="text-lg font-bold">🚨 Arbitrage Opportunity Detected!</AlertTitle>
            <AlertDescription>
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-4 text-lg font-semibold">
                        <span>Profit: {arbitrage.profit_percentage?.toFixed(3)}%</span>
                        <span className="text-green-600">${arbitrage.profit_amount?.toFixed(2)} on $100</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-500">
                            <p className="text-sm font-semibold mb-2 text-blue-600">BET 1</p>
                            <p className="font-bold">{arbitrage.player1?.name}</p>
                            <p className="text-sm text-muted-foreground">{arbitrage.player1?.book}</p>
                            <p className="font-mono text-lg mt-2">{arbitrage.player1?.odds}</p>
                            <p className="text-sm mt-2">Decimal: {arbitrage.player1?.decimal?.toFixed(3)}</p>
                            <p className="text-lg font-bold mt-2 text-green-600">Stake: ${arbitrage.player1?.stake?.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Payout: ${arbitrage.player1?.payout?.toFixed(2)}</p>
                        </div>

                        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-500">
                            <p className="text-sm font-semibold mb-2 text-purple-600">BET 2</p>
                            <p className="font-bold">{arbitrage.player2?.name}</p>
                            <p className="text-sm text-muted-foreground">{arbitrage.player2?.book}</p>
                            <p className="font-mono text-lg mt-2">{arbitrage.player2?.odds}</p>
                            <p className="text-sm mt-2">Decimal: {arbitrage.player2?.decimal?.toFixed(3)}</p>
                            <p className="text-lg font-bold mt-2 text-green-600">Stake: ${arbitrage.player2?.stake?.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Payout: ${arbitrage.player2?.payout?.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                        <p className="font-bold text-center text-lg">
                            ✨ Guaranteed Profit: ${arbitrage.profit_amount?.toFixed(2)}
                        </p>
                    </div>
                </div>
            </AlertDescription>
        </Alert>
    );
}