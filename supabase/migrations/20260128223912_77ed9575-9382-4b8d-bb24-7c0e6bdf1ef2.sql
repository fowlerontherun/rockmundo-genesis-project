-- Create player_journal_entries table for the Journal/Memoir system
CREATE TABLE public.player_journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL DEFAULT 'note' CHECK (entry_type IN ('milestone', 'note')),
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT,
  is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  related_entity_type TEXT,
  related_entity_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create player_milestone_tracking table to prevent duplicate milestone logging
CREATE TABLE public.player_milestone_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  milestone_type TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(profile_id, milestone_type)
);

-- Enable RLS on both tables
ALTER TABLE public.player_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_milestone_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for player_journal_entries
CREATE POLICY "Users can view their own journal entries"
  ON public.player_journal_entries
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own journal entries"
  ON public.player_journal_entries
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own journal entries"
  ON public.player_journal_entries
  FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own journal entries"
  ON public.player_journal_entries
  FOR DELETE
  USING (auth.uid() = profile_id);

-- Service role policy for edge functions to create milestone entries
CREATE POLICY "Service role can manage all journal entries"
  ON public.player_journal_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for player_milestone_tracking
CREATE POLICY "Users can view their own milestone tracking"
  ON public.player_milestone_tracking
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Service role can manage all milestone tracking"
  ON public.player_milestone_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_journal_entries_profile_id ON public.player_journal_entries(profile_id);
CREATE INDEX idx_journal_entries_occurred_at ON public.player_journal_entries(occurred_at DESC);
CREATE INDEX idx_journal_entries_entry_type ON public.player_journal_entries(entry_type);
CREATE INDEX idx_journal_entries_band_id ON public.player_journal_entries(band_id);
CREATE INDEX idx_milestone_tracking_profile_id ON public.player_milestone_tracking(profile_id);
CREATE INDEX idx_milestone_tracking_type ON public.player_milestone_tracking(milestone_type);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.player_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();