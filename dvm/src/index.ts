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

/** Must match client's BRAINROT_RELAY_URL - client publishes jobs here. */
const DEFAULT_RELAY = 'wss://relay.brainrot.rehab'
const RELAYS = (process.env.RELAYS || DEFAULT_RELAY).split(',').map((s) => s.trim())
const DVM_SECRET_KEY_HEX = process.env.DVM_SECRET_KEY
if (!DVM_SECRET_KEY_HEX) {
  console.error('Set DVM_SECRET_KEY (hex)')
  process.exit(1)
}
const secretKey = utils.hexToBytes(DVM_SECRET_KEY_HEX)
const publicKey = getPublicKey(secretKey)
console.log('🔑 DVM Public Key:', publicKey)
console.log('   → Set VITE_DVM_PUBKEY=' + publicKey + ' when building the client, or paste in Settings → DVM Pubkey')

const pool = new SimplePool()

// Only process job requests created after DVM startup (avoid processing old requests)
const startupTime = Math.floor(Date.now() / 1000)
const filter = { kinds: [JOB_REQUEST_KIND], since: startupTime }

console.log('DVM listening for kind', JOB_REQUEST_KIND, 'on', RELAYS)
console.log('📋 Subscription filter:', JSON.stringify(filter))

const sub = pool.subscribe(RELAYS, filter, {
  onevent(ev: NostrEvent) {
    console.log('📥 Received job request:', {
      id: ev.id,
      kind: ev.kind,
      pubkey: ev.pubkey.slice(0, 8),
      created_at: new Date(ev.created_at * 1000).toISOString(),
    })
    console.log('📄 Job content preview:', ev.content.slice(0, 200) + (ev.content.length > 200 ? '...' : ''))
    runJob(pool, RELAYS, secretKey, ev).catch((e) => {
      console.error('❌ Job failed', ev.id, e)
    })
  },
  oneose() {
    console.log('✅ Subscription established (EOSE received)')
  },
})

// Heartbeat so logs show the process is alive and still subscribed
setInterval(() => {
  console.log('💓 DVM alive, waiting for kind', JOB_REQUEST_KIND)
}, 60_000)
