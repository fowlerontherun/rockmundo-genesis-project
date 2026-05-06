
-- premium tokens balance on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_tokens INTEGER NOT NULL DEFAULT 0;

-- catalog
CREATE TABLE public.blind_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  theme_genre TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  price_cash INTEGER NOT NULL DEFAULT 0,
  price_premium INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'cash' CHECK (currency IN ('cash','premium')),
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  skill_slugs TEXT[] NOT NULL DEFAULT '{}',
  instrument_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
  song_title_pool TEXT[] NOT NULL DEFAULT '{}',
  tier_odds JSONB NOT NULL DEFAULT '{"common":60,"rare":28,"epic":10,"legendary":2}'::jsonb,
  pity_threshold INTEGER NOT NULL DEFAULT 20,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blind_boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blind_boxes readable by all authenticated"
ON public.blind_boxes FOR SELECT TO authenticated USING (true);

-- openings ledger
CREATE TABLE public.blind_box_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  box_id UUID NOT NULL REFERENCES public.blind_boxes(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  ap_awarded INTEGER NOT NULL DEFAULT 0,
  skill_slug TEXT,
  instrument_id UUID,
  song_id UUID,
  price_paid INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  reward_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blind_box_openings_profile ON public.blind_box_openings(profile_id, rolled_at DESC);

ALTER TABLE public.blind_box_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "openings own select"
ON public.blind_box_openings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- pity tracker
CREATE TABLE public.blind_box_pity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  box_id UUID NOT NULL REFERENCES public.blind_boxes(id) ON DELETE CASCADE,
  opens_since_epic INTEGER NOT NULL DEFAULT 0,
  total_opens INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, box_id)
);

ALTER TABLE public.blind_box_pity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pity own select"
ON public.blind_box_pity FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = blind_box_pity.profile_id AND p.user_id = auth.uid())
);

-- Seed 6 launch boxes
INSERT INTO public.blind_boxes (slug, name, theme_genre, description, price_cash, price_premium, currency, is_premium, skill_slugs, instrument_pool, song_title_pool) VALUES
('emg-metal-crate','EMG Metal Crate','Heavy Metal','A brutal crate of EMG-powered fury — shred guitars, thunder basses, and metal XP.',
  2500, 0, 'cash', false,
  ARRAY['guitar','bass','performance'],
  '[{"name":"EMG 81 Loaded Strat","type":"guitar"},{"name":"ESP LTD EC-1000","type":"guitar"},{"name":"Schecter Hellraiser 7","type":"guitar"},{"name":"ESP LTD B-205 Bass","type":"bass"},{"name":"Jackson King V","type":"guitar"}]'::jsonb,
  ARRAY['Iron Throne','Bleeding Steel','Blackened Skies','Wretched Hymn','Forge of Wrath']
),
('synthwave-neon','Synthwave Neon Pack','Synthwave','Neon-soaked retro futures: vintage synths, drum machines, and electric XP.',
  0, 50, 'premium', true,
  ARRAY['keys','composition','creativity'],
  '[{"name":"Roland Juno-60","type":"synth"},{"name":"Korg MS-20","type":"synth"},{"name":"Roland TR-808","type":"drum_machine"},{"name":"Yamaha DX7","type":"synth"}]'::jsonb,
  ARRAY['Neon Mirage','Midnight Drive','Chrome Heart','Sunset Protocol','Hyperdrift']
),
('acoustic-folk','Acoustic Folk Bundle','Folk','Warm woods and storyteller tools — acoustic gear and folk craft XP.',
  1800, 0, 'cash', false,
  ARRAY['guitar','vocals','songwriting'],
  '[{"name":"Martin D-28 Acoustic","type":"guitar"},{"name":"Gibson J-45","type":"guitar"},{"name":"Vintage Mandolin","type":"mandolin"},{"name":"Hohner Harmonica Set","type":"harmonica"}]'::jsonb,
  ARRAY['River Hymn','Lantern Light','Old Pine Road','Hollow Hill','Wandering Song']
),
('boom-bap-crate','Boom Bap Crate','Boom Bap','Crates dug deep — samplers, turntables, and dusty hip-hop XP.',
  2200, 0, 'cash', false,
  ARRAY['composition','technical','vocals'],
  '[{"name":"Akai MPC 2000XL","type":"sampler"},{"name":"Technics SL-1200 Turntable","type":"turntable"},{"name":"Shure SM7B Mic","type":"microphone"},{"name":"Roland SP-404","type":"sampler"}]'::jsonb,
  ARRAY['Crate Diggers','Borough Anthem','Sample This','Late Night Cipher','Dust on Wax']
),
('punk-rebel','Punk Rebel Pack','Punk Rock','Three chords and the truth — beat-up gear and rebellious XP.',
  1500, 0, 'cash', false,
  ARRAY['guitar','bass','drums'],
  '[{"name":"Beat-up Fender Strat","type":"guitar"},{"name":"Rickenbacker 4001 Bass","type":"bass"},{"name":"Pearl Snare Drum","type":"drums"},{"name":"Marshall Half Stack","type":"guitar"}]'::jsonb,
  ARRAY['Burn the Stage','No Future','Static Riot','Loud and Wrong','Kids on Fire']
),
('jazz-lounge','Jazz Lounge Case','Jazz','Smooth velvet sophistication — hollow-bodies, sax, and jazz mastery XP.',
  0, 60, 'premium', true,
  ARRAY['keys','sax','songwriting'],
  '[{"name":"Gibson ES-175 Hollow-body","type":"guitar"},{"name":"Selmer Mark VI Tenor Sax","type":"sax"},{"name":"Upright Bass","type":"bass"},{"name":"Fender Rhodes","type":"keys"}]'::jsonb,
  ARRAY['Blue Velvet','Smoke and Brass','Midnight Blues','Lounge Reverie','Brownstone Swing']
);
