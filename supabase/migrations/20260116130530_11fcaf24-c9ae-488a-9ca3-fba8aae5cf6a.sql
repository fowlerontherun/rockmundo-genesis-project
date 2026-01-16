-- Fix the foreign key on setlist_songs.performance_item_id to reference performance_items_catalog instead of performance_items
ALTER TABLE public.setlist_songs 
DROP CONSTRAINT IF EXISTS setlist_songs_performance_item_id_fkey;

ALTER TABLE public.setlist_songs 
ADD CONSTRAINT setlist_songs_performance_item_id_fkey 
FOREIGN KEY (performance_item_id) 
REFERENCES performance_items_catalog(id) ON DELETE CASCADE;

-- Add item_type and performance_item_id columns to gig_song_performances for tracking performance items
ALTER TABLE public.gig_song_performances
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'song' CHECK (item_type IN ('song', 'performance_item')),
ADD COLUMN IF NOT EXISTS performance_item_id UUID REFERENCES performance_items_catalog(id);

-- Create gig_crowd_sounds table for managing crowd audio
CREATE TABLE IF NOT EXISTS public.gig_crowd_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sound_type TEXT NOT NULL CHECK (sound_type IN (
    'band_entrance', 'band_exit', 'encore_request', 
    'crowd_cheer_small', 'crowd_cheer_medium', 'crowd_cheer_large',
    'crowd_singing', 'applause', 'booing', 'ambient_chatter',
    'song_recognition', 'mosh_pit', 'lighter_moment'
  )),
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  intensity_level INTEGER DEFAULT 5 CHECK (intensity_level >= 1 AND intensity_level <= 10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on gig_crowd_sounds
ALTER TABLE public.gig_crowd_sounds ENABLE ROW LEVEL SECURITY;

-- Allow public read for crowd sounds
CREATE POLICY "Anyone can view crowd sounds" ON public.gig_crowd_sounds
  FOR SELECT USING (true);

-- Only admins can modify crowd sounds
CREATE POLICY "Admins can manage crowd sounds" ON public.gig_crowd_sounds
  FOR ALL USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Create storage bucket for crowd sounds if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('crowd-sounds', 'crowd-sounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for crowd sounds - anyone can read
CREATE POLICY "Anyone can view crowd sound files"
ON storage.objects FOR SELECT
USING (bucket_id = 'crowd-sounds');

-- Storage policy - admins can upload
CREATE POLICY "Admins can upload crowd sounds"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'crowd-sounds' 
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Storage policy - admins can delete
CREATE POLICY "Admins can delete crowd sounds"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'crowd-sounds' 
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);