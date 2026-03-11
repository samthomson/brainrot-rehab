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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, EyeOff, Plus, Copy } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useBulkAuthorMetadata } from '@/hooks/useAuthor';
import { nip19 } from 'nostr-tools';

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
  const { data: excludedUsersMetadata = {} } = useBulkAuthorMetadata(blocklist);

  const handleAdd = () => {
    let pubkey = pubkeyInput.trim();
    if (!pubkey) return;

    // Try to decode as npub if not 64 char hex
    if (pubkey.length !== 64) {
      try {
        const decoded = nip19.decode(pubkey);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else if (decoded.type === 'nprofile') {
          pubkey = decoded.data.pubkey;
        } else {
          throw new Error('Not a valid npub or nprofile');
        }
      } catch {
        toast({
          title: 'Invalid Input',
          description: 'Must be a 64-character hex pubkey or npub',
          variant: 'destructive',
        });
        return;
      }
    }

    if (blocklist.includes(pubkey)) {
      toast({
        title: 'Already Excluded',
        description: 'This user is already in your exclude list',
      });
      return;
    }

    onAddToBlocklist(pubkey);
    setPubkeyInput('');
    toast({
      title: 'User Excluded',
      description: 'Added to exclude list',
    });
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Exclude List
          </DialogTitle>
          <DialogDescription>
            Hide videos from specific users in the video picker. {blocklist.length} user{blocklist.length !== 1 ? 's' : ''} excluded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add to exclude list */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter pubkey (64 char hex) or npub..."
              value={pubkeyInput}
              onChange={(e) => setPubkeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="font-mono text-sm"
            />
            <Button onClick={handleAdd} size="icon" className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Exclude list */}
          <ScrollArea className="h-96 border rounded-lg p-3">
            {blocklist.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No excluded users
              </div>
            ) : (
              <div className="space-y-3">
                {blocklist.map((pubkey) => {
                  const metadata = excludedUsersMetadata[pubkey];
                  const displayName = metadata?.name || metadata?.display_name || `${pubkey.slice(0, 8)}...`;
                  const npub = nip19.npubEncode(pubkey);
                  
                  return (
                    <Card key={pubkey}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarImage src={metadata?.picture} alt={displayName} />
                            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-medium truncate">{displayName}</div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-muted-foreground truncate flex-1">{pubkey}</code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopy(pubkey, 'Pubkey')}
                                  className="h-6 w-6 shrink-0"
                                  title="Copy pubkey"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs text-muted-foreground truncate flex-1">{npub}</code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopy(npub, 'Npub')}
                                  className="h-6 w-6 shrink-0"
                                  title="Copy npub"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveFromBlocklist(pubkey)}
                            className="h-8 w-8 shrink-0"
                            title="Remove from exclude list"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
