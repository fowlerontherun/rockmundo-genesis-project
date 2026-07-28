-- Keep non-scheduling tour edits behind the same permission boundary as booking and cancellation.
-- Date, band and lifecycle changes are deliberately excluded: those require dedicated transactional flows.
CREATE OR REPLACE FUNCTION public.update_tour_metadata(
  p_tour_id uuid,
  p_name text
) RETURNS public.tours
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_name text := btrim(p_name);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'tour_update_unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_tour_id IS NULL THEN
    RAISE EXCEPTION 'tour_update_id_invalid' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(v_name, '') IS NULL OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'tour_update_name_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_tour
    FROM public.tours
   WHERE id = p_tour_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tour_update_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_band_gigs(v_tour.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'tour_update_forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_tour.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'tour_update_status_locked' USING ERRCODE = '55000';
  END IF;

  IF v_tour.name IS DISTINCT FROM v_name THEN
    UPDATE public.tours
       SET name = v_name,
           updated_at = now()
     WHERE id = p_tour_id
     RETURNING * INTO v_tour;
  END IF;

  RETURN v_tour;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tour_metadata(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_tour_metadata(uuid, text) TO authenticated, service_role;
