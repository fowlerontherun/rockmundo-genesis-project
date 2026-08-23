-- Festival attendee check-in readiness and wristband memorabilia.
-- Adds a read-only eligibility contract and a festival-specific collectible
-- inventory that is populated only when authoritative attendance reaches
-- the attending state.

CREATE TABLE IF NOT EXISTS public.festival_player_memorabilia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('wristband')),
  item_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  rarity text NOT NULL DEFAULT 'common'
    CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendance_id, item_type),
  UNIQUE (profile_id, festival_edition_id, item_type)
);

CREATE INDEX IF NOT EXISTS festival_player_memorabilia_profile_idx
  ON public.festival_player_memorabilia(profile_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS festival_player_memorabilia_edition_idx
  ON public.festival_player_memorabilia(festival_edition_id);

ALTER TABLE public.festival_player_memorabilia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.festival_player_memorabilia FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS festival_player_memorabilia_own_read
  ON public.festival_player_memorabilia;

CREATE POLICY festival_player_memorabilia_own_read
  ON public.festival_player_memorabilia
  FOR SELECT
  TO authenticated
  USING (profile_id = public.current_profile_id());

CREATE OR REPLACE FUNCTION public._festival_issue_wristband_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_edition_name text;
  v_edition_year integer;
  v_ticket_type text;
BEGIN
  IF NEW.status <> 'attending' OR OLD.status = 'attending' THEN
    RETURN NEW;
  END IF;

  SELECT edition.name, edition.edition_year, product.ticket_type
    INTO v_edition_name, v_edition_year, v_ticket_type
  FROM public.festival_editions_v2 edition
  JOIN public.festival_issued_tickets ticket
    ON ticket.id = NEW.admission_ticket_id
  JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  WHERE edition.id = NEW.festival_edition_id;

  INSERT INTO public.festival_player_memorabilia (
    profile_id,
    festival_launch_id,
    festival_edition_id,
    attendance_id,
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
    'wristband',
    'festival_wristband:' || NEW.festival_edition_id::text,
    coalesce(v_edition_name, 'Festival') || ' ' || coalesce(v_edition_year::text, '') || ' Wristband',
    'A souvenir wristband proving this character checked in to the festival.',
    'common',
    jsonb_strip_nulls(jsonb_build_object(
      'festivalLaunchId', NEW.festival_launch_id,
      'festivalEditionId', NEW.festival_edition_id,
      'attendanceId', NEW.id,
      'ticketType', v_ticket_type,
      'checkedInAt', NEW.checked_in_at
    )),
    coalesce(NEW.checked_in_at, now())
  )
  ON CONFLICT (attendance_id, item_type) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_issue_wristband_on_attendance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_issue_wristband_on_attendance()
  TO service_role;

DROP TRIGGER IF EXISTS festival_attendance_issue_wristband
  ON public.festival_player_attendance;

CREATE TRIGGER festival_attendance_issue_wristband
AFTER UPDATE OF status ON public.festival_player_attendance
FOR EACH ROW
EXECUTE FUNCTION public._festival_issue_wristband_on_attendance();

-- Reconcile environments where an attendee had already checked in before this
-- memorabilia table was introduced.
INSERT INTO public.festival_player_memorabilia (
  profile_id,
  festival_launch_id,
  festival_edition_id,
  attendance_id,
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
  'wristband',
  'festival_wristband:' || attendance.festival_edition_id::text,
  coalesce(edition.name, 'Festival') || ' ' || coalesce(edition.edition_year::text, '') || ' Wristband',
  'A souvenir wristband proving this character checked in to the festival.',
  'common',
  jsonb_strip_nulls(jsonb_build_object(
    'festivalLaunchId', attendance.festival_launch_id,
    'festivalEditionId', attendance.festival_edition_id,
    'attendanceId', attendance.id,
    'ticketType', product.ticket_type,
    'checkedInAt', attendance.checked_in_at
  )),
  coalesce(attendance.checked_in_at, attendance.updated_at, now())
FROM public.festival_player_attendance attendance
JOIN public.festival_editions_v2 edition
  ON edition.id = attendance.festival_edition_id
JOIN public.festival_issued_tickets ticket
  ON ticket.id = attendance.admission_ticket_id
JOIN public.festival_ticket_products product
  ON product.id = ticket.festival_ticket_product_id
WHERE attendance.status IN ('attending', 'left_early', 'completed')
ON CONFLICT (attendance_id, item_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_festival_check_in_eligibility()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH eligibility AS (
    SELECT
      attendance.id AS attendance_id,
      attendance.festival_launch_id,
      attendance.festival_edition_id,
      attendance.status AS attendance_status,
      edition.starts_on,
      edition.ends_on,
      edition.city_id,
      city.name AS city_name,
      coalesce(nullif(city.timezone, ''), 'UTC') AS timezone,
      (now() AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date AS festival_local_date,
      profile.current_city_id,
      coalesce(profile.is_traveling, false) AS character_is_traveling,
      ticket.status AS ticket_status,
      launch.launch_status,
      edition.status AS edition_status,
      EXISTS (
        SELECT 1
        FROM public.festival_player_memorabilia memorabilia
        WHERE memorabilia.attendance_id = attendance.id
          AND memorabilia.item_type = 'wristband'
      ) AS wristband_issued,
      CASE
        WHEN attendance.status = 'attending' THEN 'already_attending'
        WHEN attendance.status IN ('left_early', 'completed', 'cancelled', 'refunded') THEN 'attendance_closed'
        WHEN attendance.status NOT IN ('ticketed', 'ready_to_check_in') THEN 'attendance_not_ready'
        WHEN ticket.status <> 'valid' THEN 'ticket_invalid'
        WHEN launch.launch_status = 'cancelled_before_event' OR edition.status = 'cancelled' THEN 'festival_cancelled'
        WHEN edition.starts_on IS NULL OR edition.ends_on IS NULL THEN 'festival_dates_unavailable'
        WHEN edition.city_id IS NULL THEN 'festival_city_unavailable'
        WHEN (now() AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date < edition.starts_on THEN 'festival_not_started'
        WHEN (now() AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date > edition.ends_on THEN 'festival_finished'
        WHEN coalesce(profile.is_traveling, false) THEN 'character_traveling'
        WHEN profile.current_city_id IS DISTINCT FROM edition.city_id THEN 'wrong_city'
        ELSE NULL
      END AS block_reason
    FROM public.festival_player_attendance attendance
    JOIN public.festival_editions_v2 edition
      ON edition.id = attendance.festival_edition_id
    JOIN public.festival_launches launch
      ON launch.id = attendance.festival_launch_id
    JOIN public.festival_issued_tickets ticket
      ON ticket.id = attendance.admission_ticket_id
    JOIN public.profiles profile
      ON profile.id = attendance.profile_id
    LEFT JOIN public.cities city
      ON city.id = edition.city_id
    WHERE attendance.profile_id = public.current_profile_id()
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attendanceId', eligibility.attendance_id,
        'festivalLaunchId', eligibility.festival_launch_id,
        'festivalEditionId', eligibility.festival_edition_id,
        'attendanceStatus', eligibility.attendance_status,
        'canCheckIn', eligibility.block_reason IS NULL,
        'blockReason', eligibility.block_reason,
        'startsOn', eligibility.starts_on,
        'endsOn', eligibility.ends_on,
        'cityId', eligibility.city_id,
        'cityName', eligibility.city_name,
        'timezone', eligibility.timezone,
        'festivalLocalDate', eligibility.festival_local_date,
        'currentCityId', eligibility.current_city_id,
        'characterIsTraveling', eligibility.character_is_traveling,
        'ticketStatus', eligibility.ticket_status,
        'launchStatus', eligibility.launch_status,
        'editionStatus', eligibility.edition_status,
        'wristbandIssued', eligibility.wristband_issued
      )
      ORDER BY eligibility.starts_on NULLS LAST, eligibility.attendance_id
    ),
    '[]'::jsonb
  )
  FROM eligibility;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_check_in_eligibility() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_check_in_eligibility() TO authenticated;

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
  WHERE memorabilia.profile_id = public.current_profile_id();
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_memorabilia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_memorabilia() TO authenticated;

COMMENT ON TABLE public.festival_player_memorabilia IS
  'Festival-specific character collectibles. Wristbands are issued automatically when authoritative attendance enters attending state.';

COMMENT ON FUNCTION public.get_my_festival_check_in_eligibility() IS
  'Returns server-authoritative check-in readiness for the active character, including festival-local date, location and ticket validity gates.';

COMMENT ON FUNCTION public.get_my_festival_memorabilia() IS
  'Returns festival collectibles owned by the active character for display in the existing inventory UI.';

COMMENT ON FUNCTION public._festival_issue_wristband_on_attendance() IS
  'Issues exactly one festival wristband collectible when an attendance lifecycle transitions into attending.';

NOTIFY pgrst, 'reload schema';
