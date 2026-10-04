revoke execute on function public.process_company_weekly_finances() from public, anon, authenticated;
grant execute on function public.process_company_weekly_finances() to service_role;
