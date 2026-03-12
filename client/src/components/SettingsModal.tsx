import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { usePersistedState } from '@/hooks/usePersistedState';
import { WRITE_RELAYS_OPTIONS } from '@/lib/dvmRelays';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  userSelectedWriteRelays: string[];
  onUserSelectedWriteRelaysChange: (urls: string[]) => void;
}

function stripScheme(url: string): string {
  return url.replace(/^wss:\/\//, '').replace(/^ws:\/\//, '');
}

export function SettingsModal({
  open,
  onClose,
  userSelectedWriteRelays,
  onUserSelectedWriteRelaysChange,
}: SettingsModalProps) {
  const { toast } = useToast();
  const [customInput, setCustomInput] = useState('');
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
    toast({ title: 'Relay added', description: stripScheme(url) });
  };

  const handleSave = () => {
    if (userSelectedWriteRelays.length === 0) {
      toast({
        title: 'At least one relay required',
        description: 'Select at least one relay to publish your video to.',
        variant: 'destructive',
      });
      return;
    }
    onClose();
    toast({ title: 'Settings Saved', description: 'Configuration updated' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold">Publish video to</h4>
            <p className="text-xs text-muted-foreground">
              Relays where your finished video will be published. At least one required.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Relays</Label>
              {allRelayOptions.map((url) => (
                <div key={url} className="flex items-center gap-2">
                  <Checkbox
                    id={url}
                    checked={userSelectedWriteRelays.includes(url)}
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

          <Button onClick={handleSave} className="w-full">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
