import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    icon: LucideIcon;
    value: string | number;
    badge?: {
        text: string;
        variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    };
    subtitle?: string;
    subtitleClassName?: string;
}

export function StatsCard({
    title,
    icon: Icon,
    value,
    badge,
    subtitle,
    subtitleClassName
}: StatsCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {badge ? (
                        <Badge variant={badge.variant || 'default'}>
                            {badge.text}
                        </Badge>
                    ) : (
                        value
                    )}
                </div>
                {subtitle && (
                    <p className={`text-xs mt-1 ${subtitleClassName || 'text-muted-foreground'}`}>
                        {subtitle}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}