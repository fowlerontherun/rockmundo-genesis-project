-- Production-safe inbox character/account scope repair, 15 October 2026.
-- Preserve other users' privacy and multi-character isolation.
-- Does not alter read policies, delete messages, or manufacture event ownership.

CREATE OR REPLACE FUNCTION public.scope_player_inbox_character_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_travel_history_id uuid;
BEGIN
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  IF NULLIF(NEW.metadata->>'profile_id', '') IS NOT NULL
     OR NEW.metadata->>'scope' = 'account' THEN
    RETURN NEW;
  END IF;

  -- Bug reports and responses are account-level notices, including reports
  -- delivered to moderators rather than to the author of the report.
  IF NEW.related_entity_type IN ('bug_report', 'bug_report_response')
     AND NULLIF(NEW.metadata->>'bug_report_id', '') IS NOT NULL THEN
    NEW.metadata := NEW.metadata || '{"scope":"account"}'::jsonb;
    RETURN NEW;
  END IF;

  -- Authoritative player event owners take priority over any fallback.
  IF NEW.related_entity_type = 'player_event' AND NEW.related_entity_id IS NOT NULL THEN
    SELECT e.profile_id INTO v_profile_id
      FROM public.player_events e
     WHERE e.id = NEW.related_entity_id
       AND e.user_id = NEW.user_id
     LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND NEW.related_entity_type = 'random_event'
      AND NULLIF(NEW.metadata->>'player_event_id', '') IS NOT NULL THEN
    SELECT e.profile_id INTO v_profile_id
      FROM public.player_events e
     WHERE e.id::text = NEW.metadata->>'player_event_id'
       AND e.user_id = NEW.user_id
     LIMIT 1;
  END IF;

  -- Keep the existing travel-scoping behaviour.
  IF v_profile_id IS NULL AND NEW.related_entity_type = 'travel_timeline_event'
      AND NEW.related_entity_id IS NOT NULL THEN
    SELECT t.profile_id INTO v_profile_id
      FROM public.travel_timeline_events t
     WHERE t.id::text = NEW.related_entity_id::text
     LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND NULLIF(NEW.metadata->>'travel_history_id', '') IS NOT NULL THEN
    BEGIN
      v_travel_history_id := (NEW.metadata->>'travel_history_id')::uuid;
      SELECT h.profile_id INTO v_profile_id
        FROM public.player_travel_history h
       WHERE h.id = v_travel_history_id
       LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
      v_profile_id := NULL;
    END;
  END IF;

  -- Booking notices are character-scoped only when the session owner matches
  -- the message recipient. Do not tag bandmate notices with the booker's profile.
  IF v_profile_id IS NULL AND NEW.metadata->>'source' = 'recording_booking'
       AND NULLIF(NEW.metadata->>'session_id', '') IS NOT NULL THEN
    SELECT r.profile_id INTO v_profile_id
      FROM public.recording_sessions r
     WHERE r.id::text = NEW.metadata->>'session_id'
       AND r.user_id = NEW.user_id
     LIMIT 1;
  END IF;

  IF v_profile_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = v_profile_id AND p.user_id = NEW.user_id) THEN
    NEW.metadata := NEW.metadata || jsonb_build_object('profile_id', v_profile_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill known authoritative event recipients (no guessing between characters).
UPDATE public.player_inbox i
   SET metadata = COALESCE(i.metadata, '{}'::jsonb)
  FROM public.player_events e
 WHERE i.related_entity_type = 'player_event'
   AND i.related_entity_id = e.id
   AND e.user_id = i.user_id AND e.profile_id IS NOT NULL
   AND NULLIF(i.metadata->>'profile_id', '') IS NULL
   AND COALESCE(i.metadata->>'scope','') <> 'account';

UPDATE public.player_inbox i
   SET metadata = COALESCE(i.metadata, '{}'::jsonb)
  FROM public.player_events e
 WHERE i.related_entity_type = 'random_event'
   AND e.id::text = i.metadata->>'player_event_id'
   AND e.user_id = i.user_id AND e.profile_id IS NOT NULL
   AND NULLIF(i.metadata->>'profile_id', '') IS NULL
   AND COALESCE(i.metadata->>'scope','') <> 'account';

UPDATE public.player_inbox i
   SET metadata = COALESCE(i.metadata, '{}'::jsonb)
  FROM public.recording_sessions r
 WHERE i.metadata->>'source' = 'recording_booking'
   AND r.id::text = i.metadata->>'session_id'
   AND r.user_id = i.user_id AND r.profile_id IS NOT NULL
   AND NULLIF(i.metadata->>'profile_id', '') IS NULL
   AND COALESCE(i.metadata->>'scope','') <> 'account';

UPDATE public.player_inbox i
   SET metadata = COALESCE(i.metadata, '{}'::jsonb)
 WHERE i.related_entity_type IN ('bug_report','bug_report_response')
   AND NULLIF(i.metadata->>'bug_report_id', '') IS NOT NULL
   AND NULLIF(i.metadata->>'profile_id', '') IS NULL
   AND COALESCE(i.metadata->>'scope','') <> 'account';

-- Legacy rows from accounts which have had exactly one character can be
-- confidently assigned to that character; preserve multi-character ambiguity.
WITH unique_character AS (
  SELECT user_id, min(id::text)::uuid AS profile_id
    FROM public.profiles
   GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE public.player_inbox i
   SET metadata = COALESCE(i.metadata, '{}'::jsonb)
  FROM unique_character one
 WHERE i.user_id = one.user_id
   AND NULLIF(i.metadata->>'profile_id', '') IS NULL
   AND COALESCE(i.metadata->>'scope','') <> 'account';

NOTIFY pgrst, 'reload schema';
