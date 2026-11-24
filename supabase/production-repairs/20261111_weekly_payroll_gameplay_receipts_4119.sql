-- #4119: add reconciled receipts to the deployed gameplay payroll.
-- Manual rollout after staging validation. This transaction does not run payroll.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = to_regprocedure('public.process_weekly_band_payroll()')
      AND md5(prosrc) = 'd068395537f0775c09512d2fa2275b57'
  ) THEN
    RAISE EXCEPTION 'Expected original gameplay payroll function; review installed version before deployment';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.process_weekly_band_payroll()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $pay$
DECLARE
  v_week date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_band public.bands%ROWTYPE;
  v_band_id uuid;
  v_treasury public.band_treasuries%ROWTYPE;
  v_available bigint;
  v_count integer;
  v_each bigint;
  v_total bigint;
  v_recipient_ids uuid[];
  v_profile_id uuid;
  v_user_id uuid;
  v_key text;
  v_band_week_key text;
  v_cash_context text := current_setting('app.player_cash_context', true);
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

      SELECT * INTO STRICT v_treasury
      FROM public.band_treasuries t
      WHERE t.band_id = v_band_id AND t.is_primary IS TRUE FOR UPDATE;
      IF v_band.band_balance IS DISTINCT FROM v_treasury.balance_minor / 100
         OR v_treasury.balance_minor < 0
         OR v_treasury.reserved_balance_minor NOT BETWEEN 0 AND v_treasury.balance_minor
         OR v_band.weekly_pay_percent > 100 THEN
        RAISE EXCEPTION 'Invalid gameplay payroll balance, reserve, or pay percentage';
      END IF;
      v_available := (v_treasury.balance_minor - v_treasury.reserved_balance_minor) / 100;
      IF v_available <= 0 THEN CONTINUE; END IF;

      -- Take one recipient snapshot for both the split and the cash writes.
      SELECT ARRAY(
        SELECT p.id FROM public.profiles p
        WHERE p.died_at IS NULL AND p.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM public.band_members bm
            WHERE bm.profile_id = p.id AND bm.band_id = v_band_id
              AND COALESCE(bm.member_status, 'active') = 'active'
              AND NOT COALESCE(bm.is_touring_member, false)
          )
        ORDER BY p.id FOR UPDATE OF p
      ) INTO v_recipient_ids;
      v_count := cardinality(v_recipient_ids);
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

      -- Verify the earnings trigger debited the same treasury and preserved reserves.
      IF NOT EXISTS (
        SELECT 1 FROM public.band_treasuries t JOIN public.bands b ON b.id = t.band_id
        WHERE t.id = v_treasury.id
          AND t.balance_minor = v_treasury.balance_minor - v_total * 100
          AND t.reserved_balance_minor = v_treasury.reserved_balance_minor
          AND b.band_balance = v_band.band_balance - v_total
      ) THEN
        RAISE EXCEPTION 'Gameplay treasury payroll debit did not match settlement';
      END IF;

      v_band_week_key := 'weekly-band-payroll:' || v_band_id || ':' || to_char(v_week, 'YYYY-MM-DD');
      INSERT INTO public.band_treasury_transactions(
        band_id, treasury_id, direction, amount_minor, currency_code, source_kind,
        category, note, idempotency_key, balance_after_minor
      ) VALUES (
        v_band_id, v_treasury.id, 'debit', v_total * 100, v_treasury.currency_code,
        'weekly_pay', 'weekly_pay', 'Weekly band payroll', v_band_week_key,
        v_treasury.balance_minor - v_total * 100
      );

      FOREACH v_profile_id IN ARRAY v_recipient_ids LOOP
        -- The existing profile-cash trigger writes the wallet journal entry.
        v_key := 'player-cash:' || v_profile_id || ':' || v_band_week_key;
        IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE idempotency_key = v_key) THEN
          RAISE EXCEPTION 'Payroll wallet receipt already exists';
        END IF;
        PERFORM set_config('app.player_cash_context', jsonb_build_object(
          'classification', 'band_pay', 'display_category', 'band_pay',
          'description', 'Weekly band payroll', 'external_cash_flow', false,
          'idempotency_key', v_band_week_key, 'band_id', v_band_id,
          'week_start', v_week
        )::text, true);
        UPDATE public.profiles SET cash = COALESCE(cash,0) + v_each
        WHERE id = v_profile_id RETURNING user_id INTO STRICT v_user_id;
        PERFORM set_config('app.player_cash_context', COALESCE(v_cash_context, ''), true);

        IF NOT EXISTS (
          SELECT 1 FROM public.financial_transactions ft
          JOIN public.financial_accounts wallet ON wallet.id = ft.destination_account_id
          WHERE ft.idempotency_key = v_key AND ft.status = 'completed'
            AND ft.net_amount_minor = v_each * 100 AND ft.currency_code = v_treasury.currency_code
            AND wallet.owner_type = 'player' AND wallet.owner_id = v_profile_id
        ) THEN
          RAISE EXCEPTION 'Payroll wallet credit did not match settlement';
        END IF;

        INSERT INTO public.activity_feed(user_id, profile_id, activity_type, message, earnings, metadata)
        VALUES (v_user_id, v_profile_id, 'band_pay',
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

COMMIT;
