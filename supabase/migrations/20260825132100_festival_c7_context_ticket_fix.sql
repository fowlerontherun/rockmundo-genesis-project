-- Follow-up hardening for the C7 context projection: use the canonical
-- attendance -> issued admission ticket -> ticket product relationship used by C5.
CREATE OR REPLACE FUNCTION public._festival_moment_context(p_attendance_id uuid)
RETURNS TABLE (
  attendance public.festival_player_attendance,
  profile_id uuid,
  festival_local_hour integer,
  has_camping boolean,
  has_vip boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_profile_id uuid := public.current_profile_id();
  v_timezone text := 'UTC';
  v_has_camping boolean := false;
  v_has_vip boolean := false;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.* INTO v_attendance
  FROM public.festival_player_attendance a
  WHERE a.id = p_attendance_id
    AND a.profile_id = v_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    coalesce(c.timezone, 'UTC'),
    coalesce(product.includes_camping, false),
    coalesce(product.includes_vip_area, false)
  INTO v_timezone, v_has_camping, v_has_vip
  FROM public.festival_editions_v2 e
  LEFT JOIN public.cities c ON c.id = e.city_id
  LEFT JOIN public.festival_issued_tickets ticket ON ticket.id = v_attendance.admission_ticket_id
  LEFT JOIN public.festival_ticket_products product ON product.id = ticket.festival_ticket_product_id
  WHERE e.id = v_attendance.festival_edition_id;

  RETURN QUERY SELECT
    v_attendance,
    v_profile_id,
    extract(hour FROM (now() AT TIME ZONE v_timezone))::integer,
    v_has_camping,
    v_has_vip;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_moment_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_moment_context(uuid) TO service_role;
