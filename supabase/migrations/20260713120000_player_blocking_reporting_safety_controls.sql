BEGIN;

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'report_duplicate_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'report_rate_limited';

ALTER TABLE public.social_profile_blocks
  ADD COLUMN IF NOT EXISTS reason_category text,
  ADD COLUMN IF NOT EXISTS private_note text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

ALTER TABLE public.social_profile_blocks DROP CONSTRAINT IF EXISTS social_profile_blocks_private_note_length;
ALTER TABLE public.social_profile_blocks ADD CONSTRAINT social_profile_blocks_private_note_length CHECK (private_note IS NULL OR char_length(private_note) <= 500);
ALTER TABLE public.social_profile_blocks DROP CONSTRAINT IF EXISTS social_profile_blocks_reason_category_allowed;
ALTER TABLE public.social_profile_blocks ADD CONSTRAINT social_profile_blocks_reason_category_allowed CHECK (reason_category IS NULL OR reason_category IN ('unwanted_contact','harassment','spam','scam','inappropriate_content','threatening_behaviour','impersonation','other','prefer_not_to_say'));

CREATE INDEX IF NOT EXISTS social_profile_blocks_active_pair_idx ON public.social_profile_blocks (blocker_profile_id, blocked_profile_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS social_profile_blocks_active_blocked_idx ON public.social_profile_blocks (blocked_profile_id, blocker_profile_id) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.social_report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.social_reports(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  source_reference text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT social_report_evidence_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT social_report_evidence_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
ALTER TABLE public.social_report_evidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS social_report_evidence_report_idx ON public.social_report_evidence(report_id, created_at);

DROP POLICY IF EXISTS "Reporters can read own report evidence" ON public.social_report_evidence;
CREATE POLICY "Reporters can read own report evidence" ON public.social_report_evidence
FOR SELECT USING (EXISTS (SELECT 1 FROM public.social_reports r WHERE r.id = report_id AND public.profile_belongs_to_current_user(r.reporter_profile_id)));

CREATE OR REPLACE FUNCTION public.social_block_state(viewer_profile_id uuid, target_profile_id uuid)
RETURNS TABLE (
  viewer_blocked_target boolean,
  viewer_is_blocked_by_target boolean,
  mutual_block boolean,
  relation text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT
      EXISTS (SELECT 1 FROM public.social_profile_blocks b WHERE b.blocker_profile_id = viewer_profile_id AND b.blocked_profile_id = target_profile_id AND b.removed_at IS NULL) AS out_block,
      EXISTS (SELECT 1 FROM public.social_profile_blocks b WHERE b.blocker_profile_id = target_profile_id AND b.blocked_profile_id = viewer_profile_id AND b.removed_at IS NULL) AS in_block
  )
  SELECT out_block, in_block, out_block AND in_block,
    CASE WHEN out_block AND in_block THEN 'mutual_block' WHEN out_block THEN 'viewer_blocked_target' WHEN in_block THEN 'viewer_is_blocked_by_target' ELSE 'none' END
  FROM s;
$$;

CREATE OR REPLACE FUNCTION public.are_profiles_blocked(first_profile_id uuid, second_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_profile_blocks b
    WHERE b.removed_at IS NULL AND ((b.blocker_profile_id = first_profile_id AND b.blocked_profile_id = second_profile_id) OR (b.blocker_profile_id = second_profile_id AND b.blocked_profile_id = first_profile_id))
  ) OR EXISTS (
    SELECT 1 FROM public.friendships f WHERE f.status = 'blocked'::public.friendship_status
      AND ((f.requestor_id = first_profile_id AND f.addressee_id = second_profile_id) OR (f.requestor_id = second_profile_id AND f.addressee_id = first_profile_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_social_permissions(target_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid; blocked boolean; blocked_by_viewer boolean;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required' USING ERRCODE='42501'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = actor_profile_id THEN
    RETURN jsonb_build_object('can_view_profile', true, 'can_report', false, 'is_blocked_by_viewer', false, 'is_interaction_restricted', false, 'message', null);
  END IF;
  blocked := public.are_profiles_blocked(actor_profile_id, target_profile_id);
  SELECT viewer_blocked_target INTO blocked_by_viewer FROM public.social_block_state(actor_profile_id, target_profile_id);
  RETURN jsonb_build_object(
    'can_view_profile', NOT blocked, 'can_send_friend_request', NOT blocked, 'can_message', NOT blocked,
    'can_invite_to_band', NOT blocked, 'can_invite_to_activity', NOT blocked, 'can_offer_job', NOT blocked,
    'can_send_money', NOT blocked, 'can_send_item', NOT blocked, 'can_report', true,
    'is_blocked_by_viewer', COALESCE(blocked_by_viewer,false), 'is_interaction_restricted', blocked,
    'message', CASE WHEN blocked THEN 'This player is unavailable.' ELSE NULL END
  );
END; $$;

CREATE OR REPLACE FUNCTION public.block_profile(target_profile_id uuid, note text DEFAULT NULL, reason_category text DEFAULT NULL)
RETURNS public.social_profile_blocks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid; block_row public.social_profile_blocks;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = actor_profile_id THEN RAISE EXCEPTION 'Choose another player to block'; END IF;
  IF note IS NOT NULL AND char_length(note) > 500 THEN RAISE EXCEPTION 'Block note must be 500 characters or fewer'; END IF;
  INSERT INTO public.social_profile_blocks(blocker_profile_id, blocked_profile_id, reason, reason_category, private_note, removed_at)
  VALUES(actor_profile_id, target_profile_id, NULLIF(btrim(note), ''), reason_category, NULLIF(btrim(note), ''), NULL)
  ON CONFLICT (blocker_profile_id, blocked_profile_id) DO UPDATE SET reason=EXCLUDED.reason, reason_category=EXCLUDED.reason_category, private_note=EXCLUDED.private_note, removed_at=NULL, updated_at=timezone('utc', now()) RETURNING * INTO block_row;
  DELETE FROM public.friendships WHERE (requestor_id=actor_profile_id AND addressee_id=target_profile_id) OR (requestor_id=target_profile_id AND addressee_id=actor_profile_id);
  UPDATE public.notifications SET read_at = COALESCE(read_at, timezone('utc', now())), metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('social_action_disabled', true, 'resolved_by_block', true)
  WHERE profile_id IN (actor_profile_id, target_profile_id) AND (metadata->>'requestor_profile_id' IN (actor_profile_id::text,target_profile_id::text) OR metadata->>'addressee_profile_id' IN (actor_profile_id::text,target_profile_id::text));
  INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,metadata) VALUES(actor_profile_id,target_profile_id,'block',jsonb_build_object('reason_category', reason_category));
  RETURN block_row;
END; $$;

CREATE OR REPLACE FUNCTION public.unblock_profile(target_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  UPDATE public.social_profile_blocks SET removed_at=timezone('utc', now()), updated_at=timezone('utc', now()) WHERE blocker_profile_id=actor_profile_id AND blocked_profile_id=target_profile_id AND removed_at IS NULL;
  INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action) VALUES(actor_profile_id,target_profile_id,'unblock');
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.report_social_target(p_reported_profile_id uuid, p_target_type public.social_report_target_type, p_target_id uuid, p_category public.social_report_category, p_reason text, p_context jsonb DEFAULT '{}'::jsonb, p_block_after_report boolean DEFAULT false)
RETURNS public.social_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid; report_row public.social_reports; profile_snapshot jsonb; recent_count int; priority text;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  IF p_reported_profile_id IS NULL AND p_target_id IS NULL THEN RAISE EXCEPTION 'Report target is required'; END IF;
  IF p_reported_profile_id = actor_profile_id THEN RAISE EXCEPTION 'You cannot report yourself'; END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 OR char_length(btrim(p_reason)) > 2000 THEN RAISE EXCEPTION 'Report description must be 10 to 2000 characters'; END IF;
  SELECT count(*) INTO recent_count FROM public.social_reports sr WHERE sr.reporter_profile_id=actor_profile_id AND sr.created_at > timezone('utc', now()) - interval '10 minutes';
  IF recent_count >= 5 THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES(actor_profile_id,p_reported_profile_id,'report_rate_limited',p_target_type,p_target_id,jsonb_build_object('category',p_category));
    RAISE EXCEPTION 'Please wait before submitting another report.' USING ERRCODE='42901';
  END IF;
  IF EXISTS (SELECT 1 FROM public.social_reports sr WHERE sr.reporter_profile_id=actor_profile_id AND sr.reported_profile_id IS NOT DISTINCT FROM p_reported_profile_id AND sr.target_type=p_target_type AND sr.target_id IS NOT DISTINCT FROM p_target_id AND sr.category=p_category AND sr.created_at > timezone('utc', now()) - interval '24 hours') THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES(actor_profile_id,p_reported_profile_id,'report_duplicate_denied',p_target_type,p_target_id,jsonb_build_object('category',p_category));
    RAISE EXCEPTION 'Your report has already been submitted for review.' USING ERRCODE='23505';
  END IF;
  priority := CASE WHEN p_category IN ('threats','hate','sexual_content','scam','self_harm') THEN 'high' ELSE 'normal' END;
  INSERT INTO public.social_reports(reporter_profile_id,reported_profile_id,target_type,target_id,category,reason,context,status)
  VALUES(actor_profile_id,p_reported_profile_id,p_target_type,p_target_id,p_category,btrim(p_reason),COALESCE(p_context,'{}'::jsonb) || jsonb_build_object('initial_priority',priority),'open') RETURNING * INTO report_row;
  IF p_reported_profile_id IS NOT NULL THEN
    SELECT jsonb_build_object('profile_id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,'captured_at',timezone('utc',now())) INTO profile_snapshot FROM public.profiles p WHERE p.id=p_reported_profile_id;
    INSERT INTO public.social_report_evidence(report_id,evidence_type,source_reference,snapshot,metadata) VALUES(report_row.id,'profile_snapshot','profiles:'||p_reported_profile_id::text,COALESCE(profile_snapshot,'{}'::jsonb),jsonb_build_object('immutable',true));
  END IF;
  INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES(actor_profile_id,p_reported_profile_id,'report',p_target_type,p_target_id,jsonb_build_object('category',p_category,'priority',priority));
  IF p_block_after_report AND p_reported_profile_id IS NOT NULL THEN PERFORM public.block_profile(p_reported_profile_id, 'Blocked after report', 'prefer_not_to_say'); END IF;
  RETURN report_row;
END; $$;

GRANT EXECUTE ON FUNCTION public.social_block_state(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_profile(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_social_target(uuid, public.social_report_target_type, uuid, public.social_report_category, text, jsonb, boolean) TO authenticated;

COMMIT;
