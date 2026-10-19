-- #4250 follow-up: block client-forged due activities and mutable reward fields.
-- All actual starts now use start_self_promotion() (including the legacy PR
-- panel), which performs the cost, cooldown and schedule writes transactionally.
-- Keep its existing business rules and make only the trusted RPC able to write.
ALTER FUNCTION public.start_self_promotion(uuid,uuid,text,text)
  SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.start_self_promotion(uuid,uuid,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_self_promotion(uuid,uuid,text,text)
  TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.self_promotion_activities
  FROM PUBLIC, anon, authenticated;
-- Existing SELECT RLS (user_id = auth.uid()) remains available to the app.
-- Scheduler/cron service_role and the SECURITY DEFINER start RPC retain writes.
