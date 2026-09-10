import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { usablePreviewFrames } from '@/features/clothing-preview/previewManifest';

interface Props {
  itemName: string;
  manifest: unknown;
  className?: string;
}

const labelForView = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

export function GeneratedTurntablePreview({ itemName, manifest, className = '' }: Props) {
  const frames = useMemo(() => usablePreviewFrames(manifest), [manifest]);
  const [index, setIndex] = useState(0);
  const [autoSpin, setAutoSpin] = useState(false);
  const pointerX = useRef<number | null>(null);

  useEffect(() => {
    if (index >= frames.length) setIndex(0);
  }, [frames.length, index]);

  useEffect(() => {
    if (!autoSpin || frames.length < 2) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % frames.length), 700);
    return () => window.clearInterval(timer);
  }, [autoSpin, frames.length]);

  if (!frames.length) {
    return <div className={`min-h-[520px] flex items-center justify-center p-6 text-center text-sm text-muted-foreground ${className}`}>
      No generated turntable is available for this item yet.
    </div>;
  }

  const current = frames[index];
  const rotate = (direction: number) => setIndex(value => (value + direction + frames.length) % frames.length);

  return <div className={`relative min-h-[520px] bg-[#101823] overflow-hidden select-none ${className}`}>
    <div
      className="min-h-[520px] flex items-center justify-center touch-pan-y cursor-ew-resize"
      onPointerDown={event => {
        pointerX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (pointerX.current === null) return;
        const delta = event.clientX - pointerX.current;
        if (Math.abs(delta) < 32) return;
        rotate(delta < 0 ? 1 : -1);
        pointerX.current = event.clientX;
        setAutoSpin(false);
      }}
      onPointerUp={() => { pointerX.current = null; }}
      onPointerCancel={() => { pointerX.current = null; }}
      aria-label={`${itemName} generated 360 degree turntable, ${labelForView(current.key)} view`}
    >
      <img
        src={current.url}
        alt={`${itemName} — ${labelForView(current.key)} view`}
        className="w-full h-full min-h-[520px] max-h-[620px] object-contain pointer-events-none"
        draggable={false}
      />
    </div>

    <div className="absolute top-3 left-3 flex items-center gap-2">
      <Badge className="bg-background/85 text-foreground backdrop-blur">Generated turntable</Badge>
      <Badge variant="secondary" className="bg-background/75 backdrop-blur">{labelForView(current.key)}</Badge>
    </div>

    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-background/85 backdrop-blur p-1 border shadow-lg">
      <Button size="icon" variant="ghost" onClick={() => { rotate(-1); setAutoSpin(false); }} aria-label="Rotate clothing left">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAutoSpin(value => !value)} className="gap-1.5">
        {autoSpin ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {autoSpin ? 'Pause' : 'Auto-spin'}
      </Button>
      <Button size="icon" variant="ghost" onClick={() => { rotate(1); setAutoSpin(false); }} aria-label="Rotate clothing right">
        <RotateCw className="h-4 w-4" />
      </Button>
    </div>

    <div className="absolute bottom-3 right-3 rounded-md bg-background/75 backdrop-blur px-2 py-1 text-[11px] text-muted-foreground">
      {index + 1}/{frames.length}
    </div>
  </div>;
}
