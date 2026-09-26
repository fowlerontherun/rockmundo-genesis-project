-- Disposable PostgreSQL fixture: this is intentionally NOT a production migration.
-- Exercises the new RPC against a minimal copy of the real data contract while
-- the repository-wide Supabase reset is blocked by a legacy TV seed FK.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;

CREATE TABLE public.profiles(id uuid PRIMARY KEY, user_id uuid NOT NULL, is_active boolean NOT NULL);
CREATE OR REPLACE FUNCTION public._caller_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO ''
  AS $$ SELECT p.id FROM public.profiles p WHERE p.user_id=auth.uid() AND p.is_active ORDER BY p.id LIMIT 1 $$;
CREATE TABLE public.bands(id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.band_members(band_id uuid NOT NULL,profile_id uuid NOT NULL,member_status text NOT NULL);
CREATE TABLE public.festival_companies(id uuid PRIMARY KEY,public_name text,slug text);
CREATE TABLE public.cities(id uuid PRIMARY KEY,name text,country text,timezone text);
CREATE TABLE public.festival_editions_v2(
  id uuid PRIMARY KEY,festival_company_id uuid NOT NULL,status text NOT NULL,
  starts_on date NOT NULL,ends_on date NOT NULL,city_id uuid
);
CREATE TABLE public.festival_artist_programmes(id uuid PRIMARY KEY,festival_edition_id uuid NOT NULL);
CREATE TABLE public.festival_artist_bookings(
  id uuid PRIMARY KEY,festival_artist_programme_id uuid NOT NULL,artist_type text NOT NULL,
  band_id uuid,status text NOT NULL,billing_position text,
  set_minutes integer,provisional_date date
);
CREATE TABLE public.festival_stages(id uuid PRIMARY KEY,public_name text,stage_name text);
CREATE TABLE public.festival_stage_slots(
  id uuid PRIMARY KEY,stage_id uuid,status text NOT NULL,
  start_time timestamptz,end_time timestamptz
);
CREATE TABLE public.festival_contracts(id uuid PRIMARY KEY,stage_slot_id uuid,status text NOT NULL);
CREATE TABLE public.festival_artist_booking_canonical_links(
  id uuid PRIMARY KEY,artist_booking_id uuid NOT NULL,edition_id uuid NOT NULL,
  canonical_contract_id uuid,stage_slot_id uuid
);
CREATE TABLE public.festival_performance_sessions(
  id uuid PRIMARY KEY,contract_id uuid,stage_id uuid,status text NOT NULL,
  scheduled_start_at timestamptz,scheduled_end_at timestamptz
);
INSERT INTO public.profiles VALUES
('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',true),
('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002',true),
('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003',true),
('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000004',true);
INSERT INTO public.bands VALUES
('33333333-0000-0000-0000-000000000001','Shockmaster'),
('33333333-0000-0000-0000-000000000002','WAR DOGS');
INSERT INTO public.band_members VALUES
('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','active'),
('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','active'),
('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000003','active');
INSERT INTO public.cities VALUES
('44444444-0000-0000-0000-000000000001','London','United Kingdom','Europe/London');
INSERT INTO public.festival_companies VALUES
('55555555-0000-0000-0000-000000000001','Shock Festival','shock-festival');
INSERT INTO public.festival_editions_v2 VALUES
('66666666-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000001',
 'announced','2026-09-26','2026-09-27','44444444-0000-0000-0000-000000000001');
INSERT INTO public.festival_artist_programmes VALUES
('77777777-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001');
INSERT INTO public.festival_artist_bookings VALUES
('88888888-0000-0000-0000-000000000001','77777777-0000-0000-0000-000000000001',
 'band','33333333-0000-0000-0000-000000000001','confirmed','support',60,'2026-09-26'),
('88888888-0000-0000-0000-000000000002','77777777-0000-0000-0000-000000000001',
 'band','33333333-0000-0000-0000-000000000002','confirmed','support',60,'2026-09-26');

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

-- At first, both confirmed bookings have a provisional date but no stage time.
-- The first two tests prove that all members, not just leaders, see the
-- correct band booking and that another user's data does not leak.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF jsonb_array_length(r)<>1 OR r->0->>'band_name'<>'Shockmaster'
     OR r->0->>'festival_date'<>'2026-09-26'
     OR r->0->>'venue_timezone'<>'Europe/London'
     OR r->0->>'time_confirmed'<>'false' THEN
    RAISE EXCEPTION 'Shockmaster member booking projection failed: %',r;
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000002',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF jsonb_array_length(r)<>1 OR r->0->>'band_name'<>'WAR DOGS' THEN
    RAISE EXCEPTION 'WAR DOGS member booking projection failed: %',r;
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000003',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF jsonb_array_length(r)<>1 OR r->0->>'band_name'<>'WAR DOGS' THEN
    RAISE EXCEPTION 'Other active WAR DOGS member did not see booking: %',r;
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000004',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF jsonb_array_length(r)<>0 THEN
    RAISE EXCEPTION 'Non-member saw a private booking: %',r;
  END IF;
END $$;
RESET ROLE;

-- A booked-but-unconfirmed slot must NOT advertise an authoritative set time.
INSERT INTO public.festival_stages VALUES
('99999999-0000-0000-0000-000000000001','Main Stage','Main Stage');
INSERT INTO public.festival_stage_slots VALUES
('aaaaaaaa-0000-0000-0000-000000000001','99999999-0000-0000-0000-000000000001',
 'booked','2026-09-26T18:00:00Z','2026-09-26T19:00:00Z');
INSERT INTO public.festival_contracts VALUES
('bbbbbbbb-0000-0000-0000-000000000001',
 'aaaaaaaa-0000-0000-0000-000000000001','active');
INSERT INTO public.festival_artist_booking_canonical_links VALUES
('cccccccc-0000-0000-0000-000000000001',
 '88888888-0000-0000-0000-000000000001',
 '66666666-0000-0000-0000-000000000001',
 'bbbbbbbb-0000-0000-0000-000000000001',
 'aaaaaaaa-0000-0000-0000-000000000001');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF r->0->>'time_confirmed'<>'false' OR r->0->>'confirmed_start_at' IS NOT NULL THEN
    RAISE EXCEPTION 'Tentative stage slot leaked as confirmed: %',r;
  END IF;
END $$;
RESET ROLE;
UPDATE public.festival_stage_slots SET status='confirmed'
  WHERE id='aaaaaaaa-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF r->0->>'time_confirmed'<>'true'
     OR (r->0->>'confirmed_start_at')::timestamptz<>'2026-09-26T18:00:00Z'::timestamptz
     OR r->0->>'stage_name'<>'Main Stage' THEN
    RAISE EXCEPTION 'Confirmed Festival stage slot not reflected: %',r;
  END IF;
END $$;
RESET ROLE;
-- Subsequent cancellation must remove this booking from all members' feeds.
UPDATE public.festival_artist_bookings SET status='cancelled'
 WHERE id='88888888-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-0000-0000-0000-000000000001',false);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.get_my_band_festival_appearances() INTO r;
  IF jsonb_array_length(r)<>0 THEN
    RAISE EXCEPTION 'Cancelled Festival booking remained in calendar';
  END IF;
END $$;
RESET ROLE;
SELECT 'PASS: member-level visibility, TBA/confirmed set times and cancellation' AS fixture_result;
