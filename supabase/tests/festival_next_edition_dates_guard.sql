-- Non-mutating production-compatible smoke checks after migration deployment.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE body text;
BEGIN
 IF to_regprocedure('public.plan_next_festival_edition(uuid,text)') IS NULL THEN
   RAISE EXCEPTION 'Missing browser next-edition RPC';
 END IF;
 IF to_regprocedure('public._festival_plan_edition(uuid,text,text)') IS NULL THEN
   RAISE EXCEPTION 'Missing next-edition implementation';
 END IF;
 SELECT pg_get_functiondef('public._festival_plan_edition(uuid,text,text)'::regprocedure) INTO body;
 IF position('festival_edition_already_open' IN body)=0 THEN
   RAISE EXCEPTION 'Missing single-open-edition guard';
 END IF;
 IF position('festival_company_not_ready' IN body)=0 THEN
   RAISE EXCEPTION 'Missing company readiness guard';
 END IF;
 IF position('''draft'',NULL,NULL' IN body)=0 THEN
   RAISE EXCEPTION 'New edition still inherits expired dates';
 END IF;
 IF position('v_fc.annual_month' IN body)=0 THEN
   RAISE EXCEPTION 'Annual month not carried forward';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.festival_editions_v2
   WHERE starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on < starts_on
 ) THEN RAISE EXCEPTION 'Invalid festival date range exists'; END IF;
END $$;
ROLLBACK;
