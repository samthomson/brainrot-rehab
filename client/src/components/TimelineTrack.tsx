import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical } from 'lucide-react';
import type { TimelineSegment, SourceVideo } from '@/types/video';

interface TimelineTrackProps {
  segments: TimelineSegment[];
  sourceVideos: SourceVideo[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
}

export function TimelineTrack({ segments, sourceVideos, onReorder, onRemove }: TimelineTrackProps) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  
  // Generate thumbnails for each segment (optimized with cleanup)
  useEffect(() => {
    const videoElements: HTMLVideoElement[] = [];

    segments.forEach((segment) => {
      if (thumbnails[segment.id]) return;
      
      const sourceVideo = sourceVideos.find((v) => v.id === segment.sourceVideoId);
      if (!sourceVideo) return;

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';
      video.src = sourceVideo.url;
      videoElements.push(video);

      const generateThumbnail = () => {
        try {
          const seekTime = segment.startTime + (segment.duration / 2);
          video.currentTime = seekTime;
        } catch (error) {
          console.error('Error seeking for thumbnail:', error);
        }
      };

      const captureThumbnail = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.5);
            setThumbnails((prev) => ({ ...prev, [segment.id]: thumbnail }));
          }
        } catch (error) {
          console.error('Error generating thumbnail:', error);
        } finally {
          // Clean up
          video.removeEventListener('loadedmetadata', generateThumbnail);
          video.removeEventListener('seeked', captureThumbnail);
          video.src = '';
        }
      };

      video.addEventListener('loadedmetadata', generateThumbnail);
      video.addEventListener('seeked', captureThumbnail);
      video.load();
    });

    return () => {
      // Cleanup all video elements
      videoElements.forEach(video => {
        video.src = '';
        video.load();
      });
    };
  }, [segments, sourceVideos]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };

  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const maxSeconds = Math.ceil(totalDuration);
  const pixelsPerSecond = 100; // Scale factor for visualization

  if (segments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>📽️ Timeline</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            <p className="mb-2">Your timeline is empty</p>
            <p className="text-sm">
              Cut segments from source videos above to build your remix
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>📽️ Timeline</span>
          <span className="text-sm text-muted-foreground font-normal">
            Total: {totalDuration.toFixed(2)}s ({segments.length}{' '}
            segment{segments.length !== 1 ? 's' : ''})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Scrollable container for both ruler and track */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${maxSeconds * pixelsPerSecond}px` }}>
            {/* Time ruler */}
            <div className="mb-4 relative">
              <div className="flex border-b border-border pb-2">
                {Array.from({ length: maxSeconds + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="relative"
                    style={{ width: `${pixelsPerSecond}px` }}
                  >
                    <div className="text-xs text-muted-foreground font-medium">
                      {i}s
                    </div>
                    <div className="absolute top-6 left-0 w-px h-2 bg-border" />
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline track */}
            <div className="relative bg-muted/30 rounded-lg p-2 min-h-24">
              <div className="flex gap-1 items-center">
            {segments.map((segment, index) => {
              const segmentWidth = segment.duration * pixelsPerSecond;
              const thumbnail = thumbnails[segment.id];
              
              return (
                <div
                  key={segment.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="relative group cursor-move"
                  style={{ width: `${segmentWidth}px` }}
                >
                  <Card className="h-40 border-2 border-primary/50 hover:border-primary transition-colors overflow-hidden">
                    <CardContent className="p-0 h-full flex relative">
                      {/* Thumbnail */}
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={segment.videoName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/30" />
                      )}
                      
                      {/* Overlay info */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2">
                        <p className="text-white text-xs font-medium truncate">
                          {segment.videoName}
                        </p>
                        <p className="text-white/80 text-xs">
                          {segment.duration.toFixed(2)}s
                        </p>
                      </div>

                      {/* Drag handle */}
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-4 w-4 text-white drop-shadow" />
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemove(segment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
