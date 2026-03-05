import { useState, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { SourceVideosList } from '@/components/SourceVideosList';
import { TimelineTrack } from '@/components/TimelineTrack';
import { JSONViewer } from '@/components/JSONViewer';
import { DVMPayloadViewer } from '@/components/DVMPayloadViewer';
import { RemixPreview } from '@/components/RemixPreview';
import { VideoPickerModal } from '@/components/VideoPickerModal';
import { ClearAllDialog } from '@/components/ClearAllDialog';
import { BlocklistManager } from '@/components/BlocklistManager';
import { DVMSettings } from '@/components/DVMSettings';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, FileJson, Film, Settings } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { LoginArea } from '@/components/auth/LoginArea';
import { RelaySelector } from '@/components/RelaySelector';
import { BroadcastButton } from '@/components/BroadcastButton';
import { DVMJobStatus } from '@/components/DVMJobStatus';
import { useDVMJob } from '@/hooks/useDVMJob';
import { BRAINROT_RELAY_URL, DEFAULT_BLOSSOM_UPLOAD_URL, DEFAULT_DVM_PUBKEY } from '@/lib/dvmRelays';
import type { Video, SourceVideo, TimelineSegment, RemixData } from '@/types/video';

const Index = () => {
  useSeoMeta({
    title: 'brainrot.rehab - Remix Nostr Videos',
    description: 'Cut and combine short-form Nostr videos. Rehab your brainrot.',
  });

  const { toast } = useToast();
  
  interface SourceSegment {
    id: string;
    video: SourceVideo;
  }
  
  const [sourceSegments, setSourceSegments] = usePersistedState<SourceSegment[]>('video-remix-source-segments', []);
  const [timelineSegments, setTimelineSegments] = usePersistedState<TimelineSegment[]>('video-remix-timeline', []);
  const [blocklist, setBlocklist] = usePersistedState<string[]>('video-remix-blocklist', []);
  const [additionalRelays, setAdditionalRelays] = usePersistedState<string[]>('video-remix-additional-relays', []);
  const relayPool = [BRAINROT_RELAY_URL, ...additionalRelays];
  const [blossomUploadUrl, setBlossomUploadUrl] = usePersistedState<string>('video-remix-blossom-url', DEFAULT_BLOSSOM_UPLOAD_URL);
  const [dvmPubkey, setDvmPubkey] = usePersistedState<string>('video-remix-dvm-pubkey', DEFAULT_DVM_PUBKEY);
  
  // Force update DVM pubkey if it's empty (migration from old localStorage)
  if (!dvmPubkey) {
    setDvmPubkey(DEFAULT_DVM_PUBKEY);
  }
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isBlocklistOpen, setIsBlocklistOpen] = useState(false);
  const [isDvmSettingsOpen, setIsDvmSettingsOpen] = useState(false);

  const { jobState, broadcastJob, resetJob } = useDVMJob(dvmPubkey, relayPool);

  // Derive sourceVideos for preview component
  const sourceVideos = sourceSegments.map(s => s.video);

  const handleAddSourceVideo = () => {
    setIsPickerOpen(true);
  };

  const handleSelectVideo = (video: Video) => {
    const sourceVideo: SourceVideo = {
      ...video,
      segments: [],
    };
    
    const newSegment: SourceSegment = {
      id: crypto.randomUUID(),
      video: sourceVideo,
    };
    
    setSourceSegments((prev) => [...prev, newSegment]);
    
    // Create initial timeline segment
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
    
    toast({
      title: 'Video Added',
      description: `Added "${video.name}" to timeline`,
    });
  };

  const handleDuplicateVideo = (video: SourceVideo) => {
    const newSegment: SourceSegment = {
      id: crypto.randomUUID(),
      video,
    };
    
    setSourceSegments((prev) => [...prev, newSegment]);
    
    // Create initial timeline segment for duplicate
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
    
    toast({
      title: 'Segment Duplicated',
      description: `Created duplicate segment from "${video.name}"`,
    });
  };

  const handleClearAll = () => {
    setSourceSegments([]);
    setTimelineSegments([]);
    setIsClearDialogOpen(false);
    toast({
      title: 'Cleared',
      description: 'All videos and timeline cleared',
    });
  };

  const handleRemoveSegment = (segmentId: string) => {
    setSourceSegments((prev) => prev.filter((s) => s.id !== segmentId));
    setTimelineSegments((prev) => 
      prev.filter((s) => s.id !== segmentId).map((seg, index) => ({ ...seg, order: index }))
    );
  };

  const handleSegmentChange = useCallback((segmentId: string, segmentData: Omit<TimelineSegment, 'id' | 'order'>) => {
    setTimelineSegments((prev) => {
      const existing = prev.find(s => s.id === segmentId);
      if (!existing) return prev;
      
      // Check if data actually changed to avoid unnecessary updates
      if (
        existing.startTime === segmentData.startTime &&
        existing.endTime === segmentData.endTime &&
        existing.duration === segmentData.duration
      ) {
        return prev;
      }
      
      return prev.map(s => 
        s.id === segmentId 
          ? { ...s, ...segmentData }
          : s
      );
    });
  }, [setTimelineSegments]);

  const handleReorderSourceSegments = (fromIndex: number, toIndex: number) => {
    setSourceSegments((prev) => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments;
    });
    
    // Reorder timeline to match
    setTimelineSegments((prev) => {
      const segmentIds = sourceSegments.map(s => s.id);
      const [movedId] = segmentIds.splice(fromIndex, 1);
      segmentIds.splice(toIndex, 0, movedId);
      
      return prev
        .sort((a, b) => segmentIds.indexOf(a.id) - segmentIds.indexOf(b.id))
        .map((seg, index) => ({ ...seg, order: index }));
    });
  };

  const handleReorderTimeline = (fromIndex: number, toIndex: number) => {
    // Reorder source segments
    setSourceSegments((prev) => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments;
    });
    
    // Reorder timeline
    setTimelineSegments((prev) => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments.map((seg, index) => ({ ...seg, order: index }));
    });
  };

  const handleRemoveTimelineSegment = (id: string) => {
    const index = timelineSegments.findIndex(s => s.id === id);
    if (index === -1) return;
    
    handleRemoveSegment(id);
  };

  const handleAddToBlocklist = (pubkey: string) => {
    if (blocklist.includes(pubkey)) return;
    setBlocklist((prev) => [...prev, pubkey]);
    toast({
      title: 'User Blocked',
      description: 'Videos from this user will be hidden',
    });
  };

  const handleRemoveFromBlocklist = (pubkey: string) => {
    setBlocklist((prev) => prev.filter(p => p !== pubkey));
    toast({
      title: 'User Unblocked',
      description: 'Videos from this user will now appear',
    });
  };

  // Full remix data for JSON viewer (includes everything)
  const remixDataFull: RemixData = {
    segments: timelineSegments.map((seg) => {
      const sourceVideo = sourceVideos.find(v => v.id === seg.sourceVideoId);
      return {
        videoEventId: seg.videoEventId,
        videoName: seg.videoName,
        authorPubkey: sourceVideo?.pubkey || '',
        startTime: seg.startTime,
        endTime: seg.endTime,
        duration: seg.duration,
        originalEvent: sourceVideo?.event || {} as any,
      };
    }),
    totalDuration: timelineSegments.reduce((sum, seg) => sum + seg.duration, 0),
  };

  // Slim remix data for DVM (matches simplified job spec)
  const remixDataSlim = {
    segments: timelineSegments.map((seg) => {
      const sourceVideo = sourceVideos.find(v => v.id === seg.sourceVideoId);
      return {
        videoUrl: sourceVideo?.url || '',
        startTime: seg.startTime,
        endTime: seg.endTime,
        eventId: seg.videoEventId,
        authorPubkey: sourceVideo?.pubkey || '',
      };
    }),
    blossom_upload_url: blossomUploadUrl,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-neutral-100 dark:from-slate-950 dark:via-zinc-950 dark:to-neutral-950">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header with personality */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 dark:from-purple-500/5 dark:via-blue-500/5 dark:to-cyan-500/5 blur-3xl -z-10" />
          <div className="flex items-end justify-between pb-6 border-b-2 border-foreground/10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Film className="h-8 w-8" />
                <h1 className="text-4xl font-black tracking-tight">brainrot.rehab</h1>
              </div>
              <p className="text-muted-foreground">
                Cut, remix, and rehab your brainrot
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDvmSettingsOpen(true)}
                title="DVM Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <RelaySelector
                additionalRelays={additionalRelays}
                onAdditionalRelaysChange={setAdditionalRelays}
              />
              <LoginArea className="max-w-60" />
            </div>
          </div>
        </div>

        {/* Timeline - Full Width First */}
        <TimelineTrack
          segments={timelineSegments}
          sourceVideos={sourceVideos}
          onReorder={handleReorderTimeline}
          onRemove={handleRemoveTimelineSegment}
        />

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Source Videos */}
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

          {/* Right Column - Preview & JSON Tabs */}
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
                <RemixPreview
                  segments={timelineSegments}
                  sourceVideos={sourceVideos}
                />
              </TabsContent>
              <TabsContent value="json" className="mt-4">
                <div className="space-y-4">
                  <BroadcastButton
                    remixData={remixDataSlim}
                    onBroadcast={() => broadcastJob(remixDataSlim)}
                    disabled={timelineSegments.length === 0 || (jobState.status !== 'idle' && jobState.status !== 'error')}
                    isLoading={jobState.status === 'broadcasting'}
                  />
                  
                  <DVMJobStatus
                    status={jobState.status}
                    currentTask={jobState.currentTask}
                    resultEventId={jobState.resultEventId}
                    errorMessage={jobState.errorMessage}
                    onReset={resetJob}
                  />
                  
                  <DVMPayloadViewer 
                    data={remixDataSlim} 
                    title="DVM Payload (What Gets Sent)"
                  />
                  <DVMPayloadViewer 
                    data={remixDataFull} 
                    title="Full Data (Reference Only)"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4 border-t">
          <a
            href="https://shakespeare.diy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Vibed with Shakespeare
          </a>
        </div>
      </div>

      {/* Video Picker Modal */}
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

      {/* Blocklist Manager */}
      <BlocklistManager
        open={isBlocklistOpen}
        onClose={() => setIsBlocklistOpen(false)}
        blocklist={blocklist}
        onAddToBlocklist={handleAddToBlocklist}
        onRemoveFromBlocklist={handleRemoveFromBlocklist}
      />

      {/* Clear All Confirmation Dialog */}
      <ClearAllDialog
        open={isClearDialogOpen}
        onOpenChange={setIsClearDialogOpen}
        onConfirm={handleClearAll}
      />

      {/* DVM Settings */}
      <DVMSettings
        open={isDvmSettingsOpen}
        onClose={() => setIsDvmSettingsOpen(false)}
        dvmPubkey={dvmPubkey}
        onDvmPubkeyChange={setDvmPubkey}
        blossomUploadUrl={blossomUploadUrl}
        onBlossomUrlChange={setBlossomUploadUrl}
      />
    </div>
  );
};

export default Index;
