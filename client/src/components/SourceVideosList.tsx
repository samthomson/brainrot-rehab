import { useState, useRef, useCallback, useEffect } from 'react';
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hasDragMoved, setHasDragMoved] = useState(false);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const lastSwapRef = useRef<number>(0);
  const scrollSpeedRef = useRef<number>(0);
  const scrollRafRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const tick = () => {
      if (scrollSpeedRef.current !== 0) {
        window.scrollBy(0, scrollSpeedRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(tick);
    };
    scrollRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, index: number, segmentId: string) => {
    const cardEl = cardRefsMap.current.get(segmentId);
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardEl, e.clientX - rect.left, e.clientY - rect.top);
    }
    setDragIndex(index);
    setHasDragMoved(false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    const el = e.currentTarget as HTMLDivElement;
    dragNodeRef.current = el;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '';
      dragNodeRef.current.style.transform = '';
    }
    setDragIndex(null);
    setHasDragMoved(false);
    dragNodeRef.current = null;
    scrollSpeedRef.current = 0;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const edgeZone = 180;
    const { clientY } = e;
    const vh = window.innerHeight;
    if (clientY < edgeZone) {
      const intensity = 1 - clientY / edgeZone;
      scrollSpeedRef.current = -(4 + intensity * 16);
    } else if (clientY > vh - edgeZone) {
      const intensity = 1 - (vh - clientY) / edgeZone;
      scrollSpeedRef.current = 4 + intensity * 16;
    } else {
      scrollSpeedRef.current = 0;
    }

    if (dragIndex === null || dragIndex === index) return;

    const now = Date.now();
    if (now - lastSwapRef.current < 200) return;
    lastSwapRef.current = now;

    onReorder(dragIndex, index);
    setDragIndex(index);
    setHasDragMoved(true);
  }, [dragIndex, onReorder]);

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
        <h2 className="text-xl font-bold mb-4">Ingredients (0)</h2>
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="py-20 text-center">
            <Button onClick={onAddSourceVideo} size="lg" className="h-24 w-24 rounded-full">
              <Plus className="h-12 w-12" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Add your first ingredient
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ingredients ({sourceSegments.length})</h2>
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

      <div ref={listRef}>
        {sourceSegments.map((segment, index) => {
          const isDragged = dragIndex === index;
          const showPlaceholder = isDragged && hasDragMoved;
          return (
            <div key={segment.id}>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, index, segment.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                className="cursor-grab active:cursor-grabbing py-1.5"
              >
                {showPlaceholder && (
                  <div className="h-[30px] mx-2 mb-2 rounded-lg bg-primary/20 border-2 border-dashed border-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
                )}
                <div
                  ref={(el) => {
                    if (el) cardRefsMap.current.set(segment.id, el);
                    else cardRefsMap.current.delete(segment.id);
                  }}
                  className={showPlaceholder ? 'h-0 overflow-hidden' : ''}
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
              </div>
            </div>
          );
        })}

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
