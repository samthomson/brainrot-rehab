import React, { useEffect, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { DVM_RELAYS, DISCOVERY_RELAYS } from '@/lib/dvmRelays';

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
          // Video discovery (add-video modal, etc.): discovery relays + DVM write relay(s)
          for (const url of DISCOVERY_RELAYS) {
            routes.set(url, filters);
          }
          for (const relay of DVM_RELAYS) {
            routes.set(relay, filters);
          }
        } else if (isDvmJobQuery) {
          for (const relay of DVM_RELAYS) {
            routes.set(relay, filters);
          }
        } else {
          // Profiles, contact list, etc.: discovery relays + user's personal relays
          for (const url of DISCOVERY_RELAYS) {
            routes.set(url, filters);
          }
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