/**
 * Central feature flags for the new festival-company replacement programme.
 *
 * Phase 12 (legacy retirement): the replacement system is the only
 * gameplay surface. Legacy festival gameplay routes are retired and now
 * redirect to the canonical directory, so the legacy switches default OFF.
 * They remain as an emergency, read-only escape hatch that can be enabled
 * per build, and legacy writes stay OFF regardless. Toggle via Vite env
 * vars at build time or override per-render for tests.
 *
 * VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM   ("true"|"false", default "false")
 * VITE_FEATURE_LEGACY_FESTIVAL_READ     (default "false")
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
    bool(readEnv("VITE_FEATURE_LEGACY_FESTIVAL_SYSTEM"), false),
  legacyFestivalReadEnabled:
    overrides.legacyFestivalReadEnabled ?? bool(readEnv("VITE_FEATURE_LEGACY_FESTIVAL_READ"), false),
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
