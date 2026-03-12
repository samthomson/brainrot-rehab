import { useWebSocketImplementation } from 'nostr-tools/pool'
import WebSocket from 'ws'
import { SimplePool, utils } from 'nostr-tools'
import { getPublicKey } from 'nostr-tools/pure'
import type { NostrEvent } from 'nostr-tools/core'
import { createLogger } from './log.js'

useWebSocketImplementation(WebSocket as any)

const log = createLogger('main')

process.on('unhandledRejection', (reason) => {
  if (String(reason).includes('replaced')) {
    log.warn('Relay replaceable event warning (non-fatal)', { reason: String(reason) })
    return
  }
  log.error('Unhandled rejection', { reason: String(reason) })
})

import { runJob } from './job.js'
import { JOB_REQUEST_KIND } from './types.js'

/** Relay(s) to subscribe to for job requests. Must include whatever relay(s) the client publishes to (user picks in Settings → DVM Relay Pool). */
const DEFAULT_RELAY = 'wss://relay.brainrot.rehab'
const RELAYS = (process.env.RELAYS || DEFAULT_RELAY).split(',').map((s) => s.trim())
const DVM_SECRET_KEY_HEX = process.env.DVM_SECRET_KEY
if (!DVM_SECRET_KEY_HEX) {
  log.error('DVM_SECRET_KEY not set — exiting')
  process.exit(1)
}
const secretKey = utils.hexToBytes(DVM_SECRET_KEY_HEX)
const publicKey = getPublicKey(secretKey)
log.info('DVM started', { publicKey, relays: RELAYS })
log.info(`Set VITE_DVM_PUBKEY=${publicKey} when building the client`)

const pool = new SimplePool()

const startupTime = Math.floor(Date.now() / 1000)
const filter = { kinds: [JOB_REQUEST_KIND], since: startupTime }

log.info('Subscribing to job requests', {
  kind: JOB_REQUEST_KIND,
  relays: RELAYS,
  filter,
  startupTime,
})

const sub = pool.subscribe(RELAYS, filter, {
  onevent(ev: NostrEvent) {
    log.info('Received job request', {
      jobId: ev.id,
      kind: ev.kind,
      customer: ev.pubkey.slice(0, 12),
      created: new Date(ev.created_at * 1000).toISOString(),
      contentPreview: ev.content.slice(0, 200),
    })
    runJob(pool, RELAYS, secretKey, ev).catch((e) => {
      log.error('Job failed (uncaught)', { jobId: ev.id, error: String(e) })
    })
  },
  oneose() {
    log.info('Subscription established (EOSE)')
  },
})

setInterval(() => {
  log.info('Heartbeat — waiting for jobs', { kind: JOB_REQUEST_KIND })
}, 60_000)
