CREATE TABLE IF NOT EXISTS public.christmas_release_bonuses (
 release_id uuid PRIMARY KEY REFERENCES public.releases(id) ON DELETE CASCADE,
 release_title text NOT NULL,
 matched_title text NOT NULL,
 artist_name text NOT NULL,
 xp_per_member integer NOT NULL CHECK (xp_per_member > 0),
 recipients integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.christmas_release_bonuses TO authenticated;
GRANT ALL ON public.christmas_release_bonuses TO service_role;
ALTER TABLE public.christmas_release_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY christmas_release_bonuses_read ON public.christmas_release_bonuses FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_festive_release_window(p_at timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT extract(month FROM p_at AT TIME ZONE 'Europe/London') = 12
  OR mod(greatest(0,floor(extract(epoch FROM (p_at - timestamptz '2026-01-01 00:00:00+00'))/86400)::integer), 120) >= 110
$$;

CREATE OR REPLACE FUNCTION public._award_christmas_release_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match text; v_xp constant integer := 250; v_artist text; v_count integer := 0; v_pid uuid;
BEGIN
 IF NEW.release_status IS DISTINCT FROM 'released' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.release_status IS NOT DISTINCT FROM 'released' THEN RETURN NEW; END IF;
 IF NOT public.is_festive_release_window(now()) THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM public.christmas_release_bonuses WHERE release_id=NEW.id) THEN RETURN NEW; END IF;
 SELECT t INTO v_match FROM (
   SELECT NEW.title::text AS t, 0 AS o
   UNION ALL SELECT s.title::text, 1 FROM public.release_songs rs JOIN public.songs s ON s.id=rs.song_id WHERE rs.release_id=NEW.id
 ) x WHERE t ~* '(christmas|xmas|snow)' ORDER BY o LIMIT 1;
 IF v_match IS NULL THEN RETURN NEW; END IF;
 SELECT coalesce(nullif(NEW.artist_name,''),nullif(b.artist_name,''),nullif(b.name,''),'Unknown Artist') INTO v_artist
  FROM (SELECT 1) d LEFT JOIN public.bands b ON b.id=NEW.band_id;
 FOR v_pid IN
  SELECT DISTINCT p.id FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id
   WHERE NEW.band_id IS NOT NULL AND bm.band_id=NEW.band_id AND coalesce(bm.member_status,'active')='active'
     AND coalesce(bm.is_touring_member,false)=false AND p.died_at IS NULL
  UNION
  SELECT p.id FROM public.profiles p
   WHERE NEW.band_id IS NULL AND p.user_id=NEW.user_id AND p.is_active=true AND p.died_at IS NULL
 LOOP
  INSERT INTO public.player_xp_wallet(profile_id) VALUES(v_pid) ON CONFLICT(profile_id) DO NOTHING;
  UPDATE public.player_xp_wallet SET xp_balance=coalesce(xp_balance,0)+v_xp, lifetime_xp=coalesce(lifetime_xp,0)+v_xp,
   skill_xp_balance=coalesce(skill_xp_balance,0)+v_xp, skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_xp,
   last_recalculated=now() WHERE profile_id=v_pid;
  v_count := v_count + 1;
 END LOOP;
 INSERT INTO public.christmas_release_bonuses(release_id,release_title,matched_title,artist_name,xp_per_member,recipients)
 VALUES(NEW.id,NEW.title,v_match,v_artist,v_xp,v_count) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._award_christmas_release_bonus() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS trg_christmas_release_bonus ON public.releases;
CREATE TRIGGER trg_christmas_release_bonus AFTER INSERT OR UPDATE OF release_status ON public.releases
 FOR EACH ROW EXECUTE FUNCTION public._award_christmas_release_bonus();
ALTER PUBLICATION supabase_realtime ADD TABLE public.christmas_release_bonuses;