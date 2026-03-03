import { useState, useRef, useEffect } from 'react';
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
import { Search, Loader2, Settings } from 'lucide-react';
import { useShortFormVideos } from '@/hooks/useShortFormVideos';
import { VideoCard } from '@/components/VideoCard';
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
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const { data: allVideos = [], isLoading } = useShortFormVideos(searchQuery);
  
  // Filter out blocked users
  const videos = allVideos.filter(video => !blocklist.includes(video.pubkey));

  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setSearchQuery('');
    }
  }, [open]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);



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
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos on Nostr..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 h-12"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
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
              {searchQuery ? 'No videos found for your search' : 'No videos available'}
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
