
-- =============================================
-- Festival System Expansion - Phase 1 Schema
-- =============================================

-- 1. Add new columns to game_events
ALTER TABLE public.game_events
  ADD COLUMN IF NOT EXISTS duration_days integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS day_of_week_start text DEFAULT 'saturday',
  ADD COLUMN IF NOT EXISTS ticket_price numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS max_stages integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS festival_budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS security_firm_id uuid REFERENCES public.security_firms(id);

-- 2. Add festival_id to security_contracts
ALTER TABLE public.security_contracts
  ADD COLUMN IF NOT EXISTS festival_id uuid REFERENCES public.game_events(id);

-- 3. festival_stages
CREATE TABLE public.festival_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  stage_number integer NOT NULL CHECK (stage_number BETWEEN 1 AND 5),
  capacity integer DEFAULT 500,
  genre_focus text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(festival_id, stage_number)
);
ALTER TABLE public.festival_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Festival stages viewable by all" ON public.festival_stages FOR SELECT USING (true);
CREATE POLICY "Authenticated users manage stages" ON public.festival_stages FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. festival_stage_slots
CREATE TABLE public.festival_stage_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id uuid NOT NULL REFERENCES public.festival_stages(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number BETWEEN 1 AND 4),
  slot_number integer NOT NULL CHECK (slot_number BETWEEN 1 AND 6),
  slot_type text NOT NULL DEFAULT 'opener' CHECK (slot_type IN ('headliner', 'support', 'opener', 'dj_session')),
  band_id uuid REFERENCES public.bands(id),
  is_npc_dj boolean DEFAULT false,
  npc_dj_genre text,
  npc_dj_quality integer DEFAULT 50 CHECK (npc_dj_quality BETWEEN 0 AND 100),
  npc_dj_name text,
  start_time timestamptz,
  end_time timestamptz,
  payout_amount numeric DEFAULT 0,
  status text DEFAULT 'open' CHECK (status IN ('open', 'booked', 'confirmed', 'performing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(stage_id, day_number, slot_number)
);
ALTER TABLE public.festival_stage_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Festival slots viewable by all" ON public.festival_stage_slots FOR SELECT USING (true);
CREATE POLICY "Authenticated users manage slots" ON public.festival_stage_slots FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. festival_tickets
CREATE TABLE public.festival_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ticket_type text NOT NULL DEFAULT 'weekend' CHECK (ticket_type IN ('day', 'weekend')),
  purchase_price numeric NOT NULL DEFAULT 0,
  day_number integer,
  purchased_at timestamptz DEFAULT now(),
  refunded boolean DEFAULT false,
  UNIQUE(festival_id, user_id, day_number)
);
ALTER TABLE public.festival_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tickets" ON public.festival_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users purchase tickets" ON public.festival_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated view all tickets" ON public.festival_tickets FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. festival_attendance
CREATE TABLE public.festival_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_stage_id uuid REFERENCES public.festival_stages(id),
  joined_at timestamptz DEFAULT now(),
  last_moved_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(festival_id, user_id)
);
ALTER TABLE public.festival_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance viewable by all" ON public.festival_attendance FOR SELECT USING (true);
CREATE POLICY "Users manage own attendance" ON public.festival_attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attendance" ON public.festival_attendance FOR UPDATE USING (auth.uid() = user_id);

-- 7. festival_watch_rewards
CREATE TABLE public.festival_watch_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  band_id uuid REFERENCES public.bands(id),
  stage_slot_id uuid REFERENCES public.festival_stage_slots(id),
  reward_type text NOT NULL CHECK (reward_type IN ('xp', 'song_gift', 'attribute_point')),
  reward_value jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.festival_watch_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON public.festival_watch_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users earn rewards" ON public.festival_watch_rewards FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. festival_finances
CREATE TABLE public.festival_finances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE UNIQUE,
  ticket_revenue numeric DEFAULT 0,
  sponsorship_income numeric DEFAULT 0,
  security_cost numeric DEFAULT 0,
  stage_costs numeric DEFAULT 0,
  band_payouts_total numeric DEFAULT 0,
  festival_tax_rate numeric DEFAULT 0.15,
  festival_tax_amount numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  budget numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.festival_finances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finances viewable by authenticated" ON public.festival_finances FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated manage finances" ON public.festival_finances FOR ALL USING (auth.uid() IS NOT NULL);

-- 9. festival_quality_ratings
CREATE TABLE public.festival_quality_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE UNIQUE,
  comfort_rating integer DEFAULT 3 CHECK (comfort_rating BETWEEN 1 AND 5),
  food_rating integer DEFAULT 3 CHECK (food_rating BETWEEN 1 AND 5),
  safety_rating integer DEFAULT 3 CHECK (safety_rating BETWEEN 1 AND 5),
  lineup_rating integer DEFAULT 3 CHECK (lineup_rating BETWEEN 1 AND 5),
  overall_rating numeric DEFAULT 3.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.festival_quality_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quality ratings viewable by all" ON public.festival_quality_ratings FOR SELECT USING (true);
CREATE POLICY "Authenticated manage quality" ON public.festival_quality_ratings FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_festival_stages_festival ON public.festival_stages(festival_id);
CREATE INDEX idx_festival_stage_slots_stage ON public.festival_stage_slots(stage_id);
CREATE INDEX idx_festival_stage_slots_festival ON public.festival_stage_slots(festival_id);
CREATE INDEX idx_festival_stage_slots_band ON public.festival_stage_slots(band_id);
CREATE INDEX idx_festival_tickets_festival ON public.festival_tickets(festival_id);
CREATE INDEX idx_festival_tickets_user ON public.festival_tickets(user_id);
CREATE INDEX idx_festival_attendance_festival ON public.festival_attendance(festival_id);
CREATE INDEX idx_festival_watch_rewards_user ON public.festival_watch_rewards(user_id);
