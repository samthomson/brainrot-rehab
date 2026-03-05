/** Single source of truth: DVM relay for brainrot.rehab (always in pool). */
export const BRAINROT_RELAY_URL = 'wss://relay.brainrot.rehab';

/** Default Blossom server URL for DVM video uploads. */
export const DEFAULT_BLOSSOM_UPLOAD_URL = 'https://bs.samt.st';

/** Default DVM public key for brainrot.rehab DVM. */
export const DEFAULT_DVM_PUBKEY = '809afaba5cf5ce7e0be8bce15eea3faaa4dc8fbc74736c4f1dafd5e3e37a7855';

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
