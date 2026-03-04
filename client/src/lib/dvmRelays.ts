/** Single source of truth: DVM relay for brainrot.rehab (always in pool). */
export const BRAINROT_RELAY_URL = 'wss://relay.brainrot.rehab';

/** Optional relays users can add to the DVM pool (presets in selector). */
export const OPTIONAL_RELAY_PRESETS = [
  'wss://relay.damus.io',
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
] as const;
