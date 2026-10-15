-- Legacy skill-book inventory is empty in production and has no
-- current client-side writer. Protect reward-bearing fields before
-- introducing any future completion/payout RPC.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.player_skill_books
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.player_skill_books TO authenticated;
ALTER TABLE public.player_skill_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own books"
  ON public.player_skill_books;
DROP POLICY IF EXISTS "Users can view their own books"
  ON public.player_skill_books;
DROP POLICY IF EXISTS player_skill_books_select_owned
  ON public.player_skill_books;
CREATE POLICY player_skill_books_select_owned ON public.player_skill_books
FOR SELECT TO authenticated
USING (
  user_id=(select auth.uid())
  AND profile_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=profile_id
       AND p.user_id=(select auth.uid()) AND p.deleted_at IS NULL
  )
);
COMMIT;