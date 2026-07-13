-- Band chemistry, trust and relationship progression foundation
CREATE TABLE IF NOT EXISTS public.player_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_low_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_high_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  familiarity numeric NOT NULL DEFAULT 0 CHECK (familiarity >= 0 AND familiarity <= 100),
  trust numeric NOT NULL DEFAULT 50 CHECK (trust >= 0 AND trust <= 100),
  creative_chemistry numeric NOT NULL DEFAULT 0 CHECK (creative_chemistry >= 0 AND creative_chemistry <= 100),
  performance_chemistry numeric NOT NULL DEFAULT 0 CHECK (performance_chemistry >= 0 AND performance_chemistry <= 100),
  reliability_confidence numeric NOT NULL DEFAULT 50 CHECK (reliability_confidence >= 0 AND reliability_confidence <= 100),
  social_rapport numeric NOT NULL DEFAULT 0 CHECK (social_rapport >= 0 AND social_rapport <= 100),
  conflict numeric NOT NULL DEFAULT 0 CHECK (conflict >= 0 AND conflict <= 100),
  relationship_level text NOT NULL DEFAULT 'strangers' CHECK (relationship_level IN ('strangers','acquaintances','familiar','reliable_collaborators','trusted_partners','strong_chemistry','exceptional_partnership')),
  last_interaction_at timestamptz,
  last_positive_event_at timestamptz,
  last_negative_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_relationships_distinct_pair CHECK (player_low_id < player_high_id),
  CONSTRAINT player_relationships_unique_pair UNIQUE (player_low_id, player_high_id)
);

CREATE TABLE IF NOT EXISTS public.relationship_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES public.player_relationships(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_category text NOT NULL CHECK (event_category IN ('familiarity_gain','trust_gain','trust_loss','creative_gain','performance_gain','reliability_gain','reliability_loss','rapport_gain','conflict_gain','conflict_resolution','mixed')),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  impact jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relationship_events_unique_source UNIQUE (relationship_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.band_chemistry_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  cohesion numeric NOT NULL CHECK (cohesion >= 0 AND cohesion <= 100),
  creative_sync numeric NOT NULL CHECK (creative_sync >= 0 AND creative_sync <= 100),
  live_sync numeric NOT NULL CHECK (live_sync >= 0 AND live_sync <= 100),
  trust numeric NOT NULL CHECK (trust >= 0 AND trust <= 100),
  reliability numeric NOT NULL CHECK (reliability >= 0 AND reliability <= 100),
  conflict numeric NOT NULL CHECK (conflict >= 0 AND conflict <= 100),
  trend text NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving','stable','declining','new_lineup')),
  formula_version text NOT NULL DEFAULT 'relationship-v1',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS band_chemistry_snapshots_latest_idx ON public.band_chemistry_snapshots (band_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS player_relationships_low_high_idx ON public.player_relationships(player_low_id, player_high_id);
CREATE INDEX IF NOT EXISTS relationship_events_relationship_recent_idx ON public.relationship_events(relationship_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS relationship_events_source_idx ON public.relationship_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS band_chemistry_snapshots_band_recent_idx ON public.band_chemistry_snapshots(band_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS public.relationship_balance_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.relationship_balance_config(key,value,description) VALUES
('event_impacts', '{"rehearsal_completed":{"familiarity":2,"performance_chemistry":3,"trust":1},"jam_completed":{"familiarity":2,"creative_chemistry":3,"social_rapport":1},"songwriting_completed":{"familiarity":2,"creative_chemistry":4,"trust":1},"recording_completed":{"familiarity":1,"creative_chemistry":2,"performance_chemistry":2,"trust":2,"reliability_confidence":2},"gig_completed":{"familiarity":2,"performance_chemistry":4,"trust":2},"tour_date_completed":{"familiarity":3,"performance_chemistry":4,"trust":3,"reliability_confidence":2},"excused_absence":{"trust":0,"reliability_confidence":-1},"unexcused_absence":{"trust":-5,"reliability_confidence":-7,"conflict":3},"late_cancellation":{"trust":-3,"reliability_confidence":-4,"conflict":2},"missed_gig_no_notice":{"trust":-8,"reliability_confidence":-12,"conflict":6},"agreement_honoured":{"trust":3,"reliability_confidence":2},"agreement_dispute":{"trust":-6,"conflict":5},"governance_respectful_compromise":{"social_rapport":2,"conflict":-2},"governance_disagreement":{"familiarity":1},"conflict_resolved":{"trust":2,"social_rapport":2,"conflict":-8}}', 'Server-authoritative default impact map. Client UI never submits arbitrary impact values.'),
('caps_and_decay', '{"daily_positive_gain_cap":12,"weekly_positive_gain_cap":30,"repeat_window_days":7,"repeat_low_value_multiplier":0.35,"familiarity_decay_per_week":0,"trust_inactivity_days":90,"trust_decay_per_week":1,"creative_decay_per_week":0.5,"performance_decay_per_week":1,"conflict_decay_per_week":2,"modifier_caps":{"rehearsal_efficiency":0.10,"performance_consistency":0.08,"recording_efficiency":0.08,"songwriting_collaboration":0.10,"tour_stress_resistance":0.10}}', 'Anti-farming caps, gentle decay and mechanical effect caps.'),
('level_thresholds', '{"strangers":0,"acquaintances":20,"familiar":35,"reliable_collaborators":50,"trusted_partners":62,"strong_chemistry":75,"exceptional_partnership":88}', 'Derived relationship levels. Conflict and trust gates can prevent high levels despite one strong stat.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

CREATE OR REPLACE FUNCTION public.derive_relationship_level(familiarity numeric, trust numeric, creative numeric, performance numeric, reliability numeric, rapport numeric, conflict numeric)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE score numeric := (familiarity*0.18 + trust*0.22 + creative*0.16 + performance*0.16 + reliability*0.18 + rapport*0.10) - (conflict*0.35);
BEGIN
  IF conflict >= 70 OR trust < 25 THEN RETURN 'strangers'; END IF;
  IF score >= 88 AND trust >= 75 AND reliability >= 65 AND conflict < 25 THEN RETURN 'exceptional_partnership'; END IF;
  IF score >= 75 AND trust >= 65 AND conflict < 35 THEN RETURN 'strong_chemistry'; END IF;
  IF score >= 62 AND trust >= 60 AND reliability >= 55 AND conflict < 45 THEN RETURN 'trusted_partners'; END IF;
  IF score >= 50 AND reliability >= 50 AND conflict < 55 THEN RETURN 'reliable_collaborators'; END IF;
  IF score >= 35 THEN RETURN 'familiar'; END IF;
  IF score >= 20 THEN RETURN 'acquaintances'; END IF;
  RETURN 'strangers';
END; $$;

CREATE OR REPLACE FUNCTION public.record_relationship_event(p_player_a uuid, p_player_b uuid, p_event_type text, p_event_category text, p_source_type text, p_source_id uuid, p_impact jsonb DEFAULT '{}'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb, p_occurred_at timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE low_id uuid; high_id uuid; rel_id uuid; inserted_id uuid; key text; new_level text; positive boolean;
BEGIN
  IF p_player_a IS NULL OR p_player_b IS NULL OR p_player_a = p_player_b THEN RAISE EXCEPTION 'relationship requires two distinct players'; END IF;
  low_id := LEAST(p_player_a, p_player_b); high_id := GREATEST(p_player_a, p_player_b);
  key := concat_ws(':', p_source_type, p_source_id::text, p_event_type, p_event_category);
  INSERT INTO public.player_relationships(player_low_id, player_high_id, last_interaction_at) VALUES (low_id, high_id, p_occurred_at)
  ON CONFLICT (player_low_id, player_high_id) DO UPDATE SET last_interaction_at = GREATEST(coalesce(player_relationships.last_interaction_at, p_occurred_at), p_occurred_at), updated_at = now()
  RETURNING id INTO rel_id;
  INSERT INTO public.relationship_events(relationship_id,event_type,event_category,source_type,source_id,idempotency_key,impact,metadata,occurred_at)
  VALUES (rel_id,p_event_type,p_event_category,p_source_type,p_source_id,key,p_impact,p_metadata,p_occurred_at)
  ON CONFLICT (relationship_id, idempotency_key) DO NOTHING RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN rel_id; END IF;
  positive := coalesce((p_impact->>'trust')::numeric,0) + coalesce((p_impact->>'familiarity')::numeric,0) + coalesce((p_impact->>'creative_chemistry')::numeric,0) + coalesce((p_impact->>'performance_chemistry')::numeric,0) + coalesce((p_impact->>'reliability_confidence')::numeric,0) + coalesce((p_impact->>'social_rapport')::numeric,0) - coalesce((p_impact->>'conflict')::numeric,0) >= 0;
  UPDATE public.player_relationships SET
    familiarity = LEAST(100, GREATEST(0, familiarity + coalesce((p_impact->>'familiarity')::numeric,0))),
    trust = LEAST(100, GREATEST(0, trust + coalesce((p_impact->>'trust')::numeric,0))),
    creative_chemistry = LEAST(100, GREATEST(0, creative_chemistry + coalesce((p_impact->>'creative_chemistry')::numeric,0))),
    performance_chemistry = LEAST(100, GREATEST(0, performance_chemistry + coalesce((p_impact->>'performance_chemistry')::numeric,0))),
    reliability_confidence = LEAST(100, GREATEST(0, reliability_confidence + coalesce((p_impact->>'reliability_confidence')::numeric,0))),
    social_rapport = LEAST(100, GREATEST(0, social_rapport + coalesce((p_impact->>'social_rapport')::numeric,0))),
    conflict = LEAST(100, GREATEST(0, conflict + coalesce((p_impact->>'conflict')::numeric,0))),
    last_positive_event_at = CASE WHEN positive THEN p_occurred_at ELSE last_positive_event_at END,
    last_negative_event_at = CASE WHEN NOT positive THEN p_occurred_at ELSE last_negative_event_at END,
    updated_at = now()
  WHERE id = rel_id;
  UPDATE public.player_relationships SET relationship_level = public.derive_relationship_level(familiarity, trust, creative_chemistry, performance_chemistry, reliability_confidence, social_rapport, conflict) WHERE id = rel_id;
  RETURN rel_id;
END; $$;

CREATE OR REPLACE FUNCTION public.recalculate_band_chemistry(p_band_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE snap_id uuid; member_count int; pair_count int; avg_strength numeric; weak_link numeric; avg_creative numeric; avg_live numeric; avg_trust numeric; avg_reliability numeric; avg_conflict numeric; cohesion_value numeric; previous numeric; trend_value text;
BEGIN
  SELECT count(*) INTO member_count FROM public.band_members WHERE band_id = p_band_id AND coalesce(member_status,'active') IN ('active','trial') AND coalesce(is_touring_member,false) = false;
  WITH members AS (SELECT user_id::uuid AS profile_id FROM public.band_members WHERE band_id = p_band_id AND coalesce(member_status,'active') IN ('active','trial') AND coalesce(is_touring_member,false) = false AND user_id IS NOT NULL), pairs AS (
    SELECT r.* FROM public.player_relationships r JOIN members a ON a.profile_id = r.player_low_id JOIN members b ON b.profile_id = r.player_high_id
  ), scored AS (
    SELECT ((familiarity*0.12 + trust*0.24 + creative_chemistry*0.16 + performance_chemistry*0.18 + reliability_confidence*0.20 + social_rapport*0.10) - conflict*0.30) AS strength, * FROM pairs
  ) SELECT count(*), coalesce(avg(strength), CASE WHEN member_count < 2 THEN 50 ELSE 25 END), coalesce(min(strength), CASE WHEN member_count < 2 THEN 50 ELSE 25 END), coalesce(avg(creative_chemistry),0), coalesce(avg(performance_chemistry),0), coalesce(avg(trust),50), coalesce(avg(reliability_confidence),50), coalesce(avg(conflict),0)
  INTO pair_count, avg_strength, weak_link, avg_creative, avg_live, avg_trust, avg_reliability, avg_conflict FROM scored;
  cohesion_value := LEAST(100, GREATEST(0, (avg_strength*0.58) + (weak_link*0.27) + (LEAST(100, member_count*12)*0.05) + (CASE WHEN member_count <= 2 THEN 6 WHEN member_count <= 5 THEN 0 ELSE -3 END) - (avg_conflict*0.10)));
  SELECT cohesion INTO previous FROM public.band_chemistry_snapshots WHERE band_id = p_band_id ORDER BY calculated_at DESC LIMIT 1;
  trend_value := CASE WHEN previous IS NULL THEN 'new_lineup' WHEN cohesion_value >= previous + 3 THEN 'improving' WHEN cohesion_value <= previous - 3 THEN 'declining' ELSE 'stable' END;
  INSERT INTO public.band_chemistry_snapshots(band_id, cohesion, creative_sync, live_sync, trust, reliability, conflict, trend, metadata)
  VALUES (p_band_id, cohesion_value, avg_creative, avg_live, avg_trust, avg_reliability, avg_conflict, trend_value, jsonb_build_object('formula','58% average relationship strength + 27% weakest significant pairing + participation/band-size adjustment - conflict pressure','member_count',member_count,'pair_count',pair_count,'weak_link',weak_link)) RETURNING id INTO snap_id;
  UPDATE public.bands SET chemistry_level = round(cohesion_value)::int, cohesion_score = round(cohesion_value)::int, last_chemistry_update = now() WHERE id = p_band_id;
  RETURN snap_id;
END; $$;

ALTER TABLE public.player_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_chemistry_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_balance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view involved relationships" ON public.player_relationships FOR SELECT USING (player_low_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR player_high_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.band_members bm1 JOIN public.band_members bm2 ON bm1.band_id = bm2.band_id WHERE bm1.user_id IN (player_low_id, player_high_id) AND bm2.user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Players can view permitted relationship events" ON public.relationship_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.player_relationships r WHERE r.id = relationship_id AND (r.player_low_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR r.player_high_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))));
CREATE POLICY "Band members can view chemistry snapshots" ON public.band_chemistry_snapshots FOR SELECT USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid() OR user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Relationship balance config readable by authenticated users" ON public.relationship_balance_config FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.player_relationships IS 'Canonical pairwise player relationship dimensions. Existing bands.chemistry_level/cohesion_score are preserved as derived band snapshots, not duplicated as the source of truth.';
COMMENT ON TABLE public.relationship_events IS 'Server-generated idempotent relationship progression ledger. Source uniqueness prevents replayed activities from farming gains.';
COMMENT ON TABLE public.band_chemistry_snapshots IS 'Derived band-wide cohesion snapshots with weak-link-aware formula and descriptive trend.';
