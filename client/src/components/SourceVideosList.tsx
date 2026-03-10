import { useState, useRef, useCallback } from 'react';
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

function DropZone({ active, onDrop }: { active: boolean; onDrop: (e: React.DragEvent) => void }) {
  const [hovering, setHovering] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDragEnter={(e) => { e.preventDefault(); setHovering(true); }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => { setHovering(false); onDrop(e); }}
      className={`transition-all duration-150 rounded-md ${
        active
          ? hovering
            ? 'h-16 bg-primary/20 border-2 border-dashed border-primary my-1'
            : 'h-4 my-0'
          : 'h-0 my-0'
      }`}
    />
  );
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    const el = e.currentTarget as HTMLDivElement;
    dragNodeRef.current = el;
    requestAnimationFrame(() => {
      el.style.opacity = '0.35';
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '';
    }
    setDragIndex(null);
    dragNodeRef.current = null;
  }, []);

  const handleDropAtIndex = useCallback((toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(fromIndex)) return;
    const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
    if (fromIndex !== adjustedTo) {
      onReorder(fromIndex, adjustedTo);
    }
  }, [onReorder]);

  const handlePlayingChange = (segmentId: string, playing: boolean) => {
    if (playing) {
      setPlayingSegmentId(segmentId);
    } else if (playingSegmentId === segmentId) {
      setPlayingSegmentId(null);
    }
  };

  const isDragging = dragIndex !== null;

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

      <div>
        {/* Drop zone before first item */}
        <DropZone active={isDragging && dragIndex !== 0} onDrop={handleDropAtIndex(0)} />

        {sourceSegments.map((segment, index) => (
          <div key={segment.id}>
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              className="transition-transform duration-150 cursor-grab active:cursor-grabbing py-1.5"
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
            {/* Drop zone after each item */}
            <DropZone
              active={isDragging && dragIndex !== index && dragIndex !== index + 1}
              onDrop={handleDropAtIndex(index + 1)}
            />
          </div>
        ))}

        {/* Big + Button at End */}
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors mt-3">
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
