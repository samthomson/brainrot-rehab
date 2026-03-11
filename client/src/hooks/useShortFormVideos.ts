import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Video } from '@/types/video';

function parseVideoEvent(event: NostrEvent): Video | null {
  try {
    const titleTag = event.tags.find(([name]) => name === 'title')?.[1];
    let videoUrl = '';
    let thumbnailUrl = '';
    let duration = 0;

    const imetaTags = event.tags.filter(([name]) => name === 'imeta');
    if (imetaTags.length > 0) {
      const imetaTag = imetaTags[0];
      const urlEntry = imetaTag.find((entry) => entry.startsWith('url '));
      const imageEntry = imetaTag.find((entry) => entry.startsWith('image '));
      const durationEntry = imetaTag.find((entry) => entry.startsWith('duration '));
      if (urlEntry) videoUrl = urlEntry.replace('url ', '');
      if (imageEntry) thumbnailUrl = imageEntry.replace('image ', '');
      if (durationEntry) duration = parseFloat(durationEntry.replace('duration ', '')) || 0;
    }
    if (!videoUrl) {
      const urlTag = event.tags.find(([name]) => name === 'url')?.[1];
      const thumbTag = event.tags.find(([name]) => name === 'thumb')?.[1];
      if (urlTag) {
        videoUrl = urlTag;
        if (thumbTag) thumbnailUrl = thumbTag;
      }
    }
    if (!videoUrl) return null;

    return {
      id: event.id,
      event,
      name: titleTag || event.content || `Video by ${event.pubkey.slice(0, 8)}...`,
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

export function useShortFormVideos(
  searchTerm?: string,
  authorPubkey?: string | null,
  authorPubkeys?: string[] | null
) {
  const { nostr } = useNostr();

  const authors = authorPubkey
    ? [authorPubkey]
    : authorPubkeys?.length
      ? authorPubkeys
      : undefined;

  return useQuery({
    queryKey: ['short-form-videos', searchTerm, authors ?? null],
    queryFn: async () => {
      const filters: Array<{
        kinds: number[];
        limit: number;
        search?: string;
        authors?: string[];
      }> = [
        {
          kinds: [22, 34236, 34326],
          limit: 500,
        },
      ];

      if (authors?.length) {
        filters[0].authors = authors;
      }
      if (searchTerm && searchTerm.trim()) {
        filters[0].search = searchTerm.trim();
      }

      const events = await nostr.query(filters, {
        signal: AbortSignal.timeout(15_000),
      });

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
