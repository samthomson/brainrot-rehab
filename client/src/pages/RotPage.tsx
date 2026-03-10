import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { VideoCard } from '@/components/VideoCard';
import { VideoLightbox } from '@/components/VideoLightbox';
import { useBrainrotVideos } from '@/hooks/useBrainrotVideos';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import type { Video } from '@/types/video';

export default function RotPage() {
  useSeoMeta({
    title: 'Rot - brainrot.rehab',
    description: 'All brainrot.rehab short-form videos',
  });

  const { data: videos = [], isLoading, isError } = useBrainrotVideos();
  const [lightboxVideo, setLightboxVideo] = useState<Video | null>(null);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Rot</h1>
            <p className="text-muted-foreground">All brainrot.rehab videos</p>
          </div>
        </div>

        {isError ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Could not load videos. Check your relay connection.</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">No brainrot videos yet.</p>
            <Link to="/rehab" className="text-primary hover:underline mt-2 inline-block">
              Make the first one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => setLightboxVideo(video)}
              />
            ))}
          </div>
        )}

        <VideoLightbox
          video={lightboxVideo}
          open={!!lightboxVideo}
          onOpenChange={(open) => { if (!open) setLightboxVideo(null); }}
        />
    </div>
  );
}
