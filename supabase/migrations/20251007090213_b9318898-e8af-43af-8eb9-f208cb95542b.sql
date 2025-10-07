-- Create universities table
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  prestige INTEGER DEFAULT 50 CHECK (prestige >= 0 AND prestige <= 100),
  quality_of_learning INTEGER DEFAULT 50 CHECK (quality_of_learning >= 0 AND quality_of_learning <= 100),
  course_cost_modifier NUMERIC DEFAULT 1.0 CHECK (course_cost_modifier >= 0.5 AND course_cost_modifier <= 2.0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(name, city)
);

-- Create university_courses table
CREATE TABLE IF NOT EXISTS public.university_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE NOT NULL,
  skill_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL CHECK (base_price >= 0),
  base_duration_days INTEGER DEFAULT 4 CHECK (base_duration_days > 0),
  required_skill_level INTEGER DEFAULT 0 CHECK (required_skill_level >= 0),
  xp_per_day_min INTEGER DEFAULT 1 CHECK (xp_per_day_min >= 1),
  xp_per_day_max INTEGER DEFAULT 3 CHECK (xp_per_day_max >= xp_per_day_min),
  max_enrollments INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create enrollment status enum
CREATE TYPE enrollment_status AS ENUM ('enrolled', 'in_progress', 'completed', 'dropped');

-- Create player_university_enrollments table
CREATE TABLE IF NOT EXISTS public.player_university_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.university_courses(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  scheduled_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  status enrollment_status DEFAULT 'enrolled',
  total_xp_earned INTEGER DEFAULT 0,
  days_attended INTEGER DEFAULT 0,
  payment_amount INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create player_university_attendance table
CREATE TABLE IF NOT EXISTS public.player_university_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.player_university_enrollments(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  xp_earned INTEGER NOT NULL CHECK (xp_earned >= 1 AND xp_earned <= 3),
  was_locked_out BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(enrollment_id, attendance_date)
);

-- Enable RLS on all tables
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_university_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_university_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for universities
CREATE POLICY "Universities are viewable by everyone"
  ON public.universities FOR SELECT
  USING (true);

-- RLS Policies for university_courses
CREATE POLICY "Courses are viewable by everyone"
  ON public.university_courses FOR SELECT
  USING (true);

-- RLS Policies for player_university_enrollments
CREATE POLICY "Users can view their own enrollments"
  ON public.player_university_enrollments FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own enrollments"
  ON public.player_university_enrollments FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own enrollments"
  ON public.player_university_enrollments FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for player_university_attendance
CREATE POLICY "Users can view their own attendance"
  ON public.player_university_attendance FOR SELECT
  USING (enrollment_id IN (
    SELECT id FROM player_university_enrollments 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_universities_updated_at
  BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_university_courses_updated_at
  BEFORE UPDATE ON public.university_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_university_enrollments_updated_at
  BEFORE UPDATE ON public.player_university_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial universities data
INSERT INTO public.universities (name, city, prestige, quality_of_learning, course_cost_modifier, description)
VALUES
  ('Rockmundo Conservatory', 'London', 92, 95, 1.5, 'Premier music institution with world-class faculty and state-of-the-art facilities.'),
  ('Skyline School of Sound', 'New York', 88, 90, 1.3, 'Cutting-edge music production and performance academy in the heart of NYC.'),
  ('Harbor Lights Institute', 'Portsmouth', 76, 82, 0.8, 'Affordable quality education focused on practical musicianship.'),
  ('Sunset Boulevard Music Academy', 'Los Angeles', 84, 87, 1.2, 'Industry-connected school with direct pathways to the entertainment business.'),
  ('Pulsewave Technology College', 'Toronto', 79, 85, 0.9, 'Modern approach to music technology and digital production.')
ON CONFLICT (name, city) DO UPDATE
SET 
  prestige = EXCLUDED.prestige,
  quality_of_learning = EXCLUDED.quality_of_learning,
  course_cost_modifier = EXCLUDED.course_cost_modifier,
  description = EXCLUDED.description;