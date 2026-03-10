import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search, Loader2, Settings, Check, ChevronsUpDown } from 'lucide-react';
import { useShortFormVideos } from '@/hooks/useShortFormVideos';
import { useContactList } from '@/hooks/useFollow';
import { useBulkAuthorMetadata } from '@/hooks/useAuthor';
import { VideoCard } from '@/components/VideoCard';
import { nip19 } from 'nostr-tools';
import type { Video } from '@/types/video';

interface VideoPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectVideo: (video: Video) => void;
  blocklist: string[];
  onAddToBlocklist: (pubkey: string) => void;
  onOpenBlocklistManager: () => void;
}

export function VideoPickerModal({
  open,
  onClose,
  onSelectVideo,
  blocklist,
  onAddToBlocklist,
  onOpenBlocklistManager,
}: VideoPickerModalProps) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [authorPubkey, setAuthorPubkey] = useState<string | null>(null);
  const [authorInputValue, setAuthorInputValue] = useState('');
  const [authorPopoverOpen, setAuthorPopoverOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const trimmed = searchInput.trim();
  const effectiveSearch = trimmed;

  const effectiveAuthor = authorPubkey;
  const { data: allVideos = [], isLoading } = useShortFormVideos(
    searchQuery || undefined,
    effectiveAuthor || undefined
  );

  const { data: contactList } = useContactList();
  const followedPubkeys = useMemo(() => {
    if (!contactList?.tags) return [];
    return contactList.tags
      .filter((tag): tag is [string, string] => tag[0] === 'p' && !!tag[1])
      .map(([, pubkey]) => pubkey);
  }, [contactList?.tags]);

  const { data: authorDisplayNames = {} } = useBulkAuthorMetadata(followedPubkeys);

  const videos = allVideos.filter((v) => !blocklist.includes(v.pubkey));


  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setSearchQuery('');
      setAuthorPubkey(null);
      setAuthorInputValue('');
    }
  }, [open]);

  useEffect(() => {
    const v = authorInputValue.trim();
    if (!v) {
      setAuthorPubkey(null);
      return;
    }
    const isNpubLike = /^n(pub|profile)1[a-z0-9]+$/i.test(v);
    if (isNpubLike) {
      try {
        const decoded = nip19.decode(v);
        if (decoded.type === 'npub') {
          setAuthorPubkey(decoded.data);
          return;
        }
        if (decoded.type === 'nprofile') {
          setAuthorPubkey(decoded.data.pubkey);
          return;
        }
      } catch {
        // leave author unchanged on decode error
      }
    }
  }, [authorInputValue]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setSearchQuery(effectiveSearch), 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [effectiveSearch]);



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">Browse Nostr Videos</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {videos.length} videos available
                {blocklist.length > 0 && (
                  <span className="ml-2">
                    ({blocklist.length} user{blocklist.length !== 1 ? 's' : ''} blocked)
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBlocklistManager}
            >
              <Settings className="h-4 w-4 mr-2" />
              Blocklist
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search videos…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 h-12"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <Popover open={authorPopoverOpen} onOpenChange={setAuthorPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={authorPopoverOpen}
                  className="w-full sm:w-[280px] h-12 justify-between font-normal"
                >
                  <span className="truncate">
                    {authorInputValue || 'From people I follow or paste npub…'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command
                  shouldFilter={true}
                  value={authorInputValue}
                  onValueChange={(v) => setAuthorInputValue(v)}
                >
                  <CommandInput placeholder="Type name or paste npub…" />
                  <CommandList>
                    <CommandEmpty>No one found. Paste an npub to filter by that user.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="All videos"
                        onSelect={() => {
                          setAuthorPubkey(null);
                          setAuthorInputValue('');
                          setAuthorPopoverOpen(false);
                        }}
                      >
                        <Check className={!authorPubkey ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                        All videos
                      </CommandItem>
                      {followedPubkeys.map((pubkey) => {
                        const label = authorDisplayNames[pubkey] ?? `${pubkey.slice(0, 8)}…`;
                        return (
                          <CommandItem
                            key={pubkey}
                            value={label}
                            onSelect={() => {
                              setAuthorPubkey(pubkey);
                              setAuthorInputValue(label);
                              setAuthorPopoverOpen(false);
                            }}
                          >
                            <Check className={authorPubkey === pubkey ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        {/* Grid Mode */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && !videos.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <Skeleton className="aspect-[9/16] w-full rounded-t" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {effectiveAuthor
                ? 'No videos from this user'
                : searchQuery
                  ? 'No videos found for your search'
                  : 'No videos available'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onQuickAdd={() => {
                    onSelectVideo(video);
                    onClose();
                  }}
                  showQuickAdd={true}
                  onBlockUser={(pubkey) => {
                    onAddToBlocklist(pubkey);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
