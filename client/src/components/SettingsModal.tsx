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
import { ALL_DVM_RELAY_PRESETS, DEFAULT_BLOSSOM_UPLOAD_URL } from '@/lib/dvmRelays';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  dvmPubkey: string;
  onDvmPubkeyChange: (pubkey: string) => void;
  blossomUploadUrl: string;
  onBlossomUrlChange: (url: string) => void;
  enabledRelays: string[];
  onEnabledRelaysChange: (urls: string[]) => void;
}

function stripScheme(url: string): string {
  return url.replace(/^wss:\/\//, '').replace(/^ws:\/\//, '');
}

export function SettingsModal({
  open,
  onClose,
  dvmPubkey,
  onDvmPubkeyChange,
  blossomUploadUrl,
  onBlossomUrlChange,
  enabledRelays,
  onEnabledRelaysChange,
}: SettingsModalProps) {
  const { toast } = useToast();
  const [customInput, setCustomInput] = useState('');
  const [customRelayUrls, setCustomRelayUrls] = usePersistedState<string[]>('dvm-custom-relays', []);

  const allRelayOptions = [...ALL_DVM_RELAY_PRESETS, ...customRelayUrls];

  const toggleRelay = (url: string, enabled: boolean) => {
    if (enabled) {
      onEnabledRelaysChange([...enabledRelays, url]);
    } else {
      onEnabledRelaysChange(enabledRelays.filter((u) => u !== url));
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
    if (!enabledRelays.includes(url)) {
      onEnabledRelaysChange([...enabledRelays, url]);
    }
    setCustomInput('');
    toast({ title: 'Relay added', description: stripScheme(url) });
  };

  const handleSave = () => {
    if (dvmPubkey && dvmPubkey.length !== 64) {
      toast({
        title: 'Invalid Pubkey',
        description: 'DVM pubkey must be 64 characters (hex)',
        variant: 'destructive',
      });
      return;
    }
    if (enabledRelays.length === 0) {
      toast({
        title: 'At least one relay required',
        description: 'Enable at least one DVM relay to send jobs.',
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
            <h4 className="font-semibold">DVM</h4>
            <div className="space-y-2">
              <Label htmlFor="dvm-pubkey">DVM Pubkey</Label>
              <Input
                id="dvm-pubkey"
                placeholder="Enter DVM pubkey (64 char hex)..."
                value={dvmPubkey}
                onChange={(e) => onDvmPubkeyChange(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">The pubkey of the DVM that processes your videos (default from build; you can override)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blossom-url">Blossom Upload URL</Label>
              <Input
                id="blossom-url"
                placeholder={DEFAULT_BLOSSOM_UPLOAD_URL}
                value={blossomUploadUrl}
                onChange={(e) => onBlossomUrlChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Where the DVM uploads the final video</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold">DVM Relay Pool</h4>
            <p className="text-xs text-muted-foreground">
              Choose which relays to use for DVM jobs. At least one must be enabled. You can turn off the default and use only a custom relay.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Relays</Label>
              {allRelayOptions.map((url) => (
                <div key={url} className="flex items-center gap-2">
                  <Checkbox
                    id={url}
                    checked={enabledRelays.includes(url)}
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
