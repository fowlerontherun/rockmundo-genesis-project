-- Read-only regression for June 2026 company-owned job listings.
-- Generic paid jobs retain NULL company_id; company jobs must have an FK.
DO $verify_company_jobs$
DECLARE generic_jobs integer;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='jobs' AND column_name='company_id'
     AND data_type='uuid' AND is_nullable='YES'
 ) THEN
   RAISE EXCEPTION 'The jobs.company_id UUID relationship must remain nullable';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.jobs'::regclass
     AND conname='jobs_company_id_fkey'
     AND contype='f'
     AND confrelid='public.companies'::regclass
 ) THEN
   RAISE EXCEPTION 'Jobs company association FK is missing or invalid';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_indexes
   WHERE schemaname='public' AND tablename='jobs'
     AND indexname='idx_jobs_company_active'
 ) THEN
   RAISE EXCEPTION 'Missing active-company jobs index';
 END IF;
 SELECT count(*) INTO generic_jobs FROM public.jobs WHERE company_id IS NULL;
 IF generic_jobs=0 THEN
   RAISE EXCEPTION 'Legacy generic employment listings unexpectedly reassigned';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.jobs j
   LEFT JOIN public.companies c ON c.id=j.company_id
   WHERE j.company_id IS NOT NULL AND c.id IS NULL
 ) THEN
   RAISE EXCEPTION 'Orphan company-owned jobs detected';
 END IF;
END $verify_company_jobs$;
