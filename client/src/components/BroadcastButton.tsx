import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface BroadcastButtonProps {
  remixData: unknown;
  onBroadcast: () => Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  loadingLabel?: string;
}

export function BroadcastButton({
  remixData,
  onBroadcast,
  disabled,
  isLoading,
  label = 'Broadcast to DVM',
  loadingLabel = 'Broadcasting...',
}: BroadcastButtonProps) {
  const segments = (remixData as { segments?: unknown[] })?.segments ?? [];
  const hasSegments = segments.length > 0;

  return (
    <Button
      onClick={onBroadcast}
      disabled={disabled || isLoading || !hasSegments}
      size="lg"
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Send className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}
