-- Keep Festival projection read RPCs read-only.
-- Generated foundations are materialised when the annual plan changes, not every time
-- an owner opens Line-up or Tickets & budget. Re-running the materialiser during a GET
-- can mutate rows, refresh planning timestamps and cause avoidable locks/timeouts.

CREATE OR REPLACE FUNCTION public.get_festival_edition_site_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE actor uuid := public._caller_profile_id();
BEGIN
  IF auth.uid() IS NULL
     OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_site_plan_forbidden' USING ERRCODE='P0001';
  END IF;

  RETURN public._festival_edition_site_plan_result(
    p_festival_company_id,
    p_festival_edition_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_ticket_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE actor uuid := public._caller_profile_id();
BEGIN
  IF auth.uid() IS NULL
     OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_ticket_plan_forbidden' USING ERRCODE='P0001';
  END IF;

  RETURN public._festival_edition_ticket_plan_result(
    p_festival_company_id,
    p_festival_edition_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_artist_programme(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE actor uuid := public._caller_profile_id();
BEGIN
  IF auth.uid() IS NULL
     OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_programme_forbidden' USING ERRCODE='P0001';
  END IF;

  RETURN public._festival_edition_artist_programme_result(
    p_festival_company_id,
    p_festival_edition_id
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
