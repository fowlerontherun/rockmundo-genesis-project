/**
 * Central feature flags for the new festival-company replacement programme.
 *
 * Phase 11 (activation): the replacement system defaults ON now that
 * Phases 1-10B are implemented and server capabilities report enabled.
 * Legacy festival reads stay ON as read-only compatibility; legacy
 * gameplay writes stay OFF. Toggle via Vite env vars at build time or
 * override per-render for tests.
 *
 * VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM   ("true"|"false", default "true")
 * VITE_FEATURE_LEGACY_FESTIVAL_READ     (default "true")
 * VITE_FEATURE_LEGACY_FESTIVAL_WRITE    (default "false")
 * VITE_FEATURE_NEW_FESTIVAL_SYSTEM      (default "true")
 * VITE_FEATURE_FESTIVAL_CREATION        (default "true")
 * VITE_FEATURE_FESTIVAL_APPLICATIONS    (default "true")
 * VITE_FEATURE_FESTIVAL_LIVE_PERFORMANCE(default "true")
 */


export interface FestivalFeatureFlags {
  legacyFestivalSystemEnabled: boolean;
  legacyFestivalReadEnabled: boolean;
  legacyFestivalWriteEnabled: boolean;
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
  legacyFestivalReadEnabled:
    overrides.legacyFestivalReadEnabled ?? bool(readEnv("VITE_FEATURE_LEGACY_FESTIVAL_READ"), true),
  legacyFestivalWriteEnabled:
    overrides.legacyFestivalWriteEnabled ?? bool(readEnv("VITE_FEATURE_LEGACY_FESTIVAL_WRITE"), false),
  newFestivalSystemEnabled:
    overrides.newFestivalSystemEnabled ??
    bool(readEnv("VITE_FEATURE_NEW_FESTIVAL_SYSTEM"), true),
  festivalCreationEnabled:
    overrides.festivalCreationEnabled ??
    bool(readEnv("VITE_FEATURE_FESTIVAL_CREATION"), true),
  festivalApplicationsEnabled:
    overrides.festivalApplicationsEnabled ??
    bool(readEnv("VITE_FEATURE_FESTIVAL_APPLICATIONS"), true),
  festivalLivePerformanceEnabled:
    overrides.festivalLivePerformanceEnabled ??
    bool(readEnv("VITE_FEATURE_FESTIVAL_LIVE_PERFORMANCE"), true),

});

export const festivalFeatureFlags: FestivalFeatureFlags =
  resolveFestivalFeatureFlags();

export const useFestivalFeatureFlags = (): FestivalFeatureFlags =>
  resolveFestivalFeatureFlags();
