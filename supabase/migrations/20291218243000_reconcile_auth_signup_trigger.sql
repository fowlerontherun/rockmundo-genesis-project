-- Ensure existing deployments finish with exactly one signup trigger bound to
-- the latest public.handle_new_user() implementation.
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'handle_new_user_missing_before_final_auth_trigger_reconciliation';
  END IF;
END
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();