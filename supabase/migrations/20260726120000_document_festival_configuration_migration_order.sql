-- Forward-only companion for the already-merged 20291217122000 migration.
-- Some shared deployment histories may already contain that version, so it must not
-- be renamed. On fresh databases this file sorts before the legacy migration and is
-- intentionally safe when its objects do not exist. The legacy migration itself is
-- maintained as the canonical fresh-install definition.
DO $$
BEGIN
  IF to_regclass('public.festival_configurations') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'festival_configuration_version_positive') THEN
      ALTER TABLE public.festival_configurations ADD CONSTRAINT festival_configuration_version_positive CHECK (configuration_version >= 1) NOT VALID;
      ALTER TABLE public.festival_configurations VALIDATE CONSTRAINT festival_configuration_version_positive;
    END IF;
    COMMENT ON TABLE public.festival_configuration_requests IS 'Caller/company-scoped idempotency receipts. Retain successful receipts for at least the client retry window; a scheduled operations migration must purge receipts older than the agreed retention period.';
  END IF;
END $$;
