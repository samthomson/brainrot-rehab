import { useState, useRef, useEffect, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Eye, HelpCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { TimelineSegment, SourceVideo } from '@/types/video';

interface RemixPreviewProps {
  segments: TimelineSegment[];
  sourceVideos: SourceVideo[];
  onPayloadJsonClick?: () => void;
}

export function RemixPreview({ segments, sourceVideos, onPayloadJsonClick }: RemixPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement>(null);

  // Reset to first segment when segments or their order changes
  const segmentKey = segments.map((s) => s.id).join(',');
  useEffect(() => {
    setCurrentSegmentIndex(0);
    setSegmentProgress(0);
    setTotalProgress(0);
    setIsPlaying(false);
  }, [segmentKey]);

  // Clamp index when segment list shrinks (e.g. after reorder or remove)
  const safeSegmentIndex = Math.min(currentSegmentIndex, Math.max(0, segments.length - 1));
  useEffect(() => {
    if (currentSegmentIndex !== safeSegmentIndex) {
      setCurrentSegmentIndex(safeSegmentIndex);
    }
  }, [currentSegmentIndex, safeSegmentIndex]);

  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const currentSegment = segments[safeSegmentIndex];
  const sourceVideo = currentSegment
    ? sourceVideos.find((v) => v.id === currentSegment.sourceVideoId)
    : null;

  // Preload next segment
  const nextSegment = segments[safeSegmentIndex + 1];
  const nextSourceVideo = nextSegment
    ? sourceVideos.find((v) => v.id === nextSegment.sourceVideoId)
    : null;

  useEffect(() => {
    if (preloadVideoRef.current && nextSegment && nextSourceVideo) {
      preloadVideoRef.current.src = nextSourceVideo.url;
      preloadVideoRef.current.currentTime = nextSegment.startTime;
      preloadVideoRef.current.load();
    }
  }, [nextSegment, nextSourceVideo]);

  // Load current segment
  useEffect(() => {
    if (videoRef.current && currentSegment && sourceVideo) {
      videoRef.current.src = sourceVideo.url;
      videoRef.current.currentTime = currentSegment.startTime;
      
      if (isPlaying) {
        videoRef.current.play().catch((err) => {
          console.error('Error playing video:', err);
          setIsPlaying(false);
        });
      }
    }
  }, [safeSegmentIndex, currentSegment, sourceVideo, isPlaying]);

  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentSegment) return;

    const currentTime = videoRef.current.currentTime;
    
    // Check if we've reached the end of this segment
    if (currentTime >= currentSegment.endTime) {
      // Move to next segment
      if (safeSegmentIndex < segments.length - 1) {
        setCurrentSegmentIndex((prev) => Math.min(prev + 1, segments.length - 1));
      } else {
        // End of timeline
        setIsPlaying(false);
        setCurrentSegmentIndex(0);
        setSegmentProgress(0);
        setTotalProgress(0);
      }
    } else {
      // Update progress within segment
      const segmentElapsed = currentTime - currentSegment.startTime;
      const segmentProg = (segmentElapsed / currentSegment.duration) * 100;
      setSegmentProgress(segmentProg);

      // Calculate total progress
      const segmentsBefore = segments.slice(0, safeSegmentIndex);
      const durationBefore = segmentsBefore.reduce((sum, seg) => sum + seg.duration, 0);
      const totalElapsed = durationBefore + segmentElapsed;
      const totalProg = (totalElapsed / totalDuration) * 100;
      setTotalProgress(totalProg);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch((err) => {
        console.error('Error playing video:', err);
      });
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    setCurrentSegmentIndex(0);
    setSegmentProgress(0);
    setTotalProgress(0);
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    if (safeSegmentIndex > 0) {
      setCurrentSegmentIndex((prev) => Math.max(0, prev - 1));
      setSegmentProgress(0);
    }
  };

  const handleNext = () => {
    if (safeSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex((prev) => Math.min(prev + 1, segments.length - 1));
      setSegmentProgress(0);
    }
  };

  if (segments.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview
          </CardTitle>
          {onPayloadJsonClick && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground" onClick={onPayloadJsonClick} title="View payload JSON">
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Add segments to preview your remix</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5" />
            Preview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Segment {safeSegmentIndex + 1} of {segments.length}
          </p>
        </div>
        {onPayloadJsonClick && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground" onClick={onPayloadJsonClick} title="View payload JSON">
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Video Player */}
        <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
          {sourceVideo && currentSegment ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleNext}
                playsInline
                crossOrigin="anonymous"
              />
              
              {/* Play/Pause Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Button
                  onClick={togglePlayPause}
                  size="lg"
                  className="rounded-full h-16 w-16 pointer-events-auto"
                  variant="secondary"
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8" />
                  )}
                </Button>
              </div>

              {/* Current Segment Info */}
              <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm">
                <p className="font-medium">{currentSegment.videoName}</p>
                <p className="text-xs text-white/70">
                  {currentSegment.startTime.toFixed(2)}s - {currentSegment.endTime.toFixed(2)}s
                </p>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              Loading...
            </div>
          )}
          
          {/* Hidden preload video for next segment */}
          {nextSourceVideo && nextSegment && (
            <video
              ref={preloadVideoRef}
              className="hidden"
              preload="auto"
              crossOrigin="anonymous"
              muted
            />
          )}
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          {/* Segment Progress */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Segment Progress</span>
              <span>{segmentProgress.toFixed(0)}%</span>
            </div>
            <Progress value={segmentProgress} className="h-2" />
          </div>

          {/* Total Progress */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Total Progress</span>
              <span>{totalDuration > 0 ? totalProgress.toFixed(0) : 0}%</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRestart}
            disabled={safeSegmentIndex === 0 && segmentProgress === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={safeSegmentIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button onClick={togglePlayPause} size="lg" className="px-8">
            {isPlaying ? (
              <>
                <Pause className="h-5 w-5 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Play
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={safeSegmentIndex === segments.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Timeline Info */}
        <div className="text-center text-sm text-muted-foreground">
          Total Duration: {totalDuration.toFixed(2)}s
        </div>
      </CardContent>
    </Card>
  );
}
