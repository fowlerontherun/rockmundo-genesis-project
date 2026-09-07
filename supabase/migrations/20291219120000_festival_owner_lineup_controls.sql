-- Close the remaining owner-facing Festival lineup gaps without bypassing the
-- canonical schedule/edition boundary. The simplified company UI uses
-- festival_editions_v2 while the authoritative timetable still uses the legacy
-- canonical festival_editions rows. Resolve that bridge server-side.

CREATE OR REPLACE FUNCTION public.get_festival_owner_lineup_workspace(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := public._caller_profile_id();
  canonical_edition_id uuid;
  poster public.festival_edition_poster_versions%ROWTYPE;
BEGIN
  IF actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_lineup_owner_forbidden' USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.festival_editions_v2 e
    WHERE e.id=p_festival_edition_id
      AND e.festival_company_id=p_festival_company_id
  ) THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE='P0001';
  END IF;

  canonical_edition_id := public._festival_attendee_legacy_edition(p_festival_edition_id);

  SELECT * INTO poster
  FROM public.festival_edition_poster_versions p
  WHERE p.edition_id=canonical_edition_id
    AND p.status IN ('generated','published')
  ORDER BY (p.status='published') DESC, p.version_number DESC, p.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'festivalEditionId', p_festival_edition_id,
    'canonicalEditionId', canonical_edition_id,
    'posterUrl', poster.poster_url,
    'posterStatus', poster.status,
    'posterVersion', poster.version_number,
    'canSchedule', canonical_edition_id IS NOT NULL
  );
END
$function$;

REVOKE ALL ON FUNCTION public.get_festival_owner_lineup_workspace(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_owner_lineup_workspace(uuid,uuid) TO authenticated,service_role;

-- The simplified search previously discarded the richer type/genre/fame filters
-- from the original Festival candidate search. Restore them while keeping exact
-- edition scoping.
DROP FUNCTION IF EXISTS public.search_festival_edition_artist_candidates(uuid,uuid,text,integer,integer);
CREATE OR REPLACE FUNCTION public.search_festival_edition_artist_candidates(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_query text DEFAULT NULL,
  p_artist_type text DEFAULT NULL,
  p_genres text[] DEFAULT '{}',
  p_minimum_fame integer DEFAULT NULL,
  p_maximum_fame integer DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  safe_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  safe_offset integer := greatest(coalesce(p_offset,0),0);
  term text := nullif(btrim(coalesce(p_query,'')),'');
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id,actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.festival_editions_v2 e
    WHERE e.id=p_festival_edition_id AND e.festival_company_id=p_festival_company_id
  ) THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO programme FROM public.festival_artist_programmes
   WHERE festival_company_id=p_festival_company_id AND festival_edition_id=p_festival_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE='P0001'; END IF;

  RETURN jsonb_build_object('items',coalesce((
    WITH candidates AS (
      SELECT 'solo'::text artist_type,p.id artist_id,
        coalesce(nullif(btrim(p.display_name),''),nullif(btrim(p.username),''),'Solo artist') display_name,
        ARRAY[]::text[] genres,greatest(0,coalesce(p.fame,0))::integer fame,0::integer popularity,
        greatest(0,coalesce(p.fame,0)*100)::bigint minimum_fee,
        greatest(10000,coalesce(p.fame,0)*250)::bigint maximum_fee
      FROM public.profiles p
      WHERE (p_artist_type IS NULL OR p_artist_type IN ('solo','either','player'))
        AND (term IS NULL OR p.display_name ILIKE '%'||term||'%' OR p.username ILIKE '%'||term||'%')
        AND (p_minimum_fame IS NULL OR coalesce(p.fame,0)>=p_minimum_fame)
        AND (p_maximum_fame IS NULL OR coalesce(p.fame,0)<=p_maximum_fame)
      UNION ALL
      SELECT 'band'::text,b.id,coalesce(nullif(btrim(b.name),''),'Band'),
        CASE WHEN nullif(btrim(coalesce(b.genre,'')),'') IS NULL THEN ARRAY[]::text[] ELSE ARRAY[b.genre]::text[] END,
        greatest(0,coalesce(b.popularity,0))::integer,greatest(0,coalesce(b.popularity,0))::integer,
        greatest(0,coalesce(b.popularity,0)*200)::bigint,
        greatest(15000,coalesce(b.popularity,0)*500)::bigint
      FROM public.bands b
      WHERE b.status='active'
        AND (p_artist_type IS NULL OR p_artist_type IN ('band','either','player'))
        AND (term IS NULL OR b.name ILIKE '%'||term||'%')
        AND (coalesce(array_length(p_genres,1),0)=0 OR coalesce(b.primary_genre,b.genre)=ANY(p_genres))
        AND (p_minimum_fame IS NULL OR coalesce(b.popularity,0)>=p_minimum_fame)
        AND (p_maximum_fame IS NULL OR coalesce(b.popularity,0)<=p_maximum_fame)
    ), page AS (
      SELECT * FROM candidates ORDER BY fame DESC,display_name,artist_id LIMIT safe_limit OFFSET safe_offset
    )
    SELECT jsonb_agg(jsonb_build_object(
      'identity',CASE page.artist_type WHEN 'solo' THEN jsonb_build_object('type','solo','artistProfileId',page.artist_id) ELSE jsonb_build_object('type','band','bandId',page.artist_id) END,
      'displayName',page.display_name,'playerNpc','player','genres',to_jsonb(page.genres),'fame',page.fame,'popularity',page.popularity,
      'homeCity',NULL,'estimatedFeeMinimumMinor',page.minimum_fee,'estimatedFeeMaximumMinor',page.maximum_fee,
      'availabilityState','unknown','stageSuitability',least(100,greatest(0,page.fame)),
      'genreFit',CASE WHEN cardinality(programme.preferred_genres)=0 THEN 50 WHEN page.genres && programme.preferred_genres THEN 100 ELSE 25 END,
      'audienceFit',least(100,greatest(0,page.fame)),
      'relationshipState',CASE
        WHEN EXISTS(SELECT 1 FROM public.festival_artist_bookings x WHERE x.festival_artist_programme_id=programme.id AND x.status NOT IN('cancelled','artist_withdrawn','festival_cancelled') AND ((page.artist_type='solo' AND x.artist_profile_id=page.artist_id) OR (page.artist_type='band' AND x.band_id=page.artist_id))) THEN 'booked'
        WHEN EXISTS(SELECT 1 FROM public.festival_artist_offers x WHERE x.festival_artist_programme_id=programme.id AND x.status IN('draft','sent','countered') AND ((page.artist_type='solo' AND x.artist_profile_id=page.artist_id) OR (page.artist_type='band' AND x.band_id=page.artist_id))) THEN 'offered'
        WHEN EXISTS(SELECT 1 FROM public.festival_artist_invitations x WHERE x.festival_artist_programme_id=programme.id AND x.status IN('draft','sent','viewed','interested') AND ((page.artist_type='solo' AND x.artist_profile_id=page.artist_id) OR (page.artist_type='band' AND x.band_id=page.artist_id))) THEN 'invited'
        ELSE 'none' END
    ) ORDER BY page.fame DESC,page.display_name,page.artist_id) FROM page
  ),'[]'::jsonb),'limit',safe_limit,'offset',safe_offset);
END
$function$;
REVOKE ALL ON FUNCTION public.search_festival_edition_artist_candidates(uuid,uuid,text,text,text[],integer,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_festival_edition_artist_candidates(uuid,uuid,text,text,text[],integer,integer,integer,integer) TO authenticated,service_role;

-- Owners may fill empty canonical slots with deterministic NPC/system acts.
-- The authoritative system-act table remains the identity/audit source; slot
-- compatibility fields are maintained for existing public timetable consumers.
CREATE OR REPLACE FUNCTION public.set_festival_owner_system_act(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_stage_slot_id uuid,
  p_enabled boolean,
  p_act_type text DEFAULT 'npc_band',
  p_name text DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_quality integer DEFAULT 55
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid:=public._caller_profile_id();
  canonical_edition_id uuid;
  slot public.festival_stage_slots%ROWTYPE;
  act public.festival_system_acts%ROWTYPE;
  quality integer:=greatest(0,least(coalesce(p_quality,55),100));
  act_name text:=coalesce(nullif(btrim(p_name),''),CASE WHEN p_act_type='dj' THEN 'Festival DJ' ELSE 'Festival guest band' END);
  act_genre text:=coalesce(nullif(btrim(p_genre),''),'Open format');
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id,actor) THEN
    RAISE EXCEPTION 'festival_lineup_owner_forbidden' USING ERRCODE='P0001';
  END IF;
  IF p_act_type NOT IN('npc_band','dj','guest_act') THEN
    RAISE EXCEPTION 'festival_system_act_invalid' USING ERRCODE='P0001';
  END IF;
  canonical_edition_id:=public._festival_attendee_legacy_edition(p_festival_edition_id);
  IF canonical_edition_id IS NULL THEN RAISE EXCEPTION 'festival_schedule_edition_not_found' USING ERRCODE='P0001'; END IF;

  SELECT * INTO STRICT slot FROM public.festival_stage_slots WHERE id=p_stage_slot_id FOR UPDATE;
  IF slot.edition_id IS DISTINCT FROM canonical_edition_id THEN RAISE EXCEPTION 'festival_stage_slot_wrong_edition' USING ERRCODE='P0001'; END IF;

  IF p_enabled THEN
    IF slot.canonical_contract_id IS NOT NULL OR slot.band_id IS NOT NULL OR coalesce(slot.is_npc_dj,false) THEN
      RAISE EXCEPTION 'FESTIVAL_SLOT_CONFLICT' USING ERRCODE='P0001';
    END IF;
    INSERT INTO public.festival_system_acts(edition_id,slot_id,deterministic_key,display_name,act_type,genre,quality_tier,reliability,internal_seed,status,public_metadata)
    VALUES(canonical_edition_id,slot.id,'owner:'||slot.id::text,act_name,p_act_type,act_genre,
      CASE WHEN quality>=80 THEN 'headline' WHEN quality>=65 THEN 'strong' WHEN quality>=45 THEN 'local' ELSE 'emerging' END,
      greatest(40,least(95,quality+15)),encode(digest(canonical_edition_id::text||':'||slot.id::text,'sha256'),'hex'),'assigned',jsonb_build_object('ownerAssigned',true,'quality',quality))
    ON CONFLICT(edition_id,deterministic_key) DO UPDATE SET slot_id=excluded.slot_id,display_name=excluded.display_name,act_type=excluded.act_type,genre=excluded.genre,quality_tier=excluded.quality_tier,reliability=excluded.reliability,status='assigned',updated_at=now(),public_metadata=excluded.public_metadata
    RETURNING * INTO act;
    UPDATE public.festival_stage_slots SET
      is_npc_dj=true,npc_dj_name=act_name,npc_dj_genre=act_genre,npc_dj_quality=quality,status='confirmed',public_status='scheduled',
      reservation_metadata=coalesce(reservation_metadata,'{}'::jsonb)||jsonb_build_object('system_act_id',act.id,'system_act_type',p_act_type,'reservation_type','system_act')
    WHERE id=slot.id;
  ELSE
    UPDATE public.festival_system_acts SET status='removed',slot_id=NULL,updated_at=now() WHERE edition_id=canonical_edition_id AND slot_id=slot.id;
    UPDATE public.festival_stage_slots SET is_npc_dj=false,npc_dj_name=NULL,npc_dj_genre=NULL,npc_dj_quality=50,status='open',public_status='draft',reservation_metadata=coalesce(reservation_metadata,'{}'::jsonb)-'system_act_id'-'system_act_type'-'reservation_type' WHERE id=slot.id;
  END IF;
  RETURN jsonb_build_object('stageSlotId',slot.id,'enabled',p_enabled,'actType',p_act_type,'name',CASE WHEN p_enabled THEN act_name ELSE NULL END);
END
$function$;
REVOKE ALL ON FUNCTION public.set_festival_owner_system_act(uuid,uuid,uuid,boolean,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_festival_owner_system_act(uuid,uuid,uuid,boolean,text,text,text,integer) TO authenticated,service_role;
