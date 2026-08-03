import { useEffect, useState } from "react";
import { getSystemPrefersReducedMotion, REDUCED_MOTION_STORAGE_KEY } from "../engine/reducedMotion";
import { PYRO_STORAGE_KEY } from "../engine/Pyrotechnics";

export function useGigViewerPreferences() {
  const [reducedMotion, setReducedMotion] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(REDUCED_MOTION_STORAGE_KEY) : null;
    return stored == null ? getSystemPrefersReducedMotion() : stored === "true";
  });
  const [pyrotechnics, setPyrotechnics] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(PYRO_STORAGE_KEY) : null;
    return stored == null ? true : stored === "true";
  });
  useEffect(() => { localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, String(reducedMotion)); }, [reducedMotion]);
  useEffect(() => { localStorage.setItem(PYRO_STORAGE_KEY, String(pyrotechnics)); }, [pyrotechnics]);
  return { reducedMotion, setReducedMotion, pyrotechnics, setPyrotechnics };
}
