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

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const roleMap: Record<PresentationRole, StageRole> = { vocalist: 'vocals', backing_vocals: 'vocals', lead_guitar: 'guitar', rhythm_guitar: 'guitar', guitar: 'guitar', bass: 'bass', drums: 'drums', keyboard: 'keyboard', piano: 'keyboard', dj: 'dj', electronic: 'dj', percussion: 'percussion', strings: 'strings', brass: 'brass', woodwind: 'woodwind', other: 'other', unknown: 'other' };
export function buildStagePlan(replay: GigViewerReplay, experience: GigExperienceDTO | null) {
  const entrances = new Set(replay.events.flatMap(e => e.visualPayload.type === 'performer_enter' ? [e.visualPayload.performerId] : []));
  const candidates = experience?.performers ?? [], performed = candidates.filter(p => p.lineupStatus === 'performed');
  const performers = entrances.size ? candidates.filter(p => entrances.has(p.profileId || p.id)) : performed.length ? performed : candidates.filter(p => !/cancelled|declined|removed|absent/i.test(p.lineupStatus));
  return buildPerformerPlan({ replay, experience: experience ? { ...experience, performers: performers ?? [] } : null, size: { width: 1200, height: 760 } });
}
function stagePoint(plan: PerformerPlan, point: { x: number; y: number }, venue: VenueProfile): [number, number, number] {
  return stagePosition(venue, (point.x - plan.stage.x) / plan.stage.width, (point.y - plan.stage.y) / plan.stage.height);
}
export function concertOptions(
  plan: PerformerPlan,
  appearances: Record<string, PlayerAppearance>,
  replay: GigViewerReplay,
  experience: GigExperienceDTO | null,
  archetype: string,
  richClothing: Record<string, ResolvedEquippedClothing[]> = {},
): ConcertOptions {
  let seed = 0; for (const c of String(experience?.gig.venue.id ?? replay.simulationSeed)) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const venue: ConcertVenue = { name: experience?.gig.venue.name ?? 'Live performance', bandName: 'ROCKMUNDO', archetype, seed, type: experience?.gig.venue.type, capacity: experience?.gig.venue.capacity, id: experience?.gig.venue.id };
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
        position: stagePoint(plan, p.stageSlot, profile),
        appearance: appearances[profileId] ?? defaultAppearance(profileId),
        richClothing: richClothing[profileId] ?? [],
      };
    }),
  };
}

/** Pure reconstruction: the same replay timestamp gives the same stage after
 * pause, speed changes, a reload or a backwards seek. Never writes gig outcomes. */
export function concertFrame(plan: PerformerPlan, replay: GigViewerReplay, experience: GigExperienceDTO | null, playback: DerivedPlaybackState, reducedMotion: boolean, tuning: CrowdTuningOptions, venue?: ConcertVenue): ConcertFrame {
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
        position: stagePoint(plan, fixed ? p.stageSlot : p.currentPosition, profile),
        visible: p.visible && p.lifecycleState !== 'waiting_backstage',
        walking: ['entering', 'taking_position', 'exiting'].includes(p.lifecycleState),
        action: itemPayload && (!itemPayload.performerId ? p.id === (focusId ?? plan.entities.find(e => e.role === 'vocalist')?.id ?? plan.entities[0]?.id) : itemPayload.performerId === p.id) ? itemPayload.action : null,
        actionProgress: item ? progress(item) : 0,
      };
    }),
  };
}
