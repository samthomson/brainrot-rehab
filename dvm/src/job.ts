import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { NostrEvent } from 'nostr-tools'
import type { SimplePool } from 'nostr-tools'
import {
  buildJobFeedback,
  buildJobResult,
  buildTaskEvent,
  parseJobRequest,
  signEvent,
} from './nostr.js'
import { composeVideo, withTempDir } from './ffmpeg.js'
import { JOB_REQUEST_KIND, TASK_RESPONSE_KIND } from './types.js'

const VIDEO_KIND = 34236

function waitForTaskResponse(
  pool: SimplePool,
  relays: string[],
  requestId: string,
  customerPubkey: string,
  timeoutMs: number
): Promise<NostrEvent> {
  const since = Math.floor(Date.now() / 1000)
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      sub.close()
      reject(new Error('Task response timeout'))
    }, timeoutMs)
    const sub = pool.subscribe(
      relays,
      { kinds: [TASK_RESPONSE_KIND], authors: [customerPubkey], '#e': [requestId], since },
      {
        onevent(ev) {
          clearTimeout(t)
          sub.close()
          resolve(ev)
        },
      }
    )
  })
}

export async function runJob(
  pool: SimplePool,
  relays: string[],
  secretKey: Uint8Array,
  requestEvent: NostrEvent
): Promise<void> {
  const requestId = requestEvent.id
  const customerPubkey = requestEvent.pubkey
  let payload: ReturnType<typeof parseJobRequest>
  try {
    payload = parseJobRequest(requestEvent.content)
  } catch {
    const err = signEvent(
      buildJobFeedback(requestId, customerPubkey, 'error', 'Invalid job request JSON'),
      secretKey
    )
    await pool.publish(relays, err)
    return
  }

  await pool.publish(
    relays,
    signEvent(buildJobFeedback(requestId, customerPubkey, 'processing', ''), secretKey)
  )
  console.log(`⚙️  Job ${requestId}: Starting download + ffmpeg for ${payload.clips.length} segment(s)`)

  let videoBuffer: Buffer
  try {
    console.log(`📥 Downloading and processing ${payload.clips.length} video segment(s)...`)
    videoBuffer = await withTempDir(async (dir) => {
      const path = await composeVideo(payload.clips, dir)
      return readFile(path)
    })
    console.log(`✅ Video processed successfully (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
  } catch (e) {
    console.error(`❌ Job ${requestId} failed during video processing:`, e)
    const err = signEvent(
      buildJobFeedback(requestId, customerPubkey, 'error', String(e)),
      secretKey
    )
    await pool.publish(relays, err)
    return
  }

  const payloadHash = createHash('sha256').update(videoBuffer).digest('hex')
  const blossomBaseUrl = payload.blossom_upload_url.replace(/\/$/, '')
  const blossomUploadUrl = blossomBaseUrl.endsWith('/upload') ? blossomBaseUrl : `${blossomBaseUrl}/upload`

  const now = Math.floor(Date.now() / 1000)
  const expiration = now + 60
  const taskEvent = buildTaskEvent(requestId, customerPubkey, {
    type: 'sign_blossom',
    url: blossomUploadUrl,
    payload_hash: payloadHash,
    size: videoBuffer.length,
    expiration,
  })
  await pool.publish(relays, signEvent(taskEvent, secretKey))
  console.log(`⏳ Waiting for user to sign Blossom auth event (120s timeout)`)
  console.log(`   Upload URL: ${blossomUploadUrl}`)
  console.log(`   Payload hash: ${payloadHash}`)

  let nip98Response: NostrEvent
  try {
    nip98Response = await waitForTaskResponse(pool, relays, requestId, customerPubkey, 120_000)
  } catch (e) {
    console.error(`Job ${requestId}: NIP-98 sign timeout`)
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(requestId, customerPubkey, { type: 'error', message: 'NIP-98 sign timeout' }),
        secretKey
      )
    )
    return
  }

  // Client sends signed Blossom auth event (kind 24242) as JSON in task response content
  let blossomAuthEvent: NostrEvent
  try {
    blossomAuthEvent = JSON.parse(nip98Response.content) as NostrEvent
  } catch {
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(requestId, customerPubkey, { type: 'error', message: 'Invalid Blossom auth response' }),
        secretKey
      )
    )
    return
  }
  console.log(`📤 Uploading to Blossom: ${blossomUploadUrl}`)
  console.log(`   Blossom auth event:`, JSON.stringify(blossomAuthEvent, null, 2))
  console.log(`   Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  const blossomToken = Buffer.from(JSON.stringify(blossomAuthEvent)).toString('base64')
  
  const uploadRes = await fetch(blossomUploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Nostr ${blossomToken}`,
      'Content-Type': 'video/mp4',
      'X-SHA-256': payloadHash, // Required by BUD-11 for upload authorization
    },
    body: new Uint8Array(videoBuffer),
  })
  if (!uploadRes.ok) {
    const errorBody = await uploadRes.text().catch(() => '')
    console.error(`❌ Blossom upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
    console.error(`   Response: ${errorBody}`)
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(requestId, customerPubkey, {
          type: 'error',
          message: `Blossom upload failed: ${uploadRes.status}`,
        }),
        secretKey
      )
    )
    return
  }
  console.log(`✅ Blossom upload successful`)
  let videoUrl: string
  const contentType = uploadRes.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = (await uploadRes.json()) as { url?: string }
    videoUrl = data.url || blossomUploadUrl
  } else {
    videoUrl = uploadRes.headers.get('location') || (await uploadRes.text()) || blossomUploadUrl
  }
  console.log(`   Video URL: ${videoUrl}`)

  // Kind 34236 is parameterized replaceable - need unique d tag or each new video overwrites the previous
  const unsigned34236 = {
    kind: VIDEO_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', requestId],
      ['url', videoUrl],
      ['client', 'brainrot.rehab'],
    ],
    content: payload.caption ?? '',
  }
  await pool.publish(
    relays,
    signEvent(
      buildTaskEvent(requestId, customerPubkey, { type: 'sign_event', event: unsigned34236 }),
      secretKey
    )
  )
  console.log(`Job ${requestId}: waiting for event signature (120s)`)

  let signEventResponse: NostrEvent
  try {
    signEventResponse = await waitForTaskResponse(pool, relays, requestId, customerPubkey, 120_000)
  } catch (e) {
    console.error(`Job ${requestId}: event sign timeout`)
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(requestId, customerPubkey, { type: 'error', message: 'Sign event timeout' }),
        secretKey
      )
    )
    return
  }

  console.log(`Job ${requestId}: received response event:`, {
    id: signEventResponse.id,
    kind: signEventResponse.kind,
    content_preview: signEventResponse.content.slice(0, 200)
  })
  
  const signedContent = signEventResponse.content
  let signedEv: NostrEvent
  try {
    signedEv = JSON.parse(signedContent) as NostrEvent
  } catch (err) {
    console.error(`Job ${requestId}: failed to parse signed event:`, err)
    console.error(`   Content:`, signedContent)
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(requestId, customerPubkey, { type: 'error', message: 'Invalid signed event' }),
        secretKey
      )
    )
    return
  }

  console.log(`Job ${requestId}: parsed signed event:`, {
    id: signedEv.id,
    kind: signedEv.kind,
    pubkey: signedEv.pubkey,
    tags: signedEv.tags,
    content: signedEv.content
  })
  
  console.log(`Job ${requestId}: publishing signed video (kind ${VIDEO_KIND})`)
  console.log(`   Event ID: ${signedEv.id}`)
  console.log(`   Pubkey: ${signedEv.pubkey}`)
  console.log(`   Tags:`, signedEv.tags)
  
  const publishResults = await Promise.allSettled(pool.publish(relays, signedEv))
  const rejected = publishResults.filter(r => r.status === 'rejected')
  if (rejected.length > 0) {
    console.error(`⚠️ Some relays rejected video event:`, rejected.map(r => (r as PromiseRejectedResult).reason))
  }
  
  console.log(`Job ${requestId}: publishing success task`)
  const successEvent = signEvent(
    buildTaskEvent(requestId, customerPubkey, { type: 'success', result_event_id: signedEv.id }),
    secretKey
  )
  await pool.publish(relays, successEvent)

  // Build tags for all original events and authors
  const extraTags: string[][] = []
  for (const clip of payload.clips) {
    if (clip.event_id) {
      extraTags.push(['e', clip.event_id, '', 'mention'])
    }
    if (clip.author_pubkey) {
      extraTags.push(['p', clip.author_pubkey])
    }
  }
  
  await pool.publish(
    relays,
    signEvent(
      buildJobResult(requestId, customerPubkey, JSON.stringify({ event_id: signedEv.id, url: videoUrl }), extraTags),
      secretKey
    )
  )
  console.log(`Job ${requestId}: complete`, signedEv.id)
}
