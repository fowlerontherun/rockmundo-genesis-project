CREATE TABLE IF NOT EXISTS public.festival_edition_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  actor_profile_id uuid,
  event_type text NOT NULL,
  previous_version integer,
  new_version integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS festival_edition_audit_company_idx ON public.festival_edition_audit (festival_company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS festival_edition_audit_edition_idx ON public.festival_edition_audit (festival_edition_id, created_at DESC);

GRANT SELECT ON public.festival_edition_audit TO authenticated;
GRANT ALL ON public.festival_edition_audit TO service_role;

ALTER TABLE public.festival_edition_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Festival owners can read their edition audit" ON public.festival_edition_audit;
CREATE POLICY "Festival owners can read their edition audit"
ON public.festival_edition_audit
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.festival_companies fc
  JOIN public.profiles p ON p.id = fc.owner_profile_id
  WHERE fc.id = festival_edition_audit.festival_company_id
    AND p.user_id = auth.uid()
));