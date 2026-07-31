-- Close the remaining canonical-evidence gaps in the seven supported Festival
-- progression effects.  Unsupported settlement effects intentionally remain
-- fail-closed in the dispatcher.

ALTER TABLE public.live_performance_outcomes
  ADD COLUMN festival_edition_id uuid REFERENCES public.festival_editions(id),
  ADD COLUMN raw_score_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN skipped_song_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN attendance_states jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN applied_at timestamptz NOT NULL DEFAULT clock_timestamp();

ALTER TABLE public.band_fan_progression_events ADD COLUMN applied_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.band_fame_progression_events ADD COLUMN applied_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.member_xp_transactions ADD COLUMN applied_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.song_performance_progression_events ADD COLUMN applied_at timestamptz NOT NULL DEFAULT clock_timestamp();

-- XP transactions are the Festival adapter ledger; profile_action_xp_events is
-- the shared player authority whose existing trigger updates player_xp_wallet
-- (available and lifetime XP).  The unique expression makes an interrupted
-- worker safe to replay before acknowledgement.
CREATE UNIQUE INDEX member_xp_action_event_stable_reference
  ON public.profile_action_xp_events ((metadata->>'stable_reference'))
  WHERE metadata ? 'stable_reference';

CREATE OR REPLACE FUNCTION public.apply_festival_member_xp_to_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE amount integer := coalesce((NEW.validated_change->>'xp')::integer, 0);
BEGIN
  IF amount <= 0 THEN RAISE EXCEPTION 'FESTIVAL_XP_AMOUNT_INVALID'; END IF;
  INSERT INTO public.profile_action_xp_events(profile_id,action_type,xp_amount,occurred_at,metadata)
  VALUES (NEW.subject_id,'gig_performance',amount,NEW.applied_at,
    jsonb_build_object('stable_reference',NEW.stable_reference,
      'performance_outcome_id',NEW.performance_outcome_id,
      'member_xp_transaction_id',NEW.id,'source_type',NEW.source_type,
      'source_id',NEW.source_id,'daily_category','performance'))
  ON CONFLICT ((metadata->>'stable_reference')) WHERE metadata ? 'stable_reference' DO NOTHING;
  -- The shipped Festival adapter has already maintained this compatibility
  -- projection.  profile_action_xp_events also maintains it, so compensate
  -- that trigger write while leaving the wallet and both immutable ledgers.
  IF FOUND THEN
    UPDATE public.profiles SET experience=greatest(0,coalesce(experience,0)-amount)
    WHERE id=NEW.subject_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER apply_festival_member_xp_to_wallet
AFTER INSERT ON public.member_xp_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_festival_member_xp_to_wallet();

-- A chemistry application is an aggregate, not an arbitrary member receipt.
CREATE TABLE public.live_performance_chemistry_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 performance_outcome_id uuid NOT NULL REFERENCES public.live_performance_outcomes(id),
 band_id uuid NOT NULL REFERENCES public.bands(id),
 stable_reference text NOT NULL UNIQUE,
 participating_profile_ids uuid[] NOT NULL,
 contribution_event_ids uuid[] NOT NULL,
 relationship_event_ids uuid[] NOT NULL,
 chemistry_snapshot_id uuid NOT NULL REFERENCES public.band_chemistry_snapshots(id),
 previous_chemistry integer NOT NULL,
 new_chemistry integer NOT NULL,
 rules_version text NOT NULL,
 evidence_digest text NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.live_performance_chemistry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_performance_chemistry_events FROM PUBLIC,anon,authenticated;

-- Canonical acknowledgement checks immutable event identity and the shared XP
-- wallet mutation.  Historic after-state is deliberately not compared with a
-- mutable current projection, so a later performance cannot break replay.
CREATE OR REPLACE FUNCTION public._festival_canonical_record_exists(p_table text,p_id uuid,p_result jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path='' AS $$
DECLARE ok boolean:=false;
BEGIN
 CASE p_table
  WHEN 'live_performance_outcomes' THEN SELECT EXISTS(SELECT 1 FROM public.live_performance_outcomes x WHERE x.id=p_id AND x.source_type=p_result->>'source_type' AND x.source_id=(p_result->>'source_id')::uuid AND x.performer_id=(p_result->>'subject_id')::uuid AND x.stable_reference=p_result->>'stable_reference' AND x.evidence_digest=p_result->>'evidence_digest') INTO ok;
  WHEN 'band_fan_progression_events' THEN SELECT EXISTS(SELECT 1 FROM public.band_fan_progression_events x WHERE x.id=p_id AND x.performance_outcome_id=(p_result->>'performance_outcome_id')::uuid AND x.subject_id=(p_result->>'subject_id')::uuid AND x.stable_reference=p_result->>'stable_reference' AND x.validated_change=p_result->'validated_change') INTO ok;
  WHEN 'band_fame_progression_events' THEN SELECT EXISTS(SELECT 1 FROM public.band_fame_progression_events x WHERE x.id=p_id AND x.performance_outcome_id=(p_result->>'performance_outcome_id')::uuid AND x.subject_id=(p_result->>'subject_id')::uuid AND x.stable_reference=p_result->>'stable_reference' AND x.validated_change=p_result->'validated_change' AND EXISTS(SELECT 1 FROM public.band_fame_history h WHERE h.band_id=x.subject_id AND h.event_type='festival_performance')) INTO ok;
  WHEN 'member_xp_transactions' THEN SELECT EXISTS(SELECT 1 FROM public.member_xp_transactions x JOIN public.player_xp_wallet w ON w.profile_id=x.subject_id JOIN public.profile_action_xp_events a ON a.metadata->>'stable_reference'=x.stable_reference WHERE x.id=p_id AND x.user_id=(SELECT user_id FROM public.profiles WHERE id=x.subject_id) AND a.xp_amount=(x.validated_change->>'xp')::integer AND w.lifetime_xp>=a.xp_amount) INTO ok;
  WHEN 'live_performance_chemistry_events' THEN SELECT EXISTS(SELECT 1 FROM public.live_performance_chemistry_events x JOIN public.band_chemistry_snapshots s ON s.id=x.chemistry_snapshot_id WHERE x.id=p_id AND x.stable_reference=p_result->>'stable_reference' AND cardinality(x.contribution_event_ids)=cardinality(x.participating_profile_ids) AND cardinality(x.relationship_event_ids)=(cardinality(x.participating_profile_ids)*(cardinality(x.participating_profile_ids)-1))/2) INTO ok;
  WHEN 'song_performance_progression_events' THEN SELECT EXISTS(SELECT 1 FROM public.song_performance_progression_events x WHERE x.id=p_id AND x.performance_outcome_id=(p_result->>'performance_outcome_id')::uuid AND x.subject_id=(p_result->>'subject_id')::uuid AND x.stable_reference=p_result->>'stable_reference' AND x.validated_change=p_result->'validated_change') INTO ok;
  ELSE ok:=false;
 END CASE;
 RETURN ok;
END $$;

REVOKE ALL ON FUNCTION public.apply_festival_member_xp_to_wallet(),
 public._festival_canonical_record_exists(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_festival_member_xp_to_wallet(),
 public._festival_canonical_record_exists(text,uuid,jsonb) TO service_role;
