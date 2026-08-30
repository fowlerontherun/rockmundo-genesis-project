CREATE OR REPLACE FUNCTION public.debug_travel_dry_run(p_user_id uuid, p_dest uuid, p_mode text, p_departure timestamptz, p_fare integer, p_hours numeric)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg text;
BEGIN
  BEGIN
    PERFORM public.book_authoritative_travel(p_user_id, p_dest, p_mode, p_departure, p_fare, p_hours, gen_random_uuid(), '{}'::jsonb);
    RAISE EXCEPTION 'DRY_RUN_OK';
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLSTATE || ': ' || SQLERRM;
  END;
  RETURN v_msg;
END;
$$;
REVOKE ALL ON FUNCTION public.debug_travel_dry_run(uuid,uuid,text,timestamptz,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debug_travel_dry_run(uuid,uuid,text,timestamptz,integer,numeric) TO service_role;