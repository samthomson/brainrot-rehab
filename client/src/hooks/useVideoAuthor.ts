import { useAuthor } from '@/hooks/useAuthor';
import type { Video } from '@/types/video';

export function useVideoAuthor(video?: Video) {
  const author = useAuthor(video?.pubkey);
  const metadata = author.data?.metadata;

  return {
    displayName: video
      ? (metadata?.name || metadata?.display_name || `${video.pubkey.slice(0, 8)}...`)
      : '',
    isLoading: author.isLoading,
  };
}
