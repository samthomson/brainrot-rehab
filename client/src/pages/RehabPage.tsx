import { useState, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { SourceVideosList } from '@/components/SourceVideosList';
import { TimelineTrack } from '@/components/TimelineTrack';
import { DVMPayloadViewer } from '@/components/DVMPayloadViewer';
import { RemixPreview } from '@/components/RemixPreview';
import { VideoPickerModal } from '@/components/VideoPickerModal';
import { ClearAllDialog } from '@/components/ClearAllDialog';
import { BlocklistManager } from '@/components/BlocklistManager';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, FileJson } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { BroadcastButton } from '@/components/BroadcastButton';
import { DVMJobStatus } from '@/components/DVMJobStatus';
import { useDVMJob } from '@/hooks/useDVMJob';
import { BRAINROT_RELAY_URL, DEFAULT_BLOSSOM_UPLOAD_URL, DEFAULT_DVM_PUBKEY } from '@/lib/dvmRelays';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Video, SourceVideo, TimelineSegment, RemixData } from '@/types/video';

export default function RehabPage() {
  useSeoMeta({
    title: 'Rehab - brainrot.rehab',
    description: 'Cut and combine short-form Nostr videos. Make new brainrot.',
  });

  const { toast } = useToast();

  interface SourceSegment {
    id: string;
    video: SourceVideo;
  }

  const [sourceSegments, setSourceSegments] = usePersistedState<SourceSegment[]>('video-remix-source-segments', []);
  const [timelineSegments, setTimelineSegments] = usePersistedState<TimelineSegment[]>('video-remix-timeline', []);
  const [blocklist, setBlocklist] = usePersistedState<string[]>('video-remix-blocklist', []);
  const [additionalRelays] = usePersistedState<string[]>('video-remix-additional-relays', []);
  const relayPool = [BRAINROT_RELAY_URL, ...additionalRelays];
  const [blossomUploadUrl] = usePersistedState<string>('video-remix-blossom-url', DEFAULT_BLOSSOM_UPLOAD_URL);
  const [dvmPubkey, setDvmPubkey] = usePersistedState<string>('video-remix-dvm-pubkey', DEFAULT_DVM_PUBKEY);

  if (!dvmPubkey) {
    setDvmPubkey(DEFAULT_DVM_PUBKEY);
  }
  const [caption, setCaption] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isBlocklistOpen, setIsBlocklistOpen] = useState(false);

  const { jobState, broadcastJob, resetJob } = useDVMJob(dvmPubkey, relayPool);

  const sourceVideos = sourceSegments.map((s) => s.video);

  const handleAddSourceVideo = () => setIsPickerOpen(true);

  const handleSelectVideo = (video: Video) => {
    const sourceVideo: SourceVideo = { ...video, segments: [] };
    const newSegment: SourceSegment = { id: crypto.randomUUID(), video: sourceVideo };
    setSourceSegments((prev) => [...prev, newSegment]);

    const fullDuration = sourceVideo.duration ?? 5;
    const timelineSegment: TimelineSegment = {
      id: newSegment.id,
      sourceVideoId: sourceVideo.id,
      videoName: sourceVideo.name,
      videoEventId: sourceVideo.event.id,
      startTime: 0,
      endTime: fullDuration,
      duration: fullDuration,
      order: sourceSegments.length,
    };
    setTimelineSegments((prev) => [...prev, timelineSegment]);
    toast({ title: 'Video Added', description: `Added "${video.name}" to timeline` });
  };

  const handleDuplicateVideo = (video: SourceVideo) => {
    const newSegment: SourceSegment = { id: crypto.randomUUID(), video };
    setSourceSegments((prev) => [...prev, newSegment]);
    const fullDuration = video.duration ?? 5;
    const timelineSegment: TimelineSegment = {
      id: newSegment.id,
      sourceVideoId: video.id,
      videoName: video.name,
      videoEventId: video.event.id,
      startTime: 0,
      endTime: fullDuration,
      duration: fullDuration,
      order: timelineSegments.length,
    };
    setTimelineSegments((prev) => [...prev, timelineSegment]);
    toast({ title: 'Segment Duplicated', description: `Created duplicate segment from "${video.name}"` });
  };

  const handleClearAll = () => {
    setSourceSegments([]);
    setTimelineSegments([]);
    setIsClearDialogOpen(false);
    toast({ title: 'Cleared', description: 'All videos and timeline cleared' });
  };

  const handleRemoveSegment = (segmentId: string) => {
    setSourceSegments((prev) => prev.filter((s) => s.id !== segmentId));
    setTimelineSegments((prev) =>
      prev.filter((s) => s.id !== segmentId).map((seg, index) => ({ ...seg, order: index }))
    );
  };

  const handleSegmentChange = useCallback(
    (segmentId: string, segmentData: Omit<TimelineSegment, 'id' | 'order'>) => {
      setTimelineSegments((prev) => {
        const existing = prev.find((s) => s.id === segmentId);
        if (!existing) return prev;
        if (
          existing.startTime === segmentData.startTime &&
          existing.endTime === segmentData.endTime &&
          existing.duration === segmentData.duration
        ) {
          return prev;
        }
        return prev.map((s) => (s.id === segmentId ? { ...s, ...segmentData } : s));
      });
    },
    [setTimelineSegments]
  );

  const handleReorderSourceSegments = (fromIndex: number, toIndex: number) => {
    setSourceSegments((prev) => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments;
    });
    setTimelineSegments((prev) => {
      const segmentIds = sourceSegments.map((s) => s.id);
      const [movedId] = segmentIds.splice(fromIndex, 1);
      segmentIds.splice(toIndex, 0, movedId);
      return prev
        .sort((a, b) => segmentIds.indexOf(a.id) - segmentIds.indexOf(b.id))
        .map((seg, index) => ({ ...seg, order: index }));
    });
  };

  const handleReorderTimeline = (fromIndex: number, toIndex: number) => {
    setSourceSegments((prev) => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments;
    });
    setTimelineSegments((prev) => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments.map((seg, index) => ({ ...seg, order: index }));
    });
  };

  const handleRemoveTimelineSegment = (id: string) => {
    handleRemoveSegment(id);
  };

  const handleAddToBlocklist = (pubkey: string) => {
    if (blocklist.includes(pubkey)) return;
    setBlocklist((prev) => [...prev, pubkey]);
    toast({ title: 'User Blocked', description: 'Videos from this user will be hidden' });
  };

  const handleRemoveFromBlocklist = (pubkey: string) => {
    setBlocklist((prev) => prev.filter((p) => p !== pubkey));
    toast({ title: 'User Unblocked', description: 'Videos from this user will now appear' });
  };

  const remixDataFull: RemixData = {
    segments: timelineSegments.map((seg) => {
      const sourceVideo = sourceVideos.find((v) => v.id === seg.sourceVideoId);
      return {
        videoEventId: seg.videoEventId,
        videoName: seg.videoName,
        authorPubkey: sourceVideo?.pubkey || '',
        startTime: seg.startTime,
        endTime: seg.endTime,
        duration: seg.duration,
        originalEvent: sourceVideo?.event ?? ({} as NostrEvent),
      };
    }),
    totalDuration: timelineSegments.reduce((sum, seg) => sum + seg.duration, 0),
  };

  const remixDataSlim = {
    segments: timelineSegments.map((seg) => {
      const sourceVideo = sourceVideos.find((v) => v.id === seg.sourceVideoId);
      return {
        videoUrl: sourceVideo?.url || '',
        startTime: seg.startTime,
        endTime: seg.endTime,
        eventId: seg.videoEventId,
        authorPubkey: sourceVideo?.pubkey || '',
      };
    }),
    blossom_upload_url: blossomUploadUrl,
    caption: caption.trim() || undefined,
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between pb-6">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Rehab</h1>
              <p className="text-muted-foreground">Cut, remix, and make new brainrot</p>
            </div>
        </div>

        <TimelineTrack
          segments={timelineSegments}
          sourceVideos={sourceVideos}
          onReorder={handleReorderTimeline}
          onRemove={handleRemoveTimelineSegment}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SourceVideosList
              sourceSegments={sourceSegments}
              timelineSegments={timelineSegments}
              onAddSourceVideo={handleAddSourceVideo}
              onRemoveSegment={handleRemoveSegment}
              onDuplicateVideo={handleDuplicateVideo}
              onSegmentChange={handleSegmentChange}
              onReorder={handleReorderSourceSegments}
              onClearAll={() => setIsClearDialogOpen(true)}
              showClearButton={sourceSegments.length > 0}
            />
          </div>

          <div>
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="json">
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-4">
                <div className="space-y-4">
                  <RemixPreview segments={timelineSegments} sourceVideos={sourceVideos} />
                  {timelineSegments.length > 0 && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="caption">Caption</Label>
                        <Input
                          id="caption"
                          placeholder="Add a caption for your video..."
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          className="max-w-md"
                        />
                      </div>
                      <BroadcastButton
                        remixData={remixDataSlim}
                        onBroadcast={() => broadcastJob(remixDataSlim)}
                        disabled={jobState.status !== 'idle' && jobState.status !== 'error'}
                        isLoading={jobState.status === 'broadcasting'}
                        label="Publish"
                        loadingLabel="Publishing..."
                      />
                      <DVMJobStatus
                        status={jobState.status}
                        currentTask={jobState.currentTask}
                        resultEventId={jobState.resultEventId}
                        errorMessage={jobState.errorMessage}
                        onReset={resetJob}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="json" className="mt-4">
                <div className="space-y-4">
                  <DVMPayloadViewer data={remixDataSlim} title="DVM Payload (What Gets Sent)" />
                  <DVMPayloadViewer data={remixDataFull} title="Full Data (Reference Only)" />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground py-4 border-t">
          <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Vibed with Shakespeare
          </a>
        </div>

      <VideoPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectVideo={handleSelectVideo}
        blocklist={blocklist}
        onAddToBlocklist={handleAddToBlocklist}
        onOpenBlocklistManager={() => {
          setIsPickerOpen(false);
          setIsBlocklistOpen(true);
        }}
      />

      <BlocklistManager
        open={isBlocklistOpen}
        onClose={() => setIsBlocklistOpen(false)}
        blocklist={blocklist}
        onAddToBlocklist={handleAddToBlocklist}
        onRemoveFromBlocklist={handleRemoveFromBlocklist}
      />

      <ClearAllDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen} onConfirm={handleClearAll} />
    </div>
  );
}
