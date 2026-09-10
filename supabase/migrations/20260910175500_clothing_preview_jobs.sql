-- Clothing preview generation queue and readiness lifecycle.

CREATE TABLE IF NOT EXISTS public.avatar_item_preview_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clothing_item_id uuid NOT NULL REFERENCES public.avatar_clothing_items(id) ON DELETE CASCADE,
  collection_id uuid NULL REFERENCES public.skin_collections(id) ON DELETE SET NULL,
  requested_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type text NOT NULL DEFAULT 'turntable' CHECK (job_type IN ('thumbnail','turntable','full_set')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  requested_views jsonb NOT NULL DEFAULT '["front","front_right","right","back_right","back","back_left","left","front_left"]'::jsonb,
  output_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 10),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avatar_item_preview_jobs_item_idx
  ON public.avatar_item_preview_jobs(clothing_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS avatar_item_preview_jobs_status_idx
  ON public.avatar_item_preview_jobs(status, created_at);

ALTER TABLE public.avatar_item_preview_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view clothing preview jobs" ON public.avatar_item_preview_jobs;
CREATE POLICY "Admins can view clothing preview jobs"
ON public.avatar_item_preview_jobs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create clothing preview jobs" ON public.avatar_item_preview_jobs;
CREATE POLICY "Admins can create clothing preview jobs"
ON public.avatar_item_preview_jobs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update clothing preview jobs" ON public.avatar_item_preview_jobs;
CREATE POLICY "Admins can update clothing preview jobs"
ON public.avatar_item_preview_jobs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.queue_clothing_preview_job(
  p_clothing_item_id uuid,
  p_job_type text DEFAULT 'full_set'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_collection_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_job_type NOT IN ('thumbnail','turntable','full_set') THEN RAISE EXCEPTION 'Unsupported preview job type'; END IF;

  SELECT collection_id INTO v_collection_id FROM public.avatar_clothing_items WHERE id = p_clothing_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clothing item not found'; END IF;

  SELECT id INTO v_job_id
  FROM public.avatar_item_preview_jobs
  WHERE clothing_item_id = p_clothing_item_id AND status IN ('queued','processing')
  ORDER BY created_at DESC LIMIT 1;
  IF v_job_id IS NOT NULL THEN RETURN v_job_id; END IF;

  UPDATE public.avatar_clothing_items
  SET preview_status = 'pending', last_preview_error = NULL
  WHERE id = p_clothing_item_id;

  INSERT INTO public.avatar_item_preview_jobs(clothing_item_id, collection_id, requested_by, job_type)
  VALUES (p_clothing_item_id, v_collection_id, auth.uid(), p_job_type)
  RETURNING id INTO v_job_id;
  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_skin_collection_previews(
  p_collection_id uuid,
  p_job_type text DEFAULT 'full_set'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  FOR v_item IN SELECT id FROM public.avatar_clothing_items WHERE collection_id = p_collection_id LOOP
    PERFORM public.queue_clothing_preview_job(v_item.id, p_job_type);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Worker/admin claim. SKIP LOCKED permits multiple render workers safely.
CREATE OR REPLACE FUNCTION public.claim_next_clothing_preview_job()
RETURNS TABLE(
  job_id uuid,
  clothing_item_id uuid,
  job_type text,
  requested_views jsonb,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.avatar_item_preview_jobs%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;

  SELECT * INTO v_job
  FROM public.avatar_item_preview_jobs
  WHERE status = 'queued' AND attempt_count < 10
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.avatar_item_preview_jobs
  SET status = 'processing', started_at = now(), updated_at = now(),
      attempt_count = attempt_count + 1, error_message = NULL
  WHERE id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_job.clothing_item_id, v_job.job_type, v_job.requested_views, v_job.attempt_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_clothing_preview_job(
  p_job_id uuid,
  p_manifest jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF jsonb_typeof(COALESCE(p_manifest, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Preview manifest must be an object'; END IF;

  UPDATE public.avatar_item_preview_jobs
  SET status = 'completed', output_manifest = COALESCE(p_manifest, '{}'::jsonb),
      completed_at = now(), updated_at = now(), error_message = NULL
  WHERE id = p_job_id AND status = 'processing'
  RETURNING clothing_item_id INTO v_item_id;

  IF v_item_id IS NULL THEN RAISE EXCEPTION 'Preview job is not processing or does not exist'; END IF;

  UPDATE public.avatar_clothing_items
  SET preview_status = 'ready', preview_manifest = p_manifest,
      preview_generated_at = now(), last_preview_error = NULL
  WHERE id = v_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_clothing_preview_job(
  p_job_id uuid,
  p_error text,
  p_retry boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_attempts integer;
  v_next_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;

  SELECT clothing_item_id, attempt_count INTO v_item_id, v_attempts
  FROM public.avatar_item_preview_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Preview job not found'; END IF;

  v_next_status := CASE WHEN p_retry AND v_attempts < 3 THEN 'queued' ELSE 'failed' END;

  UPDATE public.avatar_item_preview_jobs
  SET status = v_next_status, error_message = left(COALESCE(p_error, 'Unknown preview error'), 1000),
      completed_at = CASE WHEN v_next_status = 'failed' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_job_id;

  UPDATE public.avatar_clothing_items
  SET preview_status = CASE WHEN v_next_status = 'failed' THEN 'failed' ELSE 'pending' END,
      last_preview_error = left(COALESCE(p_error, 'Unknown preview error'), 1000)
  WHERE id = v_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_clothing_preview_job(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_skin_collection_previews(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_clothing_preview_job() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_clothing_preview_job(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_clothing_preview_job(uuid,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.invalidate_clothing_preview_on_design_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(
    NEW.garment_config, NEW.material_config, NEW.pattern_config, NEW.detail_layers,
    NEW.fit_config, NEW.wear_config, NEW.customization_zones, NEW.render_config,
    NEW.variant_matrix, NEW.color_variants, NEW.rpm_asset_id
  ) IS DISTINCT FROM ROW(
    OLD.garment_config, OLD.material_config, OLD.pattern_config, OLD.detail_layers,
    OLD.fit_config, OLD.wear_config, OLD.customization_zones, OLD.render_config,
    OLD.variant_matrix, OLD.color_variants, OLD.rpm_asset_id
  ) THEN
    NEW.preview_status := 'pending';
    NEW.preview_manifest := '{}'::jsonb;
    NEW.preview_generated_at := NULL;
    NEW.last_preview_error := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_clothing_preview ON public.avatar_clothing_items;
CREATE TRIGGER trg_invalidate_clothing_preview
BEFORE UPDATE ON public.avatar_clothing_items
FOR EACH ROW EXECUTE FUNCTION public.invalidate_clothing_preview_on_design_change();

COMMENT ON TABLE public.avatar_item_preview_jobs IS 'Admin-controlled queue for generated clothing thumbnails/turntable fallback assets.';
