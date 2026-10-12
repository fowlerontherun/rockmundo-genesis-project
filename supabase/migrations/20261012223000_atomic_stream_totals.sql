-- Prevent lost stream counters when concurrent jobs touch the same release.
CREATE OR REPLACE FUNCTION public.increment_song_release_stream_totals(
  p_release_id uuid, p_daily_streams bigint, p_daily_revenue numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_daily_streams < 0 OR p_daily_revenue < 0 THEN
   RAISE EXCEPTION 'invalid_stream_increment';
 END IF;
 UPDATE public.song_releases SET
   total_streams=coalesce(total_streams,0)+p_daily_streams,
   total_revenue=coalesce(total_revenue,0)+p_daily_revenue
 WHERE id=p_release_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'streaming_release_inactive_or_missing'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.increment_song_release_stream_totals(uuid,bigint,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.increment_song_release_stream_totals(uuid,bigint,numeric) TO service_role;
