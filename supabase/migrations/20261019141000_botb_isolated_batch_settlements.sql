-- A single malformed / failing Battle of the Bands payout must not
-- block all other cities. Capture each resolution in its own PL/pgSQL
-- exception subtransaction; a failed attempt rolls back all of its prizes,
-- fame, XP and treasury writes before recording a safe retryable failure.
--
-- This migration changes no live event, band balance or city balance.
CREATE TABLE IF NOT EXISTS public.botb_resolution_failures (
  event_id uuid PRIMARY KEY REFERENCES public.botb_events(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  last_sqlstate text NOT NULL,
  last_message text NOT NULL,
  recovered_at timestamptz
);
ALTER TABLE public.botb_resolution_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.botb_resolution_failures
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.botb_resolution_failures
  TO service_role;

CREATE TABLE IF NOT EXISTS public.botb_cycle_health (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  generated_events integer NOT NULL DEFAULT 0,
  attempted_events integer NOT NULL DEFAULT 0,
  completed_events integer NOT NULL DEFAULT 0,
  cancelled_events integer NOT NULL DEFAULT 0,
  failed_events integer NOT NULL DEFAULT 0,
  generator_error text
);
ALTER TABLE public.botb_cycle_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.botb_cycle_health FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.botb_cycle_health TO service_role;

CREATE OR REPLACE FUNCTION public.run_botb_cycle()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $run_botb$
DECLARE
  v_event record;
  v_result jsonb;
  v_generated integer := 0;
  v_attempted integer := 0;
  v_resolved integer := 0;
  v_completed integer := 0;
  v_cancelled integer := 0;
  v_failed integer := 0;
  v_error_state text;
  v_error_message text;
  v_generator_error text := null;
BEGIN
  -- An event whose schedule generation failed must still be processed.
  BEGIN
    v_generated := public.generate_botb_events(3);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE,
                            v_error_message = MESSAGE_TEXT;
    v_generator_error := LEFT(v_error_state || ': ' || v_error_message,500);
  END;

  FOR v_event IN
    SELECT id FROM public.botb_events
    WHERE status='upcoming' AND scheduled_date<=now()
    ORDER BY scheduled_date ASC,id ASC
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  LOOP
    v_attempted := v_attempted+1;
    -- Any exception rolls back this event's resolver work ONLY. In
    -- particular, band earnings triggers and wallet/XP crediting cannot
    -- be partially committed for a failing event.
    BEGIN
      v_result := public.resolve_botb_event(v_event.id);
      IF COALESCE((v_result->>'success')::boolean,false) THEN
        v_resolved := v_resolved+1;
        IF v_result->>'reason'='no_entries' THEN
          v_cancelled:=v_cancelled+1;
        ELSE
          v_completed:=v_completed+1;
        END IF;
        UPDATE public.botb_resolution_failures
          SET recovered_at=now()
          WHERE event_id=v_event.id AND recovered_at IS NULL;
      ELSE
        v_failed := v_failed+1;
        INSERT INTO public.botb_resolution_failures
          (event_id,last_sqlstate,last_message)
        VALUES(v_event.id,'BOTB0',
          LEFT(COALESCE(v_result->>'reason','resolver_returned_no_success'),500))
        ON CONFLICT(event_id) DO UPDATE SET
          attempt_count=public.botb_resolution_failures.attempt_count+1,
          last_failed_at=now(),
          last_sqlstate=EXCLUDED.last_sqlstate,
          last_message=EXCLUDED.last_message,
          recovered_at=NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE,
                              v_error_message = MESSAGE_TEXT;
      v_failed:=v_failed+1;
      INSERT INTO public.botb_resolution_failures
        (event_id,last_sqlstate,last_message)
      VALUES(v_event.id,LEFT(v_error_state,5),LEFT(v_error_message,500))
      ON CONFLICT(event_id) DO UPDATE SET
        attempt_count=public.botb_resolution_failures.attempt_count+1,
        last_failed_at=now(),
        last_sqlstate=EXCLUDED.last_sqlstate,
        last_message=EXCLUDED.last_message,
        recovered_at=NULL;
    END;
  END LOOP;

  INSERT INTO public.botb_cycle_health
    (singleton,last_run_at,generated_events,attempted_events,
     completed_events,cancelled_events,failed_events,generator_error)
  VALUES(true,now(),v_generated,v_attempted,
    v_completed,v_cancelled,v_failed,v_generator_error)
  ON CONFLICT(singleton) DO UPDATE SET
    last_run_at=EXCLUDED.last_run_at,
    generated_events=EXCLUDED.generated_events,
    attempted_events=EXCLUDED.attempted_events,
    completed_events=EXCLUDED.completed_events,
    cancelled_events=EXCLUDED.cancelled_events,
    failed_events=EXCLUDED.failed_events,
    generator_error=EXCLUDED.generator_error;

  -- Keep 'resolved' backwards compatible: counts completed + cancelled.
  RETURN jsonb_build_object(
    'resolved',v_resolved,'completed',v_completed,
    'cancelled',v_cancelled,'failed',v_failed,
    'attempted',v_attempted,'generated',v_generated,
    'schedule_error',v_generator_error
  );
END;
$run_botb$;
REVOKE ALL ON FUNCTION public.run_botb_cycle() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_botb_cycle() TO service_role;
