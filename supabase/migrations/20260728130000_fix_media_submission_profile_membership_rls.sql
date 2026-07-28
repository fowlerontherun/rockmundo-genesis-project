-- Character-scoped band memberships may not have an auth-level user_id.  Media
-- submission policies must therefore recognise the authenticated owner of the
-- membership's profile as well as legacy memberships linked directly by user_id.
DO $migration$
DECLARE
  submission_table text;
  insert_policy text;
BEGIN
  FOR submission_table, insert_policy IN
    SELECT *
    FROM (VALUES
      ('newspaper_submissions', 'Users can create newspaper submissions for their bands'),
      ('magazine_submissions', 'Users can create magazine submissions for their bands'),
      ('podcast_submissions', 'Users can create podcast submissions for their bands')
    ) AS policies(table_name, policy_name)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', insert_policy, submission_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.band_members AS bm
          LEFT JOIN public.profiles AS p ON p.id = bm.profile_id
          WHERE bm.band_id = %I.band_id
            AND (bm.user_id = auth.uid() OR p.user_id = auth.uid())
            AND COALESCE(bm.member_status, ''active'') = ''active''
        )
      )',
      insert_policy,
      submission_table,
      submission_table
    );
  END LOOP;
END
$migration$;
