
-- Gear gig history: permanent, public log of every gig each piece of gear was used at.

CREATE TABLE IF NOT EXISTS public.gear_gig_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_kind text NOT NULL CHECK (gear_kind IN ('band_stage','personal','player_equipment')),
  gear_id uuid NOT NULL,
  gear_name text NOT NULL,
  gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  band_id uuid,
  band_name text,
  venue_id uuid,
  venue_name text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  owner_user_id uuid,
  owner_band_id uuid,
  entry_source text NOT NULL DEFAULT 'auto' CHECK (entry_source IN ('auto','manual')),
  notes text,
  logged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gear_gig_history_gear ON public.gear_gig_history(gear_kind, gear_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gear_gig_history_gig ON public.gear_gig_history(gig_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gear_gig_auto ON public.gear_gig_history(gear_kind, gear_id, gig_id) WHERE entry_source = 'auto' AND gig_id IS NOT NULL;

GRANT SELECT ON public.gear_gig_history TO anon;
GRANT SELECT, INSERT ON public.gear_gig_history TO authenticated;
GRANT ALL ON public.gear_gig_history TO service_role;

ALTER TABLE public.gear_gig_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gear gig history is publicly viewable"
  ON public.gear_gig_history FOR SELECT
  USING (true);

-- Only the current owner of the gear can manually add an entry (INSERT via RPC below).
-- Direct inserts are still allowed for authenticated users but constrained to matching ownership.
CREATE POLICY "Owners can insert their own gear history"
  ON public.gear_gig_history FOR INSERT
  TO authenticated
  WITH CHECK (
    entry_source = 'manual'
    AND logged_by = auth.uid()
    AND (
      (gear_kind = 'personal' AND EXISTS (
        SELECT 1 FROM public.player_personal_gear g
        WHERE g.id = gear_id AND g.user_id = auth.uid()
      ))
      OR (gear_kind = 'player_equipment' AND EXISTS (
        SELECT 1 FROM public.player_equipment g
        WHERE g.id = gear_id AND g.user_id = auth.uid()
      ))
      OR (gear_kind = 'band_stage' AND EXISTS (
        SELECT 1
        FROM public.band_stage_equipment bse
        JOIN public.band_members bm ON bm.band_id = bse.band_id
        WHERE bse.id = gear_id AND bm.user_id = auth.uid()
      ))
    )
  );

-- Auto-log trigger: when a gig transitions to completed, snapshot all active gear used.
CREATE OR REPLACE FUNCTION public.auto_log_gear_for_completed_gig()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band_name text;
  v_venue_name text;
BEGIN
  IF NEW.status <> 'completed' OR COALESCE(OLD.status,'') = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_band_name FROM public.bands WHERE id = NEW.band_id;
  SELECT name INTO v_venue_name FROM public.venues WHERE id = NEW.venue_id;

  -- Band stage equipment (all active pieces owned by the band)
  INSERT INTO public.gear_gig_history (
    gear_kind, gear_id, gear_name, gig_id, band_id, band_name, venue_id, venue_name,
    performed_at, owner_band_id, entry_source
  )
  SELECT
    'band_stage', bse.id, bse.equipment_name, NEW.id, NEW.band_id, v_band_name,
    NEW.venue_id, v_venue_name, COALESCE(NEW.scheduled_date, now()), NEW.band_id, 'auto'
  FROM public.band_stage_equipment bse
  WHERE bse.band_id = NEW.band_id AND COALESCE(bse.is_active, true) = true
  ON CONFLICT DO NOTHING;

  -- Personal gear (equipped) for every band member
  INSERT INTO public.gear_gig_history (
    gear_kind, gear_id, gear_name, gig_id, band_id, band_name, venue_id, venue_name,
    performed_at, owner_user_id, entry_source
  )
  SELECT
    'personal', pg.id, pg.gear_name, NEW.id, NEW.band_id, v_band_name,
    NEW.venue_id, v_venue_name, COALESCE(NEW.scheduled_date, now()), pg.user_id, 'auto'
  FROM public.band_members bm
  JOIN public.player_personal_gear pg ON pg.user_id = bm.user_id
  WHERE bm.band_id = NEW.band_id AND COALESCE(pg.is_equipped, false) = true
  ON CONFLICT DO NOTHING;

  -- Equipped shop equipment for every band member
  INSERT INTO public.gear_gig_history (
    gear_kind, gear_id, gear_name, gig_id, band_id, band_name, venue_id, venue_name,
    performed_at, owner_user_id, entry_source
  )
  SELECT
    'player_equipment', pe.id, COALESCE(ei.name, 'Equipment'), NEW.id, NEW.band_id, v_band_name,
    NEW.venue_id, v_venue_name, COALESCE(NEW.scheduled_date, now()), pe.user_id, 'auto'
  FROM public.band_members bm
  JOIN public.player_equipment pe ON pe.user_id = bm.user_id
  LEFT JOIN public.equipment_items ei ON ei.id = pe.equipment_id
  WHERE bm.band_id = NEW.band_id AND COALESCE(pe.is_equipped, pe.equipped, false) = true
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_log_gear_for_gig ON public.gigs;
CREATE TRIGGER trg_auto_log_gear_for_gig
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_gear_for_completed_gig();

-- Manual RPC for owners to add historic gigs
CREATE OR REPLACE FUNCTION public.log_gear_gig_manual(
  p_gear_kind text,
  p_gear_id uuid,
  p_gig_id uuid,
  p_notes text DEFAULT NULL,
  p_performed_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_gear_name text;
  v_owner_user uuid;
  v_owner_band uuid;
  v_band_id uuid;
  v_band_name text;
  v_venue_id uuid;
  v_venue_name text;
  v_when timestamptz;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_gear_kind = 'personal' THEN
    SELECT gear_name, user_id INTO v_gear_name, v_owner_user
    FROM public.player_personal_gear WHERE id = p_gear_id;
  ELSIF p_gear_kind = 'player_equipment' THEN
    SELECT COALESCE(ei.name,'Equipment'), pe.user_id INTO v_gear_name, v_owner_user
    FROM public.player_equipment pe
    LEFT JOIN public.equipment_items ei ON ei.id = pe.equipment_id
    WHERE pe.id = p_gear_id;
  ELSIF p_gear_kind = 'band_stage' THEN
    SELECT equipment_name, band_id INTO v_gear_name, v_owner_band
    FROM public.band_stage_equipment WHERE id = p_gear_id;
  ELSE
    RAISE EXCEPTION 'Invalid gear_kind %', p_gear_kind;
  END IF;

  IF v_gear_name IS NULL THEN
    RAISE EXCEPTION 'Gear not found';
  END IF;

  -- Ownership check
  IF p_gear_kind IN ('personal','player_equipment') AND v_owner_user <> v_uid THEN
    RAISE EXCEPTION 'Only the current owner can log history for this gear';
  END IF;
  IF p_gear_kind = 'band_stage' AND NOT EXISTS (
    SELECT 1 FROM public.band_members bm WHERE bm.band_id = v_owner_band AND bm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Only band members can log history for band gear';
  END IF;

  IF p_gig_id IS NOT NULL THEN
    SELECT g.band_id, g.venue_id, g.scheduled_date, b.name, v.name
    INTO v_band_id, v_venue_id, v_when, v_band_name, v_venue_name
    FROM public.gigs g
    LEFT JOIN public.bands b ON b.id = g.band_id
    LEFT JOIN public.venues v ON v.id = g.venue_id
    WHERE g.id = p_gig_id;
  END IF;

  v_when := COALESCE(p_performed_at, v_when, now());

  INSERT INTO public.gear_gig_history (
    gear_kind, gear_id, gear_name, gig_id, band_id, band_name, venue_id, venue_name,
    performed_at, owner_user_id, owner_band_id, entry_source, notes, logged_by
  ) VALUES (
    p_gear_kind, p_gear_id, v_gear_name, p_gig_id, v_band_id, v_band_name, v_venue_id, v_venue_name,
    v_when, v_owner_user, v_owner_band, 'manual', p_notes, v_uid
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_gear_gig_manual(text,uuid,uuid,text,timestamptz) TO authenticated;
