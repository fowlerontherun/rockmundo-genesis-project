-- Make City Hall's festival_permit_required policy an authoritative Festival launch rule.
-- Permits are edition-scoped: owners apply, the host city's current mayor decides,
-- and the launch table itself refuses publication when the law effective for the
-- Festival date requires an approved permit.

CREATE TABLE IF NOT EXISTS public.city_festival_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  city_law_id uuid REFERENCES public.city_laws(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  application_note text CHECK (application_note IS NULL OR char_length(application_note) <= 2000),
  decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 2000),
  applied_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_by_mayor_id uuid REFERENCES public.city_mayors(id) ON DELETE SET NULL,
  application_idempotency_key uuid NOT NULL,
  decision_idempotency_key uuid,
  applied_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_company_id, applied_by_profile_id, application_idempotency_key),
  UNIQUE (decision_idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS city_festival_permits_one_open_per_edition
  ON public.city_festival_permits(festival_edition_id)
  WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS city_festival_permits_city_status
  ON public.city_festival_permits(city_id,status,applied_at DESC);
CREATE INDEX IF NOT EXISTS city_festival_permits_edition
  ON public.city_festival_permits(festival_edition_id,applied_at DESC);

ALTER TABLE public.city_festival_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_festival_permits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.city_festival_permits TO authenticated;
GRANT ALL ON public.city_festival_permits TO service_role;

DROP POLICY IF EXISTS city_festival_permits_authorized_read ON public.city_festival_permits;
CREATE POLICY city_festival_permits_authorized_read
ON public.city_festival_permits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.festival_companies fc
    WHERE fc.id = city_festival_permits.festival_company_id
      AND public._festival_company_manager_authorized(fc.id, public._caller_profile_id())
  )
  OR EXISTS (
    SELECT 1
    FROM public.city_mayors cm
    WHERE cm.city_id = city_festival_permits.city_id
      AND cm.profile_id = public._caller_profile_id()
      AND cm.is_current
  )
  OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
);

CREATE OR REPLACE FUNCTION public._festival_city_permit_edition(
  p_festival_company_id uuid
)
RETURNS public.festival_editions_v2
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  edition public.festival_editions_v2%ROWTYPE;
BEGIN
  SELECT e.* INTO edition
  FROM public.festival_configurations cfg
  JOIN public.festival_editions_v2 e ON e.id = cfg.festival_edition_id
  WHERE cfg.festival_company_id = p_festival_company_id
    AND e.status NOT IN ('completed','cancelled')
  LIMIT 1;

  IF edition.id IS NULL THEN
    SELECT e.* INTO edition
    FROM public.festival_editions_v2 e
    WHERE e.festival_company_id = p_festival_company_id
      AND e.status NOT IN ('completed','cancelled')
    ORDER BY e.starts_on NULLS LAST, e.edition_year DESC, e.created_at DESC
    LIMIT 1;
  END IF;

  RETURN edition;
END;
$$;

CREATE OR REPLACE FUNCTION public._festival_city_law_for_edition(
  p_festival_edition_id uuid
)
RETURNS public.city_laws
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  edition public.festival_editions_v2%ROWTYPE;
  law public.city_laws%ROWTYPE;
  effective_at timestamptz;
BEGIN
  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id;

  IF edition.id IS NULL OR edition.city_id IS NULL OR edition.starts_on IS NULL THEN
    RETURN law;
  END IF;

  effective_at := edition.starts_on::timestamptz;
  SELECT * INTO law
  FROM public.city_laws
  WHERE city_id = edition.city_id
    AND effective_from <= effective_at
    AND (effective_until IS NULL OR effective_until > effective_at)
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1;

  RETURN law;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_city_permit_status(
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
  edition public.festival_editions_v2%ROWTYPE;
  law public.city_laws%ROWTYPE;
  permit public.city_festival_permits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_permit_forbidden' USING ERRCODE='P0001';
  END IF;

  edition := public._festival_city_permit_edition(p_festival_company_id);
  IF edition.id IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_not_found' USING ERRCODE='P0001';
  END IF;

  law := public._festival_city_law_for_edition(edition.id);
  SELECT * INTO permit
  FROM public.city_festival_permits
  WHERE festival_edition_id = edition.id
  ORDER BY applied_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'festivalCompanyId', p_festival_company_id,
    'festivalEditionId', edition.id,
    'cityId', edition.city_id,
    'startsOn', edition.starts_on,
    'permitRequired', coalesce(law.festival_permit_required,false),
    'cityLawId', law.id,
    'permitId', permit.id,
    'status', CASE
      WHEN NOT coalesce(law.festival_permit_required,false) THEN 'not_required'
      WHEN permit.id IS NULL THEN 'not_applied'
      ELSE permit.status
    END,
    'applicationNote', permit.application_note,
    'decisionReason', permit.decision_reason,
    'appliedAt', permit.applied_at,
    'decidedAt', permit.decided_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_for_festival_city_permit(
  p_festival_company_id uuid,
  p_idempotency_key uuid,
  p_application_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  law public.city_laws%ROWTYPE;
  existing public.city_festival_permits%ROWTYPE;
  permit public.city_festival_permits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL OR p_idempotency_key IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_permit_forbidden' USING ERRCODE='P0001';
  END IF;
  IF p_application_note IS NOT NULL AND char_length(p_application_note) > 2000 THEN
    RAISE EXCEPTION 'festival_permit_application_invalid' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text || p_idempotency_key::text,0));
  edition := public._festival_city_permit_edition(p_festival_company_id);
  IF edition.id IS NULL OR edition.city_id IS NULL OR edition.starts_on IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_not_ready' USING ERRCODE='P0001';
  END IF;
  law := public._festival_city_law_for_edition(edition.id);

  SELECT * INTO existing
  FROM public.city_festival_permits
  WHERE festival_company_id = p_festival_company_id
    AND applied_by_profile_id = actor
    AND application_idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('permitId',existing.id,'festivalEditionId',existing.festival_edition_id,'cityId',existing.city_id,'status',existing.status,'idempotent',true);
  END IF;

  IF NOT coalesce(law.festival_permit_required,false) THEN
    RAISE EXCEPTION 'festival_permit_not_required' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.city_festival_permits
    WHERE festival_edition_id = edition.id AND status IN ('pending','approved')
  ) THEN
    RAISE EXCEPTION 'festival_permit_already_open' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.city_festival_permits(
    festival_edition_id,festival_company_id,city_id,city_law_id,status,
    application_note,applied_by_profile_id,application_idempotency_key
  ) VALUES (
    edition.id,p_festival_company_id,edition.city_id,law.id,'pending',
    nullif(btrim(p_application_note),''),actor,p_idempotency_key
  ) RETURNING * INTO permit;

  RETURN jsonb_build_object('permitId',permit.id,'festivalEditionId',edition.id,'cityId',edition.city_id,'status',permit.status,'idempotent',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_city_festival_permit_queue(
  p_city_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  is_mayor boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.city_mayors
    WHERE city_id=p_city_id AND profile_id=actor AND is_current
  ) INTO is_mayor;
  IF actor IS NULL OR (NOT is_mayor AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)) THEN
    RAISE EXCEPTION 'festival_permit_mayor_required' USING ERRCODE='P0001';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'permitId',p.id,
      'festivalEditionId',p.festival_edition_id,
      'festivalCompanyId',p.festival_company_id,
      'festivalName',e.name,
      'startsOn',e.starts_on,
      'endsOn',e.ends_on,
      'status',p.status,
      'applicationNote',p.application_note,
      'appliedAt',p.applied_at,
      'decisionReason',p.decision_reason,
      'decidedAt',p.decided_at
    ) ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,p.applied_at DESC)
    FROM public.city_festival_permits p
    JOIN public.festival_editions_v2 e ON e.id=p.festival_edition_id
    WHERE p.city_id=p_city_id
  ),'[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_city_festival_permit(
  p_permit_id uuid,
  p_decision text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  permit public.city_festival_permits%ROWTYPE;
  mayor public.city_mayors%ROWTYPE;
  decision text := lower(btrim(coalesce(p_decision,'')));
BEGIN
  IF actor IS NULL OR p_idempotency_key IS NULL OR decision NOT IN ('approved','rejected','revoked') THEN
    RAISE EXCEPTION 'festival_permit_decision_invalid' USING ERRCODE='P0001';
  END IF;
  IF decision IN ('rejected','revoked') AND length(btrim(coalesce(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'festival_permit_decision_reason_required' USING ERRCODE='P0001';
  END IF;
  IF char_length(coalesce(p_reason,'')) > 2000 THEN
    RAISE EXCEPTION 'festival_permit_decision_invalid' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO permit FROM public.city_festival_permits WHERE id=p_permit_id FOR UPDATE;
  IF permit.id IS NULL THEN RAISE EXCEPTION 'festival_permit_not_found' USING ERRCODE='P0001'; END IF;

  SELECT * INTO mayor
  FROM public.city_mayors
  WHERE city_id=permit.city_id AND profile_id=actor AND is_current
  LIMIT 1;
  IF mayor.id IS NULL AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'festival_permit_mayor_required' USING ERRCODE='P0001';
  END IF;

  IF permit.decision_idempotency_key = p_idempotency_key THEN
    RETURN jsonb_build_object('permitId',permit.id,'status',permit.status,'idempotent',true);
  END IF;
  IF decision IN ('approved','rejected') AND permit.status <> 'pending' THEN
    RAISE EXCEPTION 'festival_permit_already_decided' USING ERRCODE='P0001';
  END IF;
  IF decision='revoked' AND permit.status <> 'approved' THEN
    RAISE EXCEPTION 'festival_permit_not_approved' USING ERRCODE='P0001';
  END IF;

  UPDATE public.city_festival_permits
  SET status=decision,
      decision_reason=nullif(btrim(p_reason),''),
      reviewed_by_mayor_id=mayor.id,
      decision_idempotency_key=p_idempotency_key,
      decided_at=CASE WHEN decision IN ('approved','rejected') THEN now() ELSE decided_at END,
      revoked_at=CASE WHEN decision='revoked' THEN now() ELSE revoked_at END,
      updated_at=now()
  WHERE id=permit.id
  RETURNING * INTO permit;

  RETURN jsonb_build_object('permitId',permit.id,'status',permit.status,'idempotent',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_city_festival_permit_on_launch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  edition_id uuid;
  edition public.festival_editions_v2%ROWTYPE;
  law public.city_laws%ROWTYPE;
BEGIN
  IF NEW.launch_status NOT IN ('launched','tickets_on_sale') THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND OLD.launch_status IN ('launched','tickets_on_sale') THEN
    RETURN NEW;
  END IF;

  SELECT tp.festival_edition_id INTO edition_id
  FROM public.festival_timetable_plans tp
  WHERE tp.id=NEW.timetable_plan_id;
  IF edition_id IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_unresolved' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO edition FROM public.festival_editions_v2 WHERE id=edition_id;
  IF edition.city_id IS NULL OR edition.starts_on IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_not_ready' USING ERRCODE='P0001';
  END IF;

  law := public._festival_city_law_for_edition(edition.id);
  IF coalesce(law.festival_permit_required,false)
     AND NOT EXISTS (
       SELECT 1 FROM public.city_festival_permits p
       WHERE p.festival_edition_id=edition.id
         AND p.city_id=edition.city_id
         AND p.status='approved'
     ) THEN
    RAISE EXCEPTION 'festival_city_permit_required' USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_city_festival_permit_before_launch ON public.festival_launches;
CREATE TRIGGER enforce_city_festival_permit_before_launch
BEFORE INSERT OR UPDATE OF launch_status ON public.festival_launches
FOR EACH ROW EXECUTE FUNCTION public.enforce_city_festival_permit_on_launch();

REVOKE ALL ON FUNCTION public._festival_city_permit_edition(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public._festival_city_law_for_edition(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_festival_city_permit_status(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apply_for_festival_city_permit(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_city_festival_permit_queue(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.decide_city_festival_permit(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_city_permit_status(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_for_festival_city_permit(uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_city_festival_permit_queue(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.decide_city_festival_permit(uuid,text,text,uuid) TO authenticated,service_role;
