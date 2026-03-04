import { useEffect, useState, useCallback, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

interface DVMTask {
  type: 'sign_nip98' | 'sign_event' | 'success' | 'error';
  method?: string;
  url?: string;
  payload_hash?: string;
  event?: Partial<NostrEvent>;
  result_event_id?: string;
  message?: string;
}

interface DVMJobState {
  status: 'idle' | 'broadcasting' | 'pending' | 'awaiting_nip98' | 'uploading' | 'awaiting_signature' | 'complete' | 'error';
  currentTask?: DVMTask;
  resultEventId?: string;
  errorMessage?: string;
}

/** Publish event to all relays in the pool; succeeds if at least one accepts. */
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
  const seenEventIds = useRef<Set<string>>(new Set());

  const handleNip98Signing = useCallback(
    async (task: DVMTask, jobRequestId: string) => {
      if (!user || !task.url || !task.method || !task.payload_hash) return;

      try {
        console.log('Signing NIP-98 auth event...');

        const nip98Event = await user.signer.signEvent({
          kind: 27235,
          content: '',
          tags: [
            ['u', task.url],
            ['method', task.method],
            ['payload', task.payload_hash],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        const responseEvent = await user.signer.signEvent({
          kind: 30535,
          content: JSON.stringify(nip98Event),
          tags: [
            ['e', jobRequestId],
            ['p', dvmPubkey],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        await publishToPool(nostr, relays, responseEvent);

        setJobState({ status: 'uploading', currentTask: task });
        toast({
          title: 'Upload Authorized',
          description: 'DVM is now uploading your video...',
        });
      } catch (error) {
        console.error('Error signing NIP-98:', error);
        toast({
          title: 'Signing Failed',
          description: 'Failed to sign upload authorization',
          variant: 'destructive',
        });
      }
    },
    [user, nostr, relays, dvmPubkey, toast]
  );

  const handleEventSigning = useCallback(
    async (task: DVMTask, jobRequestId: string) => {
      if (!user || !task.event) return;

      try {
        const template = {
          kind: task.event.kind!,
          content: task.event.content ?? '',
          tags: (task.event.tags ?? []) as [string, string][],
          created_at: task.event.created_at ?? Math.floor(Date.now() / 1000),
        };
        const signedVideoEvent = await user.signer.signEvent(template);

        const responseEvent = await user.signer.signEvent({
          kind: 30535,
          content: JSON.stringify(signedVideoEvent),
          tags: [
            ['e', jobRequestId],
            ['p', dvmPubkey],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        await publishToPool(nostr, relays, responseEvent);

        toast({
          title: 'Video Signed',
          description: 'DVM is publishing your remix...',
        });
      } catch (error) {
        console.error('Error signing video event:', error);
        toast({
          title: 'Signing Failed',
          description: 'Failed to sign video event',
          variant: 'destructive',
        });
      }
    },
    [user, nostr, relays, dvmPubkey, toast]
  );

  // Subscribe to task events on all relays in the pool
  useEffect(() => {
    if (!currentJobId || !dvmPubkey || relays.length === 0) return;

    seenEventIds.current = new Set();
    const filter = {
      kinds: [30534],
      authors: [dvmPubkey],
      '#d': [currentJobId],
    };

    const controller = new AbortController();
    const signal = controller.signal;

    const handleEvent = async (taskEvent: NostrEvent) => {
      if (seenEventIds.current.has(taskEvent.id)) return;
      seenEventIds.current.add(taskEvent.id);

      try {
        const task: DVMTask = JSON.parse(taskEvent.content);
        setJobState({ status: 'pending', currentTask: task });

        if (task.type === 'sign_nip98') {
          setJobState({ status: 'awaiting_nip98', currentTask: task });
          await handleNip98Signing(task, currentJobId);
        } else if (task.type === 'sign_event') {
          setJobState({ status: 'awaiting_signature', currentTask: task });
          await handleEventSigning(task, currentJobId);
        } else if (task.type === 'success') {
          setJobState({
            status: 'complete',
            currentTask: task,
            resultEventId: task.result_event_id,
          });
          toast({
            title: 'Video Complete! 🎉',
            description: 'Your remix has been published to Nostr',
          });
        } else if (task.type === 'error') {
          setJobState({
            status: 'error',
            currentTask: task,
            errorMessage: task.message,
          });
          toast({
            title: 'Job Failed',
            description: task.message,
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error handling task:', error);
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
  }, [currentJobId, dvmPubkey, relays, nostr, toast, handleNip98Signing, handleEventSigning]);

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
        await publishToPool(nostr, relays, signedEvent);

        setCurrentJobId(signedEvent.id);
        setJobState({ status: 'pending' });

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
    },
  };
}
