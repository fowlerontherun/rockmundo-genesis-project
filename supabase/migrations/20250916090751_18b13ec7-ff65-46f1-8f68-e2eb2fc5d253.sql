-- Add foreign key constraints for data integrity

-- Add foreign keys for player_achievements
ALTER TABLE public.player_achievements 
ADD CONSTRAINT fk_player_achievements_achievement 
FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;

-- Add foreign keys for player_equipment
ALTER TABLE public.player_equipment 
ADD CONSTRAINT fk_player_equipment_item 
FOREIGN KEY (equipment_id) REFERENCES public.equipment_items(id) ON DELETE CASCADE;

-- Add foreign keys for player_streaming_accounts
ALTER TABLE public.player_streaming_accounts 
ADD CONSTRAINT fk_player_streaming_platform 
FOREIGN KEY (platform_id) REFERENCES public.streaming_platforms(id) ON DELETE CASCADE;

-- Add foreign keys for chart_entries
ALTER TABLE public.chart_entries 
ADD CONSTRAINT fk_chart_entries_song 
FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE;

-- Add foreign keys for gigs
ALTER TABLE public.gigs 
ADD CONSTRAINT fk_gigs_venue 
FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE RESTRICT;

ALTER TABLE public.gigs 
ADD CONSTRAINT fk_gigs_band 
FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;

-- Add foreign keys for tour_venues
ALTER TABLE public.tour_venues 
ADD CONSTRAINT fk_tour_venues_tour 
FOREIGN KEY (tour_id) REFERENCES public.tours(id) ON DELETE CASCADE;

ALTER TABLE public.tour_venues 
ADD CONSTRAINT fk_tour_venues_venue 
FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE RESTRICT;

-- Add foreign keys for band_members
ALTER TABLE public.band_members 
ADD CONSTRAINT fk_band_members_band 
FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;

-- Add foreign keys for event_participants
ALTER TABLE public.event_participants 
ADD CONSTRAINT fk_event_participants_event 
FOREIGN KEY (event_id) REFERENCES public.game_events(id) ON DELETE CASCADE;

-- Add indexes for better performance on foreign key columns
CREATE INDEX IF NOT EXISTS idx_player_achievements_achievement_id ON public.player_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_player_equipment_equipment_id ON public.player_equipment(equipment_id);
CREATE INDEX IF NOT EXISTS idx_player_streaming_platform_id ON public.player_streaming_accounts(platform_id);
CREATE INDEX IF NOT EXISTS idx_chart_entries_song_id ON public.chart_entries(song_id);
CREATE INDEX IF NOT EXISTS idx_gigs_venue_id ON public.gigs(venue_id);
CREATE INDEX IF NOT EXISTS idx_gigs_band_id ON public.gigs(band_id);
CREATE INDEX IF NOT EXISTS idx_tour_venues_tour_id ON public.tour_venues(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_venues_venue_id ON public.tour_venues(venue_id);
CREATE INDEX IF NOT EXISTS idx_band_members_band_id ON public.band_members(band_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON public.event_participants(event_id);