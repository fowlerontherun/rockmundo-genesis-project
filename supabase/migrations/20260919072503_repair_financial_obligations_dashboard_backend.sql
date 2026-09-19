-- Forward repair for the Financial Obligations dashboard.
-- The UI/RPC contract was deployed without the older Phase 8B obligation schema.
-- This migration restores the player-facing slice without replaying mortgage/loan migrations
-- that are not present in the live database.

CREATE OR REPLACE FUNCTION public.current_active_player_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND COALESCE(p.is_active, false) = true
    AND p.died_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_player_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.current_active_player_profile_id()
$$;

REVOKE EXECUTE ON FUNCTION public.current_active_player_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_player_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_active_player_profile_id(), public.current_player_profile_id() TO authenticated, service_role;

DO $$ BEGIN
  CREATE TYPE public.financial_obligation_frequency AS ENUM ('daily','weekly','fortnightly','monthly','quarterly','annual','custom_interval');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_obligation_status AS ENUM ('active','grace_period','retrying','failed','collections','paused','cancelled','completed','written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.debt_collection_stage AS ENUM ('friendly_reminder','late_notice','final_notice','collections','legal_action','asset_recovery','settled','written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.player_credit_event_type AS ENUM ('successful_payment','missed_payment','default','collection','mortgage_completion','debt_settlement','bankruptcy','score_adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financial_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_type text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('player','band','company','npc','government')),
  owner_id uuid NOT NULL,
  linked_asset_type text,
  linked_asset_id uuid,
  payment_account_id uuid REFERENCES public.financial_accounts(id),
  recipient_account_id uuid REFERENCES public.financial_accounts(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code char(3) NOT NULL,
  frequency public.financial_obligation_frequency NOT NULL,
  custom_interval_days integer CHECK (custom_interval_days IS NULL OR custom_interval_days > 0),
  next_due_date date NOT NULL,
  grace_period_days integer NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  retry_interval_days integer NOT NULL DEFAULT 1 CHECK (retry_interval_days > 0),
  status public.financial_obligation_status NOT NULL DEFAULT 'active',
  missed_payment_count integer NOT NULL DEFAULT 0 CHECK (missed_payment_count >= 0),
  outstanding_balance_minor bigint NOT NULL DEFAULT 0 CHECK (outstanding_balance_minor >= 0),
  linked_finance_transaction_id uuid REFERENCES public.financial_transactions(id),
  legacy_recurring_obligation_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_obligation_linked_asset
  ON public.financial_obligations(obligation_type, linked_asset_type, linked_asset_id)
  WHERE linked_asset_type IS NOT NULL AND linked_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_obligations_due
  ON public.financial_obligations(status, next_due_date)
  WHERE status IN ('active','grace_period','retrying');

CREATE TABLE IF NOT EXISTS public.financial_obligation_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid NOT NULL REFERENCES public.financial_obligations(id) ON DELETE CASCADE,
  instalment_number integer NOT NULL CHECK (instalment_number > 0),
  due_date date NOT NULL,
  grace_expires_at date NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  principal_minor bigint NOT NULL DEFAULT 0 CHECK (principal_minor >= 0),
  interest_minor bigint NOT NULL DEFAULT 0 CHECK (interest_minor >= 0),
  fees_minor bigint NOT NULL DEFAULT 0 CHECK (fees_minor >= 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','due','paid','missed','failed','cancelled','completed')),
  source_schedule_type text,
  source_schedule_id uuid,
  source_schedule_version integer,
  business_key text,
  idempotency_key text,
  transaction_id uuid REFERENCES public.financial_transactions(id),
  paid_at timestamptz,
  first_missed_at timestamptz,
  next_retry_at timestamptz,
  last_attempted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(obligation_id, instalment_number)
);

CREATE INDEX IF NOT EXISTS idx_financial_obligation_schedule_due
  ON public.financial_obligation_schedule(status, due_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_obligation_schedule_business_key
  ON public.financial_obligation_schedule(business_key)
  WHERE business_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_obligation_schedule_idempotency
  ON public.financial_obligation_schedule(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.debt_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id uuid REFERENCES public.financial_obligations(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.financial_obligation_schedule(id) ON DELETE SET NULL,
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  original_amount_minor bigint NOT NULL CHECK (original_amount_minor > 0),
  fees_minor bigint NOT NULL DEFAULT 0 CHECK (fees_minor >= 0),
  interest_minor bigint NOT NULL DEFAULT 0 CHECK (interest_minor >= 0),
  outstanding_balance_minor bigint NOT NULL CHECK (outstanding_balance_minor >= 0),
  currency_code char(3) NOT NULL,
  collection_stage public.debt_collection_stage NOT NULL DEFAULT 'friendly_reminder',
  stage_entered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','written_off')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_debt_records_owner
  ON public.debt_records(owner_type, owner_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_debt_per_schedule
  ON public.debt_records(schedule_id)
  WHERE schedule_id IS NOT NULL AND status = 'open';

CREATE TABLE IF NOT EXISTS public.player_credit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type public.player_credit_event_type NOT NULL,
  obligation_id uuid REFERENCES public.financial_obligations(id) ON DELETE SET NULL,
  debt_id uuid REFERENCES public.debt_records(id) ON DELETE SET NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency_code char(3),
  score_delta integer NOT NULL DEFAULT 0,
  private_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_player_credit_history_profile
  ON public.player_credit_history(profile_id, event_date DESC);

CREATE TABLE IF NOT EXISTS public.player_credit_scores (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_score integer NOT NULL DEFAULT 600 CHECK (credit_score BETWEEN 300 AND 850),
  credit_band text NOT NULL DEFAULT 'Building',
  positive_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  significant_change_notified_at timestamptz
);

ALTER TABLE public.financial_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_obligation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_credit_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_obligations_owner_select ON public.financial_obligations;
CREATE POLICY financial_obligations_owner_select
ON public.financial_obligations
FOR SELECT
TO authenticated
USING (owner_type = 'player' AND owner_id = public.current_player_profile_id());

DROP POLICY IF EXISTS financial_obligation_schedule_owner_select ON public.financial_obligation_schedule;
CREATE POLICY financial_obligation_schedule_owner_select
ON public.financial_obligation_schedule
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.financial_obligations o
    WHERE o.id = financial_obligation_schedule.obligation_id
      AND o.owner_type = 'player'
      AND o.owner_id = public.current_player_profile_id()
  )
);

DROP POLICY IF EXISTS debt_records_owner_select ON public.debt_records;
CREATE POLICY debt_records_owner_select
ON public.debt_records
FOR SELECT
TO authenticated
USING (owner_type = 'player' AND owner_id = public.current_player_profile_id());

DROP POLICY IF EXISTS player_credit_history_owner_select ON public.player_credit_history;
CREATE POLICY player_credit_history_owner_select
ON public.player_credit_history
FOR SELECT
TO authenticated
USING (profile_id = public.current_player_profile_id());

DROP POLICY IF EXISTS player_credit_scores_owner_select ON public.player_credit_scores;
CREATE POLICY player_credit_scores_owner_select
ON public.player_credit_scores
FOR SELECT
TO authenticated
USING (profile_id = public.current_player_profile_id());

REVOKE ALL ON TABLE
  public.financial_obligations,
  public.financial_obligation_schedule,
  public.debt_records,
  public.player_credit_history,
  public.player_credit_scores
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.financial_obligations,
  public.financial_obligation_schedule,
  public.debt_records,
  public.player_credit_history,
  public.player_credit_scores
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.financial_obligations,
  public.financial_obligation_schedule,
  public.debt_records,
  public.player_credit_history,
  public.player_credit_scores
TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_private_credit_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_player_profile_id() IS NULL THEN NULL
    ELSE jsonb_build_object(
      'score', COALESCE(s.credit_score, 600),
      'band', COALESCE(s.credit_band, 'Building'),
      'lastCalculatedAt', s.calculated_at,
      'positiveFactors', COALESCE(s.positive_factors, '[]'::jsonb),
      'negativeFactors', COALESCE(s.negative_factors, '[]'::jsonb),
      'history', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'eventType', h.event_type,
            'eventDate', h.event_date,
            'amountMinor', h.amount_minor,
            'currencyCode', h.currency_code,
            'scoreDelta', h.score_delta
          )
          ORDER BY h.event_date DESC, h.created_at DESC
        )
        FROM public.player_credit_history h
        WHERE h.profile_id = public.current_player_profile_id()
      ), '[]'::jsonb)
    )
  END
  FROM (SELECT 1) seed
  LEFT JOIN public.player_credit_scores s
    ON s.profile_id = public.current_player_profile_id()
$$;

CREATE OR REPLACE FUNCTION public.get_my_financial_obligations_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'obligations', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.next_due_date, o.created_at)
      FROM (
        SELECT id, obligation_type, owner_type, owner_id, linked_asset_type, linked_asset_id,
               amount_minor, currency_code, frequency, next_due_date, grace_period_days, status,
               missed_payment_count, outstanding_balance_minor, created_at
        FROM public.financial_obligations
        WHERE owner_type = 'player'
          AND owner_id = public.current_player_profile_id()
        ORDER BY next_due_date, created_at
        LIMIT 50
      ) o
    ), '[]'::jsonb),
    'schedule', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.due_date, s.instalment_number)
      FROM (
        SELECT s.id, s.obligation_id, s.due_date, s.amount_minor, o.currency_code, s.status,
               s.paid_at, s.first_missed_at, s.next_retry_at, s.resolved_at, s.instalment_number
        FROM public.financial_obligation_schedule s
        JOIN public.financial_obligations o ON o.id = s.obligation_id
        WHERE o.owner_type = 'player'
          AND o.owner_id = public.current_player_profile_id()
          AND s.status IN ('scheduled','due','missed','failed','paid')
        ORDER BY s.due_date, s.instalment_number
        LIMIT 100
      ) s
    ), '[]'::jsonb),
    'debts', COALESCE((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.updated_at DESC)
      FROM (
        SELECT id, obligation_id, original_amount_minor, outstanding_balance_minor,
               currency_code, collection_stage, status, updated_at
        FROM public.debt_records
        WHERE owner_type = 'player'
          AND owner_id = public.current_player_profile_id()
        ORDER BY updated_at DESC
        LIMIT 25
      ) d
    ), '[]'::jsonb),
    'creditProfile', public.get_my_private_credit_profile()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_private_credit_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_financial_obligations_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_private_credit_profile(), public.get_my_financial_obligations_dashboard() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
