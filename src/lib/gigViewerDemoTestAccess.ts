export interface GigViewerDemoTestLocation {
  pathname: string;
  search: string;
}

/** A deliberately narrow test-only exception for the Playwright demo fixture. */
export function hasGigViewerDemoTestAccess(
  location: GigViewerDemoTestLocation,
  enabled = import.meta.env.VITE_GIG_VIEWER_DEMO_TEST_ADMIN === "true",
): boolean {
  if (!enabled || location.pathname !== "/admin/gig-viewer-demo") return false;
  return new URLSearchParams(location.search).get("no-test-admin") !== "1";
}
