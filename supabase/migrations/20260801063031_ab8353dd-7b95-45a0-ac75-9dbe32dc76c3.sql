-- ============ helper: caller owns/leads band ============
CREATE OR REPLACE FUNCTION public.caller_can_act_for_band(_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = _band_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = _band_id AND p.user_id = auth.uid()
  );
$$;

-- ============ dedupe guards ============
DELETE FROM public.award_nominations a
USING public.award_nominations b
WHERE a.ctid > b.ctid
  AND a.award_show_id = b.award_show_id
  AND a.category_name = b.category_name
  AND a.nominee_id = b.nominee_id;

CREATE UNIQUE INDEX IF NOT EXISTS award_nominations_show_category_nominee_key
  ON public.award_nominations (award_show_id, category_name, nominee_id);

DELETE FROM public.award_votes a
USING public.award_votes b
WHERE a.ctid > b.ctid
  AND a.nomination_id = b.nomination_id
  AND a.voter_id = b.voter_id;

CREATE UNIQUE INDEX IF NOT EXISTS award_votes_nomination_voter_key
  ON public.award_votes (nomination_id, voter_id);

-- ============ voting: allow player profile or band identity ============
DROP POLICY IF EXISTS "Users can cast votes" ON public.award_votes;
CREATE POLICY "Players can cast votes"
ON public.award_votes FOR INSERT TO authenticated
WITH CHECK (
  voter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = voter_id AND p.user_id = auth.uid())
  OR public.caller_can_act_for_band(voter_id)
);

-- ============ nominations: any authenticated player may nominate any band ============
DROP POLICY IF EXISTS "Users can submit nominations" ON public.award_nominations;
CREATE POLICY "Players can nominate any band"
ON public.award_nominations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nominators can update their nominations"
ON public.award_nominations FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.award_nominations TO anon;
GRANT SELECT, INSERT, UPDATE ON public.award_nominations TO authenticated;
GRANT SELECT, INSERT ON public.award_votes TO authenticated;

-- ============ performance / ceremony invitations ============
CREATE TABLE IF NOT EXISTS public.award_show_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  award_show_id uuid NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  invite_type text NOT NULL DEFAULT 'performer',
  invitee_user_id uuid,
  invitee_band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  category_name text,
  slot_label text,
  stage text,
  performance_fee integer NOT NULL DEFAULT 0,
  message text,
  response_status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  invited_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT award_show_invites_target_check CHECK (invitee_user_id IS NOT NULL OR invitee_band_id IS NOT NULL)
);

GRANT SELECT ON public.award_show_invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.award_show_invites TO authenticated;
GRANT ALL ON public.award_show_invites TO service_role;

ALTER TABLE public.award_show_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invites viewable by everyone" ON public.award_show_invites;
CREATE POLICY "Invites viewable by everyone"
ON public.award_show_invites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage invites" ON public.award_show_invites;
CREATE POLICY "Admins manage invites"
ON public.award_show_invites FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Invitees respond to invites" ON public.award_show_invites;
CREATE POLICY "Invitees respond to invites"
ON public.award_show_invites FOR UPDATE TO authenticated
USING (
  invitee_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = invitee_user_id AND p.user_id = auth.uid())
  OR (invitee_band_id IS NOT NULL AND public.caller_can_act_for_band(invitee_band_id))
)
WITH CHECK (
  invitee_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = invitee_user_id AND p.user_id = auth.uid())
  OR (invitee_band_id IS NOT NULL AND public.caller_can_act_for_band(invitee_band_id))
);

CREATE UNIQUE INDEX IF NOT EXISTS award_show_invites_band_slot_key
  ON public.award_show_invites (award_show_id, invitee_band_id, invite_type, COALESCE(slot_label, ''))
  WHERE invitee_band_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS award_show_invites_band_idx ON public.award_show_invites (invitee_band_id);
CREATE INDEX IF NOT EXISTS award_show_invites_show_idx ON public.award_show_invites (award_show_id);

CREATE TRIGGER award_show_invites_updated_at
BEFORE UPDATE ON public.award_show_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ invite a band to perform (admin) ============
CREATE OR REPLACE FUNCTION public.award_show_invite_band(
  p_award_show_id uuid,
  p_band_id uuid,
  p_invite_type text DEFAULT 'performer',
  p_slot_label text DEFAULT NULL,
  p_stage text DEFAULT NULL,
  p_performance_fee integer DEFAULT 0,
  p_category_name text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS public.award_show_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.award_show_invites;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only award show administrators can send invitations' USING ERRCODE = '42501';
  END IF;
  IF p_invite_type NOT IN ('performer','presenter','attendee','nominee') THEN
    RAISE EXCEPTION 'Invalid invite type %', p_invite_type USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.award_show_invites (
    award_show_id, invitee_band_id, invite_type, slot_label, stage,
    performance_fee, category_name, message, invited_by
  ) VALUES (
    p_award_show_id, p_band_id, p_invite_type, p_slot_label, p_stage,
    GREATEST(0, COALESCE(p_performance_fee, 0)), p_category_name, p_message, auth.uid()
  )
  ON CONFLICT (award_show_id, invitee_band_id, invite_type, COALESCE(slot_label, ''))
  WHERE invitee_band_id IS NOT NULL
  DO UPDATE SET
    stage = EXCLUDED.stage,
    performance_fee = EXCLUDED.performance_fee,
    category_name = EXCLUDED.category_name,
    message = EXCLUDED.message,
    response_status = 'pending',
    responded_at = NULL,
    updated_at = now()
  RETURNING * INTO v_invite;

  RETURN v_invite;
END;
$$;

-- ============ respond to an invite ============
CREATE OR REPLACE FUNCTION public.award_show_respond_invite(
  p_invite_id uuid,
  p_response text
)
RETURNS public.award_show_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.award_show_invites;
BEGIN
  IF p_response NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid response %', p_response USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invite FROM public.award_show_invites WHERE id = p_invite_id;
  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_invite.invitee_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_invite.invitee_user_id AND p.user_id = auth.uid())
    OR (v_invite.invitee_band_id IS NOT NULL AND public.caller_can_act_for_band(v_invite.invitee_band_id))
  ) THEN
    RAISE EXCEPTION 'You cannot respond to this invitation' USING ERRCODE = '42501';
  END IF;

  UPDATE public.award_show_invites
  SET response_status = p_response, responded_at = now(), updated_at = now()
  WHERE id = p_invite_id
  RETURNING * INTO v_invite;

  IF p_response = 'accepted' AND v_invite.invite_type = 'performer' AND v_invite.invitee_band_id IS NOT NULL THEN
    INSERT INTO public.award_performance_bookings (
      award_show_id, band_id, user_id, slot_label, stage, song_ids, status
    )
    SELECT v_invite.award_show_id, v_invite.invitee_band_id, auth.uid(),
           COALESCE(v_invite.slot_label, 'Invited Performance'),
           COALESCE(v_invite.stage, 'Main Stage'), ARRAY[]::uuid[], 'confirmed'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.award_performance_bookings b
      WHERE b.award_show_id = v_invite.award_show_id
        AND b.band_id = v_invite.invitee_band_id
        AND b.slot_label = COALESCE(v_invite.slot_label, 'Invited Performance')
    );
  END IF;

  RETURN v_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.award_show_invite_band(uuid, uuid, text, text, text, integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.award_show_invite_band(uuid, uuid, text, text, text, integer, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.award_show_respond_invite(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.award_show_respond_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.caller_can_act_for_band(uuid) TO authenticated;

-- ============ vote counter maintenance ============
CREATE OR REPLACE FUNCTION public.award_votes_sync_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.award_nominations n
  SET vote_count = (
    SELECT COALESCE(SUM(v.weight), 0)::int FROM public.award_votes v WHERE v.nomination_id = n.id
  )
  WHERE n.id = COALESCE(NEW.nomination_id, OLD.nomination_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_votes_sync_count_trg ON public.award_votes;
CREATE TRIGGER award_votes_sync_count_trg
AFTER INSERT OR DELETE ON public.award_votes
FOR EACH ROW EXECUTE FUNCTION public.award_votes_sync_count();
