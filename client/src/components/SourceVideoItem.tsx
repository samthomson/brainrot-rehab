import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Trash2, Copy, GripVertical } from 'lucide-react';
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
  const [range, setRange] = useState<[number, number]>([initialStartTime ?? 0, initialEndTime ?? 5]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      // Keep persisted trim when we have initial range from parent; only default to full when new
      if (initialStartTime !== undefined && initialEndTime !== undefined) {
        setRange([
          Math.min(initialStartTime, duration),
          Math.min(initialEndTime, duration),
        ]);
      } else {
        setRange([0, duration]);
      }
    }
  }, [initialStartTime, initialEndTime]);

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

  // Debounced auto-update timeline when range changes
  useEffect(() => {
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
  }, [range[0], range[1], video.id, video.name, video.event.id, segmentId, onSegmentChange]);

  const maxDuration = videoDuration || video.duration || 100;

  return (
    <Card className="group">
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Top row: drag handle + index + video name */}
        <div className="cursor-move flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
            {index + 1}
          </div>
          <span className="text-sm font-medium truncate">{video.name}</span>
        </div>

        {/* Video: large, full width */}
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

        {/* Controls underneath */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Current: {currentTime.toFixed(2)}s</span>
            <span>Duration: {maxDuration.toFixed(2)}s</span>
          </div>

          <Slider
            min={0}
            max={maxDuration}
            step={0.1}
            value={range}
            onValueChange={(value) => setRange(value as [number, number])}
            className="w-full"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xl font-bold text-primary">
              {range[0].toFixed(2)}s – {range[1].toFixed(2)}s
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({(range[1] - range[0]).toFixed(2)}s)
              </span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDuplicate(video)}
                title="Duplicate segment"
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(segmentId)}
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
