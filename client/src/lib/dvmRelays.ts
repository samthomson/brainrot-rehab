const _env = import.meta.env;

/** Relays used for discovery: profiles (kind 0), video listing (add-video modal). Also the options for "where to publish your video" in Settings. */
export const DISCOVERY_RELAYS = [
  'wss://relay.divine.video',
  'wss://relay.damus.io',
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
];

/** DVM relay(s). From RELAYS env (injected as VITE_RELAYS by vite.config). Required. */
function parseRelays(): string[] {
  const raw = (_env.VITE_RELAYS as string | undefined)?.trim();
  if (!raw) throw new Error('RELAYS env is required (set in .env; client reads it as VITE_RELAYS)');
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) throw new Error('RELAYS env must contain at least one relay URL');
  return list;
}

export const DVM_RELAYS = parseRelays();

/** @deprecated Use DVM_RELAYS. Kept for compatibility. */
export const DEFAULT_DVM_RELAYS = DVM_RELAYS;

/** Relay options for "where to publish your video" in Settings. DVM relay + discovery relays. */
export const WRITE_RELAYS_OPTIONS = [...new Set([...DVM_RELAYS, ...DISCOVERY_RELAYS])];

/** Blossom upload URL. From VITE_BLOSSOM_UPLOAD_URL. Required. */
function parseBlossomUrl(): string {
  const raw = (_env.VITE_BLOSSOM_UPLOAD_URL as string | undefined)?.trim();
  if (!raw) throw new Error('VITE_BLOSSOM_UPLOAD_URL env is required');
  return raw;
}

export const DEFAULT_BLOSSOM_UPLOAD_URL = parseBlossomUrl();

/** DVM public key (64 hex). From VITE_DVM_PUBKEY. Required. */
function parseDvmPubkey(): string {
  const raw = (_env.VITE_DVM_PUBKEY as string | undefined)?.trim();
  if (!raw) throw new Error('VITE_DVM_PUBKEY env is required');
  return raw;
}

export const DEFAULT_DVM_PUBKEY = parseDvmPubkey();

export const BRAINROT_CLIENT_TAG = 'brainrot.rehab';

console.log('[brainrot-config]', { DVM_RELAYS, DEFAULT_DVM_PUBKEY, DEFAULT_BLOSSOM_UPLOAD_URL });
