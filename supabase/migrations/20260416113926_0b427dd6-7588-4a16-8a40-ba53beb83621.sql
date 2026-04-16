
-- 1. nightclub_events
CREATE TABLE public.nightclub_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.city_night_clubs(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'theme_night',
  genre_focus TEXT,
  day_of_week INTEGER,
  scheduled_date DATE,
  cover_charge_override INTEGER,
  fame_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  xp_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  special_guest_name TEXT,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightclub_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view nightclub events"
  ON public.nightclub_events FOR SELECT USING (true);

CREATE POLICY "Admins can manage nightclub events"
  ON public.nightclub_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. nightclub_vip_packages
CREATE TABLE public.nightclub_vip_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.city_night_clubs(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  perks JSONB NOT NULL DEFAULT '{}',
  min_reputation_tier TEXT NOT NULL DEFAULT 'newcomer',
  max_guests INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightclub_vip_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view VIP packages"
  ON public.nightclub_vip_packages FOR SELECT USING (true);

CREATE POLICY "Admins can manage VIP packages"
  ON public.nightclub_vip_packages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. player_vip_bookings
CREATE TABLE public.player_vip_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.city_night_clubs(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.nightclub_vip_packages(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_vip_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own VIP bookings"
  ON public.player_vip_bookings FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can create own VIP bookings"
  ON public.player_vip_bookings FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own VIP bookings"
  ON public.player_vip_bookings FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- 4. player_owned_nightclubs
CREATE TABLE public.player_owned_nightclubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id UUID REFERENCES public.city_night_clubs(id) ON DELETE SET NULL,
  club_name TEXT NOT NULL,
  city_id UUID REFERENCES public.cities(id),
  quality_level INTEGER NOT NULL DEFAULT 1,
  capacity INTEGER NOT NULL DEFAULT 100,
  cover_charge INTEGER NOT NULL DEFAULT 10,
  drink_markup_pct INTEGER NOT NULL DEFAULT 0,
  staff_count INTEGER NOT NULL DEFAULT 0,
  weekly_revenue INTEGER NOT NULL DEFAULT 0,
  weekly_expenses INTEGER NOT NULL DEFAULT 0,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT true,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchase_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_owned_nightclubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own nightclubs"
  ON public.player_owned_nightclubs FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can create own nightclubs"
  ON public.player_owned_nightclubs FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can update own nightclubs"
  ON public.player_owned_nightclubs FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can delete own nightclubs"
  ON public.player_owned_nightclubs FOR DELETE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- 5. nightclub_staff
CREATE TABLE public.nightclub_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owned_club_id UUID NOT NULL REFERENCES public.player_owned_nightclubs(id) ON DELETE CASCADE,
  staff_type TEXT NOT NULL DEFAULT 'bartender',
  name TEXT NOT NULL,
  skill_level INTEGER NOT NULL DEFAULT 1,
  salary_weekly INTEGER NOT NULL DEFAULT 100,
  hired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightclub_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view staff for own clubs"
  ON public.nightclub_staff FOR SELECT
  USING (owned_club_id IN (
    SELECT id FROM public.player_owned_nightclubs
    WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Players can manage staff for own clubs"
  ON public.nightclub_staff FOR ALL
  USING (owned_club_id IN (
    SELECT id FROM public.player_owned_nightclubs
    WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ))
  WITH CHECK (owned_club_id IN (
    SELECT id FROM public.player_owned_nightclubs
    WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- 6. nightclub_revenue_log
CREATE TABLE public.nightclub_revenue_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owned_club_id UUID NOT NULL REFERENCES public.player_owned_nightclubs(id) ON DELETE CASCADE,
  revenue_type TEXT NOT NULL DEFAULT 'cover',
  amount INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightclub_revenue_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view revenue for own clubs"
  ON public.nightclub_revenue_log FOR SELECT
  USING (owned_club_id IN (
    SELECT id FROM public.player_owned_nightclubs
    WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Players can insert revenue for own clubs"
  ON public.nightclub_revenue_log FOR INSERT
  WITH CHECK (owned_club_id IN (
    SELECT id FROM public.player_owned_nightclubs
    WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- Triggers for updated_at
CREATE TRIGGER update_nightclub_events_updated_at
  BEFORE UPDATE ON public.nightclub_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nightclub_vip_packages_updated_at
  BEFORE UPDATE ON public.nightclub_vip_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_owned_nightclubs_updated_at
  BEFORE UPDATE ON public.player_owned_nightclubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
