import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  failedCompletionMetadata,
  isCompletionRetryDue,
  requireWorkerSuccess,
} from '../../supabase/functions/_shared/scheduledCompletionGuards';

describe('schedule completion worker confirmations (#4225)', () => {
  it('rejects a failed Edge invocation, error payload or missing receipt', () => {
    expect(() => requireWorkerSuccess('recording', { error: { message: 'offline' } })).toThrow('offline');
    expect(() => requireWorkerSuccess('gig', { data: { success: false, error: 'busy' } })).toThrow('busy');
    expect(() => requireWorkerSuccess('gig', { data: null })).toThrow('missing success receipt');
    expect(() => requireWorkerSuccess('recording', { data: { success: true, errors: 2 } })).toThrow('downstream');
    expect(() => requireWorkerSuccess('songwriting', { data: { success: true, xpAwardErrors: 1 } })).toThrow('downstream');
    expect(() => requireWorkerSuccess('rehearsal', { data: { success: true } })).not.toThrow();
  });

  it('backs off retryable failures and exposes a stable admin review marker', () => {
    const now = new Date('2026-11-18T09:00:00Z');
    let metadata: Record<string, unknown> = { tour_id: 'unrelated' };
    for (let count = 1; count <= 5; count++) {
      metadata = failedCompletionMetadata(metadata, 'worker temporarily unavailable', now);
      expect(metadata.completionFailureCount).toBe(count);
      expect(metadata.tour_id).toBe('unrelated');
      expect(isCompletionRetryDue(metadata, now)).toBe(false);
      if (count < 5) expect(metadata.completionRetryAt).toBeTruthy();
    }
    expect(metadata.completionNeedsReview).toBe(true);
    expect(metadata.completionDeadLetterAt).toBe(now.toISOString());
    expect(isCompletionRetryDue(metadata, new Date('2027-01-01T00:00:00Z'))).toBe(false);
    expect(isCompletionRetryDue({ completionRetryAt: '2026-11-18T09:01:00Z' }, new Date('2026-11-18T09:02:00Z'))).toBe(true);
    expect(isCompletionRetryDue({ completionRetryAt: 'bad-timestamp' }, now)).toBe(true);
  });

  it('checks canonical linked records before completing the calendar', () => {
    const worker = readFileSync('supabase/functions/process-scheduled-activities/index.ts', 'utf8');
    for (const table of ['gigs', 'band_rehearsals', 'recording_sessions', 'pr_media_offers']) {
      expect(worker).toContain(`requireLinkedStatus('${table}'`);
    }
    for (const name of ['complete-gig', 'complete-rehearsals', 'complete-recording-sessions', 'cleanup-songwriting', 'process-pr-activity']) {
      expect(worker).toContain(`requireWorkerSuccess('${name}'`);
    }
    expect(worker).toContain(".eq('status', 'in_progress')");
    expect(worker).toContain('failedCompletionMetadata(');
    expect(worker).toContain("activity.activity_type === 'travel'");
    expect(worker).not.toContain(".update({ status: 'missed' })");
  });
});
