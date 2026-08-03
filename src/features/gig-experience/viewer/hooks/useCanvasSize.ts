import { useEffect, useState } from "react";

export function useCanvasSize(ref: React.RefObject<HTMLElement>, opts?: { fill?: boolean; maxHeight?: number }) {
  const fill = !!opts?.fill;
  const maxHeight = opts?.maxHeight ?? 520;
  const [size, setSize] = useState({ width: 640, height: 360 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const update = () => {
      if (!alive) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(280, rect.width);
      const derived = fill ? Math.max(220, rect.height) : Math.max(220, Math.min(maxHeight, width * (width < 640 ? 0.72 : 0.56)));
      setSize({ width, height: derived });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { alive = false; ro.disconnect(); };
  }, [ref, fill, maxHeight]);
  return size;
}
