-- Regional markets foundation. This does not mint items for any player.
CREATE TABLE IF NOT EXISTS public.cooking_market_ingredients (
  slug text PRIMARY KEY REFERENCES public.cooking_ingredient_cook_windows(ingredient_slug),
  display_name text NOT NULL,
  base_price integer NOT NULL CHECK (base_price BETWEEN 1 AND 10000),
  shelf_life_hours integer NOT NULL CHECK (shelf_life_hours BETWEEN 2 AND 336),
  origin_countries text[] NOT NULL DEFAULT '{}'::text[],
  is_staple boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cooking_city_markets (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id) ON DELETE CASCADE,
  upgrade_level integer NOT NULL DEFAULT 1 CHECK (upgrade_level BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cooking_market_stock (
  city_id uuid NOT NULL REFERENCES public.cooking_city_markets(city_id) ON DELETE CASCADE,
  ingredient_slug text NOT NULL REFERENCES public.cooking_market_ingredients(slug),
  quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 100000),
  max_quantity integer NOT NULL CHECK (max_quantity BETWEEN 1 AND 100000),
  unit_price integer NOT NULL CHECK (unit_price BETWEEN 1 AND 100000),
  quality integer NOT NULL CHECK (quality BETWEEN 1 AND 100),
  stocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(city_id,ingredient_slug),
  CONSTRAINT cooking_market_stock_expiry_valid CHECK (expires_at > stocked_at),
  CONSTRAINT cooking_market_stock_capacity CHECK (quantity <= max_quantity)
);
CREATE INDEX IF NOT EXISTS cooking_market_stock_by_expiry
  ON public.cooking_market_stock(expires_at,city_id);
CREATE TABLE IF NOT EXISTS public.cooking_market_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id),
  ingredient_slug text NOT NULL REFERENCES public.cooking_market_ingredients(slug),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  unit_price integer NOT NULL CHECK (unit_price BETWEEN 1 AND 100000),
  total_cash bigint NOT NULL CHECK (total_cash >= 1),
  quality integer NOT NULL CHECK (quality BETWEEN 1 AND 100),
  ingredient_lot_id uuid NOT NULL UNIQUE REFERENCES public.cooking_ingredient_lots(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cooking_market_purchases_by_profile
  ON public.cooking_market_purchases(profile_id,created_at DESC);

ALTER TABLE public.cooking_market_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_city_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_market_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_market_purchases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cooking_market_ingredients' AND policyname='Browse cooking market catalogue') THEN
   CREATE POLICY "Browse cooking market catalogue" ON public.cooking_market_ingredients
     FOR SELECT TO authenticated USING (true);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cooking_city_markets' AND policyname='Browse city cooking markets') THEN
   CREATE POLICY "Browse city cooking markets" ON public.cooking_city_markets
     FOR SELECT TO authenticated USING (true);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cooking_market_stock' AND policyname='Browse regional ingredient stock') THEN
   CREATE POLICY "Browse regional ingredient stock" ON public.cooking_market_stock
     FOR SELECT TO authenticated USING (true);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cooking_market_purchases' AND policyname='View own ingredient purchases') THEN
   CREATE POLICY "View own ingredient purchases" ON public.cooking_market_purchases
     FOR SELECT TO authenticated USING (
       EXISTS (SELECT 1 FROM public.profiles p
         WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid()))
     );
 END IF;
END $$;
REVOKE ALL ON public.cooking_market_ingredients,public.cooking_city_markets,
  public.cooking_market_stock,public.cooking_market_purchases FROM anon,authenticated;
GRANT SELECT ON public.cooking_market_ingredients,public.cooking_city_markets,
  public.cooking_market_stock,public.cooking_market_purchases TO authenticated;

-- Initial legal culinary stock. Every ingredient originates in existing recipes.
-- Staple items are produced everywhere; countries add higher-quality local foods.
INSERT INTO public.cooking_market_ingredients
  (slug,display_name,base_price,shelf_life_hours,origin_countries,is_staple)
VALUES
 ('apples','Apples',9,96,ARRAY['United Kingdom','France'],false),
 ('basil','Fresh basil',8,72,ARRAY['Italy'],false),
 ('beans','Beans',8,120,ARRAY['Mexico','Brazil'],false),
 ('butter','Butter',10,120,ARRAY['France','United Kingdom'],true),
 ('carrot','Carrots',5,120,ARRAY['United Kingdom','France'],true),
 ('citrus','Citrus fruit',10,96,ARRAY['Italy','Brazil'],false),
 ('eggs','Eggs',8,96,ARRAY['United Kingdom','France'],true),
 ('flour','Flour',5,240,ARRAY[]::text[],true),
 ('lentils','Lentils',7,144,ARRAY['India'],false),
 ('maize','Maize',6,144,ARRAY['Mexico','Brazil'],false),
 ('milk','Milk',7,72,ARRAY['United Kingdom','France'],true),
 ('mushrooms','Mushrooms',9,72,ARRAY['Japan','France'],false),
 ('onion','Onions',5,144,ARRAY[]::text[],true),
 ('orchard-fruit','Orchard fruit',10,96,ARRAY['France','United Kingdom'],false),
 ('peppers','Peppers',8,96,ARRAY['Mexico','India'],false),
 ('potato','Potatoes',6,144,ARRAY['United Kingdom'],true),
 ('rice','Rice',6,240,ARRAY['Japan','India'],true),
 ('rice-flour','Rice flour',8,240,ARRAY['Japan'],false),
 ('soy-seasoning','Soy seasoning',9,240,ARRAY['Japan'],false),
 ('spices','Spices',10,240,ARRAY['India'],false),
 ('sugar','Sugar',5,240,ARRAY[]::text[],true),
 ('tea','Tea',7,240,ARRAY['India','Japan'],false),
 ('tomato','Tomatoes',7,96,ARRAY['Italy'],false),
 ('tropical-fruit','Tropical fruit',12,72,ARRAY['Brazil'],false),
 ('vegetable-stock','Vegetable stock',6,120,ARRAY[]::text[],true),
 ('water','Water',2,240,ARRAY[]::text[],true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.cooking_city_markets(city_id)
SELECT id FROM public.cities ON CONFLICT (city_id) DO NOTHING;

-- City variation uses a stable deterministic selection. Regional produce is
-- always stocked in its home country, staples everywhere, imports in a subset.
INSERT INTO public.cooking_market_stock
  (city_id,ingredient_slug,quantity,max_quantity,unit_price,quality,stocked_at,expires_at)
SELECT c.id,i.slug,
  CASE WHEN c.country=ANY(i.origin_countries) THEN 36
       WHEN i.is_staple THEN 24 ELSE 10 END,
  CASE WHEN c.country=ANY(i.origin_countries) THEN 36
       WHEN i.is_staple THEN 24 ELSE 10 END,
  CASE WHEN c.country=ANY(i.origin_countries) THEN greatest(1,i.base_price-2)
       WHEN i.is_staple THEN i.base_price ELSE i.base_price+4 END,
  least(95,50+(CASE WHEN c.country=ANY(i.origin_countries) THEN 24 ELSE 0 END)
    + ascii(substr(md5(c.id::text||':'||i.slug),2,1)) % 14),
  clock_timestamp(),clock_timestamp()+interval '7 days'
FROM public.cities c CROSS JOIN public.cooking_market_ingredients i
WHERE i.is_staple OR c.country=ANY(i.origin_countries)
  OR (ascii(substr(md5(c.id::text||':'||i.slug),1,1)) % 5 = 0)
ON CONFLICT (city_id,ingredient_slug) DO NOTHING;
