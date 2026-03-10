import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ChunkySlider } from '@/components/ChunkySlider';
import { Play, Pause, Trash2, Copy, GripVertical, HelpCircle, Check } from 'lucide-react';
import type { SourceVideo, TimelineSegment } from '@/types/video';

interface SourceVideoItemProps {
  video: SourceVideo;
  segmentId: string;
  index: number;
  initialStartTime?: number;
  initialEndTime?: number;
  onRemove: (segmentId: string) => void;
  onDuplicate: (video: SourceVideo) => void;
  onSegmentChange: (segmentId: string, segment: Omit<TimelineSegment, 'id' | 'order'>) => void;
  onPlayingChange?: (segmentId: string, playing: boolean) => void;
  shouldPause?: boolean;
}

export function SourceVideoItem({ 
  video, 
  segmentId, 
  index,
  initialStartTime,
  initialEndTime,
  onRemove, 
  onDuplicate, 
  onSegmentChange,
  onPlayingChange,
  shouldPause,
}: SourceVideoItemProps) {
  const hasInitialRange = !!(initialEndTime && initialEndTime > 0);
  const [range, setRange] = useState<[number, number]>(
    hasInitialRange ? [initialStartTime ?? 0, initialEndTime!] : [0, 0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [metadataLoaded, setMetadataLoaded] = useState(hasInitialRange);
  const [eventJsonOpen, setEventJsonOpen] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      if (hasInitialRange) {
        setRange([
          Math.min(initialStartTime ?? 0, duration),
          Math.min(initialEndTime!, duration),
        ]);
      } else {
        setRange([0, duration]);
        onSegmentChange(segmentId, {
          sourceVideoId: video.id,
          videoName: video.name,
          videoEventId: video.event.id,
          startTime: 0,
          endTime: duration,
          duration,
        });
      }
      setMetadataLoaded(true);
    }
  }, [initialStartTime, initialEndTime, hasInitialRange, segmentId, video.id, video.name, video.event.id, onSegmentChange]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      if (isPlaying && time >= range[1]) {
        videoRef.current.currentTime = range[0];
      }
      if (time < range[0] || time > range[1]) {
        videoRef.current.currentTime = range[0];
      }
    }
  }, [isPlaying, range]);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        if (onPlayingChange) onPlayingChange(segmentId, false);
      } else {
        videoRef.current.currentTime = range[0];
        videoRef.current.play();
        setIsPlaying(true);
        if (onPlayingChange) onPlayingChange(segmentId, true);
      }
    }
  }, [isPlaying, range, segmentId, onPlayingChange]);

  // Auto-pause when another video starts playing
  useEffect(() => {
    if (shouldPause && isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [shouldPause, isPlaying]);

  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      if (currentTime < range[0] || currentTime > range[1]) {
        videoRef.current.currentTime = range[0];
      }
    }
  }, [range, currentTime, isPlaying]);

  // Debounced auto-update timeline when range changes (only after metadata loaded)
  useEffect(() => {
    if (!metadataLoaded) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      onSegmentChange(segmentId, {
        sourceVideoId: video.id,
        videoName: video.name,
        videoEventId: video.event.id,
        startTime: range[0],
        endTime: range[1],
        duration: range[1] - range[0],
      });
    }, 100);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [metadataLoaded, range[0], range[1], video.id, video.name, video.event.id, segmentId, onSegmentChange]);

  const maxDuration = videoDuration || video.duration || 100;

  const clampToRange = (n: number): number =>
    Math.max(0, Math.min(maxDuration, Number.isFinite(n) ? n : 0));

  const handleStartInputChange = (value: string) => {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return;
    const start = clampToRange(n);
    setRange((prev) => [start, Math.max(start, prev[1])]);
  };

  const handleEndInputChange = (value: string) => {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return;
    const end = clampToRange(n);
    setRange((prev) => [Math.min(prev[0], end), end]);
  };

  return (
    <Card className="group">
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Top row: drag handle + index + video name + ? */}
        <div className="flex items-center gap-2">
          <div className="cursor-move flex items-center gap-2 min-w-0 flex-1">
            <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
              {index + 1}
            </div>
            <span className="text-sm font-medium truncate">{video.name}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setEventJsonOpen(true);
            }}
            title="View source event JSON"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>

        {/* Video + controls in one column; buttons in a column to the right */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video min-h-[280px] w-full">
              <video
                ref={videoRef}
                src={video.url}
                className="w-full h-full object-contain"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                playsInline
                crossOrigin="anonymous"
                preload="metadata"
                poster={video.thumbnailUrl}
              />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <Button
                  onClick={togglePlayPause}
                  size="lg"
                  className="rounded-full h-14 w-14"
                  variant="secondary"
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>
              </div>
            </div>

            {/* Start/end and slider: under the video only */}
            {metadataLoaded ? (
            <div className="space-y-3">
          <div className="flex justify-between items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium shrink-0">
              Start
              <Input
                type="number"
                min={0}
                max={maxDuration}
                step={0.1}
                value={range[0].toFixed(2)}
                onChange={(e) => handleStartInputChange(e.target.value)}
                className="w-24 h-9 font-mono text-sm"
              />
              s
            </label>
            <span className="text-sm text-muted-foreground">
              ({(range[1] - range[0]).toFixed(2)}s)
            </span>
            <label className="flex items-center gap-2 text-sm font-medium shrink-0">
              End
              <Input
                type="number"
                min={0}
                max={maxDuration}
                step={0.1}
                value={range[1].toFixed(2)}
                onChange={(e) => handleEndInputChange(e.target.value)}
                className="w-24 h-9 font-mono text-sm"
              />
              s
            </label>
          </div>

          <ChunkySlider
            min={0}
            max={maxDuration}
            step={0.1}
            value={range}
            onValueChange={(value) => setRange(value as [number, number])}
          />
            </div>
            ) : (
              <div className="h-16 flex items-center justify-center text-sm text-muted-foreground">
                Loading video...
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicate(video)}
              title="Duplicate segment"
              className="h-10"
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(segmentId)}
              title="Remove"
              className="h-10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog open={eventJsonOpen} onOpenChange={setEventJsonOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Source event JSON</DialogTitle>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Original event (JSON)</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(JSON.stringify(video.event, null, 2));
                setJsonCopied(true);
                setTimeout(() => setJsonCopied(false), 2000);
              }}
            >
              {jsonCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {jsonCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{JSON.stringify(video.event, null, 2)}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
