-- Redefine weekly bonus processing to use the xp_ledger table and retire the legacy experience_ledger table

BEGIN;

-- Ensure xp_ledger is protected by RLS and accessible to system roles
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'xp_ledger'
      AND policyname = 'XP ledger entries are viewable by owners'
  ) THEN
    CREATE POLICY "XP ledger entries are viewable by owners"
      ON public.xp_ledger FOR SELECT
      USING (
        auth.role() = 'service_role'
        OR auth.uid() = (
          SELECT user_id
          FROM public.profiles
          WHERE id = xp_ledger.profile_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'xp_ledger'
      AND policyname = 'System can insert xp ledger entries'
  ) THEN
    CREATE POLICY "System can insert xp ledger entries"
      ON public.xp_ledger FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END;
$$;

GRANT SELECT ON public.xp_ledger TO service_role;
GRANT INSERT ON public.xp_ledger TO service_role;

-- Replace the legacy table with a compatibility view backed by xp_ledger
DROP VIEW IF EXISTS public.experience_ledger;
DROP TABLE IF EXISTS public.experience_ledger;

CREATE VIEW public.experience_ledger AS
SELECT
  l.id,
  l.profile_id,
  p.user_id,
  l.xp_delta AS amount,
  l.event_type AS reason,
  COALESCE(l.metadata, '{}'::jsonb) AS metadata,
  l.created_at AS recorded_at
FROM public.xp_ledger AS l
JOIN public.profiles AS p ON p.id = l.profile_id;

COMMENT ON VIEW public.experience_ledger IS
  'Compatibility view mapping xp_ledger rows to the legacy experience_ledger schema.';

GRANT SELECT ON public.experience_ledger TO service_role;

-- Update weekly bonus function to record xp_ledger activity and wallet balances
CREATE OR REPLACE FUNCTION public.process_weekly_experience_bonus()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_profile RECORD;
  v_processed integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_xp_delta integer;
  v_bonus integer;
  v_new_streak integer;
  v_metadata jsonb;
  v_message text;
  v_wallet public.player_xp_wallet%ROWTYPE;
BEGIN
  FOR v_profile IN
    SELECT id,
           user_id,
           COALESCE(experience, 0) AS experience,
           COALESCE(experience_at_last_weekly_bonus, 0) AS experience_at_last_weekly_bonus,
           COALESCE(weekly_bonus_streak, 0) AS weekly_bonus_streak,
           last_weekly_bonus_at
    FROM public.profiles
  LOOP
    v_xp_delta := GREATEST(v_profile.experience - v_profile.experience_at_last_weekly_bonus, 0);

    IF v_xp_delta <= 0 THEN
      UPDATE public.profiles
      SET
        experience_at_last_weekly_bonus = v_profile.experience,
        last_weekly_bonus_at = v_now,
        weekly_bonus_metadata = jsonb_build_object(
          'last_bonus_delta', v_xp_delta,
          'last_bonus_awarded', 0,
          'updated_at', v_now
        )
      WHERE id = v_profile.id;
      CONTINUE;
    END IF;

    v_bonus := GREATEST((v_xp_delta / 5), 100);

    IF v_profile.last_weekly_bonus_at IS NULL
       OR v_profile.last_weekly_bonus_at >= v_now - INTERVAL '14 days' THEN
      v_new_streak := v_profile.weekly_bonus_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;

    INSERT INTO public.player_xp_wallet (profile_id)
    VALUES (v_profile.id)
    ON CONFLICT (profile_id) DO NOTHING;

    UPDATE public.player_xp_wallet
    SET
      xp_balance = GREATEST(xp_balance + v_bonus, 0),
      lifetime_xp = lifetime_xp + GREATEST(v_bonus, 0),
      last_recalculated = v_now
    WHERE profile_id = v_profile.id
    RETURNING * INTO v_wallet;

    IF NOT FOUND THEN
      SELECT * INTO v_wallet
      FROM public.player_xp_wallet
      WHERE profile_id = v_profile.id;
    END IF;

    v_metadata := jsonb_build_object(
      'experience_gained', v_xp_delta,
      'bonus_awarded', v_bonus,
      'streak', v_new_streak
    );

    UPDATE public.profiles
    SET
      experience = COALESCE(experience, 0) + v_bonus,
      experience_at_last_weekly_bonus = v_profile.experience + v_bonus,
      last_weekly_bonus_at = v_now,
      weekly_bonus_streak = v_new_streak,
      weekly_bonus_metadata = v_metadata || jsonb_build_object('updated_at', v_now),
      updated_at = v_now
    WHERE id = v_profile.id;

    INSERT INTO public.xp_ledger (
      profile_id,
      event_type,
      xp_delta,
      balance_after,
      attribute_points_delta,
      skill_points_delta,
      metadata
    )
    VALUES (
      v_profile.id,
      'weekly_bonus',
      v_bonus,
      COALESCE(v_wallet.xp_balance, 0),
      0,
      0,
      v_metadata
    );

    v_message := format(
      'Weekly rehearsal bonus awarded: %s XP bonus after gaining %s XP.',
      v_bonus,
      v_xp_delta
    );

    INSERT INTO public.activity_feed (
      user_id,
      profile_id,
      activity_type,
      message,
      metadata,
      created_at
    )
    VALUES (
      v_profile.user_id,
      v_profile.id,
      'weekly_bonus',
      v_message,
      v_metadata,
      v_now
    );

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

COMMENT ON FUNCTION public.process_weekly_experience_bonus() IS
  'Grants a weekly XP bonus based on experience gained since the previous run.';

GRANT EXECUTE ON FUNCTION public.process_weekly_experience_bonus() TO service_role;

COMMIT;
