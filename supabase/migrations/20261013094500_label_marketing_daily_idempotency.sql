-- Serialize label marketing runs and persist the day's completed result.
-- The existing processor stays unchanged behind a privileged internal name.
CREATE TABLE IF NOT EXISTS public.label_marketing_daily_runs (
  processing_date date PRIMARY KEY,
  result jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.label_marketing_daily_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.label_marketing_daily_runs TO service_role;

ALTER FUNCTION public.process_label_marketing_daily()
  RENAME TO process_label_marketing_daily_internal;

REVOKE ALL ON FUNCTION public.process_label_marketing_daily_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_label_marketing_daily_internal() TO service_role;

CREATE FUNCTION public.process_label_marketing_daily()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
  v_result jsonb;
BEGIN
  -- Concurrent invocations wait; the second run observes the first's
  -- committed result. A failed run rolls back both payout and marker.
  PERFORM pg_advisory_xact_lock(hashtext('rockmundo:label-marketing-daily'));
  SELECT result INTO v_result
    FROM public.label_marketing_daily_runs WHERE processing_date = v_day;
  IF FOUND THEN
    RETURN v_result;
  END IF;

  v_result := public.process_label_marketing_daily_internal();
  INSERT INTO public.label_marketing_daily_runs(processing_date, result)
  VALUES (v_day, v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.process_label_marketing_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_label_marketing_daily() TO service_role;
