import { useNostr } from '@nostrify/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Video } from '@/types/video';

const PAGE_LIMIT = 100;

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

  return useInfiniteQuery({
    queryKey: ['short-form-videos', searchTerm, authors ?? null],
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      const filter: {
        kinds: number[];
        limit: number;
        until?: number;
        search?: string;
        authors?: string[];
      } = {
        kinds: [22, 34236, 34326],
        limit: PAGE_LIMIT,
      };

      if (pageParam != null) {
        filter.until = pageParam;
      }
      if (authors?.length) {
        filter.authors = authors;
      }
      if (searchTerm?.trim()) {
        filter.search = searchTerm.trim();
      }

      const events = await nostr.query([filter], {
        signal: AbortSignal.timeout(15_000),
      });

      const videos: Video[] = [];
      for (const event of events) {
        const video = parseVideoEvent(event);
        if (video) videos.push(video);
      }
      videos.sort((a, b) => b.publishedAt - a.publishedAt);
      return videos;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_LIMIT) return undefined;
      const oldest = Math.min(...lastPage.map((v) => v.publishedAt));
      return oldest - 1;
    },
    staleTime: 5 * 60 * 1000,
  });
}
