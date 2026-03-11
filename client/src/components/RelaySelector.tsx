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
import { WRITE_RELAYS_OPTIONS } from '@/lib/dvmRelays';

interface RelaySelectorProps {
  userSelectedWriteRelays: string[];
  onUserSelectedWriteRelaysChange: (urls: string[]) => void;
}

function stripScheme(url: string): string {
  return url.replace(/^wss:\/\//, '').replace(/^ws:\/\//, '');
}

export function RelaySelector({ userSelectedWriteRelays, onUserSelectedWriteRelaysChange }: RelaySelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [customRelayUrls, setCustomRelayUrls] = usePersistedState<string[]>('write-relays-custom', []);

  const allRelayOptions = [...WRITE_RELAYS_OPTIONS, ...customRelayUrls];

  const toggleRelay = (url: string, enabled: boolean) => {
    if (enabled) {
      onUserSelectedWriteRelaysChange([...userSelectedWriteRelays, url]);
    } else {
      onUserSelectedWriteRelaysChange(userSelectedWriteRelays.filter((u) => u !== url));
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
    if (!userSelectedWriteRelays.includes(url)) {
      onUserSelectedWriteRelaysChange([...userSelectedWriteRelays, url]);
    }
    setCustomInput('');
    setOpen(false);
    toast({ title: 'Relay added', description: stripScheme(url) });
  };

  const displayLabel = userSelectedWriteRelays.length === 0
    ? 'No relays'
    : userSelectedWriteRelays.length === 1
      ? stripScheme(userSelectedWriteRelays[0])
      : `${userSelectedWriteRelays.length} relays`;

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
            <h4 className="font-semibold mb-2">Publish video to</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Toggle relays. At least one required.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Relays</Label>
            {allRelayOptions.map((url) => (
              <div key={url} className="flex items-center gap-2">
                <Checkbox
                  id={`relay-${url}`}
                  checked={userSelectedWriteRelays.includes(url)}
                  onCheckedChange={(checked) => toggleRelay(url, checked === true)}
                />
                <label htmlFor={`relay-${url}`} className="text-sm cursor-pointer flex-1 truncate">
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
