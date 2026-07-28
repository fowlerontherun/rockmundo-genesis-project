\set ON_ERROR_STOP on
\pset pager off

-- Run with an administrator connection. This file creates no database objects and
-- deliberately uses catalogs that are not exposed through PostgREST.
DO $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND NOT pg_has_role(current_user, 'postgres', 'MEMBER') THEN
    RAISE EXCEPTION 'gig booking diagnostics require a database administrator';
  END IF;
END $$;

SELECT current_database() AS database_name, current_user AS inspected_by, now() AS inspected_at;

-- These versions each have two files in git.  A bare version match is not proof
-- that the gig payload ran: the Supabase ledger can record only one migration for
-- a version, and production may instead have recorded the podcast payload.
SELECT required.version,
       required.expected_gig_migration,
       EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations sm
               WHERE sm.version = required.version) AS version_recorded,
       (SELECT sm.name FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = required.version LIMIT 1) AS recorded_name,
       EXISTS (
         SELECT 1 FROM supabase_migrations.schema_migrations sm
         WHERE sm.version = required.version
           AND sm.name = required.expected_gig_migration
       ) AS gig_payload_recorded
FROM (VALUES
  ('20260728140000', 'audit_gig_booking_runtime'),
  ('20260728150000', 'align_gig_lineup_trigger_members')
) AS required(version, expected_gig_migration)
ORDER BY required.version;

-- A version row cannot distinguish same-version files. The definitions below are
-- therefore the authoritative evidence of which payload reached this database.
SELECT p.oid::regprocedure AS function_identity,
       pg_get_functiondef(p.oid) AS live_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'book_gig', 'active_band_performing_members', 'seed_gig_performers',
    'check_gig_member_schedule_conflicts', 'calculate_predicted_tickets',
    'validate_gig_performer', 'seed_gig_performers_on_insert'
  )
ORDER BY p.proname, p.oid::regprocedure::text;

SELECT c.oid::regclass AS attached_table, t.tgname AS trigger_name,
       CASE t.tgenabled WHEN 'O' THEN 'enabled' WHEN 'D' THEN 'disabled'
         WHEN 'R' THEN 'replica' WHEN 'A' THEN 'always' END AS enabled_mode,
       p.oid::regprocedure AS trigger_function,
       pg_get_triggerdef(t.oid, true) AS trigger_definition,
       pg_get_functiondef(p.oid) AS trigger_function_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname = 'public'
  AND c.relname IN ('gigs','bands','player_scheduled_activities','gig_performers')
ORDER BY c.relname, t.tgname;

-- Columns referenced by the five runtime functions and their directly invoked
-- gig INSERT trigger. Keep this executable contract beside the repair migration.
WITH referenced(table_name, column_name, referenced_by) AS (VALUES
 ('bands','id','book_gig/calculate_predicted_tickets'), ('bands','leader_id','active_band_performing_members'),
 ('bands','global_fame','book_gig/calculate_predicted_tickets'), ('bands','popularity','book_gig'), ('bands','band_balance','book_gig'),
 ('band_members','id','active_band_performing_members/seed_gig_performers'), ('band_members','band_id','active_band_performing_members/seed_gig_performers'),
 ('band_members','profile_id','active_band_performing_members/seed_gig_performers'), ('band_members','user_id','active_band_performing_members'),
 ('band_members','member_status','active_band_performing_members'), ('band_members','is_touring_member','active_band_performing_members'),
 ('band_members','instrument_role','seed_gig_performers'), ('band_members','role','seed_gig_performers'), ('band_members','joined_at','seed_gig_performers'),
 ('profiles','id','book_gig/active_band_performing_members'), ('profiles','user_id','book_gig/active_band_performing_members'),
 ('venues','id','book_gig/set_predicted_tickets'), ('venues','city_id','book_gig'), ('venues','name','book_gig'),
 ('venues','capacity','book_gig/set_predicted_tickets'), ('venues','base_payment','book_gig'), ('cities','id','book_gig'), ('cities','timezone','book_gig'),
 ('setlists','id','book_gig'), ('setlists','band_id','book_gig'), ('setlists','is_active','book_gig'),
 ('setlist_songs','setlist_id','book_gig'), ('setlist_songs','song_id','book_gig'),
 ('gigs','id','book_gig/seed_gig_performers'), ('gigs','band_id','book_gig'), ('gigs','venue_id','book_gig'),
 ('gigs','setlist_id','book_gig'), ('gigs','rider_id','book_gig'), ('gigs','ticket_operator_id','book_gig'),
 ('gigs','scheduled_date','book_gig'), ('gigs','scheduled_end','book_gig/check_gig_member_schedule_conflicts'),
 ('gigs','status','book_gig/seed_gig_performers'), ('gigs','show_type','book_gig'), ('gigs','payment','book_gig'),
 ('gigs','booking_fee','book_gig'), ('gigs','ticket_price','book_gig'), ('gigs','time_slot','book_gig'),
 ('gigs','slot_start_time','book_gig'), ('gigs','slot_end_time','book_gig'), ('gigs','slot_attendance_multiplier','book_gig'),
 ('gigs','estimated_attendance','book_gig'), ('gigs','estimated_revenue','book_gig'), ('gigs','attendance','book_gig'),
 ('gigs','fan_gain','book_gig'), ('gigs','predicted_tickets','book_gig/set_predicted_tickets'), ('gigs','tickets_sold','book_gig/set_predicted_tickets'),
 ('gigs','last_ticket_update','book_gig'), ('gigs','booking_request_id','book_gig'),
 ('band_riders','id','book_gig'), ('band_riders','band_id','book_gig'), ('band_riders','total_cost_estimate','book_gig'),
 ('band_activity_lockouts','band_id','book_gig'), ('band_activity_lockouts','locked_until','book_gig'),
 ('player_scheduled_activities','user_id','book_gig'), ('player_scheduled_activities','profile_id','book_gig/check_gig_member_schedule_conflicts'),
 ('player_scheduled_activities','activity_type','book_gig'), ('player_scheduled_activities','scheduled_start','book_gig/check_gig_member_schedule_conflicts'),
 ('player_scheduled_activities','scheduled_end','book_gig/check_gig_member_schedule_conflicts'), ('player_scheduled_activities','status','book_gig/check_gig_member_schedule_conflicts'),
 ('player_scheduled_activities','title','book_gig'), ('player_scheduled_activities','location','book_gig'),
 ('player_scheduled_activities','linked_gig_id','book_gig'), ('player_scheduled_activities','metadata','book_gig'),
 ('gig_performers','gig_id','seed_gig_performers'), ('gig_performers','band_id','seed_gig_performers'),
 ('gig_performers','profile_id','seed_gig_performers'), ('gig_performers','role_or_instrument','seed_gig_performers'),
 ('gig_performers','lineup_status','seed_gig_performers'), ('gig_performers','selected_at','seed_gig_performers/validate_gig_performer')
)
SELECT r.* FROM referenced r
LEFT JOIN information_schema.columns c ON c.table_schema='public'
 AND c.table_name=r.table_name AND c.column_name=r.column_name
WHERE c.column_name IS NULL
ORDER BY r.table_name, r.column_name;
