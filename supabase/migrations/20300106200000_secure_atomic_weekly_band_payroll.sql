-- RockMundo weekly payroll: replace the publicly callable legacy edge payout
-- with an internal pg_cron transaction against the canonical finance ledger.
-- Issues #4022 #4023 #4024 #4025 #4026 #4027.
--
-- Deploy the function/migration together. The retired edge endpoint returns
-- 410 and performs no service-role writes.
BEGIN;

-- A 410-retired HTTP endpoint does not justify automatically switching to a
-- payroll function that cannot fund all active bands. Fail closed BEFORE
-- replacing the cron job, adding settlement structures or paying anyone.
-- Never seed a treasury by minting a legacy band_balance projection.
DO $treasury_preflight$
DECLARE
  v_missing integer;
  v_drifted integer;
  v_incompatible_treasuries integer;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM public.bands b
  WHERE b.status = 'active'::public.band_status
    AND COALESCE(b.weekly_pay_percent, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.financial_accounts a
      WHERE a.owner_type = 'band'::public.financial_owner_type
        AND a.owner_id = b.id
        AND a.metadata->>'account_role' = 'band_treasury'
        AND a.account_status = 'active'
    );

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'Payroll cutover blocked: % active pay-enabled bands have no canonical active treasury', v_missing
      USING ERRCODE = '55000';
  END IF;

  -- The earnings AFTER INSERT trigger recalculates the full projection.
  -- Existing unjournaled direct balance adjustments would otherwise be
  -- silently undone on the first wage expense. Do not activate cron until
  -- each eligible band's discrepancy has been explained and repaired.
  SELECT COUNT(*) INTO v_drifted
  FROM public.bands b
  LEFT JOIN (
    SELECT band_id, SUM(amount)::bigint AS earned_balance
    FROM public.band_earnings GROUP BY band_id
  ) e ON e.band_id = b.id
  WHERE b.status = 'active'::public.band_status
    AND COALESCE(b.weekly_pay_percent, 0) > 0
    AND COALESCE(b.band_balance,0)::bigint
      IS DISTINCT FROM COALESCE(e.earned_balance,0);

  IF v_drifted > 0 THEN
    RAISE EXCEPTION
      'Payroll cutover blocked: % pay-enabled band balances differ from earnings journal', v_drifted
      USING ERRCODE = '55000';
  END IF;

  -- There are TWO distinct live treasury systems. A journal-balanced
  -- financial_accounts record is not proof that it contains the actual
  -- spendable band funds shown to players via band_treasuries.
  -- Never switch payout authority while they disagree.
  SELECT COUNT(*) INTO v_incompatible_treasuries
  FROM public.bands b
  WHERE b.status = 'active'::public.band_status
    AND COALESCE(b.weekly_pay_percent, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.band_treasuries bt
      JOIN public.financial_accounts a
        ON a.owner_type = 'band'::public.financial_owner_type
       AND a.owner_id = b.id
       AND a.metadata->>'account_role' = 'band_treasury'
       AND a.account_status = 'active'
      WHERE bt.band_id = b.id
        AND bt.is_primary IS TRUE
        AND bt.currency_code = a.default_currency_code
        AND bt.balance_minor = a.current_balance_minor
        AND bt.balance_minor = COALESCE(b.band_balance,0)::bigint * 100
    );
  IF v_incompatible_treasuries > 0 THEN
    RAISE EXCEPTION
      'Payroll cutover blocked: % pay-enabled bands have incompatible treasury ledgers', v_incompatible_treasuries
      USING ERRCODE = '55000';
  END IF;
END;
$treasury_preflight$;

CREATE TABLE IF NOT EXISTS public.band_weekly_payroll_settlements (
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  member_count integer NOT NULL CHECK (member_count > 0),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code char(3) NOT NULL,
  PRIMARY KEY (band_id, week_start)
);
ALTER TABLE public.band_weekly_payroll_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_weekly_payroll_settlements FROM PUBLIC, anon, authenticated;
-- No client-facing INSERT/UPDATE/DELETE or RPC grants are needed.

CREATE OR REPLACE FUNCTION public.process_weekly_band_payroll()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $payroll$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_week date := date_trunc('week',now() AT TIME ZONE 'UTC')::date;
  v_band_id uuid;
  v_band public.bands%ROWTYPE;
  v_treasury public.financial_accounts%ROWTYPE;
  v_member record;
  v_wallet public.financial_accounts%ROWTYPE;
  v_payable integer;
  v_wallet_count integer;
  v_each bigint;
  v_total bigint;
  v_source_before bigint;
  v_dest_before bigint;
  v_transaction uuid;
  v_claimed uuid;
  v_leader_user_id uuid;
  v_paid_bands integer := 0;
  v_failed_bands integer := 0;
  v_total_minor bigint := 0;
  v_failures jsonb := '[]'::jsonb;
BEGIN
  -- Cron runs as postgres; this function must never run on a client session.
  -- An unexpected invocation outside the Saturday payroll schedule is inert.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Payroll cannot be called by a signed-in user' USING ERRCODE='42501';
  END IF;
  IF extract(isodow FROM v_today) <> 6 THEN
    RETURN jsonb_build_object('status','outside_schedule','paid_bands',0);
  END IF;

  FOR v_band_id IN
    SELECT b.id FROM public.bands b
    WHERE b.status='active'::public.band_status
      AND b.weekly_pay_percent>0
    ORDER BY b.id
  LOOP
    BEGIN
      -- Lock first so concurrent runs and band status changes cannot race.
      SELECT * INTO v_band FROM public.bands b
      WHERE b.id=v_band_id FOR UPDATE;
      IF NOT FOUND OR v_band.status<>'active'::public.band_status
         OR COALESCE(v_band.weekly_pay_percent,0)<=0 THEN CONTINUE; END IF;
      IF EXISTS (SELECT 1 FROM public.band_weekly_payroll_settlements x
         WHERE x.band_id=v_band_id AND x.week_start=v_week) THEN CONTINUE; END IF;

      -- Recheck under the band row lock: direct band_balance writes can
      -- create drift after the installation preflight. Refuse to trigger
      -- a full earnings reprojection for an unreconciled band.
      IF COALESCE(v_band.band_balance,0)::bigint IS DISTINCT FROM
        COALESCE((SELECT SUM(amount)::bigint FROM public.band_earnings
          WHERE band_id=v_band_id),0) THEN
        RAISE EXCEPTION 'Band earnings projection drift; payroll withheld';
      END IF;

      -- Spend only actual canonical treasury funds. Legacy band_balance is a
      -- projection, not an alternate balance available for payroll.
      SELECT * INTO v_treasury FROM public.financial_accounts a
      WHERE a.owner_type='band'::public.financial_owner_type
        AND a.owner_id=v_band_id
        AND a.metadata->>'account_role'='band_treasury'
        AND a.account_status='active'
      ORDER BY a.is_primary DESC,a.created_at,a.id LIMIT 1;
      IF v_treasury.id IS NULL THEN
        RAISE EXCEPTION 'Band treasury is missing or inactive';
      END IF;

      -- Guard against gameplay treasury spending that does not flow into
      -- financial_accounts. An equivalent balance was required at cutover,
      -- and it must STILL agree for every subsequent weekly payout.
      IF NOT EXISTS (
        SELECT 1 FROM public.band_treasuries bt
        WHERE bt.band_id = v_band_id
          AND bt.is_primary IS TRUE
          AND bt.currency_code = v_treasury.default_currency_code
          AND bt.balance_minor = v_treasury.current_balance_minor
          AND bt.balance_minor = COALESCE(v_band.band_balance,0)::bigint * 100
      ) THEN
        RAISE EXCEPTION 'Band treasury ledgers diverged; payroll withheld';
      END IF;

      SELECT count(DISTINCT bm.profile_id) INTO v_payable
      FROM public.band_members bm
      JOIN public.profiles p ON p.id=bm.profile_id
        AND p.user_id=bm.user_id
        AND p.died_at IS NULL AND p.deleted_at IS NULL
      WHERE bm.band_id=v_band_id
        AND COALESCE(bm.member_status,'active')='active'
        AND NOT COALESCE(bm.is_touring_member,false);
      IF v_payable=0 THEN CONTINUE; END IF;

      SELECT count(DISTINCT bm.profile_id) INTO v_wallet_count
      FROM public.band_members bm
      JOIN public.profiles p ON p.id=bm.profile_id
        AND p.user_id=bm.user_id
        AND p.died_at IS NULL AND p.deleted_at IS NULL
      JOIN public.financial_accounts wallet
        ON wallet.owner_type='player'::public.financial_owner_type
        AND wallet.owner_id=p.id
        AND wallet.is_primary
        AND wallet.account_status='active'
        AND wallet.default_currency_code=v_treasury.default_currency_code
      WHERE bm.band_id=v_band_id
        AND COALESCE(bm.member_status,'active')='active'
        AND NOT COALESCE(bm.is_touring_member,false);
      IF v_wallet_count <> v_payable THEN
        RAISE EXCEPTION 'A payable member has no active compatible wallet';
      END IF;

      -- Lock all financial accounts in identical UUID order; other ledger
      -- transfers do the same, preventing lost updates and payroll deadlocks.
      PERFORM 1 FROM public.financial_accounts a
      WHERE a.id=v_treasury.id OR a.id IN (
        SELECT wallet.id
        FROM public.band_members bm
        JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
        JOIN public.financial_accounts wallet
          ON wallet.owner_type='player'::public.financial_owner_type
          AND wallet.owner_id=p.id AND wallet.is_primary
        WHERE bm.band_id=v_band_id
          AND COALESCE(bm.member_status,'active')='active'
          AND NOT COALESCE(bm.is_touring_member,false)
          AND p.died_at IS NULL AND p.deleted_at IS NULL
      )
      ORDER BY a.id FOR UPDATE;

      -- Refresh the canonical spendable amount after locks.
      SELECT * INTO v_treasury FROM public.financial_accounts
      WHERE id=v_treasury.id;
      IF v_treasury.account_status<>'active' THEN
        RAISE EXCEPTION 'Band treasury was deactivated';
      END IF;
      -- Legacy band_earnings and activity_feed amounts are whole-major-unit
      -- integers. Round each member's share DOWN to whole currency units;
      -- leave any remainder in the band treasury, not an unreported debit.
      v_each:=(floor(
        floor(v_treasury.available_balance_minor::numeric *
              v_band.weekly_pay_percent / 100) / v_payable / 100
      ) * 100)::bigint;
      IF v_each<=0 THEN CONTINUE; END IF;
      v_total:=v_each*v_payable;
      IF v_total>v_treasury.available_balance_minor THEN
        RAISE EXCEPTION 'Insufficient treasury balance for payroll';
      END IF;

      -- Unique per-band/week claim, acquired within this transaction.
      INSERT INTO public.band_weekly_payroll_settlements(
        band_id,week_start,member_count,amount_minor,currency_code
      ) VALUES(v_band_id,v_week,v_payable,v_total,v_treasury.default_currency_code)
      ON CONFLICT (band_id,week_start) DO NOTHING
      RETURNING band_id INTO v_claimed;
      IF v_claimed IS NULL THEN CONTINUE; END IF;

      -- Every member credit, both immutable ledger entries, the band expense,
      -- projections and notifications are part of one per-band savepoint.
      -- Any failure rolls them ALL back (see EXCEPTION below).
      FOR v_member IN
        SELECT DISTINCT ON (wallet.id)
          p.id AS profile_id,p.user_id,wallet.id AS wallet_id
        FROM public.band_members bm
        JOIN public.profiles p ON p.id=bm.profile_id AND p.user_id=bm.user_id
        JOIN public.financial_accounts wallet
          ON wallet.owner_type='player'::public.financial_owner_type
          AND wallet.owner_id=p.id AND wallet.is_primary
          AND wallet.account_status='active'
          AND wallet.default_currency_code=v_treasury.default_currency_code
        WHERE bm.band_id=v_band_id
          AND COALESCE(bm.member_status,'active')='active'
          AND NOT COALESCE(bm.is_touring_member,false)
          AND p.died_at IS NULL AND p.deleted_at IS NULL
        ORDER BY wallet.id,p.id
      LOOP
        SELECT * INTO v_wallet FROM public.financial_accounts
          WHERE id=v_member.wallet_id;
        IF v_wallet.id IS NULL OR v_wallet.account_status<>'active' THEN
          RAISE EXCEPTION 'Member wallet disappeared during payroll';
        END IF;
        SELECT current_balance_minor INTO v_source_before
          FROM public.financial_accounts WHERE id=v_treasury.id;
        v_dest_before:=v_wallet.current_balance_minor;
        INSERT INTO public.financial_transactions (
          transaction_category,status,currency_code,
          gross_amount_minor,net_amount_minor,
          source_account_id,destination_account_id,
          related_entity_type,related_entity_id,description,idempotency_key,
          created_by_profile_id,created_by_actor,completed_at,metadata
        ) VALUES(
          'wage_payment'::public.financial_transaction_category,
          'completed',v_treasury.default_currency_code,
          v_each,v_each,v_treasury.id,v_wallet.id,
          'band',v_band_id,'Weekly band payroll',
          'weekly-band-pay:'||v_band_id::text||':'||v_week::text||':'||v_member.profile_id::text,
          v_member.profile_id,'system',now(),
          jsonb_build_object('payroll_week',v_week,'band_id',v_band_id,
            'member_profile_id',v_member.profile_id)
        ) RETURNING id INTO v_transaction;

        UPDATE public.financial_accounts
          SET current_balance_minor=current_balance_minor-v_each,
              updated_at=now()
          WHERE id=v_treasury.id AND available_balance_minor>=v_each;
        IF NOT FOUND THEN RAISE EXCEPTION 'Treasury balance changed during payroll'; END IF;
        UPDATE public.financial_accounts
          SET current_balance_minor=current_balance_minor+v_each,
              updated_at=now()
          WHERE id=v_wallet.id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Member wallet credit failed'; END IF;

        INSERT INTO public.financial_ledger_entries(
          transaction_id,account_id,entry_direction,amount_minor,
          balance_before_minor,balance_after_minor
        ) VALUES
          (v_transaction,v_treasury.id,'debit',v_each,
            v_source_before,v_source_before-v_each),
          (v_transaction,v_wallet.id,'credit',v_each,
            v_dest_before,v_dest_before+v_each);

        -- The primary-player-wallet trigger keeps profiles.cash as a
        -- projection of the canonical account balance; never overwrite it.
        INSERT INTO public.activity_feed(
          user_id,profile_id,activity_type,message,earnings
        ) VALUES (
          v_member.user_id,v_member.profile_id,'band_pay',
          'Received weekly band pay from '||v_band.name,
          (v_each/100)::integer
        );
      END LOOP;

      SELECT p.user_id INTO v_leader_user_id
      FROM public.profiles p WHERE p.id=v_band.leader_id;
      INSERT INTO public.band_earnings(
        band_id,amount,source,description,earned_by_user_id
      ) VALUES(
        v_band_id,-(v_total/100)::integer,'weekly_pay',
        'Weekly band payroll for '||v_week::text||' ('||v_payable::text||' paid members)',
        v_leader_user_id
      );

      -- The band_earnings AFTER INSERT trigger recomputes the legacy
      -- bands.band_balance projection from the entire earnings history.
      -- Never overwrite that projection with the canonical finance account
      -- balance: those are different ledgers and can legitimately diverge.
      -- The actual transfer already debited the financial_accounts treasury.

      v_paid_bands:=v_paid_bands+1;
      v_total_minor:=v_total_minor+v_total;
    EXCEPTION WHEN OTHERS THEN
      -- A PL/pgSQL exception block is a subtransaction. None of the band's
      -- deductions, member credits, ledger rows, or claimed week can persist.
      v_failed_bands:=v_failed_bands+1;
      v_failures:=v_failures||jsonb_build_array(jsonb_build_object(
        'band_id',v_band_id,'error',SQLERRM));
      RAISE WARNING 'Weekly band payroll rolled back for band %: %',v_band_id,SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'status',CASE WHEN v_failed_bands>0 THEN 'partial_failure' ELSE 'completed' END,
    'week_start',v_week,
    'paid_bands',v_paid_bands,'failed_bands',v_failed_bands,
    'total_paid_minor',v_total_minor,'failures',v_failures
  );
END;
$payroll$;

REVOKE ALL ON FUNCTION public.process_weekly_band_payroll()
  FROM PUBLIC, anon, authenticated, service_role;

-- Replace the historical HTTP schedule (anon JWT + service-role edge
-- handler) with an internal database job that has no network endpoint.
DO $cron$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'pg_cron is required for safe weekly payroll';
  END IF;
  BEGIN
    PERFORM cron.unschedule('process-weekly-band-pay');
  EXCEPTION WHEN OTHERS THEN
    -- The previous job may not exist yet in a new environment.
    NULL;
  END;
  PERFORM cron.schedule(
    'process-weekly-band-pay','0 10 * * 6',
    'SELECT public.process_weekly_band_payroll()'
  );
END;
$cron$;

COMMIT;
