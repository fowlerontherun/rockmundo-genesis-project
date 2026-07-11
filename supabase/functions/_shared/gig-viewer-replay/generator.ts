import { GIG_EVENT_SCHEMA_VERSION, GIG_REPLAY_MAX_EVENTS, GIG_REPLAY_MAX_PAYLOAD_BYTES, GIG_REPLAY_TARGET_DURATION_MS, GIG_VIEWER_VERSION } from "./constants";
import { validateGigViewerReplay } from "./schema";
import type { GigViewerEvent, GigViewerReplay, StagePosition } from "./types";

export interface ReplayGigInput { id: string; completedAt: string | null; resultReadyAt?: string | null; venueCapacity?: number | null; actualAttendance?: number | null; overallRating?: number | null; netProfit?: number | null }
export interface ReplaySongInput { id: string; songId: string | null; position: number; title: string; performanceScore: number | null; crowdResponse?: string | null }
export interface ReplayPerformerInput { profileId: string; displayName?: string | null; roleOrInstrument?: string | null; lineupStatus?: string | null }
export interface BuildGigViewerReplayInput { replayId: string; gig: ReplayGigInput; outcomeId: string; songs: ReplaySongInput[]; performers: ReplayPerformerInput[]; generatedAt: string; viewerVersion?: number }

export function createDeterministicSeed(parts: Array<string | number | null | undefined>): string {
  return fnv1a64(parts.map((p) => String(p ?? "")).join("|"));
}

export function createDeterministicRandom(seed: string) {
  let state = BigInt(`0x${fnv1a64([seed, "rng"].join("|"))}`);
  return () => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number(state >> 11n) / Number(1n << 53n);
  };
}

export async function checksumReplayEvents(events: GigViewerEvent[]): Promise<string> {
  const text = JSON.stringify(events);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return fnv1a64(text);
}

export async function buildGigViewerReplay(input: BuildGigViewerReplayInput): Promise<GigViewerReplay> {
  const viewerVersion = input.viewerVersion ?? GIG_VIEWER_VERSION;
  const sortedSongs = [...input.songs].sort((a, b) => a.position - b.position);
  const performed = input.performers.filter((p) => (p.lineupStatus ?? "performed") === "performed");
  const seed = createDeterministicSeed([input.gig.id, input.outcomeId, input.gig.completedAt, viewerVersion]);
  const random = createDeterministicRandom(seed);
  const durationBySong = allocateSongDurations(sortedSongs);
  const events: GigViewerEvent[] = [];
  let offset = 0;
  let energy = initialEnergy(input.gig);
  const push = (event: Omit<GigViewerEvent, "id" | "gigId" | "sequence" | "scheduledOffsetMs">) => {
    events.push({ ...event, id: `${input.gig.id}:viewer:${events.length}`, gigId: input.gig.id, sequence: events.length, scheduledOffsetMs: offset });
    offset += event.durationMs;
  };
  push({ phase: "venue_opening", eventType: "venue_opened", durationMs: 8_000, importance: "normal", messageKey: "gig.viewer.venue_opened", messageParams: {}, visualPayload: { type: "venue_open", entranceIds: ["main"], lightLevel: 0.35 } });
  push({ phase: "crowd_entry", eventType: "crowd_arrived", durationMs: 12_000, importance: "normal", crowdEnergyBefore: energy, crowdEnergyAfter: energy + 4, messageKey: "gig.viewer.crowd_arrived", messageParams: { attendance: input.gig.actualAttendance ?? 0 }, visualPayload: { type: "crowd_fill", targetDensity: attendancePct(input.gig), zoneIds: ["floor", "balcony"], enteringCount: input.gig.actualAttendance ?? 0 } });
  energy = clamp(energy + 4);
  push({ phase: "pre_show", eventType: "pre_show_started", durationMs: 8_000, importance: "ambient", crowdEnergyBefore: energy, crowdEnergyAfter: energy, messageKey: "gig.viewer.pre_show", messageParams: {}, visualPayload: { type: "crowd_reaction", reaction: "still", intensity: energy / 100 } });
  for (const [index, performer] of performed.slice(0, 8).entries()) {
    push({ phase: "band_entrance", eventType: "performer_entered", durationMs: index === 0 ? 6_000 : 2_000, importance: "normal", performerProfileId: performer.profileId, messageKey: "gig.viewer.performer_entered", messageParams: { performer: performer.displayName ?? "Performer", role: performer.roleOrInstrument ?? "performer" }, visualPayload: { type: "performer_enter", performerId: performer.profileId, displayName: performer.displayName ?? "Performer", roleOrInstrument: performer.roleOrInstrument ?? "performer", startPosition: positionForRole(performer.roleOrInstrument, index) } });
  }
  if (performed.length === 0) push({ phase: "band_entrance", eventType: "performer_moved", durationMs: 6_000, importance: "ambient", messageKey: "gig.viewer.band_entrance_legacy", messageParams: {}, visualPayload: { type: "performer_move", performerId: "unknown", targetPosition: positionForRole(null, 0), movementStyle: "walk" } });
  const bestScore = Math.max(...sortedSongs.map((s) => s.performanceScore ?? -1));
  const worstScore = Math.min(...sortedSongs.map((s) => s.performanceScore ?? 999));
  sortedSongs.forEach((song, i) => {
    const songBudget = durationBySong.get(song.position) ?? 16_000;
    const isEmphasis = i === 0 || i === sortedSongs.length - 1 || song.performanceScore === bestScore || song.performanceScore === worstScore;
    const after = nextEnergy(energy, song, input.gig);
    push({ phase: "song_intro", eventType: sortedSongs.length > 14 && !isEmphasis ? "song_montage" : "song_started", durationMs: Math.round(songBudget * 0.2), importance: isEmphasis ? "important" : "normal", songId: song.songId, messageKey: "gig.viewer.song_started", messageParams: { title: song.title, position: song.position + 1 }, visualPayload: { type: "song_start", songId: song.songId, title: song.title, position: song.position, montage: sortedSongs.length > 14 && !isEmphasis } });
    push({ phase: "song_performance", eventType: "song_crowd_reaction", durationMs: Math.round(songBudget * 0.55), importance: isEmphasis ? "important" : "normal", songId: song.songId, crowdEnergyBefore: energy, crowdEnergyAfter: after, messageKey: "gig.viewer.song_reaction", messageParams: { title: song.title, score: song.performanceScore ?? 0 }, visualPayload: { type: "crowd_reaction", reaction: reactionForEnergy(after), intensity: after / 100, zoneIds: ["floor"] } });
    if (isEmphasis) push({ phase: "highlight_moment", eventType: "song_highlight", durationMs: Math.round(songBudget * 0.15), importance: "important", songId: song.songId, crowdEnergyBefore: energy, crowdEnergyAfter: after, messageKey: "gig.viewer.song_highlight", messageParams: { title: song.title }, visualPayload: { type: "moment_effect", effect: random() > 0.5 ? "pulse" : "ring", targetId: song.songId ?? undefined, intensity: after / 100 } });
    energy = after;
    if (i < sortedSongs.length - 1) push({ phase: "between_songs", eventType: "between_song_transition", durationMs: Math.max(2_000, Math.round(songBudget * 0.1)), importance: "ambient", crowdEnergyBefore: energy, crowdEnergyAfter: energy, messageKey: "gig.viewer.between_songs", messageParams: {}, visualPayload: { type: "crowd_reaction", reaction: "wave", intensity: energy / 120 } });
  });
  const encore = deriveEncoreDecision(input.gig, energy);
  push({ phase: "encore_decision", eventType: "encore_decided", durationMs: 8_000, importance: "important", crowdEnergyBefore: energy, crowdEnergyAfter: encore ? clamp(energy + 5) : energy, messageKey: encore ? "gig.viewer.encore_requested" : "gig.viewer.encore_declined", messageParams: { narrative: "presentation_only" }, visualPayload: { type: "crowd_reaction", reaction: encore ? "jump" : "wave", intensity: energy / 100 } });
  push({ phase: "finale", eventType: "finale_started", durationMs: 10_000, importance: "critical", crowdEnergyBefore: energy, crowdEnergyAfter: clamp(energy + (encore ? 8 : 2)), messageKey: "gig.viewer.finale", messageParams: {}, visualPayload: { type: "moment_effect", effect: "confetti", intensity: Math.min(1, energy / 90) } });
  push({ phase: "band_exit", eventType: "band_exited", durationMs: 8_000, importance: "normal", messageKey: "gig.viewer.band_exit", messageParams: {}, visualPayload: { type: "band_exit", exitStyle: encore ? "encore_bow" : "wave", performerIds: performed.map((p) => p.profileId) } });
  push({ phase: "result_reveal", eventType: "result_revealed", durationMs: 8_000, importance: "critical", messageKey: "gig.viewer.result_reveal", messageParams: { rating: input.gig.overallRating ?? 0 }, visualPayload: { type: "result_reveal", overallRating: input.gig.overallRating ?? null, attendance: input.gig.actualAttendance ?? null, netProfit: input.gig.netProfit ?? null, verdictKey: verdictKey(input.gig.overallRating) } });
  push({ phase: "completed", eventType: "replay_completed", durationMs: 1_000, importance: "ambient", messageKey: "gig.viewer.completed", messageParams: {}, visualPayload: { type: "crowd_reaction", reaction: "disperse", intensity: 0.1 } });
  const replay: GigViewerReplay = { id: input.replayId, gigId: input.gig.id, gigOutcomeId: input.outcomeId, viewerVersion, eventSchemaVersion: GIG_EVENT_SCHEMA_VERSION, simulationSeed: seed, durationMs: offset, generatedAt: input.generatedAt, events, checksum: await checksumReplayEvents(events), status: "ready" };
  const validation = validateGigViewerReplay(replay);
  if (!validation.valid) throw new Error(`INVALID_REPLAY:${validation.errors.join(";")}`);
  assertReplayPayloadWithinBudget(replay);
  return replay;
}

function assertReplayPayloadWithinBudget(replay: GigViewerReplay) {
  if (replay.events.length > GIG_REPLAY_MAX_EVENTS) throw new Error("REPLAY_EVENT_LIMIT_EXCEEDED");
  const bytes = new TextEncoder().encode(JSON.stringify({ events: replay.events })).length;
  if (bytes > GIG_REPLAY_MAX_PAYLOAD_BYTES) throw new Error("REPLAY_PAYLOAD_LIMIT_EXCEEDED");
}

function allocateSongDurations(songs: ReplaySongInput[]) { const out = new Map<number, number>(); if (!songs.length) return out; const base = Math.max(8_000, (GIG_REPLAY_TARGET_DURATION_MS - 71_000) / songs.length); const best = songs.reduce((a, b) => (b.performanceScore ?? -1) > (a.performanceScore ?? -1) ? b : a, songs[0]); const worst = songs.reduce((a, b) => (b.performanceScore ?? 999) < (a.performanceScore ?? 999) ? b : a, songs[0]); let totalWeight = 0; const weights = songs.map((s, i) => { let w = 1; if (i === 0 || i === songs.length - 1) w += 0.35; if (s === best || s === worst) w += 0.25; totalWeight += w; return w; }); songs.forEach((s, i) => out.set(s.position, Math.max(6_000, Math.round(base * songs.length * weights[i] / totalWeight)))); return out; }
function attendancePct(gig: ReplayGigInput) { return clamp((gig.actualAttendance ?? 0) / Math.max(1, gig.venueCapacity ?? 1), 0, 1); }
function initialEnergy(gig: ReplayGigInput) { return clamp(25 + attendancePct(gig) * 35 + ((gig.overallRating ?? 10) / 25) * 15); }
function nextEnergy(current: number, song: ReplaySongInput, gig: ReplayGigInput) { return clamp(current * 0.65 + ((song.performanceScore ?? gig.overallRating ?? 10) / 25) * 35 + attendancePct(gig) * 10); }
function reactionForEnergy(e: number) { return e > 80 ? "jump" : e > 60 ? "bounce" : e > 38 ? "wave" : "still"; }
function deriveEncoreDecision(gig: ReplayGigInput, energy: number) { return (gig.overallRating ?? 0) >= 18 || energy >= 75 || (attendancePct(gig) >= 0.9 && (gig.overallRating ?? 0) >= 15); }
function verdictKey(r?: number | null) { return (r ?? 0) >= 20 ? "excellent" : (r ?? 0) >= 15 ? "strong" : (r ?? 0) >= 8 ? "mixed" : "rough"; }
function positionForRole(role: string | null | undefined, index: number): StagePosition { const r = (role ?? "").toLowerCase(); if (r.includes("drum")) return { x: 0.5, y: 0.8, zone: "back_center" }; if (r.includes("bass")) return { x: 0.25, y: 0.45, zone: "mid_left" }; if (r.includes("guitar")) return { x: 0.75, y: 0.45, zone: "mid_right" }; if (r.includes("vocal")) return { x: 0.5, y: 0.2, zone: "front_center" }; const zones: StagePosition["zone"][] = ["front_left", "front_center", "front_right", "mid_left", "mid_center", "mid_right"]; return { x: 0.15 + (index % 3) * 0.35, y: index < 3 ? 0.25 : 0.55, zone: zones[index % zones.length] }; }
function clamp(value: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(value))); }
function fnv1a64(value: string) { let h = 0xcbf29ce484222325n; for (let i = 0; i < value.length; i++) { h ^= BigInt(value.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(16).padStart(16, "0"); }
