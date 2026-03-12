import { nip19 } from 'nostr-tools';
import { DVM_RELAYS } from '@/lib/dvmRelays';
import type { Video } from '@/types/video';

export function decodeVideoRef(videoRef?: string): string {
  const ref = videoRef?.trim();
  if (!ref) return '';
  if (/^[a-f0-9]{64}$/i.test(ref)) return ref;
  if (!ref.startsWith('nevent1') && !ref.startsWith('note1')) return '';
  try {
    const decoded = nip19.decode(ref);
    if (decoded.type === 'nevent') return decoded.data.id;
    if (decoded.type === 'note') return decoded.data;
  } catch {
    return '';
  }
  return '';
}

export function encodeVideoRef(video: Video): string {
  return nip19.neventEncode({
    id: video.id,
    relays: DVM_RELAYS,
    author: video.pubkey,
  });
}
