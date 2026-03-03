import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Video } from '@/types/video';

function parseVideoEvent(event: NostrEvent): Video | null {
  try {
    const titleTag = event.tags.find(([name]) => name === 'title')?.[1];
    const imetaTags = event.tags.filter(([name]) => name === 'imeta');
    
    // Get video URL from first imeta tag
    let videoUrl = '';
    let thumbnailUrl = '';
    let duration = 0;
    
    if (imetaTags.length > 0) {
      const imetaTag = imetaTags[0];
      const urlEntry = imetaTag.find((entry) => entry.startsWith('url '));
      const imageEntry = imetaTag.find((entry) => entry.startsWith('image '));
      const durationEntry = imetaTag.find((entry) => entry.startsWith('duration '));
      
      if (urlEntry) {
        videoUrl = urlEntry.replace('url ', '');
      }
      if (imageEntry) {
        thumbnailUrl = imageEntry.replace('image ', '');
      }
      if (durationEntry) {
        duration = parseFloat(durationEntry.replace('duration ', '')) || 0;
      }
    }
    
    if (!videoUrl) return null;
    
    return {
      id: event.id,
      event,
      name: titleTag || `Video by ${event.pubkey.slice(0, 8)}...`,
      url: videoUrl,
      duration,
      thumbnailUrl,
      pubkey: event.pubkey,
      publishedAt: event.created_at,
    };
  } catch (error) {
    console.error('Error parsing video event:', error);
    return null;
  }
}

export function useShortFormVideos(searchTerm?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['short-form-videos', searchTerm],
    queryFn: async () => {
      // Query for short-form video events (kind 22 and 34236)
      const filters: Array<{
        kinds: number[];
        limit: number;
        search?: string;
      }> = [
        {
          kinds: [22, 34236],
          limit: 200, // Reduced from 500 for better performance
        },
      ];

      // Add search term if provided
      if (searchTerm && searchTerm.trim()) {
        filters[0].search = searchTerm.trim();
      }

      const events = await nostr.query(filters);

      const videos: Video[] = [];
      
      for (const event of events) {
        const video = parseVideoEvent(event);
        if (video) {
          videos.push(video);
        }
      }

      // Sort by most recent first
      videos.sort((a, b) => b.publishedAt - a.publishedAt);

      return videos;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
