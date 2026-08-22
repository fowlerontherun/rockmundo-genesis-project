-- Add missing columns to sponsorship_payments for tracking status.
-- This migration predates the canonical sponsorship schema and historically
-- assumed the table always existed. Fresh database builds can legitimately reach
-- this migration without that optional table, so keep the upgrade idempotent.
DO $$
BEGIN
  IF to_regclass('public.sponsorship_payments') IS NOT NULL THEN
    ALTER TABLE public.sponsorship_payments
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid', 'cancelled')),
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

    UPDATE public.sponsorship_payments
    SET status = 'paid'
    WHERE status IS NULL;
  ELSE
    RAISE NOTICE 'Skipping legacy sponsorship_payments status upgrade; table is not present';
  END IF;
END;
$$;

-- Register the processor only when the cron configuration table is available.
-- Existing deployed databases retain the same row; clean builds no longer fail
-- just because the legacy sponsorship table is absent.
DO $$
BEGIN
  IF to_regclass('public.cron_job_config') IS NOT NULL THEN
    INSERT INTO public.cron_job_config (
      job_name,
      edge_function_name,
      display_name,
      description,
      schedule,
      allow_manual_trigger
    )
    VALUES (
      'process_sponsorship_payments',
      'process-sponsorship-payments',
      'Process Sponsorship Payments',
      'Processes weekly sponsorship payments to bands and players',
      '0 0 * * 0',
      true
    )
    ON CONFLICT (job_name) DO NOTHING;
  ELSE
    RAISE NOTICE 'Skipping sponsorship payment cron registration; cron_job_config is not present';
  END IF;
END;
$$;
