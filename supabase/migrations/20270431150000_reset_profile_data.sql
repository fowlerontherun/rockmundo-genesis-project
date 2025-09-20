-- Migration: 20270431150000_reset_profile_data
-- SAFETY NOTE: This migration performs a full reset of profile-related progression data
-- ahead of the new profile flow rollout. It truncates all XP, attribute, and skill tables
-- before clearing the profile records themselves. Only run this in environments where a
-- complete player reset is acceptable.

BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Resetting all profile-linked tables prior to deleting profile rows.';
  RAISE NOTICE 'This will truncate XP, attribute, skill, and wallet tables and restart their sequences.';
END;
$$;

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

-- Truncate profiles last so any remaining foreign-key dependencies are cleared via CASCADE.
TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;

COMMIT;
