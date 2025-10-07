-- Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  company_name VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  
  -- Compensation & Requirements
  hourly_wage INTEGER NOT NULL,
  required_level INTEGER DEFAULT 1,
  required_skills JSONB DEFAULT '{}',
  
  -- Impacts
  health_impact_per_shift INTEGER DEFAULT 0,
  fame_impact_per_shift INTEGER DEFAULT 0,
  energy_cost_per_shift INTEGER DEFAULT 10,
  
  -- Schedule
  work_days JSONB NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  max_employees INTEGER,
  current_employees INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create player employment table
CREATE TABLE public.player_employment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  status VARCHAR NOT NULL DEFAULT 'employed',
  hired_at TIMESTAMPTZ DEFAULT now(),
  terminated_at TIMESTAMPTZ,
  
  shifts_completed INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  last_shift_at TIMESTAMPTZ,
  
  UNIQUE(profile_id, job_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shift history table
CREATE TABLE public.shift_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_id UUID NOT NULL REFERENCES player_employment(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  shift_date DATE NOT NULL,
  clock_in_time TIMESTAMPTZ NOT NULL,
  clock_out_time TIMESTAMPTZ,
  
  earnings INTEGER NOT NULL,
  health_impact INTEGER DEFAULT 0,
  fame_impact INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  
  status VARCHAR DEFAULT 'in_progress',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs
CREATE POLICY "Jobs are viewable by everyone"
ON public.jobs
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert jobs"
ON public.jobs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update jobs"
ON public.jobs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete jobs"
ON public.jobs
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for player_employment
CREATE POLICY "Users can view their own employment"
ON public.player_employment
FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can apply for jobs"
ON public.player_employment
FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own employment"
ON public.player_employment
FOR UPDATE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for shift_history
CREATE POLICY "Users can view their own shift history"
ON public.shift_history
FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own shift records"
ON public.shift_history
FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own shift records"
ON public.shift_history
FOR UPDATE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_employment_updated_at
BEFORE UPDATE ON public.player_employment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample jobs
INSERT INTO public.jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, max_employees) VALUES
('Barista', 'Make coffee and serve customers at a local coffee shop. Early morning shifts available.', 'The Daily Grind', 'retail', 15, 1, -5, 0, 15, '["monday", "wednesday", "friday"]', '06:00', '12:00', 3),
('Retail Cashier', 'Handle transactions and assist customers at a music store.', 'Vinyl Records & More', 'retail', 18, 1, -3, 1, 10, '["tuesday", "thursday", "saturday"]', '14:00', '20:00', 5),
('Studio Assistant', 'Help set up recording sessions and maintain equipment.', 'SoundWave Studios', 'creative', 25, 3, -8, 3, 20, '["monday", "tuesday", "wednesday", "thursday", "friday"]', '18:00', '22:00', 2),
('Music Teacher', 'Teach beginner guitar lessons to students.', 'Rockmundo Music Academy', 'creative', 30, 5, -2, 5, 15, '["tuesday", "thursday"]', '15:00', '18:00', 4),
('Venue Security', 'Provide security at live music venues during events.', 'The Underground', 'manual_labor', 22, 2, -10, 2, 25, '["friday", "saturday"]', '20:00', '02:00', 6),
('Street Team Promoter', 'Hand out flyers and promote upcoming shows.', 'City Events Ltd', 'creative', 20, 1, -5, 8, 12, '["saturday", "sunday"]', '10:00', '16:00', 10);