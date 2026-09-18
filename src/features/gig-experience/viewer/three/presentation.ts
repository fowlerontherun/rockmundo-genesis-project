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

const TOTP_STAGE_OFFSETS: Record<TotpStageKey, readonly [number, number, number]> = {
  main_stage: [0, 0, 0],
  stage_b: [5.4, 0, 1.4],
  rock_stage: [-4.5, 0, 3.4],
  studio_floor: [1.4, -.42, 5.0],
};


type TotpStageMark = { u: number; v: number };

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
      { u: .22, v: .64 },
      { u: .78, v: .64 },
      { u: .34, v: .54 },
      { u: .66, v: .54 },
    ];
    case 'bass': return [{ u: .84, v: .50 }, { u: .16, v: .50 }];
    case 'drums': return [{ u: .50, v: .28 }, { u: .68, v: .28 }];
    case 'keyboard':
    case 'piano': return [{ u: .16, v: .31 }, { u: .84, v: .31 }];
    case 'dj':
    case 'electronic': return [{ u: .68, v: .28 }, { u: .32, v: .28 }];
    case 'backing_vocals': return [{ u: .34, v: .64 }, { u: .66, v: .64 }];
    case 'percussion': return [{ u: .33, v: .24 }, { u: .67, v: .24 }];
    case 'brass':
    case 'woodwind':
    case 'strings': return [{ u: .18, v: .42 }, { u: .82, v: .42 }, { u: .30, v: .44 }, { u: .70, v: .44 }];
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
      { u: .12, v: .58 }, { u: .88, v: .58 },
      { u: .22, v: .40 }, { u: .78, v: .40 },
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
  const text = (entity?.instrument ?? '').toLowerCase();
  const singsLead = /lead\s+(vocals?|singer)|lead\s+vocalist|frontperson|front\s+(man|woman)/.test(text) || entity?.role === 'vocalist';
  const t = positionMs / 1000 + (entity?.idlePhase ?? 0);

  let mark = home;
  if (performing && entity) {
    if (singsLead) {
      mark = {
        u: clamp(home.u + Math.sin(t * .48) * .075, .37, .63),
        v: clamp(home.v + Math.sin(t * .31 + 1.1) * .035, .74, .86),
      };
    } else if (['lead_guitar','rhythm_guitar','guitar'].includes(entity.role)) {
      const direction = home.u < .5 ? 1 : -1;
      mark = {
        u: clamp(home.u + direction * (.018 + Math.sin(t * .42) * .032), .12, .88),
        v: clamp(home.v + Math.cos(t * .36) * .025, .48, .70),
      };
    } else if (entity.role === 'bass') {
      const direction = home.u < .5 ? 1 : -1;
      mark = {
        u: clamp(home.u + direction * Math.sin(t * .33) * .042, .10, .90),
        v: clamp(home.v + Math.cos(t * .27) * .018, .44, .60),
      };
    } else if (entity.role === 'backing_vocals') {
      mark = {
        u: clamp(home.u + Math.sin(t * .29) * .025, .18, .82),
        v: clamp(home.v + Math.cos(t * .35) * .018, .55, .70),
      };
    }
  }

  const base = stagePosition(venue, mark.u, mark.v);
  const [dx, dy, dz] = TOTP_STAGE_OFFSETS[totpStage];
  const scale = totpStage === 'main_stage' ? 1 : totpStage === 'rock_stage' ? .96 : totpStage === 'stage_b' ? .92 : .90;
  const roleLift = entity?.role === 'drums' && totpStage !== 'studio_floor' ? .18 : 0;
  return [base[0] * scale + dx, Math.max(0.04, base[1] + dy + roleLift), (base[2] - .65) * scale + .65 + dz];
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
  const [dx, dy, dz] = TOTP_STAGE_OFFSETS[totpStage];
  const scale = totpStage === 'main_stage' ? 1 : totpStage === 'rock_stage' ? .78 : .66;
  return [base[0] * scale + dx, Math.max(0.04, base[1] + dy), (base[2] - .65) * scale + .65 + dz];
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
        walking: ['entering', 'taking_position', 'exiting'].includes(p.lifecycleState),
        action: itemPayload && (!itemPayload.performerId ? p.id === (focusId ?? plan.entities.find(e => e.role === 'vocalist')?.id ?? plan.entities[0]?.id) : itemPayload.performerId === p.id) ? itemPayload.action : null,
        actionProgress: item ? progress(item) : 0,
      };
    }),
  };
}
