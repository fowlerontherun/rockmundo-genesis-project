-- Rehearses the exact guards in all four reset-time university migrations.
-- Keeps the production schema unchanged by always rolling back.
BEGIN;
DO $before$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.universities'::regclass
 AND tgname IN ('set_universities_updated_at','update_universities_updated_at')
 AND NOT tgisinternal)<>1 THEN RAISE EXCEPTION 'Expected one existing university timestamp trigger';END IF;
END $before$;
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;
DO $with_existing$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.universities'::regclass
 AND tgname IN ('set_universities_updated_at','update_universities_updated_at')
 AND NOT tgisinternal)<>1 THEN RAISE EXCEPTION 'Historical replay duplicated university timestamp trigger';END IF;
END $with_existing$;
SAVEPOINT no_timestamp_trigger;
DROP TRIGGER IF EXISTS update_universities_updated_at ON public.universities;
DROP TRIGGER IF EXISTS set_universities_updated_at ON public.universities;
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;
DO $without_existing$
BEGIN
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.universities'::regclass
 AND tgname IN ('set_universities_updated_at','update_universities_updated_at')
 AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.universities'::regclass
 AND tgname='set_universities_updated_at') THEN
 RAISE EXCEPTION 'Empty database replay did not install exactly one timestamp trigger';END IF;
 RAISE NOTICE 'University timestamp trigger replay passed with pre-existing and missing trigger';
END $without_existing$;
ROLLBACK TO SAVEPOINT no_timestamp_trigger;
ROLLBACK;