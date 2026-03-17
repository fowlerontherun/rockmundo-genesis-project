-- Expand awards to support invites, scripted run-of-show, and additional voter identities

ALTER TABLE public.award_shows
  ADD COLUMN IF NOT EXISTS host_name TEXT,
  ADD COLUMN IF NOT EXISTS host_intro TEXT,
  ADD COLUMN IF NOT EXISTS run_of_show JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.award_votes
  DROP CONSTRAINT IF EXISTS award_votes_voter_type_check;

ALTER TABLE public.award_votes
  ADD CONSTRAINT award_votes_voter_type_check
  CHECK (voter_type IN ('player', 'npc', 'jury', 'band', 'movement'));

CREATE TABLE IF NOT EXISTS public.award_show_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_show_id UUID NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('attendee', 'presenter', 'performer', 'nominee')),
  invitee_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
  category_name TEXT,
  response_status TEXT NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT award_show_invites_target_check CHECK (invitee_user_id IS NOT NULL OR invitee_band_id IS NOT NULL)
);

ALTER TABLE public.award_show_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Award invites are viewable by everyone"
  ON public.award_show_invites
  FOR SELECT
  USING (true);

CREATE POLICY "Invitees can respond to invites"
  ON public.award_show_invites
  FOR UPDATE
  USING (auth.uid() = invitee_user_id)
  WITH CHECK (auth.uid() = invitee_user_id);

CREATE INDEX IF NOT EXISTS idx_award_show_invites_show ON public.award_show_invites(award_show_id);
CREATE INDEX IF NOT EXISTS idx_award_show_invites_user ON public.award_show_invites(invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_award_show_invites_band ON public.award_show_invites(invitee_band_id);

-- Seed scripted metadata defaults for existing shows
UPDATE public.award_shows
SET host_name = COALESCE(host_name, 'Avery Stone'),
    host_intro = COALESCE(host_intro, 'Welcome to tonight\'s awards ceremony. We have unforgettable performances and envelope moments ahead.'),
    run_of_show = CASE
      WHEN jsonb_array_length(COALESCE(run_of_show, '[]'::jsonb)) > 0 THEN run_of_show
      ELSE jsonb_build_array(
        jsonb_build_object('type','host_intro','title','Host Welcome','commentary','The host welcomes the audience and introduces the first category.'),
        jsonb_build_object('type','award','title','Opening Category','presenter','Presenter 1','commentary','Presenter 1 introduces the category and announces nominees.'),
        jsonb_build_object('type','performance','title','Interlude Performance 1','performer','Neon Parade','songs',jsonb_build_array('Interlude Song 1'),'commentary','One-song interlude between award announcements.'),
        jsonb_build_object('type','award','title','Mid-Ceremony Category','presenter','Presenter 2','commentary','Another major category is introduced by the host and presenter.'),
        jsonb_build_object('type','performance','title','Interlude Performance 2','performer','Glass Anthem','songs',jsonb_build_array('Interlude Song 2'),'commentary','Another one-song performance while the stage resets.'),
        jsonb_build_object('type','award','title','Headliner Category','presenter','Presenter 3','commentary','Host and presenter reveal the headliner category winner.'),
        jsonb_build_object('type','performance','title','Grand Closing Performance','performer','Headliner Collective','songs',jsonb_build_array('Finale Song I','Finale Song II','Finale Song III'),'commentary','The closing act performs a three-song medley to end the show.')
      )
    END;
