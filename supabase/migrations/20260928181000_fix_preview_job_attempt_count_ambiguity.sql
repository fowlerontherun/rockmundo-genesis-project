CREATE OR REPLACE FUNCTION public.claim_clothing_preview_job_for_collection(p_collection_id uuid)
RETURNS TABLE(job_id uuid, clothing_item_id uuid, job_type text, requested_views jsonb, attempt_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_job public.avatar_item_preview_jobs%ROWTYPE;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT j.* INTO v_job FROM public.avatar_item_preview_jobs AS j
 WHERE j.status = 'queued' AND j.attempt_count < 10 AND j.collection_id = p_collection_id
 ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.avatar_item_preview_jobs AS j
 SET status = 'processing', started_at = now(), updated_at = now(),
 attempt_count = j.attempt_count + 1, error_message = NULL
 WHERE j.id = v_job.id;
 RETURN QUERY SELECT v_job.id, v_job.clothing_item_id, v_job.job_type, v_job.requested_views, v_job.attempt_count + 1;
END; $function$;
CREATE OR REPLACE FUNCTION public.claim_next_clothing_preview_job()
RETURNS TABLE(job_id uuid, clothing_item_id uuid, job_type text, requested_views jsonb, attempt_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_job public.avatar_item_preview_jobs%ROWTYPE;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT j.* INTO v_job FROM public.avatar_item_preview_jobs AS j
 WHERE j.status = 'queued' AND j.attempt_count < 10
 ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.avatar_item_preview_jobs AS j
 SET status = 'processing', started_at = now(), updated_at = now(),
 attempt_count = j.attempt_count + 1, error_message = NULL
 WHERE j.id = v_job.id;
 RETURN QUERY SELECT v_job.id, v_job.clothing_item_id, v_job.job_type, v_job.requested_views, v_job.attempt_count + 1;
END; $function$;