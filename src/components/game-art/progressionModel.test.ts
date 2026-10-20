import { describe, expect, it } from 'vitest';
import { capacityProgress, recordingProgress } from './progressionModel';
const start = '2026-10-20T12:00:00Z';
const end = '2026-10-20T14:00:00Z';
const now = Date.parse('2026-10-20T13:00:00Z');
describe('recording display authority', () => {
  it('shows elapsed time for an active session', () => {
    expect(recordingProgress('in_progress', start, end, now)).toEqual({ label: 'Recording in progress', step: 1, percent: 50 });
  });
  it('does not complete an elapsed session automatically', () => {
    expect(recordingProgress('in_progress', start, end, now + 7200000)).toEqual({ label: 'Ready to finalise', step: 2, percent: 100 });
    expect(recordingProgress('scheduled', start, end, now + 7200000).step).toBe(0);
  });
  it('requires recorded completion and preserves failure states', () => {
    expect(recordingProgress('completed', null, null, now).step).toBe(3);
    for (const status of ['cancelled', 'failed', 'unknown']) expect(recordingProgress(status, start, end, now).step).toBe(-1);
  });
  it('handles missing, invalid and reversed times without invented progress', () => {
    for (const [a, b] of [[null, null], ['bad', end], [end, start], [start, start]]) expect(recordingProgress('in_progress', a, b, now).percent).toBeNull();
    expect(recordingProgress('in_progress', start, end, now - 7200000).percent).toBe(0);
  });
});
describe('capacity illustration', () => {
  it('distinguishes empty from unknown capacity', () => {
    expect(capacityProgress(0, 100)).toBe(0);
    for (const capacity of [0, -1, NaN, Infinity]) expect(capacityProgress(0, capacity)).toBeNull();
  });
  it('bounds over-capacity data and rejects invalid sales', () => {
    expect(capacityProgress(50, 200)).toBe(25);
    expect(capacityProgress(300, 200)).toBe(100);
    expect(capacityProgress(-1, 200)).toBeNull();
    expect(capacityProgress(NaN, 200)).toBeNull();
  });
});
