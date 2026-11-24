import { describe, expect, it } from 'vitest';
import { summarizeSupportCoverage } from '@/lib/tourReadiness';
import type { TourSupportAssignment } from '@/features/support-bands/tourManagementApi';

const now = Date.parse('2026-11-24T12:00:00.000Z');
const assignment = (id: string, date: string, status: string | null): TourSupportAssignment => ({
  gig_id: id, scheduled_date: date, scheduled_end: null, venue_id: 'v', venue_name: 'Venue',
  city_id: 'c', city_name: 'City', support_slot_id: status ? id : null,
  support_band_id: status ? 'support' : null, support_band_name: status ? 'Support' : null,
  support_status: status, revenue_share: null, invited_at: null, responded_at: null,
});

describe('tour readiness support coverage', () => {
  it('distinguishes booked support, pending consent and open future dates', () => {
    const rows = [
      assignment('past', '2026-11-20T12:00:00Z', 'completed'),
      assignment('a', '2026-12-01T12:00:00Z', 'accepted'),
      assignment('b', '2026-12-02T12:00:00Z', 'pending'),
      assignment('c', '2026-12-03T12:00:00Z', null),
    ];
    expect(summarizeSupportCoverage(rows, now)).toEqual({ total: 3, confirmed: 1, pending: 1, open: 1 });
  });

  it('does not claim support coverage when no future dates remain', () => {
    expect(summarizeSupportCoverage([assignment('past', '2026-11-01T12:00:00Z', 'completed')], now))
      .toEqual({ total: 0, confirmed: 0, pending: 0, open: 0 });
  });
});
