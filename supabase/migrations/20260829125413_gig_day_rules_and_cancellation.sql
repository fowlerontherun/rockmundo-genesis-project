-- Gig day-rule and cancellation authority (deployed as 20260829125413).
--
-- Booking rule:
--   * A band may only play more than one show on the same local calendar day
--     when every show is at the same venue.
--   * Same-venue shows require at least four full hours between one show ending
--     and the next beginning.
--
-- Cancellation policy (calculated from the authoritative scheduled start):
--   14+ days: 100% booking-fee refund, no career penalty
--   7-14 days: 75% refund, -5 fame, -2 sentiment, -1 reputation
--   3-7 days: 50% refund, -15 fame, -5 sentiment, -3 reputation
--   1-3 days: 25% refund, -30 fame, -10 sentiment, -7 reputation
--   <24 hours: no refund, -50 fame, -15 sentiment, -12 reputation
-- City permits and third-party service charges are deliberately non-refundable.

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_policy_version text,
  ADD COLUMN IF NOT EXISTS cancellation_tier text,
  ADD COLUMN IF NOT EXISTS cancellation_notice_hours numeric(12, 2),
  ADD COLUMN IF NOT EXISTS cancellation_refund_percentage integer,
  ADD COLUMN IF NOT EXISTS cancellation_refund_amount integer,
  ADD COLUMN IF NOT EXISTS cancellation_fame_penalty integer,
  ADD COLUMN IF NOT EXISTS cancellation_fan_sentiment_penalty numeric(8, 2),
  ADD COLUMN IF NOT EXISTS cancellation_reputation_penalty numeric(8, 2),
  ADD COLUMN IF NOT EXISTS cancellation_financial_transaction_id uuid REFERENCES public.financial_transactions(id);

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gigs'::regclass
      AND conname = 'gigs_cancellation_refund_percentage_check'
  ) THEN
    ALTER TABLE public.gigs
      ADD CONSTRAINT gigs_cancellation_refund_percentage_check
      CHECK (cancellation_refund_percentage IS NULL OR cancellation_refund_percentage BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gigs'::regclass
      AND conname = 'gigs_cancellation_nonnegative_values_check'
  ) THEN
    ALTER TABLE public.gigs
      ADD CONSTRAINT gigs_cancellation_nonnegative_values_check
      CHECK (
        COALESCE(cancellation_notice_hours, 0) >= 0
        AND COALESCE(cancellation_refund_amount, 0) >= 0
        AND COALESCE(cancellation_fame_penalty, 0) >= 0
        AND COALESCE(cancellation_fan_sentiment_penalty, 0) >= 0
        AND COALESCE(cancellation_reputation_penalty, 0) >= 0
      );
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS gigs_band_active_schedule_idx
  ON public.gigs (band_id, scheduled_date)
  WHERE status IN ('scheduled', 'confirmed', 'in_progress', 'ready_for_completion', 'live');

CREATE OR REPLACE FUNCTION public._evaluate_gig_day_rule(
  p_band_id uuid,
  p_venue_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_local_date date,
  p_exclude_gig_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_existing record;
  v_gap_minutes integer;
  v_nearest_gap_minutes integer;
  v_same_day_count integer := 0;
  v_minimum_gap_minutes constant integer := 240;
BEGIN
  IF p_band_id IS NULL OR p_venue_id IS NULL OR p_start IS NULL OR p_end IS NULL OR p_local_date IS NULL THEN
    RAISE EXCEPTION 'gig_booking_day_rule_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'gig_booking_day_rule_invalid' USING ERRCODE = '22023';
  END IF;

  FOR v_existing IN
    WITH band_shows AS (
      SELECT
        g.id,
        g.venue_id,
        g.scheduled_date,
        g.scheduled_end,
        g.slot_start_time,
        g.slot_end_time,
        g.time_slot,
        g.status
      FROM public.gigs g
      WHERE g.band_id = p_band_id

      UNION

      SELECT
        g.id,
        g.venue_id,
        g.scheduled_date,
        g.scheduled_end,
        g.slot_start_time,
        g.slot_end_time,
        g.time_slot,
        g.status
      FROM public.gig_support_slots support
      JOIN public.gigs g ON g.id = support.gig_id
      WHERE support.support_band_id = p_band_id
        AND support.status IN ('accepted', 'completed')
    )
    SELECT
      band_show.id,
      band_show.venue_id,
      band_show.scheduled_date,
      COALESCE(
        band_show.scheduled_end,
        band_show.scheduled_date + CASE
          WHEN band_show.slot_start_time IS NOT NULL AND band_show.slot_end_time IS NOT NULL THEN
            (band_show.slot_end_time - band_show.slot_start_time)
            + CASE WHEN band_show.slot_end_time <= band_show.slot_start_time THEN interval '1 day' ELSE interval '0' END
          ELSE interval '3 hours'
        END
      ) AS scheduled_end,
      band_show.time_slot,
      v.name AS venue_name
    FROM band_shows band_show
    JOIN public.venues v ON v.id = band_show.venue_id
    LEFT JOIN public.cities c ON c.id = v.city_id
    WHERE band_show.id IS DISTINCT FROM p_exclude_gig_id
      AND band_show.status IN (
        'scheduled', 'confirmed', 'in_progress', 'ready_for_completion',
        'live', 'completed', 'performed'
      )
      AND (band_show.scheduled_date AT TIME ZONE COALESCE(c.timezone, 'UTC'))::date = p_local_date
    ORDER BY band_show.scheduled_date, band_show.id
  LOOP
    v_same_day_count := v_same_day_count + 1;

    IF v_existing.venue_id <> p_venue_id THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'different_venue',
        'minimum_gap_minutes', v_minimum_gap_minutes,
        'same_day_show_count', v_same_day_count,
        'existing_show', jsonb_build_object(
          'gig_id', v_existing.id,
          'venue_id', v_existing.venue_id,
          'venue_name', v_existing.venue_name,
          'scheduled_start', v_existing.scheduled_date,
          'scheduled_end', v_existing.scheduled_end,
          'time_slot', v_existing.time_slot
        )
      );
    END IF;

    v_gap_minutes := CASE
      WHEN p_start >= v_existing.scheduled_end THEN
        floor(extract(epoch FROM (p_start - v_existing.scheduled_end)) / 60)::integer
      WHEN v_existing.scheduled_date >= p_end THEN
        floor(extract(epoch FROM (v_existing.scheduled_date - p_end)) / 60)::integer
      ELSE 0
    END;

    IF v_gap_minutes < v_minimum_gap_minutes THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', CASE WHEN v_gap_minutes = 0 THEN 'overlap' ELSE 'insufficient_gap' END,
        'minimum_gap_minutes', v_minimum_gap_minutes,
        'actual_gap_minutes', v_gap_minutes,
        'same_day_show_count', v_same_day_count,
        'existing_show', jsonb_build_object(
          'gig_id', v_existing.id,
          'venue_id', v_existing.venue_id,
          'venue_name', v_existing.venue_name,
          'scheduled_start', v_existing.scheduled_date,
          'scheduled_end', v_existing.scheduled_end,
          'time_slot', v_existing.time_slot
        )
      );
    END IF;

    v_nearest_gap_minutes := CASE
      WHEN v_nearest_gap_minutes IS NULL THEN v_gap_minutes
      ELSE LEAST(v_nearest_gap_minutes, v_gap_minutes)
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', CASE WHEN v_same_day_count = 0 THEN 'no_same_day_show' ELSE 'same_venue_gap_ok' END,
    'minimum_gap_minutes', v_minimum_gap_minutes,
    'actual_gap_minutes', v_nearest_gap_minutes,
    'same_day_show_count', v_same_day_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._evaluate_gig_day_rule(uuid, uuid, timestamptz, timestamptz, date, uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_gig_booking_day_rule(
  p_band_id uuid,
  p_venue_id uuid,
  p_local_date date,
  p_slot text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_timezone text;
  v_start_time time;
  v_end_time time;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gig_booking_unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'gig_booking_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(c.timezone, 'UTC')
  INTO v_timezone
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_venue_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT slot.start_time, slot.end_time
  INTO v_start_time, v_end_time
  FROM (VALUES
    ('kids', time '15:00', time '15:30'),
    ('opening', time '19:00', time '19:30'),
    ('support', time '19:45', time '20:30'),
    ('headline', time '20:45', time '22:00')
  ) AS slot(id, start_time, end_time)
  WHERE slot.id = p_slot;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_slot_invalid' USING ERRCODE = '22023';
  END IF;

  v_start := (p_local_date + v_start_time) AT TIME ZONE v_timezone;
  v_end := (
    p_local_date + v_end_time
    + CASE WHEN v_end_time <= v_start_time THEN interval '1 day' ELSE interval '0' END
  ) AT TIME ZONE v_timezone;

  RETURN public._evaluate_gig_day_rule(
    p_band_id,
    p_venue_id,
    v_start,
    v_end,
    p_local_date,
    NULL
  ) || jsonb_build_object(
    'candidate_start', v_start,
    'candidate_end', v_end,
    'venue_timezone', v_timezone,
    'local_date', p_local_date,
    'slot', p_slot
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.check_gig_booking_day_rule(uuid, uuid, date, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_gig_booking_day_rule(uuid, uuid, date, text)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_gig_day_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_timezone text;
  v_local_date date;
  v_result jsonb;
  v_should_check boolean := true;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed', 'in_progress', 'ready_for_completion', 'live') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_should_check :=
      NEW.band_id IS DISTINCT FROM OLD.band_id
      OR NEW.venue_id IS DISTINCT FROM OLD.venue_id
      OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
      OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
      OR NEW.slot_start_time IS DISTINCT FROM OLD.slot_start_time
      OR NEW.slot_end_time IS DISTINCT FROM OLD.slot_end_time
      OR (
        OLD.status NOT IN ('scheduled', 'confirmed', 'in_progress', 'ready_for_completion', 'live')
        AND NEW.status IN ('scheduled', 'confirmed')
      );
  END IF;

  IF NOT v_should_check THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:' || NEW.band_id::text, 0));

  SELECT COALESCE(c.timezone, 'UTC')
  INTO v_timezone
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE v.id = NEW.venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_venue_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_local_date := (NEW.scheduled_date AT TIME ZONE v_timezone)::date;
  v_result := public._evaluate_gig_day_rule(
    NEW.band_id,
    NEW.venue_id,
    NEW.scheduled_date,
    COALESCE(
      NEW.scheduled_end,
      NEW.scheduled_date + CASE
        WHEN NEW.slot_start_time IS NOT NULL AND NEW.slot_end_time IS NOT NULL THEN
          (NEW.slot_end_time - NEW.slot_start_time)
          + CASE
              WHEN NEW.slot_end_time <= NEW.slot_start_time THEN interval '1 day'
              ELSE interval '0'
            END
        ELSE interval '3 hours'
      END
    ),
    v_local_date,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
  );

  IF COALESCE((v_result->>'allowed')::boolean, false) THEN
    RETURN NEW;
  END IF;

  IF v_result->>'reason' = 'different_venue' THEN
    RAISE EXCEPTION 'gig_booking_same_day_different_venue'
      USING ERRCODE = '23P01', DETAIL = v_result::text;
  END IF;

  RAISE EXCEPTION 'gig_booking_same_day_gap_too_short'
    USING ERRCODE = '23P01', DETAIL = v_result::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_gig_day_rule()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_gig_day_rule ON public.gigs;
CREATE TRIGGER enforce_gig_day_rule
BEFORE INSERT OR UPDATE OF
  band_id, venue_id, scheduled_date, scheduled_end,
  slot_start_time, slot_end_time, status
ON public.gigs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_gig_day_rule();

CREATE OR REPLACE FUNCTION public.enforce_support_gig_day_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_gig record;
  v_result jsonb;
  v_should_check boolean := true;
BEGIN
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_should_check :=
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.support_band_id IS DISTINCT FROM OLD.support_band_id
      OR NEW.gig_id IS DISTINCT FROM OLD.gig_id;
  END IF;

  IF NOT v_should_check THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:' || NEW.support_band_id::text, 0));

  SELECT
    g.id,
    g.venue_id,
    g.scheduled_date,
    COALESCE(
      g.scheduled_end,
      g.scheduled_date + CASE
        WHEN g.slot_start_time IS NOT NULL AND g.slot_end_time IS NOT NULL THEN
          (g.slot_end_time - g.slot_start_time)
          + CASE
              WHEN g.slot_end_time <= g.slot_start_time THEN interval '1 day'
              ELSE interval '0'
            END
        ELSE interval '3 hours'
      END
    ) AS scheduled_end,
    COALESCE(c.timezone, 'UTC') AS venue_timezone
  INTO v_gig
  FROM public.gigs g
  JOIN public.venues v ON v.id = g.venue_id
  LEFT JOIN public.cities c ON c.id = v.city_id
  WHERE g.id = NEW.gig_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_gig_unavailable' USING ERRCODE = '23514';
  END IF;

  v_result := public._evaluate_gig_day_rule(
    NEW.support_band_id,
    v_gig.venue_id,
    v_gig.scheduled_date,
    v_gig.scheduled_end,
    (v_gig.scheduled_date AT TIME ZONE v_gig.venue_timezone)::date,
    NEW.gig_id
  );

  IF COALESCE((v_result->>'allowed')::boolean, false) THEN
    RETURN NEW;
  END IF;

  IF v_result->>'reason' = 'different_venue' THEN
    RAISE EXCEPTION 'gig_booking_same_day_different_venue'
      USING ERRCODE = '23P01', DETAIL = v_result::text;
  END IF;

  RAISE EXCEPTION 'gig_booking_same_day_gap_too_short'
    USING ERRCODE = '23P01', DETAIL = v_result::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_support_gig_day_rule()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_support_gig_day_rule ON public.gig_support_slots;
CREATE TRIGGER enforce_support_gig_day_rule
BEFORE INSERT OR UPDATE OF status, support_band_id, gig_id
ON public.gig_support_slots
FOR EACH ROW
EXECUTE FUNCTION public.enforce_support_gig_day_rule();

CREATE OR REPLACE FUNCTION public._gig_cancellation_quote(
  p_gig_id uuid,
  p_as_of timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_venue_name text;
  v_notice_hours numeric;
  v_tier text;
  v_refund_percentage integer;
  v_fame_penalty integer;
  v_sentiment_penalty numeric;
  v_reputation_penalty numeric;
  v_booking_fee integer;
  v_refund_amount integer;
BEGIN
  SELECT g.*
  INTO v_gig
  FROM public.gigs g
  WHERE g.id = p_gig_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_cancellation_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.name INTO v_venue_name
  FROM public.venues v
  WHERE v.id = v_gig.venue_id;

  v_notice_hours := extract(epoch FROM (v_gig.scheduled_date - p_as_of)) / 3600.0;
  v_booking_fee := GREATEST(COALESCE(v_gig.booking_fee, 0), 0);

  IF v_notice_hours >= 336 THEN
    v_tier := 'fourteen_days_plus';
    v_refund_percentage := 100;
    v_fame_penalty := 0;
    v_sentiment_penalty := 0;
    v_reputation_penalty := 0;
  ELSIF v_notice_hours >= 168 THEN
    v_tier := 'seven_to_fourteen_days';
    v_refund_percentage := 75;
    v_fame_penalty := 5;
    v_sentiment_penalty := 2;
    v_reputation_penalty := 1;
  ELSIF v_notice_hours >= 72 THEN
    v_tier := 'three_to_seven_days';
    v_refund_percentage := 50;
    v_fame_penalty := 15;
    v_sentiment_penalty := 5;
    v_reputation_penalty := 3;
  ELSIF v_notice_hours >= 24 THEN
    v_tier := 'one_to_three_days';
    v_refund_percentage := 25;
    v_fame_penalty := 30;
    v_sentiment_penalty := 10;
    v_reputation_penalty := 7;
  ELSE
    v_tier := 'under_twenty_four_hours';
    v_refund_percentage := 0;
    v_fame_penalty := 50;
    v_sentiment_penalty := 15;
    v_reputation_penalty := 12;
  END IF;

  v_refund_amount := floor(v_booking_fee::numeric * v_refund_percentage / 100)::integer;

  RETURN jsonb_build_object(
    'gig_id', v_gig.id,
    'band_id', v_gig.band_id,
    'venue_id', v_gig.venue_id,
    'venue_name', v_venue_name,
    'scheduled_start', v_gig.scheduled_date,
    'status', v_gig.status,
    'can_cancel', v_gig.status IN ('scheduled', 'confirmed') AND v_notice_hours > 0,
    'policy_version', 'gig-cancellation-v1',
    'tier', v_tier,
    'notice_hours', GREATEST(round(v_notice_hours, 2), 0),
    'booking_fee', v_booking_fee,
    'refund_percentage', v_refund_percentage,
    'refund_amount', v_refund_amount,
    'non_refundable_amount', v_booking_fee - v_refund_amount,
    'fame_penalty', v_fame_penalty,
    'fan_sentiment_penalty', v_sentiment_penalty,
    'reputation_penalty', v_reputation_penalty
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._gig_cancellation_quote(uuid, timestamptz)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_gig_cancellation(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_band_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gig_cancellation_unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT band_id INTO v_band_id FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_cancellation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.can_manage_band_gigs(v_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'gig_cancellation_forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN public._gig_cancellation_quote(p_gig_id, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_gig_cancellation(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_gig_cancellation(uuid)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_gig(
  p_gig_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_quote jsonb;
  v_reason text;
  v_refund_amount integer;
  v_refund_percentage integer;
  v_fame_penalty integer;
  v_sentiment_penalty numeric;
  v_reputation_penalty numeric;
  v_original_transaction public.financial_transactions%ROWTYPE;
  v_refund_transaction_id uuid;
  v_band_balance_minor bigint;
  v_used_canonical_ledger boolean := false;
  v_cancelled_at timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gig_cancellation_unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND died_at IS NULL
  ORDER BY COALESCE(is_active, false) DESC,
           updated_at DESC NULLS LAST,
           created_at DESC NULLS LAST,
           id
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_cancellation_profile_missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_cancellation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'gig_cancellation_forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:' || v_gig.band_id::text, 0));
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;

  IF v_gig.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'gig_id', v_gig.id,
      'band_id', v_gig.band_id,
      'already_cancelled', true,
      'cancelled_at', v_gig.cancelled_at,
      'policy_version', v_gig.cancellation_policy_version,
      'tier', v_gig.cancellation_tier,
      'notice_hours', v_gig.cancellation_notice_hours,
      'booking_fee', GREATEST(COALESCE(v_gig.booking_fee, 0), 0),
      'refund_percentage', COALESCE(v_gig.cancellation_refund_percentage, 0),
      'refund_amount', COALESCE(v_gig.cancellation_refund_amount, 0),
      'fame_penalty', COALESCE(v_gig.cancellation_fame_penalty, 0),
      'fan_sentiment_penalty', COALESCE(v_gig.cancellation_fan_sentiment_penalty, 0),
      'reputation_penalty', COALESCE(v_gig.cancellation_reputation_penalty, 0),
      'financial_transaction_id', v_gig.cancellation_financial_transaction_id
    );
  END IF;

  IF v_gig.status NOT IN ('scheduled', 'confirmed') OR v_gig.scheduled_date <= v_cancelled_at THEN
    RAISE EXCEPTION 'gig_cancellation_not_cancellable' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = v_gig.band_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_cancellation_band_missing' USING ERRCODE = 'P0001';
  END IF;

  v_quote := public._gig_cancellation_quote(v_gig.id, v_cancelled_at);
  v_refund_amount := (v_quote->>'refund_amount')::integer;
  v_refund_percentage := (v_quote->>'refund_percentage')::integer;
  v_fame_penalty := (v_quote->>'fame_penalty')::integer;
  v_sentiment_penalty := (v_quote->>'fan_sentiment_penalty')::numeric;
  v_reputation_penalty := (v_quote->>'reputation_penalty')::numeric;
  v_reason := left(COALESCE(NULLIF(btrim(p_reason), ''), 'Cancelled by band'), 280);

  -- Canonical finance bookings can be identified by the idempotency key written
  -- by book_gig. Reverse that exact fee flow. Older live bookings pre-date the
  -- journal and therefore receive their refund through the legacy balance mirror.
  IF v_refund_amount > 0 AND v_gig.booking_request_id IS NOT NULL THEN
    SELECT * INTO v_original_transaction
    FROM public.financial_transactions
    WHERE idempotency_key = 'gig-booking-fee:' || v_gig.booking_request_id::text
      AND status = 'completed'
    LIMIT 1;
  END IF;

  IF v_refund_amount > 0 AND v_original_transaction.id IS NOT NULL THEN
    IF to_regprocedure(
      'public.post_financial_journal(public.financial_transaction_category,uuid,character,text,jsonb,text,uuid,jsonb)'
    ) IS NULL THEN
      RAISE EXCEPTION 'gig_cancellation_finance_unavailable' USING ERRCODE = 'P0001';
    END IF;
    IF v_original_transaction.source_account_id IS NULL OR v_original_transaction.destination_account_id IS NULL THEN
      RAISE EXCEPTION 'gig_cancellation_finance_invalid' USING ERRCODE = 'P0001';
    END IF;

    EXECUTE $journal$
      SELECT public.post_financial_journal(
        $1::public.financial_transaction_category,
        $2::uuid,
        $3::char(3),
        $4::text,
        $5::jsonb,
        $6::text,
        $7::uuid,
        $8::jsonb
      )
    $journal$
    INTO v_refund_transaction_id
    USING
      'refund',
      gen_random_uuid(),
      v_original_transaction.currency_code,
      'gig-cancellation-refund:' || v_gig.id::text,
      jsonb_build_array(
        jsonb_build_object(
          'account_id', v_original_transaction.destination_account_id,
          'direction', 'debit',
          'amount_minor', v_refund_amount::bigint * 100
        ),
        jsonb_build_object(
          'account_id', v_original_transaction.source_account_id,
          'direction', 'credit',
          'amount_minor', v_refund_amount::bigint * 100
        )
      ),
      'gig_cancellation',
      v_gig.id,
      jsonb_build_object(
        'trusted_finance_workflow', true,
        'source', 'cancel_gig',
        'band_id', v_gig.band_id,
        'gig_id', v_gig.id,
        'original_booking_transaction_id', v_original_transaction.id,
        'refund_percentage', v_refund_percentage,
        'policy_version', 'gig-cancellation-v1'
      );

    SELECT current_balance_minor INTO v_band_balance_minor
    FROM public.financial_accounts
    WHERE id = v_original_transaction.source_account_id;
    v_used_canonical_ledger := true;
  END IF;

  UPDATE public.bands
  SET
    band_balance = CASE
      WHEN v_used_canonical_ledger THEN floor(COALESCE(v_band_balance_minor, 0)::numeric / 100)::integer
      ELSE COALESCE(band_balance, 0) + v_refund_amount
    END,
    fame = GREATEST(0, COALESCE(fame, 0) - v_fame_penalty),
    global_fame = GREATEST(0, COALESCE(global_fame, fame, 0) - v_fame_penalty),
    fan_sentiment_score = GREATEST(-100, COALESCE(fan_sentiment_score, 0) - v_sentiment_penalty),
    reputation_score = GREATEST(-100, COALESCE(reputation_score, 0) - v_reputation_penalty),
    updated_at = now()
  WHERE id = v_gig.band_id
  RETURNING * INTO v_band;

  IF v_fame_penalty > 0 THEN
    INSERT INTO public.band_fame_events (band_id, event_type, fame_gained, event_data)
    VALUES (
      v_gig.band_id,
      'gig_cancellation',
      -v_fame_penalty,
      jsonb_build_object(
        'gig_id', v_gig.id,
        'tier', v_quote->>'tier',
        'notice_hours', v_quote->'notice_hours',
        'policy_version', 'gig-cancellation-v1'
      )
    );
  END IF;

  IF v_sentiment_penalty > 0 THEN
    INSERT INTO public.band_sentiment_events (
      band_id,
      event_type,
      sentiment_change,
      sentiment_after,
      source,
      description,
      metadata
    ) VALUES (
      v_gig.band_id,
      'gig_cancellation',
      -v_sentiment_penalty,
      v_band.fan_sentiment_score,
      'cancel-gig',
      'Fans reacted to a cancelled show',
      jsonb_build_object(
        'gig_id', v_gig.id,
        'tier', v_quote->>'tier',
        'notice_hours', v_quote->'notice_hours',
        'policy_version', 'gig-cancellation-v1'
      )
    );
  END IF;

  UPDATE public.gigs
  SET
    status = 'cancelled',
    cancelled_at = v_cancelled_at,
    cancelled_by_profile_id = v_actor.id,
    cancellation_reason = v_reason,
    cancellation_policy_version = 'gig-cancellation-v1',
    cancellation_tier = v_quote->>'tier',
    cancellation_notice_hours = (v_quote->>'notice_hours')::numeric,
    cancellation_refund_percentage = v_refund_percentage,
    cancellation_refund_amount = v_refund_amount,
    cancellation_fame_penalty = v_fame_penalty,
    cancellation_fan_sentiment_penalty = v_sentiment_penalty,
    cancellation_reputation_penalty = v_reputation_penalty,
    cancellation_financial_transaction_id = v_refund_transaction_id,
    updated_at = v_cancelled_at
  WHERE id = v_gig.id
  RETURNING * INTO v_gig;

  UPDATE public.player_scheduled_activities
  SET
    status = 'cancelled',
    updated_at = v_cancelled_at,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'cancelled_by_gig', v_gig.id,
      'cancelled_at', v_cancelled_at,
      'cancellation_tier', v_quote->>'tier'
    )
  WHERE linked_gig_id = v_gig.id
    AND status IN ('scheduled', 'in_progress');

  IF to_regclass('public.gig_support_slots') IS NOT NULL THEN
    EXECUTE $support$
      UPDATE public.gig_support_slots
      SET status = 'cancelled', updated_at = $2
      WHERE gig_id = $1
        AND status IN ('pending', 'accepted', 'confirmed')
    $support$
    USING v_gig.id, v_cancelled_at;
  END IF;

  IF v_gig.tour_id IS NOT NULL THEN
    UPDATE public.tour_venues
    SET status = 'cancelled'
    WHERE tour_id = v_gig.tour_id
      AND venue_id = v_gig.venue_id
      AND date = v_gig.scheduled_date
      AND status NOT IN ('cancelled', 'completed');
  END IF;

  RETURN v_quote || jsonb_build_object(
    'already_cancelled', false,
    'cancelled_at', v_cancelled_at,
    'cancellation_reason', v_reason,
    'financial_transaction_id', v_refund_transaction_id,
    'used_canonical_ledger', v_used_canonical_ledger,
    'band_balance', v_band.band_balance,
    'band_fame', v_band.fame,
    'band_global_fame', v_band.global_fame,
    'band_fan_sentiment', v_band.fan_sentiment_score,
    'band_reputation', v_band.reputation_score
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_gig(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gig(uuid, text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.check_gig_booking_day_rule(uuid, uuid, date, text) IS
  'Previews the server-enforced same-day gig rule. Double shows require the same venue and a four-hour gap.';
COMMENT ON FUNCTION public.cancel_gig(uuid, text) IS
  'Atomically cancels an unstarted show, snapshots the notice-based policy, refunds the eligible booking fee exactly once, applies career penalties, and releases linked schedules.';

NOTIFY pgrst, 'reload schema';
