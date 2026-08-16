import { useEffect, useState } from "react";
import { getSystemPrefersReducedMotion, REDUCED_MOTION_STORAGE_KEY } from "../engine/reducedMotion";
import { PYRO_STORAGE_KEY } from "../engine/Pyrotechnics";
import type { GigViewerCameraMode } from "../engine/CameraDirector";
import { PERFORMANCE_TIER_STORAGE_KEY, type PerformanceTier } from "../engine/ViewerDiagnostics";

export type PerformancePreference = "auto" | PerformanceTier;
const PERFORMANCE_PREFERENCES: readonly PerformancePreference[] = ["auto", "low", "standard", "high"];

export const CAMERA_MODE_STORAGE_KEY = "gig-viewer-camera-mode";
const CAMERA_MODES: readonly GigViewerCameraMode[] = ["venue_wide", "stage_focus", "auto"];

function storedCameraMode(): GigViewerCameraMode {
  try {
    if (typeof localStorage === "undefined") return "venue_wide";
    const stored = localStorage.getItem(CAMERA_MODE_STORAGE_KEY);
    return CAMERA_MODES.includes(stored as GigViewerCameraMode) ? stored as GigViewerCameraMode : "venue_wide";
  } catch { return "venue_wide"; }
}

const safeRead = (key: string) => { try { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); } catch { return null; } };
const safeWrite = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Preferences remain usable in memory. */ } };

export function useGigViewerPreferences() {
  const [reducedMotion, setReducedMotion] = useState(() => {
    const stored = safeRead(REDUCED_MOTION_STORAGE_KEY);
    return stored == null ? getSystemPrefersReducedMotion() : stored === "true";
  });
  const [pyrotechnics, setPyrotechnics] = useState(() => {
    const stored = safeRead(PYRO_STORAGE_KEY);
    return stored == null ? true : stored === "true";
  });
  const [cameraMode, setCameraMode] = useState<GigViewerCameraMode>(storedCameraMode);
  const [performancePreference, setPerformancePreference] = useState<PerformancePreference>(() => {
    const stored = safeRead(PERFORMANCE_TIER_STORAGE_KEY);
    return PERFORMANCE_PREFERENCES.includes(stored as PerformancePreference) ? stored as PerformancePreference : "auto";
  });
  useEffect(() => { safeWrite(REDUCED_MOTION_STORAGE_KEY, String(reducedMotion)); }, [reducedMotion]);
  useEffect(() => { safeWrite(PYRO_STORAGE_KEY, String(pyrotechnics)); }, [pyrotechnics]);
  useEffect(() => { safeWrite(CAMERA_MODE_STORAGE_KEY, cameraMode); }, [cameraMode]);
  useEffect(() => { safeWrite(PERFORMANCE_TIER_STORAGE_KEY, performancePreference); }, [performancePreference]);
  return { reducedMotion, setReducedMotion, pyrotechnics, setPyrotechnics, cameraMode, setCameraMode, performancePreference, setPerformancePreference };
}
