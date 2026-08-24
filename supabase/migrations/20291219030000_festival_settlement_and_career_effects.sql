-- PR B4: canonical festival settlement and career effects.
--
-- This migration closes the hand-off created by 20291213090000. Settlement is
-- one server-authoritative transaction: canonical contract money is posted
-- through Finance, career projections are mutated once, and every applied
-- effect remains traceable to its finalised performance outcome.

ALTER TABLE public.festival_contract_settlement_instructions
  ADD COLUMN IF NOT EXISTS merch_gross_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artist_merch_share_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artist_payout_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_refund_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finance_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS refund_transaction_id uuid;

ALTER TABLE public.festival_fan_conversion_applications
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS festival_settlement_events_idempotency_idx
  ON public.festival_settlement_events(settlement_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.festival_member_progression_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE RESTRICT,
  outcome_id uuid NOT NULL REFERENCES public.festival_performance_outcomes(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  xp_delta integer NOT NULL CHECK (xp_delta >= 0),
  before_experience integer NOT NULL,
  after_experience integer NOT NULL,
  attendance_status text NOT NULL,
  idempotency_key text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(settlement_id,outcome_id,profile_id),
  UNIQUE(idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_sponsor_effect_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE RESTRICT,
  sponsor_outcome_id uuid NOT NULL REFERENCES public.festival_sponsor_outcomes(id) ON DELETE RESTRICT,
  outcome_id uuid NOT NULL REFERENCES public.festival_performance_outcomes(id) ON DELETE RESTRICT,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE RESTRICT,
  sponsor_entity_id uuid,
  sentiment_score numeric NOT NULL,
  visibility_score numeric NOT NULL,
  professionalism_score numeric NOT NULL,
  renewal_interest numeric NOT NULL,
  application_status public.festival_settlement_application_status NOT NULL DEFAULT 'applied',
  idempotency_key text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(settlement_id,sponsor_outcome_id),
  UNIQUE(idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_reputation_state (
  festival_id uuid PRIMARY KEY REFERENCES public.festivals(id) ON DELETE CASCADE,
  reputation_score numeric NOT NULL DEFAULT 50 CHECK (reputation_score BETWEEN 0 AND 100),
  last_settlement_id uuid REFERENCES public.festival_edition_settlements(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_sponsor_health_state (
  festival_id uuid PRIMARY KEY REFERENCES public.festivals(id) ON DELETE CASCADE,
  sentiment_score numeric NOT NULL DEFAULT 50 CHECK (sentiment_score BETWEEN 0 AND 100),
  professionalism_score numeric NOT NULL DEFAULT 50 CHECK (professionalism_score BETWEEN 0 AND 100),
  renewal_interest numeric NOT NULL DEFAULT 50 CHECK (renewal_interest BETWEEN 0 AND 100),
  last_edition_id uuid REFERENCES public.festival_editions(id) ON DELETE SET NULL,
  last_settlement_id uuid REFERENCES public.festival_edition_settlements(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_member_progression_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_sponsor_effect_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_reputation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_sponsor_health_state ENABLE ROW LEVEL SECURITY;

-- Settlement internals contain contract economics and cross-act information.
-- They are intentionally RPC-only for normal users.
REVOKE ALL ON public.festival_edition_settlements,
  public.festival_settlement_events,
  public.festival_effect_applications,
  public.festival_fan_conversion_applications,
  public.streaming_uplift_campaigns,
  public.festival_contract_settlement_instructions,
  public.festival_settlement_transactions,
  public.festival_edition_financial_results,
  public.festival_member_progression_applications,
  public.festival_sponsor_effect_applications,
  public.festival_reputation_state,
  public.festival_sponsor_health_state
FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.festival_member_progression_applications,
  public.festival_sponsor_effect_applications,
  public.festival_reputation_state,
  public.festival_sponsor_health_state TO service_role;

CREATE OR REPLACE FUNCTION public._festival_settlement_owner(p_festival_id uuid)
RETURNS TABLE(owner_type public.financial_owner_type, owner_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE f public.festivals%ROWTYPE;
BEGIN
  SELECT * INTO STRICT f FROM public.festivals WHERE id=p_festival_id;
  IF f.owner_type='company' AND f.owner_company_id IS NOT NULL THEN
    RETURN QUERY SELECT 'company'::public.financial_owner_type, f.owner_company_id;
  ELSIF f.owner_type='player' AND f.owner_profile_id IS NOT NULL THEN
    RETURN QUERY SELECT 'player'::public.financial_owner_type, f.owner_profile_id;
  ELSIF f.owner_type='system' THEN
    RETURN QUERY SELECT 'system'::public.financial_owner_type, NULL::uuid;
  ELSE
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_OWNER_MISSING: festival % has no finance owner', p_festival_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._festival_settlement_apply_career(
  p_settlement_id uuid,
  p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  cfg public.festival_settlement_effect_configs%ROWTYPE;
  fx record;
  existing_fx public.festival_effect_applications%ROWTYPE;
  approved numeric;
  before_value numeric;
  after_value numeric;
  app_status public.festival_settlement_application_status;
  failure_code text;
  failure_reason text;
  fc record;
  existing_fc public.festival_fan_conversion_applications%ROWTYPE;
  b public.bands%ROWTYPE;
  casual_gain integer;
  dedicated_gain integer;
  super_gain integer;
  remaining_loss integer;
  casual_after integer;
  dedicated_after integer;
  super_after integer;
  total_after integer;
  att record;
  profile_row public.profiles%ROWTYPE;
  xp integer;
BEGIN
  SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
  SELECT * INTO STRICT cfg FROM public.festival_settlement_effect_configs WHERE version=s.calculation_config_version;

  FOR fx IN
    SELECT pe.*, o.id AS source_outcome_id, o.status AS outcome_status, o.overall_score, o.session_id, o.band_id
    FROM public.festival_performance_effects pe
    JOIN public.festival_performance_outcomes o ON o.id=pe.outcome_id
    WHERE o.edition_id=s.edition_id
    ORDER BY pe.id
  LOOP
    SELECT * INTO existing_fx FROM public.festival_effect_applications
    WHERE settlement_id=s.id AND effect_id=fx.id FOR UPDATE;
    IF FOUND AND existing_fx.applied_at IS NOT NULL AND existing_fx.after_value IS NOT NULL THEN
      CONTINUE;
    END IF;

    approved:=NULL; before_value:=NULL; after_value:=NULL;
    app_status:='blocked'; failure_code:=NULL; failure_reason:=NULL;

    IF fx.outcome_status::text <> 'finalised' THEN
      failure_code:='outcome_not_finalised'; failure_reason:='Source outcome is not finalised.';
    ELSIF fx.effect_type='band_fame' AND fx.entity_type='band' AND fx.entity_id IS NOT NULL THEN
      approved:=LEAST(GREATEST(fx.proposed_value,cfg.negative_effect_floor),cfg.fame_cap);
      SELECT * INTO STRICT b FROM public.bands WHERE id=fx.entity_id FOR UPDATE;
      before_value:=COALESCE(b.fame,0);
      after_value:=GREATEST(0,before_value+approved);
      UPDATE public.bands SET fame=ROUND(after_value)::integer WHERE id=b.id;
      app_status:=CASE WHEN approved IS DISTINCT FROM fx.proposed_value THEN 'adjusted' ELSE 'applied' END;
    ELSIF fx.effect_type='festival_reputation' AND fx.entity_type='festival' AND fx.entity_id IS NOT NULL THEN
      approved:=LEAST(GREATEST(fx.proposed_value,cfg.negative_effect_floor),cfg.fame_cap);
      INSERT INTO public.festival_reputation_state(festival_id,reputation_score,last_settlement_id)
      VALUES(fx.entity_id,50,s.id) ON CONFLICT(festival_id) DO NOTHING;
      SELECT reputation_score INTO before_value FROM public.festival_reputation_state WHERE festival_id=fx.entity_id FOR UPDATE;
      after_value:=LEAST(100,GREATEST(0,before_value+approved));
      UPDATE public.festival_reputation_state
      SET reputation_score=after_value,last_settlement_id=s.id,updated_at=now()
      WHERE festival_id=fx.entity_id;
      app_status:=CASE WHEN approved IS DISTINCT FROM fx.proposed_value THEN 'adjusted' ELSE 'applied' END;
    ELSIF fx.effect_type='streaming_uplift' THEN
      approved:=LEAST(GREATEST(fx.proposed_value,0),cfg.streaming_uplift_cap);
      before_value:=0; after_value:=approved;
      INSERT INTO public.streaming_uplift_campaigns(
        source_outcome_id,source_effect_id,duration_days,initial_uplift,decay_curve,model_version,idempotency_key
      ) VALUES (
        fx.source_outcome_id,fx.id,COALESCE((fx.effect_payload->>'duration_days')::integer,14),approved,
        COALESCE(fx.effect_payload->>'decay_curve','linear'),fx.model_version,
        p_idempotency_key||':stream:'||fx.id
      ) ON CONFLICT(source_effect_id) DO NOTHING;
      app_status:=CASE WHEN approved IS DISTINCT FROM fx.proposed_value THEN 'adjusted' ELSE 'applied' END;
    ELSE
      failure_code:='unsupported_effect_type'; failure_reason:='Settlement does not recognise this proposed effect type.';
    END IF;

    INSERT INTO public.festival_effect_applications(
      settlement_id,effect_id,effect_type,entity_type,entity_id,proposed_value,approved_value,
      before_value,after_value,cap_applied,floor_applied,modifier_applied,application_status,
      failure_code,failure_reason,source_outcome_id,idempotency_key,applied_at
    ) VALUES (
      s.id,fx.id,fx.effect_type,fx.entity_type,fx.entity_id,fx.proposed_value,approved,before_value,after_value,
      CASE WHEN approved IS NOT NULL AND fx.proposed_value>approved THEN approved END,
      CASE WHEN approved IS NOT NULL AND fx.proposed_value<approved THEN approved END,
      NULL,app_status,failure_code,failure_reason,fx.source_outcome_id,
      p_idempotency_key||':effect:'||fx.id,CASE WHEN app_status IN ('applied','adjusted') THEN now() END
    )
    ON CONFLICT(settlement_id,effect_id) DO UPDATE SET
      approved_value=EXCLUDED.approved_value,before_value=EXCLUDED.before_value,after_value=EXCLUDED.after_value,
      cap_applied=EXCLUDED.cap_applied,floor_applied=EXCLUDED.floor_applied,
      application_status=EXCLUDED.application_status,failure_code=EXCLUDED.failure_code,
      failure_reason=EXCLUDED.failure_reason,applied_at=EXCLUDED.applied_at;
  END LOOP;

  FOR fc IN
    SELECT f.*, o.session_id
    FROM public.festival_fan_conversion_outcomes f
    JOIN public.festival_performance_outcomes o ON o.id=f.outcome_id
    WHERE o.edition_id=s.edition_id AND o.status='finalised'
    ORDER BY f.id
  LOOP
    SELECT * INTO existing_fc FROM public.festival_fan_conversion_applications
    WHERE settlement_id=s.id AND fan_conversion_outcome_id=fc.id FOR UPDATE;
    IF FOUND AND existing_fc.after_state IS NOT NULL THEN CONTINUE; END IF;

    SELECT * INTO STRICT b FROM public.bands WHERE id=fc.band_id FOR UPDATE;
    casual_gain:=LEAST(GREATEST(fc.new_casual_fans,0),cfg.fan_cap);
    dedicated_gain:=LEAST(GREATEST(fc.new_engaged_fans,0),cfg.fan_cap);
    super_gain:=LEAST(GREATEST(fc.new_dedicated_fans,0),cfg.fan_cap);
    remaining_loss:=LEAST(GREATEST(fc.lost_fans,0),cfg.fan_cap);

    casual_after:=COALESCE(b.casual_fans,0)+casual_gain;
    dedicated_after:=COALESCE(b.dedicated_fans,0)+dedicated_gain;
    super_after:=COALESCE(b.superfans,0)+super_gain;
    IF remaining_loss>0 THEN
      IF casual_after>=remaining_loss THEN casual_after:=casual_after-remaining_loss; remaining_loss:=0;
      ELSE remaining_loss:=remaining_loss-casual_after; casual_after:=0; END IF;
    END IF;
    IF remaining_loss>0 THEN
      IF dedicated_after>=remaining_loss THEN dedicated_after:=dedicated_after-remaining_loss; remaining_loss:=0;
      ELSE remaining_loss:=remaining_loss-dedicated_after; dedicated_after:=0; END IF;
    END IF;
    IF remaining_loss>0 THEN super_after:=GREATEST(0,super_after-remaining_loss); END IF;
    total_after:=casual_after+dedicated_after+super_after;

    UPDATE public.bands SET
      casual_fans=casual_after,dedicated_fans=dedicated_after,superfans=super_after,
      total_fans=total_after,
      weekly_fans=GREATEST(0,COALESCE(weekly_fans,0)+GREATEST(0,total_after-COALESCE(b.total_fans,0)))
    WHERE id=b.id;

    INSERT INTO public.festival_fan_conversion_applications(
      settlement_id,fan_conversion_outcome_id,band_id,casual_fans_gained,engaged_fans_gained,
      dedicated_fans_gained,fans_lost,source_cohort,status,explanation,idempotency_key,applied_at,
      before_state,after_state
    ) VALUES (
      s.id,fc.id,fc.band_id,casual_gain,dedicated_gain,super_gain,LEAST(GREATEST(fc.lost_fans,0),cfg.fan_cap),
      fc.cohort_breakdown,'applied',fc.conversion_explanation,p_idempotency_key||':fans:'||fc.id,now(),
      jsonb_build_object('total',COALESCE(b.total_fans,0),'casual',COALESCE(b.casual_fans,0),'dedicated',COALESCE(b.dedicated_fans,0),'superfans',COALESCE(b.superfans,0)),
      jsonb_build_object('total',total_after,'casual',casual_after,'dedicated',dedicated_after,'superfans',super_after)
    )
    ON CONFLICT(settlement_id,fan_conversion_outcome_id) DO UPDATE SET
      status='applied',applied_at=EXCLUDED.applied_at,before_state=EXCLUDED.before_state,after_state=EXCLUDED.after_state;
  END LOOP;

  -- Relevant member progression: checked-in/late/replacement performers on a
  -- completed or partially completed canonical session receive bounded XP once.
  FOR att IN
    SELECT a.session_id,a.profile_id,a.arrival_status::text AS arrival_status,o.id AS outcome_id,o.overall_score
    FROM public.festival_performance_attendance a
    JOIN public.festival_performance_sessions ps ON ps.id=a.session_id
    JOIN public.festival_performance_outcomes o ON o.session_id=ps.id AND o.status='finalised'
    WHERE ps.edition_id=s.edition_id
      AND ps.status IN ('completed','partially_completed')
      AND a.profile_id IS NOT NULL
      AND a.arrival_status IN ('checked_in','late','replacement')
    ORDER BY o.id,a.profile_id
  LOOP
    IF EXISTS(SELECT 1 FROM public.festival_member_progression_applications x WHERE x.settlement_id=s.id AND x.outcome_id=att.outcome_id AND x.profile_id=att.profile_id) THEN
      CONTINUE;
    END IF;
    SELECT * INTO STRICT profile_row FROM public.profiles WHERE id=att.profile_id FOR UPDATE;
    xp:=LEAST(cfg.xp_cap::integer,GREATEST(1,ROUND(att.overall_score/5)::integer));
    UPDATE public.profiles SET experience=COALESCE(experience,0)+xp WHERE id=profile_row.id;
    INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,metadata)
    VALUES(profile_row.user_id,profile_row.id,'gig_performance',xp,
      jsonb_build_object('source','festival_settlement','settlement_id',s.id,'outcome_id',att.outcome_id,
        'idempotency_key',p_idempotency_key||':xp:'||att.outcome_id||':'||att.profile_id));
    INSERT INTO public.festival_member_progression_applications(
      settlement_id,session_id,outcome_id,profile_id,xp_delta,before_experience,after_experience,
      attendance_status,idempotency_key
    ) VALUES (
      s.id,att.session_id,att.outcome_id,att.profile_id,xp,COALESCE(profile_row.experience,0),COALESCE(profile_row.experience,0)+xp,
      att.arrival_status,p_idempotency_key||':xp:'||att.outcome_id||':'||att.profile_id
    );
  END LOOP;

  INSERT INTO public.festival_sponsor_effect_applications(
    settlement_id,sponsor_outcome_id,outcome_id,festival_id,sponsor_entity_id,sentiment_score,
    visibility_score,professionalism_score,renewal_interest,idempotency_key
  )
  SELECT s.id,so.id,so.outcome_id,s.festival_id,so.sponsor_entity_id,
    public.festival_score_clamp(so.sentiment_score),public.festival_score_clamp(so.visibility_score),
    public.festival_score_clamp(so.professionalism_score),public.festival_score_clamp(so.renewal_interest),
    p_idempotency_key||':sponsor:'||so.id
  FROM public.festival_sponsor_outcomes so
  JOIN public.festival_performance_outcomes o ON o.id=so.outcome_id
  WHERE o.edition_id=s.edition_id AND o.status='finalised'
  ON CONFLICT(settlement_id,sponsor_outcome_id) DO NOTHING;

  INSERT INTO public.festival_sponsor_health_state(
    festival_id,sentiment_score,professionalism_score,renewal_interest,last_edition_id,last_settlement_id
  )
  SELECT s.festival_id,
    COALESCE(AVG(a.sentiment_score),50),COALESCE(AVG(a.professionalism_score),50),COALESCE(AVG(a.renewal_interest),50),
    s.edition_id,s.id
  FROM public.festival_sponsor_effect_applications a
  WHERE a.settlement_id=s.id
  GROUP BY s.festival_id
  ON CONFLICT(festival_id) DO UPDATE SET
    sentiment_score=EXCLUDED.sentiment_score,professionalism_score=EXCLUDED.professionalism_score,
    renewal_interest=EXCLUDED.renewal_interest,last_edition_id=EXCLUDED.last_edition_id,
    last_settlement_id=EXCLUDED.last_settlement_id,updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public._festival_settlement_build_contracts(
  p_settlement_id uuid,
  p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  c record;
  terms jsonb;
  perf_status text;
  guarantee bigint;
  deposit bigint;
  bonus bigint;
  kill_fee bigint;
  cancellation_payment bigint;
  deposit_refund bigint;
  merch_pct numeric;
  merch_gross bigint;
  merch_share bigint;
  payout bigint;
BEGIN
  SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
  FOR c IN
    SELECT c.*,v.id AS version_id,v.terms_snapshot AS version_terms,
      ps.status::text AS session_status
    FROM public.festival_contracts c
    LEFT JOIN LATERAL (
      SELECT * FROM public.festival_contract_versions v
      WHERE v.contract_id=c.id AND v.version=c.contract_version
      ORDER BY v.created_at DESC LIMIT 1
    ) v ON true
    LEFT JOIN public.festival_performance_sessions ps ON ps.contract_id=c.id
    WHERE c.edition_id=s.edition_id
    ORDER BY c.id
  LOOP
    terms:=COALESCE(c.version_terms,c.terms_snapshot,'{}'::jsonb);
    perf_status:=COALESCE(c.session_status,c.status::text);
    deposit:=COALESCE((
      SELECT SUM(ABS(l.amount_cents)) FROM public.festival_expense_ledger l
      WHERE l.edition_id=s.edition_id AND l.source_type='festival_contract_deposit'
        AND l.source_id=c.id AND l.status IN ('paid','received')
    ),0);
    guarantee:=CASE WHEN perf_status IN ('completed','partially_completed') THEN COALESCE((terms->>'guarantee_fee_cents')::bigint,0) ELSE 0 END;
    bonus:=CASE WHEN perf_status='completed' THEN COALESCE((terms->>'performance_bonus_cents')::bigint,0) ELSE 0 END;
    kill_fee:=COALESCE((terms#>>'{cancellation_terms,kill_fee_cents}')::bigint,0);
    cancellation_payment:=CASE WHEN perf_status='cancelled' AND COALESCE(c.cancelled_by_side,'')='organiser' THEN kill_fee ELSE 0 END;
    deposit_refund:=CASE WHEN perf_status IN ('no_show','abandoned') OR (perf_status='cancelled' AND COALESCE(c.cancelled_by_side,'')='band') THEN deposit ELSE 0 END;
    merch_pct:=LEAST(100,GREATEST(0,COALESCE((terms->>'merch_share_percent')::numeric,0)));
    merch_gross:=COALESCE((
      SELECT SUM(GREATEST(l.amount_cents,0)) FROM public.festival_expense_ledger l
      WHERE l.edition_id=s.edition_id AND l.category='merch_income' AND l.direction='income'
        AND l.status='received' AND l.counterparty_type='band' AND l.counterparty_id=c.band_id
    ),0);
    merch_share:=ROUND(merch_gross*merch_pct/100.0)::bigint;
    payout:=GREATEST(0,GREATEST(0,guarantee-deposit)+bonus+merch_share+cancellation_payment);

    INSERT INTO public.festival_contract_settlement_instructions(
      settlement_id,contract_id,contract_version,contract_version_id,performance_status,
      guarantee_due_cents,deposit_already_paid_cents,remaining_guarantee_cents,performance_bonus_cents,
      ticket_bonus_cents,merch_share_cents,travel_reimbursement_cents,accommodation_reimbursement_cents,
      cancellation_payment_cents,no_show_penalty_cents,organiser_breach_adjustment_cents,
      band_breach_adjustment_cents,currency_code,explanation,calculation_version,status,
      merch_gross_cents,artist_merch_share_percent,artist_payout_cents,deposit_refund_cents
    ) VALUES (
      s.id,c.id,c.contract_version,c.version_id,perf_status,guarantee,deposit,GREATEST(0,guarantee-deposit),bonus,
      0,merch_share,0,0,cancellation_payment,deposit_refund,0,0,s.currency_code,
      jsonb_build_object(
        'terms_source','signed_contract_version','performance_status',perf_status,
        'guarantee',jsonb_build_object('contract_cents',COALESCE((terms->>'guarantee_fee_cents')::bigint,0),'deposit_paid_cents',deposit),
        'merch',jsonb_build_object('gross_cents',merch_gross,'artist_share_percent',merch_pct,'artist_share_cents',merch_share),
        'cancellation',jsonb_build_object('cancelled_by_side',c.cancelled_by_side,'kill_fee_cents',kill_fee,'deposit_refund_cents',deposit_refund),
        'ticket_bonus','not_applied_without_canonical_per_band_ticket_bonus_evidence'
      ),'festival_settlement_v2','pending',merch_gross,merch_pct,payout,deposit_refund
    )
    ON CONFLICT(settlement_id,contract_id) DO UPDATE SET
      contract_version=EXCLUDED.contract_version,contract_version_id=EXCLUDED.contract_version_id,
      performance_status=EXCLUDED.performance_status,guarantee_due_cents=EXCLUDED.guarantee_due_cents,
      deposit_already_paid_cents=EXCLUDED.deposit_already_paid_cents,remaining_guarantee_cents=EXCLUDED.remaining_guarantee_cents,
      performance_bonus_cents=EXCLUDED.performance_bonus_cents,merch_share_cents=EXCLUDED.merch_share_cents,
      cancellation_payment_cents=EXCLUDED.cancellation_payment_cents,no_show_penalty_cents=EXCLUDED.no_show_penalty_cents,
      currency_code=EXCLUDED.currency_code,explanation=EXCLUDED.explanation,calculation_version=EXCLUDED.calculation_version,
      status='pending',merch_gross_cents=EXCLUDED.merch_gross_cents,
      artist_merch_share_percent=EXCLUDED.artist_merch_share_percent,artist_payout_cents=EXCLUDED.artist_payout_cents,
      deposit_refund_cents=EXCLUDED.deposit_refund_cents;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._festival_settlement_post_contracts(
  p_settlement_id uuid,
  p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  owner_rec record;
  i record;
  band_id uuid;
  tx uuid;
  refund_tx uuid;
BEGIN
  SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
  IF s.currency_code <> 'USD' THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_CURRENCY_UNSUPPORTED: Finance journal currently settles festival contracts in USD only (edition currency %)',s.currency_code;
  END IF;
  SELECT * INTO STRICT owner_rec FROM public._festival_settlement_owner(s.festival_id);

  FOR i IN SELECT * FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id ORDER BY contract_id LOOP
    SELECT c.band_id INTO STRICT band_id FROM public.festival_contracts c WHERE c.id=i.contract_id;
    tx:=i.finance_transaction_id; refund_tx:=i.refund_transaction_id;

    IF i.artist_payout_cents>0 AND tx IS NULL THEN
      tx:=public.finance_transfer(
        owner_rec.owner_type,owner_rec.owner_id,'band'::public.financial_owner_type,band_id,
        i.artist_payout_cents,'festival_payment'::public.financial_transaction_category,
        'Festival artist settlement',p_idempotency_key||':contract:'||i.contract_id||':payout',
        'festival_contract',i.contract_id,NULL,
        jsonb_build_object('settlement_id',s.id,'edition_id',s.edition_id,'contract_id',i.contract_id,'currency_code',s.currency_code)
      );
      INSERT INTO public.festival_settlement_transactions(
        settlement_id,edition_id,contract_id,entity_type,entity_id,counterparty_type,counterparty_id,
        category,direction,gross_amount_cents,deductions_cents,net_amount_cents,currency_code,status,
        external_transaction_id,idempotency_key,completed_at
      ) VALUES (
        s.id,s.edition_id,i.contract_id,'festival',s.festival_id,'band',band_id,'artist_payout','debit',
        i.artist_payout_cents,0,i.artist_payout_cents,s.currency_code,'applied',tx,
        p_idempotency_key||':contract:'||i.contract_id||':payout',now()
      ) ON CONFLICT(settlement_id,idempotency_key) DO NOTHING;
      INSERT INTO public.festival_expense_ledger(
        festival_id,edition_number,edition_id,category,direction,amount_cents,description,counterparty_type,
        counterparty_id,currency_code,status,source_type,source_id,idempotency_key
      ) SELECT s.festival_id,e.edition_number,s.edition_id,'artist_guarantee','expense',i.artist_payout_cents,
        'Canonical festival artist settlement','band',band_id,s.currency_code,'paid','festival_settlement_artist_payout',i.contract_id,
        p_idempotency_key||':ledger:payout:'||i.contract_id
      FROM public.festival_editions e WHERE e.id=s.edition_id
      ON CONFLICT(edition_id,idempotency_key) DO NOTHING;
    END IF;

    IF i.deposit_refund_cents>0 AND refund_tx IS NULL THEN
      refund_tx:=public.finance_transfer(
        'band'::public.financial_owner_type,band_id,owner_rec.owner_type,owner_rec.owner_id,
        i.deposit_refund_cents,'refund'::public.financial_transaction_category,
        'Festival contract deposit refund',p_idempotency_key||':contract:'||i.contract_id||':deposit-refund',
        'festival_contract',i.contract_id,NULL,
        jsonb_build_object('settlement_id',s.id,'edition_id',s.edition_id,'contract_id',i.contract_id,'reason',i.performance_status)
      );
      INSERT INTO public.festival_settlement_transactions(
        settlement_id,edition_id,contract_id,entity_type,entity_id,counterparty_type,counterparty_id,
        category,direction,gross_amount_cents,deductions_cents,net_amount_cents,currency_code,status,
        external_transaction_id,idempotency_key,completed_at
      ) VALUES (
        s.id,s.edition_id,i.contract_id,'festival',s.festival_id,'band',band_id,'deposit_refund','credit',
        i.deposit_refund_cents,0,i.deposit_refund_cents,s.currency_code,'applied',refund_tx,
        p_idempotency_key||':contract:'||i.contract_id||':deposit-refund',now()
      ) ON CONFLICT(settlement_id,idempotency_key) DO NOTHING;
      INSERT INTO public.festival_expense_ledger(
        festival_id,edition_number,edition_id,category,direction,amount_cents,description,counterparty_type,
        counterparty_id,currency_code,status,source_type,source_id,idempotency_key
      ) SELECT s.festival_id,e.edition_number,s.edition_id,'refund','income',i.deposit_refund_cents,
        'Band deposit returned after cancellation/no-show','band',band_id,s.currency_code,'received',
        'festival_settlement_contract_refund',i.contract_id,p_idempotency_key||':ledger:refund:'||i.contract_id
      FROM public.festival_editions e WHERE e.id=s.edition_id
      ON CONFLICT(edition_id,idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.festival_contract_settlement_instructions
    SET finance_transaction_id=tx,refund_transaction_id=refund_tx,status='applied'
    WHERE id=i.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_festival_edition_settlement(p_settlement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  discrepancies jsonb:='[]'::jsonb;
  expected integer;
  actual integer;
  expected_money bigint;
  actual_money bigint;
BEGIN
  SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id;

  SELECT count(*) INTO expected FROM public.festival_performance_effects fx
  JOIN public.festival_performance_outcomes o ON o.id=fx.outcome_id WHERE o.edition_id=s.edition_id;
  SELECT count(*) INTO actual FROM public.festival_effect_applications WHERE settlement_id=s.id;
  IF expected<>actual THEN discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','effect_application_count_mismatch','expected',expected,'actual',actual,'blocking',true)); END IF;
  IF EXISTS(SELECT 1 FROM public.festival_effect_applications WHERE settlement_id=s.id AND application_status IN ('applied','adjusted') AND after_value IS NULL) THEN
    discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','career_projection_missing_after_state','blocking',true));
  END IF;

  SELECT count(*) INTO expected FROM public.festival_fan_conversion_outcomes f
  JOIN public.festival_performance_outcomes o ON o.id=f.outcome_id WHERE o.edition_id=s.edition_id AND o.status='finalised';
  SELECT count(*) INTO actual FROM public.festival_fan_conversion_applications WHERE settlement_id=s.id AND status='applied' AND after_state IS NOT NULL;
  IF expected<>actual THEN discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','fan_application_count_mismatch','expected',expected,'actual',actual,'blocking',true)); END IF;

  SELECT count(*) INTO expected FROM public.festival_contracts WHERE edition_id=s.edition_id;
  SELECT count(*) INTO actual FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id AND status='applied';
  IF expected<>actual THEN discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','contract_instruction_count_mismatch','expected',expected,'actual',actual,'blocking',true)); END IF;

  SELECT count(*) INTO expected FROM public.festival_contract_settlement_instructions
  WHERE settlement_id=s.id AND (artist_payout_cents>0 OR deposit_refund_cents>0);
  SELECT count(DISTINCT contract_id) INTO actual FROM public.festival_settlement_transactions
  WHERE settlement_id=s.id AND status='applied';
  IF expected<>actual THEN discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','contract_finance_transaction_count_mismatch','expected_contracts',expected,'actual_contracts',actual,'blocking',true)); END IF;

  SELECT COALESCE(sum(artist_payout_cents),0)+COALESCE(sum(deposit_refund_cents),0) INTO expected_money
  FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id;
  SELECT COALESCE(sum(net_amount_cents),0) INTO actual_money FROM public.festival_settlement_transactions
  WHERE settlement_id=s.id AND status='applied';
  IF expected_money<>actual_money THEN discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','settlement_money_mismatch','expected_cents',expected_money,'actual_cents',actual_money,'blocking',true)); END IF;

  IF EXISTS(
    SELECT 1 FROM public.festival_settlement_transactions st
    LEFT JOIN public.financial_transactions ft ON ft.id=st.external_transaction_id AND ft.status='completed'
    WHERE st.settlement_id=s.id AND st.status='applied' AND ft.id IS NULL
  ) THEN discrepancies:=discrepancies||jsonb_build_array(jsonb_build_object('code','finance_journal_receipt_missing','blocking',true)); END IF;

  RETURN jsonb_build_object(
    'settlement_id',s.id,'edition_id',s.edition_id,'reconciled',jsonb_array_length(discrepancies)=0,
    'discrepancies',discrepancies,
    'totals',jsonb_build_object(
      'artist_payout_cents',(SELECT COALESCE(sum(artist_payout_cents),0) FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id),
      'deposit_refund_cents',(SELECT COALESCE(sum(deposit_refund_cents),0) FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id),
      'merch_share_cents',(SELECT COALESCE(sum(merch_share_cents),0) FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id)
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.apply_festival_settlement_batch(
  p_settlement_id uuid,
  p_idempotency_key text DEFAULT gen_random_uuid()::text
) RETURNS public.festival_edition_settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  s public.festival_edition_settlements%ROWTYPE;
  reconciliation jsonb;
  ticket_revenue bigint;
  sponsor_revenue bigint;
  merch_revenue bigint;
  vendor_revenue bigint;
  performer_costs bigint;
  ops_costs bigint;
  refunds bigint;
  gross_profit bigint;
BEGIN
  IF NULLIF(btrim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Settlement idempotency key required'; END IF;
  SELECT * INTO STRICT s FROM public.festival_edition_settlements WHERE id=p_settlement_id FOR UPDATE;
  IF s.status='completed' THEN RETURN s; END IF;
  IF s.status<>'locked' THEN RAISE EXCEPTION 'Settlement must be locked'; END IF;
  IF COALESCE(auth.role(),'')<>'service_role' AND NOT public.can_manage_festival_brand(s.festival_id) THEN
    RAISE EXCEPTION 'Not authorised to apply festival settlement';
  END IF;

  UPDATE public.festival_edition_settlements SET status='applying_effects',updated_at=now() WHERE id=s.id RETURNING * INTO s;
  PERFORM public._festival_settlement_apply_career(s.id,p_idempotency_key);
  INSERT INTO public.festival_settlement_events(settlement_id,edition_id,event_type,from_status,to_status,actor_profile_id,authority,idempotency_key)
  VALUES(s.id,s.edition_id,'career_effects_applied','locked','applying_effects',public.current_profile_id_safe(),
    CASE WHEN COALESCE(auth.role(),'')='service_role' THEN 'worker' ELSE 'organiser' END,p_idempotency_key||':career')
  ON CONFLICT(settlement_id,idempotency_key) DO NOTHING;

  UPDATE public.festival_edition_settlements SET effects_applied_at=COALESCE(effects_applied_at,now()),status='settling_contracts',last_completed_phase='effects',updated_at=now() WHERE id=s.id RETURNING * INTO s;
  PERFORM public._festival_settlement_build_contracts(s.id,p_idempotency_key);
  PERFORM public._festival_settlement_post_contracts(s.id,p_idempotency_key);
  INSERT INTO public.festival_settlement_events(settlement_id,edition_id,event_type,from_status,to_status,actor_profile_id,authority,idempotency_key)
  VALUES(s.id,s.edition_id,'contracts_settled','applying_effects','settling_contracts',public.current_profile_id_safe(),
    CASE WHEN COALESCE(auth.role(),'')='service_role' THEN 'worker' ELSE 'organiser' END,p_idempotency_key||':contracts')
  ON CONFLICT(settlement_id,idempotency_key) DO NOTHING;

  UPDATE public.festival_edition_settlements SET contracts_settled_at=COALESCE(contracts_settled_at,now()),status='settling_revenue',last_completed_phase='contracts',updated_at=now() WHERE id=s.id RETURNING * INTO s;

  SELECT COALESCE(sum(amount_cents),0) INTO ticket_revenue FROM public.festival_expense_ledger WHERE edition_id=s.edition_id AND category='ticket_income' AND direction='income' AND status='received';
  SELECT COALESCE(sum(amount_cents),0) INTO sponsor_revenue FROM public.festival_expense_ledger WHERE edition_id=s.edition_id AND category='sponsor_income' AND direction='income' AND status='received';
  SELECT COALESCE(sum(amount_cents),0) INTO merch_revenue FROM public.festival_expense_ledger WHERE edition_id=s.edition_id AND category='merch_income' AND direction='income' AND status='received';
  SELECT COALESCE(sum(amount_cents),0) INTO vendor_revenue FROM public.festival_expense_ledger WHERE edition_id=s.edition_id AND category='fnb_income' AND direction='income' AND status='received';
  SELECT COALESCE(sum(artist_payout_cents),0)-COALESCE(sum(deposit_refund_cents),0) INTO performer_costs FROM public.festival_contract_settlement_instructions WHERE settlement_id=s.id;
  SELECT COALESCE(sum(amount_cents),0) INTO ops_costs FROM public.festival_expense_ledger
    WHERE edition_id=s.edition_id AND direction='expense' AND status IN ('paid','accrued')
      AND source_type IS DISTINCT FROM 'festival_settlement_artist_payout';
  SELECT COALESCE(sum(amount_cents),0) INTO refunds FROM public.festival_expense_ledger
    WHERE edition_id=s.edition_id AND category='refund' AND direction='expense' AND status IN ('paid','accrued');
  gross_profit:=ticket_revenue+sponsor_revenue+merch_revenue+vendor_revenue-performer_costs-ops_costs;

  INSERT INTO public.festival_edition_financial_results(
    edition_id,settlement_id,total_ticket_revenue_cents,sponsorship_revenue_cents,vendor_revenue_cents,
    merch_revenue_cents,performer_costs_cents,operations_costs_cents,refunds_cents,gross_profit_cents,
    net_profit_cents,cash_result_cents,unpaid_obligations_cents,currency_code,calculation_snapshot
  ) VALUES (
    s.edition_id,s.id,ticket_revenue,sponsor_revenue,vendor_revenue,merch_revenue,performer_costs,ops_costs,refunds,
    gross_profit,gross_profit,gross_profit,0,s.currency_code,
    jsonb_build_object('calculation_version','festival_settlement_v2','finance_authority','financial_transactions','tax_rate',0)
  )
  ON CONFLICT(settlement_id) DO UPDATE SET
    total_ticket_revenue_cents=EXCLUDED.total_ticket_revenue_cents,sponsorship_revenue_cents=EXCLUDED.sponsorship_revenue_cents,
    vendor_revenue_cents=EXCLUDED.vendor_revenue_cents,merch_revenue_cents=EXCLUDED.merch_revenue_cents,
    performer_costs_cents=EXCLUDED.performer_costs_cents,operations_costs_cents=EXCLUDED.operations_costs_cents,
    refunds_cents=EXCLUDED.refunds_cents,gross_profit_cents=EXCLUDED.gross_profit_cents,
    net_profit_cents=EXCLUDED.net_profit_cents,cash_result_cents=EXCLUDED.cash_result_cents,
    unpaid_obligations_cents=0,calculation_snapshot=EXCLUDED.calculation_snapshot,finalised_at=now();

  UPDATE public.festival_edition_settlements SET revenue_settled_at=COALESCE(revenue_settled_at,now()),status='reconciling',last_completed_phase='revenue',updated_at=now() WHERE id=s.id RETURNING * INTO s;
  reconciliation:=public.reconcile_festival_edition_settlement(s.id);
  IF COALESCE((reconciliation->>'reconciled')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_RECONCILIATION_FAILED: %',reconciliation->'discrepancies';
  END IF;

  UPDATE public.festival_editions SET status='completed',completed_at=COALESCE(completed_at,now()),updated_at=now() WHERE id=s.edition_id;
  UPDATE public.festival_edition_settlements SET status='completed',reconciled_at=COALESCE(reconciled_at,now()),
    completed_at=COALESCE(completed_at,now()),last_completed_phase='completed',updated_at=now()
  WHERE id=s.id RETURNING * INTO s;
  INSERT INTO public.festival_settlement_events(settlement_id,edition_id,event_type,from_status,to_status,actor_profile_id,authority,metadata,idempotency_key)
  VALUES(s.id,s.edition_id,'settlement_completed','reconciling','completed',public.current_profile_id_safe(),
    CASE WHEN COALESCE(auth.role(),'')='service_role' THEN 'worker' ELSE 'organiser' END,reconciliation,p_idempotency_key||':completed')
  ON CONFLICT(settlement_id,idempotency_key) DO NOTHING;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.settle_festival_edition(
  p_edition_id uuid,
  p_expected_readiness_hash text,
  p_idempotency_key text,
  p_admin_override_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.festival_editions e WHERE e.id=p_edition_id AND public.can_manage_festival_brand(e.festival_id)) THEN
    RAISE EXCEPTION 'Not authorised to settle edition';
  END IF;
  s:=public.prepare_festival_edition_settlement(p_edition_id,p_expected_readiness_hash,p_idempotency_key||':prepare',p_admin_override_reason);
  s:=public.apply_festival_settlement_batch(s.id,p_idempotency_key||':apply');
  RETURN jsonb_build_object('settlement',to_jsonb(s),'reconciliation',public.reconcile_festival_edition_settlement(s.id));
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_performance_settlement_breakdown(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE ps public.festival_performance_sessions%ROWTYPE; settlement public.festival_edition_settlements%ROWTYPE; outcome public.festival_performance_outcomes%ROWTYPE; actor uuid;
BEGIN
  actor:=public.current_profile_id_safe();
  SELECT * INTO STRICT ps FROM public.festival_performance_sessions WHERE id=p_session_id;
  IF NOT public.can_manage_festival_brand(ps.festival_id) AND NOT EXISTS(
    SELECT 1 FROM public.band_members bm WHERE bm.band_id=ps.band_id AND bm.profile_id=actor AND COALESCE(bm.member_status,'active')='active'
  ) THEN RAISE EXCEPTION 'Not authorised to view performance settlement'; END IF;
  SELECT * INTO outcome FROM public.festival_performance_outcomes WHERE session_id=ps.id AND status='finalised' ORDER BY finalised_at DESC NULLS LAST LIMIT 1;
  SELECT * INTO settlement FROM public.festival_edition_settlements WHERE edition_id=ps.edition_id AND invalidated_at IS NULL ORDER BY settlement_version DESC LIMIT 1;
  RETURN jsonb_build_object(
    'session',jsonb_build_object('id',ps.id,'status',ps.status,'band_id',ps.band_id,'edition_id',ps.edition_id),
    'outcome',CASE WHEN outcome.id IS NULL THEN NULL ELSE jsonb_build_object('id',outcome.id,'overall_score',outcome.overall_score,'finalised_at',outcome.finalised_at) END,
    'settlement',CASE WHEN settlement.id IS NULL THEN NULL ELSE jsonb_build_object('id',settlement.id,'status',settlement.status,'completed_at',settlement.completed_at) END,
    'contract_instruction',(SELECT to_jsonb(i) FROM public.festival_contract_settlement_instructions i WHERE i.settlement_id=settlement.id AND i.contract_id=ps.contract_id),
    'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at) FROM public.festival_settlement_transactions t WHERE t.settlement_id=settlement.id AND t.contract_id=ps.contract_id),'[]'::jsonb),
    'career',jsonb_build_object(
      'effects',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_effect_applications a WHERE a.settlement_id=settlement.id AND a.source_outcome_id=outcome.id),'[]'::jsonb),
      'fans',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_fan_conversion_applications a WHERE a.settlement_id=settlement.id AND a.fan_conversion_outcome_id IN (SELECT id FROM public.festival_fan_conversion_outcomes WHERE outcome_id=outcome.id)),'[]'::jsonb),
      'member_progression',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.profile_id) FROM public.festival_member_progression_applications a WHERE a.settlement_id=settlement.id AND a.session_id=ps.id),'[]'::jsonb),
      'sponsor',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_sponsor_effect_applications a WHERE a.settlement_id=settlement.id AND a.outcome_id=outcome.id),'[]'::jsonb)
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_settlement_reconciliation(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE e public.festival_editions%ROWTYPE; s public.festival_edition_settlements%ROWTYPE;
BEGIN
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=p_edition_id;
  IF NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised to view edition settlement'; END IF;
  SELECT * INTO s FROM public.festival_edition_settlements WHERE edition_id=e.id AND invalidated_at IS NULL ORDER BY settlement_version DESC LIMIT 1;
  IF s.id IS NULL THEN RETURN jsonb_build_object('edition_id',e.id,'settlement',NULL,'reconciliation',NULL); END IF;
  RETURN jsonb_build_object(
    'edition_id',e.id,'settlement',to_jsonb(s),'reconciliation',public.reconcile_festival_edition_settlement(s.id),
    'financial_result',(SELECT to_jsonb(r) FROM public.festival_edition_financial_results r WHERE r.settlement_id=s.id),
    'contract_instructions',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.contract_id) FROM public.festival_contract_settlement_instructions i WHERE i.settlement_id=s.id),'[]'::jsonb),
    'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at) FROM public.festival_settlement_transactions t WHERE t.settlement_id=s.id),'[]'::jsonb),
    'career_effects',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_effect_applications a WHERE a.settlement_id=s.id),'[]'::jsonb),
    'fan_conversions',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_fan_conversion_applications a WHERE a.settlement_id=s.id),'[]'::jsonb),
    'member_progression',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_member_progression_applications a WHERE a.settlement_id=s.id),'[]'::jsonb),
    'sponsor_effects',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at) FROM public.festival_sponsor_effect_applications a WHERE a.settlement_id=s.id),'[]'::jsonb),
    'events',COALESCE((SELECT jsonb_agg(to_jsonb(ev) ORDER BY ev.created_at) FROM public.festival_settlement_events ev WHERE ev.settlement_id=s.id),'[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.prevent_festival_settlement_outcome_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=''
AS $$
DECLARE edition uuid;
BEGIN
  SELECT o.edition_id INTO edition FROM public.festival_performance_outcomes o WHERE o.id=COALESCE(NEW.outcome_id,OLD.outcome_id);
  IF public.festival_current_settlement_blocks_mutation(edition) THEN
    RAISE EXCEPTION 'Settlement source inputs are locked for edition %',edition;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;

DROP TRIGGER IF EXISTS tg_festival_settlement_lock_fan_outcomes ON public.festival_fan_conversion_outcomes;
CREATE TRIGGER tg_festival_settlement_lock_fan_outcomes BEFORE UPDATE OR DELETE ON public.festival_fan_conversion_outcomes
FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_settlement_outcome_child_mutation();
DROP TRIGGER IF EXISTS tg_festival_settlement_lock_sponsor_outcomes ON public.festival_sponsor_outcomes;
CREATE TRIGGER tg_festival_settlement_lock_sponsor_outcomes BEFORE UPDATE OR DELETE ON public.festival_sponsor_outcomes
FOR EACH ROW EXECUTE FUNCTION public.prevent_festival_settlement_outcome_child_mutation();

REVOKE ALL ON FUNCTION public._festival_settlement_owner(uuid),
  public._festival_settlement_apply_career(uuid,text),
  public._festival_settlement_build_contracts(uuid,text),
  public._festival_settlement_post_contracts(uuid,text),
  public.apply_festival_settlement_batch(uuid,text),
  public.reconcile_festival_edition_settlement(uuid),
  public.settle_festival_edition(uuid,text,text,text),
  public.get_festival_performance_settlement_breakdown(uuid),
  public.get_festival_edition_settlement_reconciliation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_festival_settlement_batch(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_festival_edition_settlement(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_festival_edition(uuid,text,text,text),
  public.get_festival_performance_settlement_breakdown(uuid),
  public.get_festival_edition_settlement_reconciliation(uuid)
TO authenticated, service_role;
