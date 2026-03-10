import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Video } from '@/types/video';
import { BRAINROT_CLIENT_TAG, DEFAULT_BLOSSOM_UPLOAD_URL } from '@/lib/dvmRelays';

const QUERY_TIMEOUT_MS = 15_000;

function isBrainrotVideo(event: NostrEvent): boolean {
  const hasClientTag = event.tags.some(
    ([name, value]) => name === 'client' && value === BRAINROT_CLIENT_TAG
  );
  if (hasClientTag) return true;
  // Fallback: url from our Blossom server (videos published before client tag fix)
  const urlTag = event.tags.find(([n]) => n === 'url')?.[1];
  return urlTag != null && urlTag.startsWith(DEFAULT_BLOSSOM_UPLOAD_URL);
}

function parseBrainrotVideoEvent(event: NostrEvent): Video | null {
  try {
    if (event.kind !== 34236) return null;
    const urlTag = event.tags.find(([name]) => name === 'url')?.[1];
    if (!urlTag) return null;

    const caption = typeof event.content === 'string' ? event.content.trim() : '';
    const name = caption || `Video by ${event.pubkey.slice(0, 8)}...`;

    return {
      id: event.id,
      event,
      name,
      url: urlTag,
      duration: 0,
      thumbnailUrl: undefined,
      pubkey: event.pubkey,
      publishedAt: event.created_at,
    };
  } catch {
    return null;
  }
}

/** All brainrot.rehab videos (kind 34236 with client tag). */
export function useBrainrotVideos() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['brainrot-videos'],
    queryFn: async () => {
      // Don't use #client in relay filter - many relays don't support arbitrary tag filters.
      // Query kind 34236 only, then filter client-side.
      const events = await nostr.query(
        [{ kinds: [34236], limit: 100 }],
        { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) }
      );

      // DEBUG: trace relay results and filtering
      console.log('[brainrot-debug] Raw events from relays:', events.length);
      const clientTagValues = new Set<string>();
      for (const e of events) {
        const tag = e.tags.find(([n]) => n === 'client')?.[1];
        if (tag) clientTagValues.add(tag);
      }
      if (clientTagValues.size > 0) {
        console.log('[brainrot-debug] Client tags seen:', [...clientTagValues]);
      }
      if (events.length > 0) {
        const sample = events[0];
        console.log('[brainrot-debug] Sample event tags:', sample.tags);
      }

      const videos: Video[] = [];
      let filteredOut = 0;
      for (const event of events) {
        if (!isBrainrotVideo(event)) {
          filteredOut++;
          continue;
        }
        const video = parseBrainrotVideoEvent(event);
        if (video) videos.push(video);
      }
      console.log('[brainrot-debug] Filtered out:', filteredOut, '| Videos:', videos.length);

      videos.sort((a, b) => b.publishedAt - a.publishedAt);
      return videos;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Parse any event that has a url tag (kind 34236 or similar) into Video. */
function parseVideoEvent(event: NostrEvent): Video | null {
  try {
    let urlTag = event.tags.find(([name]) => name === 'url')?.[1];
    
    if (!urlTag) {
      const imetaTag = event.tags.find(([name]) => name === 'imeta');
      if (imetaTag) {
        const parts = imetaTag[1]?.split(/\s+/) || [];
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i].toLowerCase() === 'url') {
            urlTag = parts[i + 1];
            break;
          }
        }
      }
    }
    
    if (!urlTag) return null;
    const caption = typeof event.content === 'string' ? event.content.trim() : '';
    const name = caption || `Video by ${event.pubkey.slice(0, 8)}...`;
    return {
      id: event.id,
      event,
      name,
      url: urlTag,
      duration: 0,
      thumbnailUrl: undefined,
      pubkey: event.pubkey,
      publishedAt: event.created_at,
    };
  } catch {
    return null;
  }
}

/** Fetch video events by event id (for source refs in lightbox). Queries by ids only so we get 34236 or other video kinds. */
export function useVideoEventsById(ids: string[]) {
  const { nostr } = useNostr();
  const key = ids.slice().sort().join(',');

  return useQuery({
    queryKey: ['video-events-by-id', key],
    queryFn: async () => {
      if (ids.length === 0) return [];
      console.log('[source-videos] Querying for event ids:', ids);
      const events = await nostr.query(
        [{ ids, limit: ids.length }],
        { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) }
      );
      console.log('[source-videos] Found events:', events.length, events.map(e => e.id));
      console.log('[source-videos] Event kinds:', events.map(e => e.kind));
      console.log('[source-videos] Event tags sample:', events[0]?.tags);
      const videos: Video[] = [];
      for (const event of events) {
        const video = parseVideoEvent(event);
        if (video) {
          videos.push(video);
        } else {
          console.log('[source-videos] Failed to parse event:', event.id, 'kind:', event.kind, 'tags:', event.tags);
        }
      }
      console.log('[source-videos] Parsed videos:', videos.length);
      return videos;
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Current user's brainrot.rehab videos. */
export function useMyBrainrotVideos(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['my-brainrot-videos', pubkey],
    queryFn: async () => {
      if (!pubkey) return [];
      // Don't use #client in relay filter - filter client-side.
      const events = await nostr.query(
        [{ kinds: [34236], authors: [pubkey], limit: 100 }],
        { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) }
      );

      console.log('[brainrot-debug] Rotten: raw events for', pubkey?.slice(0, 8) + '...:', events.length);

      const videos: Video[] = [];
      for (const event of events) {
        if (!isBrainrotVideo(event)) continue;
        const video = parseBrainrotVideoEvent(event);
        if (video) videos.push(video);
      }
      console.log('[brainrot-debug] Rotten: videos:', videos.length);
      videos.sort((a, b) => b.publishedAt - a.publishedAt);
      return videos;
    },
    enabled: !!pubkey,
    staleTime: 2 * 60 * 1000,
  });
}
