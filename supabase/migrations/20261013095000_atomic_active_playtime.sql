-- Server-authoritative playtime accounting. Lock one row per character so
-- concurrent tabs cannot read/write stale totals or double-credit minutes.
CREATE TABLE IF NOT EXISTS public.character_playtime_heartbeats (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_credited_at timestamptz NOT NULL DEFAULT now(),
  accumulated_seconds numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.character_playtime_heartbeats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_playtime_heartbeats FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.record_active_character_playtime(p_profile_id uuid,p_reset boolean DEFAULT false)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.character_playtime_heartbeats%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_seconds numeric;
  v_total numeric;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=v_user
      AND deleted_at IS NULL AND died_at IS NULL
  ) THEN RAISE EXCEPTION 'Not allowed to record character activity' USING ERRCODE='42501'; END IF;
  INSERT INTO public.character_playtime_heartbeats(profile_id,last_credited_at,accumulated_seconds)
  SELECT p_profile_id,v_now,coalesce(total_hours_played,0)*3600
  FROM public.profiles WHERE id=p_profile_id
  ON CONFLICT(profile_id) DO NOTHING;
  SELECT * INTO v_row FROM public.character_playtime_heartbeats
    WHERE profile_id=p_profile_id FOR UPDATE;
  -- A single valid heartbeat can credit no more than the last 120 seconds:
  -- hidden/idle tabs and long suspensions cannot award hours at once.
  v_seconds:=CASE WHEN p_reset THEN 0 ELSE least(120,greatest(0,extract(epoch from (v_now-v_row.last_credited_at)))) END;
  v_total:=v_row.accumulated_seconds + v_seconds;
  UPDATE public.character_playtime_heartbeats SET
    last_credited_at=v_now, accumulated_seconds=v_total WHERE profile_id=p_profile_id;
  UPDATE public.profiles SET
    total_hours_played=greatest(coalesce(total_hours_played,0),floor(v_total/3600)),
    last_login_at=v_now WHERE id=p_profile_id AND user_id=v_user
    AND deleted_at IS NULL AND died_at IS NULL;
  RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.record_active_character_playtime(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_active_character_playtime(uuid) TO authenticated;
