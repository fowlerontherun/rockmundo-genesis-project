-- Forward-only refinement of the already-merged member appearance RPC.
-- Keep 20291220110000 immutable for environments that have applied it.
-- The full CREATE OR REPLACE body also works when installing from scratch.
-- Character-scoped, read-only festival appearance projection for both members'
-- personal schedules and My Gigs. No parallel gigs, attendance, money or
-- player_scheduled_activities rows are created.
CREATE OR REPLACE FUNCTION public.get_my_band_festival_appearances()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'festival_appearances_login_required' USING ERRCODE = 'P0001';
  END IF;

  v_profile_id := public._caller_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_appearances_character_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(appearances)
    ORDER BY appearances.festival_date, appearances.confirmed_start_at NULLS LAST,
             appearances.festival_name, appearances.booking_id), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      booking.id AS booking_id,
      booking.band_id,
      band.name AS band_name,
      edition.id AS edition_id,
      edition.festival_company_id,
      coalesce(NULLIF(company.public_name, ''), edition.name) AS festival_name,
      company.slug AS festival_slug,
      edition.status AS festival_status,
      edition.starts_on AS festival_starts_on,
      edition.ends_on AS festival_ends_on,
      city.name AS city_name,
      city.country AS country_name,
      city.timezone AS venue_timezone,
      booking.status AS booking_status,
      booking.billing_position,
      booking.set_minutes,
      session.status::text AS session_status,
      coalesce((coalesce(session.scheduled_start_at, slot.start_time)
        AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date,
        booking.provisional_date, edition.starts_on) AS festival_date,
      coalesce(session.scheduled_start_at, slot.start_time) AS confirmed_start_at,
      coalesce(session.scheduled_end_at, slot.end_time) AS confirmed_end_at,
      coalesce(stage.public_name, stage.stage_name) AS stage_name,
      (coalesce(session.scheduled_start_at, slot.start_time) IS NOT NULL
       AND coalesce(session.scheduled_end_at, slot.end_time) IS NOT NULL)
        AS time_confirmed
    FROM public.festival_artist_bookings booking
    JOIN public.festival_artist_programmes programme
      ON programme.id=booking.festival_artist_programme_id
    JOIN public.festival_editions_v2 edition
      ON edition.id=programme.festival_edition_id
    JOIN public.festival_companies company
      ON company.id=edition.festival_company_id
    JOIN public.bands band ON band.id=booking.band_id
    JOIN public.band_members member
      ON member.band_id=booking.band_id AND member.profile_id=v_profile_id
      AND member.member_status='active'
    LEFT JOIN public.cities city ON city.id=edition.city_id
    LEFT JOIN public.festival_artist_booking_canonical_links link
      ON link.artist_booking_id=booking.id AND link.edition_id=edition.id
    LEFT JOIN public.festival_contracts contract
      ON contract.id=link.canonical_contract_id
      AND contract.status NOT IN ('cancelled','terminated')
    LEFT JOIN public.festival_stage_slots slot
      ON slot.id=coalesce(link.stage_slot_id,contract.stage_slot_id)
      AND slot.status IN ('confirmed','performing','completed')
    LEFT JOIN public.festival_performance_sessions session
      ON session.contract_id=contract.id
      AND session.status NOT IN ('cancelled')
    LEFT JOIN public.festival_stages stage ON stage.id=coalesce(slot.stage_id, session.stage_id)
    WHERE booking.artist_type='band'
      AND booking.status IN ('confirmed','awaiting_schedule','scheduled')
      AND edition.status<>'cancelled'
      AND edition.ends_on >= current_date-366
      AND edition.starts_on <= current_date+730
    ORDER BY edition.starts_on,booking.id
    LIMIT 200
  ) appearances;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_band_festival_appearances() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_band_festival_appearances() TO authenticated;

COMMENT ON FUNCTION public.get_my_band_festival_appearances() IS
  'Band-member-only confirmed festival appearances for gig lists and schedules;'
  ' real slot times only after canonical booking; no synthetic schedules.';
NOTIFY pgrst, 'reload schema';
