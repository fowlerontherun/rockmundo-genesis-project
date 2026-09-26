-- One-time, service-role-only replacement of a *prematurely completed*
-- simplified Festival. Never run this as an automatic migration, and never
-- delete the existing company transaction. Archive its full evidence and
-- compensate that posting with an opposite journal entry in one transaction.
CREATE TABLE IF NOT EXISTS public.festival_simplified_rerun_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
  old_runtime_id uuid NOT NULL UNIQUE,
  old_result_id uuid NOT NULL UNIQUE,
  original_company_transaction_id uuid,
  reversal_company_transaction_id uuid,
  original_profit_minor bigint NOT NULL,
  original_reputation_delta integer NOT NULL,
  evidence_archive jsonb NOT NULL CHECK (jsonb_typeof(evidence_archive)='object'),
  reason text NOT NULL,
  approved_by text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  new_runtime_id uuid,
  new_result_id uuid,
  rerun_at timestamptz,
  UNIQUE (festival_edition_id)
);
ALTER TABLE public.festival_simplified_rerun_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_simplified_rerun_archives FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.festival_simplified_rerun_archives TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_premature_simplified_festival_rerun(
  p_edition_id uuid,
  p_expected_runtime_id uuid,
  p_expected_result_id uuid,
  p_approved_by text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $prepare$
DECLARE
  e public.festival_editions_v2%ROWTYPE;
  r public.festival_edition_runtimes%ROWTYPE;
  s public.festival_simplified_edition_results%ROWTYPE;
  f public.festival_companies%ROWTYPE;
  c public.companies%ROWTYPE;
  ct public.company_transactions%ROWTYPE;
  prior public.festival_simplified_rerun_archives%ROWTYPE;
  v_archive_id uuid;
  v_reversal_id uuid;
  v_reputation_delta integer;
  v_archive jsonb;
  v_timezone text;
BEGIN
  -- This internal function has no public/authenticated EXECUTE privilege.
  -- Always supply explicit edition + runtime + result identifiers and an
  -- operator reference, so an accidental broad replay is impossible.
  IF p_edition_id IS NULL OR p_expected_runtime_id IS NULL
    OR p_expected_result_id IS NULL
    OR length(trim(coalesce(p_reason,''))) < 20
    OR length(trim(coalesce(p_approved_by,''))) < 5 THEN
    RAISE EXCEPTION 'FESTIVAL_RERUN_EXPLICIT_APPROVAL_REQUIRED';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('festival-rerun:'||p_edition_id::text,0)
  );
  SELECT * INTO prior FROM public.festival_simplified_rerun_archives
    WHERE festival_edition_id=p_edition_id;
  IF FOUND THEN
    IF prior.old_runtime_id=p_expected_runtime_id
      AND prior.old_result_id=p_expected_result_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'archiveId',prior.id,'editionId',prior.festival_edition_id,
        'idempotent',true,'readyToRerun',prior.rerun_at IS NULL
      );
    END IF;
    RAISE EXCEPTION 'FESTIVAL_RERUN_ALREADY_ARCHIVED';
  END IF;

  SELECT * INTO e FROM public.festival_editions_v2 WHERE id=p_edition_id FOR UPDATE;
  SELECT * INTO r FROM public.festival_edition_runtimes
    WHERE id=p_expected_runtime_id AND edition_id=p_edition_id
      AND state='completed' FOR UPDATE;
  SELECT * INTO s FROM public.festival_simplified_edition_results
    WHERE id=p_expected_result_id AND runtime_id=p_expected_runtime_id
      AND festival_edition_id=p_edition_id FOR UPDATE;
  IF e.id IS NULL OR r.id IS NULL OR s.id IS NULL
     OR e.status <> 'completed'
     OR s.settlement_applied_at IS NULL
     OR s.finance_ledger_frozen_at IS NULL
     OR s.company_transaction_id IS NULL
     OR r.schedule_source <> 'simplified_generated' THEN
    RAISE EXCEPTION 'FESTIVAL_RERUN_NOT_ELIGIBLE';
  END IF;
  SELECT nullif(city.timezone,'') INTO v_timezone FROM public.cities city WHERE city.id=e.city_id;
  IF e.ends_on IS NULL
     OR (pg_catalog.now() AT TIME ZONE coalesce(v_timezone,'UTC'))::date <= e.ends_on
     OR s.completed_at::date >= e.ends_on THEN
    -- An early completed result is eligible only after the real last day.
    RAISE EXCEPTION 'FESTIVAL_RERUN_AFTER_FINAL_DAY_ONLY';
  END IF;
  IF EXISTS(SELECT 1 FROM public.festival_edition_settlements z
    WHERE z.edition_id=e.id AND z.invalidated_at IS NULL)
     OR EXISTS(SELECT 1 FROM public.festival_results z
       WHERE z.festival_edition_id=e.id)
     OR EXISTS(SELECT 1 FROM public.festival_owner_engagement_applications z
       WHERE z.festival_result_id=s.id)
     OR s.engagement_finalised_at IS NOT NULL
     OR EXISTS(SELECT 1 FROM public.festival_simplified_artist_payouts z
       WHERE z.festival_result_id=s.id)
     OR EXISTS(SELECT 1 FROM public.festival_player_attendance z
       WHERE z.festival_edition_id=e.id AND z.status='attending') THEN
    RAISE EXCEPTION 'FESTIVAL_RERUN_SETTLEMENT_OR_ATTENDANCE_REVIEW_REQUIRED';
  END IF;

  -- Reject unknown direct child dependencies instead of using CASCADE on the
  -- result, then preserve ALL previous original rows as immutable JSON.
  SELECT * INTO f FROM public.festival_companies
    WHERE id=e.festival_company_id;
  SELECT * INTO c FROM public.companies
    WHERE id=f.company_id FOR UPDATE;
  SELECT * INTO ct FROM public.company_transactions
    WHERE id=s.company_transaction_id AND company_id=c.id
      AND related_entity_type='festival_simplified_result'
      AND related_entity_id=s.id AND category='festival_settlement';
  IF f.id IS NULL OR c.id IS NULL OR ct.id IS NULL
     OR pg_catalog.round(ct.amount * 100)::bigint <> pg_catalog.abs(s.net_profit_minor)
     OR (s.net_profit_minor >= 0 AND ct.transaction_type <> 'income')
     OR (s.net_profit_minor < 0 AND ct.transaction_type <> 'expense') THEN
    RAISE EXCEPTION 'FESTIVAL_RERUN_FINANCE_RECONCILIATION_FAILED';
  END IF;
  v_reputation_delta:=coalesce(s.company_reputation_after,0) -
                         coalesce(s.company_reputation_before,0);
  IF pg_catalog.round(c.balance*100)::bigint < s.net_profit_minor
    OR c.reputation_score < v_reputation_delta THEN
    RAISE EXCEPTION 'FESTIVAL_RERUN_CANNOT_COMPENSATE_EXISTING_POSTING';
  END IF;

  v_archive:=pg_catalog.jsonb_build_object(
    'edition',to_jsonb(e),'runtime',to_jsonb(r),'result',to_jsonb(s),
    'companyTransaction',to_jsonb(ct),
    'ledger',coalesce((SELECT pg_catalog.jsonb_agg(to_jsonb(x))
      FROM public.festival_simplified_finance_ledger x
      WHERE x.festival_result_id=s.id),'[]'::jsonb),
    'runtimeConfigurationVersions',coalesce((
      SELECT pg_catalog.jsonb_agg(to_jsonb(x))
      FROM public.festival_runtime_configuration_versions x WHERE x.runtime_id=r.id
    ),'[]'::jsonb),
    'runtimeEvidence',coalesce((
      SELECT pg_catalog.jsonb_agg(to_jsonb(x))
      FROM public.festival_runtime_evidence x WHERE x.runtime_id=r.id
    ),'[]'::jsonb),
    'runtimeDigests',coalesce((
      SELECT pg_catalog.jsonb_agg(to_jsonb(x))
      FROM public.festival_runtime_completion_digests x WHERE x.runtime_id=r.id
    ),'[]'::jsonb),
    'runtimeActions',coalesce((
      SELECT pg_catalog.jsonb_agg(to_jsonb(x))
      FROM public.festival_runtime_action_audit x WHERE x.runtime_id=r.id
    ),'[]'::jsonb)
  );
  INSERT INTO public.festival_simplified_rerun_archives(
    festival_company_id,festival_edition_id,old_runtime_id,old_result_id,
    original_company_transaction_id,original_profit_minor,
    original_reputation_delta,evidence_archive,reason,approved_by)
  VALUES(e.festival_company_id,e.id,r.id,s.id,ct.id,s.net_profit_minor,
         v_reputation_delta,v_archive,p_reason,p_approved_by)
  RETURNING id INTO v_archive_id;

  -- Existing credit/expense row stays intact. The opposite journal reverses
  -- its effect without rewriting unrelated subsequent company transactions.
  UPDATE public.companies
  SET balance=(pg_catalog.round(balance*100)::bigint-s.net_profit_minor)::numeric/100,
      reputation_score=reputation_score-v_reputation_delta,
      updated_at=pg_catalog.now()
  WHERE id=c.id;

  INSERT INTO public.company_transactions(
    company_id,transaction_type,amount,description,
    related_entity_id,related_entity_type,category)
  VALUES(c.id,CASE WHEN s.net_profit_minor>=0 THEN 'expense' ELSE 'income' END,
         pg_catalog.abs(s.net_profit_minor)::numeric/100,
         'Reversal of prematurely completed annual Festival simulation',
         v_archive_id,'festival_simplified_rerun_archive',
         'festival_settlement_reversal')
  RETURNING id INTO v_reversal_id;
  UPDATE public.festival_simplified_rerun_archives
    SET reversal_company_transaction_id=v_reversal_id WHERE id=v_archive_id;

  -- Only the simplified snapshot is removed, not contracts, paid tickets,
  -- published information, or real-player attendance. All deleted runtime
  -- children have been retained as JSON in the archive above.
  DELETE FROM public.festival_simplified_finance_ledger
    WHERE festival_result_id=s.id;
  DELETE FROM public.festival_simplified_edition_results WHERE id=s.id;
  DELETE FROM public.festival_edition_runtimes WHERE id=r.id;
  UPDATE public.festival_editions_v2
  SET status='announced',completed_at=NULL,locked_at=NULL,
      version=version+1,updated_at=pg_catalog.now()
  WHERE id=e.id;

  RETURN pg_catalog.jsonb_build_object(
    'archiveId',v_archive_id,'editionId',e.id,
    'originalResultId',s.id,'originalCompanyProfitMinor',s.net_profit_minor,
    'reversalTransactionId',v_reversal_id,
    'readyToRerun',true,'idempotent',false
  );
END;
$prepare$;

REVOKE ALL ON FUNCTION public.prepare_premature_simplified_festival_rerun(uuid,uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_premature_simplified_festival_rerun(uuid,uuid,uuid,text,text)
  TO service_role;

NOTIFY pgrst,'reload schema';
