import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Settings, Check, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useShortFormVideos } from '@/hooks/useShortFormVideos';
import { useContactList } from '@/hooks/useFollow';
import { useBulkAuthorMetadata } from '@/hooks/useAuthor';
import { VideoCard } from '@/components/VideoCard';
import { nip19 } from 'nostr-tools';
import type { Video } from '@/types/video';

/** Returns hex pubkey or null. Tries input as-is, then npub1+input. */
function tryDecodeNpub(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  const toTry = /^n(pub|profile)1/i.test(v) ? [v] : [v, `npub1${v}`];
  for (const candidate of toTry) {
    try {
      const decoded = nip19.decode(candidate);
      if (decoded.type === 'npub') return decoded.data;
      if (decoded.type === 'nprofile') return decoded.data.pubkey;
    } catch {
      continue;
    }
  }
  return null;
}

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
  const [authorPubkey, setAuthorPubkey] = useState<string | null>(null);
  const [authorInputValue, setAuthorInputValue] = useState('');
  const [authorPopoverOpen, setAuthorPopoverOpen] = useState(false);
  const [followOnly, setFollowOnly] = useState(false);

  const { data: contactList } = useContactList();
  const followedPubkeys = useMemo(() => {
    if (!contactList?.tags) return [];
    return contactList.tags
      .filter((tag): tag is [string, string] => tag[0] === 'p' && !!tag[1])
      .map(([, pubkey]) => pubkey);
  }, [contactList?.tags]);

  const { data: authorMetadata = {} } = useBulkAuthorMetadata(followedPubkeys);

  const effectiveAuthor = authorPubkey;
  const effectiveAuthorPubkeys =
    effectiveAuthor ? undefined : (followOnly && followedPubkeys.length ? followedPubkeys : undefined);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShortFormVideos(
    undefined,
    effectiveAuthor || undefined,
    effectiveAuthorPubkeys
  );

  const allFetchedVideos = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const out: Video[] = [];
    for (const page of data.pages) {
      for (const v of page) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        out.push(v);
      }
    }
    out.sort((a, b) => b.publishedAt - a.publishedAt);
    return out;
  }, [data?.pages]);

  // When user explicitly filters by npub, show that author's videos even if blocked
  const videos = useMemo(
    () => allFetchedVideos.filter(
      (v) => !blocklist.includes(v.pubkey) || v.pubkey === effectiveAuthor
    ),
    [allFetchedVideos, blocklist, effectiveAuthor]
  );

  const videoPubkeys = useMemo(
    () => [...new Set(videos.map((v) => v.pubkey))],
    [videos]
  );
  const { data: videoAuthorMetadata = {} } = useBulkAuthorMetadata(videoPubkeys);

  useEffect(() => {
    if (!open) {
      setAuthorPubkey(null);
      setAuthorInputValue('');
    }
  }, [open]);

  // Decode npub when user types/pastes in the input (works for anyone, not just followed)
  useEffect(() => {
    const v = authorInputValue.trim();
    if (!v) {
      setAuthorPubkey(null);
      return;
    }
    const pub = tryDecodeNpub(v);
    if (pub) {
      setAuthorPubkey(pub);
      setAuthorPopoverOpen(false);
    }
  }, [authorInputValue]);



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
                    ({blocklist.length} user{blocklist.length !== 1 ? 's' : ''} excluded)
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
              Exclude List
            </Button>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 min-w-0 rounded-lg border bg-background">
                <Input
                  placeholder="Paste npub (npub1…) or pick from list"
                  value={authorInputValue}
                  onChange={(e) => setAuthorInputValue(e.target.value)}
                  className="h-14 flex-1 min-w-0 border-0 bg-transparent text-base font-mono placeholder:font-sans focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Popover open={authorPopoverOpen} onOpenChange={setAuthorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-14 w-14 shrink-0 rounded-l-none"
                      aria-label="Pick from list"
                    >
                      <ChevronsUpDown className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command shouldFilter={true}>
                      <CommandInput placeholder="Search people you follow…" />
                      <CommandList>
                        <CommandEmpty>
                          No matches. Paste an npub in the main input to search anyone.
                        </CommandEmpty>
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
                          {followedPubkeys
                            .map((pubkey) => {
                              const metadata = authorMetadata[pubkey];
                              const displayName = metadata?.name || metadata?.display_name;
                              return { pubkey, displayName, metadata };
                            })
                            .filter(({ displayName }) => displayName)
                            .sort((a, b) => a.displayName!.localeCompare(b.displayName!))
                            .map(({ pubkey, displayName }) => (
                              <CommandItem
                                key={pubkey}
                                value={displayName!}
                                onSelect={() => {
                                  setAuthorPubkey(pubkey);
                                  setAuthorInputValue(displayName!);
                                  setAuthorPopoverOpen(false);
                                }}
                              >
                                <Check className={authorPubkey === pubkey ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                                <span className="truncate">{displayName}</span>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {isLoading && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <Checkbox
                checked={followOnly}
                onCheckedChange={(checked) => setFollowOnly(checked === true)}
              />
              <span>Show videos from people I follow only</span>
            </label>
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
                ? 'No videos from this user on connected relays'
                : effectiveAuthorPubkeys?.length
                  ? 'No videos from people you follow'
                  : 'No videos available'}
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    authorName={videoAuthorMetadata[video.pubkey]?.name || videoAuthorMetadata[video.pubkey]?.display_name}
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
              {hasNextPage && (
                <div className="flex justify-center pt-2">
                  <Button
                    size="lg"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
