import { stageAssignment } from '@/features/gig-demo-3d/instrumentCatalog';
import type { GigViewerReplay } from '../../events/types';
import type { GigExperienceDTO } from '../../types';
import { buildPerformerPlan, reconstructPerformerState, type PerformerPlan, type PresentationRole } from '../engine/PerformerLifecycle';
import type { DerivedPlaybackState } from '../engine/PlaybackController';
import { replayResultAttendance, resolvePresentationAttendance } from '../engine/AuthoritativeMetric';
import type { ConcertFrame, ConcertOptions, ConcertVenue, StageRole } from '@/features/gig-demo-3d/liveTypes';
import { resolveVenueProfile, stagePosition, type VenueProfile } from '@/features/gig-demo-3d/venueProfile';
import { resolveTotpStudioStageGeometry } from '@/features/gig-demo-3d/totpStudioGeometry';
import { defaultAppearance, type PlayerAppearance } from '@/features/player-model/appearance';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { CrowdTuningOptions } from '../engine/CrowdTuning';
import type { TotpStageKey } from '@/features/top-of-the-pops/broadcastProfile';

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const roleMap: Record<PresentationRole, StageRole> = { vocalist: 'vocals', backing_vocals: 'vocals', lead_guitar: 'guitar', rhythm_guitar: 'guitar', guitar: 'guitar', bass: 'bass', drums: 'drums', keyboard: 'keyboard', piano: 'keyboard', dj: 'dj', electronic: 'dj', percussion: 'percussion', strings: 'strings', brass: 'brass', woodwind: 'woodwind', other: 'other', unknown: 'other' };

export type ConcertPresentationMode = 'gig' | 'totp';

type TotpStageMark = { u: number; v: number };

export function totpSafeStageMark(stage: TotpStageKey, venue: VenueProfile, mark: TotpStageMark): TotpStageMark {
  const footprint = resolveTotpStudioStageGeometry(stage, venue);
  return {
    u: clamp(mark.u, footprint.minU, footprint.maxU),
    v: clamp(mark.v, footprint.minV, footprint.maxV),
  };
}

export function totpStageWorldPosition(stage: TotpStageKey, venue: VenueProfile, mark: TotpStageMark, role?: PresentationRole): [number, number, number] {
  const footprint = resolveTotpStudioStageGeometry(stage, venue);
  const safe = totpSafeStageMark(stage, venue, mark);
  const x = footprint.centerX + (safe.u - .5) * footprint.safeWidth;
  const z = footprint.centerZ + (safe.v - footprint.centerV) * footprint.safeDepth;
  const roleLift = role === 'drums' && stage !== 'studio_floor' ? .18 : 0;
  return [x, footprint.floorY + roleLift, z];
}

function totpPreferredMarks(role: PresentationRole, instrument: string | null): TotpStageMark[] {
  const text = (instrument ?? '').toLowerCase();
  const singsLead = /lead\s+(vocals?|singer)|lead\s+vocalist|frontperson|front\s+(man|woman)/.test(text);

  if (singsLead) return [
    { u: .50, v: .78 },
    { u: .41, v: .72 },
    { u: .59, v: .72 },
  ];

  switch (role) {
    case 'vocalist': return [{ u: .50, v: .78 }, { u: .41, v: .72 }, { u: .59, v: .72 }];
    case 'lead_guitar':
    case 'rhythm_guitar':
    case 'guitar': return [
      { u: .34, v: .64 },
      { u: .66, v: .64 },
      { u: .40, v: .57 },
      { u: .60, v: .57 },
    ];
    case 'bass': return [{ u: .68, v: .57 }, { u: .32, v: .57 }];
    case 'drums': return [{ u: .50, v: .28 }, { u: .62, v: .30 }];
    case 'keyboard':
    case 'piano': return [{ u: .34, v: .40 }, { u: .66, v: .40 }];
    case 'dj':
    case 'electronic': return [{ u: .62, v: .38 }, { u: .38, v: .38 }];
    case 'backing_vocals': return [{ u: .40, v: .64 }, { u: .60, v: .64 }];
    case 'percussion': return [{ u: .38, v: .35 }, { u: .62, v: .35 }];
    case 'brass':
    case 'woodwind':
    case 'strings': return [{ u: .34, v: .46 }, { u: .66, v: .46 }, { u: .41, v: .49 }, { u: .59, v: .49 }];
    default: return [{ u: .38, v: .52 }, { u: .62, v: .52 }, { u: .50, v: .48 }];
  }
}

type TotpPerformerFootprint = { u: number; v: number };

function totpPerformerFootprint(role: PresentationRole, instrument?: string | null): TotpPerformerFootprint {
  const text = (instrument ?? '').toLowerCase();
  if (role === 'drums' || /drums?|drummer|drum kit/.test(text)) return { u: .17, v: .23 };
  if (role === 'keyboard' || role === 'piano' || role === 'electronic') return { u: .16, v: .17 };
  if (role === 'guitar' || role === 'lead_guitar' || role === 'rhythm_guitar' || role === 'bass') return { u: .14, v: .14 };
  if (role === 'percussion') return { u: .14, v: .16 };
  if (role === 'vocalist') return { u: .115, v: .12 };
  return { u: .12, v: .125 };
}

function stableTotpLayoutSeed(value: unknown): number {
  const text = String(value ?? '0');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function totpLayoutVariantMark(
  mark: TotpStageMark,
  role: PresentationRole,
  variantSeed: number,
): TotpStageMark {
  const variant = Math.abs(variantSeed) % 4;
  const anchoredCentre = role === 'vocalist' || role === 'drums';
  let u = mark.u;
  let v = mark.v;

  if (variant === 1 && !anchoredCentre) {
    // Mirror the side-line while keeping the frontperson and drummer anchored.
    u = 1 - u;
  } else if (variant === 2 && !anchoredCentre) {
    // A wider, slightly diagonal TV formation.
    const side = u < .5 ? -1 : 1;
    u = .5 + (u - .5) * 1.10;
    v += side * .022;
  } else if (variant === 3) {
    // A tighter asymmetric setup: useful for a different camera read without
    // moving fixed rigs into unsafe scenery.
    if (!anchoredCentre) {
      u = 1 - u;
      v += u < .5 ? .028 : -.018;
    } else if (role === 'vocalist') {
      v -= .018;
    }
  }

  return {
    u: clamp(u, .22, .78),
    v: clamp(v, .24, .84),
  };
}

export function totpFormation(plan: PerformerPlan, variantSeed = 0): Map<string, TotpStageMark> {
  const assigned = new Map<string, TotpStageMark>();
  const used: Array<{ mark: TotpStageMark; footprint: TotpPerformerFootprint }> = [];

  const ranked = [...plan.entities].sort((a, b) => {
    const aLead = /lead\s+(vocals?|singer)|frontperson/i.test(a.instrument ?? '') ? -10 : 0;
    const bLead = /lead\s+(vocals?|singer)|frontperson/i.test(b.instrument ?? '') ? -10 : 0;
    const roleRank: Record<PresentationRole, number> = {
      vocalist: 0, lead_guitar: 1, rhythm_guitar: 2, guitar: 3, bass: 4, drums: 5,
      keyboard: 6, piano: 6, dj: 7, electronic: 7, backing_vocals: 8,
      percussion: 9, strings: 10, brass: 10, woodwind: 10, other: 11, unknown: 12,
    };
    return (aLead + roleRank[a.role]) - (bLead + roleRank[b.role]) || a.id.localeCompare(b.id);
  });

  for (const entity of ranked) {
    const preferredBase = totpPreferredMarks(entity.role, entity.instrument);
    const entitySeed = stableTotpLayoutSeed(`${variantSeed}:${entity.id}`);
    const rotation = preferredBase.length ? entitySeed % preferredBase.length : 0;
    const preferred = preferredBase
      .map((_, index) => preferredBase[(index + rotation) % preferredBase.length])
      .map((mark) => totpLayoutVariantMark(mark, entity.role, variantSeed));
    const footprint = totpPerformerFootprint(entity.role, entity.instrument);
    const fallbackCandidates = [
      { u: .34, v: .58 }, { u: .66, v: .58 },
      { u: .37, v: .44 }, { u: .63, v: .44 },
      { u: .42, v: .36 }, { u: .58, v: .36 },
      { u: .50, v: .50 },
    ].map((mark) => totpLayoutVariantMark(mark, entity.role, variantSeed));
    const candidates = [...preferred, ...fallbackCandidates];
    const clearanceScore = (candidate: TotpStageMark) => {
      if (!used.length) return 99;
      return Math.min(...used.map((other) => {
        const requiredU = footprint.u + other.footprint.u;
        const requiredV = footprint.v + other.footprint.v;
        const du = Math.abs(candidate.u - other.mark.u) / requiredU;
        const dv = Math.abs(candidate.v - other.mark.v) / requiredV;
        return Math.hypot(du, dv);
      }));
    };
    const chosen = candidates.find((candidate) => clearanceScore(candidate) >= 1)
      ?? candidates.reduce((best, candidate) => clearanceScore(candidate) > clearanceScore(best) ? candidate : best, candidates[0]);

    assigned.set(entity.id, chosen);
    used.push({ mark: chosen, footprint });
  }

  return assigned;
}

type TotpChoreographyState = { mark: TotpStageMark; walking: boolean };

function lerpMark(a: TotpStageMark, b: TotpStageMark, amount: number): TotpStageMark {
  const t = clamp(amount);
  return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t };
}

function smoothStep(amount: number): number {
  const t = clamp(amount);
  return t * t * (3 - 2 * t);
}

export function totpChoreographyState(
  role: PresentationRole,
  instrument: string | null,
  home: TotpStageMark,
  positionMs: number,
  idlePhase = 0,
  performing = false,
): TotpChoreographyState {
  if (!performing) return { mark: home, walking: false };

  const text = (instrument ?? '').toLowerCase();
  const singsLead = /lead\s+(vocals?|singer)|lead\s+vocalist|frontperson|front\s+(man|woman)/.test(text) || role === 'vocalist';
  const singsWhilePlaying = singsLead && /(guitar|bass|ukulele|banjo|mandolin|keytar)/.test(text);

  // Singer-instrumentalists stay planted on their stand mic. Their expressive
  // motion is handled by the skeleton/torso animation rather than root travel.
  if (singsLead && singsWhilePlaying) return { mark: home, walking: false };

  const outward = home.u < .5 ? -1 : 1;
  let away = home;
  if (singsLead) {
    // Keep a roaming lead on the centre lane so they never cut across guitar/bass
    // players during a camera change.
    away = { u: home.u, v: clamp(home.v - .065, .69, .86) };
  } else if (['lead_guitar','rhythm_guitar','guitar'].includes(role)) {
    away = { u: clamp(home.u + outward * .055, .22, .78), v: clamp(home.v - .025, .48, .72) };
  } else if (role === 'bass') {
    away = { u: clamp(home.u + outward * .045, .22, .78), v: clamp(home.v + .02, .44, .64) };
  } else {
    return { mark: home, walking: false };
  }

  // Each role runs a deterministic stage route: hold at home, walk to a second
  // mark, plant and perform there, then walk back. No continuous drifting.
  const cycleMs = singsLead ? 16_000 : role === 'bass' ? 20_000 : 18_000;
  const phaseOffset = Math.abs(idlePhase % 1) * cycleMs * .34;
  const cycle = (positionMs + phaseOffset) % cycleMs;
  const holdHomeEnd = cycleMs * .34;
  const walkOutEnd = cycleMs * .48;
  const holdAwayEnd = cycleMs * .78;
  const walkHomeEnd = cycleMs * .92;

  if (cycle < holdHomeEnd) return { mark: home, walking: false };
  if (cycle < walkOutEnd) {
    const progress = smoothStep((cycle - holdHomeEnd) / (walkOutEnd - holdHomeEnd));
    return { mark: lerpMark(home, away, progress), walking: true };
  }
  if (cycle < holdAwayEnd) return { mark: away, walking: false };
  if (cycle < walkHomeEnd) {
    const progress = smoothStep((cycle - holdAwayEnd) / (walkHomeEnd - holdAwayEnd));
    return { mark: lerpMark(away, home, progress), walking: true };
  }
  return { mark: home, walking: false };
}

export function totpLiveMarks(
  plan: PerformerPlan,
  positionMs: number,
  performing: boolean,
  variantSeed = 0,
): Map<string, TotpStageMark> {
  const formation = totpFormation(plan, variantSeed);
  const states = plan.entities.map((entity) => {
    const home = formation.get(entity.id) ?? { u: .5, v: .55 };
    const choreography = totpChoreographyState(entity.role, entity.instrument, home, positionMs, entity.idlePhase ?? 0, performing);
    const assignment = stageAssignment(entity.instrument, roleMap[entity.role]);
    const text = (entity.instrument ?? '').toLowerCase();
    const micLocked = /lead\s+(vocals?|singer)|lead\s+vocalist|frontperson|front\s+(man|woman)/.test(text)
      && /(guitar|bass|ukulele|banjo|mandolin|keytar)/.test(text);
    return {
      entity,
      mark: { ...choreography.mark },
      footprint: totpPerformerFootprint(entity.role, entity.instrument),
      fixed: assignment.stationary || micLocked,
    };
  });

  // Resolve residual occupied-volume overlaps caused by live choreography.
  // Fixed rigs (drums/keys) and singer-at-stand-mic positions stay anchored;
  // movable players absorb the separation instead.
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        const a = states[i], b = states[j];
        const requiredU = a.footprint.u + b.footprint.u;
        const requiredV = a.footprint.v + b.footprint.v;
        let du = a.mark.u - b.mark.u;
        let dv = a.mark.v - b.mark.v;
        const normalized = Math.hypot(du / requiredU, dv / requiredV);
        if (normalized >= 1) continue;

        if (Math.abs(du) + Math.abs(dv) < .001) {
          du = a.entity.id.localeCompare(b.entity.id) <= 0 ? -.01 : .01;
          dv = .006;
        }
        const length = Math.hypot(du / requiredU, dv / requiredV) || 1;
        const push = (1 - length) * .52;
        const pushU = (du / Math.max(.001, Math.abs(du) + Math.abs(dv))) * requiredU * push;
        const pushV = (dv / Math.max(.001, Math.abs(du) + Math.abs(dv))) * requiredV * push;

        const aWeight = a.fixed ? 0 : b.fixed ? 1 : .5;
        const bWeight = b.fixed ? 0 : a.fixed ? 1 : .5;
        a.mark.u = clamp(a.mark.u + pushU * aWeight, .22, .78);
        a.mark.v = clamp(a.mark.v + pushV * aWeight, .24, .84);
        b.mark.u = clamp(b.mark.u - pushU * bWeight, .22, .78);
        b.mark.v = clamp(b.mark.v - pushV * bWeight, .24, .84);
      }
    }
  }

  return new Map(states.map(({ entity, mark }) => [entity.id, mark]));
}

function totpStagePoint(
  plan: PerformerPlan,
  entityId: string,
  venue: VenueProfile,
  totpStage: TotpStageKey,
  positionMs = 0,
  performing = false,
  variantSeed = 0,
): [number, number, number] {
  const live = totpLiveMarks(plan, positionMs, performing, variantSeed);
  const entity = plan.entities.find((candidate) => candidate.id === entityId);
  const mark = live.get(entityId) ?? { u: .5, v: .55 };
  return totpStageWorldPosition(totpStage, venue, mark, entity?.role);
}

export function buildStagePlan(replay: GigViewerReplay, experience: GigExperienceDTO | null) {
  const entrances = new Set(replay.events.flatMap(e => e.visualPayload.type === 'performer_enter' ? [e.visualPayload.performerId] : []));
  const candidates = experience?.performers ?? [], performed = candidates.filter(p => p.lineupStatus === 'performed');
  const performers = entrances.size ? candidates.filter(p => entrances.has(p.profileId || p.id)) : performed.length ? performed : candidates.filter(p => !/cancelled|declined|removed|absent/i.test(p.lineupStatus));
  return buildPerformerPlan({ replay, experience: experience ? { ...experience, performers: performers ?? [] } : null, size: { width: 1200, height: 760 } });
}

function stagePoint(plan: PerformerPlan, point: { x: number; y: number }, venue: VenueProfile, presentationMode: ConcertPresentationMode = 'gig', totpStage: TotpStageKey = 'main_stage'): [number, number, number] {
  const base = stagePosition(venue, (point.x - plan.stage.x) / plan.stage.width, (point.y - plan.stage.y) / plan.stage.height);
  if (presentationMode !== 'totp') return base;
  const mark = {
    u: (point.x - plan.stage.x) / plan.stage.width,
    v: (point.y - plan.stage.y) / plan.stage.height,
  };
  return totpStageWorldPosition(totpStage, venue, mark);
}

export function concertOptions(
  plan: PerformerPlan,
  appearances: Record<string, PlayerAppearance>,
  replay: GigViewerReplay,
  experience: GigExperienceDTO | null,
  archetype: string,
  richClothing: Record<string, ResolvedEquippedClothing[]> = {},
  presentationMode: ConcertPresentationMode = 'gig',
  totpStage: TotpStageKey = 'main_stage',
): ConcertOptions {
  const totp = presentationMode === 'totp';
  const seedSource = totp ? `totp:${replay.simulationSeed}` : String(experience?.gig.venue.id ?? replay.simulationSeed);
  const seed = stableTotpLayoutSeed(seedSource);
  const venue: ConcertVenue = totp
    ? {
        name: 'RockMundo Television Centre',
        bandName: 'TOP OF THE POPS',
        archetype: 'tv_studio',
        seed,
        type: 'tv_studio',
        capacity: 250,
        id: `totp-${replay.id}`,
      }
    : { name: experience?.gig.venue.name ?? 'Live performance', bandName: 'ROCKMUNDO', archetype, seed, type: experience?.gig.venue.type, capacity: experience?.gig.venue.capacity, id: experience?.gig.venue.id };
  const profile = resolveVenueProfile(venue);
  return {
    externalClock: true,
    venue,
    performers: plan.entities.map(p => {
      const profileId = p.profileId ?? p.id;
      return {
        id: p.id,
        displayName: p.displayName,
        ...stageAssignment(p.instrument, roleMap[p.role]),
        phase: p.idlePhase,
        position: totp ? totpStagePoint(plan, p.id, profile, totpStage, 0, false, seed) : stagePoint(plan, p.stageSlot, profile, presentationMode, totpStage),
        appearance: appearances[profileId] ?? defaultAppearance(profileId),
        richClothing: richClothing[profileId] ?? [],
      };
    }),
  };
}

/** Pure reconstruction: the same replay timestamp gives the same stage after
 * pause, speed changes, a reload or a backwards seek. Never writes gig outcomes. */
export function concertFrame(plan: PerformerPlan, replay: GigViewerReplay, experience: GigExperienceDTO | null, playback: DerivedPlaybackState, reducedMotion: boolean, tuning: CrowdTuningOptions, venue?: ConcertVenue, presentationMode: ConcertPresentationMode = 'gig', totpStage: TotpStageKey = 'main_stage'): ConcertFrame {
  const profile = resolveVenueProfile(venue ?? { type: experience?.gig.venue.type, name: experience?.gig.venue.name, capacity: experience?.gig.venue.capacity });
  const totpLayoutSeed = stableTotpLayoutSeed(`totp:${replay.simulationSeed}`);
  const positionMs = playback.positionMs;
  const past = replay.events.filter(e => e.scheduledOffsetMs <= positionMs).sort((a, b) => a.scheduledOffsetMs - b.scheduledOffsetMs || a.sequence - b.sequence);
  const active = past.filter(e => positionMs <= e.scheduledOffsetMs + Math.max(1, e.durationMs));
  const progress = (e: typeof past[number]) => clamp((positionMs - e.scheduledOffsetMs) / Math.max(1, e.durationMs));
  const fill = past.find(e => e.visualPayload.type === 'crowd_fill');
  const attendance = resolvePresentationAttendance(experience?.headline.attendance, replayResultAttendance(replay), experience?.headline.capacity);
  const count = attendance.state === 'valid' ? Math.min(attendance.value, 160, 32 + Math.sqrt(attendance.value) * 5) : 0;
  const filling = fill ? reducedMotion ? 1 : clamp(progress(fill) * tuning.arrivalSpeed) : 0;
  const reaction = [...past].reverse().find(e => e.visualPayload.type === 'crowd_reaction');
  const dispersed = reaction?.visualPayload.type === 'crowd_reaction' && reaction.visualPayload.reaction === 'disperse' ? 1 - progress(reaction) : 1;
  const item = [...active].reverse().find(e => e.visualPayload.type === 'performance_item');
  const itemPayload = item?.visualPayload.type === 'performance_item' ? item.visualPayload : null;
  const fx = [...active].reverse().find(e => e.visualPayload.type === 'moment_effect');
  const fxPayload = fx?.visualPayload.type === 'moment_effect' ? fx.visualPayload : null;
  const songPlaying = /song_intro|song_performance|highlight_moment|encore|finale|performance_item/.test(playback.activePhase ?? '') || active.some(e => e.visualPayload.type === 'song_start');
  const opening = [...past].reverse().find(e => e.visualPayload.type === 'venue_open');
  const lightLevel = songPlaying ? 1 : opening?.visualPayload.type === 'venue_open' ? Math.max(.3, opening.visualPayload.lightLevel) : .5;
  const spotlight = [...active].reverse().find(e => e.visualPayload.type === 'spotlight');
  const focusId = itemPayload?.performerId ?? (spotlight?.visualPayload.type === 'spotlight' ? spotlight.visualPayload.performerId : null) ?? playback.performerFocusId;
  return {
    positionMs,
    occupancy: attendance.state === 'valid' ? clamp(attendance.value / profile.capacity) * filling * dispersed : 0,
    energy: clamp((playback.crowdEnergy ?? 30) / 100),
    crowdReaction: itemPayload?.action === 'phone_lights' ? 'phone_lights' : itemPayload?.action === 'mosh_pit' ? 'mosh_pit' : itemPayload?.action === 'crowd_surf' ? 'crowd_surf' : itemPayload?.action === 'crowd_wave' ? 'wave' : reaction?.visualPayload.type === 'crowd_reaction' ? reaction.visualPayload.reaction : 'still',
    performing: songPlaying,
    crowdCueProgress: item && /mosh_pit|crowd_surf/.test(itemPayload?.action ?? '') ? progress(item) : undefined,
    crowd: clamp(count / 160 * filling * dispersed * tuning.densityMultiplier / 2),
    look: /encore|finale/.test(playback.activePhase ?? '') ? 'encore' : songPlaying ? 'electric' : 'amber',
    lightLevel,
    focusId,
    effect: fxPayload && fx ? { type: fxPayload.effect, intensity: clamp(fxPayload.intensity), progress: progress(fx) } : itemPayload?.action === 'special_effect' && item ? { type: 'special_effect', intensity: clamp(itemPayload.intensity), progress: progress(item) } : null,
    performers: reconstructPerformerState(plan, replay, positionMs, { reducedMotion }).map(p => {
      const fixed = stageAssignment(p.instrument, roleMap[p.role]).stationary && p.lifecycleState === 'performing';
      return {
        id: p.id,
        position: presentationMode === 'totp'
          ? totpStagePoint(plan, p.id, profile, totpStage, positionMs, songPlaying, totpLayoutSeed)
          : stagePoint(plan, fixed ? p.stageSlot : p.currentPosition, profile, presentationMode, totpStage),
        visible: p.visible && p.lifecycleState !== 'waiting_backstage',
        walking: ['entering', 'taking_position', 'exiting'].includes(p.lifecycleState)
          || (presentationMode === 'totp' && songPlaying && !fixed && (() => {
            const entity = plan.entities.find((candidate) => candidate.id === p.id);
            const home = totpFormation(plan, totpLayoutSeed).get(p.id) ?? { u: .5, v: .55 };
            return entity
              ? totpChoreographyState(entity.role, entity.instrument, home, positionMs, entity.idlePhase ?? 0, true).walking
              : false;
          })()),
        action: itemPayload && (!itemPayload.performerId ? p.id === (focusId ?? plan.entities.find(e => e.role === 'vocalist')?.id ?? plan.entities[0]?.id) : itemPayload.performerId === p.id) ? itemPayload.action : null,
        actionProgress: item ? progress(item) : 0,
      };
    }),
  };
}
