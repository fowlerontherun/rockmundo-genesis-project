
-- Game configuration table for admin-managed settings
CREATE TABLE public.game_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read config
CREATE POLICY "Anyone can read game config"
  ON public.game_config FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify (using has_role function)
CREATE POLICY "Admins can manage game config"
  ON public.game_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default release config
INSERT INTO public.game_config (config_key, config_value, description)
VALUES (
  'release_costs',
  '{
    "single_digital_base_cost": 50,
    "single_cd_base_cost": 200,
    "single_vinyl_base_cost": 400,
    "ep_digital_base_cost": 150,
    "ep_cd_base_cost": 500,
    "ep_vinyl_base_cost": 1000,
    "album_digital_base_cost": 300,
    "album_cd_base_cost": 1000,
    "album_vinyl_base_cost": 2000,
    "streaming_upload_cost": 25,
    "manufacturing_time_days": 14,
    "digital_price_per_sale": 10,
    "cd_price_per_sale": 15,
    "vinyl_price_per_sale": 25
  }'::jsonb,
  'Release costs and pricing configuration'
);
