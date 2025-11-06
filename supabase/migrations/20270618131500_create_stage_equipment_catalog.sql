-- Stage equipment catalog for admin-managed offerings
CREATE TABLE IF NOT EXISTS public.stage_equipment_catalog (
  id TEXT PRIMARY KEY DEFAULT concat('catalog-', substring(gen_random_uuid()::text, 1, 8)),
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  live_impact TEXT NOT NULL,
  weight TEXT NOT NULL,
  size TEXT NOT NULL,
  base_condition TEXT NOT NULL,
  amount_available INTEGER NOT NULL DEFAULT 0 CHECK (amount_available >= 0),
  rarity TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stage_equipment_catalog_name_type_idx
  ON public.stage_equipment_catalog (name, equipment_type);

ALTER TABLE public.stage_equipment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Stage equipment catalog is viewable by everyone"
  ON public.stage_equipment_catalog FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage stage equipment catalog"
  ON public.stage_equipment_catalog FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER IF NOT EXISTS update_stage_equipment_catalog_updated_at
  BEFORE UPDATE ON public.stage_equipment_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.stage_equipment_catalog (
  id,
  name,
  equipment_type,
  cost,
  live_impact,
  weight,
  size,
  base_condition,
  amount_available,
  rarity,
  description
) VALUES
  (
    'sound-elite-array',
    'Elite Line Array System',
    'Sound',
    18500,
    'Arena-grade clarity with directional control for massive rooms.',
    'very_heavy',
    'huge',
    'brand_new',
    2,
    'rare',
    'Engineered for headline stages that demand pristine dispersion across festival fields.'
  ),
  (
    'lighting-halo',
    'Halo Beam Matrix',
    'Lighting',
    7600,
    'Programmable pan/tilt beams with synchronized pixel waves.',
    'medium',
    'larger',
    'very_good',
    4,
    'ultra_rare',
    'Ride dramatic sweeps and aerial bursts that punctuate breakdowns and finales.'
  ),
  (
    'visuals-vortex',
    'Vortex LED Wall',
    'Visuals',
    9200,
    'High-density LED mesh for reactive backdrops and dynamic storytelling.',
    'heavy',
    'huge',
    'good',
    3,
    'super_ultra_rare',
    'Transforms every venue into a cinematic canvas tied to your setlist cues.'
  ),
  (
    'effects-thunder',
    'Thunderstrike FX Rack',
    'Effects',
    5400,
    'Modular CO₂ jets and spark fountains for high-impact drops.',
    'medium',
    'medium',
    'good',
    5,
    'rare',
    'Stackable effects kit to punctuate anthems without overshooting power limits.'
  ),
  (
    'decor-backline',
    'Neon Skyline Backline',
    'Decor',
    2800,
    'Immersive stage mood with programmable neon and skyline silhouettes.',
    'light',
    'larger',
    'ok',
    7,
    'normal',
    'A versatile design pack to dress intimate clubs and mid-size theatres.'
  ),
  (
    'utility-powergrid',
    'Road Guardian Power Grid',
    'Utility',
    3600,
    'Smart power distribution with surge analytics and per-phase balancing.',
    'medium',
    'medium',
    'very_good',
    6,
    'ultra_rare',
    'Keeps your rig humming across unpredictable venues with automated health reports.'
  )
ON CONFLICT (id) DO NOTHING;
