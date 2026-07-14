import type { GigLiveSegment, LiveGigSessionState, LiveIncident, LiveSegmentType, LiveSongResult, TacticalDecision } from './gigLive';

export type LivePresentationScene = 'intro' | 'song' | 'transition' | 'incident' | 'decision' | 'encore' | 'outro';
export type CrowdPresentationState = 'sparse' | 'waiting' | 'bored' | 'passive' | 'swaying' | 'engaged' | 'clapping' | 'hands_raised' | 'jumping' | 'singing' | 'wild' | 'ecstatic' | 'disappointed' | 'leaving_early';
export type LightingPresentationState = 'house_lights' | 'basic_wash' | 'warm_wash' | 'cool_wash' | 'spotlights' | 'pulsing' | 'dramatic_silhouette' | 'encore_lighting' | 'finale_lighting' | 'failure_state';
export type VenuePresentationTier = 'small_bar' | 'local_club' | 'theatre' | 'music_hall' | 'large_venue' | 'arena' | 'stadium' | 'festival_stage';
export type StageLayoutKey = 'solo' | 'duo' | 'three_piece' | 'four_piece' | 'five_piece' | 'six_plus' | 'festival_stage' | 'small_club';
export type PerformerVisualState = 'waiting' | 'performing' | 'energetic' | 'focused' | 'struggling' | 'recovering' | 'celebrating' | 'incident_affected' | 'standout_performance' | 'absent';

export interface LiveGigPerformerInput { id: string; name: string; role?: string | null; instrument?: string | null; isLead?: boolean | null; stamina?: number | null; available?: boolean | null; avatarUrl?: string | null; portraitUrl?: string | null; stagePosition?: { x: number; y: number } | null; }
export interface LiveGigVenueInput { name?: string | null; capacity?: number | null; venueType?: string | null; isOutdoor?: boolean | null; stageSize?: string | null; quality?: number | null; productionCapability?: number | null; isFestival?: boolean | null; attendance?: number | null; }
export interface LiveGigProductionInput { lightingPackage?: string | null; effects?: string[] | null; disabledEffects?: string[] | null; productionQuality?: number | null; soundQuality?: number | null; }
export interface LiveGigSongPresentationInput { id?: string | null; title?: string | null; genre?: string | null; tempo?: number | null; mood?: string | null; popularity?: number | null; quality?: number | null; durationSeconds?: number | null; position?: number | null; isEncore?: boolean | null; }
export interface BuildLiveGigPresentationInput { session: LiveGigSessionState; segments: GigLiveSegment[]; songResults?: Array<LiveSongResult & { segmentIndex: number; title?: string; song?: LiveGigSongPresentationInput }>; incidents?: LiveIncident[]; activeDecision?: TacticalDecision | null; venue?: LiveGigVenueInput | null; production?: LiveGigProductionInput | null; performers?: LiveGigPerformerInput[]; currentSong?: LiveGigSongPresentationInput | null; canManage?: boolean; reducedMotion?: boolean; dataOnly?: boolean; }

export interface PerformerPresentationState extends LiveGigPerformerInput { visualState: PerformerVisualState; x: number; y: number; instrumentLabel: string; representation: 'full_body_avatar' | 'portrait_avatar' | 'role_silhouette' | 'generic_fallback'; focusReason?: string; }
export interface LiveGigPresentationState { scene: LivePresentationScene; intensity: number; crowdState: CrowdPresentationState; crowdDensity: number; venueTier: VenuePresentationTier; stageLayout: StageLayoutKey; lightingState: LightingPresentationState; productionState: string; performerStates: PerformerPresentationState[]; activeEffects: string[]; headline: string; commentary: string[]; currentSongProfile: { title: string; phase: string; genre: string; tempoLabel: string; moodLabel: string; isCrowdFavourite: boolean; performanceLabel: string; }; accessibilitySummary: string; }

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export function mapLiveSegmentToScene(type?: LiveSegmentType, hasDecision = false, hasIncident = false): LivePresentationScene {
  if (hasDecision) return 'decision';
  if (hasIncident || type === 'incident') return 'incident';
  if (type === 'encore_break' || type === 'encore_song') return 'encore';
  if (type === 'song') return 'song';
  if (type === 'intro' || !type) return 'intro';
  if (type === 'outro') return 'outro';
  return 'transition';
}

export function mapCrowdEnergyToPresentation(energy: number, attendance = 0, capacity = 0, incident?: LiveIncident | null): CrowdPresentationState {
  const sellThrough = capacity > 0 ? attendance / capacity : 0.5;
  if (incident?.category === 'crowd' && incident.severity !== 'minor') return 'disappointed';
  if (sellThrough < 0.15) return energy < 35 ? 'sparse' : 'passive';
  if (energy < 20) return 'leaving_early';
  if (energy < 32) return 'bored';
  if (energy < 45) return 'passive';
  if (energy < 56) return 'swaying';
  if (energy < 66) return 'engaged';
  if (energy < 76) return 'clapping';
  if (energy < 84) return 'hands_raised';
  if (energy < 92) return 'wild';
  return 'ecstatic';
}

export function mapVenueToTier(venue?: LiveGigVenueInput | null): VenuePresentationTier {
  if (venue?.isFestival || /festival/i.test(venue?.venueType ?? '')) return 'festival_stage';
  const capacity = venue?.capacity ?? 120;
  if (capacity <= 120) return 'small_bar';
  if (capacity <= 450) return 'local_club';
  if (capacity <= 1000) return 'theatre';
  if (capacity <= 2500) return 'music_hall';
  if (capacity <= 8000) return 'large_venue';
  if (capacity <= 22000) return 'arena';
  return 'stadium';
}

export function calculateCrowdDensity(attendance = 0, capacity = 0): number {
  if (capacity <= 0) return 45;
  return Math.round(clamp((attendance / capacity) * 100, 4, 96));
}

export function buildStageLayout(performers: LiveGigPerformerInput[], venue?: LiveGigVenueInput | null): StageLayoutKey {
  if (venue?.isFestival || /festival/i.test(venue?.venueType ?? '')) return 'festival_stage';
  if ((venue?.capacity ?? 999) <= 180) return 'small_club';
  if (performers.length <= 1) return 'solo';
  if (performers.length === 2) return 'duo';
  if (performers.length === 3) return 'three_piece';
  if (performers.length === 4) return 'four_piece';
  if (performers.length === 5) return 'five_piece';
  return 'six_plus';
}

function positionFor(performer: LiveGigPerformerInput, index: number, total: number): { x: number; y: number } {
  if (performer.stagePosition) return performer.stagePosition;
  const role = `${performer.role ?? ''} ${performer.instrument ?? ''}`.toLowerCase();
  if (performer.isLead || /lead|vocal|singer|front/.test(role)) return { x: 50, y: 70 };
  if (/drum|percussion/.test(role)) return { x: 50, y: 32 };
  if (/bass/.test(role)) return { x: 72, y: 58 };
  if (/guitar/.test(role)) return { x: index % 2 ? 28 : 68, y: 60 };
  if (/key|synth|piano|turntable|dj/.test(role)) return { x: 18 + (index % 2) * 64, y: 44 };
  const spread = total <= 1 ? 0 : (index / (total - 1)) * 64;
  return { x: 18 + spread, y: index % 2 ? 54 : 64 };
}

export function buildPerformerPresentation(performers: LiveGigPerformerInput[], session: LiveGigSessionState, incidents: LiveIncident[] = []): PerformerPresentationState[] {
  const activeIncident = incidents.find((i) => i.category !== 'positive');
  return performers.map((performer, index) => {
    const stamina = performer.stamina ?? session.bandStamina;
    const roleText = `${performer.role ?? ''} ${performer.instrument ?? ''}`.toLowerCase();
    const affected = activeIncident && (activeIncident.category === 'performance' || (activeIncident.category === 'equipment' && /guitar|bass|key|drum|mic|vocal/.test(roleText)));
    const pos = positionFor(performer, index, performers.length);
    const representation = performer.avatarUrl ? 'full_body_avatar' : performer.portraitUrl ? 'portrait_avatar' : performer.role || performer.instrument ? 'role_silhouette' : 'generic_fallback';
    return { ...performer, ...pos, instrumentLabel: instrumentLabel(performer.instrument ?? performer.role), representation, visualState: performer.available === false ? 'absent' : affected ? 'incident_affected' : stamina < 28 ? 'struggling' : session.momentum >= 7 ? 'standout_performance' : session.crowdEnergy >= 78 ? 'energetic' : session.status === 'paused_for_decision' ? 'recovering' : 'performing', focusReason: affected ? activeIncident.title : session.momentum >= 7 ? 'Momentum is carrying this performer.' : undefined };
  });
}

function instrumentLabel(value?: string | null) { const v = (value ?? '').toLowerCase(); if (/drum/.test(v)) return 'Drum kit'; if (/bass/.test(v)) return 'Bass'; if (/acoustic/.test(v)) return 'Acoustic guitar'; if (/guitar/.test(v)) return 'Electric guitar'; if (/key|piano|synth/.test(v)) return 'Keyboard'; if (/turntable|dj/.test(v)) return 'Turntables'; if (/vocal|sing|mic/.test(v)) return 'Microphone'; return value || 'Live rig'; }

export function mapLightingState(input: BuildLiveGigPresentationInput, scene: LivePresentationScene): LightingPresentationState {
  if (input.incidents?.some((i) => i.category === 'production' && /light|cue|production/i.test(i.incidentType))) return 'failure_state';
  if (scene === 'outro') return 'finale_lighting';
  if (scene === 'encore') return 'encore_lighting';
  if (scene === 'intro' || scene === 'transition') return 'house_lights';
  const pkg = input.production?.lightingPackage?.toLowerCase() ?? '';
  const song = input.currentSong;
  if ((song?.tempo ?? 0) < 85 || /ballad|slow|intimate/i.test(song?.mood ?? song?.genre ?? '')) return 'spotlights';
  if (/dramatic|silhouette/.test(pkg)) return 'dramatic_silhouette';
  if (/cool|led|projection/.test(pkg)) return 'cool_wash';
  if (/warm/.test(pkg)) return 'warm_wash';
  if ((input.session.crowdEnergy + input.session.momentum) > 80) return input.reducedMotion ? 'spotlights' : 'pulsing';
  return 'basic_wash';
}

export function mapProductionPlanToVisualEffects(production?: LiveGigProductionInput | null, incidents: LiveIncident[] = [], scene: LivePresentationScene = 'song', reducedMotion = false): string[] {
  if (scene === 'intro' || scene === 'transition') return [];
  const disabled = new Set([...(production?.disabledEffects ?? []), ...incidents.filter((i) => i.category === 'production').map((i) => i.incidentType)]);
  return (production?.effects ?? []).filter((effect) => !disabled.has(effect)).filter((effect) => !(reducedMotion && /pyro|confetti|strobe|burst/i.test(effect))).slice(0, 5);
}

export function buildSongPresentationProfile(song?: LiveGigSongPresentationInput | null, result?: LiveSongResult) {
  const tempo = song?.tempo ?? 110;
  const isBallad = tempo < 85 || /ballad|slow|intimate/i.test(`${song?.mood ?? ''} ${song?.genre ?? ''}`);
  return { title: song?.title ?? 'Current segment', phase: result ? `Resolved: ${result.rating}` : song?.isEncore ? 'Encore performance' : 'Live performance', genre: song?.genre ?? 'Unknown genre', tempoLabel: isBallad ? 'Slow / ballad' : tempo >= 140 ? 'Fast' : tempo >= 110 ? 'Up-tempo' : 'Mid-tempo', moodLabel: song?.mood ?? (isBallad ? 'Focused' : 'High energy'), isCrowdFavourite: (song?.popularity ?? 0) >= 70, performanceLabel: result ? `${result.score}/100 · ${result.rating}` : 'Awaiting server result' };
}

export function buildLiveGigPresentationState(input: BuildLiveGigPresentationInput): LiveGigPresentationState {
  const current = input.segments.find((s) => s.segmentIndex === input.session.currentSegmentIndex) ?? input.segments.find((s) => s.status === 'active') ?? input.segments[0];
  const unresolvedIncident = input.incidents?.find((i) => i.category !== 'positive');
  const scene = mapLiveSegmentToScene(current?.segmentType, !!input.activeDecision, !!unresolvedIncident);
  const result = input.songResults?.find((r) => r.segmentIndex === current?.segmentIndex);
  const venueTier = mapVenueToTier(input.venue);
  const crowdDensity = calculateCrowdDensity(input.venue?.attendance ?? 0, input.venue?.capacity ?? 0);
  const crowdState = mapCrowdEnergyToPresentation(input.session.crowdEnergy, input.venue?.attendance, input.venue?.capacity, unresolvedIncident);
  const lightingState = mapLightingState(input, scene);
  const activeEffects = mapProductionPlanToVisualEffects(input.production, input.incidents, scene, !!input.reducedMotion || !!input.dataOnly);
  const songProfile = buildSongPresentationProfile(input.currentSong, result);
  const intensity = input.dataOnly ? 0 : Math.round(clamp(input.session.crowdEnergy * 0.45 + Math.max(0, input.session.momentum) * 3 + (input.currentSong?.tempo ?? 100) * 0.18 + (result?.audienceResponse ?? 50) * 0.25));
  const performers = buildPerformerPresentation(input.performers ?? [], input.session, input.incidents);
  const headline = input.activeDecision ? 'Tactical decision available' : scene === 'outro' ? 'The show is wrapping up' : `${songProfile.title} · ${crowdState.split('_').join(' ')} crowd`;
  const commentary = [ `${input.venue?.name ?? 'The venue'} is presented as ${venueTier.split('_').join(' ')} with ${crowdDensity}% visible density.`, `Lighting: ${lightingState.split('_').join(' ')}. Effects: ${activeEffects.length ? activeEffects.join(', ') : 'none active'}.`, ...(result?.highlights ?? []), ...(input.incidents ?? []).slice(-2).map((i) => i.title), ...(input.activeDecision ? [`Decision fallback: ${input.activeDecision.recommendedFallback.split('_').join(' ')}.`] : []) ];
  return { scene, intensity, crowdState, crowdDensity, venueTier, stageLayout: buildStageLayout(input.performers ?? [], input.venue), lightingState, productionState: activeEffects.length ? 'effects_active' : 'clean_stage', performerStates: performers, activeEffects, headline, commentary, currentSongProfile: songProfile, accessibilitySummary: `${headline}. Crowd energy ${input.session.crowdEnergy}, fan satisfaction ${input.session.fanSatisfaction}, band stamina ${input.session.bandStamina}, momentum ${input.session.momentum}.` };
}
