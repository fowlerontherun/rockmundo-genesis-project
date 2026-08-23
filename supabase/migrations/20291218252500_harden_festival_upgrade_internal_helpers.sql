-- Upgrade helpers are implementation details behind manager-authorized RPCs.
-- Do not expose SECURITY DEFINER helpers directly through PostgREST.

REVOKE ALL ON FUNCTION public._festival_upgrade_state(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_upgrade_category_json(uuid, text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_upgrade_window(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_upgrade_authorised(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_activate_due_upgrades(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_company_balance_minor(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._festival_upgrade_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._festival_upgrade_category_json(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._festival_upgrade_window(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._festival_upgrade_authorised(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._festival_activate_due_upgrades(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._festival_company_balance_minor(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
