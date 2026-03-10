import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

export function useReactions(eventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: async () => {
      const events = await nostr.query(
        [{ kinds: [7], '#e': [eventId], limit: 500 }],
        { signal: AbortSignal.timeout(10_000) }
      );
      const byEmoji = new Map<string, number>();
      for (const event of events) {
        const emoji = event.content || '+';
        byEmoji.set(emoji, (byEmoji.get(emoji) || 0) + 1);
      }
      return { events, byEmoji };
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

export function useReact() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, authorPubkey, emoji }: { eventId: string; authorPubkey: string; emoji: string }) => {
      const event = await publishEvent({
        kind: 7,
        content: emoji,
        tags: [
          ['e', eventId],
          ['p', authorPubkey],
        ],
      });
      return event;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['reactions', eventId] });
    },
  });
}
