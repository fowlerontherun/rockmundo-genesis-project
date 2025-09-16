-- Create equipment upgrades table to support progressive gear improvements
CREATE TABLE IF NOT EXISTS public.equipment_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  tier integer NOT NULL,
  cost integer NOT NULL,
  stat_boosts jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (equipment_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_equipment_upgrades_equipment_id ON public.equipment_upgrades(equipment_id);

ALTER TABLE public.player_equipment
  ADD COLUMN IF NOT EXISTS upgrade_level integer DEFAULT 0;

UPDATE public.player_equipment
SET upgrade_level = COALESCE(upgrade_level, 0);

ALTER TABLE public.player_equipment
  ALTER COLUMN upgrade_level SET DEFAULT 0;

ALTER TABLE public.player_equipment
  ALTER COLUMN upgrade_level SET NOT NULL;

ALTER TABLE public.equipment_upgrades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipment upgrades are viewable by everyone"
  ON public.equipment_upgrades
  FOR SELECT
  USING (true);

-- Insert default upgrade tiers for existing equipment
INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(120, CEIL(price * 0.35)::int),
       jsonb_build_object('performance', 2),
       'Reinforced strings improve reliability and tone.'
FROM public.equipment_items
WHERE name = 'Acoustic Guitar';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(200, CEIL(price * 0.55)::int),
       jsonb_build_object('performance', 3),
       'Premium tonewoods add richer resonance on stage.'
FROM public.equipment_items
WHERE name = 'Acoustic Guitar';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(280, CEIL(price * 0.35)::int),
       jsonb_build_object('guitar', 4, 'performance', 2),
       'Enhanced pickups provide a tighter live mix.'
FROM public.equipment_items
WHERE name = 'Electric Guitar Starter';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(450, CEIL(price * 0.6)::int),
       jsonb_build_object('guitar', 5, 'performance', 3),
       'Professional setup unlocks extra clarity and sustain.'
FROM public.equipment_items
WHERE name = 'Electric Guitar Starter';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(750, CEIL(price * 0.35)::int),
       jsonb_build_object('guitar', 6, 'performance', 3),
       'Custom wiring delivers studio-grade articulation.'
FROM public.equipment_items
WHERE name = 'Gibson Les Paul';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(1100, CEIL(price * 0.55)::int),
       jsonb_build_object('guitar', 7, 'performance', 4),
       'Hand-leveled frets and premium hardware boost playability.'
FROM public.equipment_items
WHERE name = 'Gibson Les Paul';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(950, CEIL(price * 0.35)::int),
       jsonb_build_object('guitar', 7, 'performance', 4),
       'Active circuitry sharpens tone for arena stages.'
FROM public.equipment_items
WHERE name = 'Fender Stratocaster';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(1400, CEIL(price * 0.55)::int),
       jsonb_build_object('guitar', 8, 'performance', 5),
       'Signature pickups broaden your sonic palette.'
FROM public.equipment_items
WHERE name = 'Fender Stratocaster';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(70, CEIL(price * 0.4)::int),
       jsonb_build_object('vocals', 3),
       'Upgraded capsule gives clearer vocal capture.'
FROM public.equipment_items
WHERE name = 'Shure SM58';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(110, CEIL(price * 0.65)::int),
       jsonb_build_object('vocals', 4),
       'Studio-grade wiring reduces handling noise live.'
FROM public.equipment_items
WHERE name = 'Shure SM58';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(220, CEIL(price * 0.35)::int),
       jsonb_build_object('vocals', 5, 'songwriting', 3),
       'Precision diaphragm upgrade increases vocal warmth.'
FROM public.equipment_items
WHERE name = 'Condenser Mic Pro';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(360, CEIL(price * 0.55)::int),
       jsonb_build_object('vocals', 6, 'songwriting', 4),
       'Isolated circuitry reduces studio noise and inspires creativity.'
FROM public.equipment_items
WHERE name = 'Condenser Mic Pro';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(850, CEIL(price * 0.35)::int),
       jsonb_build_object('vocals', 8, 'songwriting', 5),
       'Mastering-grade capsule enhances harmonic detail.'
FROM public.equipment_items
WHERE name = 'Neumann U87';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(1150, CEIL(price * 0.55)::int),
       jsonb_build_object('vocals', 9, 'songwriting', 6),
       'Hand-wired components unlock iconic studio presence.'
FROM public.equipment_items
WHERE name = 'Neumann U87';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(55, CEIL(price * 0.45)::int),
       jsonb_build_object('songwriting', 2),
       'High-fidelity drivers expand your creative range.'
FROM public.equipment_items
WHERE name = 'Studio Headphones';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(80, CEIL(price * 0.65)::int),
       jsonb_build_object('songwriting', 3),
       'Balanced tuning improves arrangement clarity.'
FROM public.equipment_items
WHERE name = 'Studio Headphones';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(220, CEIL(price * 0.35)::int),
       jsonb_build_object('songwriting', 4),
       'Acoustic treatment kit sharpens your mixing decisions.'
FROM public.equipment_items
WHERE name = 'Studio Monitors';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(360, CEIL(price * 0.55)::int),
       jsonb_build_object('songwriting', 5),
       'Precision calibration delivers pristine monitoring.'
FROM public.equipment_items
WHERE name = 'Studio Monitors';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(520, CEIL(price * 0.35)::int),
       jsonb_build_object('songwriting', 6),
       'Low-noise preamps capture every creative nuance.'
FROM public.equipment_items
WHERE name = 'Audio Interface Pro';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(780, CEIL(price * 0.55)::int),
       jsonb_build_object('songwriting', 7),
       'High-headroom converters elevate studio polish.'
FROM public.equipment_items
WHERE name = 'Audio Interface Pro';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(110, CEIL(price * 0.45)::int),
       jsonb_build_object('performance', 3),
       'Stage tailoring increases presence and comfort.'
FROM public.equipment_items
WHERE name = 'Leather Jacket';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(160, CEIL(price * 0.65)::int),
       jsonb_build_object('performance', 4),
       'Custom lining enhances movement for high-energy shows.'
FROM public.equipment_items
WHERE name = 'Leather Jacket';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(80, CEIL(price * 0.45)::int),
       jsonb_build_object('performance', 2),
       'Shock-absorbing soles keep your timing sharp.'
FROM public.equipment_items
WHERE name = 'Stage Boots';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(110, CEIL(price * 0.65)::int),
       jsonb_build_object('performance', 3),
       'Precision fit supports dramatic stage moves.'
FROM public.equipment_items
WHERE name = 'Stage Boots';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 1, GREATEST(35, CEIL(price * 0.45)::int),
       jsonb_build_object('performance', 1),
       'Premium print elevates your visual brand.'
FROM public.equipment_items
WHERE name = 'Custom Band T-Shirt';

INSERT INTO public.equipment_upgrades (equipment_id, tier, cost, stat_boosts, description)
SELECT id, 2, GREATEST(55, CEIL(price * 0.65)::int),
       jsonb_build_object('performance', 2),
       'Limited edition styling amps up fan engagement.'
FROM public.equipment_items
WHERE name = 'Custom Band T-Shirt';
