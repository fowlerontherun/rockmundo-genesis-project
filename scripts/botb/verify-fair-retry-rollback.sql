-- Run only as a trusted DB administrator. This test uses real future
-- registered battles but rolls back ALL simulated outcomes and cash/XP.
-- The duplicate payout is intentional fault injection inside a savepoint.
DO $botb_retry_test$
DECLARE
  v_bad record;
  v_good record;
  v_first jsonb; v_second jsonb; v_third jsonb;
  v_balance_bad bigint; v_balance_good bigint;
  v_prior_prizes integer;
BEGIN
  SELECT e.id,e.city_id,be.band_id INTO v_bad
  FROM public.botb_events e JOIN public.cities c ON c.id=e.city_id
  JOIN public.botb_entries be ON be.event_id=e.id
  WHERE e.status='upcoming' AND e.scheduled_date>now()
    AND c.name='Cork' ORDER BY e.scheduled_date LIMIT 1;
  SELECT e.id,e.city_id,be.band_id INTO v_good
  FROM public.botb_events e JOIN public.cities c ON c.id=e.city_id
  JOIN public.botb_entries be ON be.event_id=e.id
  WHERE e.status='upcoming' AND e.scheduled_date>now()
    AND c.name='London' ORDER BY e.scheduled_date LIMIT 1;

  IF v_bad.id IS NULL OR v_good.id IS NULL THEN
    RAISE EXCEPTION 'BOTB_RETRY_TEST_EVENTS_UNAVAILABLE';
  END IF;
  IF EXISTS(SELECT 1 FROM public.botb_events
            WHERE status='upcoming' AND scheduled_date<=now()) THEN
    RAISE EXCEPTION 'BOTB_RETRY_TEST_REAL_DUE_EVENTS';
  END IF;

  SELECT band_balance INTO v_balance_bad
  FROM public.bands WHERE id=v_bad.band_id;
  SELECT band_balance INTO v_balance_good
  FROM public.bands WHERE id=v_good.band_id;
  SELECT COUNT(*) INTO v_prior_prizes
  FROM public.band_earnings WHERE source='battle_of_the_bands';

  BEGIN
    UPDATE public.botb_events SET scheduled_date=now()-interval '2 minutes'
    WHERE id IN(v_bad.id,v_good.id);

    INSERT INTO public.band_earnings
      (band_id,amount,source,description,metadata)
    VALUES (v_bad.band_id,1,'battle_of_the_bands',
      'Rollback-only duplicate payout test',
      jsonb_build_object('event_id',v_bad.id,'city_id',v_bad.city_id));

    -- Attempt both battles: one fails with duplicate prize, one succeeds.
    v_first := public.run_botb_cycle();
    IF (v_first->>'failed')::integer<>1 OR
       (v_first->>'completed')::integer<>1 OR
       (v_first->>'attempted')::integer<>2 OR
       (SELECT attempt_count FROM public.botb_resolution_failures
        WHERE event_id=v_bad.id)<>1
    THEN RAISE EXCEPTION 'BOTB_RETRY_FIRST_BAD_COUNTS %',v_first; END IF;

    -- Backoff must prevent immediately retrying the same broken event.
    v_second:=public.run_botb_cycle();
    IF (v_second->>'attempted')::integer<>0
       OR (v_second->>'failed')::integer<>0
    THEN RAISE EXCEPTION 'BOTB_RETRY_BACKOFF_FAIL %',v_second; END IF;

    -- Artificially age the transient failure and verify retry is restored.
    UPDATE public.botb_resolution_failures
    SET last_failed_at=now()-interval '60 minutes'
    WHERE event_id=v_bad.id;
    v_third:=public.run_botb_cycle();
    IF (v_third->>'attempted')::integer<>1 OR
       (v_third->>'failed')::integer<>1 OR
       (SELECT attempt_count FROM public.botb_resolution_failures
        WHERE event_id=v_bad.id)<>2
    THEN RAISE EXCEPTION 'BOTB_RETRY_RESUME_FAIL %',v_third; END IF;

    IF (SELECT status FROM public.botb_events WHERE id=v_bad.id)<>'upcoming'
       OR (SELECT status FROM public.botb_events WHERE id=v_good.id)<>'completed'
    THEN RAISE EXCEPTION 'BOTB_RETRY_STATE_FAIL'; END IF;

    RAISE EXCEPTION 'BOTB_RETRY_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'BOTB_RETRY_ROLLBACK' THEN RAISE; END IF;
  END;

  -- Production state must be unchanged after the caught exception.
  IF (SELECT status FROM public.botb_events WHERE id=v_bad.id)<>'upcoming'
     OR (SELECT status FROM public.botb_events WHERE id=v_good.id)<>'upcoming'
     OR (SELECT band_balance FROM public.bands WHERE id=v_bad.band_id)<>v_balance_bad
     OR (SELECT band_balance FROM public.bands WHERE id=v_good.band_id)<>v_balance_good
     OR (SELECT count(*) FROM public.band_earnings
         WHERE source='battle_of_the_bands')<>v_prior_prizes
     OR EXISTS(SELECT 1 FROM public.botb_resolution_failures
               WHERE event_id=v_bad.id)
  THEN RAISE EXCEPTION 'BOTB_RETRY_ROLLBACK_LEAK'; END IF;
END;
$botb_retry_test$;

SELECT 'PASS' as retry_backoff_fault_injection;
