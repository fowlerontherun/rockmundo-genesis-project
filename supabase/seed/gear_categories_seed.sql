-- Seed canonical gear categories and ensure equipment items are linked
INSERT INTO public.gear_categories (slug, label, description, sort_order)
VALUES
  ('guitar', 'Guitars', 'Electric, acoustic, and specialty guitars.', 10),
  ('microphone', 'Microphones', 'Dynamic and condenser mics for stage and studio.', 20),
  ('audio', 'Audio & Studio', 'Interfaces, monitors, and production essentials.', 30),
  ('clothing', 'Stagewear', 'Looks that boost stage presence.', 40),
  ('lighting', 'Lighting & Visuals', 'Lighting rigs and visual production kits.', 50),
  ('backline', 'Backline', 'Amps, drums, and core backline rentals.', 60)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- Backfill items that rely on the legacy category column
UPDATE public.equipment_items ei
SET gear_category_id = gc.id
FROM public.gear_categories gc
WHERE gc.slug = ei.category
  AND (ei.gear_category_id IS DISTINCT FROM gc.id OR ei.gear_category_id IS NULL);

-- Ensure currency defaults are populated for any legacy rows
UPDATE public.equipment_items
SET price_cash = COALESCE(price_cash, price),
    price_fame = COALESCE(price_fame, 0)
WHERE price_cash IS NULL OR price_fame IS NULL;
