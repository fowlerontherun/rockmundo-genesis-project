-- Explicit service-only RLS documentation for server-authoritative method timers.
-- Authenticated players still have no SELECT/INSERT/UPDATE/DELETE privileges,
-- and no recipe or market flags are activated by this migration.
create policy "Cooking timing rules readable only by service"
  on public.cooking_method_windows
  for select to service_role using (true);
