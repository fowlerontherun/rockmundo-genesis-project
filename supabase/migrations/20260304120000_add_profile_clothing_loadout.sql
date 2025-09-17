-- Add a clothing loadout column to profiles so we can track equipped apparel
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_clothing jsonb DEFAULT '{}'::jsonb;

-- Ensure existing rows have an object value
UPDATE public.profiles
SET equipped_clothing = '{}'::jsonb
WHERE equipped_clothing IS NULL;

-- Seed default clothing pieces for new wardrobes
INSERT INTO public.equipment_items (name, category, subcategory, price, rarity, stat_boosts, description, image_url)
SELECT 'White Trainers', 'clothing', 'footwear', 0, 'common', '{}'::jsonb,
       'Comfortable white trainers issued to every Rockmundo newcomer.', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.equipment_items WHERE name = 'White Trainers'
);

INSERT INTO public.equipment_items (name, category, subcategory, price, rarity, stat_boosts, description, image_url)
SELECT 'Black Jeans', 'clothing', 'bottoms', 0, 'common', '{}'::jsonb,
       'Dark denim built for long rehearsal nights and travel days.', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.equipment_items WHERE name = 'Black Jeans'
);

INSERT INTO public.equipment_items (name, category, subcategory, price, rarity, stat_boosts, description, image_url)
SELECT 'Rockmundo Logo Tee', 'clothing', 'top', 0, 'common', '{}'::jsonb,
       'Signature white tee printed with the Rockmundo lightning emblem.', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.equipment_items WHERE name = 'Rockmundo Logo Tee'
);
