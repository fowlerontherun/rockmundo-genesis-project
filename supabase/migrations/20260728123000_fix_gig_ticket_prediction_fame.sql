-- Gig inserts run set_predicted_tickets() before they are stored. Its legacy helper
-- still read bands.fame, a column that does not exist, so it aborted book_gig even
-- after book_gig itself was corrected to use bands.global_fame.
CREATE OR REPLACE FUNCTION public.calculate_predicted_tickets(
  p_band_id uuid,
  p_venue_capacity integer,
  p_scheduled_date timestamptz
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_band_fame integer;
  v_days_until_gig integer;
  v_predicted integer;
  v_fame_multiplier numeric;
BEGIN
  SELECT COALESCE(global_fame, 0)
  INTO v_band_fame
  FROM public.bands
  WHERE id = p_band_id;

  v_days_until_gig := GREATEST(0, floor(extract(epoch FROM (p_scheduled_date - now())) / 86400)::integer);
  v_fame_multiplier := LEAST(1.0, 0.2 + (COALESCE(v_band_fame, 0)::numeric / 10000.0 * 0.8));
  v_predicted := floor(GREATEST(COALESCE(p_venue_capacity, 100), 1) * v_fame_multiplier);

  IF v_days_until_gig > 7 THEN
    v_predicted := floor(v_predicted * 0.3);
  ELSIF v_days_until_gig > 3 THEN
    v_predicted := floor(v_predicted * 0.6);
  END IF;

  RETURN GREATEST(10, v_predicted);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_predicted_tickets(uuid, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_predicted_tickets(uuid, integer, timestamptz) TO authenticated, service_role;
