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

describe('gig ticket prediction trigger hotfix', () => {
  const triggerHotfixSql = readFileSync('supabase/migrations/20260728123000_fix_gig_ticket_prediction_fame.sql', 'utf8');

  it('repairs the before-insert prediction helper used by gig creation', () => {
    expect(triggerHotfixSql).toContain('CREATE OR REPLACE FUNCTION public.calculate_predicted_tickets');
    expect(triggerHotfixSql).toContain('COALESCE(global_fame, 0)');
    expect(triggerHotfixSql).not.toMatch(/COALESCE\(fame,/);
  });

  it('keeps the trigger helper executable by the booking roles', () => {
    expect(triggerHotfixSql).toContain('TO authenticated, service_role');
  });
});


describe('legacy current-travel gig booking blocker', () => {
  const travelHotfixSql = readFileSync('supabase/migrations/20260728130000_replace_legacy_gig_travel_trigger.sql', 'utf8');

  it('replaces the current-travel trigger with a scheduled interval check', () => {
    expect(travelHotfixSql).toContain('DROP TRIGGER IF EXISTS prevent_gig_booking_while_traveling ON public.gigs');
    expect(travelHotfixSql).toContain('CREATE TRIGGER check_gig_member_schedule_conflicts');
    expect(travelHotfixSql).toContain('a.scheduled_start < v_end');
    expect(travelHotfixSql).toContain('a.scheduled_end > NEW.scheduled_date');
  });

  it('returns the existing player-facing conflict code', () => {
    expect(travelHotfixSql).toContain("RAISE EXCEPTION 'gig_booking_band_conflict'");
  });
});

describe('fully audited gig booking runtime repair', () => {
  const runtimeSql = readFileSync('supabase/migrations/20260728140000_audit_gig_booking_runtime.sql', 'utf8');

  it('removes the confirmed unused song duration dependency', () => {
    const rpc = runtimeSql.slice(runtimeSql.indexOf('CREATE OR REPLACE FUNCTION public.book_gig'));
    expect(rpc).not.toContain('song.duration_seconds');
    expect(rpc).not.toContain('v_setlist_seconds');
    expect(rpc).toContain('INTO v_song_count');
  });

  it('uses one canonical performing-member helper for booking and its gig trigger', () => {
    expect(runtimeSql.match(/active_band_performing_members\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(runtimeSql).toContain("COALESCE(bm.member_status, 'active') = 'active'");
    expect(runtimeSql).toContain("COALESCE(bm.is_touring_member, false) = false");
    expect(runtimeSql).toContain('leader_profile.user_id = b.leader_id');
  });

  it('annotates unexpected errors with a named stage while preserving SQLSTATE', () => {
    for (const stage of ['resolve_actor', 'idempotency_check', 'load_band', 'load_venue', 'validate_slot',
      'validate_setlist', 'validate_rider', 'conflict_check', 'calculate_finances', 'debit_balance',
      'insert_gig', 'create_member_activities']) expect(runtimeSql).toContain(`'${stage}'`);
    expect(runtimeSql).toContain('v_error_state = RETURNED_SQLSTATE');
    expect(runtimeSql).toContain('ERRCODE = v_error_state');
  });

  it('reloads the PostgREST schema cache', () => {
    expect(runtimeSql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});

describe('gig lineup trigger membership alignment', () => {
  const lineupSql = readFileSync('supabase/migrations/20260728150000_align_gig_lineup_trigger_members.sql', 'utf8');

  it('uses the canonical performing-member helper instead of duplicating membership fields', () => {
    expect(lineupSql).toContain('public.active_band_performing_members(v_gig.band_id)');
    expect(lineupSql).not.toContain('bm.member_status');
    expect(lineupSql).not.toContain('bm.is_touring_member');
  });

  it('keeps the existing INSERT trigger helper idempotent and refreshes PostgREST', () => {
    expect(lineupSql).toContain('ON CONFLICT ON CONSTRAINT gig_performers_unique DO NOTHING');
    expect(lineupSql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});

describe('final-order gig performer INSERT trigger repair', () => {
  const triggerRepairSql = readFileSync(
    'supabase/migrations/20291218235000_repair_gig_performer_insert_trigger.sql',
    'utf8',
  );

  it('removes optional row fields from the validator that runs during booking', () => {
    const validator = triggerRepairSql.slice(
      triggerRepairSql.indexOf('CREATE OR REPLACE FUNCTION public.validate_gig_performer'),
      triggerRepairSql.indexOf('CREATE OR REPLACE FUNCTION public.seed_gig_performers'),
    );
    expect(validator).not.toContain('NEW.updated_at');
    expect(validator).not.toContain('NEW.performed_at');
    expect(validator).toContain('public.active_band_performing_members(NEW.band_id)');
  });

  it('runs after the 2029 overwrite and verifies the installed definitions', () => {
    expect(triggerRepairSql).toContain('CREATE OR REPLACE FUNCTION public.seed_gig_performers');
    expect(triggerRepairSql).toContain("pg_get_functiondef('public.validate_gig_performer()'::regprocedure)");
    expect(triggerRepairSql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
