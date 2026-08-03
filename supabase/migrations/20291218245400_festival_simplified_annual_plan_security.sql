-- Explicit security boundary for the simplified annual Festival read models.
-- CREATE OR REPLACE preserves historic privileges, so restate the intended grants
-- after replacing get_festival_company_editions in the preceding migration.

REVOKE ALL ON FUNCTION public.get_festival_company_editions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_festival_edition_annual_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_festival_edition_annual_plan(uuid, uuid, integer, jsonb, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_festival_company_editions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_annual_plan(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_edition_annual_plan(uuid, uuid, integer, jsonb, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
