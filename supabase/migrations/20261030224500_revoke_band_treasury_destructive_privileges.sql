-- Defense in depth for #4746: RLS does NOT protect TRUNCATE.
-- Prior default Data API grants exposed unnecessary schema/destructive
-- privileges for the bands and treasury family.
-- Preserve permitted SELECT and existing gameplay UPDATE/INSERT behaviour
-- until the remaining browser balance writers are migrated to server RPCs.
REVOKE TRUNCATE,REFERENCES,TRIGGER
  ON TABLE public.bands,
           public.band_treasuries,
           public.band_treasury_transactions
  FROM anon,authenticated;

-- The treasury and journal have read-only band-member RLS policies.
-- Web clients have no need for direct mutation grants; trusted SQL workers
-- and SECURITY DEFINER RPCs continue to use database-owner permissions.
REVOKE INSERT,UPDATE,DELETE
  ON TABLE public.band_treasuries,
           public.band_treasury_transactions
  FROM anon,authenticated;
