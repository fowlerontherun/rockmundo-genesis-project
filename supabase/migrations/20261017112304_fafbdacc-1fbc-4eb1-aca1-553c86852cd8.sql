REVOKE EXECUTE ON FUNCTION public.is_band_finance_viewer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_band_finance_permission(uuid, uuid, public.band_finance_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_band_finance_viewer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_band_finance_permission(uuid, uuid, public.band_finance_permission) TO authenticated, service_role;