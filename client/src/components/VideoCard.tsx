import { useState, useRef, useEffect, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Pause, Plus, Copy, Ban, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useVideoAuthor } from '@/hooks/useVideoAuthor';
import { useToast } from '@/hooks/useToast';
import { BRAINROT_CLIENT_TAG } from '@/lib/dvmRelays';
import { cn } from '@/lib/utils';
import type { Video } from '@/types/video';

interface VideoCardProps {
  video: Video;
  /** Pass pre-fetched author name to avoid per-card relay queries */
  authorName?: string;
  onQuickAdd?: () => void;
  showQuickAdd?: boolean;
  onBlockUser?: (pubkey: string) => void;
  onClick?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (eventId: string) => Promise<void>;
  isTogglingFavorite?: boolean;
}

export const VideoCard = memo(function VideoCard({
  video,
  authorName,
  onQuickAdd,
  showQuickAdd = false,
  onBlockUser,
  onClick,
  isFavorite = false,
  onToggleFavorite,
  isTogglingFavorite = false,
}: VideoCardProps) {
  const skipAuthorQuery = !!authorName;
  const fallback = useVideoAuthor(skipAuthorQuery ? undefined : video);
  const displayName = authorName || fallback.displayName;
  const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null);
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnailVideoRef = useRef<HTMLVideoElement>(null);
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const clientTag = video.event.tags.find(([name]) => name === 'client')?.[1];
  const isBrainrotPublished = clientTag === BRAINROT_CLIENT_TAG;

  useEffect(() => {
    if (!video.thumbnailUrl && !generatedThumbnail && thumbnailVideoRef.current) {
      const videoEl = thumbnailVideoRef.current;
      
      const generateThumbnail = () => {
        try {
          const seekTime = Math.min(1, (videoEl.duration || 10) * 0.1);
          videoEl.currentTime = seekTime;
        } catch (error) {
          console.error('Error seeking video for thumbnail:', error);
        }
      };

      const captureThumbnail = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.5);
            setGeneratedThumbnail(thumbnail);
          }
        } catch (error) {
          console.error('Error generating thumbnail:', error);
        } finally {
          videoEl.removeEventListener('loadedmetadata', generateThumbnail);
          videoEl.removeEventListener('seeked', captureThumbnail);
        }
      };

      videoEl.addEventListener('loadedmetadata', generateThumbnail);
      videoEl.addEventListener('seeked', captureThumbnail);

      return () => {
        videoEl.removeEventListener('loadedmetadata', generateThumbnail);
        videoEl.removeEventListener('seeked', captureThumbnail);
      };
    }
  }, [video.thumbnailUrl, generatedThumbnail]);

  const handleCopyPubkey = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(video.pubkey);
    toast({
      title: 'Copied!',
      description: 'Pubkey copied to clipboard',
    });
  };

  const handleBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBlockUser) {
      onBlockUser(video.pubkey);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      setShowInlinePlayer(true);
      setIsPlaying(true);
      setTimeout(() => {
        if (inlineVideoRef.current) {
          inlineVideoRef.current.play();
        }
      }, 100);
    }
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inlineVideoRef.current) {
      if (isPlaying) {
        inlineVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        inlineVideoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return 'Unknown date';
    }
  };

  const thumbnailSrc = video.thumbnailUrl || generatedThumbnail;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg group',
        isBrainrotPublished && 'bg-primary text-primary-foreground border-primary/40'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        <div className={cn(
          'relative aspect-[9/16] bg-muted overflow-hidden rounded-t',
          isBrainrotPublished && 'bg-primary/80'
        )}>
          {showInlinePlayer ? (
            <>
              <video
                ref={inlineVideoRef}
                src={video.url}
                className="w-full h-full object-cover"
                playsInline
                crossOrigin="anonymous"
                loop
                onEnded={() => setIsPlaying(false)}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={togglePlayPause}
                  size="lg"
                  className="rounded-full h-12 w-12"
                  variant="secondary"
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {thumbnailSrc ? (
                <img
                  src={thumbnailSrc}
                  alt={video.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              
              {!video.thumbnailUrl && !generatedThumbnail && (
                <video
                  ref={thumbnailVideoRef}
                  src={video.url}
                  className="hidden"
                  preload="metadata"
                  crossOrigin="anonymous"
                  muted
                />
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Play className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </>
          )}
          
          {/* Action Buttons */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {showQuickAdd && onQuickAdd && (
              <Button
                size="icon"
                className="rounded-full shadow-lg h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdd();
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {onToggleFavorite && (
              <Button
                size="icon"
                variant={isFavorite ? 'default' : 'secondary'}
                className="rounded-full shadow-lg h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(video.id)
                    .then(() => {
                      toast({
                        title: isFavorite ? 'Removed from favorites' : 'Added to favorites',
                        description: isFavorite ? 'Video removed from saved list' : 'Video saved',
                      });
                    })
                    .catch((error: unknown) => {
                      const message = String(error);
                      toast({
                        title: message.toLowerCase().includes('login required') ? 'Login required' : 'Failed to update favorites',
                        description: message.toLowerCase().includes('login required')
                          ? 'Log in to save favorites'
                          : message,
                        variant: 'destructive',
                      });
                    });
                }}
                disabled={isTogglingFavorite}
                title={isFavorite ? 'Remove from saved' : 'Save video'}
              >
                <Bookmark className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              </Button>
            )}
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-lg h-8 w-8"
              onClick={handleCopyPubkey}
              title="Copy pubkey"
            >
              <Copy className="h-3 w-3" />
            </Button>
            {onBlockUser && (
              <Button
                size="icon"
                variant="destructive"
                className="rounded-full shadow-lg h-8 w-8"
                onClick={handleBlock}
                title="Block this user"
              >
                <Ban className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {video.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {video.duration.toFixed(0)}s
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="font-medium text-sm truncate mb-1">
            {video.name}
          </p>
          <p className={cn(
            'text-xs truncate',
            isBrainrotPublished ? 'text-primary-foreground/90' : 'text-muted-foreground'
          )}>
            {displayName}
          </p>
          <p className={cn(
            'text-xs truncate',
            isBrainrotPublished ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}>
            {formatDate(video.publishedAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
});
