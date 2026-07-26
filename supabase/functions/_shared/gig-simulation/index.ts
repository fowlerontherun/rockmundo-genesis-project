import type { CanonicalSong, FestivalSimulationInput } from "./types.ts";
import { calculateCanonicalSongOutcome } from "../../../../src/domain/gig-simulation/index.ts";

export * from "./types.ts";
export const CANONICAL_ENGINE_VERSION = "canonical-gig-v1";
export const FESTIVAL_ADAPTER_VERSION = "festival-gig-adapter-v2";
export const RESULT_SCHEMA_VERSION = "festival-performance-result-v1";

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const finite = (value: unknown, code: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
};

function scoreSong(input: FestivalSimulationInput, song: CanonicalSong) {
  const canonical = input.canonicalGigInput;
  const m = input.festivalModifiers;
  const festivalEffect = (m.stageQuality - 50) * .04 + (m.soundAndLighting - 50) * .05 +
    (m.crewEffectiveness - 50) * .03 + (m.weather - 50) * .03 +
    (m.crowdMood - 50) * .04 + (m.equipmentCondition - 50) * .04 -
    Math.min(60, Math.max(0, m.delayMinutes)) * .055 - clamp(m.incidentDisruption) * .045;
  const outcome = calculateCanonicalSongOutcome({ ...song, performerSkill: canonical.performerSkill,
    stagePresence: canonical.stagePresence, readinessScore: canonical.readinessScore, seed: input.seed,
    songId: song.id, equipmentReliability: m.equipmentCondition, crewEffectiveness: m.crewEffectiveness,
    venueEffect: m.stageQuality, stageEffect: m.soundAndLighting, production: m.technicalReadiness,
    setlistPosition: m.billingPosition, stamina: Math.max(0, 100 - song.position * 3),
    momentum: m.crowdMood, crowdState: m.crowdMood, festivalModifier: festivalEffect });
  const { score, baseScore, technicalScore } = outcome;
  return {
    setlistItemId: song.id, songId: song.id, title: song.title,
    score, baseScore: Number(baseScore.toFixed(3)), technicalScore: Number(technicalScore.toFixed(3)),
    canonical: outcome, highlights: score >= 82 ? [`${song.title} became a standout live moment.`] : [],
  };
}

/** Pure deterministic adapter. It deliberately refuses to fabricate missing evidence. */
export function simulateCanonicalFestivalPerformance(input: FestivalSimulationInput, inputDigest: string) {
  if (input.canonicalEngineVersion !== CANONICAL_ENGINE_VERSION ||
      input.festivalAdapterVersion !== FESTIVAL_ADAPTER_VERSION ||
      input.resultSchemaVersion !== RESULT_SCHEMA_VERSION) throw new Error("festival_engine_version_unsupported");
  const canonical = input.canonicalGigInput;
  if (!canonical?.artistId || !Array.isArray(canonical.setlist) || canonical.setlist.length === 0 ||
      canonical.setlist.some(song => !song.id || !song.title)) {
    throw new Error("festival_simulation_canonical_input_missing");
  }
  const songs = [...canonical.setlist].sort((a, b) => a.position - b.position).map(song => scoreSong(input, song));
  const average = (key: "score" | "technicalScore") => songs.reduce((sum, song) => sum + song[key], 0) / songs.length;
  const attendance = finite(input.crowdEvidence.attendance, "festival_result_attendance_invalid");
  const stageCapacity = finite(input.crowdEvidence.stageCapacity, "festival_result_attendance_invalid");
  if (attendance < 0 || attendance > stageCapacity) throw new Error("festival_result_attendance_invalid");
  const finalScore = Number(average("score").toFixed(3));
  return {
    resultVersion: input.resultSchemaVersion, engineVersion: input.canonicalEngineVersion,
    canonicalEngineVersion: input.canonicalEngineVersion, festivalAdapterVersion: input.festivalAdapterVersion,
    runtimeFormulaVersion: input.runtimeFormulaVersion, formulaVersions: input.formulaVersions,
    seed: input.seed, performanceId: input.performanceId, inputDigest, canonicalGigResultId: null,
    basePerformanceScore: finalScore, festivalModifiers: input.festivalModifiers,
    finalScore, technicalScore: Number(average("technicalScore").toFixed(3)),
    crowdResponse: { score: finalScore, energy: clamp(input.festivalModifiers.crowdMood) },
    attendance, stageCapacity, delayImpact: -Math.min(60, input.festivalModifiers.delayMinutes) * .055,
    weatherImpact: (input.festivalModifiers.weather - 50) * .045,
    incidentImpact: -input.festivalModifiers.incidentDisruption * .045,
    setlistItemOutcomes: songs, stageActions: [], generatedHighlights: songs.flatMap(song => song.highlights),
  };
}
