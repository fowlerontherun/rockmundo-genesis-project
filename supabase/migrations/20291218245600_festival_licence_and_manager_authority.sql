-- Complete the simplified Festival licence loop and align Festival management
-- authority with the normal company permission model.

ALTER TABLE public.festival_companies
  ADD COLUMN IF NOT EXISTS licence_version integer NOT NULL DEFAULT 0
    CHECK (licence_version >= 0);

ALTER TABLE public.festival_company_licences
  DROP CONSTRAINT IF EXISTS festival_company_licences_festival_company_id_tier_key_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS festival_company_one_active_licence
  ON public.festival_company_licences(festival_company_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS festival_company_one_pending_licence
  ON public.festival_company_licences(festival_company_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.festival_licence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  requested_tier_key text NOT NULL REFERENCES public.festival_licence_tiers(key),
  action text NOT NULL CHECK (action IN ('apply', 'upgrade', 'renew')),
  expected_licence_version integer NOT NULL CHECK (expected_licence_version >= 0),
  fee_minor bigint NOT NULL CHECK (fee_minor >= 0),
  financial_transaction_id uuid REFERENCES public.financial_transactions(id),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (festival_company_id, actor_profile_id, idempotency_key)
);
ALTER TABLE public.festival_licence_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_licence_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._festival_company_manager_authorized(
  p_festival_company_id uuid,
  p_actor_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.festival_companies company
    WHERE company.id = p_festival_company_id
      AND (
        company.owner_profile_id = p_actor_profile_id
        OR public.can_manage_company(company.company_id)
        OR coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public._festival_licence_tier_json(p_tier_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'key', tier.key,
    'name', tier.display_name,
    'rank', tier.rank,
    'feeMinor', tier.fee_minor,
    'maxAttendance', tier.max_attendance,
    'maxDays', tier.max_days,
    'maxStages', tier.max_stages,
    'maxActsPerDay', tier.max_acts_per_day,
    'campingAllowed', tier.camping_allowed,
    'validityDays', greatest(1, ceil(extract(epoch FROM tier.validity) / 86400.0)::integer)
  )
  FROM public.festival_licence_tiers tier
  WHERE tier.key = p_tier_key
$$;

CREATE OR REPLACE FUNCTION public._festival_licence_requirements(
  p_festival_company_id uuid,
  p_tier_key text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH company AS (
    SELECT coalesce(base.reputation_score, 0) AS reputation_score
    FROM public.festival_companies festival
    JOIN public.companies base ON base.id = festival.company_id
    WHERE festival.id = p_festival_company_id
  ), tier AS (
    SELECT *
    FROM public.festival_licence_tiers
    WHERE key = p_tier_key AND active
  ), upgrade_requirements AS (
    SELECT
      coalesce(category.display_order, 99) + 1 AS sort_order,
      jsonb_build_object(
        'code', 'upgrade_' || requirement.key,
        'description', category.display_name || ' level ' || requirement.value,
        'complete', coalesce(upgrade.active_level, 0) >= requirement.value::integer,
        'currentValue', coalesce(upgrade.active_level, 0),
        'requiredValue', requirement.value::integer
      ) AS item
    FROM tier
    CROSS JOIN LATERAL jsonb_each_text(tier.requirements) requirement
    LEFT JOIN public.festival_upgrade_categories category
      ON category.key = requirement.key
    LEFT JOIN public.festival_company_upgrades upgrade
      ON upgrade.festival_company_id = p_festival_company_id
     AND upgrade.category_key = requirement.key
  ), requirements AS (
    SELECT 0 AS sort_order, jsonb_build_object(
      'code', 'company_reputation',
      'description', 'Company reputation ' || tier.minimum_reputation,
      'complete', company.reputation_score >= tier.minimum_reputation,
      'currentValue', company.reputation_score,
      'requiredValue', tier.minimum_reputation
    ) AS item
    FROM tier CROSS JOIN company
    UNION ALL
    SELECT sort_order, item FROM upgrade_requirements
  )
  SELECT coalesce(jsonb_agg(item ORDER BY sort_order), '[]'::jsonb)
  FROM requirements
$$;

CREATE OR REPLACE FUNCTION public._festival_licence_tier_eligible(
  p_festival_company_id uuid,
  p_tier_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.festival_licence_tiers tier
    WHERE tier.key = p_tier_key AND tier.active
  ) AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public._festival_licence_requirements(p_festival_company_id, p_tier_key)
    ) requirement
    WHERE NOT coalesce((requirement->>'complete')::boolean, false)
  )
$$;

CREATE OR REPLACE FUNCTION public._festival_licence_progress_result(
  p_festival_company_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  festival_company public.festival_companies%ROWTYPE;
  active_licence public.festival_company_licences%ROWTYPE;
  active_tier public.festival_licence_tiers%ROWTYPE;
  latest_licence public.festival_company_licences%ROWTYPE;
  latest_tier public.festival_licence_tiers%ROWTYPE;
  highest_eligible public.festival_licence_tiers%ROWTYPE;
  target_tier public.festival_licence_tiers%ROWTYPE;
  company_reputation integer := 0;
  available_balance bigint := 0;
  target_action text;
  requirements jsonb := '[]'::jsonb;
  target_eligible boolean := false;
  affordable boolean := false;
  can_apply boolean := false;
  reason_codes jsonb := '[]'::jsonb;
  current_json jsonb;
  latest_status text;
  days_remaining integer;
  renewal_opens_at timestamptz;
BEGIN
  SELECT * INTO festival_company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_COMPANY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(company.reputation_score, 0)
  INTO company_reputation
  FROM public.companies company
  WHERE company.id = festival_company.company_id;

  SELECT coalesce(account.available_balance_minor, 0)
  INTO available_balance
  FROM public.financial_accounts account
  WHERE account.owner_type = 'company'
    AND account.owner_id = festival_company.company_id
    AND account.is_primary
  LIMIT 1;
  available_balance := coalesce(available_balance, 0);

  SELECT licence.* INTO active_licence
  FROM public.festival_company_licences licence
  JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
  WHERE licence.festival_company_id = festival_company.id
    AND licence.status = 'active'
    AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= p_at
    AND coalesce(licence.valid_until, 'infinity'::timestamptz) > p_at
  ORDER BY tier.rank DESC, licence.valid_until DESC NULLS FIRST, licence.applied_at DESC
  LIMIT 1;
  IF FOUND THEN
    SELECT * INTO active_tier
    FROM public.festival_licence_tiers
    WHERE key = active_licence.tier_key;
  END IF;

  SELECT licence.* INTO latest_licence
  FROM public.festival_company_licences licence
  JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
  WHERE licence.festival_company_id = festival_company.id
  ORDER BY licence.applied_at DESC, tier.rank DESC
  LIMIT 1;
  IF FOUND THEN
    SELECT * INTO latest_tier
    FROM public.festival_licence_tiers
    WHERE key = latest_licence.tier_key;
  END IF;

  SELECT tier.* INTO highest_eligible
  FROM public.festival_licence_tiers tier
  WHERE tier.active
    AND public._festival_licence_tier_eligible(festival_company.id, tier.key)
  ORDER BY tier.rank DESC
  LIMIT 1;

  IF active_licence.id IS NOT NULL THEN
    IF highest_eligible.key IS NOT NULL AND highest_eligible.rank > active_tier.rank THEN
      target_tier := highest_eligible;
      target_action := 'upgrade';
    ELSIF active_licence.valid_until IS NOT NULL
       AND active_licence.valid_until <= p_at + interval '30 days' THEN
      target_tier := active_tier;
      target_action := 'renew';
    ELSE
      SELECT * INTO target_tier
      FROM public.festival_licence_tiers
      WHERE active AND rank = active_tier.rank + 1;
      IF FOUND THEN
        target_action := 'upgrade';
      END IF;
    END IF;
  ELSE
    IF highest_eligible.key IS NOT NULL THEN
      target_tier := highest_eligible;
    ELSE
      SELECT * INTO target_tier
      FROM public.festival_licence_tiers
      WHERE active
      ORDER BY rank
      LIMIT 1;
    END IF;
    IF target_tier.key IS NOT NULL THEN
      target_action := CASE
        WHEN latest_licence.id IS NOT NULL AND latest_licence.tier_key = target_tier.key
          THEN 'renew'
        ELSE 'apply'
      END;
    END IF;
  END IF;

  IF target_tier.key IS NOT NULL THEN
    requirements := public._festival_licence_requirements(
      festival_company.id,
      target_tier.key
    );
    target_eligible := public._festival_licence_tier_eligible(
      festival_company.id,
      target_tier.key
    );
    affordable := available_balance >= target_tier.fee_minor;
    can_apply := target_action IS NOT NULL AND target_eligible AND affordable;

    IF NOT target_eligible THEN
      reason_codes := reason_codes || jsonb_build_array(
        'FESTIVAL_LICENCE_REQUIREMENTS_INCOMPLETE'
      );
    END IF;
    IF NOT affordable THEN
      reason_codes := reason_codes || jsonb_build_array(
        'FESTIVAL_LICENCE_INSUFFICIENT_FUNDS'
      );
    END IF;
    IF target_action IS NULL AND target_eligible THEN
      reason_codes := reason_codes || jsonb_build_array(
        'FESTIVAL_LICENCE_NOT_DUE'
      );
    END IF;
  ELSE
    reason_codes := reason_codes || jsonb_build_array('FESTIVAL_LICENCE_COMPLETE');
  END IF;

  IF active_licence.id IS NOT NULL THEN
    days_remaining := CASE
      WHEN active_licence.valid_until IS NULL THEN NULL
      ELSE greatest(
        0,
        ceil(extract(epoch FROM (active_licence.valid_until - p_at)) / 86400.0)::integer
      )
    END;
    renewal_opens_at := CASE
      WHEN active_licence.valid_until IS NULL THEN NULL
      ELSE active_licence.valid_until - interval '30 days'
    END;
    current_json := public._festival_licence_tier_json(active_tier.key)
      || jsonb_build_object(
        'status', 'active',
        'active', true,
        'validFrom', active_licence.valid_from,
        'validUntil', active_licence.valid_until,
        'daysRemaining', days_remaining
      );
  ELSIF latest_licence.id IS NOT NULL THEN
    latest_status := CASE
      WHEN latest_licence.valid_until IS NOT NULL AND latest_licence.valid_until <= p_at
        THEN 'expired'
      ELSE latest_licence.status
    END;
    current_json := public._festival_licence_tier_json(latest_tier.key)
      || jsonb_build_object(
        'status', latest_status,
        'active', false,
        'validFrom', latest_licence.valid_from,
        'validUntil', latest_licence.valid_until,
        'daysRemaining', 0
      );
  ELSE
    current_json := NULL;
  END IF;

  RETURN jsonb_build_object(
    'licenceVersion', festival_company.licence_version,
    'current', current_json,
    'highestEligible', CASE
      WHEN highest_eligible.key IS NULL THEN NULL
      ELSE public._festival_licence_tier_json(highest_eligible.key)
    END,
    'target', CASE
      WHEN target_tier.key IS NULL THEN NULL
      ELSE public._festival_licence_tier_json(target_tier.key)
    END,
    'next', CASE
      WHEN target_tier.key IS NULL THEN NULL
      ELSE jsonb_build_object(
        'key', target_tier.key,
        'name', target_tier.display_name,
        'feeMinor', target_tier.fee_minor
      )
    END,
    'action', target_action,
    'requirements', requirements,
    'canApply', can_apply,
    'affordable', affordable,
    'reasonCodes', reason_codes,
    'availableBalanceMinor', available_balance,
    'currentReputation', company_reputation,
    'renewalOpensAt', renewal_opens_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_licence_progress(
  p_festival_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;
  RETURN public._festival_licence_progress_result(p_festival_company_id, now());
END;
$$;

CREATE OR REPLACE FUNCTION public._refresh_festival_company_edition_readiness(
  p_festival_company_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH readiness AS (
    SELECT edition.id,
           jsonb_array_length(public._festival_annual_plan_blockers(
             p_festival_company_id,
             edition
           )) AS blocker_count
    FROM public.festival_editions_v2 edition
    WHERE edition.festival_company_id = p_festival_company_id
      AND edition.status NOT IN ('completed', 'cancelled')
      AND edition.locked_at IS NULL
  )
  UPDATE public.festival_editions_v2 edition
  SET readiness_score = greatest(0, 100 - readiness.blocker_count * 25),
      planning_status = CASE WHEN readiness.blocker_count = 0 THEN 'ready' ELSE 'in_progress' END
  FROM readiness
  WHERE edition.id = readiness.id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_festival_company_licence(
  p_festival_company_id uuid,
  p_requested_tier_key text,
  p_expected_licence_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  tier public.festival_licence_tiers%ROWTYPE;
  active_licence public.festival_company_licences%ROWTYPE;
  request public.festival_licence_requests%ROWTYPE;
  progress jsonb;
  payload_hash text;
  action text;
  transaction_id uuid;
  result jsonb;
  renewal_base timestamptz;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_company_id::text || p_idempotency_key::text, 0)
  );

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id
  FOR UPDATE;

  IF company.id IS NULL
     OR NOT public._festival_company_manager_authorized(company.id, actor) THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  payload_hash := encode(digest(jsonb_build_object(
    'festivalCompanyId', company.id,
    'tierKey', p_requested_tier_key,
    'expectedLicenceVersion', p_expected_licence_version
  )::text, 'sha256'), 'hex');

  SELECT * INTO request
  FROM public.festival_licence_requests
  WHERE festival_company_id = company.id
    AND actor_profile_id = actor
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF request.payload_hash <> payload_hash THEN
      RAISE EXCEPTION 'FESTIVAL_LICENCE_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF request.status = 'succeeded' THEN
      RETURN request.result;
    END IF;
  END IF;

  IF company.licence_version <> p_expected_licence_version THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  progress := public._festival_licence_progress_result(company.id, now());
  action := progress->>'action';

  IF progress->'target' IS NULL
     OR progress->'target'->>'key' <> p_requested_tier_key
     OR action NOT IN ('apply', 'upgrade', 'renew') THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_TARGET_CHANGED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT coalesce((progress->>'canApply')::boolean, false) THEN
    IF progress->'reasonCodes' @> '["FESTIVAL_LICENCE_INSUFFICIENT_FUNDS"]'::jsonb THEN
      RAISE EXCEPTION 'FESTIVAL_LICENCE_INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
    END IF;
    IF progress->'reasonCodes' @> '["FESTIVAL_LICENCE_NOT_DUE"]'::jsonb THEN
      RAISE EXCEPTION 'FESTIVAL_LICENCE_NOT_DUE' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'FESTIVAL_LICENCE_REQUIREMENTS_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO tier
  FROM public.festival_licence_tiers
  WHERE key = p_requested_tier_key AND active;
  IF tier.key IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_TIER_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF request.id IS NULL THEN
    INSERT INTO public.festival_licence_requests(
      festival_company_id,
      actor_profile_id,
      idempotency_key,
      payload_hash,
      requested_tier_key,
      action,
      expected_licence_version,
      fee_minor
    ) VALUES (
      company.id,
      actor,
      p_idempotency_key,
      payload_hash,
      tier.key,
      action,
      p_expected_licence_version,
      tier.fee_minor
    ) RETURNING * INTO request;
  END IF;

  BEGIN
    transaction_id := public.finance_debit_owner(
      'company',
      company.company_id,
      tier.fee_minor,
      'company_expense',
      'Festival licence: ' || tier.display_name,
      'festival-licence:' || request.id,
      actor,
      jsonb_build_object(
        'festivalCompanyId', company.id,
        'tierKey', tier.key,
        'action', action,
        'licenceVersion', company.licence_version
      )
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%insufficient%' THEN
      RAISE EXCEPTION 'FESTIVAL_LICENCE_INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
    END IF;
    RAISE;
  END;

  SELECT * INTO active_licence
  FROM public.festival_company_licences
  WHERE festival_company_id = company.id
    AND status = 'active'
    AND coalesce(valid_from, '-infinity'::timestamptz) <= now()
    AND coalesce(valid_until, 'infinity'::timestamptz) > now()
  FOR UPDATE;

  IF action = 'renew'
     AND active_licence.id IS NOT NULL
     AND active_licence.tier_key = tier.key THEN
    renewal_base := greatest(coalesce(active_licence.valid_until, now()), now());
    UPDATE public.festival_company_licences
    SET applied_at = now(),
        valid_from = coalesce(valid_from, now()),
        valid_until = renewal_base + tier.validity,
        decision_reason = 'Renewed through simplified Festival licence action',
        decided_by = actor
    WHERE id = active_licence.id;
  ELSE
    UPDATE public.festival_company_licences
    SET status = 'revoked',
        decision_reason = 'Superseded by ' || tier.display_name || ' licence',
        decided_by = actor
    WHERE festival_company_id = company.id
      AND status = 'active';

    INSERT INTO public.festival_company_licences(
      festival_company_id,
      tier_key,
      status,
      applied_at,
      valid_from,
      valid_until,
      decision_reason,
      decided_by
    ) VALUES (
      company.id,
      tier.key,
      'active',
      now(),
      now(),
      now() + tier.validity,
      CASE action
        WHEN 'upgrade' THEN 'Upgrade requirements satisfied'
        WHEN 'renew' THEN 'Expired licence renewed'
        ELSE 'Initial licence requirements satisfied'
      END,
      actor
    );
  END IF;

  UPDATE public.festival_companies
  SET licence_version = licence_version + 1,
      updated_at = now()
  WHERE id = company.id;

  INSERT INTO public.festival_upgrade_audit(
    festival_company_id,
    actor_profile_id,
    event_type,
    reason,
    before_value,
    after_value
  ) VALUES (
    company.id,
    actor,
    'licence_' || action,
    'Simplified Festival licence action',
    jsonb_build_object('licenceVersion', company.licence_version),
    jsonb_build_object(
      'licenceVersion', company.licence_version + 1,
      'tierKey', tier.key,
      'feeMinor', tier.fee_minor,
      'transactionId', transaction_id
    )
  );

  PERFORM public._refresh_festival_company_edition_readiness(company.id);

  result := public.get_festival_company_upgrades(company.id);
  UPDATE public.festival_licence_requests
  SET status = 'succeeded',
      financial_transaction_id = transaction_id,
      result = result,
      completed_at = now()
  WHERE id = request.id;

  RETURN result;
END;
$$;

-- Align canonical Festival routes, directories and edition planning with the
-- normal company-management permission model.
CREATE OR REPLACE FUNCTION public.resolve_owner_festival_identifier(
  p_identifier text,
  p_edition_identifier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
  profile_id uuid;
  festival_company_id uuid;
  edition_id uuid;
BEGIN
  profile_id := public.current_profile_id_safe();
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_ACCESS_DENIED';
  END IF;
  result := public.resolve_public_festival_identifier(
    p_identifier,
    'festival_company',
    p_edition_identifier
  );
  IF result->>'status' = 'legacy_only' THEN
    RAISE EXCEPTION 'FESTIVAL_IDENTIFIER_LEGACY_ONLY';
  END IF;
  IF result->>'status' = 'ambiguous' THEN
    RAISE EXCEPTION 'FESTIVAL_IDENTIFIER_AMBIGUOUS';
  END IF;
  IF result->>'status' <> 'resolved' THEN
    RAISE EXCEPTION 'FESTIVAL_COMPANY_NOT_FOUND';
  END IF;
  festival_company_id := (result->>'festivalCompanyId')::uuid;
  edition_id := (result->>'editionId')::uuid;
  IF edition_id IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.festival_editions_v2
    WHERE id = edition_id AND festival_company_id = festival_company_id
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_COMPANY_MISMATCH';
  END IF;
  IF NOT public._festival_company_manager_authorized(
    festival_company_id,
    profile_id
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_ACCESS_DENIED';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_company_setup(
  p_festival_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'festivalCompanyId', festival.id,
    'companyId', company.id,
    'publicName', festival.public_name,
    'legalCompanyName', company.name,
    'companyBalance', company.balance,
    'setupStatus', festival.status,
    'setupCompleted', festival.setup_completed,
    'ownerProfileId', festival.owner_profile_id,
    'ownerDisplayName', coalesce(owner.character_name, owner.username, 'Owner'),
    'foundedAt', company.founded_at,
    'companyStatus', company.status,
    'isBankrupt', company.is_bankrupt,
    'configurationComplete', (
      festival.annual_month IS NOT NULL
      AND festival.country_code IS NOT NULL
      AND festival.default_vibe IS NOT NULL
      AND festival.default_site_type IS NOT NULL
      AND festival.default_duration_days IS NOT NULL
    ),
    'firstEditionExists', EXISTS (
      SELECT 1 FROM public.festival_editions_v2 edition
      WHERE edition.festival_company_id = festival.id
    )
  ) INTO result
  FROM public.festival_companies festival
  JOIN public.companies company ON company.id = festival.company_id
  JOIN public.profiles owner ON owner.id = festival.owner_profile_id
  WHERE festival.id = p_festival_company_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_company_editions(
  p_festival_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  editions jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;
  IF company.id IS NULL THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'festivalEditionId', edition.id,
    'editionYear', edition.edition_year,
    'name', edition.name,
    'status', edition.status,
    'startsOn', edition.starts_on,
    'endsOn', edition.ends_on,
    'preferredMonth', edition.preferred_month,
    'countryCode', edition.country_code,
    'cityId', edition.city_id,
    'vibe', edition.vibe,
    'siteType', edition.site_type,
    'durationDays', edition.duration_days,
    'environmentalPolicy', edition.environmental_policy,
    'festivalScale', edition.festival_scale,
    'marketingEmphasis', edition.marketing_emphasis,
    'expectedCapacity', edition.expected_capacity,
    'estimatedOperatingCostMinor', edition.estimated_operating_cost_minor,
    'planningStatus', edition.planning_status,
    'readinessScore', edition.readiness_score,
    'version', edition.version,
    'lockedAt', edition.locked_at,
    'creationSource', edition.creation_source,
    'editable', edition.status NOT IN ('completed', 'cancelled') AND edition.locked_at IS NULL,
    'planBindings', jsonb_build_object(
      'configuration', EXISTS (SELECT 1 FROM public.festival_configurations p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'site', EXISTS (SELECT 1 FROM public.festival_site_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'tickets', EXISTS (SELECT 1 FROM public.festival_ticket_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'artists', EXISTS (SELECT 1 FROM public.festival_artist_programmes p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'operations', EXISTS (SELECT 1 FROM public.festival_operations_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'sponsorship', EXISTS (SELECT 1 FROM public.festival_sponsorship_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'timetable', EXISTS (SELECT 1 FROM public.festival_timetable_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id)
    )
  ) ORDER BY edition.edition_year DESC, edition.id DESC), '[]'::jsonb)
  INTO editions
  FROM public.festival_editions_v2 edition
  WHERE edition.festival_company_id = company.id;

  RETURN jsonb_build_object(
    'festivalCompanyId', company.id,
    'publicName', company.public_name,
    'companyStatus', company.status,
    'setupCompleted', company.setup_completed,
    'canPlanNext', company.status = 'active' AND company.setup_completed,
    'currentGameYear', public.rockmundo_game_year(),
    'editions', editions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.plan_next_festival_edition(
  p_festival_company_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  request public.festival_edition_creation_requests%ROWTYPE;
  edition public.festival_editions_v2%ROWTYPE;
  edition_year integer;
  payload_hash text;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_company_id::text || p_idempotency_key::text, 0)
  );

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id
  FOR UPDATE;
  IF company.id IS NULL OR company.status <> 'active'
     OR NOT public._festival_company_manager_authorized(company.id, actor) THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  edition_year := greatest(
    public.rockmundo_game_year(),
    coalesce((
      SELECT max(existing.edition_year) + 1
      FROM public.festival_editions_v2 existing
      WHERE existing.festival_company_id = company.id
        AND existing.status <> 'cancelled'
    ), public.rockmundo_game_year())
  );
  payload_hash := encode(digest(
    company.id::text || '|' || edition_year::text,
    'sha256'
  ), 'hex');

  SELECT * INTO request
  FROM public.festival_edition_creation_requests
  WHERE festival_company_id = company.id
    AND actor_profile_id = actor
    AND action = 'plan_next'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF request.payload_hash <> payload_hash THEN
      RAISE EXCEPTION 'festival_edition_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF request.status = 'succeeded' THEN
      RETURN request.result || jsonb_build_object('idempotent', true);
    END IF;
  ELSE
    INSERT INTO public.festival_edition_creation_requests(
      festival_company_id,
      actor_profile_id,
      action,
      idempotency_key,
      payload_hash
    ) VALUES (
      company.id,
      actor,
      'plan_next',
      p_idempotency_key,
      payload_hash
    ) RETURNING * INTO request;
  END IF;

  INSERT INTO public.festival_editions_v2(
    festival_company_id,
    edition_year,
    name,
    status,
    country_code,
    city_id,
    vibe,
    site_type,
    duration_days,
    environmental_policy,
    creation_source
  ) VALUES (
    company.id,
    edition_year,
    company.public_name,
    'draft',
    company.country_code,
    company.default_city_id,
    company.default_vibe,
    company.default_site_type,
    company.default_duration_days,
    company.environmental_policy,
    'next_annual'
  ) RETURNING * INTO edition;

  INSERT INTO public.festival_edition_audit(
    festival_company_id,
    festival_edition_id,
    actor_profile_id,
    event_type,
    new_version,
    metadata
  ) VALUES (
    company.id,
    edition.id,
    actor,
    'next_annual_edition_planned',
    edition.version,
    jsonb_build_object('editionYear', edition_year)
  );

  request.result := jsonb_build_object(
    'festivalCompanyId', company.id,
    'festivalEditionId', edition.id,
    'editionYear', edition_year,
    'status', 'draft',
    'idempotent', false
  );
  UPDATE public.festival_edition_creation_requests
  SET status = 'succeeded',
      festival_edition_id = edition.id,
      result = request.result,
      completed_at = now()
  WHERE id = request.id;
  RETURN request.result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_annual_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor)
     OR NOT EXISTS (
       SELECT 1 FROM public.festival_editions_v2 edition
       WHERE edition.id = p_festival_edition_id
         AND edition.festival_company_id = p_festival_company_id
     ) THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;
  result := public._festival_annual_plan_result(
    p_festival_company_id,
    p_festival_edition_id
  );
  IF result IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_festival_edition_annual_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_version integer,
  p_plan jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  edition public.festival_editions_v2%ROWTYPE;
  request public.festival_annual_plan_requests%ROWTYPE;
  city public.cities%ROWTYPE;
  scale public.festival_scale_catalogue%ROWTYPE;
  marketing public.festival_marketing_emphasis_catalogue%ROWTYPE;
  payload_hash text;
  start_date date;
  end_date date;
  duration integer;
  selected_month integer;
  city_id uuid;
  scale_key text;
  vibe_key text;
  site_key text;
  environmental_key text;
  marketing_key text;
  capacity integer;
  estimated_cost bigint;
  blockers jsonb;
  blocker_count integer;
  readiness integer;
  next_status text;
  effects jsonb;
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_edition_id::text || p_idempotency_key::text, 0)
  );

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id
  FOR UPDATE;

  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id
  FOR UPDATE;

  IF company.id IS NULL OR edition.id IS NULL
     OR NOT public._festival_company_manager_authorized(company.id, actor) THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF edition.status IN ('completed', 'cancelled') OR edition.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_locked' USING ERRCODE = 'P0001';
  END IF;

  payload_hash := encode(digest(jsonb_build_object(
    'editionId', p_festival_edition_id,
    'expectedVersion', p_expected_version,
    'plan', p_plan
  )::text, 'sha256'), 'hex');

  SELECT * INTO request
  FROM public.festival_annual_plan_requests
  WHERE festival_edition_id = p_festival_edition_id
    AND actor_profile_id = actor
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF request.payload_hash <> payload_hash THEN
      RAISE EXCEPTION 'festival_annual_plan_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF request.status = 'succeeded' THEN
      RETURN request.result;
    END IF;
  ELSE
    INSERT INTO public.festival_annual_plan_requests(
      festival_company_id,
      festival_edition_id,
      actor_profile_id,
      idempotency_key,
      payload_hash
    ) VALUES (
      company.id,
      edition.id,
      actor,
      p_idempotency_key,
      payload_hash
    ) RETURNING * INTO request;
  END IF;

  IF edition.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_annual_plan_stale' USING ERRCODE = 'P0001';
  END IF;

  start_date := nullif(p_plan->>'startsOn', '')::date;
  duration := nullif(p_plan->>'durationDays', '')::integer;
  selected_month := nullif(p_plan->>'preferredMonth', '')::integer;
  city_id := nullif(p_plan->>'cityId', '')::uuid;
  scale_key := nullif(p_plan->>'festivalScale', '');
  vibe_key := nullif(p_plan->>'vibe', '');
  site_key := nullif(p_plan->>'siteType', '');
  environmental_key := coalesce(nullif(p_plan->>'environmentalPolicy', ''), 'standard');
  marketing_key := nullif(p_plan->>'marketingEmphasis', '');

  IF start_date IS NULL OR duration IS NULL OR selected_month IS NULL
     OR city_id IS NULL OR scale_key IS NULL OR vibe_key IS NULL
     OR site_key IS NULL OR marketing_key IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF start_date < current_date
     OR selected_month NOT BETWEEN 1 AND 12
     OR extract(month FROM start_date)::integer <> selected_month THEN
    RAISE EXCEPTION 'festival_annual_plan_dates_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO city FROM public.cities WHERE id = city_id;
  SELECT * INTO scale FROM public.festival_scale_catalogue
    WHERE key = scale_key AND active;
  SELECT * INTO marketing FROM public.festival_marketing_emphasis_catalogue
    WHERE key = marketing_key AND active;

  IF city.id IS NULL OR scale.key IS NULL OR marketing.key IS NULL
     OR duration NOT BETWEEN 1 AND scale.maximum_duration_days
     OR NOT EXISTS (SELECT 1 FROM public.festival_vibe_catalogue WHERE key = vibe_key AND active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_site_type_catalogue WHERE key = site_key AND active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_environmental_policy_catalogue WHERE key = environmental_key AND active) THEN
    RAISE EXCEPTION 'festival_annual_plan_invalid' USING ERRCODE = 'P0001';
  END IF;

  end_date := start_date + (duration - 1);
  capacity := public._festival_annual_plan_capacity(company.id, scale.key);
  estimated_cost := public._festival_annual_plan_cost(
    company.id,
    scale.key,
    site_key,
    environmental_key,
    marketing.key,
    duration,
    capacity
  );

  effects := jsonb_build_object(
    'capacity', capacity,
    'estimatedOperatingCostMinor', estimated_cost,
    'marketingDemandBasisPoints', marketing.demand_basis_points,
    'marketingCostBasisPoints', marketing.cost_basis_points,
    'marketingReputationBasisPoints', marketing.reputation_basis_points,
    'localArtistBasisPoints', marketing.local_artist_basis_points,
    'capacityUpgradeProgress', public._festival_annual_plan_upgrade_progress(
      company.id,
      ARRAY['site_infrastructure', 'stages_production', 'audience_facilities', 'transport_access']
    ),
    'efficiencyUpgradeProgress', public._festival_annual_plan_upgrade_progress(
      company.id,
      ARRAY['site_infrastructure', 'sanitation_utilities', 'transport_access', 'sustainability_technology']
    )
  );

  UPDATE public.festival_editions_v2
  SET starts_on = start_date,
      ends_on = end_date,
      preferred_month = selected_month,
      city_id = city.id,
      country_code = city.country,
      site_type = site_key,
      festival_scale = scale.key,
      duration_days = duration,
      vibe = vibe_key,
      environmental_policy = environmental_key,
      marketing_emphasis = marketing.key,
      expected_capacity = capacity,
      estimated_operating_cost_minor = estimated_cost,
      planning_effects = effects,
      planning_status = 'in_progress',
      readiness_score = 0,
      planning_updated_at = now(),
      version = version + 1
  WHERE id = edition.id AND version = p_expected_version
  RETURNING * INTO edition;

  IF edition.id IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_stale' USING ERRCODE = 'P0001';
  END IF;

  blockers := public._festival_annual_plan_blockers(company.id, edition);
  blocker_count := jsonb_array_length(blockers);
  readiness := greatest(0, 100 - blocker_count * 25);
  next_status := CASE WHEN blocker_count = 0 THEN 'ready' ELSE 'in_progress' END;

  UPDATE public.festival_editions_v2
  SET readiness_score = readiness,
      planning_status = next_status
  WHERE id = edition.id
  RETURNING * INTO edition;

  INSERT INTO public.festival_edition_audit(
    festival_company_id,
    festival_edition_id,
    actor_profile_id,
    event_type,
    previous_version,
    new_version,
    metadata
  ) VALUES (
    company.id,
    edition.id,
    actor,
    'simplified_annual_plan_updated',
    p_expected_version,
    edition.version,
    jsonb_build_object(
      'startsOn', start_date,
      'endsOn', end_date,
      'cityId', city.id,
      'festivalScale', scale.key,
      'siteType', site_key,
      'vibe', vibe_key,
      'marketingEmphasis', marketing.key,
      'expectedCapacity', capacity,
      'estimatedOperatingCostMinor', estimated_cost,
      'readinessScore', readiness,
      'blockerCount', blocker_count
    )
  );

  response := public._festival_annual_plan_result(company.id, edition.id);
  UPDATE public.festival_annual_plan_requests
  SET status = 'succeeded', result = response, completed_at = now()
  WHERE id = request.id;

  RETURN response;
END;
$$;

CREATE OR REPLACE FUNCTION public._festival_projection_authorized(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_actor uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public._festival_company_manager_authorized(
    p_festival_company_id,
    p_actor
  ) AND EXISTS (
    SELECT 1
    FROM public.festival_editions_v2 edition
    WHERE edition.id = p_festival_edition_id
      AND edition.festival_company_id = p_festival_company_id
  )
$$;

REVOKE ALL ON FUNCTION public._festival_company_manager_authorized(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_licence_tier_json(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_licence_requirements(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_licence_tier_eligible(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_licence_progress_result(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._refresh_festival_company_edition_readiness(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_festival_licence_progress(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_festival_company_licence(uuid, text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_licence_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_festival_company_licence(uuid, text, integer, uuid) TO authenticated;

COMMENT ON FUNCTION public.apply_festival_company_licence(uuid, text, integer, uuid) IS
  'Manager-authorised, idempotent Festival licence application, upgrade or renewal charged from canonical company funds.';
COMMENT ON FUNCTION public._festival_company_manager_authorized(uuid, uuid) IS
  'Shared Festival authority boundary: owner, normal company manager or administrator.';

NOTIFY pgrst, 'reload schema';