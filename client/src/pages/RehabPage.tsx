import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SourceVideosList } from '@/components/SourceVideosList';
import { TimelineTrack } from '@/components/TimelineTrack';
import { DVMPayloadViewer } from '@/components/DVMPayloadViewer';
import { RemixPreview } from '@/components/RemixPreview';
import { VideoPickerModal } from '@/components/VideoPickerModal';
import { ClearAllDialog } from '@/components/ClearAllDialog';
import { BlocklistManager } from '@/components/BlocklistManager';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import { BroadcastButton } from '@/components/BroadcastButton';
import { DVMJobStatus } from '@/components/DVMJobStatus';
import { useDVMJob } from '@/hooks/useDVMJob';
import { useVideoEventsById } from '@/hooks/useBrainrotVideos';
import { useDvmRelays } from '@/contexts/DvmRelaysContext';
import { DEFAULT_BLOSSOM_UPLOAD_URL, DEFAULT_DVM_PUBKEY, DVM_RELAYS } from '@/lib/dvmRelays';
import { parseRemixSegmentTags } from '@/lib/remixSegments';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Video, SourceVideo, TimelineSegment, RemixData } from '@/types/video';

export default function RehabPage() {
  useSeoMeta({
    title: 'Rehab - brainrot.rehab',
    description: 'Cut and combine short-form Nostr videos. Make new brainrot.',
  });

  const { toast } = useToast();
  const { seedId: seedFromPath } = useParams<{ seedId?: string }>();
  const [searchParams] = useSearchParams();
  const seedId = (seedFromPath || searchParams.get('seed') || '').trim();
  const lastAppliedSeedRef = useRef<string | null>(null);

  interface SourceSegment {
    id: string;
    video: SourceVideo;
  }

  const [sourceSegments, setSourceSegments] = usePersistedState<SourceSegment[]>('video-remix-source-segments', []);
  const [timelineSegments, setTimelineSegments] = usePersistedState<TimelineSegment[]>('video-remix-timeline', []);
  const [blocklist, setBlocklist] = usePersistedState<string[]>('video-remix-blocklist', []);
  const { userSelectedWriteRelays } = useDvmRelays();

  const [caption, setCaption] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isBlocklistOpen, setIsBlocklistOpen] = useState(false);
  const [payloadJsonOpen, setPayloadJsonOpen] = useState(false);

  const { jobState, broadcastJob, resetJob } = useDVMJob(DEFAULT_DVM_PUBKEY, DVM_RELAYS);

  const sourceVideos = sourceSegments.map((s) => s.video);
  const { data: seedVideos = [], isLoading: isSeedLoading } = useVideoEventsById(seedId ? [seedId] : []);
  const seededVideo = seedVideos[0];
  const seedSegmentMetas = useMemo(
    () => (seededVideo ? parseRemixSegmentTags(seededVideo.event.tags) : []),
    [seededVideo]
  );

  const seedSourceIds = useMemo(() => {
    if (!seededVideo) return [];
    if (seedSegmentMetas.length > 0) {
      return [...new Set(seedSegmentMetas.map((segment) => segment.eventId))];
    }
    const mentionIds = seededVideo.event.tags
      .filter(([name, value, _relay, marker]) => name === 'e' && Boolean(value) && marker === 'mention')
      .map(([, value]) => value)
      .filter(Boolean);
    const fallbackIds = seededVideo.event.tags
      .filter(([name, value]) => name === 'e' && Boolean(value))
      .map(([, value]) => value)
      .filter(Boolean);
    const ids = mentionIds.length > 0 ? mentionIds : fallbackIds;
    return [...new Set(ids)];
  }, [seededVideo, seedSegmentMetas]);

  const {
    data: seededSourceVideos = [],
    isLoading: isSeedSourcesLoading,
  } = useVideoEventsById(seedSourceIds);

  useEffect(() => {
    if (!seedId) {
      lastAppliedSeedRef.current = null;
      return;
    }
    if (!seededVideo || isSeedLoading) return;
    if (lastAppliedSeedRef.current === seedId) return;
    if (seedSourceIds.length > 0 && isSeedSourcesLoading) return;

    const resolvedById = new Map<string, Video>();
    for (const video of seededSourceVideos) resolvedById.set(video.id, video);

    const hasStructuredSegments = seedSegmentMetas.length > 0;
    const newSourceSegments = hasStructuredSegments
      ? seedSegmentMetas
          .map((segmentMeta) => {
            const video = resolvedById.get(segmentMeta.eventId);
            if (!video) return null;
            return {
              id: crypto.randomUUID(),
              video: { ...video, segments: [] },
              startTime: segmentMeta.startTime,
              endTime: segmentMeta.endTime,
            };
          })
          .filter(Boolean) as Array<{ id: string; video: SourceVideo; startTime: number; endTime: number }>
      : (seededSourceVideos.length > 0 ? seededSourceVideos : [seededVideo]).map((video) => ({
          id: crypto.randomUUID(),
          video: { ...video, segments: [] },
          startTime: 0,
          endTime: video.duration || 0,
        }));

    if (newSourceSegments.length === 0) return;

    const newTimelineSegments = newSourceSegments.map((segment, index) => {
      const maxEnd = segment.video.duration > 0 ? segment.video.duration : segment.endTime;
      const safeStart = Math.max(0, segment.startTime);
      const safeEnd = Math.max(safeStart, Math.min(segment.endTime, maxEnd || segment.endTime));
      const duration = Math.max(0, safeEnd - safeStart);
      return {
        id: segment.id,
        sourceVideoId: segment.video.id,
        videoName: segment.video.name,
        videoEventId: segment.video.event.id,
        startTime: safeStart,
        endTime: safeEnd,
        duration,
        order: index,
      };
    });

    setSourceSegments(newSourceSegments);
    setTimelineSegments(newTimelineSegments);
    lastAppliedSeedRef.current = seedId;
    toast({
      title: 'Loaded for rehab',
      description:
        hasStructuredSegments
          ? `Loaded ${newSourceSegments.length} original remix segments`
          : seededSourceVideos.length > 0
            ? `Loaded ${seededSourceVideos.length} ingredients from seeded remix`
          : 'Loaded seeded video as source',
    });
  }, [
    seedId,
    seededVideo,
    isSeedLoading,
    seedSourceIds.length,
    seedSegmentMetas,
    isSeedSourcesLoading,
    seededSourceVideos,
    setSourceSegments,
    setTimelineSegments,
    toast,
  ]);

  const handleAddSourceVideo = () => setIsPickerOpen(true);

  const handleSelectVideo = (video: Video) => {
    const sourceVideo: SourceVideo = { ...video, segments: [] };
    const newSegment: SourceSegment = { id: crypto.randomUUID(), video: sourceVideo };
    setSourceSegments((prev) => [...prev, newSegment]);

    const fullDuration = sourceVideo.duration || 0;
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
    const fullDuration = video.duration || 0;
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
    blossom_upload_url: DEFAULT_BLOSSOM_UPLOAD_URL,
    caption: caption.trim() || undefined,
    write_relays: userSelectedWriteRelays,
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
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
            <div className="w-full space-y-4">
              <RemixPreview
                segments={timelineSegments}
                sourceVideos={sourceVideos}
                onPayloadJsonClick={() => setPayloadJsonOpen(true)}
              />
              {timelineSegments.length > 0 && (
                <div className="space-y-4 pt-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Publish</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="caption" className="text-sm font-semibold">Caption</Label>
                        <Input
                          id="caption"
                          placeholder="Add a caption for your video..."
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
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
                    </CardContent>
                  </Card>

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
            <Dialog open={payloadJsonOpen} onOpenChange={setPayloadJsonOpen}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">Payload JSON</DialogTitle>
                <div className="overflow-y-auto space-y-4 pr-2">
                  <DVMPayloadViewer data={remixDataSlim} title="DVM Payload (What Gets Sent)" />
                  <DVMPayloadViewer data={remixDataFull} title="Full Data (Reference Only)" />
                </div>
              </DialogContent>
            </Dialog>
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
