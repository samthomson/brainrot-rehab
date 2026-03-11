import React, { useEffect, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { DEFAULT_DVM_RELAYS } from '@/lib/dvmRelays';

function getDvmRelays(): string[] {
  try {
    const raw = localStorage.getItem('dvm-enabled-relays');
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return DEFAULT_DVM_RELAYS;
}

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayMetadata = useRef(config.relayMetadata);

  // Invalidate Nostr queries when relay metadata changes
  useEffect(() => {
    relayMetadata.current = config.relayMetadata;
    queryClient.invalidateQueries({ queryKey: ['nostr'] });
  }, [config.relayMetadata, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters: NostrFilter[]) {
        const routes = new Map<string, NostrFilter[]>();

        const isVideoQuery = filters.some(
          f => f.kinds?.includes(22) || f.kinds?.includes(34236) || f.kinds?.includes(34326)
        );
        const isDvmJobQuery = filters.some(f => f.kinds?.includes(30534));

        if (isVideoQuery) {
          // Video browsing: query user's personal relays + divine
          const readRelays = relayMetadata.current.relays
            .filter(r => r.read)
            .map(r => r.url);
          for (const url of readRelays) {
            routes.set(url, filters);
          }
          routes.set('wss://relay.divine.video', filters);

          // Also include DVM relay for user's own videos (where DVM publishes)
          for (const relay of getDvmRelays()) {
            routes.set(relay, filters);
          }
        } else if (isDvmJobQuery) {
          // DVM job status: only query DVM relays
          for (const relay of getDvmRelays()) {
            routes.set(relay, filters);
          }
        } else {
          // Other queries: use user's personal relays
          const readRelays = relayMetadata.current.relays
            .filter(r => r.read)
            .map(r => r.url);
          for (const url of readRelays) {
            routes.set(url, filters);
          }
        }

        return routes;
      },
      eventRouter(_event: NostrEvent) {
        // Get write relays from metadata
        const writeRelays = relayMetadata.current.relays
          .filter(r => r.write)
          .map(r => r.url);

        const allRelays = new Set<string>(writeRelays);

        return [...allRelays];
      },
      eoseTimeout: 2000,
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;