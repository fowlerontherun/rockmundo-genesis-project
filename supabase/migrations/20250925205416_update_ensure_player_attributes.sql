-- Ensure the ensure_player_attributes trigger stays compatible with the
-- current player_attributes schema. Earlier versions of the trigger assumed
-- the key/value attribute layout and would fail once the table switched to
-- discrete attribute columns. This caused sign ups to error because the
-- trigger runs after a new profile is inserted.
CREATE OR REPLACE FUNCTION public.ensure_player_attributes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_inserted boolean := false;
  has_attribute_key boolean;
  has_user_id_column boolean;
BEGIN
  -- Detect which player_attributes schema we are operating against.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_attributes'
      AND column_name = 'attribute_key'
  )
  INTO has_attribute_key;

  IF has_attribute_key THEN
    -- Legacy key/value layout – seed stars for every catalog attribute.
    INSERT INTO public.player_attributes (profile_id, attribute_key, stars)
    SELECT NEW.id, ac.key, 0
    FROM public.attribute_catalog AS ac
    ON CONFLICT (profile_id, attribute_key) DO NOTHING;
  ELSE
    -- Modern wide-column layout – ensure the core row exists so defaults apply.
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'player_attributes'
        AND column_name = 'user_id'
    )
    INTO has_user_id_column;

    IF has_user_id_column THEN
      INSERT INTO public.player_attributes (user_id, profile_id)
      VALUES (NEW.user_id, NEW.id)
      ON CONFLICT (profile_id) DO NOTHING;
    ELSE
      INSERT INTO public.player_attributes (profile_id)
      VALUES (NEW.id)
      ON CONFLICT (profile_id) DO NOTHING;
    END IF;
  END IF;

  IF to_regclass('public.player_xp_wallet') IS NOT NULL THEN
    INSERT INTO public.player_xp_wallet (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;

    wallet_inserted := FOUND;

    IF wallet_inserted AND to_regclass('public.xp_ledger') IS NOT NULL THEN
      BEGIN
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
          NEW.id,
          'wallet_initialized',
          0,
          0,
          0,
          0,
          jsonb_build_object('source', 'ensure_player_attributes')
        );
      EXCEPTION
        WHEN check_violation THEN
          NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
