-- Collection-scoped worker claim so an admin rendering one Skin Collection
-- cannot consume preview jobs queued for another collection.

CREATE OR REPLACE FUNCTION public.claim_clothing_preview_job_for_collection(
  p_collection_id uuid
)
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_job
  FROM public.avatar_item_preview_jobs
  WHERE status = 'queued'
    AND attempt_count < 10
    AND collection_id = p_collection_id
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.avatar_item_preview_jobs
  SET status = 'processing',
      started_at = now(),
      updated_at = now(),
      attempt_count = attempt_count + 1,
      error_message = NULL
  WHERE id = v_job.id;

  RETURN QUERY
  SELECT v_job.id, v_job.clothing_item_id, v_job.job_type, v_job.requested_views, v_job.attempt_count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_clothing_preview_job_for_collection(uuid) TO authenticated;
