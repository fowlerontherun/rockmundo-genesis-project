-- Safe for LIVE execution: synthetic lottery draws exist only inside a
-- rollback transaction. No real ticket, balance or historic draw is changed.
-- Regression #4224: before-cutoff, due, replay and corrupted-result paths.
BEGIN;
SET LOCAL statement_timeout = '15s';
DO $test$
DECLARE
  future_id uuid;
  due_id uuid;
  existing_id uuid;
  broken_id uuid;
  result jsonb;
  numbers integer[];
  drawn_bonus integer;
BEGIN
  -- Do not touch a real due draw even in a rollback-only harness.
  IF EXISTS (
    SELECT 1 FROM public.lottery_draws
     WHERE status IN ('pending','drawn')
       AND week_start::timestamp + interval '7 days 5 minutes' <= (now() AT TIME ZONE 'UTC')
  ) THEN RAISE EXCEPTION 'lottery_live_due_draw_present_skip_fixture'; END IF;

  IF EXISTS (SELECT 1 FROM public.lottery_draws WHERE week_start IN
    ('2030-01-07'::date,'2016-01-04'::date,'2014-01-06'::date,'2013-01-07'::date))
  THEN RAISE EXCEPTION 'lottery_fixture_week_collision'; END IF;

  INSERT INTO public.lottery_draws(week_start,jackpot_amount)
  VALUES ('2030-01-07',1000000) RETURNING id INTO future_id;

  result := public.process_weekly_lottery_draw();
  IF result->>'status' <> 'no_due_draw'
     OR (SELECT status FROM public.lottery_draws WHERE id=future_id) <> 'pending'
  THEN RAISE EXCEPTION 'lottery_pre_due_draw_processed'; END IF;

  INSERT INTO public.lottery_draws(week_start,jackpot_amount)
  VALUES ('2016-01-04',1234567) RETURNING id INTO due_id;
  result := public.process_weekly_lottery_draw();
  IF result->>'status' <> 'paid_out' OR (result->>'draw_id')::uuid <> due_id
  THEN RAISE EXCEPTION 'lottery_due_draw_not_processed: %', result; END IF;
  SELECT winning_numbers,bonus_number INTO numbers,drawn_bonus
    FROM public.lottery_draws WHERE id=due_id AND status='paid_out';
  IF cardinality(numbers) <> 7
     OR (SELECT count(distinct n) FROM unnest(numbers) AS n WHERE n BETWEEN 1 AND 49) <> 7
     OR drawn_bonus NOT BETWEEN 1 AND 10
  THEN RAISE EXCEPTION 'lottery_generated_numbers_invalid'; END IF;

  -- Repeated job delivery must not redraw a paid-out record.
  result := public.process_weekly_lottery_draw();
  IF result->>'status' <> 'no_due_draw'
     OR (SELECT winning_numbers FROM public.lottery_draws WHERE id=due_id) <> numbers
     OR (SELECT status FROM public.lottery_draws WHERE id=future_id) <> 'pending'
  THEN RAISE EXCEPTION 'lottery_replay_mutated_draw'; END IF;

  -- A valid previously-revealed draw is resumed without regenerating balls.
  INSERT INTO public.lottery_draws(week_start,jackpot_amount,status,winning_numbers,bonus_number,draw_date)
  VALUES ('2014-01-06',1000000,'drawn',ARRAY[1,7,13,23,35,42,49],7,now())
  RETURNING id INTO existing_id;
  result := public.process_weekly_lottery_draw();
  IF (result->>'draw_id')::uuid IS DISTINCT FROM existing_id
      OR (SELECT winning_numbers FROM public.lottery_draws WHERE id=existing_id)
         IS DISTINCT FROM ARRAY[1,7,13,23,35,42,49]::integer[]
      OR (SELECT status FROM public.lottery_draws WHERE id=existing_id)<>'paid_out'
  THEN RAISE EXCEPTION 'lottery_existing_result_was_redrawn'; END IF;

  -- A corrupted prior result is rejected instead of silently rerolled.
  INSERT INTO public.lottery_draws(week_start,jackpot_amount,status,winning_numbers,bonus_number,draw_date)
  VALUES ('2013-01-07',1000000,'drawn',ARRAY[1,2,3,4,5],7,now())
  RETURNING id INTO broken_id;
  BEGIN
    PERFORM public.process_weekly_lottery_draw();
    RAISE EXCEPTION 'lottery_corrupt_result_not_rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'lottery_draw_invalid_existing_result' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.lottery_draws WHERE id=broken_id)<>'drawn'
  THEN RAISE EXCEPTION 'lottery_corrupt_result_status_mutated'; END IF;

  IF has_function_privilege('anon','public.process_weekly_lottery_draw()','EXECUTE')
     OR has_function_privilege('authenticated','public.process_weekly_lottery_draw()','EXECUTE')
     OR NOT has_function_privilege('service_role','public.process_weekly_lottery_draw()','EXECUTE')
  THEN RAISE EXCEPTION 'lottery_draw_authority_grant_drift'; END IF;
END
$test$;
ROLLBACK;
SELECT 'lottery_cron_only_authority_harness_passed' AS result;
