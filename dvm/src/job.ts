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
import { createLogger } from './log.js'

const log = createLogger('job')
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
  const jobId = requestEvent.id
  const pubkey = requestEvent.pubkey
  let payload: ReturnType<typeof parseJobRequest>
  try {
    payload = parseJobRequest(requestEvent.content)
  } catch (e) {
    log.error('Invalid job request JSON', { jobId, pubkey, error: String(e) })
    const err = signEvent(
      buildJobFeedback(jobId, requestEvent.pubkey, 'error', 'Invalid job request JSON'),
      secretKey
    )
    await pool.publish(relays, err)
    return
  }

  log.info('Job started', {
    jobId,
    pubkey,
    segments: payload.clips.length,
    blossom_upload_url: payload.blossom_upload_url,
    caption: payload.caption?.slice(0, 80),
  })

  await pool.publish(
    relays,
    signEvent(buildJobFeedback(jobId, requestEvent.pubkey, 'processing', ''), secretKey)
  )

  // --- Step 1: Download + ffmpeg ---
  let videoBuffer: Buffer
  try {
    log.info('Downloading and composing video', { jobId, segments: payload.clips.length })
    const t0 = Date.now()
    videoBuffer = await withTempDir(async (dir) => {
      const path = await composeVideo(payload.clips, dir)
      return readFile(path)
    })
    const elapsedMs = Date.now() - t0
    log.info('Video composed', { jobId, sizeMB: (videoBuffer.length / 1024 / 1024).toFixed(2), elapsedMs })
  } catch (e) {
    log.error('Video processing failed', { jobId, error: String(e) })
    const err = signEvent(
      buildJobFeedback(jobId, requestEvent.pubkey, 'error', String(e)),
      secretKey
    )
    await pool.publish(relays, err)
    return
  }

  // --- Step 2: Request Blossom auth from user ---
  const payloadHash = createHash('sha256').update(videoBuffer).digest('hex')
  const blossomBaseUrl = payload.blossom_upload_url.replace(/\/$/, '')
  const blossomUploadUrl = blossomBaseUrl.endsWith('/upload') ? blossomBaseUrl : `${blossomBaseUrl}/upload`

  const now = Math.floor(Date.now() / 1000)
  const expiration = now + 60
  const taskEvent = buildTaskEvent(jobId, requestEvent.pubkey, {
    type: 'sign_blossom',
    url: blossomUploadUrl,
    payload_hash: payloadHash,
    size: videoBuffer.length,
    expiration,
  })
  await pool.publish(relays, signEvent(taskEvent, secretKey))
  log.info('Waiting for Blossom auth signature', { jobId, uploadUrl: blossomUploadUrl, payloadHash, sizeMB: (videoBuffer.length / 1024 / 1024).toFixed(2) })

  let nip98Response: NostrEvent
  try {
    nip98Response = await waitForTaskResponse(pool, relays, jobId, requestEvent.pubkey, 120_000)
    log.info('Received Blossom auth response', { jobId })
  } catch (e) {
    log.error('Blossom auth timeout — user did not sign in time', { jobId })
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(jobId, requestEvent.pubkey, { type: 'error', message: 'NIP-98 sign timeout' }),
        secretKey
      )
    )
    return
  }

  let blossomAuthEvent: NostrEvent
  try {
    blossomAuthEvent = JSON.parse(nip98Response.content) as NostrEvent
  } catch {
    log.error('Invalid Blossom auth response (bad JSON)', { jobId })
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(jobId, requestEvent.pubkey, { type: 'error', message: 'Invalid Blossom auth response' }),
        secretKey
      )
    )
    return
  }

  // --- Step 3: Upload to Blossom ---
  log.info('Uploading to Blossom', { jobId, uploadUrl: blossomUploadUrl, sizeMB: (videoBuffer.length / 1024 / 1024).toFixed(2) })

  const blossomToken = Buffer.from(JSON.stringify(blossomAuthEvent)).toString('base64')
  
  let uploadRes: Response
  try {
    uploadRes = await fetch(blossomUploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Nostr ${blossomToken}`,
        'Content-Type': 'video/mp4',
        'X-SHA-256': payloadHash,
      },
      body: new Uint8Array(videoBuffer),
    })
  } catch (e) {
    log.error('Blossom upload network error', { jobId, error: String(e), uploadUrl: blossomUploadUrl })
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(jobId, requestEvent.pubkey, {
          type: 'error',
          message: `Blossom upload network error: ${String(e)}`,
        }),
        secretKey
      )
    )
    return
  }

  if (!uploadRes.ok) {
    const errorBody = await uploadRes.text().catch(() => '')
    log.error('Blossom upload failed', {
      jobId,
      status: uploadRes.status,
      statusText: uploadRes.statusText,
      responseBody: errorBody.slice(0, 500),
      uploadUrl: blossomUploadUrl,
    })
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(jobId, requestEvent.pubkey, {
          type: 'error',
          message: `Blossom upload failed: ${uploadRes.status}`,
        }),
        secretKey
      )
    )
    return
  }

  let videoUrl: string
  const contentType = uploadRes.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = (await uploadRes.json()) as { url?: string }
    videoUrl = data.url || blossomUploadUrl
  } else {
    videoUrl = uploadRes.headers.get('location') || (await uploadRes.text()) || blossomUploadUrl
  }
  
  if (videoUrl.startsWith('http://') && blossomUploadUrl.startsWith('https://')) {
    videoUrl = videoUrl.replace('http://', 'https://')
  }
  log.info('Blossom upload successful', { jobId, videoUrl })

  // --- Step 4: Request video event signature from user ---
  const sourceTags: string[][] = []
  const seenEventIds = new Set<string>()
  const seenPubkeys = new Set<string>()
  for (const clip of payload.clips) {
    if (clip.event_id && !seenEventIds.has(clip.event_id)) {
      seenEventIds.add(clip.event_id)
      sourceTags.push(['e', clip.event_id, '', 'mention'])
    }
    if (clip.author_pubkey && !seenPubkeys.has(clip.author_pubkey)) {
      seenPubkeys.add(clip.author_pubkey)
      sourceTags.push(['p', clip.author_pubkey])
    }
  }

  const unsigned34236 = {
    kind: VIDEO_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', jobId],
      ['url', videoUrl],
      ['client', 'brainrot.rehab'],
      ...sourceTags,
    ],
    content: payload.caption ?? '',
  }
  await pool.publish(
    relays,
    signEvent(
      buildTaskEvent(jobId, requestEvent.pubkey, { type: 'sign_event', event: unsigned34236 }),
      secretKey
    )
  )
  log.info('Waiting for video event signature', { jobId })

  let signEventResponse: NostrEvent
  try {
    signEventResponse = await waitForTaskResponse(pool, relays, jobId, requestEvent.pubkey, 120_000)
    log.info('Received video event signature', { jobId })
  } catch (e) {
    log.error('Video event sign timeout', { jobId })
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(jobId, requestEvent.pubkey, { type: 'error', message: 'Sign event timeout' }),
        secretKey
      )
    )
    return
  }

  const signedContent = signEventResponse.content
  let signedEv: NostrEvent
  try {
    signedEv = JSON.parse(signedContent) as NostrEvent
  } catch (err) {
    log.error('Failed to parse signed video event', { jobId, error: String(err), contentPreview: signedContent.slice(0, 200) })
    await pool.publish(
      relays,
      signEvent(
        buildTaskEvent(jobId, requestEvent.pubkey, { type: 'error', message: 'Invalid signed event' }),
        secretKey
      )
    )
    return
  }

  // --- Step 5: Publish video event + success ---
  const publishResults = await Promise.allSettled(pool.publish(relays, signedEv))
  const rejected = publishResults.filter(r => r.status === 'rejected')
  if (rejected.length > 0) {
    log.warn('Some relays rejected video event', { jobId, rejected: rejected.map(r => String((r as PromiseRejectedResult).reason)) })
  }

  const successEvent = signEvent(
    buildTaskEvent(jobId, requestEvent.pubkey, { type: 'success', result_event_id: signedEv.id }),
    secretKey
  )
  await pool.publish(relays, successEvent)

  const extraTags: string[][] = []
  for (const clip of payload.clips) {
    if (clip.event_id) extraTags.push(['e', clip.event_id, '', 'mention'])
    if (clip.author_pubkey) extraTags.push(['p', clip.author_pubkey])
  }
  
  await pool.publish(
    relays,
    signEvent(
      buildJobResult(jobId, requestEvent.pubkey, JSON.stringify({ event_id: signedEv.id, url: videoUrl }), extraTags),
      secretKey
    )
  )
  log.info('Job complete', { jobId, resultEventId: signedEv.id, videoUrl })
}
