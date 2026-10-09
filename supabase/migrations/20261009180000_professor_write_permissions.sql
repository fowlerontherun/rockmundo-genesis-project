-- Security: professor catalogue is readable, but residency assignment is server-owned.
REVOKE INSERT, UPDATE, DELETE ON public.travelling_professors FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.professor_residencies FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.professor_skill_memberships FROM anon, authenticated;

-- Monthly and daily jobs are installed only when pg_cron exists.
-- On deployments without pg_cron, operators must invoke the service RPC
-- and announcement RPC using their trusted scheduler.
