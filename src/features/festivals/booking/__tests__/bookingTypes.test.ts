import { describe, expect, it } from 'vitest';
import {
  bothSidesSigned,
  calculateTotalDuration,
  canAcceptRevision,
  canCounterOffer,
  canTransitionApplication,
  canTransitionContract,
  canTransitionSetlist,
  ensureCurrentRevision,
  festivalBookingKeys,
  hashSetlistContent,
  mapBookingError,
  projectPublicLineup,
  requiredSignatureSides,
  selectCurrentRevision,
  selectCurrentSetlistVersion,
  termsChanged,
  validateFestivalSetlist,
} from '../bookingTypes';

describe('festival booking helpers', () => {
  it('validates all core application transitions', () => {
    expect(canTransitionApplication('draft', 'submitted')).toBe(true);
    expect(canTransitionApplication('submitted', 'under_review')).toBe(true);
    expect(canTransitionApplication('under_review', 'shortlisted')).toBe(true);
    expect(canTransitionApplication('shortlisted', 'offer_pending')).toBe(true);
    expect(canTransitionApplication('offer_pending', 'converted_to_contract')).toBe(true);
    expect(canTransitionApplication('rejected', 'submitted')).toBe(false);
  });

  it('validates contract transitions', () => {
    expect(canTransitionContract('awaiting_signatures', 'active')).toBe(true);
    expect(canTransitionContract('active', 'amendment_required')).toBe(true);
    expect(canTransitionContract('cancelled', 'active')).toBe(false);
    expect(canTransitionContract('awaiting_signatures', 'fulfilled')).toBe(false);
  });

  it('validates setlist transitions', () => {
    expect(canTransitionSetlist('draft', 'submitted')).toBe(true);
    expect(canTransitionSetlist('submitted', 'approved')).toBe(true);
    expect(canTransitionSetlist('approved', 'locked')).toBe(true);
    expect(canTransitionSetlist('draft', 'locked')).toBe(false);
    expect(canTransitionSetlist('locked', 'draft')).toBe(false);
  });

  it('checks current offer revisions and proposer acceptance rules', () => {
    expect(canCounterOffer('sent', 2, 2)).toBe(true);
    expect(canCounterOffer('sent', 1, 2)).toBe(false);
    expect(canAcceptRevision('organiser', 'band')).toBe(true);
    expect(canAcceptRevision('band', 'band')).toBe(false);
    expect(() => ensureCurrentRevision(1, 2)).toThrow('Stale offer revision');
  });

  it('requires both contract signatures on the same version and hash', () => {
    expect(requiredSignatureSides('awaiting_signatures')).toEqual(['band', 'organiser']);
    expect(
      bothSidesSigned(
        [
          { signing_side: 'band', contract_version: 1, terms_hash: 'abc' },
          { signing_side: 'organiser', contract_version: 1, terms_hash: 'abc' },
        ],
        1,
        'abc',
      ),
    ).toBe(true);
    expect(
      bothSidesSigned(
        [
          { signing_side: 'band', contract_version: 1, terms_hash: 'abc' },
          { signing_side: 'organiser', contract_version: 2, terms_hash: 'abc' },
        ],
        1,
        'abc',
      ),
    ).toBe(false);
  });

  it('compares canonicalised terms independently of object insertion order', () => {
    expect(termsChanged({ guarantee_fee_cents: 100, proposed_stage_name: 'Main' }, { proposed_stage_name: 'Main', guarantee_fee_cents: 100 })).toBe(false);
  });

  it('hashes ordered setlist content and validates duplicates/duration', () => {
    const items = [
      { song_id: 'song-1', planned_duration_seconds: 180, is_encore: false },
      { song_id: 'song-2', planned_duration_seconds: 200, is_encore: true },
    ];
    expect(calculateTotalDuration(items)).toBe(380);
    expect(validateFestivalSetlist(items, 600).valid).toBe(true);
    expect(validateFestivalSetlist(items, 300).valid).toBe(false);
    expect(hashSetlistContent(items)).toContain('song-1');
    expect(validateFestivalSetlist([...items, items[0]], 1000).valid).toBe(false);
  });

  it('selects current revisions and setlist versions', () => {
    expect(selectCurrentRevision([{ id: 'r1', revision_number: 1 }, { id: 'r2', revision_number: 2 }], 'r1')?.id).toBe('r1');
    expect(selectCurrentSetlistVersion([{ version: 1 }, { version: 2, is_current: true }])?.version).toBe(2);
  });

  it('maps schedule conflict errors', () => {
    expect(mapBookingError(new Error('hard schedule conflict')).code).toBe('schedule_conflict');
  });

  it('projects public lineup without economics', () => {
    const projected = projectPublicLineup({
      edition_id: 'edition',
      band_id: 'band',
      status: 'active',
      terms_snapshot: { guarantee_fee_cents: 100000, proposed_stage_name: 'Main' },
    });
    expect(projected).toEqual({ edition_id: 'edition', band_id: 'band', stage_display_name: 'Main', slot_type: null, public_status: 'active' });
    expect(projected).not.toHaveProperty('guarantee_fee_cents');
  });

  it('builds stable query keys', () => {
    expect(festivalBookingKeys.contracts('band', 'contract')).toEqual(['festivals', 'booking', 'contracts', 'band', 'contract']);
    expect(festivalBookingKeys.publicLineup('edition')).toEqual(['festivals', 'booking', 'public-lineup', 'edition']);
  });
});
