-- Festival owners may curate NPC filler acts independently of player artist contracts.
-- These rows remain editable after approval/launch and are projected into the public
-- line-up until the Festival has ended. Player offers/bookings remain untouched.

CREATE TABLE IF NOT EXISTS public.festival_owner_npc_lineup_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  genre text,
  fame integer NOT NULL DEFAULT 25 CHECK (fame BETWEEN 0 AND 1000000),
  set_minutes integer NOT NULL DEFAULT 45 CHECK (set_minutes BETWEEN 10 AND 240),
  festival_date date NOT NULL,
  stage_id uuid REFERENCES public.festival_site_plan_stages(id) ON DELETE SET NULL,
  billing_position text NOT NULL DEFAULT 'support' CHECK (billing_position IN ('headliner','sub_headliner','featured','support','emerging','special_guest')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS festival_owner_npc_lineup_edition_idx
  ON public.festival_owner_npc_lineup_acts(festival_edition_id, status, festival_date);

ALTER TABLE public.festival_owner_npc_lineup_acts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_owner_npc_lineup_acts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_festival_owner_npc_lineup_acts(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.festival_editions_v2 e
    WHERE e.id=p_festival_edition_id AND e.festival_company_id=p_festival_company_id
  ) THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE='P0001';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id',n.id,
      'displayName',n.display_name,
      'genre',n.genre,
      'fame',n.fame,
      'setMinutes',n.set_minutes,
      'festivalDate',n.festival_date,
      'stageId',n.stage_id,
      'billingPosition',n.billing_position,
      'status',n.status,
      'updatedAt',n.updated_at
    ) ORDER BY n.festival_date,
      CASE n.billing_position WHEN 'emerging' THEN 10 WHEN 'support' THEN 20 WHEN 'special_guest' THEN 30 WHEN 'featured' THEN 40 WHEN 'sub_headliner' THEN 50 WHEN 'headliner' THEN 60 ELSE 20 END,
      n.display_name)
    FROM public.festival_owner_npc_lineup_acts n
    WHERE n.festival_company_id=p_festival_company_id
      AND n.festival_edition_id=p_festival_edition_id
  ),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.upsert_festival_owner_npc_lineup_act(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_npc_act_id uuid,
  p_display_name text,
  p_genre text,
  p_fame integer,
  p_set_minutes integer,
  p_festival_date date,
  p_stage_id uuid,
  p_billing_position text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  row_value public.festival_owner_npc_lineup_acts%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE='P0001';
  END IF;
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'festival_idempotency_required' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO edition FROM public.festival_editions_v2 e
  WHERE e.id=p_festival_edition_id AND e.festival_company_id=p_festival_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE='P0001';
  END IF;

  -- Approval and launch are deliberately not blockers. Lock only once the edition is over.
  IF edition.ends_on IS NOT NULL AND edition.ends_on < current_date THEN
    RAISE EXCEPTION 'festival_npc_lineup_locked' USING ERRCODE='P0001';
  END IF;

  IF nullif(btrim(coalesce(p_display_name,'')),'') IS NULL
    OR p_fame NOT BETWEEN 0 AND 1000000
    OR p_set_minutes NOT BETWEEN 10 AND 240
    OR p_billing_position NOT IN ('headliner','sub_headliner','featured','support','emerging','special_guest')
    OR p_festival_date IS NULL
    OR p_festival_date < edition.starts_on
    OR p_festival_date > edition.ends_on
  THEN
    RAISE EXCEPTION 'festival_npc_lineup_invalid' USING ERRCODE='P0001';
  END IF;

  IF p_stage_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.festival_site_plan_stages st
    JOIN public.festival_site_plans sp ON sp.id=st.festival_site_plan_id
    WHERE st.id=p_stage_id AND sp.festival_edition_id=p_festival_edition_id
  ) THEN
    RAISE EXCEPTION 'festival_npc_lineup_stage_invalid' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_festival_company_id::text||':'||p_festival_edition_id::text||':npc-lineup:'||p_idempotency_key::text,0
  ));

  IF p_npc_act_id IS NULL THEN
    INSERT INTO public.festival_owner_npc_lineup_acts(
      festival_company_id,festival_edition_id,display_name,genre,fame,set_minutes,
      festival_date,stage_id,billing_position,created_by_profile_id
    ) VALUES (
      p_festival_company_id,p_festival_edition_id,btrim(p_display_name),nullif(btrim(coalesce(p_genre,'')),''),
      p_fame,p_set_minutes,p_festival_date,p_stage_id,p_billing_position,actor
    ) RETURNING * INTO row_value;
  ELSE
    UPDATE public.festival_owner_npc_lineup_acts n SET
      display_name=btrim(p_display_name),
      genre=nullif(btrim(coalesce(p_genre,'')),''),
      fame=p_fame,
      set_minutes=p_set_minutes,
      festival_date=p_festival_date,
      stage_id=p_stage_id,
      billing_position=p_billing_position,
      status='confirmed',
      updated_at=now()
    WHERE n.id=p_npc_act_id
      AND n.festival_company_id=p_festival_company_id
      AND n.festival_edition_id=p_festival_edition_id
    RETURNING * INTO row_value;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'festival_npc_lineup_not_found' USING ERRCODE='P0001';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id',row_value.id,'displayName',row_value.display_name,'genre',row_value.genre,
    'fame',row_value.fame,'setMinutes',row_value.set_minutes,'festivalDate',row_value.festival_date,
    'stageId',row_value.stage_id,'billingPosition',row_value.billing_position,'status',row_value.status,
    'updatedAt',row_value.updated_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.cancel_festival_owner_npc_lineup_act(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_npc_act_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  row_value public.festival_owner_npc_lineup_acts%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE='P0001';
  END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'festival_idempotency_required' USING ERRCODE='P0001'; END IF;

  UPDATE public.festival_owner_npc_lineup_acts n
  SET status='cancelled',updated_at=now()
  WHERE n.id=p_npc_act_id AND n.festival_company_id=p_festival_company_id AND n.festival_edition_id=p_festival_edition_id
  RETURNING * INTO row_value;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_npc_lineup_not_found' USING ERRCODE='P0001'; END IF;
  RETURN jsonb_build_object('id',row_value.id,'status',row_value.status);
END $$;

-- Include owner-curated NPC acts in the same public/attendee timetable projection used
-- by confirmed player artist bookings.
CREATE OR REPLACE FUNCTION public._festival_simplified_timetable_projection(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_timezone text := 'UTC';
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT coalesce(nullif(c.timezone,''),'UTC') INTO v_timezone
  FROM public.festival_editions_v2 e
  LEFT JOIN public.cities c ON c.id=e.city_id
  WHERE e.id=p_edition_id;

  WITH stages AS (
    SELECT st.id,st.name,st.sort_order
    FROM public.festival_site_plan_stages st
    JOIN public.festival_site_plans sp ON sp.id=st.festival_site_plan_id
    WHERE sp.festival_edition_id=p_edition_id AND st.status='ready'
    ORDER BY st.sort_order,st.id
  ), raw_booked AS (
    SELECT b.id,b.artist_type,b.artist_profile_id,b.band_id,b.npc_artist_id,b.set_minutes,b.billing_position,
           coalesce(b.provisional_date,e.starts_on) festival_date,b.confirmed_at ordering_time,
           coalesce(bd.name,pr.display_name,pr.username,'Confirmed act') artist_name,
           bd.genre,
           greatest(0,coalesce(bd.fame,pr.fame,0)) fame,
           b.provisional_stage_id
    FROM public.festival_artist_bookings b
    JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
    JOIN public.festival_editions_v2 e ON e.id=ap.festival_edition_id
    LEFT JOIN public.bands bd ON bd.id=b.band_id
    LEFT JOIN public.profiles pr ON pr.id=b.artist_profile_id
    WHERE ap.festival_edition_id=p_edition_id
      AND b.status NOT IN ('cancelled','withdrawn','artist_withdrawn','festival_cancelled')
      AND coalesce(b.provisional_date,e.starts_on) IS NOT NULL

    UNION ALL

    SELECT n.id,'npc'::text,NULL::uuid,NULL::uuid,n.id,n.set_minutes,n.billing_position,
           n.festival_date,n.updated_at,n.display_name,n.genre,n.fame,n.stage_id
    FROM public.festival_owner_npc_lineup_acts n
    WHERE n.festival_edition_id=p_edition_id AND n.status='confirmed'
  ), booked AS (
    SELECT r.*,
      row_number() OVER (
        PARTITION BY r.festival_date
        ORDER BY CASE r.billing_position WHEN 'emerging' THEN 10 WHEN 'support' THEN 20 WHEN 'special_guest' THEN 30 WHEN 'featured' THEN 40 WHEN 'sub_headliner' THEN 50 WHEN 'headliner' THEN 60 ELSE 20 END,
                 r.ordering_time,r.id
      ) rn
    FROM raw_booked r
  ), scheduled AS (
    SELECT b.*,
      coalesce(
        (SELECT s.id FROM stages s WHERE s.id=b.provisional_stage_id LIMIT 1),
        (SELECT s.id FROM stages s ORDER BY s.sort_order,s.id OFFSET ((b.rn-1)%greatest(1,(SELECT count(*) FROM stages))) LIMIT 1)
      ) stage_id,
      ((b.festival_date::timestamp + time '14:00')
        + make_interval(mins => (((b.rn-1)/greatest(1,(SELECT count(*) FROM stages)))::integer*90))) AT TIME ZONE v_timezone AS starts_at
    FROM booked b
    WHERE EXISTS(SELECT 1 FROM stages)
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'artistName',s.artist_name,
    'artistType',CASE WHEN s.band_id IS NOT NULL THEN 'band' WHEN s.artist_profile_id IS NOT NULL THEN 'player' ELSE 'npc' END,
    'artistId',coalesce(s.band_id,s.artist_profile_id,s.npc_artist_id),
    'genre',s.genre,
    'fame',s.fame,
    'stageId',s.stage_id,
    'stageName',coalesce((SELECT st.name FROM stages st WHERE st.id=s.stage_id),'Main Stage'),
    'festivalDate',s.festival_date,
    'startsAt',s.starts_at,
    'endsAt',s.starts_at+make_interval(mins=>greatest(10,coalesce(s.set_minutes,45))),
    'headline',coalesce(s.billing_position,'')='headliner'
  ) ORDER BY s.festival_date,s.starts_at,s.id),'[]'::jsonb)
  INTO v_items
  FROM scheduled s;

  RETURN v_items;
END $$;

REVOKE ALL ON FUNCTION public.get_festival_owner_npc_lineup_acts(uuid,uuid),
  public.upsert_festival_owner_npc_lineup_act(uuid,uuid,uuid,text,text,integer,integer,date,uuid,text,uuid),
  public.cancel_festival_owner_npc_lineup_act(uuid,uuid,uuid,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_owner_npc_lineup_acts(uuid,uuid),
  public.upsert_festival_owner_npc_lineup_act(uuid,uuid,uuid,text,text,integer,integer,date,uuid,text,uuid),
  public.cancel_festival_owner_npc_lineup_act(uuid,uuid,uuid,uuid)
  TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
