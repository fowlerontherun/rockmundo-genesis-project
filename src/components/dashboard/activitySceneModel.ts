import type { ScheduledActivity } from '@/hooks/useScheduledActivities';

/** Scheduled windows are not proof an activity started. Never fabricate a live state. */
export function selectActivityScene(activities: ScheduledActivity[], profileId: string, now: number) {
  const eligible = activities.filter(a => a.profile_id === profileId
    && ['scheduled', 'in_progress'].includes(a.status)
    && Number.isFinite(Date.parse(a.scheduled_start))
    && Date.parse(a.scheduled_end) > Date.parse(a.scheduled_start)
    && Date.parse(a.scheduled_end) > now);
  const current = eligible.filter(a => Date.parse(a.scheduled_start) <= now)
    .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start))[0];
  const next = eligible.filter(a => Date.parse(a.scheduled_start) > now)
    .sort((a, b) => Date.parse(a.scheduled_start) - Date.parse(b.scheduled_start))[0];
  const activity = current ?? next;
  if (!activity) return null;
  const phase = current ? activity.status === 'in_progress' ? 'In progress' : 'Scheduled now' : 'Up next';
  return { activity, phase };
}

export function activitySceneImage(type: string) {
  if (['gig', 'open_mic', 'busking', 'festival_performance', 'festival_attendance', 'dj_set'].includes(type)) return 'gig-booking';
  if (['university', 'reading', 'mentorship', 'youtube_video', 'teaching'].includes(type)) return 'education';
  if (['rehearsal', 'jam_session'].includes(type)) return 'rehearsals';
  return ({ recording: 'recording-studio', songwriting: 'songwriting', travel: 'travel', work: 'employment', skill_practice: 'stage-practice' } as Record<string, string>)[type] ?? 'current-city';
}
