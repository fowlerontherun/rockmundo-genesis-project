-- Historical one-off player reset from the retired 2025 profile flow.
-- CRITICAL: running ordinary migrations MUST NEVER delete player progression.
-- The original unconditional TRUNCATE CASCADE here both failed on a missing
-- legacy profile_attributes table in fresh CI and could erase live characters.
--
-- An intentional, externally approved destructive reset would require a
-- privileged migration session to explicitly enable
--   SET rockmundo.allow_profile_data_reset = 'on';
-- AND all listed legacy tables to exist. A dedicated audited reset workflow is
-- preferred; do not turn this switch on during db push, db reset, or deployment.
DO $legacy_reset$
DECLARE
  missing_tables text;
BEGIN
  IF current_setting('rockmundo.allow_profile_data_reset', true) IS DISTINCT FROM 'on' THEN
    RAISE NOTICE 'Skipping retired destructive profile reset (safe default).';
    RETURN;
  END IF;

  -- Fail closed BEFORE touching any table if the historical schema differs.
  SELECT string_agg(required.name, ', ' ORDER BY required.name)
    INTO missing_tables
  FROM unnest(ARRAY[
    'public.experience_ledger',
    'public.xp_ledger',
    'public.attribute_spend',
    'public.player_daily_cats',
    'public.player_weekly_activity',
    'public.player_skill_books',
    'public.player_skills',
    'public.profile_attributes',
    'public.player_attributes',
    'public.player_xp_wallet',
    'public.profiles'
  ]::text[]) AS required(name)
  WHERE to_regclass(required.name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Retired profile reset refused: required historical tables are missing: %', missing_tables;
  END IF;

  RAISE WARNING 'Explicit legacy profile reset authorised: deleting all profile-linked progression and profiles.';
  TRUNCATE TABLE
    public.experience_ledger,
    public.xp_ledger,
    public.attribute_spend,
    public.player_daily_cats,
    public.player_weekly_activity,
    public.player_skill_books,
    public.player_skills,
    public.profile_attributes,
    public.player_attributes,
    public.player_xp_wallet
  RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;
END;
$legacy_reset$;
