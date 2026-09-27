-- Production reconciliation for stuck gigs with mixed songs and stage actions.
-- The authoritative migrations (20260812120000 and 20260812230000) were
-- present in source but not fully represented in the live database. Reapply
-- the missing parts idempotently so future environments stay aligned.

ALTER TABLE public.gig_song_performances
  ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'song',
  ADD COLUMN IF NOT EXISTS performance_item_id uuid,
  ADD COLUMN IF NOT EXISTS performance_item_name text,
  ALTER COLUMN song_id DROP NOT NULL,
  ALTER COLUMN item_type SET DEFAULT 'song';

ALTER TABLE public.gig_song_performances
  DROP CONSTRAINT IF EXISTS gig_song_performances_performance_item_id_fkey;
ALTER TABLE public.gig_song_performances
  ADD CONSTRAINT gig_song_performances_performance_item_id_fkey
  FOREIGN KEY (performance_item_id)
  REFERENCES public.performance_items_catalog(id)
  ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.gig_song_performances
  DROP CONSTRAINT IF EXISTS gig_song_performances_item_identity_check;
ALTER TABLE public.gig_song_performances
  ADD CONSTRAINT gig_song_performances_item_identity_check
  CHECK (
    (COALESCE(item_type, 'song') = 'song'
      AND song_id IS NOT NULL AND performance_item_id IS NULL)
    OR (item_type = 'performance_item'
      AND song_id IS NULL AND performance_item_id IS NOT NULL)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS gig_song_performances_performance_item_idx
  ON public.gig_song_performances(performance_item_id)
  WHERE performance_item_id IS NOT NULL;

-- Settlement RPC inserts references to this authority on merch and bar
-- transactions. Without either column, all completion retries fail.
ALTER TABLE public.merch_orders
  ADD COLUMN IF NOT EXISTS gig_settlement_id uuid
  REFERENCES public.gig_commerce_settlements(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS merch_orders_one_settled_line
  ON public.merch_orders(
    gig_settlement_id,
    merchandise_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) WHERE gig_settlement_id IS NOT NULL;

ALTER TABLE public.venue_financial_transactions
  ADD COLUMN IF NOT EXISTS gig_settlement_id uuid
  REFERENCES public.gig_commerce_settlements(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS venue_transactions_one_gig_bar
  ON public.venue_financial_transactions(gig_settlement_id)
  WHERE gig_settlement_id IS NOT NULL;

-- Claims are serialized by SELECT ... FOR UPDATE on gigs. An old claim used
-- unconditional INSERT and generated hundreds of orphan post-processing
-- rows while the completion worker was retrying. Reuse the latest row.
CREATE OR REPLACE FUNCTION public.claim_gig_completion(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  g public.gigs%ROWTYPE;
  v_duration_seconds integer := 0;
  v_expected_end timestamptz;
  v_processing_id uuid;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;

  IF g.status = 'completed' AND g.result_ready_at IS NOT NULL THEN
    RETURN jsonb_build_object('alreadyCompleted', true, 'alreadyProcessing', false);
  END IF;

  IF g.status NOT IN ('in_progress', 'ready_for_completion', 'processing_outcome') THEN
    RAISE EXCEPTION 'gig_not_ready_for_completion:%', g.status;
  END IF;

  IF g.setlist_id IS NOT NULL THEN
    SELECT coalesce(sum(coalesce(s.duration_seconds, pic.duration_seconds, 180)), 0)::integer
      INTO v_duration_seconds
    FROM public.setlist_songs ss
    LEFT JOIN public.songs s ON s.id = ss.song_id
    LEFT JOIN public.performance_items_catalog pic ON pic.id = ss.performance_item_id
    WHERE ss.setlist_id = g.setlist_id;
  END IF;

  v_expected_end := CASE
    WHEN v_duration_seconds > 0 THEN
      coalesce(g.started_at, g.scheduled_date) + make_interval(secs => v_duration_seconds)
    WHEN g.scheduled_end IS NOT NULL THEN g.scheduled_end
    ELSE coalesce(g.started_at, g.scheduled_date) + interval '1 hour'
  END;

  IF v_expected_end IS NULL THEN
    RAISE EXCEPTION 'gig_completion_time_unavailable';
  END IF;
  IF now() < v_expected_end THEN
    RAISE EXCEPTION 'gig_not_due_for_completion:%', v_expected_end;
  END IF;
  IF g.completion_claimed_at IS NOT NULL
    AND g.completion_claimed_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('alreadyCompleted', false, 'alreadyProcessing', true);
  END IF;

  UPDATE public.gigs SET completion_claimed_at = now(), updated_at = now()
  WHERE id = p_gig_id;

  SELECT id INTO v_processing_id
  FROM public.gig_post_processing
  WHERE gig_id = p_gig_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_processing_id IS NULL THEN
    INSERT INTO public.gig_post_processing (gig_id, status)
    VALUES (p_gig_id, 'processing');
  ELSE
    UPDATE public.gig_post_processing
    SET status = 'processing', completed_at = NULL
    WHERE id = v_processing_id;
  END IF;

  RETURN jsonb_build_object(
    'alreadyCompleted', false,
    'alreadyProcessing', false,
    'claimedAt', now(),
    'expectedEndAt', v_expected_end
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_gig_completion(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gig_completion(uuid) TO service_role;

COMMENT ON FUNCTION public.claim_gig_completion(uuid) IS
  'Idempotently claims due gig completion and reuses post-processing on retries.';

NOTIFY pgrst, 'reload schema';
