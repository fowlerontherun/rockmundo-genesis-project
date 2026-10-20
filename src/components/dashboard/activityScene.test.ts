import { describe, expect, it } from 'vitest';
import { activitySceneImage, selectActivityScene } from './activitySceneModel';
import type { ScheduledActivity } from '@/hooks/useScheduledActivities';
const now = Date.parse('2026-10-20T12:00:00Z');
const row = (changes: Partial<ScheduledActivity> = {}): ScheduledActivity => ({ id: 'a', user_id: 'u', profile_id: 'p', activity_type: 'recording', scheduled_start: '2026-10-20T11:00:00Z', scheduled_end: '2026-10-20T13:00:00Z', status: 'scheduled', title: 'Recording', ...changes });
describe('dashboard activity scene', () => {
  it('does not claim a scheduled slot is running', () => {
    expect(selectActivityScene([row()], 'p', now)?.phase).toBe('Scheduled now');
    expect(selectActivityScene([row({ status: 'in_progress' })], 'p', now)?.phase).toBe('In progress');
  });
  it('ignores other characters, cancelled, completed, expired and invalid activities', () => {
    expect(selectActivityScene([row({ profile_id: 'other' }), row({ status: 'cancelled' }), row({ status: 'completed' }), row({ scheduled_end: '2026-10-20T12:00:00Z' }), row({ scheduled_start: 'invalid' })], 'p', now)).toBeNull();
  });
  it('chooses a running activity before the nearest future booking', () => {
    const next = row({ id: 'next', scheduled_start: '2026-10-20T14:00:00Z', scheduled_end: '2026-10-20T15:00:00Z' });
    expect(selectActivityScene([next, row({ status: 'in_progress' })], 'p', now)?.activity.id).toBe('a');
    expect(selectActivityScene([next], 'p', now)?.phase).toBe('Up next');
  });
  it('uses relevant bundled art for recording, travel and learning', () => {
    expect(activitySceneImage('recording')).toBe('recording-studio');
    expect(activitySceneImage('travel')).toBe('travel');
    expect(activitySceneImage('reading')).toBe('education');
  });
});
