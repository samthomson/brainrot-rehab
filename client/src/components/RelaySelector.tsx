import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Radio, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { BRAINROT_RELAY_URL, OPTIONAL_RELAY_PRESETS } from '@/lib/dvmRelays';

interface RelaySelectorProps {
  /** Enabled additional relays (brainrot is always in the pool). */
  additionalRelays: string[];
  onAdditionalRelaysChange: (urls: string[]) => void;
}

function stripScheme(url: string): string {
  return url.replace(/^wss:\/\//, '').replace(/^ws:\/\//, '');
}

export function RelaySelector({ additionalRelays, onAdditionalRelaysChange }: RelaySelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [customRelayUrls, setCustomRelayUrls] = usePersistedState<string[]>('dvm-custom-relays', []);

  const allOptionalUrls = [...OPTIONAL_RELAY_PRESETS, ...customRelayUrls];

  const toggleRelay = (url: string, enabled: boolean) => {
    if (enabled) {
      onAdditionalRelaysChange([...additionalRelays, url]);
    } else {
      onAdditionalRelaysChange(additionalRelays.filter((u) => u !== url));
    }
  };

  const addCustomRelay = () => {
    const url = customInput.trim();
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      toast({
        title: 'Invalid Relay',
        description: 'Relay URL must start with wss:// or ws://',
        variant: 'destructive',
      });
      return;
    }
    if (!customRelayUrls.includes(url)) {
      setCustomRelayUrls((prev) => [...prev, url]);
    }
    if (!additionalRelays.includes(url)) {
      onAdditionalRelaysChange([...additionalRelays, url]);
    }
    setCustomInput('');
    setOpen(false);
    toast({ title: 'Relay added', description: stripScheme(url) });
  };

  const displayLabel = additionalRelays.length === 0
    ? stripScheme(BRAINROT_RELAY_URL)
    : `${stripScheme(BRAINROT_RELAY_URL)} +${additionalRelays.length}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Radio className="h-4 w-4" />
          <span className="hidden sm:inline">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">DVM relay pool</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Our relay is always used; optionally add more.
            </p>
          </div>

          <div className="text-sm font-medium text-muted-foreground">
            Always on: {stripScheme(BRAINROT_RELAY_URL)}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Additional relays</Label>
            {allOptionalUrls.map((url) => (
              <div key={url} className="flex items-center gap-2">
                <Checkbox
                  id={url}
                  checked={additionalRelays.includes(url)}
                  onCheckedChange={(checked) => toggleRelay(url, checked === true)}
                />
                <label htmlFor={url} className="text-sm cursor-pointer flex-1 truncate">
                  {stripScheme(url)}
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="custom-relay" className="text-xs">
              Add custom relay
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-relay"
                placeholder="wss://relay.example.com"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomRelay()}
                className="text-sm"
              />
              <Button onClick={addCustomRelay} size="sm">
                Add
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
