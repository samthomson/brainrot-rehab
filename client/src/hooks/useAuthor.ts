import { useMemo } from 'react';
import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

/** Fetch kind 0 metadata for many pubkeys in one query. Returns pubkey -> metadata object. */
export function useBulkAuthorMetadata(pubkeys: string[]) {
  const { nostr } = useNostr();
  const stableKey = useMemo(() => [...pubkeys].sort().join(','), [pubkeys]);

  return useQuery({
    queryKey: ['bulk-author-metadata', stableKey],
    queryFn: async ({ signal }) => {
      if (pubkeys.length === 0) return {} as Record<string, NostrMetadata>;
      const events = await nostr.query(
        [{ kinds: [0], authors: pubkeys }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) }
      );
      const map: Record<string, NostrMetadata> = {};
      for (const event of events) {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          if (metadata) map[event.pubkey] = metadata;
        } catch {
          // skip invalid metadata
        }
      }
      return map;
    },
    enabled: pubkeys.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      const [event] = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) },
      );

      if (!event) {
        throw new Error('No event found');
      }

      try {
        const metadata = n.json().pipe(n.metadata()).parse(event.content);
        return { metadata, event };
      } catch {
        return { event };
      }
    },
    staleTime: 5 * 60 * 1000, // Keep cached data fresh for 5 minutes
    retry: 3,
  });
}
