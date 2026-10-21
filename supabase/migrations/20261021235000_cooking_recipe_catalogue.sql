-- Server-owned cooking recipes; clients may read but cannot change outputs.
create table if not exists public.cooking_recipes (
  slug text primary key check (length(slug) between 1 and 100),
  name text not null,
  category text not null check (category in ('soups','baking','meals','drinks')),
  origin_region text not null,
  method text not null check (method in ('pan','oven','simmer','mix')),
  portions integer not null check (portions between 1 and 12),
  shelf_life_hours integer not null check (shelf_life_hours between 1 and 168),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.cooking_recipe_ingredients (
  recipe_slug text not null references public.cooking_recipes(slug) on delete cascade,
  ingredient_slug text not null check (length(ingredient_slug) between 1 and 100),
  units_required integer not null check (units_required between 1 and 100),
  primary key (recipe_slug, ingredient_slug)
);
alter table public.cooking_recipes enable row level security;
alter table public.cooking_recipe_ingredients enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_recipes' and policyname='View active cooking recipes') then
    create policy "View active cooking recipes" on public.cooking_recipes for select to authenticated using (is_active);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cooking_recipe_ingredients' and policyname='View ingredients of active recipes') then
    create policy "View ingredients of active recipes" on public.cooking_recipe_ingredients for select to authenticated
      using (exists (select 1 from public.cooking_recipes r where r.slug=recipe_slug and r.is_active));
  end if;
end $$;
revoke all on public.cooking_recipes, public.cooking_recipe_ingredients from anon, authenticated;
grant select on public.cooking_recipes, public.cooking_recipe_ingredients to authenticated;

-- Seed as inactive until reliable ingredient purchases and atomic completion exist.
insert into public.cooking_recipes (slug,name,category,origin_region,method,portions,shelf_life_hours,is_active) values
('vegetable-soup','Vegetable soup','soups','United Kingdom','simmer',3,48,false),
('onion-soup','Onion soup','soups','France','simmer',2,48,false),
('tomato-soup','Tomato soup','soups','Italy','simmer',3,48,false),
('lentil-stew','Spiced lentil stew','soups','India','simmer',3,48,false),
('apple-pie','Apple pie','baking','United Kingdom','oven',6,72,false),
('fruit-tart','Fruit tart','baking','France','oven',4,48,false),
('citrus-cake','Citrus cake','baking','Italy','oven',6,72,false),
('tea-cakes','Tea cakes','baking','Japan','oven',4,48,false),
('rice-bowl','Mushroom rice bowl','meals','Japan','pan',2,48,false),
('bean-stew','Bean and pepper stew','meals','Mexico','simmer',3,48,false),
('spiced-tea','Spiced tea','drinks','India','mix',2,24,false),
('fruit-drink','Tropical fruit drink','drinks','Brazil','mix',2,24,false)
on conflict (slug) do nothing;

insert into public.cooking_recipe_ingredients(recipe_slug,ingredient_slug,units_required) values
('vegetable-soup','carrot',1),('vegetable-soup','onion',1),('vegetable-soup','potato',1),('vegetable-soup','vegetable-stock',1),
('onion-soup','onion',1),('onion-soup','vegetable-stock',1),('onion-soup','butter',1),
('tomato-soup','tomato',1),('tomato-soup','basil',1),('tomato-soup','vegetable-stock',1),
('lentil-stew','lentils',1),('lentil-stew','spices',1),('lentil-stew','onion',1),
('apple-pie','apples',1),('apple-pie','flour',1),('apple-pie','butter',1),('apple-pie','sugar',1),
('fruit-tart','orchard-fruit',1),('fruit-tart','flour',1),('fruit-tart','butter',1),
('citrus-cake','citrus',1),('citrus-cake','flour',1),('citrus-cake','eggs',1),('citrus-cake','sugar',1),
('tea-cakes','rice-flour',1),('tea-cakes','tea',1),('tea-cakes','sugar',1),
('rice-bowl','rice',1),('rice-bowl','mushrooms',1),('rice-bowl','soy-seasoning',1),
('bean-stew','beans',1),('bean-stew','peppers',1),('bean-stew','maize',1),
('spiced-tea','tea',1),('spiced-tea','spices',1),('spiced-tea','milk',1),
('fruit-drink','tropical-fruit',1),('fruit-drink','water',1),('fruit-drink','sugar',1)
on conflict (recipe_slug,ingredient_slug) do nothing;
