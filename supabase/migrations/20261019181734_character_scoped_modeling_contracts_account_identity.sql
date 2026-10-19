-- #4232: User account identity is auth.users.id; modeling offer identity is profiles.id.
ALTER TABLE public.player_modeling_contracts ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Backfill only unequivocal single-character accounts. Never assign an
-- existing contract to an arbitrary character of a multi-character account.
DO $backfill$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.player_modeling_contracts m
  WHERE m.profile_id IS NULL AND
    (SELECT count(*) FROM public.profiles p
     WHERE p.user_id=m.user_id AND p.deleted_at IS NULL)<>1
 ) THEN RAISE EXCEPTION 'modeling_contract_identity_ambiguous_backfill'; END IF;
 UPDATE public.player_modeling_contracts m
 SET profile_id=(SELECT p.id FROM public.profiles p
   WHERE p.user_id=m.user_id AND p.deleted_at IS NULL
   ORDER BY p.created_at LIMIT 1)
 WHERE m.profile_id IS NULL;
END $backfill$;
ALTER TABLE public.player_modeling_contracts ALTER COLUMN profile_id SET NOT NULL;

DO $constraint$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.player_modeling_contracts'::regclass
      AND conname='player_modeling_contracts_profile_id_fkey')
 THEN
 ALTER TABLE public.player_modeling_contracts
   ADD CONSTRAINT player_modeling_contracts_profile_id_fkey
     FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
 END IF;
END $constraint$;
CREATE INDEX IF NOT EXISTS idx_player_modeling_contracts_profile_status
 ON public.player_modeling_contracts(profile_id,status,created_at DESC);

ALTER TABLE public.player_modeling_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_contracts_insert ON public.player_modeling_contracts;
DROP POLICY IF EXISTS user_contracts_select ON public.player_modeling_contracts;
DROP POLICY IF EXISTS user_contracts_update ON public.player_modeling_contracts;
CREATE POLICY user_contracts_insert ON public.player_modeling_contracts
 FOR INSERT TO authenticated WITH CHECK (
 user_id=(SELECT auth.uid())
 AND EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
               AND p.deleted_at IS NULL));
CREATE POLICY user_contracts_select ON public.player_modeling_contracts
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY user_contracts_update ON public.player_modeling_contracts
 FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid()))
 WITH CHECK (
 user_id=(SELECT auth.uid())
 AND EXISTS(SELECT 1 FROM public.profiles p
            WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
              AND p.deleted_at IS NULL));

CREATE OR REPLACE FUNCTION public.prevent_modeling_contract_identity_swap()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
BEGIN
 IF (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id)
   AND COALESCE(auth.role(),'') <> 'service_role'
 THEN RAISE EXCEPTION 'modeling_contract_identity_immutable'; END IF;
 RETURN NEW;
END $guard$;
DROP TRIGGER IF EXISTS trg_modeling_contract_identity_immutable
 ON public.player_modeling_contracts;
CREATE TRIGGER trg_modeling_contract_identity_immutable
 BEFORE UPDATE ON public.player_modeling_contracts
 FOR EACH ROW EXECUTE FUNCTION public.prevent_modeling_contract_identity_swap();
