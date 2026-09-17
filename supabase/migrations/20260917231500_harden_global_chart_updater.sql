-- Harden the general music-chart updater against PostgREST statement timeouts.
-- The updater runs as service_role and performs several nested relationship reads plus
-- same-day chart replacement. Give that trusted background workload a larger statement
-- budget while adding the relationship/filter indexes used by its hottest queries.

CREATE INDEX IF NOT EXISTS idx_release_formats_release_type
  ON public.release_formats(release_id, format_type);

CREATE INDEX IF NOT EXISTS idx_release_sales_chart_window
  ON public.release_sales(sale_date DESC, country, release_format_id);

CREATE INDEX IF NOT EXISTS idx_release_songs_chart_lookup
  ON public.release_songs(release_id, is_b_side, track_number, song_id);

CREATE INDEX IF NOT EXISTS idx_song_releases_chart_lookup
  ON public.song_releases(song_id, is_active, release_id);

CREATE INDEX IF NOT EXISTS idx_radio_plays_chart_window
  ON public.radio_plays(played_at DESC, song_id);

CREATE INDEX IF NOT EXISTS idx_chart_entries_daily_identity
  ON public.chart_entries(chart_date, song_id, chart_type, country);

-- Background chart generation is service-role only. The hosted Data API defaults can be
-- too tight for its full multi-chart transaction, especially while replacing and annotating
-- hundreds of chart rows. This does not change anon/authenticated query budgets.
ALTER ROLE service_role SET statement_timeout = '30s';

COMMENT ON INDEX public.idx_release_sales_chart_window IS
  'Supports the rolling seven-day country/format scans used by update-music-charts.';
COMMENT ON INDEX public.idx_chart_entries_daily_identity IS
  'Supports same-day chart replacement plus trend/weeks-on-chart updates.';
