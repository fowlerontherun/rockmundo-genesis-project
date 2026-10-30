-- #4730: Move cover fees and radio income off browser-controlled
-- band_earnings INSERTs. Database owns identity, fee and receipt idempotence.
-- Neither function credits cash based on an arbitrary client-supplied amount.

CREATE UNIQUE INDEX IF NOT EXISTS band_earnings_one_cover_license_per_cover
  ON public.band_earnings ((metadata->>'song_cover_id'))
  WHERE source='cover_license' AND metadata->>'song_cover_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS band_earnings_one_radio_payment_per_play
  ON public.band_earnings ((metadata->>'play_id'))
  WHERE source='radio_play' AND metadata->>'play_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_band_cover_license_atomic(
  p_original_song_id uuid,
  p_covering_band_id uuid,
  p_profile_id uuid,
  p_payment_type text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_original public.songs%ROWTYPE;
  v_covering public.bands%ROWTYPE;
  v_account uuid;
  v_source_account uuid;
  v_cover_id uuid;
  v_new_song_id uuid;
  v_fee integer;
  v_quality integer;
  v_skill_multiplier numeric;
  v_original_band uuid;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL OR p_original_song_id IS NULL
     OR p_covering_band_id IS NULL
     OR p_payment_type NOT IN ('flat_fee','royalty_split') THEN
    RAISE EXCEPTION 'Signed-in member, source song, band and payment type are required'
      USING ERRCODE='22023';
  END IF;

  SELECT user_id INTO v_account FROM public.profiles
    WHERE id=p_profile_id AND user_id=auth.uid()
      AND deleted_at IS NULL AND died_at IS NULL;
  IF v_account IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.band_members m
    WHERE m.band_id=p_covering_band_id AND m.profile_id=p_profile_id
      AND m.member_status='active' AND m.user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Active covering-band membership required'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_original FROM public.songs
    WHERE id=p_original_song_id FOR SHARE;
  IF NOT FOUND OR v_original.band_id IS NULL
     OR v_original.band_id=p_covering_band_id
     OR coalesce(v_original.archived,false)
     OR v_original.status NOT IN ('recorded','released') THEN
    RAISE EXCEPTION 'Source song is not eligible for this band to cover'
      USING ERRCODE='23514';
  END IF;
  v_original_band:=v_original.band_id;

  -- Deterministic cross-band locking prevents opposing cover licenses from
  -- deadlocking when debiting one band and crediting the other.
  PERFORM id FROM public.bands
    WHERE id IN (p_covering_band_id,v_original_band)
    ORDER BY id FOR UPDATE;
  SELECT * INTO v_covering FROM public.bands WHERE id=p_covering_band_id;
  IF NOT FOUND OR v_covering.status<>'active' THEN
    RAISE EXCEPTION 'Covering band is not active'
      USING ERRCODE='23514';
  END IF;

  SELECT id INTO v_cover_id FROM public.song_covers
    WHERE original_song_id=p_original_song_id
      AND covering_band_id=p_covering_band_id;
  IF v_cover_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_licensed',true,'cover_id',v_cover_id,
      'original_song_id',p_original_song_id
    );
  END IF;

  -- Both cover quality and licensing fees are server-derived. Browser values
  -- are previews only and never control currency or generated song quality.
  SELECT greatest(0.2::numeric,least(1.0::numeric,
    coalesce(avg(coalesce(m.skill_contribution,0)),0)::numeric/100))
    INTO v_skill_multiplier
    FROM public.band_members m
    WHERE m.band_id=p_covering_band_id AND m.member_status='active';
  v_quality := round(v_original.quality_score*v_skill_multiplier)::integer;
  v_fee := CASE WHEN p_payment_type='flat_fee'
    THEN greatest(50,v_original.quality_score*10) ELSE 0 END;
  IF v_fee<0 OR v_fee>2000000 OR v_quality<0 THEN
    RAISE EXCEPTION 'Invalid source quality or cover fee'
      USING ERRCODE='23514';
  END IF;
  IF v_fee>0 AND coalesce(v_covering.band_balance,0)<v_fee THEN
    RAISE EXCEPTION 'Not enough band funds to license cover'
      USING ERRCODE='23514';
  END IF;

  -- original_user_id is auth.users (not a profile id).
  SELECT u.id INTO v_source_account FROM auth.users u
    WHERE u.id=v_original.user_id;
  IF v_source_account IS NULL THEN
    SELECT p.user_id INTO v_source_account
    FROM public.profiles p WHERE p.id=v_original.user_id;
  END IF;
  IF v_source_account IS NULL THEN
    SELECT p.user_id INTO v_source_account
    FROM public.bands b JOIN public.profiles p ON p.id=b.leader_id
    WHERE b.id=v_original_band;
  END IF;
  IF v_source_account IS NULL THEN
    RAISE EXCEPTION 'Original song has no valid account owner'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.song_covers (
    original_song_id,covering_band_id,original_band_id,original_user_id,
    payment_type,flat_fee_amount,royalty_percentage,cover_quality,
    skill_multiplier
  ) VALUES (
    p_original_song_id,p_covering_band_id,v_original_band,v_source_account,
    p_payment_type,v_fee,
    CASE WHEN p_payment_type='royalty_split' THEN 50 ELSE 0 END,
    v_quality,round(v_skill_multiplier,2)
  ) RETURNING id INTO v_cover_id;

  IF v_fee>0 THEN
    UPDATE public.bands
      SET band_balance=coalesce(band_balance,0)-v_fee
      WHERE id=p_covering_band_id AND coalesce(band_balance,0)>=v_fee;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Band treasury changed during cover payment'
        USING ERRCODE='23514';
    END IF;
    INSERT INTO public.band_earnings(
      band_id,amount,source,description,earned_by_user_id,metadata
    ) VALUES (
      v_original_band,v_fee,'cover_license',
      'Cover license for "'||v_original.title||'"',auth.uid(),
      jsonb_build_object(
        'song_cover_id',v_cover_id,'source_song_id',v_original.id,
        'paying_band_id',p_covering_band_id
      )
    );
  END IF;

  INSERT INTO public.songs(
    title,genre,quality_score,duration_seconds,duration_display,lyrics,
    band_id,user_id,parent_song_id,ownership_type,version,status,
    added_to_repertoire_at,added_to_repertoire_by
  ) VALUES (
    v_original.title||' (Cover)',v_original.genre,v_quality,
    v_original.duration_seconds,v_original.duration_display,v_original.lyrics,
    p_covering_band_id,p_profile_id,p_original_song_id,'cover','cover',
    'recorded',now(),p_profile_id
  ) RETURNING id INTO v_new_song_id;

  RETURN jsonb_build_object(
    'already_licensed',false,'cover_id',v_cover_id,
    'song_id',v_new_song_id,'flat_fee',v_fee,'cover_quality',v_quality
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_post_radio_play_earning(
  p_play_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_play public.radio_plays%ROWTYPE;
  v_song public.songs%ROWTYPE;
  v_existing uuid;
  v_earning_id uuid;
  v_amount integer;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(
    public.has_role(auth.uid(),'admin'),false
  ) THEN
    RAISE EXCEPTION 'Only an administrator can settle radio revenue'
      USING ERRCODE='42501';
  END IF;
  IF p_play_id IS NULL THEN
    RAISE EXCEPTION 'Radio play id is required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_play FROM public.radio_plays WHERE id=p_play_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Radio play not found' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_song FROM public.songs WHERE id=v_play.song_id;
  IF NOT FOUND OR v_song.band_id IS NULL THEN
    RAISE EXCEPTION 'Radio play has no receiving band'
      USING ERRCODE='23514';
  END IF;

  SELECT id INTO v_existing FROM public.band_earnings
    WHERE source='radio_play' AND metadata->>'play_id'=p_play_id::text
    FOR UPDATE;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_paid',true,'earning_id',v_existing,'play_id',p_play_id
    );
  END IF;

  -- Use the recorded play receipt, not a caller-supplied band or fee.
  -- Recalculate the allowed credit from listener counts (same published
  -- 0.015 revenue rate as the admin UI) to reject inflated stored boosts.
  IF v_play.listeners IS NULL OR v_play.listeners < 0
     OR v_play.listeners > 100000000 THEN
    RAISE EXCEPTION 'Invalid radio play listener count'
      USING ERRCODE='23514';
  END IF;
  v_amount:=greatest(5,round(v_play.listeners::numeric*0.015)::integer);
  IF v_amount>1500000 OR v_play.sales_boost IS DISTINCT FROM v_amount THEN
    RAISE EXCEPTION 'Radio revenue receipt does not match listeners'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.band_earnings(
    band_id,amount,source,description,earned_by_user_id,metadata
  ) VALUES (
    v_song.band_id,v_amount,'radio_play',
    'Verified radio play revenue',auth.uid(),
    jsonb_build_object(
      'play_id',p_play_id,'song_id',v_song.id,'station_id',v_play.station_id
    )
  ) RETURNING id INTO v_earning_id;

  RETURN jsonb_build_object(
    'already_paid',false,'earning_id',v_earning_id,
    'band_id',v_song.band_id,'amount',v_amount,'play_id',p_play_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_band_cover_license_atomic(
  uuid,uuid,uuid,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_band_cover_license_atomic(
  uuid,uuid,uuid,text
) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.admin_post_radio_play_earning(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_radio_play_earning(uuid)
  TO authenticated,service_role;
