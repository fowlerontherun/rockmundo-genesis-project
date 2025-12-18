-- Eurovision Simplified System
-- 3-phase competition: submissions -> voting -> complete

-- Drop old Eurovision tables if they exist (they don't actually exist due to future-dated migration)
DROP TABLE IF EXISTS public.eurovision_votes CASCADE;
DROP TABLE IF EXISTS public.eurovision_entries CASCADE;
DROP TABLE IF EXISTS public.eurovision_submissions CASCADE;
DROP TABLE IF EXISTS public.eurovision_years CASCADE;
DROP TABLE IF EXISTS public.eurovision_countries CASCADE;
DROP TABLE IF EXISTS public.eurovision_winners CASCADE;

-- Create Eurovision events table (one per year)
CREATE TABLE public.eurovision_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'submissions' CHECK (status IN ('submissions', 'voting', 'complete')),
  host_city TEXT,
  host_country TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Eurovision entries table (bands submit their songs)
CREATE TABLE public.eurovision_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.eurovision_events(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  final_rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, band_id),
  UNIQUE(event_id, country)
);

-- Create Eurovision votes table (players vote for entries)
CREATE TABLE public.eurovision_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.eurovision_entries(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(entry_id, voter_id)
);

-- Enable RLS
ALTER TABLE public.eurovision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eurovision_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eurovision_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for eurovision_events (public read, admin write)
CREATE POLICY "Anyone can view eurovision events"
  ON public.eurovision_events FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage eurovision events"
  ON public.eurovision_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for eurovision_entries
CREATE POLICY "Anyone can view eurovision entries"
  ON public.eurovision_entries FOR SELECT
  USING (true);

CREATE POLICY "Band members can submit entries during submissions phase"
  ON public.eurovision_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.eurovision_events e
      WHERE e.id = event_id AND e.status = 'submissions'
    )
    AND
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = eurovision_entries.band_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can delete own entries during submissions"
  ON public.eurovision_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.eurovision_events e
      WHERE e.id = event_id AND e.status = 'submissions'
    )
    AND
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = eurovision_entries.band_id AND bm.user_id = auth.uid()
    )
  );

-- RLS Policies for eurovision_votes  
CREATE POLICY "Anyone can view eurovision votes"
  ON public.eurovision_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote during voting phase"
  ON public.eurovision_votes FOR INSERT
  WITH CHECK (
    auth.uid() = voter_id
    AND
    EXISTS (
      SELECT 1 FROM public.eurovision_entries ent
      JOIN public.eurovision_events ev ON ev.id = ent.event_id
      WHERE ent.id = entry_id AND ev.status = 'voting'
    )
  );

CREATE POLICY "Users can remove their own votes"
  ON public.eurovision_votes FOR DELETE
  USING (auth.uid() = voter_id);

-- Create indexes for performance
CREATE INDEX idx_eurovision_entries_event_id ON public.eurovision_entries(event_id);
CREATE INDEX idx_eurovision_entries_band_id ON public.eurovision_entries(band_id);
CREATE INDEX idx_eurovision_votes_entry_id ON public.eurovision_votes(entry_id);
CREATE INDEX idx_eurovision_votes_voter_id ON public.eurovision_votes(voter_id);

-- Trigger to update vote_count on entries
CREATE OR REPLACE FUNCTION public.update_eurovision_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.eurovision_entries 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.entry_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.eurovision_entries 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.entry_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_eurovision_vote_count_trigger
  AFTER INSERT OR DELETE ON public.eurovision_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_eurovision_vote_count();

-- Trigger to update timestamps
CREATE TRIGGER update_eurovision_events_updated_at
  BEFORE UPDATE ON public.eurovision_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();