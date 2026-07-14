
-- 1. Add exclusivity flag to equipment_items so blind-box gear is easy to filter and can never leak into normal shops
ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS is_blind_box_exclusive boolean NOT NULL DEFAULT false;

-- Backfill existing blind-box entries
UPDATE public.equipment_items
   SET is_blind_box_exclusive = true
 WHERE subcategory = 'blind_box';

CREATE INDEX IF NOT EXISTS idx_equipment_items_blind_box_exclusive
  ON public.equipment_items (is_blind_box_exclusive)
  WHERE is_blind_box_exclusive = true;

-- 2. Bump prices (2-3x) and assign monthly availability windows
-- Rotation cycles every 6 months across the 6 current boxes.

-- July 2026: Acoustic Folk (cash 5000)
UPDATE public.blind_boxes SET
  price_cash = 5000,
  available_from = '2026-07-01T00:00:00Z',
  available_until = '2026-08-01T00:00:00Z'
WHERE slug = 'acoustic-folk';

-- August 2026: Boom Bap Crate (cash 6500)
UPDATE public.blind_boxes SET
  price_cash = 6500,
  available_from = '2026-08-01T00:00:00Z',
  available_until = '2026-09-01T00:00:00Z'
WHERE slug = 'boom-bap-crate';

-- September 2026: EMG Metal Crate (cash 7500)
UPDATE public.blind_boxes SET
  price_cash = 7500,
  available_from = '2026-09-01T00:00:00Z',
  available_until = '2026-10-01T00:00:00Z'
WHERE slug = 'emg-metal-crate';

-- October 2026: Jazz Lounge (premium 175)
UPDATE public.blind_boxes SET
  price_premium = 175,
  available_from = '2026-10-01T00:00:00Z',
  available_until = '2026-11-01T00:00:00Z'
WHERE slug = 'jazz-lounge';

-- November 2026: Punk Rebel (cash 4500)
UPDATE public.blind_boxes SET
  price_cash = 4500,
  available_from = '2026-11-01T00:00:00Z',
  available_until = '2026-12-01T00:00:00Z'
WHERE slug = 'punk-rebel';

-- December 2026: Synthwave Neon (premium 150)
UPDATE public.blind_boxes SET
  price_premium = 150,
  available_from = '2026-12-01T00:00:00Z',
  available_until = '2027-01-01T00:00:00Z'
WHERE slug = 'synthwave-neon';
