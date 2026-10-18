-- Create tables for skill-linked books and player ownership tracking
CREATE TABLE IF NOT EXISTS public.skill_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  author text,
  description text,
  skill_slug text NOT NULL REFERENCES public.skill_definitions(slug) ON DELETE CASCADE,
  cost integer NOT NULL CHECK (cost >= 0),
  xp_reward integer NOT NULL DEFAULT 10 CHECK (xp_reward >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS skill_books_skill_slug_idx ON public.skill_books (skill_slug);

CREATE TABLE IF NOT EXISTS public.player_skill_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_book_id uuid NOT NULL REFERENCES public.skill_books(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  consumed_at timestamptz,
  xp_awarded_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (profile_id, skill_book_id)
);

CREATE INDEX IF NOT EXISTS player_skill_books_profile_idx
  ON public.player_skill_books (profile_id, skill_book_id);

ALTER TABLE public.skill_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skill_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Skill books are viewable by everyone" ON public.skill_books;
CREATE POLICY "Skill books are viewable by everyone"
  ON public.skill_books
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage skill books" ON public.skill_books;
CREATE POLICY "Privileged roles manage skill books"
  ON public.skill_books
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Players can view their skill books" ON public.player_skill_books;
CREATE POLICY "Players can view their skill books"
  ON public.player_skill_books
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = player_skill_books.profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Players can manage their skill books" ON public.player_skill_books;
CREATE POLICY "Players can manage their skill books"
  ON public.player_skill_books
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = player_skill_books.profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = player_skill_books.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER set_skill_books_updated_at
  BEFORE UPDATE ON public.skill_books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_player_skill_books_updated_at
  BEFORE UPDATE ON public.player_skill_books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default skill books aligned with the existing education experience
INSERT INTO public.skill_books (slug, title, author, description, skill_slug, cost, xp_reward)
SELECT * FROM (VALUES
  ('musicians-handbook', 'The Musician''s Handbook', 'Bobby Borg',
    'Establish a rock-solid foundation for navigating the industry and building sustainable habits.',
    'performance', 450, 10),
  ('music-theory-guitarists', 'Music Theory for Guitarists', 'Tom Kolb',
    'Translate theory concepts directly onto the fretboard with modern practice drills.',
    'guitar', 380, 10),
  ('effortless-mastery', 'Effortless Mastery', 'Kenny Werner',
    'Unlock flow-state practicing with techniques that balance discipline and creativity.',
    'performance', 320, 10),
  ('writing-better-lyrics', 'Writing Better Lyrics', 'Pat Pattison',
    'A semester-style guide to turning song ideas into compelling narratives.',
    'songwriting', 410, 10),
  ('tunesmith', 'Tunesmith', 'Jimmy Webb',
    'Legendary songwriting lessons from a Grammy-winning composer with exercises you can apply immediately.',
    'songwriting', 390, 10),
  ('songwriters-on-songwriting', 'Songwriters On Songwriting', 'Paul Zollo',
    'Dozens of interviews with iconic writers that reveal breakthrough moments and creative systems.',
    'composition', 360, 10),
  ('music-business', 'All You Need to Know About the Music Business', 'Donald Passman',
    'Understand contracts, royalties, and negotiation tactics before your next big opportunity.',
    'performance', 520, 10),
  ('creative-quest', 'Creative Quest', 'Questlove',
    'Blend artistry and entrepreneurship through stories from one of music''s most inventive minds.',
    'composition', 340, 10),
  ('new-music-business', 'How to Make It in the New Music Business', 'Ari Herstand',
    'A modern blueprint for self-managed releases, touring, and audience growth.',
    'technical', 480, 10)
) AS seed(slug, title, author, description, skill_slug, cost, xp_reward)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  author = EXCLUDED.author,
  description = EXCLUDED.description,
  skill_slug = EXCLUDED.skill_slug,
  cost = EXCLUDED.cost,
  xp_reward = EXCLUDED.xp_reward;
