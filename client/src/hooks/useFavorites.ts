import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useVideoEventsById } from '@/hooks/useBrainrotVideos';
import { FAVORITES_SET_D, FAVORITES_SET_KIND, FAVORITES_SET_TITLE } from '@/lib/favorites';

const FAVORITES_QUERY_KEY = 'favorite-video-ids';
const EMPTY_IDS: string[] = [];

type FavoriteListData = {
  ids: string[];
  listEventId?: string;
};

function parseFavoriteIds(tags: string[][]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const [name, value] of tags) {
    if (name !== 'e' || !value || seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }
  return ids;
}

export function useFavoriteVideos() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery({
    queryKey: [FAVORITES_QUERY_KEY, user?.pubkey],
    enabled: !!user?.pubkey,
    queryFn: async (): Promise<FavoriteListData> => {
      if (!user?.pubkey) return { ids: [] };

      // Query by kind+author, then resolve the favorites list by d-tag client-side for better relay compatibility.
      const events = await nostr.query(
        [{ kinds: [FAVORITES_SET_KIND], authors: [user.pubkey], limit: 200 }],
        { signal: AbortSignal.timeout(15_000) }
      );

      const favoritesEvents = events.filter((event) =>
        event.tags.some(([name, value]) => name === 'd' && value === FAVORITES_SET_D)
      );
      if (favoritesEvents.length === 0) return { ids: [] };

      const latest = favoritesEvents.sort((a, b) => b.created_at - a.created_at)[0];
      return { ids: parseFavoriteIds(latest.tags), listEventId: latest.id };
    },
    staleTime: 30_000,
  });

  const favoriteIds = favoritesQuery.data?.ids ?? EMPTY_IDS;
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const { data: favoriteVideos = [], isLoading: isLoadingFavoriteVideos } = useVideoEventsById(favoriteIds);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user?.pubkey) throw new Error('Login required');

      const current = (queryClient.getQueryData([FAVORITES_QUERY_KEY, user.pubkey]) as FavoriteListData | undefined)?.ids ?? [];
      const alreadyFavorite = current.includes(eventId);
      const next = alreadyFavorite ? current.filter((id) => id !== eventId) : [...current, eventId];

      const tags: string[][] = [
        ['d', FAVORITES_SET_D],
        ['title', FAVORITES_SET_TITLE],
        ...next.map((id) => ['e', id]),
      ];

      const event = await user.signer.signEvent({
        kind: FAVORITES_SET_KIND,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });
      await nostr.event(event, { signal: AbortSignal.timeout(5_000) });
    },
    onSuccess: () => {
      if (!user?.pubkey) return;
      queryClient.invalidateQueries({ queryKey: [FAVORITES_QUERY_KEY, user.pubkey] });
    },
  });

  return {
    favoriteIds,
    favoriteIdSet,
    favoriteVideos,
    isLoadingFavoriteIds: favoritesQuery.isLoading,
    isLoadingFavoriteVideos,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
    toggleFavorite: toggleFavoriteMutation.mutateAsync,
  };
}
