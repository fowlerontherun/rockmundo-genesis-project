-- Create tables to track branching narrative progress
CREATE TABLE public.story_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  story_id text NOT NULL,
  current_node_id text NOT NULL,
  visited_node_ids text[] NOT NULL DEFAULT '{}'::text[],
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_states_user_story_unique UNIQUE (user_id, story_id)
);

CREATE TABLE public.story_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_state_id uuid NOT NULL REFERENCES public.story_states(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id text NOT NULL,
  node_id text NOT NULL,
  choice_id text NOT NULL,
  choice_label text,
  result_summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes for querying states and histories
CREATE INDEX story_states_user_story_idx ON public.story_states (user_id, story_id);
CREATE INDEX story_choices_state_idx ON public.story_choices (story_state_id);
CREATE INDEX story_choices_user_story_idx ON public.story_choices (user_id, story_id);

-- Enable row level security
ALTER TABLE public.story_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_choices ENABLE ROW LEVEL SECURITY;

-- Allow players to manage their own story progress
CREATE POLICY "Users manage their story states"
ON public.story_states FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow players to view their narrative choice history
CREATE POLICY "Users can view their story choices"
ON public.story_choices FOR SELECT
USING (
  auth.uid() = user_id
  OR story_state_id IN (
    SELECT id FROM public.story_states WHERE user_id = auth.uid()
  )
);

-- Allow players to record their story choices
CREATE POLICY "Users can insert their story choices"
ON public.story_choices FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND story_state_id IN (
    SELECT id FROM public.story_states WHERE user_id = auth.uid()
  )
);

-- Keep timestamps fresh on updates
CREATE TRIGGER update_story_states_updated_at
BEFORE UPDATE ON public.story_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_story_choices_updated_at
BEFORE UPDATE ON public.story_choices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
