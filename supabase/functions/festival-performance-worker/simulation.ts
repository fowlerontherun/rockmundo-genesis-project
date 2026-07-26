import { applySongResultToSession, buildInitialLiveSession, finalizeLiveGig, resolveLiveSong, type FestivalLiveContext, type GigLiveContext, type LiveIncident, type LiveSongResult } from "../../../src/utils/gigLive.ts";

export const FESTIVAL_RESULT_VERSION = "festival-performance-result-v1";
export const SUPPORTED_ENGINE_VERSION = "canonical-gig-v1";

export interface FestivalJobSnapshot {
  runtimeSessionId: string; dayId: string; stageId: string; performanceId: string;
  seed: string; engineVersion: string; runtimeVersion: number;
  formulaVersions: Record<string, string>; canonicalGigInput: GigLiveContext;
  festivalModifiers: FestivalLiveContext; weatherEvidence: unknown; crowdEvidence: { attendance: number; stageCapacity: number };
  delayEvidence: unknown; incidentEvidence: unknown; crewEquipmentEvidence: unknown;
}

const finite = (value: unknown, name: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`festival_result_${name}_invalid`);
  return value;
};

export function simulateFestivalPerformance(snapshot: FestivalJobSnapshot, inputDigest: string) {
  if (snapshot.engineVersion !== SUPPORTED_ENGINE_VERSION) throw new Error("festival_engine_version_unsupported");
  const raw = snapshot.canonicalGigInput as GigLiveContext & { artist?: { bandId?: string }; schedule?: { startsAt?: string; endsAt?: string } };
  const duration = raw.schedule?.startsAt && raw.schedule?.endsAt ? Math.max(600, (Date.parse(raw.schedule.endsAt) - Date.parse(raw.schedule.startsAt)) / 1000) : snapshot.festivalModifiers.setLengthMinutes * 60;
  // Phase 8 v1 inputs did not carry a saved setlist. They remain runnable through a
  // deterministic canonical placeholder set; no Festival-only score is introduced.
  const canonical = raw.setlist?.length ? raw : {
    ...raw, gigId: snapshot.performanceId, bandId: raw.artist?.bandId ?? snapshot.performanceId,
    scheduledAt: raw.schedule?.startsAt ?? "1970-01-01T00:00:00.000Z", capacity: snapshot.crowdEvidence.stageCapacity,
    ticketsSold: snapshot.crowdEvidence.attendance, performerSkill: 50, stagePresence: 50, bandChemistry: 50,
    readiness: { score: 50, blockingIssues: [] },
    setlist: [{ id: `${snapshot.performanceId}:set`, position: 1, song: { id: `${snapshot.performanceId}:song`, title: "Festival set", durationSeconds: duration, quality: 50, popularity: 50, familiarity: 50, rehearsalLevel: snapshot.festivalModifiers.rehearsal } }],
  } as GigLiveContext;
  const context = Object.freeze({ ...canonical, festival: Object.freeze({ ...snapshot.festivalModifiers }) });
  let session = buildInitialLiveSession(context, new Date(context.scheduledAt));
  const songs: LiveSongResult[] = [];
  for (const item of [...context.setlist].sort((a, b) => a.position - b.position)) {
    const result = resolveLiveSong(context, session, item, item.position, snapshot.seed);
    songs.push(result);
    session = applySongResultToSession(session, result, item);
  }
  const aggregate = finalizeLiveGig(session, songs, [] as LiveIncident[]);
  const baseScores = songs.map(song => song.breakdown.find(item => item.key === "base_score")?.modifier ?? song.score);
  const basePerformanceScore = baseScores.length ? baseScores.reduce((sum, score) => sum + score, 0) / baseScores.length : aggregate.finalQuality;
  const technicalScore = songs.length ? songs.reduce((sum, song) => sum + song.technicalScore, 0) / songs.length : 0;
  const modifiers = songs[0]?.breakdown.filter(item => item.key.startsWith("festival_")) ?? [];
  const result = {
    resultVersion: FESTIVAL_RESULT_VERSION, engineVersion: snapshot.engineVersion, formulaVersions: snapshot.formulaVersions,
    seed: snapshot.seed, performanceId: snapshot.performanceId, inputDigest, canonicalGigResultId: null,
    basePerformanceScore: Number(basePerformanceScore.toFixed(3)), festivalModifiers: { values: snapshot.festivalModifiers, effects: modifiers },
    finalScore: aggregate.finalQuality, technicalScore: Number(technicalScore.toFixed(3)),
    crowdResponse: { score: aggregate.finalSatisfaction, energy: aggregate.finalCrowdEnergy }, attendance: snapshot.crowdEvidence.attendance,
    stageCapacity: snapshot.crowdEvidence.stageCapacity, delayImpact: -Math.min(60, snapshot.festivalModifiers.delayMinutes) * .055,
    weatherImpact: (snapshot.festivalModifiers.weather - 50) * .045, incidentImpact: -snapshot.festivalModifiers.incidentDisruption * .045,
    setlistItemOutcomes: songs, stageActions: [], generatedHighlights: songs.flatMap(song => song.highlights),
  };
  validateFestivalSimulationResult(result, snapshot, inputDigest);
  return result;
}

export function validateFestivalSimulationResult(result: Record<string, unknown>, snapshot: FestivalJobSnapshot, digest: string) {
  if (result.resultVersion !== FESTIVAL_RESULT_VERSION || result.engineVersion !== snapshot.engineVersion) throw new Error("festival_result_version_invalid");
  if (result.seed !== snapshot.seed || result.performanceId !== snapshot.performanceId || result.inputDigest !== digest) throw new Error("festival_result_identity_invalid");
  for (const field of ["basePerformanceScore", "finalScore", "technicalScore", "delayImpact", "weatherImpact", "incidentImpact"])
    finite(result[field], field);
  const attendance = finite(result.attendance, "attendance");
  const capacity = finite(result.stageCapacity, "stage_capacity");
  if (attendance < 0 || capacity < 0 || attendance > capacity) throw new Error("festival_result_attendance_invalid");
  for (const field of ["crowdResponse", "festivalModifiers"]) if (!result[field] || typeof result[field] !== "object") throw new Error(`festival_result_${field}_missing`);
  for (const field of ["setlistItemOutcomes", "stageActions", "generatedHighlights"]) if (!Array.isArray(result[field])) throw new Error(`festival_result_${field}_missing`);
}
