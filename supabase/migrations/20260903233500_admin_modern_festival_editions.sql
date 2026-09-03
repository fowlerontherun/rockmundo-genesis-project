-- Admin-only catalogue for modern simplified Festival editions.
-- Keeps the attendee diagnostics selector on festival_editions_v2 authority
-- instead of accidentally passing legacy festival_editions ids.

CREATE OR REPLACE FUNCTION public.admin_modern_festival_editions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'festival_attendee_admin_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'editionId', edition.id,
        'festivalCompanyId', edition.festival_company_id,
        'festivalName', company.public_name,
        'editionName', edition.name,
        'editionYear', edition.edition_year,
        'status', edition.status,
        'startsOn', edition.starts_on,
        'endsOn', edition.ends_on,
        'city', edition.city,
        'currencyCode', edition.currency_code
      )
      ORDER BY edition.starts_on DESC, edition.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.festival_editions_v2 edition
  JOIN public.festival_companies company
    ON company.id = edition.festival_company_id;

  RETURN v_rows;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_modern_festival_editions()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_modern_festival_editions()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_modern_festival_editions() IS
  'Admin-only modern simplified Festival edition catalogue for attendee diagnostics and recovery tooling.';

NOTIFY pgrst, 'reload schema';
