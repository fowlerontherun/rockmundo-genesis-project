import { useEffect, useState } from "react";
import { containScene, VENUE_SCENE_SIZE } from "../engine/SceneLayout";

export function useCanvasSize(ref: React.RefObject<HTMLElement>, opts?: { fill?: boolean; maxHeight?: number }) {
  const fill = !!opts?.fill;
  const maxHeight = opts?.maxHeight ?? 520;
  const [container, setContainer] = useState({ width: 640, height: 360 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const update = () => {
      if (!alive) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = fill ? Math.max(1, rect.height) : Math.max(220, Math.min(maxHeight, width * 9 / 16));
      setContainer((current) => current.width === width && current.height === height ? current : { width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { alive = false; ro.disconnect(); };
  }, [ref, fill, maxHeight]);
  return { container, fit: containScene(container), logical: VENUE_SCENE_SIZE };
}
