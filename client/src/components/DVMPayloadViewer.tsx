import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface DVMPayloadViewerProps {
  data: unknown;
  title: string;
}

export function DVMPayloadViewer({ data, title }: DVMPayloadViewerProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Button onClick={handleCopy} size="sm" variant="outline">
            {copied ? (
              <Check className="h-4 w-4 mr-1" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {jsonString.length.toLocaleString()} characters
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
            <code>{jsonString}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
