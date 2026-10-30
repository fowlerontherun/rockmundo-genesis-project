import type { GigViewerEvent } from '../../events/types';

const actionReaction: Record<string, string> = {
  phone_lights: 'phone_lights', mosh_pit: 'mosh_pit', crowd_surf: 'crowd_surf', crowd_wave: 'wave', singalong: 'singalong',
};
/** Caller supplies replay order (timestamp then sequence). No mutable transition state. */
export function crowdPresentation(events: GigViewerEvent[], atMs: number, releaseStart?: number) {
  const reactionAt = (time: number) => {
    if (releaseStart !== undefined && time >= releaseStart && time < releaseStart + 2400) return 'applause';
    const item = [...events].reverse().find(e => e.visualPayload.type === 'performance_item' && e.scheduledOffsetMs <= time && time < e.scheduledOffsetMs + Math.max(1, e.durationMs));
    if (item?.visualPayload.type === 'performance_item' && actionReaction[item.visualPayload.action]) return actionReaction[item.visualPayload.action];
    const cue = [...events].reverse().find(e => e.visualPayload.type === 'crowd_reaction' && e.scheduledOffsetMs <= time);
    return cue?.visualPayload.type === 'crowd_reaction' ? cue.visualPayload.reaction : 'still';
  };
  const boundaries = events.flatMap(e => e.visualPayload.type === 'crowd_reaction' ? [e.scheduledOffsetMs]
    : e.visualPayload.type === 'performance_item' ? [e.scheduledOffsetMs, e.scheduledOffsetMs + Math.max(1, e.durationMs)] : []);
  if (releaseStart !== undefined) boundaries.push(releaseStart, releaseStart + 2400);
  const boundary = boundaries.filter(t => t <= atMs && t >= atMs - 1000 && reactionAt(t - .01) !== reactionAt(t)).sort((a, b) => b - a)[0];
  return { crowdReaction: reactionAt(atMs), crowdPreviousReaction: boundary === undefined ? reactionAt(atMs) : reactionAt(boundary - .01),
    crowdReactionElapsed: boundary === undefined ? undefined : (atMs - boundary) / 1000 };
}
