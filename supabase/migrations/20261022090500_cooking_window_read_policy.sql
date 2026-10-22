-- The timing catalogue is read-only and only exposes guidance for enabled recipes.
-- Removes RLS-without-policy advisory while retaining closed access to draft recipes.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='cooking_ingredient_cook_windows'
      and policyname='View cooking windows for active recipes'
  ) then
    create policy "View cooking windows for active recipes"
      on public.cooking_ingredient_cook_windows
      for select to authenticated
      using (exists (
        select 1 from public.cooking_recipe_ingredients ri
        join public.cooking_recipes r on r.slug=ri.recipe_slug
        where ri.ingredient_slug=cooking_ingredient_cook_windows.ingredient_slug
          and r.is_active
      ));
  end if;
end $$;
grant select on public.cooking_ingredient_cook_windows to authenticated;
revoke insert,update,delete on public.cooking_ingredient_cook_windows from authenticated,anon;
