import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useVideoAuthor } from '@/hooks/useVideoAuthor';
import { useAuthor } from '@/hooks/useAuthor';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import type { Video } from '@/types/video';

interface VideoLightboxProps {
  video: Video | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SourceRef {
  eventId: string;
  pubkey?: string;
}

function extractSourceRefs(video: Video): SourceRef[] {
  const refs: SourceRef[] = [];
  const eTags = video.event.tags.filter(([t]) => t === 'e');
  const pTags = video.event.tags.filter(([t]) => t === 'p');
  const pubkeys = pTags.map(([, pk]) => pk);

  for (let i = 0; i < eTags.length; i++) {
    const eventId = eTags[i][1];
    if (!eventId) continue;
    // Skip the 'd' tag value if it matches (it's the replaceable event identifier, not a source)
    const dTag = video.event.tags.find(([t]) => t === 'd')?.[1];
    if (eventId === dTag) continue;
    refs.push({ eventId, pubkey: pubkeys[i] });
  }
  return refs;
}

function SourceVideoCard({ eventId, pubkey }: { eventId: string; pubkey?: string }) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || metadata?.display_name || (pubkey ? `${pubkey.slice(0, 8)}...` : 'Unknown');

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-muted-foreground truncate" title={eventId}>
          {eventId.slice(0, 12)}...
        </p>
        {pubkey && (
          <p className="text-sm font-medium mt-1">{displayName}</p>
        )}
        <a
          href={`https://njump.me/${eventId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          View on njump
        </a>
      </div>
    </div>
  );
}

export function VideoLightbox({ video, open, onOpenChange }: VideoLightboxProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { displayName } = useVideoAuthor(video ?? { pubkey: '', event: { pubkey: '' } } as Video);

  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    if (!open && videoRef.current) {
      videoRef.current.pause();
    }
  }, [open]);

  if (!video) return null;

  const sourceRefs = extractSourceRefs(video);
  const hasSources = sourceRefs.length > 0;

  const formatDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const clientTag = video.event.tags.find(([t]) => t === 'client')?.[1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`p-0 gap-0 overflow-hidden border-none ${
        hasSources ? 'max-w-4xl' : 'max-w-lg'
      } [&>button]:text-white [&>button]:hover:text-white/80 [&>button]:z-10`}>
        <DialogTitle className="sr-only">{video.name}</DialogTitle>
        <div className={`flex ${hasSources ? 'flex-row' : 'flex-col'}`}>
          {/* Main video */}
          <div className={`flex flex-col bg-black ${hasSources ? 'w-[55%] shrink-0' : 'w-full'}`}>
            <div className="relative aspect-[9/16] max-h-[85vh]">
              <video
                ref={videoRef}
                src={video.url}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
                crossOrigin="anonymous"
                loop
              />
            </div>
            <div className="p-4 bg-background">
              <p className="font-semibold">{video.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {displayName} &middot; {formatDate(video.publishedAt)}
              </p>
              {clientTag && (
                <p className="text-xs text-muted-foreground mt-1">
                  Client: {clientTag}
                </p>
              )}
              <a
                href={`https://njump.me/${video.event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                View event on njump
              </a>
            </div>
          </div>

          {/* Source videos panel */}
          {hasSources && (
            <div className="flex-1 bg-background border-l overflow-y-auto max-h-[85vh]">
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Source Videos ({sourceRefs.length})
                </h3>
                <div className="space-y-2">
                  {sourceRefs.map((ref) => (
                    <SourceVideoCard
                      key={ref.eventId}
                      eventId={ref.eventId}
                      pubkey={ref.pubkey}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
