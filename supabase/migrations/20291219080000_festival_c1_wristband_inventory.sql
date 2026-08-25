-- Festival attendee C1: admission-issued wristband inventory.
--
-- The earlier attendee foundation correctly creates one attendance lifecycle from
-- a valid modern admission ticket. The initial memorabilia slice waited until
-- check-in to issue a wristband, which does not satisfy the C1 contract: the
-- eligible wristband representation must exist as soon as authoritative
-- admission is issued. This migration keeps the existing memorabilia model but
-- binds each wristband directly to its admission ticket and issues it from the
-- canonical attendance creation boundary.

ALTER TABLE public.festival_player_memorabilia
  ADD COLUMN IF NOT EXISTS admission_ticket_id uuid
    REFERENCES public.festival_issued_tickets(id);

-- Every existing memorabilia row is already bound to an attendance row, and
-- attendance owns the authoritative admission ticket reference.
UPDATE public.festival_player_memorabilia memorabilia
SET admission_ticket_id = attendance.admission_ticket_id
FROM public.festival_player_attendance attendance
WHERE attendance.id = memorabilia.attendance_id
  AND memorabilia.admission_ticket_id IS NULL;

ALTER TABLE public.festival_player_memorabilia
  ALTER COLUMN admission_ticket_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS festival_player_memorabilia_ticket_item_uidx
  ON public.festival_player_memorabilia(admission_ticket_id, item_type);

-- Wristbands are no longer awarded by the check-in transition. Check-in still
-- consumes the admission ticket and can verify that the already-issued
-- wristband exists.
DROP TRIGGER IF EXISTS festival_attendance_issue_wristband
  ON public.festival_player_attendance;

CREATE OR REPLACE FUNCTION public._festival_issue_wristband_from_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_ticket_status public.festival_issued_tickets.status%TYPE;
  v_ticket_holder_profile_id public.festival_issued_tickets.holder_profile_id%TYPE;
  v_ticket_launch_id public.festival_issued_tickets.festival_launch_id%TYPE;
  v_ticket_reference public.festival_issued_tickets.ticket_reference%TYPE;
  v_ticket_issued_at public.festival_issued_tickets.issued_at%TYPE;
  v_product_class text;
  v_ticket_type text;
  v_product_edition_id uuid;
  v_edition_name text;
  v_edition_year integer;
BEGIN
  SELECT ticket.status,
         ticket.holder_profile_id,
         ticket.festival_launch_id,
         ticket.ticket_reference,
         ticket.issued_at,
         product.product_class,
         product.ticket_type,
         plan.festival_edition_id,
         edition.name,
         edition.edition_year
    INTO v_ticket_status,
         v_ticket_holder_profile_id,
         v_ticket_launch_id,
         v_ticket_reference,
         v_ticket_issued_at,
         v_product_class,
         v_ticket_type,
         v_product_edition_id,
         v_edition_name,
         v_edition_year
  FROM public.festival_issued_tickets ticket
  JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  JOIN public.festival_ticket_plans plan
    ON plan.id = product.festival_ticket_plan_id
  JOIN public.festival_editions_v2 edition
    ON edition.id = plan.festival_edition_id
  WHERE ticket.id = NEW.admission_ticket_id;

  IF NOT FOUND
     OR v_product_class <> 'admission'
     OR v_ticket_status NOT IN ('valid', 'used')
     OR v_ticket_holder_profile_id <> NEW.profile_id
     OR v_ticket_launch_id <> NEW.festival_launch_id
     OR v_product_edition_id IS DISTINCT FROM NEW.festival_edition_id THEN
    RAISE EXCEPTION 'festival_wristband_admission_mismatch' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_player_memorabilia (
    profile_id,
    festival_launch_id,
    festival_edition_id,
    attendance_id,
    admission_ticket_id,
    item_type,
    item_key,
    display_name,
    description,
    rarity,
    metadata,
    issued_at
  ) VALUES (
    NEW.profile_id,
    NEW.festival_launch_id,
    NEW.festival_edition_id,
    NEW.id,
    NEW.admission_ticket_id,
    'wristband',
    'festival_wristband:' || NEW.festival_edition_id::text,
    trim(coalesce(v_edition_name, 'Festival') || ' ' || coalesce(v_edition_year::text, '') || ' Wristband'),
    'A festival wristband issued with this character''s valid admission ticket.',
    'common',
    jsonb_strip_nulls(jsonb_build_object(
      'festivalLaunchId', NEW.festival_launch_id,
      'festivalEditionId', NEW.festival_edition_id,
      'attendanceId', NEW.id,
      'admissionTicketId', NEW.admission_ticket_id,
      'ticketReference', v_ticket_reference,
      'ticketType', v_ticket_type
    )),
    coalesce(v_ticket_issued_at, NEW.created_at, now())
  )
  ON CONFLICT (attendance_id, item_type) DO UPDATE
  SET admission_ticket_id = EXCLUDED.admission_ticket_id,
      metadata = EXCLUDED.metadata;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_issue_wristband_from_attendance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_issue_wristband_from_attendance()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_issue_wristband_on_ticket
  ON public.festival_player_attendance;

CREATE TRIGGER festival_attendance_issue_wristband_on_ticket
AFTER INSERT ON public.festival_player_attendance
FOR EACH ROW
EXECUTE FUNCTION public._festival_issue_wristband_from_attendance();

-- Reconcile all existing valid/used admission-backed attendee lifecycles,
-- including ticketed attendees who have not checked in yet. Add-ons cannot enter
-- this query because they never create festival_player_attendance and the
-- product class is revalidated here as defence in depth.
INSERT INTO public.festival_player_memorabilia (
  profile_id,
  festival_launch_id,
  festival_edition_id,
  attendance_id,
  admission_ticket_id,
  item_type,
  item_key,
  display_name,
  description,
  rarity,
  metadata,
  issued_at
)
SELECT
  attendance.profile_id,
  attendance.festival_launch_id,
  attendance.festival_edition_id,
  attendance.id,
  ticket.id,
  'wristband',
  'festival_wristband:' || attendance.festival_edition_id::text,
  trim(coalesce(edition.name, 'Festival') || ' ' || coalesce(edition.edition_year::text, '') || ' Wristband'),
  'A festival wristband issued with this character''s valid admission ticket.',
  'common',
  jsonb_strip_nulls(jsonb_build_object(
    'festivalLaunchId', attendance.festival_launch_id,
    'festivalEditionId', attendance.festival_edition_id,
    'attendanceId', attendance.id,
    'admissionTicketId', ticket.id,
    'ticketReference', ticket.ticket_reference,
    'ticketType', product.ticket_type
  )),
  coalesce(ticket.issued_at, attendance.created_at, now())
FROM public.festival_player_attendance attendance
JOIN public.festival_issued_tickets ticket
  ON ticket.id = attendance.admission_ticket_id
JOIN public.festival_ticket_products product
  ON product.id = ticket.festival_ticket_product_id
JOIN public.festival_ticket_plans plan
  ON plan.id = product.festival_ticket_plan_id
JOIN public.festival_editions_v2 edition
  ON edition.id = attendance.festival_edition_id
WHERE product.product_class = 'admission'
  AND ticket.status IN ('valid', 'used')
  AND plan.festival_edition_id = attendance.festival_edition_id
ON CONFLICT (attendance_id, item_type) DO UPDATE
SET admission_ticket_id = EXCLUDED.admission_ticket_id,
    metadata = EXCLUDED.metadata;

CREATE OR REPLACE FUNCTION public.get_my_festival_memorabilia()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', memorabilia.id,
        'festivalLaunchId', memorabilia.festival_launch_id,
        'festivalEditionId', memorabilia.festival_edition_id,
        'attendanceId', memorabilia.attendance_id,
        'admissionTicketId', memorabilia.admission_ticket_id,
        'ticketReference', ticket.ticket_reference,
        'ticketType', product.ticket_type,
        'festivalName', coalesce(
          edition.name,
          public_profile.public_name,
          launch.snapshot->>'name',
          'Festival'
        ),
        'festivalSlug', coalesce(
          launch.public_slug,
          public_profile.public_slug,
          ''
        ),
        'itemType', memorabilia.item_type,
        'itemKey', memorabilia.item_key,
        'displayName', memorabilia.display_name,
        'description', memorabilia.description,
        'rarity', memorabilia.rarity,
        'metadata', memorabilia.metadata,
        'issuedAt', memorabilia.issued_at
      )
      ORDER BY memorabilia.issued_at DESC, memorabilia.id
    ),
    '[]'::jsonb
  )
  FROM public.festival_player_memorabilia memorabilia
  JOIN public.festival_issued_tickets ticket
    ON ticket.id = memorabilia.admission_ticket_id
  JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  JOIN public.festival_editions_v2 edition
    ON edition.id = memorabilia.festival_edition_id
  JOIN public.festival_launches launch
    ON launch.id = memorabilia.festival_launch_id
  LEFT JOIN public.festival_public_profiles public_profile
    ON public_profile.festival_company_id = launch.festival_company_id
  WHERE memorabilia.profile_id = public.current_profile_id();
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_memorabilia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_memorabilia() TO authenticated;

COMMENT ON TABLE public.festival_player_memorabilia IS
  'Festival-specific character collectibles. C1 wristbands are issued exactly once from a valid authoritative admission-backed attendee lifecycle and link directly to the admission ticket and edition.';

COMMENT ON FUNCTION public._festival_issue_wristband_from_attendance() IS
  'Issues exactly one wristband when a valid admission ticket creates the canonical attendee lifecycle. Add-on products cannot create wristbands.';

COMMENT ON FUNCTION public.get_my_festival_memorabilia() IS
  'Returns the active character''s festival collectibles with their authoritative admission-ticket and edition references for inventory and ticket-wallet display.';

NOTIFY pgrst, 'reload schema';
