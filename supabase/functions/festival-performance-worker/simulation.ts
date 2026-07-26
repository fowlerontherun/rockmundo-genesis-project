import {
  CANONICAL_ENGINE_VERSION, FESTIVAL_ADAPTER_VERSION, RESULT_SCHEMA_VERSION,
  simulateCanonicalFestivalPerformance,
} from "../_shared/gig-simulation/index.ts";
import type { FestivalSimulationInput } from "../_shared/gig-simulation/types.ts";

export { RESULT_SCHEMA_VERSION as FESTIVAL_RESULT_VERSION, CANONICAL_ENGINE_VERSION as SUPPORTED_ENGINE_VERSION };
export type FestivalJobSnapshot = FestivalSimulationInput & {
  engineVersion?: string;
  canonicalGigInput: FestivalSimulationInput["canonicalGigInput"] & {
    bandId?: string;
    readiness?: { score?: number };
    setlist: Array<Record<string, unknown>>;
  };
};

/** Maps pre-v2 jobs without treating the overloaded legacy name as a hard failure. */
export function simulateFestivalPerformance(snapshot: FestivalJobSnapshot, inputDigest: string) {
  const raw = snapshot.canonicalGigInput;
  const setlist = raw?.setlist?.map((item, index) => {
    const song = (item.song ?? item) as Record<string, unknown>;
    return {
      id: String(song.id ?? item.id ?? ""), title: String(song.title ?? ""),
      position: Number(item.position ?? index + 1), quality: Number(song.quality ?? 0),
      popularity: Number(song.popularity ?? 0), familiarity: Number(song.familiarity ?? 0),
      rehearsalLevel: Number(song.rehearsalLevel ?? 0), durationSeconds: Number(song.durationSeconds ?? 0),
    };
  }) ?? [];
  return simulateCanonicalFestivalPerformance({
    ...snapshot,
    canonicalEngineVersion: snapshot.canonicalEngineVersion ??
      (snapshot.engineVersion === "gig-v1" ? CANONICAL_ENGINE_VERSION : snapshot.engineVersion) ?? CANONICAL_ENGINE_VERSION,
    festivalAdapterVersion: snapshot.festivalAdapterVersion ?? FESTIVAL_ADAPTER_VERSION,
    resultSchemaVersion: snapshot.resultSchemaVersion ?? RESULT_SCHEMA_VERSION,
    runtimeFormulaVersion: snapshot.runtimeFormulaVersion ?? snapshot.formulaVersions?.runtime ?? "festival-runtime-v1",
    canonicalGigInput: {
      gigId: raw?.gigId ?? snapshot.performanceId,
      artistId: raw?.artistId ?? raw?.bandId ?? "",
      performerSkill: Number(raw?.performerSkill ?? 0), stagePresence: Number(raw?.stagePresence ?? 0),
      readinessScore: Number(raw?.readinessScore ?? raw?.readiness?.score ?? 0), setlist,
    },
  }, inputDigest);
}
