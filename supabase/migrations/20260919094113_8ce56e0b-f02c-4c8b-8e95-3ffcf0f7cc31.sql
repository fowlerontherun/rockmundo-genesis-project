CREATE TABLE IF NOT EXISTS public.totp_episode_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  manifest_version integer NOT NULL DEFAULT 1,
  production_state text NOT NULL DEFAULT 'gameplay'
    CHECK (production_state IN ('gameplay', 'production_ready', 'rendered_master', 'published')),
  checksum text NOT NULL,
  total_runtime_ms integer NOT NULL DEFAULT 0,
  segment_count integer NOT NULL DEFAULT 0,
  manifest jsonb NOT NULL,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id)
);

CREATE INDEX IF NOT EXISTS totp_episode_manifests_state_idx
  ON public.totp_episode_manifests (production_state, updated_at DESC);

GRANT SELECT ON public.totp_episode_manifests TO authenticated;
GRANT ALL ON public.totp_episode_manifests TO service_role;

ALTER TABLE public.totp_episode_manifests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can read episode running sheets" ON public.totp_episode_manifests;
CREATE POLICY "Players can read episode running sheets"
ON public.totp_episode_manifests
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage episode running sheets" ON public.totp_episode_manifests;
CREATE POLICY "Admins manage episode running sheets"
ON public.totp_episode_manifests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.totp_episode_manifest(p_episode_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode_id uuid := p_episode_id;
  v_row public.totp_episode_manifests%ROWTYPE;
BEGIN
  IF v_episode_id IS NULL THEN
    SELECT id INTO v_episode_id
    FROM public.totp_episodes
    WHERE status <> 'cancelled'
    ORDER BY episode_date DESC
    LIMIT 1;
  END IF;

  IF v_episode_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.totp_episode_manifests
  WHERE episode_id = v_episode_id;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'episode_id', v_row.episode_id,
    'manifest_version', v_row.manifest_version,
    'production_state', v_row.production_state,
    'checksum', v_row.checksum,
    'total_runtime_ms', v_row.total_runtime_ms,
    'segment_count', v_row.segment_count,
    'manifest', v_row.manifest,
    'issues', v_row.issues,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_save_episode_manifest(
  p_episode_id uuid,
  p_manifest jsonb,
  p_issues jsonb DEFAULT '[]'::jsonb,
  p_production_state text DEFAULT 'gameplay'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.totp_episode_manifests%ROWTYPE;
  v_checksum text;
  v_runtime integer;
  v_segments integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_episode_id IS NULL OR p_manifest IS NULL THEN
    RAISE EXCEPTION 'An episode and running sheet are required';
  END IF;

  IF p_production_state NOT IN ('gameplay', 'production_ready', 'rendered_master', 'published') THEN
    RAISE EXCEPTION 'Unknown production state: %', p_production_state;
  END IF;

  v_checksum := coalesce(p_manifest->>'checksum', '');
  IF v_checksum = '' THEN
    RAISE EXCEPTION 'The running sheet has no checksum';
  END IF;

  v_runtime := coalesce((p_manifest->>'total_runtime_ms')::integer, 0);
  v_segments := coalesce(jsonb_array_length(p_manifest->'segments'), 0);

  SELECT * INTO v_existing
  FROM public.totp_episode_manifests
  WHERE episode_id = p_episode_id
  FOR UPDATE;

  IF v_existing.id IS NOT NULL
    AND v_existing.production_state IN ('rendered_master', 'published')
    AND v_existing.checksum <> v_checksum THEN
    RAISE EXCEPTION 'This episode running sheet is locked for broadcast and cannot be changed';
  END IF;

  INSERT INTO public.totp_episode_manifests (
    episode_id, manifest_version, production_state, checksum,
    total_runtime_ms, segment_count, manifest, issues
  )
  VALUES (
    p_episode_id,
    coalesce((p_manifest->>'manifest_version')::integer, 1),
    p_production_state,
    v_checksum,
    v_runtime,
    v_segments,
    p_manifest,
    coalesce(p_issues, '[]'::jsonb)
  )
  ON CONFLICT (episode_id) DO UPDATE
  SET manifest_version = EXCLUDED.manifest_version,
      production_state = EXCLUDED.production_state,
      checksum = EXCLUDED.checksum,
      total_runtime_ms = EXCLUDED.total_runtime_ms,
      segment_count = EXCLUDED.segment_count,
      manifest = EXCLUDED.manifest,
      issues = EXCLUDED.issues,
      updated_at = now();

  RETURN public.totp_episode_manifest(p_episode_id);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_episode_manifest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_episode_manifest(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.totp_admin_save_episode_manifest(uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_admin_save_episode_manifest(uuid, jsonb, jsonb, text) TO authenticated, service_role;