-- #3994: make chart-alert creation and 12-hour cooldown one database
-- transaction. Client-local sets cannot serialize separate browser sessions.
BEGIN;
CREATE TABLE IF NOT EXISTS public.chart_notification_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  chart_type text NOT NULL,
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id,song_id,chart_type)
);
ALTER TABLE public.chart_notification_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chart_notification_cooldowns FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_chart_entry_notification(
  p_profile_id uuid,p_chart_entry_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_entry public.chart_entries%ROWTYPE;
  v_song public.songs%ROWTYPE;
  v_notification_id uuid;
  v_chart_label text;
  v_claimed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id
      AND p.user_id=auth.uid() AND p.deleted_at IS NULL AND p.died_at IS NULL
  ) THEN RAISE EXCEPTION 'Active character is unavailable.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_entry FROM public.chart_entries e WHERE e.id=p_chart_entry_id;
  IF v_entry.id IS NULL OR v_entry.rank IS NULL OR v_entry.rank NOT BETWEEN 1 AND 40 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_song FROM public.songs s WHERE s.id=v_entry.song_id;
  IF v_song.id IS NULL OR NOT (
      v_song.user_id=auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.band_members bm WHERE bm.band_id=v_song.band_id
          AND bm.profile_id=p_profile_id
          AND COALESCE(bm.member_status,'active')='active'
      )
    ) THEN RETURN NULL; END IF;

  -- An atomic UPSERT returns a row only for the first session within the
  -- 12-hour window. Notification INSERT is in the same transaction, so a
  -- failure leaves no burned cooldown and no empty claim.
  INSERT INTO public.chart_notification_cooldowns(profile_id,song_id,chart_type,last_notified_at)
    VALUES (p_profile_id,v_song.id,v_entry.chart_type,now())
    ON CONFLICT (profile_id,song_id,chart_type) DO UPDATE
      SET last_notified_at=EXCLUDED.last_notified_at
      WHERE chart_notification_cooldowns.last_notified_at <= now()-INTERVAL '12 hours'
    RETURNING true INTO v_claimed;
  IF v_claimed IS DISTINCT FROM true THEN RETURN NULL; END IF;

  v_chart_label := CASE v_entry.chart_type
    WHEN 'streaming' THEN 'Streaming Charts'
    WHEN 'radio_airplay' THEN 'Radio Charts'
    WHEN 'record_sales' THEN 'Sales Charts'
    ELSE 'Charts' END;
  INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
  VALUES (
    auth.uid(),p_profile_id,'achievement',
    CASE WHEN v_entry.rank<=10 THEN 'achievement' ELSE 'success' END,
    CASE WHEN v_entry.rank<=10 THEN '🏆 Top 10 Hit!' ELSE 'Charting!' END,
    '"'||left(COALESCE(v_song.title,'Your song'),120)||'" is #'||v_entry.rank::text||' on the '||v_chart_label||'!',
    '/country-charts',
    jsonb_build_object('chart_entry_id',v_entry.id,'song_id',v_song.id,'chart_type',v_entry.chart_type,'rank',v_entry.rank)
  ) RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_chart_entry_notification(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_chart_entry_notification(uuid,uuid) TO authenticated;
COMMIT;
