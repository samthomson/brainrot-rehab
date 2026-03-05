import { finalizeEvent, type EventTemplate, type UnsignedEvent } from 'nostr-tools/pure'
import type { NostrEvent } from 'nostr-tools'
import type { TaskPayload } from './types.js'
import {
  JOB_FEEDBACK_KIND,
  JOB_REQUEST_KIND,
  JOB_RESULT_KIND,
  TASK_KIND,
  TASK_RESPONSE_KIND,
} from './types.js'

export function signEvent(template: EventTemplate, secretKey: Uint8Array): NostrEvent {
  return finalizeEvent(template, secretKey)
}

export function buildJobFeedback(
  requestId: string,
  customerPubkey: string,
  status: string,
  content = ''
): EventTemplate {
  return {
    kind: JOB_FEEDBACK_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', requestId],
      ['p', customerPubkey],
      ['status', status],
    ],
    content,
  }
}

export function buildTaskEvent(
  requestId: string,
  customerPubkey: string,
  task: TaskPayload
): EventTemplate {
  return {
    kind: TASK_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', `${requestId}:${task.type}`],
      ['e', requestId],
      ['p', customerPubkey],
    ],
    content: JSON.stringify(task),
  }
}

export function buildJobResult(
  requestId: string,
  customerPubkey: string,
  content: string,
  extraTags: string[][] = []
): EventTemplate {
  return {
    kind: JOB_RESULT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', requestId],
      ['p', customerPubkey],
      ['request', requestId],
      ...extraTags,
    ],
    content,
  }
}

export type ResolvedClip = { 
  source: string
  start_s: number
  end_s: number
  event_id?: string
  author_pubkey?: string
}

/** Parse job request content (kind 5342). Supports both old (with originalEvent) and new (with videoUrl) formats. */
export function parseJobRequest(content: string): { clips: ResolvedClip[]; blossom_upload_url: string; caption?: string } {
  const raw = JSON.parse(content) as import('./types.js').JobRequestPayload
  if (!raw.segments?.length) throw new Error('Job request must have "segments"')
  if (!raw.blossom_upload_url) throw new Error('Job request must have "blossom_upload_url"')

  const clips: ResolvedClip[] = []
  for (const seg of raw.segments) {
    // New format: videoUrl directly in segment
    if (seg.videoUrl) {
      clips.push({ 
        source: seg.videoUrl, 
        start_s: seg.startTime, 
        end_s: seg.endTime,
        event_id: seg.eventId,
        author_pubkey: seg.authorPubkey
      })
      continue
    }
    
    // Old format: extract from originalEvent.tags (backward compatibility)
    if (seg.originalEvent?.tags) {
      const url = extractVideoUrlFromTags(seg.originalEvent.tags)
      if (url) {
        clips.push({ 
          source: url, 
          start_s: seg.startTime, 
          end_s: seg.endTime,
          event_id: seg.originalEvent.id,
          author_pubkey: seg.originalEvent.pubkey
        })
        continue
      }
    }
    
    throw new Error(`Segment missing video URL`)
  }
  return { clips, blossom_upload_url: raw.blossom_upload_url, caption: raw.caption }
}

/** Extract video URL from kind 22/34236 event tags (imeta tag: "url https://...") */
function extractVideoUrlFromTags(tags: string[][]): string | null {
  for (const tag of tags) {
    if (tag[0] !== 'imeta' || !tag[1]) continue
    const parts = tag[1].split(/\s+/)
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].toLowerCase() === 'url') return parts[i + 1] ?? null
    }
  }
  return null
}
