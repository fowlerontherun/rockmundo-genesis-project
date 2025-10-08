-- Create city_night_clubs table for nightlife venues
CREATE TABLE IF NOT EXISTS public.city_night_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  quality_level INTEGER NOT NULL DEFAULT 3 CHECK (quality_level >= 1 AND quality_level <= 5),
  capacity INTEGER CHECK (capacity >= 0),
  cover_charge INTEGER CHECK (cover_charge >= 0),
  guest_actions JSONB DEFAULT '[]'::jsonb,
  drink_menu JSONB DEFAULT '[]'::jsonb,
  npc_profiles JSONB DEFAULT '[]'::jsonb,
  dj_slot_config JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.city_night_clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Night clubs are viewable by everyone"
  ON public.city_night_clubs
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage night clubs"
  ON public.city_night_clubs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_city_night_clubs_city_id ON public.city_night_clubs(city_id);
CREATE INDEX IF NOT EXISTS idx_city_night_clubs_quality_level ON public.city_night_clubs(quality_level);

-- Trigger for updated_at
CREATE TRIGGER update_city_night_clubs_updated_at
  BEFORE UPDATE ON public.city_night_clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed London with sample night clubs
DO $$
DECLARE
  london_id UUID;
BEGIN
  SELECT id INTO london_id FROM public.cities WHERE name = 'London' AND country = 'United Kingdom' LIMIT 1;
  
  IF london_id IS NOT NULL THEN
    -- Underground club in Camden
    INSERT INTO public.city_night_clubs (city_id, name, description, quality_level, capacity, cover_charge, guest_actions, drink_menu, npc_profiles, dj_slot_config, metadata)
    VALUES (
      london_id,
      'The Electric Basement',
      'A gritty underground venue in Camden where emerging DJs spin late into the night.',
      1,
      150,
      10,
      '[{"id":"dance","label":"Hit the dance floor","description":"Burn energy and boost morale","energyCost":5}]'::jsonb,
      '[{"id":"beer","name":"Camden Lager","price":6}]'::jsonb,
      '[{"id":"dj1","name":"DJ Rebel","role":"Resident DJ","personality":"Edgy and unpredictable"}]'::jsonb,
      '{"minimum_fame":100,"payout":200,"set_length_minutes":45,"schedule":"11pm-3am","perks":["Underground cred boost"]}'::jsonb,
      '{"live_interactions_enabled":true}'::jsonb
    )
    ON CONFLICT DO NOTHING;

    -- Boutique club in Shoreditch
    INSERT INTO public.city_night_clubs (city_id, name, description, quality_level, capacity, cover_charge, guest_actions, drink_menu, npc_profiles, dj_slot_config, metadata)
    VALUES (
      london_id,
      'Neon Dreams',
      'Shoreditch''s premier electronic music venue with state-of-the-art sound system.',
      3,
      300,
      25,
      '[{"id":"vip","label":"VIP lounge access","description":"Network with industry insiders","energyCost":3},{"id":"dance","label":"Dance floor","energyCost":5}]'::jsonb,
      '[{"id":"signature","name":"Electric Blue","price":15,"effect":"+15 morale"},{"id":"premium","name":"Velvet Night","price":22,"effect":"+10 energy"}]'::jsonb,
      '[{"id":"dj2","name":"Synthia Vega","role":"Resident DJ","personality":"Charismatic and trend-setting","availability":"Thu-Sat"},{"id":"promoter","name":"Marcus Steel","role":"Promoter","personality":"Business-savvy"}]'::jsonb,
      '{"minimum_fame":750,"payout":800,"set_length_minutes":60,"schedule":"10pm-2am","perks":["+4% night fan buzz","Audience energy boost"]}'::jsonb,
      '{"live_interactions_enabled":true}'::jsonb
    )
    ON CONFLICT DO NOTHING;

    -- Premier club in Soho
    INSERT INTO public.city_night_clubs (city_id, name, description, quality_level, capacity, cover_charge, guest_actions, drink_menu, npc_profiles, dj_slot_config, metadata)
    VALUES (
      london_id,
      'The Velvet Room',
      'Exclusive Soho nightspot frequented by celebrities and industry elite.',
      4,
      200,
      50,
      '[{"id":"network","label":"Network with VIPs","description":"Build connections","energyCost":4},{"id":"champagne","label":"Order champagne service","energyCost":2}]'::jsonb,
      '[{"id":"cristal","name":"Cristal","price":350},{"id":"signature","name":"Velvet Martini","price":28,"effect":"+20 morale"}]'::jsonb,
      '[{"id":"owner","name":"Vincent Noir","role":"Club Owner","personality":"Discerning and influential","dialogueHooks":["Record deals","Industry gossip","Exclusive events"]}]'::jsonb,
      '{"minimum_fame":2000,"payout":1500,"set_length_minutes":90,"schedule":"11pm-4am","perks":["VIP networking","Industry exposure","Fame multiplier x1.5"]}'::jsonb,
      '{"live_interactions_enabled":true}'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;