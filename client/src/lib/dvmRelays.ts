/** Single source of truth: DVM relay for brainrot.rehab. */
export const BRAINROT_RELAY_URL = 'wss://relay.brainrot.rehab';

/** Default DVM relay list (user can toggle any on/off in Settings). */
export const DEFAULT_DVM_RELAYS = [BRAINROT_RELAY_URL];

/** Default Blossom server URL for DVM video uploads. */
export const DEFAULT_BLOSSOM_UPLOAD_URL = 'https://blossom.brainrot.rehab';

/** DVM public key (64 hex). Set via VITE_DVM_PUBKEY at build time; user can override in Settings. */
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

/** All preset relay options for DVM (brainrot first, then optional). Used for Settings UI. */
export const ALL_DVM_RELAY_PRESETS = [BRAINROT_RELAY_URL, ...OPTIONAL_RELAY_PRESETS];
