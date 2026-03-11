import { useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { BRAINROT_RELAY_URL } from '@/lib/dvmRelays';

/**
 * NostrSync - Syncs user's Nostr data
 *
 * This component runs globally to sync various Nostr data when the user logs in.
 * Currently syncs:
 * - NIP-65 relay list (kind 10002)
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  useEffect(() => {
    if (!user) return;

    const syncRelaysFromNostr = async () => {
      try {
        const events = await nostr.query(
          [{ kinds: [10002], authors: [user.pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        );

        if (events.length > 0) {
          const event = events[0];

          // Only update if the event is newer than our stored data
          if (event.created_at > config.relayMetadata.updatedAt) {
            const fetchedRelays = event.tags
              .filter(([name]) => name === 'r')
              .map(([_, url, marker]) => ({
                url,
                read: !marker || marker === 'read',
                write: !marker || marker === 'write',
              }));

            // Always include essential video relays
            const essentialRelays = [
              {
                url: BRAINROT_RELAY_URL,
                read: true,
                write: true,
              },
              {
                url: 'wss://relay.divine.video',
                read: true,
                write: true,
              },
            ];

            // Merge essential relays with user's relay list
            const mergedRelays = [...essentialRelays];
            for (const relay of fetchedRelays) {
              if (!mergedRelays.some((r) => r.url === relay.url)) {
                mergedRelays.push(relay);
              }
            }

            if (mergedRelays.length > 0) {
              console.log('Syncing relay list from Nostr:', mergedRelays);
              updateConfig((current) => ({
                ...current,
                relayMetadata: {
                  relays: mergedRelays,
                  updatedAt: event.created_at,
                },
              }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync relays from Nostr:', error);
      }
    };

    syncRelaysFromNostr();
  }, [user, config.relayMetadata.updatedAt, nostr, updateConfig]);

  return null;
}