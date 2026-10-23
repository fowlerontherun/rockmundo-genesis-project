-- Explicit service-only read policies for release configuration and legal list.
-- Neither table exposes data or writes to anon/authenticated API roles.
create policy "Cooking stall controls service-only" on public.cooking_food_stall_controls
 for select to service_role using (true);
create policy "Cooking stall approvals service-only" on public.cooking_food_stall_approved_recipes
 for select to service_role using (true);
revoke all on public.cooking_food_stall_controls from public,anon,authenticated;
revoke all on public.cooking_food_stall_approved_recipes from public,anon,authenticated;
