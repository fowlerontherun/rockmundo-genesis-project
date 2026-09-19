CREATE TABLE IF NOT EXISTS public.totp_production_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('rehearsal','preflight','approval','note','render','publish')),
  headline text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  passed boolean,
  manifest_checksum text,
  actor_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_production_audit_episode_idx
  ON public.totp_production_audit (episode_id, created_at DESC);

GRANT SELECT, INSERT ON public.totp_production_audit TO authenticated;
GRANT ALL ON public.totp_production_audit TO service_role;

ALTER TABLE public.totp_production_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "totp_production_audit_admin_read" ON public.totp_production_audit;
CREATE POLICY "totp_production_audit_admin_read"
  ON public.totp_production_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "totp_production_audit_admin_write" ON public.totp_production_audit;
CREATE POLICY "totp_production_audit_admin_write"
  ON public.totp_production_audit FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.totp_admin_log_production_event(
  p_episode_id uuid,
  p_event_kind text,
  p_headline text,
  p_detail jsonb DEFAULT '{}'::jsonb,
  p_passed boolean DEFAULT NULL,
  p_manifest_checksum text DEFAULT NULL
)
RETURNS public.totp_production_audit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.totp_production_audit;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can log production events.';
  END IF;

  INSERT INTO public.totp_production_audit (
    episode_id, event_kind, headline, detail, passed, manifest_checksum, actor_id
  ) VALUES (
    p_episode_id, p_event_kind, p_headline, COALESCE(p_detail, '{}'::jsonb), p_passed, p_manifest_checksum, auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_episode_production_audit(
  p_episode_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.totp_production_audit
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can read the production log.';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.totp_production_audit
  WHERE episode_id = p_episode_id
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_log_production_event(uuid, text, text, jsonb, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.totp_episode_production_audit(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.totp_admin_log_production_event(uuid, text, text, jsonb, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totp_episode_production_audit(uuid, integer) TO authenticated;