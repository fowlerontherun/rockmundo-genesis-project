-- Replace 20261012235900_atomic_legacy_skill_book_completion.sql.
-- That historical SQL calls nonexistent progression_award_action_xp().
-- This repair uses live experience_ledger + player_xp_wallet, and never
-- inserts, backfills, purchases, or completes any book during deployment.
-- Production preflight: player_skill_books has 0 entries and direct browser
-- mutation privileges were already revoked by migration 20261015155319.

DO $preflight$
BEGIN
  IF to_regclass('public.player_skill_books') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.experience_ledger') IS NULL
     OR to_regclass('public.player_xp_wallet') IS NULL
  THEN RAISE EXCEPTION 'LEGACY_SKILL_BOOK_CANONICAL_SCHEMA_MISSING'; END IF;

  -- Do not enable rewards on top of untrusted existing inventory.
  IF EXISTS (SELECT 1 FROM public.player_skill_books) THEN
    RAISE EXCEPTION 'LEGACY_SKILL_BOOK_INVENTORY_NOT_EMPTY_REVIEW_PROVENANCE';
  END IF;

  IF has_table_privilege('authenticated','public.player_skill_books','INSERT')
     OR has_table_privilege('authenticated','public.player_skill_books','UPDATE')
     OR has_table_privilege('authenticated','public.player_skill_books','DELETE')
  THEN RAISE EXCEPTION 'LEGACY_SKILL_BOOK_DIRECT_CLIENT_WRITES_NOT_LOCKED'; END IF;

  IF to_regprocedure('public.complete_legacy_skill_book_atomic(uuid,uuid)')
     IS NOT NULL THEN
    RAISE EXCEPTION 'LEGACY_SKILL_BOOK_COMPLETION_FUNCTION_ALREADY_EXISTS_RECONCILE';
  END IF;
END $preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS legacy_skill_book_ledger_inventory_unique
  ON public.experience_ledger ((metadata->>'inventory_book_id'))
  WHERE activity_type='legacy_skill_book'
    AND nullif(metadata->>'inventory_book_id','') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.complete_legacy_skill_book_atomic(
  p_profile_id uuid, p_book_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $complete$
DECLARE
  v_user uuid;
  v_book public.player_skill_books%ROWTYPE;
  v_ledger uuid;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL OR p_book_id IS NULL THEN
    RAISE EXCEPTION 'LEGACY_BOOK_OWNER_REQUIRED' USING ERRCODE='42501';
  END IF;

  -- Check active character identity and lock in consistent order with
  -- other canonical progression RPCs.
  SELECT p.user_id INTO v_user FROM public.profiles p
   WHERE p.id=p_profile_id AND p.user_id=auth.uid()
     AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR v_user IS NULL THEN
    RAISE EXCEPTION 'LEGACY_BOOK_PROFILE_NOT_OWNED' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_book FROM public.player_skill_books
   WHERE id=p_book_id AND profile_id=p_profile_id AND user_id=v_user
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEGACY_BOOK_NOT_OWNED' USING ERRCODE='42501';
  END IF;
  IF v_book.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'LEGACY_BOOK_ALREADY_COMPLETED' USING ERRCODE='55000';
  END IF;
  IF v_book.xp_reward IS NULL OR v_book.xp_reward NOT BETWEEN 1 AND 5000
     OR v_book.book_id IS NULL
     OR length(btrim(coalesce(v_book.book_title,''))) NOT BETWEEN 1 AND 240
     OR length(btrim(coalesce(v_book.skill_focus,''))) NOT BETWEEN 1 AND 100
     OR v_book.purchased_at IS NULL OR v_book.purchased_at>now()
  THEN RAISE EXCEPTION 'LEGACY_BOOK_REWARD_INVALID' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.experience_ledger l
    WHERE l.activity_type='legacy_skill_book'
      AND l.metadata->>'inventory_book_id'=v_book.id::text
  ) THEN
    RAISE EXCEPTION 'LEGACY_BOOK_LEDGER_ALREADY_EXISTS' USING ERRCODE='55000';
  END IF;

  -- Single transaction: unique ledger entry, wallet credit, inventory
  -- completion. A failure at any step rolls the whole call back.
  INSERT INTO public.experience_ledger
      (user_id,profile_id,activity_type,skill_slug,xp_amount,metadata)
  VALUES (
    v_user,p_profile_id,'legacy_skill_book',NULL,v_book.xp_reward,
    jsonb_build_object('inventory_book_id',v_book.id::text,
      'book_id',v_book.book_id,'book_title',v_book.book_title,
      'skill_focus',v_book.skill_focus,
      'unique_event_id','legacy-book:'||v_book.id::text)
  ) RETURNING id INTO v_ledger;

  INSERT INTO public.player_xp_wallet(profile_id) VALUES (p_profile_id)
   ON CONFLICT(profile_id) DO NOTHING;
  UPDATE public.player_xp_wallet w SET
    xp_balance=coalesce(w.xp_balance,0)+v_book.xp_reward,
    lifetime_xp=coalesce(w.lifetime_xp,0)+v_book.xp_reward,
    skill_xp_balance=coalesce(w.skill_xp_balance,0)+v_book.xp_reward,
    skill_xp_lifetime=coalesce(w.skill_xp_lifetime,0)+v_book.xp_reward,
    last_recalculated=now()
   WHERE w.profile_id=p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEGACY_BOOK_XP_WALLET_MISSING';
  END IF;

  UPDATE public.player_skill_books b SET
    completed_at=now(),progress_percentage=100
  WHERE b.id=v_book.id AND b.profile_id=p_profile_id
    AND b.completed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEGACY_BOOK_COMPLETION_RACE';
  END IF;

  RETURN jsonb_build_object('success',true,'bookId',v_book.book_id,
    'xpAwarded',v_book.xp_reward,'ledgerId',v_ledger);
END
$complete$;

REVOKE ALL ON FUNCTION public.complete_legacy_skill_book_atomic(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_legacy_skill_book_atomic(uuid,uuid)
  TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
