-- Reconcile Oct 9 skill quest payout migrations against the canonical
-- experience_ledger and player_xp_wallet. The historical versions depend on
-- missing profile_action_xp_events and xp_ledger and must not be replayed.
-- This migration defines a service-only function; it does not invoke it, turn
-- on any reward, schedule payouts or backfill historical claims.
DO $preflight$
BEGIN
  IF to_regclass('public.skill_quest_reward_claims') IS NULL
   OR to_regclass('public.skill_quest_reward_definitions') IS NULL
   OR to_regclass('public.skill_quest_events') IS NULL
   OR to_regclass('public.player_xp_wallet') IS NULL
   OR to_regclass('public.experience_ledger') IS NULL
   OR to_regclass('public.profiles') IS NULL
  THEN RAISE EXCEPTION 'SKILL_QUEST_CANONICAL_SCHEMA_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM public.skill_quest_reward_definitions WHERE enabled)
  THEN RAISE EXCEPTION 'SKILL_QUEST_REWARD_ACTIVATION_REQUIRES_SEPARATE_RELEASE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='experience_ledger'
      AND indexname='experience_ledger_quest_claim_unique'
      AND indexdef LIKE '%UNIQUE INDEX%'
  ) THEN RAISE EXCEPTION 'SKILL_QUEST_IDEMPOTENCY_INDEX_MISSING'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.process_skill_quest_xp_claim(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $payout$
DECLARE
 v_claim public.skill_quest_reward_claims%ROWTYPE;
 v_def public.skill_quest_reward_definitions%ROWTYPE;
 v_user_id uuid;
 v_ledger_id uuid;
BEGIN
 -- Never expose reward settlement as a player or anonymous RPC. In a
 -- SECURITY DEFINER function, current_user is not the calling JWT identity.
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_claim_id IS NULL THEN RAISE EXCEPTION 'CLAIM_ID_REQUIRED' USING ERRCODE='22023'; END IF;

 SELECT * INTO v_claim
 FROM public.skill_quest_reward_claims
 WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'QUEST_CLAIM_NOT_FOUND' USING ERRCODE='22023'; END IF;

 IF v_claim.status='granted' THEN
   IF v_claim.xp_ledger_id IS NULL OR v_claim.granted_at IS NULL OR NOT EXISTS (
     SELECT 1 FROM public.experience_ledger l
     WHERE l.id=v_claim.xp_ledger_id
       AND l.profile_id=v_claim.profile_id
       AND l.activity_type='skill_quest_reward'
       AND l.xp_amount=v_claim.reward_amount
       AND l.metadata->>'claim_id'=v_claim.id::text
       AND l.metadata->>'quest_id'=v_claim.quest_id
   ) THEN RAISE EXCEPTION 'QUEST_GRANTED_LEDGER_EVIDENCE_MISMATCH'; END IF;
   RETURN jsonb_build_object('status','already_granted',
     'claim_id',v_claim.id,'ledger_id',v_claim.xp_ledger_id);
 END IF;
 IF v_claim.status NOT IN ('pending','retry_required') THEN
   RAISE EXCEPTION 'QUEST_CLAIM_NOT_READY' USING ERRCODE='55000';
 END IF;

 SELECT * INTO v_def
 FROM public.skill_quest_reward_definitions
 WHERE quest_id=v_claim.quest_id FOR SHARE;
 IF NOT FOUND OR v_def.enabled IS DISTINCT FROM true
    OR v_def.reward_kind IS DISTINCT FROM 'xp'
    OR v_claim.reward_kind IS DISTINCT FROM 'xp'
    OR v_claim.reward_kind IS DISTINCT FROM v_def.reward_kind
    OR v_claim.reward_amount IS DISTINCT FROM v_def.reward_amount
    OR v_claim.reward_amount NOT BETWEEN 1 AND 5000
 THEN RAISE EXCEPTION 'QUEST_REWARD_NOT_ENABLED_OR_MISMATCHED'
    USING ERRCODE='42501'; END IF;

 IF NOT EXISTS (
  SELECT 1 FROM public.skill_quest_events e
  WHERE e.profile_id=v_claim.profile_id
    AND e.quest_id=v_claim.quest_id AND e.source_type=v_def.source_type
 ) THEN RAISE EXCEPTION 'QUEST_COMPLETION_EVIDENCE_MISSING'
   USING ERRCODE='22023'; END IF;

 SELECT user_id INTO v_user_id
 FROM public.profiles
 WHERE id=v_claim.profile_id
   AND is_active IS TRUE AND deleted_at IS NULL AND died_at IS NULL
 FOR UPDATE;
 IF NOT FOUND OR v_user_id IS NULL THEN
   RAISE EXCEPTION 'QUEST_CHARACTER_UNAVAILABLE' USING ERRCODE='42501';
 END IF;

 -- Reject stale bookkeeping. Never pay a claim for which a ledger event
 -- already exists, even if the claim status still says pending.
 IF EXISTS (
  SELECT 1 FROM public.experience_ledger l
  WHERE l.activity_type='skill_quest_reward'
    AND l.metadata->>'claim_id'=v_claim.id::text
 ) THEN RAISE EXCEPTION 'QUEST_XP_ALREADY_EXISTS_RECONCILE_FIRST'
   USING ERRCODE='55000'; END IF;

 INSERT INTO public.player_xp_wallet(profile_id) VALUES (v_claim.profile_id)
 ON CONFLICT(profile_id) DO NOTHING;

 -- Everything below is one SQL transaction, protected by the unique
 -- experience_ledger_quest_claim_unique index and claim/profile row locks.
 INSERT INTO public.experience_ledger
   (user_id,profile_id,activity_type,xp_amount,metadata)
 VALUES (
  v_user_id,v_claim.profile_id,'skill_quest_reward',v_claim.reward_amount,
  jsonb_build_object('claim_id',v_claim.id::text,'quest_id',v_claim.quest_id,
                     'source_type',v_def.source_type,'reward_kind','xp',
                     'unique_event_id','skill-quest:'||v_claim.id::text)
 ) RETURNING id INTO v_ledger_id;

 UPDATE public.player_xp_wallet
 SET xp_balance=coalesce(xp_balance,0)+v_claim.reward_amount,
     lifetime_xp=coalesce(lifetime_xp,0)+v_claim.reward_amount,
     skill_xp_balance=coalesce(skill_xp_balance,0)+v_claim.reward_amount,
     skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_claim.reward_amount,
     last_recalculated=now()
 WHERE profile_id=v_claim.profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'QUEST_WALLET_UPDATE_FAILED'; END IF;

 UPDATE public.skill_quest_reward_claims
 SET status='granted',xp_ledger_id=v_ledger_id,granted_at=now()
 WHERE id=v_claim.id AND status IN ('pending','retry_required');
 IF NOT FOUND THEN RAISE EXCEPTION 'QUEST_CLAIM_STATUS_RACE'; END IF;

 RETURN jsonb_build_object('status','granted','claim_id',v_claim.id,
   'ledger_id',v_ledger_id,'xp',v_claim.reward_amount);
END
$payout$;

REVOKE ALL ON FUNCTION public.process_skill_quest_xp_claim(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_skill_quest_xp_claim(uuid)
 TO service_role;

NOTIFY pgrst,'reload schema';
