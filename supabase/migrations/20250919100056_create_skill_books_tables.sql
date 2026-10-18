-- Create skill books to support education rewards
CREATE TABLE IF NOT EXISTS public.skill_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_slug text NOT NULL REFERENCES public.skills(skill_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cost numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  xp_value integer NOT NULL DEFAULT 10 CHECK (xp_value >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT skill_books_skill_slug_unique UNIQUE (skill_slug)
);

CREATE INDEX IF NOT EXISTS skill_books_skill_slug_idx
  ON public.skill_books (skill_slug);

ALTER TABLE public.skill_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Skill books are viewable by everyone" ON public.skill_books;
CREATE POLICY "Skill books are viewable by everyone"
  ON public.skill_books
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service roles can manage skill books" ON public.skill_books;
CREATE POLICY "Service roles can manage skill books"
  ON public.skill_books
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_skill_books_updated_at
  BEFORE UPDATE ON public.skill_books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Track player ownership and consumption of skill books
CREATE TABLE IF NOT EXISTS public.player_skill_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_book_id uuid NOT NULL REFERENCES public.skill_books(id) ON DELETE CASCADE,
  owned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  consumed_at timestamptz,
  is_consumed boolean NOT NULL DEFAULT false,
  CONSTRAINT player_skill_books_unique_user UNIQUE (user_id, skill_book_id)
);

CREATE INDEX IF NOT EXISTS player_skill_books_user_id_idx
  ON public.player_skill_books (user_id);

CREATE INDEX IF NOT EXISTS player_skill_books_profile_id_idx
  ON public.player_skill_books (profile_id);

CREATE INDEX IF NOT EXISTS player_skill_books_skill_book_id_idx
  ON public.player_skill_books (skill_book_id);

ALTER TABLE public.player_skill_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view their skill books" ON public.player_skill_books;
CREATE POLICY "Players can view their skill books"
  ON public.player_skill_books
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Players can manage their skill books" ON public.player_skill_books;
CREATE POLICY "Players can manage their skill books"
  ON public.player_skill_books
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
