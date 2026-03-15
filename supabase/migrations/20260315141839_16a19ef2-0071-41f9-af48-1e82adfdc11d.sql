-- Phase 2: Add profile_id to character-specific tables
-- Skipping player_conditions (doesn't exist) and music_videos (no user_id)

-- player_achievements
ALTER TABLE public.player_achievements ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_achievements pa SET profile_id = p.id 
FROM public.profiles p WHERE pa.user_id = p.user_id AND p.is_active = true AND pa.profile_id IS NULL;

-- player_addictions
ALTER TABLE public.player_addictions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_addictions pa2 SET profile_id = p.id 
FROM public.profiles p WHERE pa2.user_id = p.user_id AND p.is_active = true AND pa2.profile_id IS NULL;

-- player_hospitalizations
ALTER TABLE public.player_hospitalizations ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_hospitalizations ph SET profile_id = p.id 
FROM public.profiles p WHERE ph.user_id = p.user_id AND p.is_active = true AND ph.profile_id IS NULL;

-- player_imprisonments
ALTER TABLE public.player_imprisonments ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_imprisonments pi SET profile_id = p.id 
FROM public.profiles p WHERE pi.user_id = p.user_id AND p.is_active = true AND pi.profile_id IS NULL;

-- player_criminal_record
ALTER TABLE public.player_criminal_record ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_criminal_record pcr SET profile_id = p.id 
FROM public.profiles p WHERE pcr.user_id = p.user_id AND p.is_active = true AND pcr.profile_id IS NULL;

-- radio_submissions (uses user_id directly)
ALTER TABLE public.radio_submissions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.radio_submissions rs SET profile_id = p.id 
FROM public.profiles p WHERE rs.user_id = p.user_id AND p.is_active = true AND rs.profile_id IS NULL;

-- player_events
ALTER TABLE public.player_events ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_events pe SET profile_id = p.id 
FROM public.profiles p WHERE pe.user_id = p.user_id AND p.is_active = true AND pe.profile_id IS NULL;

-- player_skill_books
ALTER TABLE public.player_skill_books ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_skill_books psb SET profile_id = p.id 
FROM public.profiles p WHERE psb.user_id = p.user_id AND p.is_active = true AND psb.profile_id IS NULL;

-- player_properties
ALTER TABLE public.player_properties ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_properties pp SET profile_id = p.id 
FROM public.profiles p WHERE pp.user_id = p.user_id AND p.is_active = true AND pp.profile_id IS NULL;

-- player_rentals
ALTER TABLE public.player_rentals ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_rentals pr SET profile_id = p.id 
FROM public.profiles p WHERE pr.user_id = p.user_id AND p.is_active = true AND pr.profile_id IS NULL;

-- media_facilities
ALTER TABLE public.media_facilities ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.media_facilities mf SET profile_id = p.id 
FROM public.profiles p WHERE mf.user_id = p.user_id AND p.is_active = true AND mf.profile_id IS NULL;

-- media_shows
ALTER TABLE public.media_shows ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.media_shows ms SET profile_id = p.id 
FROM public.profiles p WHERE ms.user_id = p.user_id AND p.is_active = true AND ms.profile_id IS NULL;

-- underworld_purchases
ALTER TABLE public.underworld_purchases ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.underworld_purchases up SET profile_id = p.id 
FROM public.profiles p WHERE up.user_id = p.user_id AND p.is_active = true AND up.profile_id IS NULL;

-- player_investments
ALTER TABLE public.player_investments ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_investments pinv SET profile_id = p.id 
FROM public.profiles p WHERE pinv.user_id = p.user_id AND p.is_active = true AND pinv.profile_id IS NULL;

-- player_loans
ALTER TABLE public.player_loans ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_loans pl SET profile_id = p.id 
FROM public.profiles p WHERE pl.user_id = p.user_id AND p.is_active = true AND pl.profile_id IS NULL;

-- festival_attendance
ALTER TABLE public.festival_attendance ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.festival_attendance fa SET profile_id = p.id 
FROM public.profiles p WHERE fa.user_id = p.user_id AND p.is_active = true AND fa.profile_id IS NULL;

-- player_active_boosts
ALTER TABLE public.player_active_boosts ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_active_boosts pab SET profile_id = p.id 
FROM public.profiles p WHERE pab.user_id = p.user_id AND p.is_active = true AND pab.profile_id IS NULL;

-- activity_feed (may already have it from previous migration)
DO $$ BEGIN
  ALTER TABLE public.activity_feed ADD COLUMN profile_id uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
UPDATE public.activity_feed af SET profile_id = p.id 
FROM public.profiles p WHERE af.user_id = p.user_id AND p.is_active = true AND af.profile_id IS NULL;

-- songwriting_projects
ALTER TABLE public.songwriting_projects ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.songwriting_projects sp SET profile_id = p.id 
FROM public.profiles p WHERE sp.user_id = p.user_id AND p.is_active = true AND sp.profile_id IS NULL;

-- songwriting_sessions
ALTER TABLE public.songwriting_sessions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.songwriting_sessions ss SET profile_id = p.id 
FROM public.profiles p WHERE ss.user_id = p.user_id AND p.is_active = true AND ss.profile_id IS NULL;

-- recording_sessions
ALTER TABLE public.recording_sessions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.recording_sessions rs2 SET profile_id = p.id 
FROM public.profiles p WHERE rs2.user_id = p.user_id AND p.is_active = true AND rs2.profile_id IS NULL;

-- player_habits
ALTER TABLE public.player_habits ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.player_habits ph2 SET profile_id = p.id 
FROM public.profiles p WHERE ph2.user_id = p.user_id AND p.is_active = true AND ph2.profile_id IS NULL;

-- marketplace_listings  
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.marketplace_listings ml SET profile_id = p.id 
FROM public.profiles p WHERE ml.seller_user_id = p.user_id AND p.is_active = true AND ml.profile_id IS NULL;

-- band_earnings
ALTER TABLE public.band_earnings ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);
UPDATE public.band_earnings be SET profile_id = p.id 
FROM public.profiles p WHERE be.earned_by_user_id = p.user_id AND p.is_active = true AND be.profile_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_addictions_profile_id ON public.player_addictions(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_hospitalizations_profile_id ON public.player_hospitalizations(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_events_profile_id ON public.player_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_investments_profile_id ON public.player_investments(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_loans_profile_id ON public.player_loans(profile_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_profile_id ON public.activity_feed(profile_id);
CREATE INDEX IF NOT EXISTS idx_underworld_purchases_profile_id ON public.underworld_purchases(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_properties_profile_id ON public.player_properties(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_profile_id ON public.player_achievements(profile_id);
CREATE INDEX IF NOT EXISTS idx_songwriting_projects_profile_id ON public.songwriting_projects(profile_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_profile_id ON public.recording_sessions(profile_id);
