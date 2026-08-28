-- Internal movements remain visible in transaction history, but they must not
-- appear as income or outgoings. Wrap the repaired legacy activity stream so
-- every non-cash-flow row has the explicit transfer direction.

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  )
  AND to_regprocedure('public._profile_finance_activity(uuid,text)') IS NOT NULL
  AND to_regprocedure('public._profile_finance_activity_raw(uuid,text)') IS NULL THEN
    ALTER FUNCTION public._profile_finance_activity(uuid, text)
      RENAME TO _profile_finance_activity_raw;

    EXECUTE $function$
      CREATE FUNCTION public._profile_finance_activity(
        p_profile_id uuid,
        p_currency_code text
      )
      RETURNS TABLE (
        activity_id text,
        activity_created_at timestamptz,
        activity_direction text,
        activity_source text,
        activity_amount_minor bigint,
        activity_description text,
        activity_currency_code text,
        activity_source_account_id uuid,
        activity_destination_account_id uuid,
        activity_related_entity_type text,
        activity_related_entity_id uuid,
        activity_external_cash_flow boolean
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog, public, extensions, pg_temp
      AS $$
        SELECT
          activity.activity_id,
          activity.activity_created_at,
          CASE
            WHEN NOT activity.activity_external_cash_flow THEN 'transfer'
            ELSE activity.activity_direction
          END,
          activity.activity_source,
          activity.activity_amount_minor,
          activity.activity_description,
          activity.activity_currency_code,
          activity.activity_source_account_id,
          activity.activity_destination_account_id,
          activity.activity_related_entity_type,
          activity.activity_related_entity_id,
          activity.activity_external_cash_flow
        FROM public._profile_finance_activity_raw(
          p_profile_id,
          p_currency_code
        ) activity
      $$
    $function$;

    REVOKE ALL ON FUNCTION public._profile_finance_activity(uuid, text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public._profile_finance_activity(uuid, text)
      TO service_role;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
