import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, UserX, Plus, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface BlocklistManagerProps {
  open: boolean;
  onClose: () => void;
  blocklist: string[];
  onAddToBlocklist: (pubkey: string) => void;
  onRemoveFromBlocklist: (pubkey: string) => void;
}

export function BlocklistManager({
  open,
  onClose,
  blocklist,
  onAddToBlocklist,
  onRemoveFromBlocklist,
}: BlocklistManagerProps) {
  const [pubkeyInput, setPubkeyInput] = useState('');
  const { toast } = useToast();

  const handleAdd = () => {
    const pubkey = pubkeyInput.trim();
    if (!pubkey) return;

    if (pubkey.length !== 64) {
      toast({
        title: 'Invalid Pubkey',
        description: 'Pubkey must be 64 characters (hex format)',
        variant: 'destructive',
      });
      return;
    }

    if (blocklist.includes(pubkey)) {
      toast({
        title: 'Already Blocked',
        description: 'This pubkey is already in your blocklist',
      });
      return;
    }

    onAddToBlocklist(pubkey);
    setPubkeyInput('');
    toast({
      title: 'User Blocked',
      description: 'Added to blocklist',
    });
  };

  const handleCopyPubkey = async (pubkey: string) => {
    await navigator.clipboard.writeText(pubkey);
    toast({
      title: 'Copied!',
      description: 'Pubkey copied to clipboard',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            Blocklist Management
          </DialogTitle>
          <DialogDescription>
            Block users to hide their videos from the picker. {blocklist.length} user{blocklist.length !== 1 ? 's' : ''} blocked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add to blocklist */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter pubkey (64 char hex)..."
              value={pubkeyInput}
              onChange={(e) => setPubkeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="font-mono text-sm"
            />
            <Button onClick={handleAdd} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Blocklist */}
          <ScrollArea className="h-64 border rounded-lg p-2">
            {blocklist.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No blocked users
              </div>
            ) : (
              <div className="space-y-2">
                {blocklist.map((pubkey) => (
                  <Card key={pubkey}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <code className="text-xs flex-1 truncate">{pubkey}</code>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyPubkey(pubkey)}
                          className="h-8 w-8"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveFromBlocklist(pubkey)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
