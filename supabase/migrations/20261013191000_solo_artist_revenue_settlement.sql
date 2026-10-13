-- Solo revenue is credited in the same transaction as its source row.
-- Monetary source precision: release_sales.net_revenue is cents;
-- streaming_analytics_daily.daily_revenue is integer dollars.
CREATE TABLE IF NOT EXISTS public.solo_artist_revenue_carry (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 carry_minor integer NOT NULL DEFAULT 0 CHECK (carry_minor BETWEEN 0 AND 99)
);
CREATE TABLE IF NOT EXISTS public.solo_artist_revenue_receipts (
 source_kind text NOT NULL CHECK (source_kind IN ('release_sale','streaming')),
 source_id uuid NOT NULL,
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 revenue_minor bigint NOT NULL CHECK(revenue_minor>=0),
 credited_dollars bigint NOT NULL CHECK(credited_dollars>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_kind,source_id)
);
ALTER TABLE public.solo_artist_revenue_carry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_artist_revenue_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solo_artist_revenue_carry,public.solo_artist_revenue_receipts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.credit_solo_artist_revenue(
 p_profile_id uuid,p_kind text,p_source_id uuid,p_minor bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prior integer;v_dollars bigint;v_inserted integer;
BEGIN
 IF p_profile_id IS NULL OR p_kind NOT IN ('release_sale','streaming')
 OR p_source_id IS NULL OR p_minor<0 OR p_minor IS NULL THEN
  RAISE EXCEPTION 'INVALID_SOLO_REVENUE';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id) THEN
  RAISE EXCEPTION 'SOLO_ARTIST_PROFILE_MISSING';
 END IF;
 INSERT INTO public.solo_artist_revenue_carry(profile_id) VALUES(p_profile_id)
 ON CONFLICT(profile_id) DO NOTHING;
 SELECT carry_minor INTO v_prior FROM public.solo_artist_revenue_carry
 WHERE profile_id=p_profile_id FOR UPDATE;
 -- A duplicate source never credits twice.
 INSERT INTO public.solo_artist_revenue_receipts(source_kind,source_id,profile_id,revenue_minor,credited_dollars)
 VALUES(p_kind,p_source_id,p_profile_id,p_minor,(v_prior+p_minor)/100)
 ON CONFLICT(source_kind,source_id) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN RETURN; END IF;
 v_dollars:=floor((v_prior::numeric+p_minor)/100)::bigint;
 UPDATE public.solo_artist_revenue_carry SET carry_minor=((v_prior::bigint+p_minor)%100)::integer
 WHERE profile_id=p_profile_id;
 IF v_dollars>0 THEN
  UPDATE public.profiles SET cash=coalesce(cash,0)+v_dollars WHERE id=p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOLO_ARTIST_PROFILE_DISAPPEARED';END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.credit_solo_artist_revenue(uuid,text,uuid,bigint) FROM PUBLIC,anon,authenticated;
-- Only source-table triggers may call the internal payout function.

CREATE OR REPLACE FUNCTION public.credit_solo_release_sale_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile uuid;v_band uuid;
BEGIN
 SELECT r.user_id,r.band_id INTO v_profile,v_band
 FROM public.release_formats f JOIN public.releases r ON r.id=f.release_id
 WHERE f.id=NEW.release_format_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'SALE_RELEASE_NOT_FOUND';END IF;
 IF v_band IS NULL THEN
  PERFORM public.credit_solo_artist_revenue(v_profile,'release_sale',NEW.id,
   greatest(0,coalesce(NEW.net_revenue,0))::bigint);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credit_solo_artist_sale ON public.release_sales;
CREATE TRIGGER credit_solo_artist_sale AFTER INSERT ON public.release_sales
FOR EACH ROW EXECUTE FUNCTION public.credit_solo_release_sale_trigger();

CREATE OR REPLACE FUNCTION public.credit_solo_streaming_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile uuid;v_band uuid;
BEGIN
 SELECT coalesce(sr.user_id,s.profile_id),coalesce(sr.band_id,s.band_id)
 INTO v_profile,v_band
 FROM public.song_releases sr JOIN public.songs s ON s.id=sr.song_id
 WHERE sr.id=NEW.song_release_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'STREAMING_RELEASE_NOT_FOUND';END IF;
 IF v_band IS NULL THEN
  PERFORM public.credit_solo_artist_revenue(v_profile,'streaming',NEW.id,
   greatest(0,coalesce(NEW.daily_revenue,0))::bigint*100);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credit_solo_artist_streaming ON public.streaming_analytics_daily;
CREATE TRIGGER credit_solo_artist_streaming AFTER INSERT ON public.streaming_analytics_daily
FOR EACH ROW EXECUTE FUNCTION public.credit_solo_streaming_trigger();
