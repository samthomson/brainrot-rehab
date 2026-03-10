import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

export function useContactList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['contact-list', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) return null;
      
      const events = await nostr.query(
        [{ kinds: [3], authors: [user.pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(10_000) }
      );
      
      return events[0] || null;
    },
    enabled: !!user?.pubkey,
    staleTime: 60_000,
  });
}

export function useIsFollowing(targetPubkey: string) {
  const { data: contactList } = useContactList();
  
  if (!contactList || !targetPubkey) return false;
  
  return contactList.tags.some(([tag, pubkey]) => tag === 'p' && pubkey === targetPubkey);
}

export function useToggleFollow() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { data: contactList } = useContactList();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (targetPubkey: string) => {
      if (!user?.pubkey) throw new Error('Not logged in');
      
      const currentTags = contactList?.tags || [];
      const isCurrentlyFollowing = currentTags.some(
        ([tag, pubkey]) => tag === 'p' && pubkey === targetPubkey
      );

      let newTags: string[][];
      if (isCurrentlyFollowing) {
        newTags = currentTags.filter(
          ([tag, pubkey]) => !(tag === 'p' && pubkey === targetPubkey)
        );
      } else {
        newTags = [...currentTags, ['p', targetPubkey]];
      }

      const event = await publishEvent({
        kind: 3,
        content: contactList?.content || '',
        tags: newTags,
      });

      return { event, isFollowing: !isCurrentlyFollowing };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-list'] });
    },
  });
}
