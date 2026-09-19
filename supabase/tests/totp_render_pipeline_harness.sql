-- Phase 2 deterministic render-pipeline release gate.
BEGIN;
DO $$
DECLARE v_claim text; v_complete text;
BEGIN
 IF to_regclass('public.totp_render_jobs') IS NULL THEN RAISE EXCEPTION 'totp_render_jobs is missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='totp-broadcast-masters' AND public=false) THEN RAISE EXCEPTION 'private totp-broadcast-masters bucket is missing'; END IF;
 SELECT pg_get_functiondef('public.totp_claim_render_job_v2(text)'::regprocedure) INTO v_claim;
 IF v_claim NOT LIKE '%FOR UPDATE SKIP LOCKED%' OR v_claim NOT LIKE '%15 minutes%' THEN RAISE EXCEPTION 'render worker claim lost its concurrency/lease recovery contract'; END IF;
 SELECT pg_get_functiondef('public.totp_complete_render_job_v2(uuid,text,jsonb,jsonb,jsonb,text,text,text)'::regprocedure) INTO v_complete;
 IF v_complete NOT LIKE '%rendered_master%' OR v_complete NOT LIKE '%master_sha256%' THEN RAISE EXCEPTION 'render completion no longer promotes only hashed QC-passing masters'; END IF;
 IF has_function_privilege('authenticated','public.totp_claim_render_job_v2(text)','EXECUTE') THEN RAISE EXCEPTION 'authenticated clients must not claim render jobs'; END IF;
 IF NOT has_function_privilege('service_role','public.totp_claim_render_job_v2(text)','EXECUTE') THEN RAISE EXCEPTION 'service_role must be able to claim render jobs'; END IF;
END; $$;
ROLLBACK;
