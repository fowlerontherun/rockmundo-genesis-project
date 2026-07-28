import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260727120000_atomic_gig_booking.sql', 'utf8');

describe('atomic gig booking database contract', () => {
  it('authorises a leader through the authenticated profile even without a membership row', () => {
    expect(sql).toContain('b.leader_id = a.profile_id');
    expect(sql).toContain("SELECT v_band.leader_id WHERE EXISTS");
  });
  it('authorises only active non-touring members with a gig permission', () => {
    expect(sql).toContain("COALESCE(bm.member_status, 'active') = 'active'");
    expect(sql).toContain("brp.permission_key IN ('gigs.apply','gigs.accept')");
    expect(sql).toContain("o.effect = 'deny'");
  });
  it('rejects an unrelated caller before locking or charging the band', () => {
    const rpc = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.book_gig'));
    expect(rpc.indexOf('gig_booking_forbidden')).toBeLessThan(rpc.indexOf('FOR UPDATE'));
    expect(sql.indexOf('gig_booking_forbidden')).toBeLessThan(sql.indexOf('band_balance=band_balance-v_booking_fee'));
  });
  it('deducts exactly once and rolls back all failures in the same function transaction', () => {
    expect(sql.match(/band_balance=band_balance-v_booking_fee/g)).toHaveLength(1);
    expect(sql.indexOf('band_balance=band_balance-v_booking_fee')).toBeLessThan(sql.indexOf('INSERT INTO public.gigs'));
    expect(sql).not.toContain('EXCEPTION WHEN');
  });
  it('uses a unique request id for idempotent repeated submissions', () => {
    expect(sql).toContain('gigs_booking_request_uidx');
    expect(sql).toContain("'already_booked', true");
  });
  it('rejects insufficient funds without inserting a gig', () => {
    expect(sql.indexOf('gig_booking_insufficient_funds')).toBeLessThan(sql.indexOf('INSERT INTO public.gigs'));
  });
  it('rejects past dates, lockouts, cooldowns, and invalid setlists/riders', () => {
    for (const code of ['gig_booking_past_date', 'gig_booking_band_lockout', 'gig_booking_venue_cooldown', 'gig_booking_setlist_invalid', 'gig_booking_rider_invalid']) {
      expect(sql).toContain(code);
    }
  });
  it('uses direct UTC overlap checks for both band and venue', () => {
    expect(sql.match(/scheduled_date < v_end/g).length).toBeGreaterThanOrEqual(2);
    expect(sql.match(/> v_start/g).length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toContain('time_slot=p_slot');
  });
  it('constructs venue-local timestamps and advances overnight end dates', () => {
    expect(sql).toContain('AT TIME ZONE v_timezone');
    expect(sql).toContain("v_end_time <= v_start_time THEN interval '1 day'");
  });
  it('creates idempotent schedule blocks for all active members and a row-less leader', () => {
    expect(sql).toContain('player_schedule_gig_profile_uidx');
    expect(sql).toContain('INSERT INTO public.player_scheduled_activities');
    expect(sql).toContain('ON CONFLICT (linked_gig_id,profile_id)');
  });
  it('accepts a null rider but validates a supplied rider belongs to the band', () => {
    expect(sql).toContain('p_rider_id uuid DEFAULT NULL');
    expect(sql).toContain('WHERE id=p_rider_id AND band_id=p_band_id');
  });
  it('keeps schedule creation before the function returns, so failure rolls everything back', () => {
    expect(sql.indexOf('INSERT INTO public.player_scheduled_activities')).toBeLessThan(sql.lastIndexOf('RETURN jsonb_build_object'));
  });
});

describe('gig booking band fame hotfix', () => {
  const hotfixSql = readFileSync('supabase/migrations/20260728120000_fix_gig_booking_band_fame.sql', 'utf8');

  it('uses the actual bands fame column in the booking forecast', () => {
    expect(hotfixSql).toContain('v_band.global_fame');
    expect(hotfixSql).not.toContain('v_band.fame');
  });

  it('replaces the complete atomic booking function and preserves its grant', () => {
    expect(hotfixSql).toContain('CREATE OR REPLACE FUNCTION public.book_gig');
    expect(hotfixSql).toContain("UPDATE public.bands SET band_balance = band_balance - v_booking_fee");
    expect(hotfixSql).toContain('INSERT INTO public.player_scheduled_activities');
    expect(hotfixSql).toContain('GRANT EXECUTE ON FUNCTION public.book_gig');
  });
});
