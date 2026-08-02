\set ON_ERROR_STOP on
\echo 'Festival upgrade v2 pre-deployment ownership diagnostic'
SELECT u.festival_company_id,u.category_key,u.catalogue_version,u.owned_level,u.active_level,u.status
FROM public.festival_company_upgrades u
WHERE u.catalogue_version<>1 OR u.owned_level NOT BETWEEN 1 AND 5 OR u.active_level NOT BETWEEN 0 AND u.owned_level
ORDER BY u.festival_company_id,u.category_key;
DO $$BEGIN IF EXISTS(SELECT 1 FROM public.festival_company_upgrades u WHERE u.catalogue_version<>1 OR u.owned_level NOT BETWEEN 1 AND 5 OR u.active_level NOT BETWEEN 0 AND u.owned_level) THEN RAISE EXCEPTION 'manual Festival ownership remediation required; no values were changed';END IF;END$$;
