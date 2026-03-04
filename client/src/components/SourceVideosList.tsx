import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { SourceVideoItem } from '@/components/SourceVideoItem';
import type { SourceVideo, TimelineSegment } from '@/types/video';

interface SourceSegment {
  id: string;
  video: SourceVideo;
}

interface SourceVideosListProps {
  sourceSegments: SourceSegment[];
  timelineSegments: TimelineSegment[];
  onAddSourceVideo: () => void;
  onRemoveSegment: (segmentId: string) => void;
  onDuplicateVideo: (video: SourceVideo) => void;
  onSegmentChange: (segmentId: string, segment: Omit<TimelineSegment, 'id' | 'order'>) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClearAll: () => void;
  showClearButton: boolean;
}

export function SourceVideosList({
  sourceSegments,
  timelineSegments,
  onAddSourceVideo,
  onRemoveSegment,
  onDuplicateVideo,
  onSegmentChange,
  onReorder,
  onClearAll,
  showClearButton,
}: SourceVideosListProps) {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);

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

  const handlePlayingChange = (segmentId: string, playing: boolean) => {
    if (playing) {
      setPlayingSegmentId(segmentId);
    } else if (playingSegmentId === segmentId) {
      setPlayingSegmentId(null);
    }
  };

  if (sourceSegments.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Source Videos (0)</h2>
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="py-20 text-center">
            <Button onClick={onAddSourceVideo} size="lg" className="h-24 w-24 rounded-full">
              <Plus className="h-12 w-12" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Add your first video
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Source Videos ({sourceSegments.length})</h2>
        {showClearButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {sourceSegments.map((segment, index) => (
          <div
            key={segment.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <SourceVideoItem
              video={segment.video}
              segmentId={segment.id}
              index={index}
              initialStartTime={timelineSegments.find((t) => t.id === segment.id)?.startTime}
              initialEndTime={timelineSegments.find((t) => t.id === segment.id)?.endTime}
              onRemove={onRemoveSegment}
              onDuplicate={onDuplicateVideo}
              onSegmentChange={onSegmentChange}
              onPlayingChange={handlePlayingChange}
              shouldPause={playingSegmentId !== null && playingSegmentId !== segment.id}
            />
          </div>
        ))}

        {/* Big + Button at End */}
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="py-12 flex items-center justify-center">
            <Button onClick={onAddSourceVideo} size="lg" className="h-20 w-20 rounded-full">
              <Plus className="h-10 w-10" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
