-- 1. Band earnings now change the band balance by each row's amount instead of
--    replacing it with the sum of all earnings (which undid studio/rehearsal payments).
CREATE OR REPLACE FUNCTION public.update_band_balance_from_earnings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_change record;
  v_balance bigint;
  v_next bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.band_id = OLD.band_id AND NEW.amount = OLD.amount THEN
    RETURN NEW;
  END IF;

  FOR v_change IN
    SELECT c.band_id, SUM(c.delta)::bigint AS delta
    FROM (VALUES
      (CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.band_id END,
       CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN -OLD.amount::bigint END),
      (CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN NEW.band_id END,
       CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN NEW.amount::bigint END)
    ) AS c(band_id, delta)
    WHERE c.band_id IS NOT NULL
    GROUP BY c.band_id
    HAVING SUM(c.delta) <> 0
    ORDER BY c.band_id
  LOOP
    SELECT COALESCE(b.band_balance,0)::bigint INTO v_balance
    FROM public.bands b WHERE b.id = v_change.band_id FOR UPDATE;
    IF NOT FOUND THEN
      IF TG_OP = 'DELETE' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Band earnings target band is missing';
    END IF;
    v_next := v_balance + v_change.delta;
    IF v_next < 0 OR v_next > 2147483647 THEN
      RAISE EXCEPTION 'Band earnings change exceeds available band funds or balance limits';
    END IF;
    -- bands -> band_treasuries sync trigger applies exactly this delta.
    UPDATE public.bands SET band_balance = v_next::integer WHERE id = v_change.band_id;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;
REVOKE ALL ON FUNCTION public.update_band_balance_from_earnings() FROM PUBLIC, anon, authenticated;

-- 2. One payroll record per band per week (prevents double pay).
CREATE TABLE IF NOT EXISTS public.band_weekly_payroll_settlements (
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  member_count integer NOT NULL,
  amount_each integer NOT NULL,
  amount_total integer NOT NULL,
  PRIMARY KEY (band_id, week_start)
);
GRANT SELECT ON public.band_weekly_payroll_settlements TO authenticated;
GRANT ALL ON public.band_weekly_payroll_settlements TO service_role;
ALTER TABLE public.band_weekly_payroll_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Band members can view their band payroll"
ON public.band_weekly_payroll_settlements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.band_members bm
  WHERE bm.band_id = band_weekly_payroll_settlements.band_id AND bm.user_id = auth.uid()));

-- 3. Weekly payroll paid from the band balance players see.
CREATE OR REPLACE FUNCTION public.process_weekly_band_payroll()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $pay$
DECLARE
  v_week date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_band public.bands%ROWTYPE;
  v_band_id uuid;
  v_available bigint;
  v_count integer;
  v_each bigint;
  v_total bigint;
  v_member record;
  v_paid integer := 0;
  v_sum bigint := 0;
  v_failures jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Payroll cannot be called by a signed-in user' USING ERRCODE = '42501';
  END IF;

  FOR v_band_id IN
    SELECT b.id FROM public.bands b
    WHERE b.status = 'active'::public.band_status AND COALESCE(b.weekly_pay_percent,0) > 0
    ORDER BY b.id
  LOOP
    BEGIN
      SELECT * INTO v_band FROM public.bands WHERE id = v_band_id FOR UPDATE;
      IF v_band.status <> 'active'::public.band_status OR COALESCE(v_band.weekly_pay_percent,0) <= 0 THEN CONTINUE; END IF;
      IF EXISTS (SELECT 1 FROM public.band_weekly_payroll_settlements s
                 WHERE s.band_id = v_band_id AND s.week_start = v_week) THEN CONTINUE; END IF;

      -- Spendable = treasury minus money reserved for bookings, never more than the shown balance.
      SELECT LEAST(COALESCE(v_band.band_balance,0)::bigint,
                   (t.balance_minor - COALESCE(t.reserved_balance_minor,0)) / 100)
        INTO v_available
      FROM public.band_treasuries t
      WHERE t.band_id = v_band_id AND t.is_primary IS TRUE FOR UPDATE;
      IF v_available IS NULL OR v_available <= 0 THEN CONTINUE; END IF;

      SELECT count(DISTINCT bm.profile_id) INTO v_count
      FROM public.band_members bm
      JOIN public.profiles p ON p.id = bm.profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL
      WHERE bm.band_id = v_band_id
        AND COALESCE(bm.member_status,'active') = 'active'
        AND NOT COALESCE(bm.is_touring_member,false);
      IF v_count = 0 THEN CONTINUE; END IF;

      v_each := floor(floor(v_available * v_band.weekly_pay_percent / 100) / v_count)::bigint;
      IF v_each <= 0 THEN CONTINUE; END IF;
      v_total := v_each * v_count;

      INSERT INTO public.band_weekly_payroll_settlements(band_id, week_start, member_count, amount_each, amount_total)
      VALUES (v_band_id, v_week, v_count, v_each, v_total);

      -- Band expense row; the earnings trigger deducts it from the band balance.
      INSERT INTO public.band_earnings(band_id, amount, source, description, earned_by_user_id, metadata)
      VALUES (v_band_id, -v_total::integer, 'weekly_pay',
        format('Weekly pay: %s%% of balance — $%s × %s members', v_band.weekly_pay_percent, v_each, v_count),
        v_band.leader_id, jsonb_build_object('week_start', v_week));

      FOR v_member IN
        SELECT DISTINCT ON (bm.profile_id) bm.profile_id, p.user_id
        FROM public.band_members bm
        JOIN public.profiles p ON p.id = bm.profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL
        WHERE bm.band_id = v_band_id
          AND COALESCE(bm.member_status,'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member,false)
        ORDER BY bm.profile_id
      LOOP
        UPDATE public.profiles SET cash = COALESCE(cash,0) + v_each WHERE id = v_member.profile_id;
        INSERT INTO public.activity_feed(user_id, profile_id, activity_type, message, earnings, metadata)
        VALUES (v_member.user_id, v_member.profile_id, 'band_pay',
          format('Received $%s weekly pay from %s', v_each, v_band.name), v_each,
          jsonb_build_object('band_id', v_band_id, 'week_start', v_week));
      END LOOP;

      v_paid := v_paid + 1;
      v_sum := v_sum + v_total;
    EXCEPTION WHEN OTHERS THEN
      v_failures := v_failures || jsonb_build_object('band_id', v_band_id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('week_start', v_week, 'paid_bands', v_paid, 'total_paid', v_sum, 'failures', v_failures);
END;
$pay$;
REVOKE ALL ON FUNCTION public.process_weekly_band_payroll() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_weekly_band_payroll() TO service_role;