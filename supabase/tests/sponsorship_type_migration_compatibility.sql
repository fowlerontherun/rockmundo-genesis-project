-- Read-only sponsorship migration-order verification. Safe on live DB and clean reset.
DO $verify$
DECLARE v_count integer;
BEGIN
 IF to_regclass('public.sponsorship_types') IS NULL THEN
  RAISE EXCEPTION 'sponsorship_types must exist after its April migration';
 END IF;
 IF to_regclass('public.sponsorship_offers') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conrelid='public.sponsorship_offers'::regclass
       AND confrelid='public.sponsorship_types'::regclass
       AND contype='f'
       AND conname='sponsorship_offers_sponsorship_type_id_fkey'
   ) THEN RAISE EXCEPTION 'Missing sponsorship offer type FK'; END IF;
 IF to_regclass('public.sponsorship_contracts') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM pg_constraint
     WHERE conrelid='public.sponsorship_contracts'::regclass
       AND confrelid='public.sponsorship_types'::regclass
       AND contype='f'
       AND conname='sponsorship_contracts_sponsorship_type_id_fkey'
   ) THEN RAISE EXCEPTION 'Missing sponsorship contract type FK'; END IF;
END $verify$;
