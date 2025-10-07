-- Create enum for reading session status
CREATE TYPE public.book_reading_status AS ENUM ('reading', 'completed', 'abandoned');

-- Create skill_books table
CREATE TABLE public.skill_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_slug TEXT NOT NULL REFERENCES public.skill_definitions(slug),
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  price INTEGER NOT NULL,
  base_reading_days INTEGER NOT NULL DEFAULT 3 CHECK (base_reading_days BETWEEN 2 AND 4),
  skill_percentage_gain NUMERIC NOT NULL DEFAULT 0.25 CHECK (skill_percentage_gain BETWEEN 0 AND 1),
  required_skill_level INTEGER NOT NULL DEFAULT 0,
  daily_reading_time INTEGER NOT NULL DEFAULT 60,
  reading_hour INTEGER NOT NULL DEFAULT 23 CHECK (reading_hour BETWEEN 0 AND 23),
  is_active BOOLEAN NOT NULL DEFAULT true,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create player_book_purchases table
CREATE TABLE public.player_book_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.skill_books(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  purchase_price INTEGER NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create player_book_reading_sessions table
CREATE TABLE public.player_book_reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.skill_books(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.player_book_purchases(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  status public.book_reading_status NOT NULL DEFAULT 'reading',
  total_skill_xp_earned INTEGER NOT NULL DEFAULT 0,
  days_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create player_book_reading_attendance table
CREATE TABLE public.player_book_reading_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_session_id UUID NOT NULL REFERENCES public.player_book_reading_sessions(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  skill_xp_earned INTEGER NOT NULL,
  was_locked_out BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (reading_session_id, reading_date)
);

-- Enable RLS
ALTER TABLE public.skill_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_book_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_book_reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_book_reading_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skill_books
CREATE POLICY "Books are viewable by everyone"
  ON public.skill_books FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert books"
  ON public.skill_books FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update books"
  ON public.skill_books FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete books"
  ON public.skill_books FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for player_book_purchases
CREATE POLICY "Users can view their own book purchases"
  ON public.player_book_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own book purchases"
  ON public.player_book_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book purchases"
  ON public.player_book_purchases FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for player_book_reading_sessions
CREATE POLICY "Users can view their own reading sessions"
  ON public.player_book_reading_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reading sessions"
  ON public.player_book_reading_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading sessions"
  ON public.player_book_reading_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for player_book_reading_attendance
CREATE POLICY "Users can view their own reading attendance"
  ON public.player_book_reading_attendance FOR SELECT
  USING (reading_session_id IN (
    SELECT id FROM public.player_book_reading_sessions
    WHERE user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_skill_books_updated_at
  BEFORE UPDATE ON public.skill_books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reading_sessions_updated_at
  BEFORE UPDATE ON public.player_book_reading_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial books (using existing skill slugs)
INSERT INTO public.skill_books (skill_slug, title, author, description, price, base_reading_days, category) VALUES
  ('basic_showmanship', 'The Musician''s Handbook', 'Bobby Borg', 'Establish a rock-solid foundation for navigating the industry and building sustainable habits.', 500, 3, 'Foundational Musicianship'),
  ('guitar_mastery', 'Music Theory for Guitarists', 'Tom Kolb', 'Translate theory concepts directly onto the fretboard with modern practice drills.', 450, 3, 'Foundational Musicianship'),
  ('professional_crowd_engagement', 'Effortless Mastery', 'Kenny Werner', 'Unlock flow-state practicing with techniques that balance discipline and creativity.', 400, 2, 'Foundational Musicianship'),
  ('professional_composing', 'Writing Better Lyrics', 'Pat Pattison', 'A semester-style guide to turning song ideas into compelling narratives.', 600, 4, 'Songwriting & Creativity'),
  ('composing_mastery', 'Tunesmith', 'Jimmy Webb', 'Legendary songwriting lessons from a Grammy-winning composer with exercises you can apply immediately.', 650, 4, 'Songwriting & Creativity'),
  ('basic_composing', 'Songwriters On Songwriting', 'Paul Zollo', 'Dozens of interviews with iconic writers that reveal breakthrough moments and creative systems.', 500, 3, 'Songwriting & Creativity'),
  ('crowd_engagement_mastery', 'All You Need to Know About the Music Business', 'Donald Passman', 'Understand contracts, royalties, and negotiation tactics before your next big opportunity.', 700, 4, 'Music Business & Branding'),
  ('professional_composing', 'Creative Quest', 'Questlove', 'Blend artistry and entrepreneurship through stories from one of music''s most inventive minds.', 550, 3, 'Music Business & Branding'),
  ('basic_social_media_performance', 'How to Make It in the New Music Business', 'Ari Herstand', 'A modern blueprint for self-managed releases, touring, and audience growth.', 600, 3, 'Music Business & Branding');