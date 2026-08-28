-- The banking repair routes all balance mutations through caller-scoped RPCs.
-- Keep owner reads available while removing the obsolete permissive ALL policy,
-- and make the internal idempotency table's deny-by-default posture explicit.

DROP POLICY IF EXISTS "Player banking operations deny direct access"
  ON public.player_banking_operations;
CREATE POLICY "Player banking operations deny direct access"
  ON public.player_banking_operations
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users manage own bank accounts" ON public.bank_accounts';
    EXECUTE 'DROP POLICY IF EXISTS "Users read own bank accounts" ON public.bank_accounts';
    EXECUTE $policy$
      CREATE POLICY "Users read own bank accounts"
        ON public.bank_accounts
        FOR SELECT
        TO authenticated
        USING (
          profile_id IN (
            SELECT profile.id
            FROM public.profiles profile
            WHERE profile.user_id = (SELECT auth.uid())
          )
        )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Users read own bank tx" ON public.bank_transactions';
    EXECUTE $policy$
      CREATE POLICY "Users read own bank tx"
        ON public.bank_transactions
        FOR SELECT
        TO authenticated
        USING (
          profile_id IN (
            SELECT profile.id
            FROM public.profiles profile
            WHERE profile.user_id = (SELECT auth.uid())
          )
        )
    $policy$;
  END IF;
END;
$legacy$;

NOTIFY pgrst, 'reload schema';
