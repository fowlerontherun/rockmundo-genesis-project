export interface LuthieryWorkbenchDemoTestLocation {
  pathname: string;
  search: string;
}

/** Narrow build-time exception used only by the read-only Luthiery Playwright fixture. */
export function hasLuthieryWorkbenchDemoTestAccess(
  location: LuthieryWorkbenchDemoTestLocation,
  enabled = import.meta.env.VITE_LUTHIERY_WORKBENCH_TEST_ADMIN === "true",
): boolean {
  if (!enabled || location.pathname !== "/admin/luthiery-workbench-demo") return false;
  return new URLSearchParams(location.search).get("no-test-admin") !== "1";
}
