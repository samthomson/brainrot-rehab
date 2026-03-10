import { useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { useMyBrainrotVideos } from '@/hooks/useBrainrotVideos';
import { VideoCard } from '@/components/VideoCard';
import { VideoLightbox } from '@/components/VideoLightbox';
import { useState } from 'react';
import type { Video } from '@/types/video';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsFollowing, useToggleFollow } from '@/hooks/useFollow';
import { useToast } from '@/hooks/useToast';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { npub } = useParams<{ npub: string }>();
  const [lightboxVideo, setLightboxVideo] = useState<Video | null>(null);
  const { user } = useCurrentUser();
  const { toast } = useToast();

  let pubkey: string | undefined;
  try {
    if (npub?.startsWith('npub1')) {
      const decoded = nip19.decode(npub);
      if (decoded.type === 'npub') {
        pubkey = decoded.data;
      }
    } else if (npub?.startsWith('nprofile1')) {
      const decoded = nip19.decode(npub);
      if (decoded.type === 'nprofile') {
        pubkey = decoded.data.pubkey;
      }
    }
  } catch (err) {
    console.error('Failed to decode npub:', err);
  }

  const { data: author, isLoading: authorLoading } = useAuthor(pubkey || '');
  const { data: videos = [], isLoading: videosLoading } = useMyBrainrotVideos(pubkey);
  const isFollowing = useIsFollowing(pubkey || '');
  const { mutateAsync: toggleFollow, isPending: isTogglingFollow } = useToggleFollow();

  if (!pubkey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Invalid profile identifier</p>
      </div>
    );
  }

  const displayName = author?.metadata?.display_name || author?.metadata?.name || `${pubkey.slice(0, 8)}...`;
  const about = author?.metadata?.about || '';
  const picture = author?.metadata?.picture || '';
  const banner = author?.metadata?.banner || '';
  const isOwnProfile = user?.pubkey === pubkey;

  const handleFollowClick = async () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'You must be logged in to follow users.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await toggleFollow(pubkey);
      toast({
        title: result.isFollowing ? 'Following' : 'Unfollowed',
        description: result.isFollowing ? `You are now following ${displayName}` : `You unfollowed ${displayName}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      {banner && (
        <div className="w-full h-96 bg-muted overflow-hidden">
          <img src={banner} alt="Profile banner" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Profile header */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-start gap-4 mb-6">
          {picture ? (
            <img
              src={picture}
              alt={displayName}
              className="w-24 h-24 rounded-full border-4 border-background shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-muted border-4 border-background shadow-lg" />
          )}
          <div className="flex-1 pt-2">
            {authorLoading ? (
              <>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-96" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">{displayName}</h1>
                  {user && (
                    <Button
                      onClick={handleFollowClick}
                      disabled={isTogglingFollow}
                      variant={isFollowing ? 'outline' : 'default'}
                      size="sm"
                      className="gap-1.5"
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus className="h-4 w-4" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {about && <p className="text-muted-foreground mt-2">{about}</p>}
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  {nip19.npubEncode(pubkey)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Videos grid */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Videos</h2>
          {videosLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No videos yet.{' '}
              {isOwnProfile && (
                <Link to="/rehab" className="text-primary hover:underline">
                  Make your first one →
                </Link>
              )}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={() => setLightboxVideo(video)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <VideoLightbox
        video={lightboxVideo}
        open={!!lightboxVideo}
        onOpenChange={(open) => {
          if (!open) setLightboxVideo(null);
        }}
      />
    </div>
  );
}
