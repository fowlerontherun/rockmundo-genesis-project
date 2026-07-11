import { useEffect, useState } from "react";
import { getSystemPrefersReducedMotion, REDUCED_MOTION_STORAGE_KEY } from "../engine/reducedMotion";
export function useGigViewerPreferences() { const [reducedMotion, setReducedMotion] = useState(() => { const stored = typeof localStorage !== "undefined" ? localStorage.getItem(REDUCED_MOTION_STORAGE_KEY) : null; return stored == null ? getSystemPrefersReducedMotion() : stored === "true"; }); useEffect(() => { localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(reducedMotion)); }, [reducedMotion]); return { reducedMotion, setReducedMotion }; }
