-- Transactional regression harness for band applications and invitations.
-- Run only against a disposable/local database. Every fixture is rolled back.

BEGIN;

SET LOCAL session_replication_role = replica;

INSERT INTO auth.users (id, email, role) VALUES
  ('91000000-0000-4000-8000-000000000001', 'band-flow-manager-a@example.test', 'authenticated'),
  ('91000000-0000-4000-8000-000000000002', 'band-flow-applicant@example.test', 'authenticated'),
  ('91000000-0000-4000-8000-000000000003', 'band-flow-invitee@example.test', 'authenticated'),
  ('91000000-0000-4000-8000-000000000004', 'band-flow-withdraw@example.test', 'authenticated'),
  ('91000000-0000-4000-8000-000000000005', 'band-flow-manager-b@example.test', 'authenticated');

INSERT INTO public.profiles (id, user_id, username, display_name, is_active) VALUES
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'band_flow_manager_a', 'Band Flow Manager A', true),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'band_flow_applicant', 'Band Flow Applicant', true),
  ('92000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003', 'band_flow_invitee', 'Band Flow Invitee', true),
  ('92000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000004', 'band_flow_withdraw', 'Band Flow Withdraw', true),
  ('92000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000005', 'band_flow_manager_b', 'Band Flow Manager B', true);

INSERT INTO public.bands (
  id, name, genre, leader_id, max_members, is_solo_artist,
  is_recruiting, allow_applications, status
) VALUES
  ('93000000-0000-4000-8000-000000000001', 'Band Flow A', 'Rock', '92000000-0000-4000-8000-000000000001', 4, false, true, true, 'active'),
  ('93000000-0000-4000-8000-000000000002', 'Band Flow B', 'Rock', '92000000-0000-4000-8000-000000000005', 4, false, true, true, 'active');

SET LOCAL session_replication_role = origin;

INSERT INTO public.band_members (
  band_id, user_id, profile_id, role, instrument_role, member_status, is_touring_member
) VALUES
  ('93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'Founder', 'Lead Vocals', 'active', false),
  ('93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000005', 'Founder', 'Drums', 'active', false);

INSERT INTO public.friendships (requestor_id, addressee_id, status, responded_at) VALUES
  ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', 'accepted', now()),
  ('92000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000003', 'accepted', now());

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_application public.band_applications;
  v_retry_application public.band_applications;
  v_approved public.band_applications;
  v_withdrawn public.band_applications;
  v_reapplied public.band_applications;
  v_invitation public.band_invitations;
  v_accepted_invitation public.band_invitations;
  v_affected integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_application := public.submit_band_application(
    '93000000-0000-4000-8000-000000000001', 'Electric Guitar', 'Ready to rehearse'
  );
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'submission did not create a pending application';
  END IF;

  v_retry_application := public.submit_band_application(
    '93000000-0000-4000-8000-000000000001', 'Electric Guitar', 'retry'
  );
  IF v_retry_application.id <> v_application.id THEN
    RAISE EXCEPTION 'duplicate application retry was not idempotent';
  END IF;

  BEGIN
    INSERT INTO public.band_applications (
      band_id, applicant_profile_id, instrument_role, status
    ) VALUES (
      '93000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000002',
      'Bass',
      'pending'
    );
    RAISE EXCEPTION 'direct application insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
  v_approved := public.respond_band_application(v_application.id, 'approve');
  IF v_approved.status <> 'accepted' OR NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = '93000000-0000-4000-8000-000000000001'
      AND bm.profile_id = '92000000-0000-4000-8000-000000000002'
      AND bm.member_status = 'active'
  ) THEN
    RAISE EXCEPTION 'approval did not create membership before returning accepted';
  END IF;

  v_approved := public.respond_band_application(v_application.id, 'approve');
  IF (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id = '93000000-0000-4000-8000-000000000001'
      AND bm.profile_id = '92000000-0000-4000-8000-000000000002'
  ) <> 1 THEN
    RAISE EXCEPTION 'approval retry duplicated membership';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
  UPDATE public.band_members
  SET role = 'manager'
  WHERE band_id = '93000000-0000-4000-8000-000000000001'
    AND profile_id = '92000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 OR EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = '93000000-0000-4000-8000-000000000001'
      AND bm.profile_id = '92000000-0000-4000-8000-000000000002'
      AND lower(COALESCE(bm.role, '')) = 'manager'
  ) THEN
    RAISE EXCEPTION 'member self-promotion unexpectedly succeeded';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
  v_invitation := public.send_band_invitation(
    '92000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000001',
    'Bass',
    NULL,
    'Join us'
  );
  IF v_invitation.status <> 'pending'
     OR v_invitation.invited_profile_id <> '92000000-0000-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'invitation was not character scoped';
  END IF;

  BEGIN
    INSERT INTO public.band_invitations (
      band_id, inviter_user_id, invited_user_id, invited_profile_id, instrument_role, status
    ) VALUES (
      '93000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000003',
      '92000000-0000-4000-8000-000000000003',
      'Bass',
      'pending'
    );
    RAISE EXCEPTION 'direct invitation insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
  v_accepted_invitation := public.respond_band_invitation(v_invitation.id, 'accepted');
  IF v_accepted_invitation.status <> 'accepted' OR NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = '93000000-0000-4000-8000-000000000001'
      AND bm.profile_id = '92000000-0000-4000-8000-000000000003'
      AND bm.member_status = 'active'
  ) THEN
    RAISE EXCEPTION 'invitation acceptance did not create membership';
  END IF;

  v_accepted_invitation := public.respond_band_invitation(v_invitation.id, 'accepted');
  IF (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id = '93000000-0000-4000-8000-000000000001'
      AND bm.profile_id = '92000000-0000-4000-8000-000000000003'
  ) <> 1 THEN
    RAISE EXCEPTION 'invitation retry duplicated membership';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000005', true);
  BEGIN
    PERFORM public.send_band_invitation(
      '92000000-0000-4000-8000-000000000003',
      '93000000-0000-4000-8000-000000000002',
      'Bass',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'cross-band invitation unexpectedly succeeded';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
  v_application := public.submit_band_application(
    '93000000-0000-4000-8000-000000000002', 'Keyboard', 'First try'
  );
  v_withdrawn := public.withdraw_band_application(v_application.id);
  IF v_withdrawn.status <> 'withdrawn' THEN
    RAISE EXCEPTION 'withdrawal did not reach withdrawn state';
  END IF;

  v_reapplied := public.submit_band_application(
    '93000000-0000-4000-8000-000000000002', 'Keyboard', 'Second try'
  );
  IF v_reapplied.id = v_application.id OR v_reapplied.status <> 'pending' THEN
    RAISE EXCEPTION 'reapplication after withdrawal failed';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
