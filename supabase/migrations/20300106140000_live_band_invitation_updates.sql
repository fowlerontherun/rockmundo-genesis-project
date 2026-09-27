-- Publish invitation INSERT/UPDATE events so band managers and invited players
-- can refresh their roster and inbox as soon as invitations change.
-- Existing SELECT RLS restricts these events to invitation participants;
-- do not publish the broader band_members table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'band_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.band_invitations;
  END IF;
END
$$;
