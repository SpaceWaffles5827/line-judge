import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface UrlInputCardProps {
    urls: string[];
    status: 'idle' | 'connecting' | 'active' | 'stopped';
    onUrlsChange: (urls: string[]) => void;
}

export function UrlInputCard({ urls, status, onUrlsChange }: UrlInputCardProps) {
    const addUrlField = () => onUrlsChange([...urls, '']);

    const removeUrlField = (index: number) => {
        onUrlsChange(urls.filter((_, i) => i !== index));
    };

    const updateUrl = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        onUrlsChange(newUrls);
    };

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Match URLs</CardTitle>
                <CardDescription>Add URLs from different sportsbooks for the same match</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {urls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                        <Input
                            type="text"
                            value={url}
                            onChange={(e) => updateUrl(index, e.target.value)}
                            placeholder="https://sportsbook.example.com/event/..."
                            disabled={status === 'active'}
                        />
                        {urls.length > 2 && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removeUrlField(index)}
                                disabled={status === 'active'}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
                <Button
                    variant="outline"
                    onClick={addUrlField}
                    disabled={status === 'active'}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add URL
                </Button>
            </CardContent>
        </Card>
    );
}