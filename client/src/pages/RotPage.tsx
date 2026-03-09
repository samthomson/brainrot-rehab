import { useSeoMeta } from '@unhead/react';
import { VideoCard } from '@/components/VideoCard';
import { useBrainrotVideos } from '@/hooks/useBrainrotVideos';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

export default function RotPage() {
  useSeoMeta({
    title: 'Rot - brainrot.rehab',
    description: 'All brainrot.rehab short-form videos',
  });

  const { data: videos = [], isLoading, isError } = useBrainrotVideos();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
            <details className="mt-8 p-4 bg-muted rounded-lg">
              <summary className="cursor-pointer font-semibold">Debug: Raw Events</summary>
              <pre className="mt-4 text-xs overflow-auto max-h-96">
                {JSON.stringify(videos.map(v => v.event), null, 2)}
              </pre>
            </details>
          </>
        )}
    </div>
  );
}
