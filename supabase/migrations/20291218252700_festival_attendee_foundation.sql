-- Festival attendee foundation.
-- Extends the modern festival ticketing system with one character-level
-- attendee lifecycle per festival edition. This is intentionally separate
-- from the legacy festival_attendance stage-presence table.

CREATE TABLE IF NOT EXISTS public.festival_player_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  admission_ticket_id uuid NOT NULL REFERENCES public.festival_issued_tickets(id),
  status text NOT NULL DEFAULT 'ticketed'
    CHECK (status IN (
      'ticketed',
      'ready_to_check_in',
      'attending',
      'left_early',
      'completed',
      'cancelled',
      'refunded'
    )),
  checked_in_at timestamptz,
  left_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_edition_id, profile_id),
  UNIQUE (admission_ticket_id)
);

CREATE INDEX IF NOT EXISTS festival_player_attendance_profile_status_idx
  ON public.festival_player_attendance(profile_id, status);

CREATE INDEX IF NOT EXISTS festival_player_attendance_edition_status_idx
  ON public.festival_player_attendance(festival_edition_id, status);

CREATE INDEX IF NOT EXISTS festival_player_attendance_launch_idx
  ON public.festival_player_attendance(festival_launch_id);

ALTER TABLE public.festival_player_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.festival_player_attendance FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS festival_player_attendance_own_read
  ON public.festival_player_attendance;

CREATE POLICY festival_player_attendance_own_read
  ON public.festival_player_attendance
  FOR SELECT
  TO authenticated
  USING (profile_id = public.current_profile_id());

CREATE OR REPLACE FUNCTION public._festival_create_player_attendance_from_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_product_class text;
  v_edition_id uuid;
BEGIN
  SELECT product.product_class, plan.festival_edition_id
    INTO v_product_class, v_edition_id
  FROM public.festival_ticket_products product
  JOIN public.festival_ticket_plans plan
    ON plan.id = product.festival_ticket_plan_id
  WHERE product.id = NEW.festival_ticket_product_id;

  IF NOT FOUND OR v_product_class <> 'admission' THEN
    RETURN NEW;
  END IF;

  IF v_edition_id IS NULL THEN
    RAISE EXCEPTION 'festival_attendance_edition_required' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status NOT IN ('valid', 'used') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.festival_player_attendance (
    festival_launch_id,
    festival_edition_id,
    profile_id,
    admission_ticket_id,
    status
  ) VALUES (
    NEW.festival_launch_id,
    v_edition_id,
    NEW.holder_profile_id,
    NEW.id,
    'ticketed'
  )
  ON CONFLICT (festival_edition_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_create_player_attendance_from_ticket()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_create_player_attendance_from_ticket()
  TO service_role;

DROP TRIGGER IF EXISTS festival_issued_ticket_create_player_attendance
  ON public.festival_issued_tickets;

CREATE TRIGGER festival_issued_ticket_create_player_attendance
AFTER INSERT ON public.festival_issued_tickets
FOR EACH ROW
EXECUTE FUNCTION public._festival_create_player_attendance_from_ticket();

-- Backfill environments that already have modern valid admission tickets.
INSERT INTO public.festival_player_attendance (
  festival_launch_id,
  festival_edition_id,
  profile_id,
  admission_ticket_id,
  status,
  created_at,
  updated_at
)
SELECT
  ticket.festival_launch_id,
  plan.festival_edition_id,
  ticket.holder_profile_id,
  ticket.id,
  'ticketed',
  ticket.issued_at,
  now()
FROM public.festival_issued_tickets ticket
JOIN public.festival_ticket_products product
  ON product.id = ticket.festival_ticket_product_id
JOIN public.festival_ticket_plans plan
  ON plan.id = product.festival_ticket_plan_id
WHERE product.product_class = 'admission'
  AND ticket.status IN ('valid', 'used')
  AND plan.festival_edition_id IS NOT NULL
ON CONFLICT (festival_edition_id, profile_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_festival_attendance()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', attendance.id,
        'festivalLaunchId', attendance.festival_launch_id,
        'festivalEditionId', attendance.festival_edition_id,
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
        'startsOn', edition.starts_on,
        'endsOn', edition.ends_on,
        'cityId', edition.city_id,
        'admissionTicketId', attendance.admission_ticket_id,
        'ticketReference', ticket.ticket_reference,
        'ticketType', product.ticket_type,
        'includesCamping', product.includes_camping,
        'includesVipArea', product.includes_vip_area,
        'status', attendance.status,
        'checkedInAt', attendance.checked_in_at,
        'leftAt', attendance.left_at,
        'completedAt', attendance.completed_at,
        'createdAt', attendance.created_at
      )
      ORDER BY edition.starts_on NULLS LAST, attendance.created_at
    ),
    '[]'::jsonb
  )
  FROM public.festival_player_attendance attendance
  JOIN public.festival_launches launch
    ON launch.id = attendance.festival_launch_id
  JOIN public.festival_editions_v2 edition
    ON edition.id = attendance.festival_edition_id
  JOIN public.festival_issued_tickets ticket
    ON ticket.id = attendance.admission_ticket_id
  JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  LEFT JOIN public.festival_public_profiles public_profile
    ON public_profile.festival_company_id = launch.festival_company_id
  WHERE attendance.profile_id = public.current_profile_id();
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_attendance() TO authenticated;

COMMENT ON TABLE public.festival_player_attendance IS
  'Authoritative character-level Festival attendee lifecycle for the simplified Festival system. Created from issued admission tickets; separate from legacy festival_attendance stage-presence rows.';

COMMENT ON FUNCTION public.get_my_festival_attendance() IS
  'Returns the signed-in active character''s Festival attendee records without exposing direct mutation of attendance state.';

COMMENT ON FUNCTION public._festival_create_player_attendance_from_ticket() IS
  'Creates one ticketed attendee record per character and Festival edition when a modern admission ticket is issued.';

NOTIFY pgrst, 'reload schema';
