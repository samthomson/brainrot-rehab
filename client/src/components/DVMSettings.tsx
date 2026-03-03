import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';

interface DVMSettingsProps {
  open: boolean;
  onClose: () => void;
  dvmPubkey: string;
  onDvmPubkeyChange: (pubkey: string) => void;
  blossomUploadUrl: string;
  onBlossomUrlChange: (url: string) => void;
}

export function DVMSettings({
  open,
  onClose,
  dvmPubkey,
  onDvmPubkeyChange,
  blossomUploadUrl,
  onBlossomUrlChange,
}: DVMSettingsProps) {
  const { toast } = useToast();

  const handleSave = () => {
    if (dvmPubkey && dvmPubkey.length !== 64) {
      toast({
        title: 'Invalid Pubkey',
        description: 'DVM pubkey must be 64 characters (hex)',
        variant: 'destructive',
      });
      return;
    }

    onClose();
    toast({
      title: 'Settings Saved',
      description: 'DVM configuration updated',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>DVM Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dvm-pubkey">DVM Pubkey</Label>
            <Input
              id="dvm-pubkey"
              placeholder="Enter DVM pubkey (64 char hex)..."
              value={dvmPubkey}
              onChange={(e) => onDvmPubkeyChange(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The pubkey of the DVM service that will process your videos
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blossom-url">Blossom Upload URL</Label>
            <Input
              id="blossom-url"
              placeholder="https://blossom.primal.net"
              value={blossomUploadUrl}
              onChange={(e) => onBlossomUrlChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where the DVM should upload the final video
            </p>
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
