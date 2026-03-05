import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Upload, FileSignature, Radio, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface DVMJobStatusProps {
  status: 'idle' | 'broadcasting' | 'pending' | 'awaiting_blossom' | 'uploading' | 'awaiting_signature' | 'complete' | 'error';
  currentTask?: {
    type: string;
    message?: string;
  };
  resultEventId?: string;
  errorMessage?: string;
  onReset: () => void;
}

const STATUS_CONFIG = {
  idle: { label: 'Ready', icon: Radio, color: 'text-muted-foreground', progress: 0 },
  broadcasting: { label: 'Broadcasting...', icon: Loader2, color: 'text-blue-500', progress: 10 },
  pending: { label: 'Waiting for DVM...', icon: Loader2, color: 'text-blue-500', progress: 20 },
  awaiting_blossom: { label: 'Needs Upload Auth', icon: FileSignature, color: 'text-yellow-500', progress: 40 },
  uploading: { label: 'Uploading Video...', icon: Upload, color: 'text-blue-500', progress: 60 },
  awaiting_signature: { label: 'Needs Video Signature', icon: FileSignature, color: 'text-yellow-500', progress: 80 },
  complete: { label: 'Complete!', icon: CheckCircle, color: 'text-green-500', progress: 100 },
  error: { label: 'Failed', icon: XCircle, color: 'text-red-500', progress: 0 },
};

export function DVMJobStatus({ status, currentTask, resultEventId, errorMessage, onReset }: DVMJobStatusProps) {
  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color} ${status === 'broadcasting' || status === 'pending' || status === 'uploading' ? 'animate-spin' : ''}`} />
            DVM Job Status
          </CardTitle>
          {(status === 'complete' || status === 'error') && (
            <Button variant="ghost" size="icon" onClick={onReset}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className={`font-medium ${config.color}`}>{config.label}</span>
            <span className="text-muted-foreground">{config.progress}%</span>
          </div>
          <Progress value={config.progress} className="h-2" />
        </div>

        {currentTask?.message && (
          <p className="text-sm text-muted-foreground">{currentTask.message}</p>
        )}

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        {resultEventId && (
          <div className="bg-muted p-3 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Video Event ID:</p>
              <code className="text-xs break-all">{resultEventId}</code>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(resultEventId);
              }}
            >
              Copy ID
            </Button>
          </div>
        )}

        {status === 'awaiting_blossom' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
            <p className="text-sm">
              <strong>Action Required:</strong> The DVM needs authorization to upload your video.
              Signing request sent automatically...
            </p>
          </div>
        )}

        {status === 'awaiting_signature' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
            <p className="text-sm">
              <strong>Action Required:</strong> Sign the final video event to publish your remix.
              Signing request sent automatically...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
