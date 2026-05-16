
-- Extend marriages
ALTER TABLE public.marriages
  ADD COLUMN IF NOT EXISTS engagement_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_ring_cost_cents bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_announced boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wedding_id uuid,
  ADD COLUMN IF NOT EXISTS honeymoon_id uuid,
  ADD COLUMN IF NOT EXISTS last_anniversary_at timestamptz,
  ADD COLUMN IF NOT EXISTS anniversary_count integer DEFAULT 0;

-- Weddings
CREATE TABLE IF NOT EXISTS public.weddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marriage_id uuid NOT NULL REFERENCES public.marriages(id) ON DELETE CASCADE,
  venue_city_id uuid,
  venue_name text,
  tier text NOT NULL DEFAULT 'small',
  guest_count integer NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0,
  theme text,
  ceremony_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  actual_attendance integer DEFAULT 0,
  fame_gained integer DEFAULT 0,
  media_buzz integer DEFAULT 0,
  photos_jsonb jsonb DEFAULT '[]'::jsonb,
  vows_a text,
  vows_b text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marriage partners can view wedding" ON public.weddings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.marriages m JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE m.id = weddings.marriage_id AND p.user_id = auth.uid())
);
CREATE POLICY "Marriage partners can manage wedding" ON public.weddings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.marriages m JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE m.id = weddings.marriage_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.marriages m JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE m.id = weddings.marriage_id AND p.user_id = auth.uid())
);

-- Wedding guests
CREATE TABLE IF NOT EXISTS public.wedding_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  guest_profile_id uuid,
  guest_npc_id uuid,
  guest_name text,
  rsvp_status text NOT NULL DEFAULT 'invited',
  relationship_to_couple text,
  gift_cents bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wedding parties view guests" ON public.wedding_guests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.weddings w JOIN public.marriages m ON m.id = w.marriage_id JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE w.id = wedding_guests.wedding_id AND p.user_id = auth.uid())
);
CREATE POLICY "Wedding parties manage guests" ON public.wedding_guests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.weddings w JOIN public.marriages m ON m.id = w.marriage_id JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE w.id = wedding_guests.wedding_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.weddings w JOIN public.marriages m ON m.id = w.marriage_id JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE w.id = wedding_guests.wedding_id AND p.user_id = auth.uid())
);

-- Honeymoons
CREATE TABLE IF NOT EXISTS public.honeymoons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marriage_id uuid NOT NULL REFERENCES public.marriages(id) ON DELETE CASCADE,
  destination_city_id uuid,
  destination_name text,
  package_tier text NOT NULL DEFAULT 'standard',
  duration_days integer NOT NULL DEFAULT 7,
  cost_cents bigint NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  bond_gained integer DEFAULT 0,
  health_gained integer DEFAULT 0,
  fame_gained integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.honeymoons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couples view honeymoon" ON public.honeymoons FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.marriages m JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE m.id = honeymoons.marriage_id AND p.user_id = auth.uid())
);
CREATE POLICY "Couples manage honeymoon" ON public.honeymoons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.marriages m JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE m.id = honeymoons.marriage_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.marriages m JOIN public.profiles p ON p.id IN (m.partner_a_id, m.partner_b_id) WHERE m.id = honeymoons.marriage_id AND p.user_id = auth.uid())
);

-- Friend gifts
CREATE TABLE IF NOT EXISTS public.friend_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile_id uuid NOT NULL,
  recipient_profile_id uuid NOT NULL,
  gift_type text NOT NULL,
  gift_name text NOT NULL,
  cost_cents bigint NOT NULL DEFAULT 0,
  message text,
  affection_bonus integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.friend_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sender/recipient can view gifts" ON public.friend_gifts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.id IN (friend_gifts.sender_profile_id, friend_gifts.recipient_profile_id))
);
CREATE POLICY "Sender can create gifts" ON public.friend_gifts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.id = friend_gifts.sender_profile_id)
);

-- Friendship milestones
CREATE TABLE IF NOT EXISTS public.friendship_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id uuid NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  milestone_type text NOT NULL,
  milestone_label text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (friendship_id, profile_id, milestone_type)
);
ALTER TABLE public.friendship_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can view milestones" ON public.friendship_milestones FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.id = friendship_milestones.profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weddings_marriage ON public.weddings(marriage_id);
CREATE INDEX IF NOT EXISTS idx_weddings_ceremony_at ON public.weddings(ceremony_at) WHERE status = 'planned';
CREATE INDEX IF NOT EXISTS idx_honeymoons_marriage ON public.honeymoons(marriage_id);
CREATE INDEX IF NOT EXISTS idx_honeymoons_ends_at ON public.honeymoons(ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_friend_gifts_recipient ON public.friend_gifts(recipient_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_gifts_sender ON public.friend_gifts(sender_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendship_milestones_profile ON public.friendship_milestones(profile_id, awarded_at DESC);

-- Child auto-birth + fame inheritance
ALTER TABLE public.player_children
  ADD COLUMN IF NOT EXISTS child_fame integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_progressed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS school_stage text DEFAULT 'infant',
  ADD COLUMN IF NOT EXISTS last_monthly_cost_at timestamptz;
