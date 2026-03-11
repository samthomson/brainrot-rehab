# brainrot

Video remixing platform: Nostr client + DVM for composing video segments.

- **client/** - React/Vite frontend for creating video remixes
- **dvm/** - Nostr DVM backend that processes video jobs with ffmpeg

## Quick Start

```bash
# Copy env template and set your DVM private key
cp .env.example .env
# Edit .env: set DVM_SECRET_KEY (hex, 64 chars) and optionally RELAYS

# Run both services
docker compose up --build
```

**Services:**
- **Client:** http://localhost:3001 (React app with hot reload)
- **DVM:** Connects to relay(s) and subscribes to kind 5342 job requests

Both services auto-reload on file changes via volume mounts.

### Production deployment

For video building to work in production you need **both**:

1. **DVM backend** – Run the DVM service (e.g. in Docker or your host) and point it at your relay with `RELAYS=wss://relay.brainrot.rehab` (or your relay). The DVM must be able to reach the relay and have `DVM_SECRET_KEY` set.
2. **Client build** – When building the client, set the DVM’s **public key** so the app can subscribe to job status:  
   `VITE_DVM_PUBKEY=<hex-pubkey> npm run build` (or in your CI env).  
   The DVM logs its public key on startup: `🔑 DVM Public Key: <hex>`.

If the DVM is not running or the client was built without `VITE_DVM_PUBKEY`, jobs will stay at “Waiting for DVM…” and never complete.

---

## Architecture

Client and DVM live in this repo so you can develop them together.

- **Client (React):** User composes a remix by selecting Nostr short-form videos, setting in/out points per segment, and ordering segments. When they hit “Remix”, the client publishes a **job request** (kind 5342) to the relay. The client also **subscribes to task events** (kind 30534) from the DVM and, when the DVM asks for a signature, signs in the browser (NIP-98 for upload, or the final video event) and sends the signed payload back (kind 30535).

- **DVM (Node + ffmpeg):** Subscribes to kind 5342 job requests. For each job it: downloads the segment URLs, trims and concatenates with ffmpeg, then asks the **user** (via 30534) to sign a NIP-98 auth event so it can upload the result to Blossom. After upload it asks the **user** to sign the final **video event** (kind 34236). The DVM then publishes that signed event and the job result (kind 6342). The DVM never signs as the user—all user-facing events are signed in the client.

**Signing back-and-forth:** User signs job request (5342) → DVM processes → DVM publishes task “sign NIP-98” (30534) → client signs NIP-98, publishes response (30535) → DVM uploads to Blossom → DVM publishes task “sign event” (30534) with unsigned 34236 → client signs video event, publishes response (30535) → DVM publishes signed 34236 and success/result.

---

## Client Integration

### Job Request Format (kind 5342)

**Simplified payload** (~600 bytes vs ~50KB with full events):

```json
{
  "segments": [
    {
      "videoUrl": "https://example.com/video.mp4",
      "startTime": 0,
      "endTime": 5,
      "eventId": "abc123...",
      "authorPubkey": "def456..."
    }
  ],
  "blossom_upload_url": "https://your-blossom-server.com"
}
```

**Tags:**
```typescript
[
  ["output", "video/mp4"],
  ["relays", "wss://relay.damus.io"],
  ["param", "segments", "1"],
  ["param", "duration", "5"],
  ["t", "brainrot"],
  ["client", "brainrot.rehab"]
]
```

### Complete Flow

**1. User creates job request (kind 5342)**

```typescript
const jobRequest = {
  kind: 5342,
  content: JSON.stringify({
    segments: [...],
    blossom_upload_url: "https://your-blossom-server.com"
  }),
  tags: [...],
  created_at: Math.floor(Date.now() / 1000)
}
const signed = await window.nostr.signEvent(jobRequest)
await publishToRelay(signed)
```

**2. Subscribe to task events (kind 30534)**

```typescript
pool.subscribe(
  [relay],
  {
    kinds: [30534],
    authors: [DVM_PUBKEY],
    "#d": [jobRequestId]
  },
  {
    onevent: async (taskEvent) => {
      const task = JSON.parse(taskEvent.content)
      
      if (task.type === 'sign_nip98') {
        // Sign NIP-98 auth for Blossom upload
        const nip98 = await window.nostr.signEvent({
          kind: 27235,
          content: '',
          tags: [
            ["u", task.url],
            ["method", task.method],
            ["payload", task.payload_hash]
          ],
          created_at: Math.floor(Date.now() / 1000)
        })
        
        // Send back via kind 30535
        await publishTaskResponse(jobRequestId, nip98)
        
      } else if (task.type === 'sign_event') {
        // Sign final video event
        const signed = await window.nostr.signEvent(task.event)
        await publishTaskResponse(jobRequestId, signed)
        
      } else if (task.type === 'success') {
        console.log('Job complete!', task.result_event_id)
      } else if (task.type === 'error') {
        console.error('Job failed:', task.message)
      }
    }
  }
)

async function publishTaskResponse(jobRequestId, signedEvent) {
  const response = {
    kind: 30535,
    content: JSON.stringify(signedEvent),
    tags: [
      ["e", jobRequestId],
      ["p", DVM_PUBKEY]
    ],
    created_at: Math.floor(Date.now() / 1000)
  }
  await publishToRelay(await window.nostr.signEvent(response))
}
```

**3. Track job state**

Kind 30534 is **replaceable** (by `d` tag = job request ID), so query for current state:

```typescript
const currentTask = await pool.get(
  [relay],
  { kinds: [30534], authors: [DVM_PUBKEY], "#d": [jobRequestId] }
)
const state = JSON.parse(currentTask.content)
// state.type: 'sign_nip98' | 'sign_event' | 'success' | 'error'
```

**Show user's job history:**

```typescript
// Fetch all job requests user created
const myJobs = await pool.querySync(
  [relay],
  { kinds: [5342], authors: [userPubkey] }
)

// For each, get current state and result
for (const job of myJobs) {
  const task = await pool.get([relay], { kinds: [30534], authors: [DVM_PUBKEY], "#d": [job.id] })
  const result = await pool.get([relay], { kinds: [6342], "#e": [job.id] })
  
  // Show status: pending | awaiting_signature | complete | error
}
```

---

## Event Formats

### Kind 5342 – Job request (client → DVM)

**Content:**
```json
{
  "segments": [
    {
      "videoUrl": "https://...",
      "startTime": 0,
      "endTime": 5,
      "eventId": "abc...",
      "authorPubkey": "def..."
    }
  ],
  "blossom_upload_url": "https://..."
}
```

**Backward compatible:** Also accepts old format with `originalEvent` containing full Nostr event with `imeta` tags.

### Kind 7000 – Job feedback (DVM → client)

**Tags:** `e` = request id, `p` = customer pubkey, `status` = `processing` | `error`

**Content:** optional message

### Kind 30534 – Replaceable task (DVM → client)

**Tags:** `d` = request id, `p` = customer pubkey

**Content:** JSON:
- `{"type":"sign_nip98","method":"POST","url":"...","payload_hash":"..."}`
- `{"type":"sign_event","event":{...}}`
- `{"type":"success","result_event_id":"..."}`
- `{"type":"error","message":"..."}`

### Kind 30535 – Task response (client → DVM)

**Tags:** `e` = request id, `p` = DVM pubkey

**Content:** JSON string of signed event (NIP-98 auth or video event)

### Kind 6342 – Job result (DVM → client)

**Tags:** `e`, `p`, `request` = request id, plus `e`/`p` tags for all original video events/authors

**Content:** `{"event_id":"...","url":"..."}`

---

## Configuration

### .env

- **DVM_SECRET_KEY**: hex private key (64 chars). The DVM's pubkey is derived from this.
- **RELAYS**: optional; comma-separated relay URLs. Defaults to `wss://relay.brainrot.rehab` (must match where the client publishes jobs).

### Why does the DVM have its own private key?

The DVM is a Nostr actor. It publishes events (feedback, tasks, results) that must be signed. The DVM never signs as the user; the user signs NIP-98 and the final video event in the client.

---

## Production (Dokploy)

Compose: `docker-compose.prod.yml`.

| Env var | Where | How to get it |
|---------|--------|----------------|
| `DVM_SECRET_KEY` | DVM service (runtime) | `openssl rand -hex 32` |
| `VITE_DVM_PUBKEY` | Client (build arg) | After DVM starts, copy from log line `DVM Public Key: <64 hex>` |
| `RELAYS` | DVM service (optional) | Default `wss://relay.brainrot.rehab` |

---

## Development

- **Auto-reload:** `tsx watch` in docker-compose detects file changes
- **Logs:** All output is in container stdout (`docker compose logs -f`)
- **Temp files:** Videos are processed in temp dirs and cleaned up; final output is only on Blossom


## todo

- [ ] progress sections for publishing
	- [ ] icons are dumb too
	- [ ] and it jumps back to [20?]% before finishing
- [ ] some kind of drafts/published ui
- [ ] zap splits?
- [ ] support deleting own content

- [ ] highlight brainrot in ui for adding videos
- [ ] neon green favicon
