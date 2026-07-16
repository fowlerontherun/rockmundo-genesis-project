import { describe, expect, it } from 'vitest';
import { deriveBookingProgress } from '../progress';

describe('booking progress projection', () => {
  it('does not mark rejected applications as complete', () => {
    const progress = deriveBookingProgress({ application: { id: 'a', edition_id: 'e', band_id: 'b', status: 'rejected' } });
    expect(progress.find((step) => step.label === 'Application')?.state).toBe('failed');
  });

  it('shows changes-requested setlists as blocked', () => {
    const progress = deriveBookingProgress({ setlist: { status: 'changes_requested', version: 2, items: [] } });
    expect(progress.find((step) => step.label === 'Setlist')?.state).toBe('blocked');
  });
});
