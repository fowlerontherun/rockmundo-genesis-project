import { describe, expect, it } from 'vitest';
import { formatConflictMessage } from '@/utils/bandActivityScheduling';

describe('band activity scheduling helpers', () => {
  it('names the current user when their schedule blocks a band activity', () => {
    expect(
      formatConflictMessage([
        { userId: 'u1', userName: 'Ava', activityTitle: 'Solo songwriting' },
      ], 'u1'),
    ).toBe('You have "Solo songwriting" scheduled at this time.');
  });

  it('summarizes multi-member conflicts without exposing unrelated activity details', () => {
    expect(
      formatConflictMessage([
        { userId: 'u1', userName: 'Ava', activityTitle: 'Work' },
        { userId: 'u2', userName: 'Bo', activityTitle: 'Recording' },
      ], 'u3'),
    ).toBe('Multiple band members have scheduling conflicts: Ava, Bo');
  });
});
