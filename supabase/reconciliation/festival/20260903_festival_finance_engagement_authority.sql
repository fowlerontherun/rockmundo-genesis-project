-- Production parity extension for the 2026-09-03 Festival settlement repair.
-- Apply only after the inherited Festival bootstrap and the earlier Festival
-- production-reconciliation extensions.

ALTER TABLE public.festival_simplified_edition_results
  ADD COLUMN IF NOT EXISTS finance_ledger_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_finalised_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_reputation_bonus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS real_attendance_signal jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.festival_simplified_edition_results'::regclass
      AND conname='festival_simplified_results_engagement_bonus_check'
  ) THEN
    ALTER TABLE public.festival_simplified_edition_results
      ADD CONSTRAINT festival_simplified_results_engagement_bonus_check
      CHECK (engagement_reputation_bonus BETWEEN 0 AND 5);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.festival_simplified_edition_results'::regclass
      AND conname='festival_simplified_results_real_signal_check'
  ) THEN
    ALTER TABLE public.festival_simplified_edition_results
      ADD CONSTRAINT festival_simplified_results_real_signal_check
      CHECK (jsonb_typeof(real_attendance_signal)='object');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.festival_simplified_finance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_result_id uuid NOT NULL REFERENCES public.festival_simplified_edition_results(id) ON DELETE RESTRICT,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE RESTRICT,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  line_key text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('income','expense','memo')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  affects_net boolean NOT NULL DEFAULT true,
  currency_code text NOT NULL,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_snapshot)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(festival_result_id,line_key),
  CHECK (line_key IN ('ticket_revenue','sponsorship_revenue','food_and_drink_revenue','merchandise_revenue','operating_cost','tax')),
  CHECK ((direction='memo' AND affects_net=false) OR direction <> 'memo')
);
ALTER TABLE public.festival_simplified_finance_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_simplified_finance_ledger FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.festival_simplified_finance_ledger TO service_role;
CREATE INDEX IF NOT EXISTS festival_simplified_finance_ledger_edition_idx
  ON public.festival_simplified_finance_ledger(festival_edition_id,created_at);

CREATE TABLE IF NOT EXISTS public.festival_owner_engagement_applications (
  festival_edition_id uuid PRIMARY KEY REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE RESTRICT,
  festival_result_id uuid NOT NULL UNIQUE REFERENCES public.festival_simplified_edition_results(id) ON DELETE RESTRICT,
  signal_version text NOT NULL,
  verified_checked_in integer NOT NULL CHECK (verified_checked_in >= 0),
  verified_completed integer NOT NULL CHECK (verified_completed >= 0),
  completed_activities integer NOT NULL CHECK (completed_activities >= 0),
  resolved_moments integer NOT NULL CHECK (resolved_moments >= 0),
  engagement_points integer NOT NULL CHECK (engagement_points BETWEEN 0 AND 1000),
  owner_boost_percent numeric(5,2) NOT NULL CHECK (owner_boost_percent BETWEEN 0 AND 5),
  reputation_bonus integer NOT NULL CHECK (reputation_bonus BETWEEN 0 AND 5),
  reputation_before integer NOT NULL,
  reputation_after integer NOT NULL,
  signal_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(signal_snapshot)='object'),
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.festival_owner_engagement_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_owner_engagement_applications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.festival_owner_engagement_applications TO service_role;

CREATE OR REPLACE FUNCTION public._freeze_simplified_festival_finance_ledger(p_result_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_result public.festival_simplified_edition_results%ROWTYPE;
  v_ledger_net bigint;
  v_sponsorship bigint;
BEGIN
  SELECT * INTO v_result
  FROM public.festival_simplified_edition_results
  WHERE id=p_result_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SIMPLIFIED_RESULT_NOT_FOUND' USING ERRCODE='P0001'; END IF;

  v_sponsorship:=greatest(0,coalesce(nullif(v_result.result_snapshot->>'sponsorshipRevenueMinor','')::bigint,0));

  INSERT INTO public.festival_simplified_finance_ledger(
    festival_result_id,festival_company_id,festival_edition_id,line_key,direction,amount_minor,affects_net,currency_code,source_snapshot
  ) VALUES
    (v_result.id,v_result.festival_company_id,v_result.festival_edition_id,'ticket_revenue','income',v_result.ticket_revenue_minor,true,v_result.currency_code,jsonb_build_object('source','final_result')),
    (v_result.id,v_result.festival_company_id,v_result.festival_edition_id,'sponsorship_revenue','income',v_sponsorship,true,v_result.currency_code,jsonb_build_object('source','automatic_sponsorship')),
    (v_result.id,v_result.festival_company_id,v_result.festival_edition_id,'food_and_drink_revenue','income',v_result.food_and_drink_revenue_minor,true,v_result.currency_code,jsonb_build_object('source','runtime_sales')),
    (v_result.id,v_result.festival_company_id,v_result.festival_edition_id,'merchandise_revenue','income',v_result.merchandise_revenue_minor,true,v_result.currency_code,jsonb_build_object('source','runtime_sales')),
    (v_result.id,v_result.festival_company_id,v_result.festival_edition_id,'operating_cost','expense',v_result.operating_cost_minor,true,v_result.currency_code,jsonb_build_object('source','annual_plan_operating_cost')),
    (v_result.id,v_result.festival_company_id,v_result.festival_edition_id,'tax','memo',v_result.tax_minor,false,v_result.currency_code,jsonb_build_object('source','ticket_tax','note','ticket revenue is already net of this tax'))
  ON CONFLICT (festival_result_id,line_key) DO NOTHING;

  SELECT coalesce(sum(CASE WHEN direction='income' AND affects_net THEN amount_minor WHEN direction='expense' AND affects_net THEN -amount_minor ELSE 0 END),0)::bigint
  INTO v_ledger_net
  FROM public.festival_simplified_finance_ledger
  WHERE festival_result_id=v_result.id;

  IF v_ledger_net IS DISTINCT FROM v_result.net_profit_minor THEN
    RAISE EXCEPTION 'FESTIVAL_SIMPLIFIED_FINANCE_LEDGER_MISMATCH expected=% actual=%',v_result.net_profit_minor,v_ledger_net USING ERRCODE='P0001';
  END IF;

  UPDATE public.festival_simplified_edition_results
  SET finance_ledger_frozen_at=coalesce(finance_ledger_frozen_at,now()),
      result_snapshot=result_snapshot || jsonb_build_object(
        'financeLedgerFrozen',true,
        'financeLedgerNetMinor',v_ledger_net,
        'financeLedgerCurrencyCode',currency_code
      )
  WHERE id=v_result.id;
  RETURN v_result.id;
END;
$$;
REVOKE ALL ON FUNCTION public._freeze_simplified_festival_finance_ledger(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._freeze_simplified_festival_finance_ledger(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._try_finalise_festival_owner_engagement(p_edition_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_result public.festival_simplified_edition_results%ROWTYPE;
  v_fc public.festival_companies%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_signal public.festival_real_attendance_signals%ROWTYPE;
  v_existing public.festival_owner_engagement_applications%ROWTYPE;
  v_bonus integer:=0;
  v_before integer:=0;
  v_after integer:=0;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_result
  FROM public.festival_simplified_edition_results
  WHERE festival_edition_id=p_edition_id
  FOR UPDATE;
  IF NOT FOUND OR v_result.settlement_applied_at IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_existing
  FROM public.festival_owner_engagement_applications
  WHERE festival_edition_id=p_edition_id;
  IF FOUND THEN RETURN v_existing.festival_result_id; END IF;

  IF EXISTS(
    SELECT 1 FROM public.festival_player_attendance a
    WHERE a.festival_edition_id=p_edition_id
      AND a.status IN ('ticketed','ready_to_check_in','attending')
  ) THEN
    RETURN NULL;
  END IF;

  v_signal:=public._festival_c8_recalculate_real_attendance_signal(p_edition_id);
  v_bonus:=least(5,greatest(0,floor(v_signal.owner_boost_percent)::integer));

  SELECT * INTO v_fc FROM public.festival_companies WHERE id=v_result.festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_COMPANY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_company FROM public.companies WHERE id=v_fc.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_UNDERLYING_COMPANY_NOT_FOUND' USING ERRCODE='P0001'; END IF;

  v_before:=coalesce(v_company.reputation_score,0);
  v_after:=greatest(0,v_before+v_bonus);
  v_snapshot:=jsonb_build_object(
    'calculationVersion',v_signal.calculation_version,
    'verifiedCheckedIn',v_signal.verified_checked_in,
    'verifiedCompleted',v_signal.verified_completed,
    'completedActivities',v_signal.completed_activities,
    'resolvedMoments',v_signal.resolved_moments,
    'engagementPoints',v_signal.engagement_points,
    'ownerBoostPercent',v_signal.owner_boost_percent,
    'reputationBonus',v_bonus,
    'ticketCountUsed',false
  );

  UPDATE public.companies
  SET reputation_score=v_after,updated_at=now()
  WHERE id=v_company.id;

  INSERT INTO public.festival_owner_engagement_applications(
    festival_edition_id,festival_company_id,festival_result_id,signal_version,
    verified_checked_in,verified_completed,completed_activities,resolved_moments,
    engagement_points,owner_boost_percent,reputation_bonus,reputation_before,reputation_after,signal_snapshot
  ) VALUES(
    p_edition_id,v_result.festival_company_id,v_result.id,v_signal.calculation_version,
    v_signal.verified_checked_in,v_signal.verified_completed,v_signal.completed_activities,v_signal.resolved_moments,
    v_signal.engagement_points,v_signal.owner_boost_percent,v_bonus,v_before,v_after,v_snapshot
  );

  UPDATE public.festival_simplified_edition_results
  SET engagement_finalised_at=now(),
      engagement_reputation_bonus=v_bonus,
      real_attendance_signal=v_snapshot,
      company_reputation_after=v_after,
      result_snapshot=result_snapshot || jsonb_build_object(
        'realAttendanceSignal',v_snapshot,
        'engagementFinalised',true,
        'engagementReputationBonus',v_bonus,
        'companyReputationAfterEngagement',v_after
      )
  WHERE id=v_result.id;

  RETURN v_result.id;
END;
$$;
REVOKE ALL ON FUNCTION public._try_finalise_festival_owner_engagement(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._try_finalise_festival_owner_engagement(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._festival_apply_simplified_company_effects_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  PERFORM public._freeze_simplified_festival_finance_ledger(NEW.id);
  PERFORM public._apply_simplified_festival_company_effects(NEW.id);
  PERFORM public._try_finalise_festival_owner_engagement(NEW.festival_edition_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._festival_apply_simplified_company_effects_trigger() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._festival_finalise_owner_engagement_on_attendance_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public._try_finalise_festival_owner_engagement(NEW.festival_edition_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._festival_finalise_owner_engagement_on_attendance_terminal() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS zz_festival_finalise_owner_engagement ON public.festival_player_attendance;
CREATE TRIGGER zz_festival_finalise_owner_engagement
AFTER UPDATE OF status ON public.festival_player_attendance
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('completed','left_early','cancelled','refunded'))
EXECUTE FUNCTION public._festival_finalise_owner_engagement_on_attendance_terminal();

DO $$
DECLARE v_id uuid; v_edition uuid;
BEGIN
  FOR v_id,v_edition IN
    SELECT id,festival_edition_id FROM public.festival_simplified_edition_results ORDER BY completed_at,id
  LOOP
    PERFORM public._freeze_simplified_festival_finance_ledger(v_id);
    PERFORM public._try_finalise_festival_owner_engagement(v_edition);
  END LOOP;
END $$;

NOTIFY pgrst,'reload schema';
