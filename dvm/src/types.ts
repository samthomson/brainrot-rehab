/**
 * DVM kinds (from transcript: NIP-90 + custom task handshake)
 * - 5342: job request (video composition)
 * - 6342: job result
 * - 7000: job feedback
 * - 30534: replaceable "current task" (d = request_id)
 * - 30535: task response (user → DVM, signed payloads)
 */
export const JOB_REQUEST_KIND = 5342
export const JOB_RESULT_KIND = 6342
export const JOB_FEEDBACK_KIND = 7000
export const TASK_KIND = 30534
export const TASK_RESPONSE_KIND = 30535

/** Segment in job request (kind 5342). Supports both new (videoUrl) and old (originalEvent) formats. */
export interface Segment {
  startTime: number
  endTime: number
  videoUrl?: string // New simplified format
  eventId?: string // Original event ID (for tagging)
  authorPubkey?: string // Original author pubkey (for tagging)
  originalEvent?: { // Old format (backward compatibility)
    id?: string
    kind: number
    pubkey?: string
    tags: string[][]
    [k: string]: unknown
  }
}

/** Job request content (kind 5342) */
export interface JobRequestPayload {
  segments: Segment[]
  blossom_upload_url: string
}

/** Replaceable task event content: what the user must do next */
export type TaskPayload =
  | { type: 'sign_nip98'; method: string; url: string; payload_hash: string }
  | { type: 'sign_blossom'; url: string; payload_hash: string; size: number; expiration: number }
  | { type: 'sign_event'; event: Record<string, unknown> }
  | { type: 'success'; result_event_id?: string }
  | { type: 'error'; message: string }
