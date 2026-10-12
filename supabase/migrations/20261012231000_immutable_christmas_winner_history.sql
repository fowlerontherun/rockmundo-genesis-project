-- Immutable Year-by-Year Christmas Number One winner, with song and artist.
-- Each game year is 120 real days, each game day eight real hours.
CREATE TABLE IF NOT EXISTS public.christmas_number_ones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 game_year integer NOT NULL UNIQUE CHECK(game_year>=1),
 release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
 release_title text,
 song_title text,
 artist_name text,
 total_sales bigint NOT NULL DEFAULT 0,
 awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.christmas_number_ones
 ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS release_title text,
 ADD COLUMN IF NOT EXISTS song_title text,
 ADD COLUMN IF NOT EXISTS artist_name text,
 ADD COLUMN IF NOT EXISTS total_sales bigint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS awarded_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.christmas_number_ones ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.christmas_number_ones TO authenticated;
DROP POLICY IF EXISTS christmas_number_ones_public_read ON public.christmas_number_ones;
CREATE POLICY christmas_number_ones_public_read ON public.christmas_number_ones FOR SELECT TO authenticated USING(true);
REVOKE INSERT,UPDATE,DELETE ON public.christmas_number_ones FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_christmas_number_one(p_game_year integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_current_year integer;v_year_day integer;v_real_days integer;
 v_start timestamptz;v_cutoff timestamptz;v_result record;
 v_existing public.christmas_number_ones%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
 v_real_days:=greatest(0,floor(extract(epoch FROM (now()-timestamptz '2026-01-01 00:00:00+00'))/86400)::integer);
 v_current_year:=floor(v_real_days/120)::integer+1;
 v_year_day:=mod(v_real_days*3,360);
 IF p_game_year<1 OR p_game_year>v_current_year THEN RAISE EXCEPTION 'invalid_christmas_year'; END IF;
 IF p_game_year=v_current_year AND v_year_day<354 THEN
  RAISE EXCEPTION 'christmas_race_not_concluded';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rockmundo-christmas-'||p_game_year::text,0));
 SELECT * INTO v_existing FROM public.christmas_number_ones WHERE game_year=p_game_year;
 IF FOUND THEN RETURN to_jsonb(v_existing); END IF;
 v_start:=timestamptz '2026-01-01 00:00:00+00' + make_interval(days=>(p_game_year-1)*120+110);
 -- Midnight after game-day 25; later December sales never change this award.
 v_cutoff:=v_start+interval '8 days 8 hours';
 SELECT r.id AS release_id, r.title AS release_title,
  coalesce(nullif(r.artist_name,''),nullif(b.artist_name,''),nullif(b.name,''),'Unknown Artist') AS artist_name,
  coalesce((SELECT s.title FROM public.release_songs rsong
    JOIN public.songs s ON s.id=rsong.song_id WHERE rsong.release_id=r.id
    ORDER BY rsong.track_number,rsong.id LIMIT 1),r.title) AS song_title,
  sum(rs.quantity_sold)::bigint AS total_sales
 INTO v_result FROM public.release_sales rs
 JOIN public.release_formats rf ON rf.id=rs.release_format_id
 JOIN public.releases r ON r.id=rf.release_id
 LEFT JOIN public.bands b ON b.id=r.band_id
 WHERE rs.sale_date>=v_start AND rs.sale_date<v_cutoff
 GROUP BY r.id,r.title,r.artist_name,b.artist_name,b.name
 ORDER BY sum(rs.quantity_sold) DESC,r.id LIMIT 1;
 IF v_result.release_id IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.christmas_number_ones(game_year,release_id,release_title,song_title,artist_name,total_sales)
 VALUES(p_game_year,v_result.release_id,v_result.release_title,v_result.song_title,
  v_result.artist_name,v_result.total_sales)
 RETURNING * INTO v_existing;
 RETURN to_jsonb(v_existing);
END $$;
REVOKE ALL ON FUNCTION public.get_or_create_christmas_number_one(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_christmas_number_one(integer) TO authenticated;
