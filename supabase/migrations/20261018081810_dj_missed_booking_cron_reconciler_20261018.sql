-- Reconcile unstarted DJ bookings after their end+grace, with no reward.
-- Runs inside Postgres; pg_cron stores NO API keys / JWTs.

CREATE OR REPLACE FUNCTION private.dj_process_missed_at(
  p_at timestamptz, p_max integer DEFAULT 50
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
 v_book record;
 v_count integer := 0;
 v_previous text := current_setting('request.jwt.claim.sub',true);
BEGIN
 IF p_at IS NULL OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'DJ missed-set sweep requires valid clock and batch size'
  USING ERRCODE='22023'; END IF;
 FOR v_book IN
   SELECT b.id,b.user_id
   FROM public.dj_bookings b
   WHERE b.status IN ('booked','ready')
     AND b.ends_at + interval '10 minutes' <= p_at
   ORDER BY b.ends_at,b.id
   FOR UPDATE SKIP LOCKED
   LIMIT p_max
 LOOP
   PERFORM set_config('request.jwt.claim.sub',v_book.user_id::text,true);
   PERFORM private.dj_mark_missed_at(v_book.id,p_at);
   v_count:=v_count+1;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_process_missed_at(timestamptz,integer)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.process_missed_dj_bookings_internal(
 p_max integer DEFAULT 50
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
BEGIN
 RETURN private.dj_process_missed_at(clock_timestamp(),p_max);
END;
$$;
REVOKE ALL ON FUNCTION public.process_missed_dj_bookings_internal(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_missed_dj_bookings_internal(integer)
 TO service_role;

-- Supabase pg_cron runs this SQL on the server every 15 minutes. No HTTP
-- endpoint, JWT, cron token, static credential or service key in the job.
SELECT cron.schedule(
  'dj-mark-missed-sets',
  '*/15 * * * *',
  'SELECT public.process_missed_dj_bookings_internal(50);'
);

COMMENT ON FUNCTION public.process_missed_dj_bookings_internal(integer) IS
 'Server-only pg_cron worker marking never-started expired DJ slots missed; does not charge energy or grant rewards.';
