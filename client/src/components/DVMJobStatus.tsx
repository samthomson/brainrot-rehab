import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Circle, XCircle, X } from 'lucide-react';

const PENDING_STALE_MS = 90_000;

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
  idle: { label: 'Ready' },
  broadcasting: { label: 'Broadcasting job...' },
  pending: { label: 'Waiting for DVM...' },
  awaiting_blossom: { label: 'Awaiting upload authorization' },
  uploading: { label: 'Uploading composed video...' },
  awaiting_signature: { label: 'Awaiting final publish signature' },
  complete: { label: 'Published' },
  error: { label: 'Failed' },
};

export function DVMJobStatus({ status, currentTask, resultEventId, errorMessage, onReset }: DVMJobStatusProps) {
  const [pendingStale, setPendingStale] = useState(false);

  useEffect(() => {
    if (status !== 'pending') {
      setPendingStale(false);
      return;
    }
    const t = setTimeout(() => setPendingStale(true), PENDING_STALE_MS);
    return () => clearTimeout(t);
  }, [status]);

  if (status === 'idle') return null;

  const config = STATUS_CONFIG[status];
  const steps = [
    'Job sent to relay',
    'DVM picked up request',
    'Authorize upload',
    'DVM uploads video',
    'Sign final event',
    'Done',
  ] as const;

  const activeStep = (() => {
    switch (status) {
      case 'broadcasting':
        return 0;
      case 'pending':
        return 1;
      case 'awaiting_blossom':
        return 2;
      case 'uploading':
        return 3;
      case 'awaiting_signature':
        return 4;
      case 'complete':
        return 5;
      case 'error':
        if (currentTask?.type === 'sign_event') return 4;
        if (currentTask?.type === 'sign_blossom') return 2;
        return 1;
      default:
        return 0;
    }
  })();

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Publish Checklist
          </CardTitle>
          {(status === 'complete' || status === 'error') && (
            <Button variant="ghost" size="icon" onClick={onReset}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={`text-sm font-medium ${status === 'error' ? 'text-destructive' : 'text-primary'}`}>
          {config.label}
        </p>

        <div className="space-y-2">
          {steps.map((step, index) => {
            const isDone = status === 'complete' ? true : index < activeStep;
            const isActive = status !== 'complete' && index === activeStep;
            const isError = status === 'error' && index === activeStep;
            return (
              <div key={step} className="flex items-center gap-2 text-sm">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : isError ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/60" />
                )}
                <span className={isDone ? 'text-foreground' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  {step}
                </span>
              </div>
            );
          })}
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

        {status === 'pending' && pendingStale && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg space-y-2">
            <p className="text-sm">
              <strong>No response from DVM yet.</strong> The job was sent to the relay. If the DVM service is not running or not connected to the same relay (e.g. <code className="text-xs bg-muted px-1 rounded">wss://relay.brainrot.rehab</code>), you will not see updates.
            </p>
            <p className="text-xs text-muted-foreground">
              For production: run the DVM backend and set <code className="bg-muted px-1 rounded">VITE_DVM_PUBKEY</code> when building the client.
            </p>
            <Button variant="outline" size="sm" onClick={onReset}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
