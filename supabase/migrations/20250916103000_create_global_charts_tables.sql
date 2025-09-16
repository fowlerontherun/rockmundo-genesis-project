-- Create analytics tables for global chart tracking

CREATE TABLE IF NOT EXISTS public.global_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_date date NOT NULL,
  chart_type text NOT NULL CHECK (chart_type IN ('daily', 'weekly')),
  rank integer NOT NULL CHECK (rank > 0),
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  song_title text NOT NULL,
  artist_name text,
  band_name text,
  genre text NOT NULL,
  plays numeric NOT NULL DEFAULT 0 CHECK (plays >= 0),
  popularity numeric NOT NULL DEFAULT 0 CHECK (popularity >= 0 AND popularity <= 100),
  trend text NOT NULL DEFAULT 'same' CHECK (trend IN ('up', 'down', 'same')),
  trend_change integer NOT NULL DEFAULT 0,
  weeks_on_chart integer NOT NULL DEFAULT 0 CHECK (weeks_on_chart >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_charts_unique_entry
  ON public.global_charts(chart_date, chart_type, rank);

CREATE INDEX IF NOT EXISTS idx_global_charts_chart_type_date
  ON public.global_charts(chart_type, chart_date);

CREATE INDEX IF NOT EXISTS idx_global_charts_song_id
  ON public.global_charts(song_id);

ALTER TABLE public.global_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global charts are viewable by everyone"
  ON public.global_charts
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.genre_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_date date NOT NULL,
  chart_type text NOT NULL DEFAULT 'weekly' CHECK (chart_type IN ('daily', 'weekly', 'monthly')),
  genre text NOT NULL,
  total_plays numeric NOT NULL DEFAULT 0 CHECK (total_plays >= 0),
  total_songs integer NOT NULL DEFAULT 0 CHECK (total_songs >= 0),
  avg_popularity numeric NOT NULL DEFAULT 0 CHECK (avg_popularity >= 0 AND avg_popularity <= 100),
  top_song text,
  growth numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_genre_statistics_unique_period
  ON public.genre_statistics(chart_date, chart_type, genre);

CREATE INDEX IF NOT EXISTS idx_genre_statistics_chart_type_date
  ON public.genre_statistics(chart_type, chart_date);

ALTER TABLE public.genre_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Genre statistics are viewable by everyone"
  ON public.genre_statistics
  FOR SELECT
  USING (true);
