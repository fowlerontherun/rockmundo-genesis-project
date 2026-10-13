-- Grant combined chart top-ten band bonuses at most once per chart day.
CREATE TABLE IF NOT EXISTS public.chart_band_daily_awards(
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  chart_date date NOT NULL,
  best_rank integer NOT NULL,
  morale_boost integer NOT NULL,
  reputation_boost integer NOT NULL,
  sentiment_boost integer NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(band_id,chart_date)
);
ALTER TABLE public.chart_band_daily_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chart_band_daily_awards FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.award_chart_band_bonus_once(
  p_band_id uuid,p_chart_date date,p_best_rank integer,
  p_morale integer,p_reputation integer,p_sentiment integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_band_id IS NULL OR p_chart_date IS NULL OR p_best_rank NOT BETWEEN 1 AND 10
   OR p_morale NOT BETWEEN 0 AND 15 OR p_reputation NOT BETWEEN 0 AND 10
   OR p_sentiment NOT BETWEEN 0 AND 12 THEN
   RAISE EXCEPTION 'Invalid chart reward';
 END IF;
 INSERT INTO public.chart_band_daily_awards(
  band_id,chart_date,best_rank,morale_boost,reputation_boost,sentiment_boost)
 VALUES(p_band_id,p_chart_date,p_best_rank,p_morale,p_reputation,p_sentiment)
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN FALSE; END IF;
 UPDATE public.bands SET
  morale=LEAST(100,COALESCE(morale,50)+p_morale),
  reputation_score=LEAST(100,COALESCE(reputation_score,0)+p_reputation),
  fan_sentiment_score=LEAST(100,COALESCE(fan_sentiment_score,0)+p_sentiment)
 WHERE id=p_band_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Band not found for chart reward'; END IF;
 RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION public.award_chart_band_bonus_once(uuid,date,integer,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_chart_band_bonus_once(uuid,date,integer,integer,integer,integer) TO service_role;
