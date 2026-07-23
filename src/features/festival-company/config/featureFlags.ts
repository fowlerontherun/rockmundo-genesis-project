/**
 * Central feature flags for the new festival-company replacement programme.
 *
 * Legacy defaults ON while replacement defaults OFF so PR1 is a pure
 * safety boundary. Toggle via Vite env vars at build time or override
 * per-render for tests.
 *
 * VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM   ("true"|"false", default "true")
 * VITE_FEATURE_NEW_FESTIVAL_SYSTEM      (default "false")
 * VITE_FEATURE_FESTIVAL_CREATION        (default "false")
 * VITE_FEATURE_FESTIVAL_APPLICATIONS    (default "false")
 * VITE_FEATURE_FESTIVAL_LIVE_PERFORMANCE(default "false")
 */

export interface FestivalFeatureFlags {
  legacyFestivalSystemEnabled: boolean;
  newFestivalSystemEnabled: boolean;
  festivalCreationEnabled: boolean;
  festivalApplicationsEnabled: boolean;
  festivalLivePerformanceEnabled: boolean;
}

const readEnv = (key: string): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any)?.env?.[key];
  } catch {
    return undefined;
  }
};

const bool = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
};

export const resolveFestivalFeatureFlags = (
  overrides: Partial<FestivalFeatureFlags> = {},
): FestivalFeatureFlags => ({
  legacyFestivalSystemEnabled:
    overrides.legacyFestivalSystemEnabled ??
    bool(readEnv("VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM"), true),
  newFestivalSystemEnabled:
    overrides.newFestivalSystemEnabled ??
    bool(readEnv("VITE_FEATURE_NEW_FESTIVAL_SYSTEM"), false),
  festivalCreationEnabled:
    overrides.festivalCreationEnabled ??
    bool(readEnv("VITE_FEATURE_FESTIVAL_CREATION"), false),
  festivalApplicationsEnabled:
    overrides.festivalApplicationsEnabled ??
    bool(readEnv("VITE_FEATURE_FESTIVAL_APPLICATIONS"), false),
  festivalLivePerformanceEnabled:
    overrides.festivalLivePerformanceEnabled ??
    bool(readEnv("VITE_FEATURE_FESTIVAL_LIVE_PERFORMANCE"), false),
});

export const festivalFeatureFlags: FestivalFeatureFlags =
  resolveFestivalFeatureFlags();

export const useFestivalFeatureFlags = (): FestivalFeatureFlags =>
  resolveFestivalFeatureFlags();
