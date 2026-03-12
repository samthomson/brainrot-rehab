import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useVideoAuthor } from '@/hooks/useVideoAuthor';
import { useVideoEventsById } from '@/hooks/useBrainrotVideos';
import { useAuthor } from '@/hooks/useAuthor';
import { useReactions, useReact } from '@/hooks/useReactions';
import { useRepost } from '@/hooks/useRepost';
import { useComments } from '@/hooks/useComments';
import { usePostComment } from '@/hooks/usePostComment';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFavoriteVideos } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/useToast';
import { useZaps } from '@/hooks/useZaps';
import { useWallet } from '@/hooks/useWallet';
import { ZapDialog } from '@/components/ZapDialog';
import { useIsFollowing, useToggleFollow } from '@/hooks/useFollow';
import { UserPlus, UserMinus, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Repeat2, MessageSquare, Send, Zap, Play, Pause, Bookmark } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
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
    const dTag = video.event.tags.find(([t]) => t === 'd')?.[1];
    if (eventId === dTag) continue;
    refs.push({ eventId, pubkey: pubkeys[i] });
  }
  return refs;
}

function SourceVideoCard({ source }: { source: Video }) {
  const { displayName } = useVideoAuthor(source);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const formatDate = (ts: number) => {
    try {
      return formatDistanceToNow(new Date(ts * 1000), { addSuffix: true });
    } catch {
      return '';
    }
  };
  const clientTag = source.event.tags.find(([t]) => t === 'client')?.[1];
  const isDiVine = clientTag?.toLowerCase() === 'divine';
  const diVineUrl = isDiVine ? `https://divine.video/video/${source.event.id}` : null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex gap-3 rounded-xl border bg-card p-2 shadow-sm overflow-hidden font-sans">
      <div 
        className="relative w-[7.5rem] h-[7.5rem] shrink-0 rounded-lg bg-black overflow-hidden cursor-pointer group"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={source.url}
          className="w-full h-full object-cover"
          playsInline
          muted
          preload="metadata"
          crossOrigin="anonymous"
          loop
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <div className="absolute inset-0 flex items-end justify-end p-1.5 pointer-events-none">
          <div className="rounded-full bg-primary/90 text-primary-foreground p-1 shadow-sm">
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 py-0.5 flex flex-col justify-between">
        <div>
          <p className="font-medium text-sm mt-0.5">
            <Link
              to={`/profile/${nip19.npubEncode(source.pubkey)}`}
              className="text-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {displayName}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(source.publishedAt)}</p>
          {source.event.tags.filter(([t]) => t === 't').length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {source.event.tags
                .filter(([t]) => t === 't')
                .slice(0, 5)
                .map(([, tag], i) => (
                  <span key={i} className="text-xs text-primary">
                    #{tag}
                  </span>
                ))}
            </div>
          )}
        </div>
        {clientTag && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{clientTag}</span>
            {diVineUrl && (
              <a
                href={diVineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View on diVine →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceRefFallbackCard({ sourceRef }: { sourceRef: SourceRef }) {
  const author = useAuthor(sourceRef.pubkey);
  const displayName =
    author.data?.metadata?.name ||
    author.data?.metadata?.display_name ||
    (sourceRef.pubkey ? `${sourceRef.pubkey.slice(0, 8)}...` : 'Unknown');

  return (
    <div className="flex gap-3 rounded-xl border border-dashed bg-muted/30 p-3 overflow-hidden font-sans">
      <div className="w-[7.5rem] h-[7.5rem] shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
        No preview
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-medium text-sm text-muted-foreground truncate" title={sourceRef.eventId}>
          {sourceRef.eventId.slice(0, 16)}…
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{displayName}</p>
        <p className="text-xs text-muted-foreground">Source not loaded</p>
      </div>
    </div>
  );
}

export function VideoLightbox({ video, open, onOpenChange }: VideoLightboxProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { displayName } = useVideoAuthor(video ?? { pubkey: '', event: { pubkey: '' } } as Video);
  const { user } = useCurrentUser();
  const { favoriteIdSet, toggleFavorite, isTogglingFavorite } = useFavoriteVideos();
  const { toast } = useToast();
  const { webln, activeNWC } = useWallet();

  const sourceRefs = video ? extractSourceRefs(video) : [];
  const sourceIds = sourceRefs.map((r) => r.eventId);
  const { data: sourceVideos = [], isLoading: sourcesLoading } = useVideoEventsById(sourceIds);
  const { data: reactions } = useReactions(video?.id || '');
  const { data: commentsData } = useComments(video?.event || ({} as any));
  const { mutateAsync: react } = useReact();
  const { mutateAsync: repost } = useRepost();
  const { mutateAsync: postComment } = usePostComment();
  const { totalSats, isLoading: zapsLoading } = useZaps(
    video?.event || ({} as any),
    webln,
    activeNWC
  );
  const isFollowing = useIsFollowing(video?.pubkey || '');
  const { mutateAsync: toggleFollow, isPending: isTogglingFollow } = useToggleFollow();

  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  const isOwnVideo = user?.pubkey === video?.pubkey;

  useEffect(() => {
    if (video && open) {
      console.log('[lightbox] Video event tags:', video.event.tags);
      console.log('[lightbox] Extracted source refs:', sourceRefs);
      console.log('[lightbox] Source videos loaded:', sourceVideos.length);
    }
  }, [video, open, sourceRefs, sourceVideos]);

  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    if (!open && videoRef.current) {
      videoRef.current.pause();
    }
  }, [open]);

  if (!video) return null;

  const handleReact = async (emoji: string) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Log in to react', variant: 'destructive' });
      return;
    }
    try {
      await react({ eventId: video.id, authorPubkey: video.pubkey, emoji });
      toast({ title: 'Reacted!', description: `${emoji}` });
    } catch (e) {
      toast({ title: 'Failed to react', description: String(e), variant: 'destructive' });
    }
  };

  const handleRepost = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Log in to repost', variant: 'destructive' });
      return;
    }
    try {
      await repost(video.event);
      toast({ title: 'Reposted!', description: 'Video reposted to your followers' });
    } catch (e) {
      toast({ title: 'Failed to repost', description: String(e), variant: 'destructive' });
    }
  };

  const handlePostComment = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Log in to comment', variant: 'destructive' });
      return;
    }
    if (!commentText.trim()) return;
    setIsCommenting(true);
    try {
      await postComment({ root: video.event, content: commentText.trim() });
      setCommentText('');
      toast({ title: 'Comment posted!', description: 'Your comment has been published' });
    } catch (e) {
      toast({ title: 'Failed to post comment', description: String(e), variant: 'destructive' });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleFollowClick = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Log in to follow users', variant: 'destructive' });
      return;
    }
    try {
      const result = await toggleFollow(video.pubkey);
      toast({
        title: result.isFollowing ? 'Following' : 'Unfollowed',
        description: result.isFollowing ? `You are now following ${displayName}` : `You unfollowed ${displayName}`,
      });
    } catch (e) {
      toast({ title: 'Failed to follow', description: String(e), variant: 'destructive' });
    }
  };

  const hasSources = sourceRefs.length > 0;
  const isFavorite = favoriteIdSet.has(video.id);
  const formatDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const clientTag = video.event.tags.find(([t]) => t === 'client')?.[1];

  const byId = new Map(sourceVideos.map((v) => [v.id, v]));
  const sourceItems = sourceRefs.map((ref) => byId.get(ref.eventId) ?? ref);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden rounded-xl border bg-background shadow-xl max-w-5xl p-2 [&>button]:right-3 [&>button]:top-3 [&>button]:text-foreground [&>button]:hover:bg-muted"
      >
        <DialogTitle className="sr-only">{video.name}</DialogTitle>

        <div className="flex flex-row h-[85vh]">
          {/* Main video — left side; rounded to match modal */}
          <div className="w-[45%] shrink-0 bg-muted rounded-l-xl overflow-hidden">
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

          {/* Right side: metadata, reactions, comments, sources */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Video metadata */}
              <div>
                <p className="font-semibold text-lg">{video.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Link
                    to={`/profile/${nip19.npubEncode(video.pubkey)}`}
                    className="text-sm text-foreground underline hover:text-primary"
                  >
                    {displayName}
                  </Link>
                  {user && (
                    <Button
                      onClick={handleFollowClick}
                      disabled={isTogglingFollow}
                      variant={isFollowing ? 'outline' : 'default'}
                      size="sm"
                      className="gap-1 h-6 text-xs px-2"
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="h-3 w-3" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3 w-3" />
                          Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(video.publishedAt)}
                </p>
                {clientTag && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {clientTag === 'brainrot.rehab' ? (
                      <Link to="/rot" className="hover:text-foreground hover:underline">
                        rotten on brainrot.rehab
                      </Link>
                    ) : (
                      clientTag
                    )}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-muted-foreground font-mono truncate max-w-[12rem]" title={video.id}>
                    {video.id.slice(0, 16)}…
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    title="Copy event ID"
                    onClick={async () => {
                      await navigator.clipboard.writeText(video.id);
                      toast({ title: 'Copied', description: 'Event ID copied to clipboard' });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Reactions & Actions */}
              <div className="flex items-center gap-1.5 border-y border-border py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReact('❤️')}
                  className="gap-1.5 h-8"
                >
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">{reactions?.byEmoji.get('❤️') || 0}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReact('🔥')}
                  className="gap-1.5 h-8"
                >
                  <span className="text-base leading-none">🔥</span>
                  <span className="text-xs">{reactions?.byEmoji.get('🔥') || 0}</span>
                </Button>
                <ZapDialog target={video.event as any}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-8"
                  >
                    <Zap className="h-4 w-4" />
                    <span className="text-xs">
                      {zapsLoading ? '...' : totalSats > 0 ? totalSats.toLocaleString() : 'Zap'}
                    </span>
                  </Button>
                </ZapDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRepost}
                  className="gap-1.5 h-8"
                >
                  <Repeat2 className="h-4 w-4" />
                  <span className="text-xs">Repost</span>
                </Button>
                <Button
                  variant={isFavorite ? 'default' : 'outline'}
                  size="sm"
                  disabled={isTogglingFavorite}
                  onClick={async () => {
                    if (!user) {
                      toast({ title: 'Login required', description: 'Log in to save favorites', variant: 'destructive' });
                      return;
                    }
                    try {
                      await toggleFavorite(video.id);
                      toast({
                        title: isFavorite ? 'Removed from favorites' : 'Added to favorites',
                        description: isFavorite ? 'Video removed from saved list' : 'Video saved',
                      });
                    } catch (e) {
                      toast({ title: 'Failed to update favorites', description: String(e), variant: 'destructive' });
                    }
                  }}
                  className="gap-1.5 h-8"
                  title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                >
                  <Bookmark className={`h-4 w-4 ${isFavorite ? 'fill-current text-primary' : ''}`} />
                  <span className="text-xs">{isFavorite ? 'Saved to Favorites' : 'Save to Favorites'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs">{commentsData?.topLevelComments.length || 0}</span>
                </Button>
              </div>

              {/* Comment input */}
              <div className="space-y-3 pt-1">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handlePostComment();
                    }
                  }}
                />
                <Button
                  onClick={handlePostComment}
                  disabled={!commentText.trim() || isCommenting}
                  size="sm"
                  className="w-full"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {isCommenting ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>

              {/* Source videos */}
              {hasSources && (
                <div className="border-t border-border pt-6 mt-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                    Source videos ({sourceRefs.length})
                  </h3>
                  <div className="space-y-3">
                    {sourcesLoading ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Loading…
                      </p>
                    ) : (
                      sourceItems.map((item) =>
                        'url' in item ? (
                          <SourceVideoCard key={item.id} source={item as Video} />
                        ) : (
                          <SourceRefFallbackCard
                            key={(item as SourceRef).eventId}
                            sourceRef={item as SourceRef}
                          />
                        )
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
