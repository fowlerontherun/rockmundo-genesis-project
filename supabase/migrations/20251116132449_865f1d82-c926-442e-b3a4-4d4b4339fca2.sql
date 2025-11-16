-- Create skill_improvements table to track skill gains
CREATE TABLE IF NOT EXISTS public.skill_improvements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  previous_value INTEGER NOT NULL,
  new_value INTEGER NOT NULL,
  improvement_amount INTEGER NOT NULL,
  improved_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skill_improvements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own skill improvements"
  ON public.skill_improvements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own skill improvements"
  ON public.skill_improvements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_skill_improvements_user_improved ON public.skill_improvements(user_id, improved_at DESC);

-- Create function to auto-track skill improvements
CREATE OR REPLACE FUNCTION track_skill_improvement()
RETURNS TRIGGER AS $$
DECLARE
  skill_col TEXT;
  old_val INTEGER;
  new_val INTEGER;
  skill_names TEXT[] := ARRAY['vocals', 'guitar', 'bass', 'drums', 'songwriting', 'performance', 'creativity', 'technical', 'composition'];
BEGIN
  FOREACH skill_col IN ARRAY skill_names
  LOOP
    EXECUTE format('SELECT ($1).%I, ($2).%I', skill_col, skill_col)
      INTO old_val, new_val
      USING OLD, NEW;
    
    IF new_val > old_val THEN
      INSERT INTO public.skill_improvements (
        user_id,
        skill_name,
        previous_value,
        new_value,
        improvement_amount,
        improved_at,
        source
      ) VALUES (
        NEW.user_id,
        skill_col,
        old_val,
        new_val,
        new_val - old_val,
        now(),
        'auto_tracked'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to track improvements
DROP TRIGGER IF EXISTS track_player_skills_improvements ON public.player_skills;
CREATE TRIGGER track_player_skills_improvements
  AFTER UPDATE ON public.player_skills
  FOR EACH ROW
  EXECUTE FUNCTION track_skill_improvement();