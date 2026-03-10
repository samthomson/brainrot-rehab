/** Single source of truth: DVM relay for brainrot.rehab (always in pool). */
export const BRAINROT_RELAY_URL = 'wss://relay.brainrot.rehab';

/** Default Blossom server URL for DVM video uploads. */
export const DEFAULT_BLOSSOM_UPLOAD_URL = 'https://blossom.brainrot.rehab';

/** DVM public key (64 hex). Must be set via VITE_DVM_PUBKEY at build time or by the user in Settings. No fallback. */
export const DEFAULT_DVM_PUBKEY = (import.meta.env.VITE_DVM_PUBKEY as string | undefined)?.trim() ?? '';

/** Client tag for brainrot.rehab videos (filter feeds by this). */
export const BRAINROT_CLIENT_TAG = 'brainrot.rehab';

/** Optional relays users can add to the DVM pool (presets in selector). */
export const OPTIONAL_RELAY_PRESETS = [
  'wss://relay.damus.io',
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
] as const;
