import { useEffect, useState, useCallback, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
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

  // Subscribe to task events
  useEffect(() => {
    if (!currentJobId || relays.length === 0) return;

    const jobId = currentJobId;
    // Subscribe to events from 2 seconds ago to ensure we don't miss any due to clock skew
    const subscriptionTime = Math.floor(Date.now() / 1000) - 2;
    const filter = { 
      kinds: [30534], 
      '#e': [jobId], 
      authors: [dvmPubkey],
      since: subscriptionTime 
    };
    const controller = new AbortController();
    const signal = controller.signal;

    const processEvent = async (taskEvent: NostrEvent) => {
      if (signal.aborted) return;
      if (processedEventIds.current.has(taskEvent.id)) return;
      processedEventIds.current.add(taskEvent.id);

      try {
        const task: DVMTask = JSON.parse(taskEvent.content);
        console.log(`[DVM] Handling task: ${task.type}`);
        
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
          if (!user || !task.url || !task.payload_hash || task.size == null || task.expiration == null) return;
          
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

          await publishToPool(nostr, relays, responseEvent);
          setJobState({ status: 'uploading', currentTask: task });
          toast({ title: 'Upload Authorized', description: 'DVM is now uploading your video...' });
          
        } else if (task.type === 'sign_event') {
          if (!user || !task.event) return;
          
          setJobState({ status: 'awaiting_signature', currentTask: task });
          
          const template = {
            kind: task.event.kind!,
            content: task.event.content ?? '',
            tags: (task.event.tags ?? []) as [string, string][],
            created_at: task.event.created_at ?? Math.floor(Date.now() / 1000),
          };
          const signedVideoEvent = await user.signer.signEvent(template);

          // Publish the actual video event (kind 34236)
          console.log('[Client] Publishing video event (kind 34236):', signedVideoEvent.id);
          await publishToPool(nostr, relays, signedVideoEvent);

          // Also send response to DVM so it knows we're done
          const responseEvent = await user.signer.signEvent({
            kind: 30535,
            content: JSON.stringify(signedVideoEvent),
            tags: [
              ['e', jobId],
              ['p', taskEvent.pubkey],
            ],
            created_at: Math.floor(Date.now() / 1000),
          });

          await publishToPool(nostr, relays, responseEvent);
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
      
      // Queue the event and process
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

    relays.forEach((url) => {
      const relay = nostr.relay(url);
      const sub = relay.req([filter], { signal });
      (async () => {
        try {
          for await (const msg of sub) {
            if (msg[0] === 'EVENT') handleEvent(msg[2]);
          }
        } catch (_) {
          // Aborted or relay closed
        }
      })();
    });

    return () => controller.abort();
  }, [currentJobId, relays.join(','), nostr, user?.pubkey, toast]);

  const broadcastJob = useCallback(
    async (remixData: unknown): Promise<string | null> => {
      if (!user) {
        toast({
          title: 'Login Required',
          description: 'Please login with Nostr to broadcast job requests',
          variant: 'destructive',
        });
        return null;
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

        return signedEvent.id;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setJobState({ status: 'error', errorMessage });
        toast({
          title: 'Broadcast Failed',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, nostr, relays, toast]
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
    },
  };
}
