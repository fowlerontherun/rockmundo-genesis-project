-- Rollback-only production/staging integration check for Battle of the Bands.
-- Run as a trusted SQL administrator using Supabase SQL Editor. The script
-- requires three future battles, each with exactly one band registered.
--
-- Every trial settlement runs INSIDE a PL/pgSQL exception subtransaction and
-- is deliberately rolled back. Do not remove the named rollback exceptions.
-- Any unexpected error aborts the statement and reports the failing invariant.
-- Never use this script for ordinary live payouts.

DO $botb_settlement_smoke$
DECLARE
  v record;
  v_result jsonb;
  v_city_before bigint;
  v_band_before bigint;
  v_members integer;
  v_xp_before bigint;
  v_ap_before bigint;
  v_xp_after bigint;
  v_ap_after bigint;
  v_city_profit bigint;
  v_prize integer;
  v_attendance integer;
  v_checked integer:=0;
BEGIN
  FOR v IN
    SELECT e.id,e.city_id,c.name AS city,be.band_id
    FROM public.botb_events e
    JOIN public.cities c ON c.id=e.city_id
    JOIN public.botb_entries be ON be.event_id=e.id
    WHERE e.status='upcoming' AND e.scheduled_date>now()
      AND (SELECT count(*) FROM public.botb_entries b2 WHERE b2.event_id=e.id)=1
    ORDER BY c.name,e.scheduled_date
    LIMIT 3
  LOOP
    SELECT balance INTO v_city_before FROM public.city_treasury WHERE city_id=v.city_id;
    SELECT band_balance INTO v_band_before FROM public.bands WHERE id=v.band_id;
    SELECT count(*),coalesce(sum(w.xp_balance),0),coalesce(sum(a.attribute_points),0)
      INTO v_members,v_xp_before,v_ap_before
    FROM public.band_members m
    JOIN public.player_xp_wallet w ON w.profile_id=m.profile_id
    JOIN public.player_attributes a ON a.profile_id=m.profile_id
    WHERE m.band_id=v.band_id AND coalesce(m.member_status,'active')='active';
    IF v_members=0 THEN
      RAISE EXCEPTION 'No active reward recipients: %',v.city;
    END IF;

    BEGIN
      -- Move just this event's date back inside the savepoint, then settle
      -- the real event (including real band and city funds), all temporarily.
      UPDATE public.botb_events SET scheduled_date=now()-interval '1 minute'
        WHERE id=v.id AND status='upcoming';
      v_result:=public.resolve_botb_event(v.id);
      IF coalesce((v_result->>'success')::boolean,false) IS DISTINCT FROM TRUE
      THEN RAISE EXCEPTION 'Settlement failed in %: %',v.city,v_result; END IF;

      SELECT prize_money,attendance,city_profit INTO v_prize,v_attendance,v_city_profit
      FROM public.botb_events WHERE id=v.id AND status='completed';
      IF v_prize IS NULL OR v_attendance<=0 OR v_city_profit<0 THEN
        RAISE EXCEPTION 'Missing settled event financials in %',v.city;
      END IF;
      IF (SELECT band_balance FROM public.bands WHERE id=v.band_id)<>v_band_before+v_prize
         OR (SELECT balance FROM public.city_treasury WHERE city_id=v.city_id)
             <>v_city_before+v_city_profit
         OR (SELECT count(*) FROM public.band_earnings
             WHERE source='battle_of_the_bands'
               AND metadata->>'event_id'=v.id::text)<>1
      THEN RAISE EXCEPTION 'Incorrect winner prize or city net credit in %',v.city; END IF;

      SELECT coalesce(sum(w.xp_balance),0),coalesce(sum(a.attribute_points),0)
      INTO v_xp_after,v_ap_after
      FROM public.band_members m
      JOIN public.player_xp_wallet w ON w.profile_id=m.profile_id
      JOIN public.player_attributes a ON a.profile_id=m.profile_id
      WHERE m.band_id=v.band_id AND coalesce(m.member_status,'active')='active';
      IF v_xp_after<>v_xp_before+1000*v_members OR
         v_ap_after<>v_ap_before+6*v_members OR
         (SELECT count(*) FROM public.experience_ledger
          WHERE activity_type='battle_of_the_bands'
            AND metadata->>'event_id'=v.id::text)<>v_members OR
         (SELECT count(*) FROM public.activity_feed
          WHERE activity_type='battle_of_the_bands'
            AND metadata->>'event_id'=v.id::text)<>v_members
      THEN RAISE EXCEPTION 'Incorrect member XP/AP/feed awards in %',v.city; END IF;

      RAISE EXCEPTION 'BOTB_SETTLEMENT_SMOKE_ROLLBACK';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM<>'BOTB_SETTLEMENT_SMOKE_ROLLBACK' THEN RAISE; END IF;
    END;

    -- Confirm all credit and event changes were actually reversed.
    IF (SELECT status FROM public.botb_events WHERE id=v.id)<>'upcoming'
       OR (SELECT band_balance FROM public.bands WHERE id=v.band_id)<>v_band_before
       OR (SELECT balance FROM public.city_treasury WHERE city_id=v.city_id)
           <>v_city_before
       OR EXISTS (SELECT 1 FROM public.band_earnings
           WHERE source='battle_of_the_bands' AND metadata->>'event_id'=v.id::text)
    THEN RAISE EXCEPTION 'Rollback leaked persistent changes in %',v.city; END IF;
    v_checked:=v_checked+1;
  END LOOP;
  IF v_checked<>3 THEN
    RAISE EXCEPTION 'Expected three eligible registered battles, found %',v_checked;
  END IF;
END;
$botb_settlement_smoke$;

-- Exercise the hourly cycle with one deliberately failing battle and one
-- healthy battle. The duplicate-prize index forces the first settlement to
-- fail; the second must complete independently. Everything is rolled back.
DO $botb_cycle_isolation_smoke$
DECLARE
  v_bad record;
  v_good record;
  v_result jsonb;
  v_bad_balance bigint;
  v_good_balance bigint;
BEGIN
  SELECT e.id,e.city_id,be.band_id INTO v_bad
  FROM public.botb_events e JOIN public.botb_entries be ON be.event_id=e.id
  WHERE e.status='upcoming' AND e.scheduled_date>now()
    AND (SELECT count(*) FROM public.botb_entries b2 WHERE b2.event_id=e.id)=1
  ORDER BY e.city_id LIMIT 1;
  SELECT e.id,e.city_id,be.band_id INTO v_good
  FROM public.botb_events e JOIN public.botb_entries be ON be.event_id=e.id
  WHERE e.status='upcoming' AND e.scheduled_date>now() AND e.id<>v_bad.id
    AND (SELECT count(*) FROM public.botb_entries b2 WHERE b2.event_id=e.id)=1
  ORDER BY e.city_id LIMIT 1;
  IF v_bad.id IS NULL OR v_good.id IS NULL THEN
    RAISE EXCEPTION 'Two distinct registered events are required';
  END IF;
  IF EXISTS(SELECT 1 FROM public.botb_events WHERE status='upcoming'
      AND scheduled_date<=now()) THEN
    RAISE EXCEPTION 'Existing due events: refusing synthetic batch test';
  END IF;

  SELECT band_balance INTO v_bad_balance FROM public.bands WHERE id=v_bad.band_id;
  SELECT band_balance INTO v_good_balance FROM public.bands WHERE id=v_good.band_id;
  BEGIN
    UPDATE public.botb_events SET scheduled_date=now()-interval '1 minute'
    WHERE id IN (v_bad.id,v_good.id) AND status='upcoming';

    -- Simulate a pre-existing payment so the bad event fails UNIQUE at prize.
    INSERT INTO public.band_earnings(band_id,amount,source,description,metadata)
    VALUES(v_bad.band_id,1,'battle_of_the_bands','Rollback-only payout collision',
      jsonb_build_object('event_id',v_bad.id,'city_id',v_bad.city_id));

    v_result:=public.run_botb_cycle();
    IF (v_result->>'attempted')::integer<2 OR
       (v_result->>'completed')::integer<1 OR
       (v_result->>'failed')::integer<1 OR
       (SELECT status FROM public.botb_events WHERE id=v_bad.id)<>'upcoming' OR
       (SELECT status FROM public.botb_events WHERE id=v_good.id)<>'completed' OR
       NOT EXISTS(SELECT 1 FROM public.botb_resolution_failures
         WHERE event_id=v_bad.id AND recovered_at IS NULL)
    THEN RAISE EXCEPTION 'Batch failed to isolate settlement: %',v_result; END IF;

    RAISE EXCEPTION 'BOTB_BATCH_SMOKE_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'BOTB_BATCH_SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;

  IF (SELECT status FROM public.botb_events WHERE id=v_bad.id)<>'upcoming'
    OR (SELECT status FROM public.botb_events WHERE id=v_good.id)<>'upcoming'
    OR (SELECT band_balance FROM public.bands WHERE id=v_bad.band_id)<>v_bad_balance
    OR (SELECT band_balance FROM public.bands WHERE id=v_good.band_id)<>v_good_balance
    OR EXISTS(SELECT 1 FROM public.botb_resolution_failures
      WHERE event_id=v_bad.id)
    OR EXISTS(SELECT 1 FROM public.band_earnings
      WHERE source='battle_of_the_bands'
        AND metadata->>'event_id' IN (v_bad.id::text,v_good.id::text))
  THEN RAISE EXCEPTION 'Batch fault-injection transaction leaked'; END IF;
END;
$botb_cycle_isolation_smoke$;

SELECT 'PASS' AS rollback_safe_checks,
  (SELECT count(*) FROM public.botb_events WHERE status='upcoming') upcoming_events,
  (SELECT count(*) FROM public.botb_events e WHERE e.status='upcoming'
     AND EXISTS(SELECT 1 FROM public.botb_entries b WHERE b.event_id=e.id))
      as preserved_registered_battles,
  (SELECT count(*) FROM public.botb_resolution_failures
     WHERE recovered_at IS NULL) as pending_real_failures;
