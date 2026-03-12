import { useEffect, useState, useCallback, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { BRAINROT_CLIENT_TAG } from '@/lib/dvmRelays';
import { buildRemixSegmentTags, REMIX_SEGMENT_TAG, type RemixSegmentMeta } from '@/lib/remixSegments';
import type { NostrEvent } from '@nostrify/nostrify';

interface DVMTask {
  type: 'sign_blossom' | 'sign_event' | 'success' | 'error';
  url?: string;
  payload_hash?: string;
  size?: number;
  expiration?: number;
  event?: Partial<NostrEvent>;
  result_event_id?: string;
  message?: string;
}

interface DVMJobState {
  status: 'idle' | 'broadcasting' | 'pending' | 'awaiting_blossom' | 'uploading' | 'awaiting_signature' | 'complete' | 'error';
  currentTask?: DVMTask;
  resultEventId?: string;
  errorMessage?: string;
}

async function publishToPool(
  nostr: { relay: (url: string) => { event: (ev: NostrEvent) => Promise<unknown> } },
  relays: string[],
  event: NostrEvent,
  timeoutMs = 10_000
): Promise<void> {
  if (relays.length === 0) throw new Error('No relays in pool');
  const results = await Promise.allSettled(
    relays.map((url) =>
      Promise.race([
        nostr.relay(url).event(event),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Relay timeout')), timeoutMs)
        ),
      ])
    )
  );
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  if (fulfilled.length === 0) {
    const reason = (results[0] as PromiseRejectedResult)?.reason;
    throw reason ?? new Error('All relays failed');
  }
}

export function useDVMJob(dvmPubkey: string, relays: string[]) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [jobState, setJobState] = useState<DVMJobState>({ status: 'idle' });
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  // Track which task event IDs we've already handled
  const processedEventIds = useRef<Set<string>>(new Set());
  const isProcessing = useRef<boolean>(false);
  const eventQueue = useRef<NostrEvent[]>([]);
  // Store caption from broadcast - client is source of truth (DVM may not pass it through)
  const lastBroadcastRef = useRef<{ caption?: string; segments?: RemixSegmentMeta[] }>({});

  // Subscribe to task events
  useEffect(() => {
    if (!currentJobId || relays.length === 0 || !dvmPubkey) return;

    const jobId = currentJobId;
    // Subscribe to events from 2 seconds ago to ensure we don't miss any due to clock skew
    const subscriptionTime = Math.floor(Date.now() / 1000) - 2;
    const filter = {
      kinds: [30534],
      '#e': [jobId],
      authors: [dvmPubkey],
      since: subscriptionTime,
    };
    const controller = new AbortController();
    const signal = controller.signal;

    const processEvent = async (taskEvent: NostrEvent) => {
      if (signal.aborted) return;
      if (processedEventIds.current.has(taskEvent.id)) return;
      processedEventIds.current.add(taskEvent.id);

      try {
        const task: DVMTask = JSON.parse(taskEvent.content);
        
        // Terminal states - end immediately
        if (task.type === 'success') {
          controller.abort();
          setJobState({
            status: 'complete',
            currentTask: task,
            resultEventId: task.result_event_id,
          });
          toast({ title: 'Video Complete! 🎉', description: 'Your remix has been published to Nostr' });
          return;
        }
        
        if (task.type === 'error') {
          controller.abort();
          setJobState({
            status: 'error',
            currentTask: task,
            errorMessage: task.message,
          });
          toast({ title: 'Job Failed', description: task.message, variant: 'destructive' });
          return;
        }
        
        if (task.type === 'sign_blossom') {
          if (!user || !task.url || !task.payload_hash || task.size == null || task.expiration == null) {
            console.error('[DVM] sign_blossom: missing required fields', { hasUser: !!user, url: task.url, hash: task.payload_hash, size: task.size, exp: task.expiration });
            return;
          }
          
          setJobState({ status: 'awaiting_blossom', currentTask: task });
          
          const blossomEvent = await user.signer.signEvent({
            kind: 24242,
            content: 'Upload remix.mp4',
            tags: [
              ['t', 'upload'],
              ['x', task.payload_hash],
              ['size', String(task.size)],
              ['expiration', String(task.expiration)],
            ],
            created_at: Math.floor(Date.now() / 1000),
          });

          const responseEvent = await user.signer.signEvent({
            kind: 30535,
            content: JSON.stringify(blossomEvent),
            tags: [
              ['e', jobId],
              ['p', taskEvent.pubkey],
            ],
            created_at: Math.floor(Date.now() / 1000),
          });

          console.log('[DVM] Publishing blossom auth response (kind 30535) to', relays);
          await publishToPool(nostr, relays, responseEvent);
          console.log('[DVM] Blossom auth response published successfully');
          setJobState({ status: 'uploading', currentTask: task });
          toast({ title: 'Upload Authorized', description: 'DVM is now uploading your video...' });
          
        } else if (task.type === 'sign_event') {
          if (!user || !task.event) {
            console.error('[DVM] sign_event: missing required fields', { hasUser: !!user, hasEvent: !!task.event });
            return;
          }
          
          setJobState({ status: 'awaiting_signature', currentTask: task });
          
          let tags = (task.event.tags ?? []) as string[][];
          // CRITICAL: Kind 34236 is parameterized replaceable - without unique d tag, each video overwrites the last
          if (task.event.kind === 34236) {
            tags = tags.filter(([n]) => n !== 'd');
            tags = [['d', jobId], ...tags];
            if (!tags.some(([n]) => n === 'client')) {
              tags = [...tags, ['client', BRAINROT_CLIENT_TAG]];
            }
            // Persist remix structure so seeded rehab can reconstruct timeline later.
            const segmentTags = buildRemixSegmentTags(lastBroadcastRef.current.segments ?? []);
            tags = tags.filter(([n]) => n !== REMIX_SEGMENT_TAG);
            if (segmentTags.length > 0) {
              tags = [...tags, ...segmentTags];
            }
          }
          // Caption: use our stored value from broadcast (source of truth), fallback to DVM
          const storedCaption = lastBroadcastRef.current?.caption;
          const dvmContent = typeof task.event.content === 'string' ? task.event.content : '';
          const content = (storedCaption?.trim() || dvmContent) || '';
          const template = {
            kind: task.event.kind!,
            content,
            tags,
            created_at: task.event.created_at ?? Math.floor(Date.now() / 1000),
          };
          const signedVideoEvent = await user.signer.signEvent(template);

          await publishToPool(nostr, relays, signedVideoEvent);

          const responseEvent = await user.signer.signEvent({
            kind: 30535,
            content: JSON.stringify(signedVideoEvent),
            tags: [
              ['e', jobId],
              ['p', taskEvent.pubkey],
            ],
            created_at: Math.floor(Date.now() / 1000),
          });

          console.log('[DVM] Publishing sign_event response (kind 30535) to', relays);
          await publishToPool(nostr, relays, responseEvent);
          console.log('[DVM] Sign event response published successfully');
          setJobState({ status: 'pending', currentTask: task });
          toast({ title: 'Video Published!', description: 'Your remix is now on Nostr' });
        }
        
      } catch (error) {
        console.error('Error handling task:', error);
        toast({ title: 'Task Failed', description: String(error), variant: 'destructive' });
      }
    };
    
    const handleEvent = (taskEvent: NostrEvent) => {
      if (signal.aborted) return;
      if (taskEvent.pubkey === user?.pubkey) return;
      if (processedEventIds.current.has(taskEvent.id)) return;

      eventQueue.current.push(taskEvent);
      
      // If not currently processing, start processing the queue
      if (!isProcessing.current) {
        (async () => {
          while (eventQueue.current.length > 0 && !signal.aborted) {
            isProcessing.current = true;
            const event = eventQueue.current.shift()!;
            await processEvent(event);
            isProcessing.current = false;
          }
        })();
      }
    };

    console.log('[DVM] Subscribing to task events', { jobId, dvmPubkey, relays, filter });

    relays.forEach((url) => {
      const relay = nostr.relay(url);
      const sub = relay.req([filter], { signal });
      (async () => {
        try {
          for await (const msg of sub) {
            if (msg[0] === 'EOSE') {
              console.log('[DVM] EOSE received from', url);
            }
            if (msg[0] === 'EVENT') {
              console.log('[DVM] Received event from', url, { kind: msg[2].kind, id: msg[2].id, type: JSON.parse(msg[2].content).type });
              handleEvent(msg[2]);
            }
          }
        } catch (err) {
          if (!signal.aborted) {
            console.error('[DVM] Subscription error on', url, err);
          }
        }
      })();
    });

    return () => controller.abort();
  }, [currentJobId, dvmPubkey, relays.join(','), nostr, user?.pubkey, toast]);

  const broadcastJob = useCallback(
    async (remixData: unknown): Promise<void> => {
      if (!user) {
        toast({
          title: 'Login Required',
          description: 'Please login with Nostr to broadcast job requests',
          variant: 'destructive',
        });
        return;
      }
      if (!dvmPubkey) {
        setJobState({ status: 'error', errorMessage: 'DVM pubkey not set. Set it in Settings.' });
        toast({
          title: 'DVM pubkey required',
          description: 'Set the DVM pubkey in Settings to publish.',
          variant: 'destructive',
        });
        return;
      }

      // Reset state for new job
      processedEventIds.current = new Set();
      isProcessing.current = false;
      eventQueue.current = [];
      
      setJobState({ status: 'broadcasting' });

      try {
        const totalDuration = (remixData as { segments: { startTime: number; endTime: number }[] }).segments.reduce(
          (sum: number, seg: { startTime: number; endTime: number }) => sum + (seg.endTime - seg.startTime),
          0
        );

        const segments = (remixData as { segments: unknown[] }).segments;
        const tags: string[][] = [
          ['output', 'video/mp4'],
          ...relays.map((url) => ['relays', url] as [string, string]),
          ['param', 'segments', String(segments.length)],
          ['param', 'duration', totalDuration.toFixed(2)],
          ['t', 'brainrot'],
          ['client', 'brainrot.rehab'],
          ['alt', `Video remix job: combine ${segments.length} segments into one video (${totalDuration.toFixed(2)}s total)`],
        ];

        const unsignedEvent = {
          kind: 5342,
          content: JSON.stringify(remixData),
          tags,
          created_at: Math.floor(Date.now() / 1000),
        };

        const signedEvent = await user.signer.signEvent(unsignedEvent);
        
        // Store caption for when we receive sign_event task (client is source of truth)
        const caption = (remixData as { caption?: string }).caption;
        const structuredSegments = (remixData as { segments?: Array<{
          eventId?: string;
          startTime: number;
          endTime: number;
          authorPubkey?: string;
        }> }).segments ?? [];
        lastBroadcastRef.current = {
          caption,
          segments: structuredSegments
            .map((segment, index) => ({
              order: index,
              eventId: segment.eventId ?? '',
              startTime: segment.startTime,
              endTime: segment.endTime,
              authorPubkey: segment.authorPubkey,
            }))
            .filter((segment) => Boolean(segment.eventId)),
        };
        
        // Set job ID BEFORE publishing
        setCurrentJobId(signedEvent.id);
        setJobState({ status: 'pending' });
        
        // Small delay to ensure subscription is established
        await new Promise(resolve => setTimeout(resolve, 100));

        await publishToPool(nostr, relays, signedEvent);

        toast({
          title: 'Job Broadcasted! 📡',
          description: 'DVM is starting to process your remix...',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setJobState({ status: 'error', errorMessage });
        toast({
          title: 'Broadcast Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
    [user, dvmPubkey, nostr, relays, toast]
  );

  return {
    jobState,
    broadcastJob,
    resetJob: () => {
      setCurrentJobId(null);
      setJobState({ status: 'idle' });
      processedEventIds.current = new Set();
      isProcessing.current = false;
      eventQueue.current = [];
      lastBroadcastRef.current = {};
    },
  };
}
