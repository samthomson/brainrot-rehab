import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

export function useRepost() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: NostrEvent) => {
      const repostEvent = await publishEvent({
        kind: 6,
        content: JSON.stringify(event),
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
        ],
      });
      return repostEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brainrot-videos'] });
    },
  });
}
