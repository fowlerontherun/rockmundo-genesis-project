-- Publish all chart rankings as a single transaction, never delete first in one API call.
CREATE OR REPLACE FUNCTION public.replace_chart_entries_atomic(
  p_chart_date date, p_entries jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count integer;
BEGIN
 IF p_chart_date IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Chart date and entries array required';
 END IF;
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_entries) entry
   WHERE (entry->>'chart_date')::date IS DISTINCT FROM p_chart_date
 ) THEN RAISE EXCEPTION 'Chart entries must match requested date'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('rockmundo:chart:' || p_chart_date::text));
 DELETE FROM public.chart_entries WHERE chart_date=p_chart_date;
 INSERT INTO public.chart_entries
   (song_id,chart_type,rank,plays_count,weekly_plays,combined_score,chart_date,genre,country,entry_type,release_id)
 SELECT song_id,chart_type,rank,plays_count,weekly_plays,combined_score,chart_date,genre,country,entry_type,release_id
 FROM jsonb_to_recordset(p_entries) AS x(
   song_id uuid,chart_type text,rank integer,plays_count bigint,weekly_plays bigint,
   combined_score bigint,chart_date date,genre text,country text,entry_type text,release_id uuid
 );
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.replace_chart_entries_atomic(date,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_chart_entries_atomic(date,jsonb) TO service_role;
