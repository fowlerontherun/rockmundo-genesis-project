import { calculateCrewEffectiveness, calculateEquipmentReliability, type CrewAssignmentInput, type EquipmentLoadoutInput } from './gigCrewEquipment';
import { calculateReadinessPerformanceModifier, type ReadinessResult } from './gigReadiness';
import { SOUNDCHECK_TYPES, type ProductionQualityResult, type SoundcheckType } from './gigStageProduction';
import { summarizePreshowPerformanceModifiers, type PreshowConsequence } from './gigPreshow';

export type LiveGigStatus = 'scheduled' | 'preshow' | 'ready_to_start' | 'live' | 'paused_for_decision' | 'resolving' | 'completed' | 'cancelled' | 'failed';
export type LiveSegmentType = 'intro' | 'song' | 'transition' | 'crowd_interaction' | 'incident' | 'decision' | 'encore_break' | 'encore_song' | 'outro';
export type LiveSegmentStatus = 'pending' | 'active' | 'resolved' | 'skipped' | 'blocked';
export type LiveDecisionPolicy = 'balanced' | 'protect_quality' | 'protect_finances' | 'protect_health' | 'maximise_energy' | 'manager_decides';
export type LiveIncidentCategory = 'performance' | 'equipment' | 'production' | 'crowd' | 'venue' | 'positive';
export type LiveIncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';
export type LiveSongRating = 'disaster' | 'poor' | 'average' | 'good' | 'great' | 'outstanding';

export interface LiveGigSong { id: string; title: string; durationSeconds?: number | null; quality?: number | null; popularity?: number | null; familiarity?: number | null; rehearsalLevel?: number | null; genre?: string | null; tempo?: number | null; difficulty?: number | null; tags?: string[] | null; }
export interface LiveSetlistItem { id: string; song: LiveGigSong; position: number; isEncore?: boolean; }
export interface GigLiveSegment { id?: string; segmentIndex: number; segmentType: LiveSegmentType; setlistItemId?: string | null; songId?: string | null; plannedStartAt: string; plannedDurationSeconds: number; status: LiveSegmentStatus; resultSnapshot?: Record<string, unknown>; }
export interface LiveGigSessionState { gigId: string; bandId: string; status: LiveGigStatus; startedAt: string; expectedEndAt?: string; currentSegmentIndex: number; currentSongItemId?: string | null; crowdEnergy: number; fanSatisfaction: number; performanceQuality: number; bandStamina: number; momentum: number; incidentRisk: number; simulationVersion: number; lastProcessedAt?: string; }
export interface GigLiveContext { gigId: string; bandId: string; scheduledAt: string | Date; status?: string | null; slotDurationSeconds?: number | null; capacity?: number | null; ticketsSold?: number | null; venueAcoustics?: number | null; venueQuality?: number | null; genreAffinity?: number | null; ticketPrice?: number | null; curfewAt?: string | Date | null; performerSkill?: number | null; stagePresence?: number | null; bandChemistry?: number | null; healthScore?: number | null; fatigueScore?: number | null; readiness: ReadinessResult; crew?: CrewAssignmentInput[]; equipment?: EquipmentLoadoutInput[]; productionQuality?: ProductionQualityResult | null; soundcheckType?: SoundcheckType; preShowConsequences?: PreshowConsequence[]; setlist: LiveSetlistItem[]; }
export interface LiveBreakdownItem { key: string; label: string; modifier: number; explanation: string; }
export interface LiveSongResult { score: number; rating: LiveSongRating; technicalScore: number; performanceScore: number; audienceResponse: number; energyChange: number; satisfactionChange: number; staminaCost: number; momentumChange: number; incidents: string[]; highlights: string[]; breakdown: LiveBreakdownItem[]; }
export interface LiveIncident { incidentType: string; category: LiveIncidentCategory; severity: LiveIncidentSeverity; title: string; decisionType?: string; generationSnapshot: Record<string, unknown>; resultSnapshot: Record<string, unknown>; }
export interface TacticalDecisionOption { key: string; label: string; consequence: { crowdEnergy?: number; fanSatisfaction?: number; momentum?: number; bandStamina?: number; incidentRisk?: number; durationSeconds?: number }; safeFallback?: boolean; }
export interface TacticalDecision { decisionType: string; options: TacticalDecisionOption[]; deadlineSeconds: number; recommendedFallback: string; }

export const GIG_LIVE_SIMULATION_VERSION = 1;
export const DEFAULT_LIVE_GIG_CONFIG = { initialCrowdEnergy: 52, initialFanSatisfaction: 58, initialStamina: 86, initialMomentum: 0, introSeconds: 90, transitionSeconds: 45, encoreBreakSeconds: 120, outroSeconds: 90, energyDecayPerSegment: 1.2, momentumCap: 12, songPositionBonusCap: 8, staminaCostBase: 4, incidentBaseProbability: 0.055, positiveMomentProbability: 0.045, decisionWindowSeconds: 420, encoreEnergyThreshold: 66, encoreSatisfactionThreshold: 60, curfewWarningSeconds: 900, tacticalModifierCap: 12 } as const;

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const signedClamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));
const hash = (seed: string) => Array.from(seed).reduce((h, ch) => Math.imul(31, h) + ch.charCodeAt(0) | 0, 2166136261) >>> 0;
export const deterministicRandom = (seed: string) => (hash(seed) % 10000) / 10000;
const ratingFor = (score: number): LiveSongRating => score < 25 ? 'disaster' : score < 40 ? 'poor' : score < 58 ? 'average' : score < 72 ? 'good' : score < 86 ? 'great' : 'outstanding';

export function canStartLiveGig(ctx: GigLiveContext, now = new Date()) {
  const status = ctx.status ?? 'scheduled';
  const blockingIssues = ctx.readiness.blockingIssues ?? [];
  return !['completed', 'cancelled', 'failed'].includes(status) && new Date(ctx.scheduledAt) <= now && blockingIssues.length === 0 && ctx.setlist.length > 0;
}

export function buildInitialLiveSession(ctx: GigLiveContext, now = new Date()): LiveGigSessionState {
  const preshow = summarizePreshowPerformanceModifiers(ctx.preShowConsequences ?? []);
  const density = ctx.capacity ? ((ctx.ticketsSold ?? 0) / ctx.capacity) * 100 : 45;
  const stamina = clamp(DEFAULT_LIVE_GIG_CONFIG.initialStamina + ((ctx.healthScore ?? 75) - 70) * 0.18 - Math.max(0, 65 - (ctx.fatigueScore ?? 75)) * 0.32);
  const crowdEnergy = clamp(DEFAULT_LIVE_GIG_CONFIG.initialCrowdEnergy + density * 0.12 + (ctx.productionQuality?.audienceImpact ?? 0) * 0.18 + preshow.crowdEnergyModifier * 100);
  const fanSatisfaction = clamp(DEFAULT_LIVE_GIG_CONFIG.initialFanSatisfaction + ctx.readiness.score * 0.12 + (ctx.venueQuality ?? 55) * 0.06 + preshow.fanSatisfactionModifier * 100);
  const duration = buildLiveTimeline(ctx, now).reduce((sum, s) => sum + s.plannedDurationSeconds, 0);
  return { gigId: ctx.gigId, bandId: ctx.bandId, status: 'live', startedAt: now.toISOString(), expectedEndAt: new Date(now.getTime() + duration * 1000).toISOString(), currentSegmentIndex: 0, currentSongItemId: null, crowdEnergy: Math.round(crowdEnergy), fanSatisfaction: Math.round(fanSatisfaction), performanceQuality: 0, bandStamina: Math.round(stamina), momentum: 0, incidentRisk: Math.round(calculateIncidentRisk(ctx, stamina, 0)), simulationVersion: GIG_LIVE_SIMULATION_VERSION, lastProcessedAt: now.toISOString() };
}

export function buildLiveTimeline(ctx: GigLiveContext, startAt = new Date()): GigLiveSegment[] {
  const sorted = [...ctx.setlist].sort((a, b) => a.position - b.position);
  const segments: GigLiveSegment[] = [];
  let offset = 0, index = 0;
  const add = (segmentType: LiveSegmentType, duration: number, item?: LiveSetlistItem) => { segments.push({ segmentIndex: index++, segmentType, setlistItemId: item?.id ?? null, songId: item?.song.id ?? null, plannedStartAt: new Date(startAt.getTime() + offset * 1000).toISOString(), plannedDurationSeconds: Math.max(15, Math.round(duration)), status: 'pending' }); offset += Math.max(15, Math.round(duration)); };
  add('intro', DEFAULT_LIVE_GIG_CONFIG.introSeconds);
  sorted.forEach((item, idx) => { if (item.isEncore && (idx === 0 || !sorted[idx - 1].isEncore)) add('encore_break', DEFAULT_LIVE_GIG_CONFIG.encoreBreakSeconds); add(item.isEncore ? 'encore_song' : 'song', item.song.durationSeconds ?? 210, item); if (idx < sorted.length - 1) add('transition', DEFAULT_LIVE_GIG_CONFIG.transitionSeconds); });
  add('outro', DEFAULT_LIVE_GIG_CONFIG.outroSeconds);
  return segments;
}

function setlistPositionModifier(item: LiveSetlistItem, total: number, previous?: LiveSetlistItem) {
  const song = item.song; let modifier = 0; const notes: string[] = [];
  const quality = song.quality ?? 55, popularity = song.popularity ?? 45, tempo = song.tempo ?? 110, difficulty = song.difficulty ?? 50;
  if (item.position === 1) { modifier += (quality + popularity + (tempo >= 110 ? 8 : -6) - 110) * 0.08; notes.push('Opening slot rewards familiar, energetic songs.'); }
  if (item.position >= total - 1) { modifier += (quality + popularity - difficulty - 45) * 0.06; notes.push('Closing slot rewards strong, popular material.'); }
  if (item.isEncore) { modifier += popularity >= 65 ? 5 : -3; notes.push('Encore crowd expectation is applied.'); }
  if (previous && previous.song.genre && previous.song.genre === song.genre) { modifier -= 2.5; notes.push('Consecutive similar songs reduce variety.'); }
  if ((song.tags ?? []).some(t => /ballad|slow/i.test(t)) || tempo < 85) { modifier -= 1.5; notes.push('Lower-intensity songs trade energy for stamina control.'); }
  return { modifier: signedClamp(modifier, DEFAULT_LIVE_GIG_CONFIG.songPositionBonusCap), notes };
}

export function resolveLiveSong(ctx: GigLiveContext, session: LiveGigSessionState, item: LiveSetlistItem, position: number, seed: string): LiveSongResult {
  const crewAvg = (ctx.crew ?? []).length ? (ctx.crew ?? []).reduce((s, c) => s + calculateCrewEffectiveness(c), 0) / (ctx.crew ?? []).length : 45;
  const reliability = calculateEquipmentReliability(ctx.equipment ?? [], ctx.crew ?? []);
  const sound = SOUNDCHECK_TYPES[ctx.soundcheckType ?? 'none'];
  const preshow = summarizePreshowPerformanceModifiers(ctx.preShowConsequences ?? []);
  const song = item.song, total = ctx.setlist.length, previous = ctx.setlist.find(s => s.position === item.position - 1);
  const positionMod = setlistPositionModifier(item, total, previous);
  const staminaPenalty = Math.max(0, 55 - session.bandStamina) * 0.28;
  const crowdLift = signedClamp((session.crowdEnergy - 55) * 0.08, 4);
  const momentumLift = signedClamp(session.momentum * 0.18, 4);
  const venueFit = ((ctx.venueAcoustics ?? 55) - 55) * 0.07 + ((ctx.genreAffinity ?? 55) - 55) * 0.06;
  const boundedRandom = (deterministicRandom(`${seed}:${item.id}:song`) - 0.5) * 8;
  const familiarity = song.familiarity ?? song.rehearsalLevel ?? 45;
  const technicalScore = clamp((song.quality ?? 55) * 0.24 + familiarity * 0.2 + (ctx.performerSkill ?? 55) * 0.17 + reliability.quality * 0.12 + crewAvg * 0.08 + (ctx.venueAcoustics ?? 55) * 0.08 + sound.soundBenefit * 0.11 - staminaPenalty + preshow.soundQualityModifier * 45);
  const performanceScore = clamp(ctx.readiness.score * 0.22 + (ctx.bandChemistry ?? 55) * 0.14 + (ctx.stagePresence ?? ctx.performerSkill ?? 55) * 0.16 + (song.popularity ?? 45) * 0.11 + (ctx.productionQuality?.score ?? 55) * 0.09 + session.bandStamina * 0.08 + 50 * 0.08 + positionMod.modifier + crowdLift + momentumLift + preshow.performanceModifier * 100);
  const audienceResponse = clamp(performanceScore * 0.45 + technicalScore * 0.28 + (song.popularity ?? 45) * 0.17 + session.crowdEnergy * 0.10 + venueFit);
  const score = Math.round(clamp(technicalScore * 0.38 + performanceScore * 0.39 + audienceResponse * 0.23 + boundedRandom));
  const intensity = clamp(((song.tempo ?? 110) - 70) / 90 * 100) / 100;
  const staminaCost = Math.round(clamp(DEFAULT_LIVE_GIG_CONFIG.staminaCostBase + (song.durationSeconds ?? 210) / 90 + (song.difficulty ?? 50) / 22 + intensity * 3 - ((song.tags ?? []).some(t => /ballad|slow/i.test(t)) ? 2 : 0), 1, 18));
  const energyChange = Math.round(signedClamp((audienceResponse - 55) * 0.18 + positionMod.modifier * 0.35 - DEFAULT_LIVE_GIG_CONFIG.energyDecayPerSegment, 16));
  const satisfactionChange = Math.round(signedClamp((score - 58) * 0.12 + (technicalScore - 55) * 0.06 + (item.isEncore ? 3 : 0), 12));
  const momentumChange = Math.round(signedClamp((score - 55) * 0.11 + positionMod.modifier * 0.2, 8));
  const highlights = score >= 82 ? [`${song.title} became a standout live moment.`] : audienceResponse >= 78 ? [`The crowd lifted ${song.title}.`] : [];
  return { score, rating: ratingFor(score), technicalScore: Math.round(technicalScore), performanceScore: Math.round(performanceScore), audienceResponse: Math.round(audienceResponse), energyChange, satisfactionChange, staminaCost, momentumChange, incidents: [], highlights, breakdown: [ { key: 'readiness', label: 'Final readiness', modifier: Math.round(calculateReadinessPerformanceModifier(ctx.readiness.score) * 100), explanation: `Readiness score ${ctx.readiness.score} anchors the performance.` }, { key: 'familiarity', label: 'Song familiarity', modifier: Math.round(familiarity - 55), explanation: 'Saved setlist familiarity/rehearsal affects accuracy.' }, { key: 'equipment_crew', label: 'Equipment and crew', modifier: Math.round((reliability.score + crewAvg) / 2 - 55), explanation: 'Loadout reliability and crew effectiveness reduce mistakes.' }, { key: 'sound_production', label: 'Soundcheck and production', modifier: Math.round(sound.soundBenefit * 0.6 + ((ctx.productionQuality?.score ?? 55) - 55) * 0.12), explanation: 'Soundcheck and production quality shape technical/audience response.' }, { key: 'position', label: 'Setlist position', modifier: Math.round(positionMod.modifier), explanation: positionMod.notes.join(' ') || 'Neutral setlist position.' }, { key: 'live_state', label: 'Crowd, stamina and momentum', modifier: Math.round(crowdLift + momentumLift - staminaPenalty), explanation: 'Current live state modestly influences this song.' }, { key: 'bounded_randomness', label: 'Bounded live variance', modifier: Math.round(boundedRandom), explanation: 'Deterministic per-song variance prevents refresh rerolls.' } ] };
}

export function applySongResultToSession(session: LiveGigSessionState, result: LiveSongResult, item: LiveSetlistItem): LiveGigSessionState {
  return { ...session, currentSongItemId: item.id, crowdEnergy: Math.round(clamp(session.crowdEnergy + result.energyChange)), fanSatisfaction: Math.round(clamp(session.fanSatisfaction + result.satisfactionChange)), bandStamina: Math.round(clamp(session.bandStamina - result.staminaCost)), momentum: Math.round(signedClamp(session.momentum + result.momentumChange, DEFAULT_LIVE_GIG_CONFIG.momentumCap)), performanceQuality: Math.round(session.performanceQuality ? (session.performanceQuality + result.score) / 2 : result.score), incidentRisk: Math.round(clamp(session.incidentRisk + (result.score < 45 ? 4 : -2))) };
}

export function calculateIncidentRisk(ctx: GigLiveContext, stamina: number, momentum: number) {
  const reliability = calculateEquipmentReliability(ctx.equipment ?? [], ctx.crew ?? []);
  const crewAvg = (ctx.crew ?? []).length ? (ctx.crew ?? []).reduce((s, c) => s + calculateCrewEffectiveness(c), 0) / (ctx.crew ?? []).length : 45;
  return clamp(8 + reliability.failureRisk * 0.22 + Math.max(0, 55 - crewAvg) * 0.16 + (ctx.productionQuality?.setupRisk ?? 20) * 0.12 + Math.max(0, 45 - stamina) * 0.22 - Math.max(0, momentum) * 0.18 + (ctx.preShowConsequences ?? []).length * 2);
}

export function maybeGenerateLiveIncident(ctx: GigLiveContext, session: LiveGigSessionState, segment: GigLiveSegment, seed: string): LiveIncident | null {
  if (!['song', 'encore_song', 'transition'].includes(segment.segmentType)) return null;
  const risk = calculateIncidentRisk(ctx, session.bandStamina, session.momentum);
  const roll = deterministicRandom(`${seed}:${segment.segmentIndex}:incident`);
  const positiveRoll = deterministicRandom(`${seed}:${segment.segmentIndex}:positive`);
  if (positiveRoll < DEFAULT_LIVE_GIG_CONFIG.positiveMomentProbability + Math.max(0, session.momentum) / 900) return { incidentType: 'standout_moment', category: 'positive', severity: 'minor', title: 'Standout live moment', generationSnapshot: { roll: positiveRoll, momentum: session.momentum }, resultSnapshot: { crowdEnergy: 4, fanSatisfaction: 3, momentum: 3 } };
  if (roll > DEFAULT_LIVE_GIG_CONFIG.incidentBaseProbability + risk / 1000) return null;
  const hasSpare = (ctx.equipment ?? []).some(e => e.isSpare);
  const equipmentWeak = calculateEquipmentReliability(ctx.equipment ?? [], ctx.crew ?? []).score < 62;
  const productionComplex = (ctx.productionQuality?.setupRisk ?? 0) > 45;
  const severe = risk > 55 && deterministicRandom(`${seed}:${segment.segmentIndex}:severity`) < 0.08;
  if (equipmentWeak) return { incidentType: 'equipment_fault', category: 'equipment', severity: severe ? 'major' : 'moderate', title: hasSpare ? 'Equipment fault with spare available' : 'Equipment fault threatens the set', decisionType: 'equipment_response', generationSnapshot: { risk, equipmentWeak, hasSpare }, resultSnapshot: { incidentRisk: 6, momentum: -4 } };
  if (productionComplex) return { incidentType: 'production_cue_failure', category: 'production', severity: severe ? 'major' : 'minor', title: 'Production cue misfires', decisionType: 'production_response', generationSnapshot: { risk, setupRisk: ctx.productionQuality?.setupRisk }, resultSnapshot: { crowdEnergy: -3, fanSatisfaction: -2 } };
  if (session.crowdEnergy < 34) return { incidentType: 'crowd_goes_flat', category: 'crowd', severity: 'minor', title: 'Crowd energy drops', decisionType: 'crowd_response', generationSnapshot: { risk, crowdEnergy: session.crowdEnergy }, resultSnapshot: { momentum: -3 } };
  return { incidentType: 'missed_cue', category: 'performance', severity: severe ? 'major' : 'minor', title: 'Missed cue on stage', decisionType: 'performance_response', generationSnapshot: { risk, stamina: session.bandStamina }, resultSnapshot: { performanceQuality: -3, momentum: -2 } };
}

export function buildTacticalDecision(incident: LiveIncident, policy: LiveDecisionPolicy = 'balanced'): TacticalDecision | null {
  if (!incident.decisionType) return null;
  const common = { deadlineSeconds: DEFAULT_LIVE_GIG_CONFIG.decisionWindowSeconds, decisionType: incident.decisionType };
  if (incident.decisionType === 'equipment_response') return { ...common, recommendedFallback: policy === 'protect_finances' ? 'technician_repair' : 'use_spare', options: [ { key: 'use_spare', label: 'Use spare equipment', safeFallback: true, consequence: { momentum: 1, incidentRisk: -7, durationSeconds: 60 } }, { key: 'technician_repair', label: 'Let technician repair it', consequence: { fanSatisfaction: -1, incidentRisk: -4, durationSeconds: 180 } }, { key: 'push_through', label: 'Push through carefully', consequence: { crowdEnergy: -3, momentum: -3, incidentRisk: 4 } } ] };
  if (incident.decisionType === 'crowd_response') return { ...common, recommendedFallback: 'address_crowd', options: [ { key: 'address_crowd', label: 'Address the crowd', safeFallback: true, consequence: { crowdEnergy: 5, fanSatisfaction: 2, momentum: 2, durationSeconds: 90 } }, { key: 'move_favourite', label: 'Move a favourite earlier', consequence: { crowdEnergy: 8, momentum: 3 } }, { key: 'shorten_banter', label: 'Shorten banter', consequence: { crowdEnergy: 2, durationSeconds: -60 } } ] };
  return { ...common, recommendedFallback: 'safe_recovery', options: [ { key: 'safe_recovery', label: 'Take a brief recovery beat', safeFallback: true, consequence: { bandStamina: 4, momentum: 1, durationSeconds: 60 } }, { key: 'push_through', label: 'Push through', consequence: { crowdEnergy: 2, bandStamina: -5, momentum: -1 } }, { key: 'reduce_complexity', label: 'Reduce production complexity', consequence: { incidentRisk: -5, fanSatisfaction: -1 } } ] };
}

export function applyTacticalConsequence(session: LiveGigSessionState, option: TacticalDecisionOption): LiveGigSessionState {
  const cap = DEFAULT_LIVE_GIG_CONFIG.tacticalModifierCap;
  return { ...session, crowdEnergy: Math.round(clamp(session.crowdEnergy + signedClamp(option.consequence.crowdEnergy ?? 0, cap))), fanSatisfaction: Math.round(clamp(session.fanSatisfaction + signedClamp(option.consequence.fanSatisfaction ?? 0, cap))), momentum: Math.round(signedClamp(session.momentum + signedClamp(option.consequence.momentum ?? 0, cap), DEFAULT_LIVE_GIG_CONFIG.momentumCap)), bandStamina: Math.round(clamp(session.bandStamina + signedClamp(option.consequence.bandStamina ?? 0, cap))), incidentRisk: Math.round(clamp(session.incidentRisk + signedClamp(option.consequence.incidentRisk ?? 0, cap))) };
}

export function canApplyLiveSetlistChange(segments: GigLiveSegment[], targetSegmentIndex: number, change: 'skip' | 'swap' | 'replace' | 'encore_toggle') {
  const target = segments.find(s => s.segmentIndex === targetSegmentIndex);
  if (!target) return { allowed: false, reason: 'Segment not found.' };
  if (target.status !== 'pending') return { allowed: false, reason: 'Already performed or active segments are immutable.' };
  if (!['song', 'encore_song'].includes(target.segmentType)) return { allowed: false, reason: 'Only unperformed song segments can be changed.' };
  return { allowed: true, reason: `${change} can be applied transactionally to an upcoming song.` };
}

export function evaluateEncore(session: LiveGigSessionState, remainingEncoreSongs: number, secondsToCurfew?: number | null) {
  const curfewAllows = secondsToCurfew == null || secondsToCurfew > DEFAULT_LIVE_GIG_CONFIG.curfewWarningSeconds;
  const demand = session.crowdEnergy >= DEFAULT_LIVE_GIG_CONFIG.encoreEnergyThreshold && session.fanSatisfaction >= DEFAULT_LIVE_GIG_CONFIG.encoreSatisfactionThreshold;
  const staminaAllows = session.bandStamina >= 28;
  const allowed = remainingEncoreSongs > 0 && curfewAllows && demand && staminaAllows;
  return { allowed, outcome: allowed ? 'planned_encore_available' : !demand ? 'no_encore_requested' : !curfewAllows ? 'curfew_blocks_encore' : !staminaAllows ? 'band_too_exhausted' : 'no_valid_encore_song' };
}

export function finalizeLiveGig(session: LiveGigSessionState, songResults: LiveSongResult[], incidents: LiveIncident[]) {
  const avg = songResults.length ? songResults.reduce((s, r) => s + r.score, 0) / songResults.length : session.performanceQuality;
  const peak = songResults.length ? Math.max(...songResults.map(r => r.score)) : avg;
  const incidentPenalty = incidents.filter(i => i.category !== 'positive').length * 2;
  const positiveLift = incidents.filter(i => i.category === 'positive').length * 2;
  const finalQuality = Math.round(clamp(avg * 0.72 + peak * 0.12 + session.momentum * 0.35 + positiveLift - incidentPenalty));
  const finalSatisfaction = Math.round(clamp(session.fanSatisfaction + (finalQuality - 60) * 0.12 + positiveLift - incidentPenalty));
  return { finalQuality, finalSatisfaction, finalCrowdEnergy: session.crowdEnergy, songsPerformed: songResults.length, averageSongScore: Math.round(avg), peakSongScore: Math.round(peak), incidents: incidents.length, rating: ratingFor(finalQuality), rewardsIdempotencyKey: `${session.gigId}:live-gig:${session.simulationVersion}:completion`, financeIdempotencyKey: `${session.gigId}:live-gig:${session.simulationVersion}:finance` };
}
