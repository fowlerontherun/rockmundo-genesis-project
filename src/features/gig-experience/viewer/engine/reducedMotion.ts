export function getSystemPrefersReducedMotion() { return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
export const REDUCED_MOTION_STORAGE_KEY = "rockmundo.gigViewer.reducedMotion";
