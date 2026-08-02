\set ON_ERROR_STOP on
SELECT * FROM public.festival_upgrade_migration_summary ORDER BY version;
SELECT u.festival_company_id,u.category_key,u.catalogue_version,u.owned_level,u.active_level,u.status
FROM public.festival_company_upgrades u WHERE u.catalogue_version<>2 OR u.owned_level NOT BETWEEN 1 AND 50 OR u.active_level NOT BETWEEN 0 AND u.owned_level;
DO $$BEGIN IF EXISTS(SELECT 1 FROM public.festival_company_upgrades u WHERE u.catalogue_version<>2 OR u.owned_level NOT BETWEEN 1 AND 50 OR u.active_level NOT BETWEEN 0 AND u.owned_level) THEN RAISE EXCEPTION 'invalid mutable Festival v2 ownership';END IF;END$$;
