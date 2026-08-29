-- Keep travel completion and travel inbox events scoped to the character that owns them.

CREATE OR REPLACE FUNCTION public.complete_travel_and_update_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NEW.profile_id IS NULL THEN
      RAISE WARNING 'Travel completion % has no profile_id; refusing account-wide location update', NEW.id;
      RETURN NEW;
    END IF;

    UPDATE public.profiles
    SET current_city_id = NEW.to_city_id,
        is_traveling = false,
        travel_arrives_at = NULL
    WHERE id = NEW.profile_id
      AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.scope_player_inbox_character_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_travel_history_id uuid;
BEGIN
  IF NEW.metadata IS NULL THEN
    NEW.metadata := '{}'::jsonb;
  END IF;

  IF NULLIF(NEW.metadata->>'profile_id', '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.related_entity_type = 'travel_timeline_event' AND NEW.related_entity_id IS NOT NULL THEN
    SELECT t.profile_id
      INTO v_profile_id
    FROM public.travel_timeline_events t
    WHERE t.id::text = NEW.related_entity_id::text
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND NULLIF(NEW.metadata->>'travel_history_id', '') IS NOT NULL THEN
    BEGIN
      v_travel_history_id := (NEW.metadata->>'travel_history_id')::uuid;
      SELECT h.profile_id
        INTO v_profile_id
      FROM public.player_travel_history h
      WHERE h.id = v_travel_history_id
      LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
      v_profile_id := NULL;
    END;
  END IF;

  IF v_profile_id IS NOT NULL THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('profile_id', v_profile_id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_scope_player_inbox_character_context ON public.player_inbox;
CREATE TRIGGER trg_scope_player_inbox_character_context
BEFORE INSERT OR UPDATE OF metadata, related_entity_type, related_entity_id
ON public.player_inbox
FOR EACH ROW
EXECUTE FUNCTION public.scope_player_inbox_character_context();

-- Backfill existing travel inbox rows so they stop leaking between characters.
WITH resolved AS (
  SELECT pi.id,
         COALESCE(tte.profile_id, pth.profile_id) AS profile_id
  FROM public.player_inbox pi
  LEFT JOIN public.travel_timeline_events tte
    ON pi.related_entity_type = 'travel_timeline_event'
   AND tte.id::text = pi.related_entity_id::text
  LEFT JOIN public.player_travel_history pth
    ON NULLIF(pi.metadata->>'travel_history_id', '') IS NOT NULL
   AND pth.id::text = pi.metadata->>'travel_history_id'
  WHERE COALESCE(pi.metadata->>'profile_id', '') = ''
    AND (pi.related_entity_type = 'travel_timeline_event' OR pi.metadata ? 'travel_history_id')
)
UPDATE public.player_inbox pi
SET metadata = COALESCE(pi.metadata, '{}'::jsonb) || jsonb_build_object('profile_id', r.profile_id)
FROM resolved r
WHERE pi.id = r.id
  AND r.profile_id IS NOT NULL;
