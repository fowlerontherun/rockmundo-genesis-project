import { useCallback, useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const KEY = "rockmundo:crowd-volume-v1";
const EVENT = "rockmundo:crowd-volume-changed";
const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.6));

function readVolume(): number {
  if (typeof window === "undefined") return 0.6;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return 0.6;
    return clamp(Number(stored));
  } catch {
    return 0.6;
  }
}

export function useCrowdVolumePreference(): [number, (next: number) => void] {
  const [value, setValue] = useState(readVolume);
  useEffect(() => {
    const refresh = () => setValue(readVolume());
    window.addEventListener("storage", refresh);
    window.addEventListener(EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(EVENT, refresh);
    };
  }, []);
  const update = useCallback((next: number) => {
    const clamped = clamp(next);
    setValue(clamped);
    try { window.localStorage.setItem(KEY, String(clamped)); } catch { /* private browsing */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, update];
}

/** Independent from the music / voice mix, shared across 3D gig and TV playback. */
export function CrowdVolumeControl() {
  const [volume, setVolume] = useCrowdVolumePreference();
  return (
    <div className="flex min-w-44 items-center gap-2" data-crowd-volume-control>
      <Label htmlFor="rockmundo-crowd-volume" className="shrink-0 text-xs">Crowd {Math.round(volume * 100)}%</Label>
      <Slider
        id="rockmundo-crowd-volume"
        aria-label="Crowd sound volume"
        min={0} max={100} step={5}
        value={[Math.round(volume * 100)]}
        onValueChange={([next]) => setVolume(next / 100)}
        className="w-28"
      />
    </div>
  );
}
