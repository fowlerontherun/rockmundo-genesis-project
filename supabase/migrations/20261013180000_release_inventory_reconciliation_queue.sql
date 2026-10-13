CREATE TABLE IF NOT EXISTS public.release_inventory_reconciliation_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 format_id uuid NOT NULL REFERENCES public.release_formats(id),
 release_id uuid NOT NULL REFERENCES public.releases(id),
 actual_sold integer NOT NULL CHECK(actual_sold>=0),
 backlog_sold integer NOT NULL CHECK(backlog_sold>=0),
 unmet_added integer NOT NULL CHECK(unmet_added>=0),
 failure_reason text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS release_inventory_reconciliation_pending_idx ON public.release_inventory_reconciliation_queue(created_at) WHERE status='pending';
ALTER TABLE public.release_inventory_reconciliation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.release_inventory_reconciliation_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.release_inventory_reconciliation_queue TO service_role;
CREATE OR REPLACE FUNCTION public.reconcile_failed_release_inventory(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.release_inventory_reconciliation_queue%ROWTYPE; v_done integer:=0;v_failed integer:=0;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 FOR v IN SELECT * FROM public.release_inventory_reconciliation_queue
 WHERE status='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),100)
 LOOP
  BEGIN
   PERFORM public.restore_release_inventory_claim(v.format_id,v.actual_sold,v.backlog_sold,v.unmet_added);
   UPDATE public.release_inventory_reconciliation_queue
   SET status='resolved',resolved_at=now(),attempts=attempts+1,last_error=null WHERE id=v.id;
   v_done:=v_done+1;
  EXCEPTION WHEN OTHERS THEN
   UPDATE public.release_inventory_reconciliation_queue
   SET attempts=attempts+1,last_error=SQLERRM WHERE id=v.id;
   v_failed:=v_failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('resolved',v_done,'failed',v_failed);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_failed_release_inventory(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_failed_release_inventory(integer) TO service_role;
