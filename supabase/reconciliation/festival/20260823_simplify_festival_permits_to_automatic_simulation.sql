-- Production-forward reconciliation for the simplified Festival permit contract.
-- Safe on production, where the manual City Hall permit subsystem may never have been installed.

DO $$
BEGIN
  IF to_regclass('public.festival_launches') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS enforce_city_festival_permit_before_launch ON public.festival_launches';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.get_festival_city_permit_status_for_edition(uuid);
DROP FUNCTION IF EXISTS public.apply_for_festival_city_permit_for_edition(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_festival_city_permit_status(uuid);
DROP FUNCTION IF EXISTS public.apply_for_festival_city_permit(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_city_festival_permit_queue(uuid);
DROP FUNCTION IF EXISTS public.decide_city_festival_permit(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.enforce_city_festival_permit_on_launch();
DROP FUNCTION IF EXISTS public._festival_city_permit_edition(uuid);

DO $$
BEGIN
  IF to_regclass('public.city_festival_permits') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.city_festival_permits FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.city_festival_permits TO service_role';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
