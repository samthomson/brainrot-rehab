import { useEffect, useState, useCallback } from 'react';
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

export function useDVMJob(dvmPubkey: string, selectedRelay: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [jobState, setJobState] = useState<DVMJobState>({ status: 'idle' });
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Subscribe to task events for current job
  useEffect(() => {
    if (!currentJobId || !dvmPubkey) {
      console.log('Not subscribing - missing jobId or dvmPubkey:', { currentJobId, dvmPubkey });
      return;
    }

    console.log('🔔 Subscribing to DVM tasks:', {
      jobId: currentJobId,
      dvmPubkey,
      relay: selectedRelay,
    });

    const relay = nostr.relay(selectedRelay);
    
    const sub = relay.req([
      {
        kinds: [30534], // Task events
        authors: [dvmPubkey],
        '#d': [currentJobId],
      },
    ]);

    sub.on('event', async (taskEvent: NostrEvent) => {
      try {
        console.log('📨 Received task event:', taskEvent);
        const task: DVMTask = JSON.parse(taskEvent.content);
        console.log('📋 Parsed task:', task);
        
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
    });

    return () => {
      sub.close();
    };
  }, [currentJobId, dvmPubkey, selectedRelay, nostr, toast]);

  const handleNip98Signing = useCallback(async (task: DVMTask, jobRequestId: string) => {
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

      console.log('NIP-98 signed:', nip98Event);

      // Send response back to DVM (30535 envelope must be signed by user so DVM can verify author)
      const responseEvent = await user.signer.signEvent({
        kind: 30535,
        content: JSON.stringify(nip98Event),
        tags: [
          ['e', jobRequestId],
          ['p', dvmPubkey],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });
      const relay = nostr.relay(selectedRelay);
      await relay.event(responseEvent);

      console.log('NIP-98 response sent to DVM');
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
  }, [user, nostr, selectedRelay, dvmPubkey, toast]);

  const handleEventSigning = useCallback(async (task: DVMTask, jobRequestId: string) => {
    if (!user || !task.event) return;

    try {
      console.log('Signing video event...');
      
      const signedVideoEvent = await user.signer.signEvent(task.event);
      console.log('Video event signed:', signedVideoEvent);

      // Send response back to DVM (30535 envelope must be signed by user so DVM can verify author)
      const responseEvent = await user.signer.signEvent({
        kind: 30535,
        content: JSON.stringify(signedVideoEvent),
        tags: [
          ['e', jobRequestId],
          ['p', dvmPubkey],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });
      const relay = nostr.relay(selectedRelay);
      await relay.event(responseEvent);

      console.log('Video event response sent to DVM');
      
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
  }, [user, nostr, selectedRelay, dvmPubkey, toast]);

  const broadcastJob = useCallback(async (remixData: unknown): Promise<string | null> => {
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
      const totalDuration = (remixData as any).segments.reduce(
        (sum: number, seg: any) => sum + (seg.endTime - seg.startTime), 
        0
      );
      
      const unsignedEvent = {
        kind: 5342,
        content: JSON.stringify(remixData),
        tags: [
          ['output', 'video/mp4'],
          ['relays', selectedRelay],
          ['param', 'segments', (remixData as any).segments.length.toString()],
          ['param', 'duration', totalDuration.toFixed(2)],
          ['t', 'brainrot'],
          ['client', 'brainrot.rehab'],
          ['alt', `Video remix job: combine ${(remixData as any).segments.length} segments into one video (${totalDuration.toFixed(2)}s total)`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(unsignedEvent);
      console.log('Job request signed:', signedEvent);

      const relay = nostr.relay(selectedRelay);
      
      await Promise.race([
        relay.event(signedEvent),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Relay timeout after 10 seconds')), 10000)
        ),
      ]);

      console.log('=== DVM Job Request Published ===');
      console.log('Job ID:', signedEvent.id);
      console.log('Relay:', selectedRelay);

      setCurrentJobId(signedEvent.id);
      setJobState({ status: 'pending' });

      toast({
        title: 'Job Broadcasted! 📡',
        description: 'DVM is starting to process your remix...',
      });

      return signedEvent.id;
    } catch (error) {
      console.error('=== Broadcast Error ===', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      setJobState({ status: 'error', errorMessage });
      
      toast({
        title: 'Broadcast Failed',
        description: errorMessage,
        variant: 'destructive',
      });

      return null;
    }
  }, [user, nostr, selectedRelay, toast]);

  return {
    jobState,
    broadcastJob,
    resetJob: () => {
      setCurrentJobId(null);
      setJobState({ status: 'idle' });
    },
  };
}
