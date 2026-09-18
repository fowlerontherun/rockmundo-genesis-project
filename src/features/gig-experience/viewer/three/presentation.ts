import { stageAssignment } from '@/features/gig-demo-3d/instrumentCatalog';
import type { GigViewerReplay } from '../../events/types';
import type { GigExperienceDTO } from '../../types';
import { buildPerformerPlan, reconstructPerformerState, type PerformerPlan, type PresentationRole } from '../engine/PerformerLifecycle';
import type { DerivedPlaybackState } from '../engine/PlaybackController';
import { replayResultAttendance, resolvePresentationAttendance } from '../engine/AuthoritativeMetric';
import type { ConcertFrame, ConcertOptions, ConcertVenue, StageRole } from '@/features/gig-demo-3d/liveTypes';
import { resolveVenueProfile, stagePosition, type VenueProfile } from '@/features/gig-demo-3d/venueProfile';
import { defaultAppearance, type PlayerAppearance } from '@/features/player-model/appearance';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { CrowdTuningOptions } from '../engine/CrowdTuning';
import type { TotpStageKey } from '@/features/top-of-the-pops/broadcastProfile';

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const roleMap: Record<PresentationRole, StageRole> = { vocalist: 'vocals', backing_vocals: 'vocals', lead_guitar: 'guitar', rhythm_guitar: 'guitar', guitar: 'guitar', bass: 'bass', drums: 'drums', keyboard: 'keyboard', piano: 'keyboard', dj: 'dj', electronic: 'dj', percussion: 'percussion', strings: 'strings', brass: 'brass', woodwind: 'woodwind', other: 'other', unknown: 'other' };

export type ConcertPresentationMode = 'gig' | 'totp';

type TotpStageFootprint = {
  centerX: number;
  centerZ: number;
  floorY: number;
  safeWidth: number;
  safeDepth: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  centerV: number;
};

function totpStageFootprint(stage: TotpStageKey, venue: VenueProfile): TotpStageFootprint {
  switch (stage) {
    case 'stage_b':
      return {
        centerX: 5.4,
        centerZ: 2.05,
        floorY: .22,
        safeWidth: 3.25,
        safeDepth: 2.15,
        minU: .29,
        maxU: .71,
        minV: .30,
        maxV: .78,
        centerV: .54,
      };
    case 'rock_stage':
      return {
        centerX: -4.5,
        centerZ: 4.05,
        floorY: .28,
        safeWidth: 4.35,
        safeDepth: 2.7,
        minU: .27,
        maxU: .73,
        minV: .29,
        maxV: .78,
        centerV: .53,
      };
    case 'studio_floor':
      return {
        centerX: 1.4,
        centerZ: 5.65,
        floorY: .08,
        safeWidth: 3.5,
        safeDepth: 2.45,
        minU: .31,
        maxU: .69,
        minV: .31,
        maxV: .75,
        centerV: .53,
      };
    default:
      return {
        centerX: 0,
        centerZ: .65 - venue.stageDepth / 2,
        floorY: venue.stageHeight,
        safeWidth: Math.min(6.6, venue.stageWidth * .58),
        safeDepth: Math.min(4.25, venue.stageDepth * .64),
        minU: .27,
        maxU: .73,
        minV: .28,
        maxV: .80,
        centerV: .53,
      };
  }
}

type TotpStageMark = { u: number; v: number };

export function totpSafeStageMark(stage: TotpStageKey, venue: VenueProfile, mark: TotpStageMark): TotpStageMark {
  const footprint = totpStageFootprint(stage, venue);
  return {
    u: clamp(mark.u, footprint.minU, footprint.maxU),
    v: clamp(mark.v, footprint.minV, footprint.maxV),
  };
}

export function totpStageWorldPosition(stage: TotpStageKey, venue: VenueProfile, mark: TotpStageMark, role?: PresentationRole): [number, number, number] {
  const footprint = totpStageFootprint(stage, venue);
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
    { u: .50, v: .82 },
    { u: .40, v: .76 },
    { u: .60, v: .76 },
  ];

  switch (role) {
    case 'vocalist': return [{ u: .50, v: .82 }, { u: .40, v: .76 }, { u: .60, v: .76 }];
    case 'lead_guitar':
    case 'rhythm_guitar':
    case 'guitar': return [
      { u: .30, v: .66 },
      { u: .70, v: .66 },
      { u: .38, v: .57 },
      { u: .62, v: .57 },
    ];
    case 'bass': return [{ u: .72, v: .53 }, { u: .28, v: .53 }];
    case 'drums': return [{ u: .50, v: .28 }, { u: .68, v: .28 }];
    case 'keyboard':
    case 'piano': return [{ u: .26, v: .34 }, { u: .74, v: .34 }];
    case 'dj':
    case 'electronic': return [{ u: .66, v: .30 }, { u: .34, v: .30 }];
    case 'backing_vocals': return [{ u: .34, v: .64 }, { u: .66, v: .64 }];
    case 'percussion': return [{ u: .33, v: .24 }, { u: .67, v: .24 }];
    case 'brass':
    case 'woodwind':
    case 'strings': return [{ u: .26, v: .44 }, { u: .74, v: .44 }, { u: .34, v: .46 }, { u: .66, v: .46 }];
    default: return [{ u: .30, v: .52 }, { u: .70, v: .52 }, { u: .50, v: .48 }];
  }
}

export function totpFormation(plan: PerformerPlan): Map<string, TotpStageMark> {
  const assigned = new Map<string, TotpStageMark>();
  const used: TotpStageMark[] = [];
  const minimumDistance = .24;

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
    const preferred = totpPreferredMarks(entity.role, entity.instrument);
    const candidates = [
      ...preferred,
      { u: .24, v: .58 }, { u: .76, v: .58 },
      { u: .28, v: .40 }, { u: .72, v: .40 },
      { u: .38, v: .34 }, { u: .62, v: .34 },
      { u: .50, v: .50 },
    ];
    const chosen = candidates.find((candidate) =>
      used.every((other) => Math.hypot(candidate.u - other.u, candidate.v - other.v) >= minimumDistance),
    ) ?? candidates.reduce((best, candidate) => {
      const clearance = used.length ? Math.min(...used.map((other) => Math.hypot(candidate.u - other.u, candidate.v - other.v))) : 1;
      const bestClearance = used.length ? Math.min(...used.map((other) => Math.hypot(best.u - other.u, best.v - other.v))) : 1;
      return clearance > bestClearance ? candidate : best;
    }, candidates[0]);

    assigned.set(entity.id, chosen);
    used.push(chosen);
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

  const direction = home.u < .5 ? 1 : -1;
  let away = home;
  if (singsLead) {
    away = { u: clamp(home.u + direction * .085, .39, .61), v: clamp(home.v - .045, .72, .86) };
  } else if (['lead_guitar','rhythm_guitar','guitar'].includes(role)) {
    away = { u: clamp(home.u + direction * .075, .24, .76), v: clamp(home.v - .035, .48, .70) };
  } else if (role === 'bass') {
    away = { u: clamp(home.u + direction * .06, .24, .76), v: clamp(home.v + .025, .44, .62) };
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

function totpStagePoint(
  plan: PerformerPlan,
  entityId: string,
  venue: VenueProfile,
  totpStage: TotpStageKey,
  positionMs = 0,
  performing = false,
): [number, number, number] {
  const formation = totpFormation(plan);
  const home = formation.get(entityId) ?? { u: .5, v: .55 };
  const entity = plan.entities.find((candidate) => candidate.id === entityId);
  const choreography = entity
    ? totpChoreographyState(entity.role, entity.instrument, home, positionMs, entity.idlePhase ?? 0, performing)
    : { mark: home, walking: false };
  return totpStageWorldPosition(totpStage, venue, choreography.mark, entity?.role);
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
  let seed = 0; for (const c of seedSource) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
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
        position: totp ? totpStagePoint(plan, p.id, profile, totpStage, 0, false) : stagePoint(plan, p.stageSlot, profile, presentationMode, totpStage),
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
    crowdReaction: itemPayload?.action === 'phone_lights' ? 'phone_lights' : itemPayload?.action === 'mosh_pit' ? 'jump' : itemPayload?.action === 'crowd_wave' ? 'wave' : reaction?.visualPayload.type === 'crowd_reaction' ? reaction.visualPayload.reaction : 'still',
    performing: songPlaying,
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
          ? totpStagePoint(plan, p.id, profile, totpStage, positionMs, songPlaying)
          : stagePoint(plan, fixed ? p.stageSlot : p.currentPosition, profile, presentationMode, totpStage),
        visible: p.visible && p.lifecycleState !== 'waiting_backstage',
        walking: ['entering', 'taking_position', 'exiting'].includes(p.lifecycleState)
          || (presentationMode === 'totp' && songPlaying && !fixed && (() => {
            const entity = plan.entities.find((candidate) => candidate.id === p.id);
            const home = totpFormation(plan).get(p.id) ?? { u: .5, v: .55 };
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
