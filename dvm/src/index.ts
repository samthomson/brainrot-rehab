import { useWebSocketImplementation } from 'nostr-tools/pool'
import WebSocket from 'ws'
import { SimplePool, utils } from 'nostr-tools'
import { getPublicKey } from 'nostr-tools/pure'
import type { NostrEvent } from 'nostr-tools/core'

useWebSocketImplementation(WebSocket as any)

// Prevent crash on relay "replaced: have newer event" (expected when publishing replaceable task events)
process.on('unhandledRejection', (reason, promise) => {
  if (String(reason).includes('replaced')) {
    console.warn('⚠️ Relay replaceable event warning (non-fatal):', reason)
    return
  }
  console.error('Unhandled rejection:', reason)
})
import { runJob } from './job.js'
import { JOB_REQUEST_KIND } from './types.js'

/** Single source of truth for default relay (do not duplicate elsewhere). */
const DEFAULT_RELAY = 'wss://relay.samt.st'
const RELAYS = (process.env.RELAYS || DEFAULT_RELAY).split(',').map((s) => s.trim())
const DVM_SECRET_KEY_HEX = process.env.DVM_SECRET_KEY
if (!DVM_SECRET_KEY_HEX) {
  console.error('Set DVM_SECRET_KEY (hex)')
  process.exit(1)
}
const secretKey = utils.hexToBytes(DVM_SECRET_KEY_HEX)
const publicKey = getPublicKey(secretKey)
console.log('🔑 DVM Public Key:', publicKey)

const pool = new SimplePool()

// Only process job requests created after DVM startup (avoid processing old requests)
const startupTime = Math.floor(Date.now() / 1000)

const sub = pool.subscribe(
  RELAYS,
  { kinds: [JOB_REQUEST_KIND], since: startupTime },
  {
    onevent(ev: NostrEvent) {
      console.log('📥 Received job request:', {
        id: ev.id,
        kind: ev.kind,
        pubkey: ev.pubkey.slice(0, 8),
        created_at: new Date(ev.created_at * 1000).toISOString(),
      })
      console.log('📄 Job content preview:', ev.content.slice(0, 200) + '...')
      runJob(pool, RELAYS, secretKey, ev).catch((e) => {
        console.error('❌ Job failed', ev.id, e)
      })
    },
    oneose() {
      console.log('✅ Subscription established (EOSE received)')
    },
  }
)

console.log('DVM listening for kind', JOB_REQUEST_KIND, 'on', RELAYS)

// Keep process alive with an interval (prevents Node from exiting when relay is unreachable)
setInterval(() => {}, 30_000)
