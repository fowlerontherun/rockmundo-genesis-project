-- Raise AI music quota from 5 to 8 per rolling seven-day period.
-- There are TWO independent quota paths: visible preflight and atomic
-- reservation; keep them consistent or generation fails at reservation.
-- Preserve live functions, owners and existing ACLs exactly.
DO $migration$
DECLARE
  preflight text;
  reservation text;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('public.check_song_generation_limit(uuid)'))
    INTO preflight;
  SELECT pg_get_functiondef(to_regprocedure(
    'public.reserve_song_generation_atomic(uuid,uuid,boolean,uuid,boolean)'))
    INTO reservation;
  IF preflight IS NULL OR reservation IS NULL THEN
    RAISE EXCEPTION 'AI generation quota functions missing';
  END IF;

  IF position('v_limit INTEGER := 5;' in preflight) > 0 THEN
    EXECUTE replace(preflight, 'v_limit INTEGER := 5;', 'v_limit INTEGER := 8;');
  ELSIF position('v_limit INTEGER := 8;' in preflight) = 0 THEN
    RAISE EXCEPTION 'Unexpected quota preflight function; refused to replace';
  END IF;

  IF position('v_limit integer := 5;' in reservation) > 0 THEN
    EXECUTE replace(reservation, 'v_limit integer := 5;', 'v_limit integer := 8;');
  ELSIF position('v_limit integer := 8;' in reservation) = 0 THEN
    RAISE EXCEPTION 'Unexpected atomic quota reservation function; refused to replace';
  END IF;
END;
$migration$;
