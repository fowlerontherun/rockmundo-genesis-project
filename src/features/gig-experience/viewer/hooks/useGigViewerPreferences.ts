import { useEffect, useState } from "react";
import { getSystemPrefersReducedMotion, REDUCED_MOTION_STORAGE_KEY } from "../engine/reducedMotion";
import { PYRO_STORAGE_KEY } from "../engine/Pyrotechnics";
import type { GigViewerCameraMode } from "../engine/CameraDirector";

export const CAMERA_MODE_STORAGE_KEY = "gig-viewer-camera-mode";
const CAMERA_MODES: readonly GigViewerCameraMode[] = ["venue_wide", "stage_focus", "auto"];

function storedCameraMode(): GigViewerCameraMode {
  if (typeof localStorage === "undefined") return "venue_wide";
  const stored = localStorage.getItem(CAMERA_MODE_STORAGE_KEY);
  return CAMERA_MODES.includes(stored as GigViewerCameraMode) ? stored as GigViewerCameraMode : "venue_wide";
}

export function useGigViewerPreferences() {
  const [reducedMotion, setReducedMotion] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(REDUCED_MOTION_STORAGE_KEY) : null;
    return stored == null ? getSystemPrefersReducedMotion() : stored === "true";
  });
  const [pyrotechnics, setPyrotechnics] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(PYRO_STORAGE_KEY) : null;
    return stored == null ? true : stored === "true";
  });
  const [cameraMode, setCameraMode] = useState<GigViewerCameraMode>(storedCameraMode);
  useEffect(() => { localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(reducedMotion)); }, [reducedMotion]);
  useEffect(() => { localStorage.setItem(PYRO_STORAGE_KEY, String(pyrotechnics)); }, [pyrotechnics]);
  useEffect(() => { localStorage.setItem(CAMERA_MODE_STORAGE_KEY, cameraMode); }, [cameraMode]);
  return { reducedMotion, setReducedMotion, pyrotechnics, setPyrotechnics, cameraMode, setCameraMode };
}
