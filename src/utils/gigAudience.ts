import type { GigLiveSegment, LiveGigSessionState, LiveSegmentType } from './gigLive';

export type AudienceAttendanceType = 'ticket_holder' | 'invited_guest' | 'vip_guest' | 'band_friend' | 'venue_staff' | 'crew' | 'support_act' | 'festival_attendee' | 'remote_viewer' | 'admin_viewer';
export type AudienceAttendanceStatus = 'eligible' | 'checked_in' | 'watching' | 'left_early' | 'completed' | 'no_show' | 'removed' | 'cancelled';
export type AudienceReactionType = 'cheer' | 'clap' | 'sing_along' | 'hands_up' | 'dance' | 'phone_wave' | 'chant' | 'encore_request' | 'support_performer' | 'highlight';
export type ParticipationLevel = 'quiet' | 'engaged' | 'lively' | 'electric';

export interface AudienceEligibilityInput { hasTicket?: boolean; hasInvitation?: boolean; isVipGuest?: boolean; isBandFriend?: boolean; isVenueStaff?: boolean; isCrew?: boolean; isSupportAct?: boolean; isFestivalAttendee?: boolean; publicViewingEnabled?: boolean; isAdminViewer?: boolean; gigVisibility?: 'public' | 'friends' | 'private' | string | null; playerCityId?: string | null; venueCityId?: string | null; hasScheduleConflict?: boolean; gigStatus?: string | null; isBanned?: boolean; isBandMember?: boolean; }
export interface AudienceEligibilityResult { canAttend: boolean; canView: boolean; attendanceType: AudienceAttendanceType | null; reasons: string[]; limitations: string[]; }
export interface AudienceReaction { playerId: string; attendanceId: string; reactionType: AudienceReactionType; segmentId?: string | null; createdAt: string | Date; idempotencyKey?: string | null; }
export interface AudienceAggregate { activeAttendees: number; totalReactions: number; reactionCounts: Record<AudienceReactionType, number>; uniqueParticipants: number; participationLevel: ParticipationLevel; dominantReaction: AudienceReactionType | null; encoreDemand: number; singalongStrength: number; participationScore: number; audienceModifier: number; crowdEnergyDelta: number; atmosphereDelta: number; supportRecoveryDelta: number; }
export interface ReactionLimitState { lastReactionAt?: string | Date | null; songReactionCount?: number; gigReactionCount?: number; encoreRequestCount?: number; duplicateIdempotencyKey?: boolean; now?: string | Date; }
export interface ReactionLimitResult { allowed: boolean; retryAfterSeconds: number; reason?: string; }
export interface ParticipationScoreInput { watchedSongs: number; totalSongs: number; validReactionCount: number; reactionVariety: number; stayedToEnd: boolean; encoreParticipated: boolean; invalidAttempts: number; removed: boolean; watchDurationSeconds: number; }

export const AUDIENCE_REACTION_TYPES: AudienceReactionType[] = ['cheer', 'clap', 'sing_along', 'hands_up', 'dance', 'phone_wave', 'chant', 'encore_request', 'support_performer', 'highlight'];
export const AUDIENCE_RATE_LIMITS = { minSecondsBetweenReactions: 4, maxReactionsPerSong: 6, maxReactionsPerGig: 40, maxEncoreRequestsPerGig: 1 } as const;
export const AUDIENCE_INFLUENCE_CAPS = { perSegmentModifier: 4, gigModifier: 8, crowdEnergyDelta: 3, atmosphereDelta: 3, supportRecoveryDelta: 2 } as const;

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const signedClamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));

export function evaluateAudienceEligibility(input: AudienceEligibilityInput): AudienceEligibilityResult {
  const reasons: string[] = []; const limitations: string[] = [];
  const terminal = ['cancelled', 'completed', 'failed'].includes(input.gigStatus ?? '');
  if (terminal) reasons.push('Gig is not open for live attendance.');
  if (input.isBanned) reasons.push('Player is restricted from this venue or gig.');
  if (input.hasScheduleConflict) reasons.push('Player has a conflicting scheduled activity.');
  if (input.venueCityId && input.playerCityId && input.venueCityId !== input.playerCityId) reasons.push('Player is not in the gig city.');
  if (!input.venueCityId) limitations.push('Venue-level validation is unavailable; city-level validation is the strongest supported location check.');

  let attendanceType: AudienceAttendanceType | null = null;
  if (input.hasTicket) attendanceType = 'ticket_holder'; else if (input.isVipGuest) attendanceType = 'vip_guest'; else if (input.hasInvitation) attendanceType = 'invited_guest'; else if (input.isCrew) attendanceType = 'crew'; else if (input.isSupportAct) attendanceType = 'support_act'; else if (input.isVenueStaff) attendanceType = 'venue_staff'; else if (input.isFestivalAttendee) attendanceType = 'festival_attendee'; else if (input.isBandFriend && input.gigVisibility !== 'private') attendanceType = 'band_friend';
  const canAttend = reasons.length === 0 && attendanceType !== null;
  const canView = !terminal && (canAttend || input.publicViewingEnabled || input.isAdminViewer || input.isBandMember || input.gigVisibility === 'public' || (input.isBandFriend && input.gigVisibility === 'friends'));
  if (!canAttend && !canView) reasons.push('No valid ticket, invitation, relationship, staff, festival, public, or admin viewing permission was found.');
  return { canAttend, canView, attendanceType: canAttend ? attendanceType : input.isAdminViewer ? 'admin_viewer' : input.publicViewingEnabled ? 'remote_viewer' : null, reasons, limitations };
}

export function validateAudienceReactionTiming(reactionType: AudienceReactionType, segment: Pick<GigLiveSegment, 'segmentType' | 'status'> | null, session: Pick<LiveGigSessionState, 'status'>): { allowed: boolean; reason?: string } {
  if (session.status !== 'live' && session.status !== 'paused_for_decision') return { allowed: false, reason: 'Gig is not live.' };
  if (!segment || !['active', 'resolved'].includes(segment.status)) return { allowed: false, reason: 'No current authoritative segment is available.' };
  const type = segment.segmentType as LiveSegmentType;
  const windows: Record<AudienceReactionType, LiveSegmentType[]> = {
    cheer: ['intro', 'song', 'encore_song', 'crowd_interaction', 'outro'], clap: ['song', 'encore_song', 'transition', 'outro'], sing_along: ['song', 'encore_song'], hands_up: ['song', 'encore_song', 'crowd_interaction'], dance: ['song', 'encore_song'], phone_wave: ['song', 'encore_song', 'encore_break'], chant: ['crowd_interaction', 'encore_break', 'outro'], encore_request: ['encore_break', 'outro'], support_performer: ['incident', 'transition', 'song', 'encore_song'], highlight: ['song', 'encore_song', 'crowd_interaction']
  };
  return windows[reactionType].includes(type) ? { allowed: true } : { allowed: false, reason: `${reactionType} is not valid during ${type}.` };
}

export function checkAudienceReactionRateLimit(state: ReactionLimitState): ReactionLimitResult {
  if (state.duplicateIdempotencyKey) return { allowed: false, retryAfterSeconds: 0, reason: 'Duplicate reaction ignored.' };
  const now = state.now ? new Date(state.now) : new Date();
  if (state.lastReactionAt) {
    const elapsed = (now.getTime() - new Date(state.lastReactionAt).getTime()) / 1000;
    if (elapsed < AUDIENCE_RATE_LIMITS.minSecondsBetweenReactions) return { allowed: false, retryAfterSeconds: Math.ceil(AUDIENCE_RATE_LIMITS.minSecondsBetweenReactions - elapsed), reason: 'Reaction cooldown active.' };
  }
  if ((state.songReactionCount ?? 0) >= AUDIENCE_RATE_LIMITS.maxReactionsPerSong) return { allowed: false, retryAfterSeconds: 0, reason: 'Song reaction limit reached.' };
  if ((state.gigReactionCount ?? 0) >= AUDIENCE_RATE_LIMITS.maxReactionsPerGig) return { allowed: false, retryAfterSeconds: 0, reason: 'Gig reaction limit reached.' };
  if ((state.encoreRequestCount ?? 0) >= AUDIENCE_RATE_LIMITS.maxEncoreRequestsPerGig) return { allowed: false, retryAfterSeconds: 0, reason: 'Encore request already counted.' };
  return { allowed: true, retryAfterSeconds: 0 };
}

export function aggregateAudienceResponse(reactions: AudienceReaction[], activeAttendees: number): AudienceAggregate {
  const counts = Object.fromEntries(AUDIENCE_REACTION_TYPES.map(t => [t, 0])) as Record<AudienceReactionType, number>;
  const unique = new Set<string>();
  reactions.forEach(r => { counts[r.reactionType] += 1; unique.add(r.playerId); });
  const total = reactions.length;
  const dominantReaction = AUDIENCE_REACTION_TYPES.reduce<AudienceReactionType | null>((best, t) => !best || counts[t] > counts[best] ? t : best, null);
  const uniqueRatio = activeAttendees > 0 ? unique.size / activeAttendees : 0;
  const diversity = AUDIENCE_REACTION_TYPES.filter(t => counts[t] > 0).length / AUDIENCE_REACTION_TYPES.length;
  const encoreDemand = clamp(activeAttendees ? (counts.encore_request / Math.max(3, activeAttendees)) * 100 : 0);
  const singalongStrength = clamp(activeAttendees ? (counts.sing_along / Math.max(2, activeAttendees)) * 100 : 0);
  const participationScore = Math.round(clamp(uniqueRatio * 55 + diversity * 25 + Math.min(total, activeAttendees * 3) * 2));
  const participationLevel: ParticipationLevel = participationScore >= 80 ? 'electric' : participationScore >= 55 ? 'lively' : participationScore >= 25 ? 'engaged' : 'quiet';
  const positiveParticipantRatio = activeAttendees > 0 ? Math.min(1, unique.size / activeAttendees) : 0;
  const rawModifier = uniqueRatio * 3.0 + diversity * 1.0 + positiveParticipantRatio * 1.4;
  const audienceModifier = signedClamp(rawModifier, AUDIENCE_INFLUENCE_CAPS.perSegmentModifier);
  return { activeAttendees, totalReactions: total, reactionCounts: counts, uniqueParticipants: unique.size, participationLevel, dominantReaction: total ? dominantReaction : null, encoreDemand: Math.round(encoreDemand), singalongStrength: Math.round(singalongStrength), participationScore, audienceModifier: Number(audienceModifier.toFixed(2)), crowdEnergyDelta: Math.round(signedClamp(audienceModifier * 0.7, AUDIENCE_INFLUENCE_CAPS.crowdEnergyDelta)), atmosphereDelta: Math.round(signedClamp(audienceModifier * 0.6, AUDIENCE_INFLUENCE_CAPS.atmosphereDelta)), supportRecoveryDelta: counts.support_performer > 0 ? Math.round(Math.min(AUDIENCE_INFLUENCE_CAPS.supportRecoveryDelta, unique.size / 3)) : 0 };
}

export function calculateAudienceParticipationScore(input: ParticipationScoreInput): number {
  if (input.removed) return 0;
  const watchRatio = input.totalSongs > 0 ? clamp(input.watchedSongs / input.totalSongs, 0, 1) : 0;
  const durationPoints = Math.min(25, Math.floor(input.watchDurationSeconds / 300) * 3);
  const reactionPoints = Math.min(28, input.validReactionCount * 3);
  const varietyPoints = Math.min(16, input.reactionVariety * 2);
  const completionPoints = input.stayedToEnd ? 18 : 0;
  const encorePoints = input.encoreParticipated ? 6 : 0;
  const invalidPenalty = Math.min(30, input.invalidAttempts * 4);
  return Math.round(clamp(watchRatio * 30 + durationPoints + reactionPoints + varietyPoints + completionPoints + encorePoints - invalidPenalty));
}

export function calculateAudienceReward(score: number, status: AudienceAttendanceStatus, attendanceType: AudienceAttendanceType) {
  if (attendanceType === 'remote_viewer' || attendanceType === 'admin_viewer' || status === 'removed' || status === 'cancelled') return { fanXp: 0, socialXp: 0, venueFamiliarity: 0, relationshipProgress: 0 };
  const multiplier = status === 'completed' ? 1 : status === 'left_early' ? 0.55 : 0.25;
  const bounded = clamp(score, 0, 100) / 100;
  return { fanXp: Math.round((8 + bounded * 22) * multiplier), socialXp: Math.round((2 + bounded * 8) * multiplier), venueFamiliarity: Math.round((1 + bounded * 5) * multiplier), relationshipProgress: Math.round((1 + bounded * 4) * multiplier) };
}
