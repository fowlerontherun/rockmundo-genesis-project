-- Housekeeping cannot pay or book anything; it only closes expired/finished agreements.
CREATE FUNCTION private.close_stale_nightclub_dj_residencies_internal(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE r public.nightclub_dj_residencies%ROWTYPE;
 closed integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Residency sweep limit invalid' USING ERRCODE='22023';END IF;
 FOR r IN SELECT * FROM public.nightclub_dj_residencies a
  WHERE (a.status='proposed' AND a.expires_at<=clock_timestamp())
  OR (a.status='agreed' AND a.planned_starts_at[array_length(a.planned_starts_at,1)]
   +interval '4 hours'<=clock_timestamp())
  ORDER BY a.expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  UPDATE public.nightclub_dj_residencies
  SET status=CASE WHEN r.status='proposed' THEN 'expired' ELSE 'ended' END,
  updated_at=clock_timestamp(),
  ended_at=CASE WHEN r.status='agreed' THEN clock_timestamp() ELSE ended_at END
  WHERE id=r.id;
  closed:=closed+1;
 END LOOP;
 RETURN closed;
END $$;
REVOKE ALL ON FUNCTION private.close_stale_nightclub_dj_residencies_internal(integer)
 FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('dj-residency-agreement-rollover','17 * * * *',
'SELECT private.close_stale_nightclub_dj_residencies_internal(100);');