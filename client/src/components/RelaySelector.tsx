import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, Check, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { usePersistedState } from '@/hooks/usePersistedState';

interface RelaySelectorProps {
  selectedRelay: string;
  onRelayChange: (relay: string) => void;
}

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
];

export function RelaySelector({ selectedRelay, onRelayChange }: RelaySelectorProps) {
  const [customRelay, setCustomRelay] = useState('');
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [customRelays, setCustomRelays] = usePersistedState<string[]>('custom-relays', []);
  
  const allRelays = [...DEFAULT_RELAYS, ...customRelays];

  const handleCustomRelay = () => {
    const relay = customRelay.trim();
    if (!relay.startsWith('wss://') && !relay.startsWith('ws://')) {
      toast({
        title: 'Invalid Relay',
        description: 'Relay URL must start with wss:// or ws://',
        variant: 'destructive',
      });
      return;
    }

    // Add to custom relays list if not already there
    if (!allRelays.includes(relay)) {
      setCustomRelays((prev) => [...prev, relay]);
    }

    onRelayChange(relay);
    setCustomRelay('');
    setOpen(false);
    toast({
      title: 'Relay Added & Selected',
      description: relay,
    });
  };

  const displayRelay = selectedRelay.replace('wss://', '').replace('ws://', '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Radio className="h-4 w-4" />
          <span className="hidden sm:inline">{displayRelay}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Select Relay</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Choose where to broadcast DVM job requests
            </p>
          </div>

          {/* All relays (preset + custom) */}
          <div className="space-y-2">
            {allRelays.map((relay) => (
              <Button
                key={relay}
                variant={selectedRelay === relay ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  onRelayChange(relay);
                  setOpen(false);
                }}
              >
                {selectedRelay === relay && <Check className="h-4 w-4 mr-2" />}
                {relay.replace('wss://', '').replace('ws://', '')}
              </Button>
            ))}
          </div>

          {/* Custom relay */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="custom-relay" className="text-xs">
              Custom Relay
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-relay"
                placeholder="wss://relay.example.com"
                value={customRelay}
                onChange={(e) => setCustomRelay(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomRelay()}
                className="text-sm"
              />
              <Button onClick={handleCustomRelay} size="sm">
                Set
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
