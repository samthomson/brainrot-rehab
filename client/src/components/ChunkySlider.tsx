import { useRef, useCallback } from 'react';

interface ChunkySliderProps {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
}

export function ChunkySlider({ min, max, step, value, onValueChange, className }: ChunkySliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'start' | 'end' | null>(null);

  const getPositionFromValue = (val: number): number => {
    return ((val - min) / (max - min)) * 100;
  };

  const getValueFromPosition = (clientX: number): number => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percentage * (max - min);
    return Math.round(rawValue / step) * step;
  };

  const handleMouseDown = useCallback((thumb: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = thumb;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getValueFromPosition(e.clientX);
      const [start, end] = value;
      
      if (thumb === 'start') {
        onValueChange([Math.min(newValue, end), end]);
      } else {
        onValueChange([start, Math.max(newValue, start)]);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [value, onValueChange, min, max, step]);

  const startPos = getPositionFromValue(value[0]);
  const endPos = getPositionFromValue(value[1]);

  return (
    <div className={`relative w-full py-8 ${className}`}>
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-8 w-full bg-secondary rounded-full cursor-pointer"
        onClick={(e) => {
          const newValue = getValueFromPosition(e.clientX);
          const [start, end] = value;
          const midpoint = (start + end) / 2;
          
          if (newValue < midpoint) {
            onValueChange([newValue, end]);
          } else {
            onValueChange([start, newValue]);
          }
        }}
      >
        {/* Range */}
        <div
          className="absolute h-full bg-primary rounded-full"
          style={{
            left: `${startPos}%`,
            width: `${endPos - startPos}%`,
          }}
        />
        
        {/* Start thumb */}
        <button
          className="absolute h-10 w-10 bg-background border-4 border-primary rounded-full shadow-lg cursor-grab active:cursor-grabbing focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all hover:scale-110"
          style={{
            left: `${startPos}%`,
            top: '50%',
            transform: 'translateX(-50%) translateY(-50%)',
          }}
          onMouseDown={handleMouseDown('start')}
        />
        
        {/* End thumb */}
        <button
          className="absolute h-10 w-10 bg-background border-4 border-primary rounded-full shadow-lg cursor-grab active:cursor-grabbing focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all hover:scale-110"
          style={{
            left: `${endPos}%`,
            top: '50%',
            transform: 'translateX(-50%) translateY(-50%)',
          }}
          onMouseDown={handleMouseDown('end')}
        />
      </div>
    </div>
  );
}