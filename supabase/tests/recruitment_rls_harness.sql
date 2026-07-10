-- Phase 3 PR 05 recruitment RLS/RPC verification harness.
-- Run against a disposable local Supabase database after migrations:
--   supabase db reset && psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/recruitment_rls_harness.sql
-- The harness seeds deterministic auth users/profiles/bands/applications and rolls back at the end.

BEGIN;

CREATE SCHEMA IF NOT EXISTS test_recruitment;

CREATE OR REPLACE FUNCTION test_recruitment.as_user(user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION test_recruitment.as_anon() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
END;
$$;

CREATE OR REPLACE FUNCTION test_recruitment.as_service() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END;
$$;

CREATE OR REPLACE FUNCTION test_recruitment.assert_eq(label text, actual bigint, expected bigint) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'assertion failed: %, expected %, got %', label, expected, actual;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test_recruitment.assert_true(label text, actual boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'assertion failed: %', label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test_recruitment.assert_denied(label text, statement text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'assertion failed: % should have been denied', label;
END;
$$;

DO $$
DECLARE
  applicant_user uuid := '10000000-0000-0000-0000-000000000001';
  other_applicant_user uuid := '10000000-0000-0000-0000-000000000002';
  leader_user uuid := '10000000-0000-0000-0000-000000000003';
  founder_user uuid := '10000000-0000-0000-0000-000000000004';
  member_user uuid := '10000000-0000-0000-0000-000000000005';
  former_user uuid := '10000000-0000-0000-0000-000000000006';
  unrelated_user uuid := '10000000-0000-0000-0000-000000000007';
  blocked_user uuid := '10000000-0000-0000-0000-000000000008';
  applicant_profile uuid := '20000000-0000-0000-0000-000000000001';
  other_applicant_profile uuid := '20000000-0000-0000-0000-000000000002';
  leader_profile uuid := '20000000-0000-0000-0000-000000000003';
  founder_profile uuid := '20000000-0000-0000-0000-000000000004';
  member_profile uuid := '20000000-0000-0000-0000-000000000005';
  former_profile uuid := '20000000-0000-0000-0000-000000000006';
  unrelated_profile uuid := '20000000-0000-0000-0000-000000000007';
  blocked_profile uuid := '20000000-0000-0000-0000-000000000008';
  v_band_id uuid := '30000000-0000-0000-0000-000000000001';
  v_other_band_id uuid := '30000000-0000-0000-0000-000000000002';
  v_closed_band_id uuid := '30000000-0000-0000-0000-000000000003';
  pending_app uuid := '40000000-0000-0000-0000-000000000001';
  accepted_app uuid := '40000000-0000-0000-0000-000000000002';
  rejected_app uuid := '40000000-0000-0000-0000-000000000003';
  withdrawn_app uuid := '40000000-0000-0000-0000-000000000004';
  other_app uuid := '40000000-0000-0000-0000-000000000005';
  created_app public.band_applications;
  approved_app public.band_applications;
  before_members bigint;
BEGIN
  PERFORM test_recruitment.as_service();

  INSERT INTO auth.users (id, email, role) VALUES
    (applicant_user, 'phase3-pr05-applicant@example.test', 'authenticated'),
    (other_applicant_user, 'phase3-pr05-other-applicant@example.test', 'authenticated'),
    (leader_user, 'phase3-pr05-leader@example.test', 'authenticated'),
    (founder_user, 'phase3-pr05-founder@example.test', 'authenticated'),
    (member_user, 'phase3-pr05-member@example.test', 'authenticated'),
    (former_user, 'phase3-pr05-former@example.test', 'authenticated'),
    (unrelated_user, 'phase3-pr05-unrelated@example.test', 'authenticated'),
    (blocked_user, 'phase3-pr05-blocked@example.test', 'authenticated');

  INSERT INTO public.profiles (id, user_id, username, display_name) VALUES
    (applicant_profile, applicant_user, 'phase3_pr05_applicant', 'Recruitment Applicant'),
    (other_applicant_profile, other_applicant_user, 'phase3_pr05_other_applicant', 'Other Applicant'),
    (leader_profile, leader_user, 'phase3_pr05_leader', 'Band Leader'),
    (founder_profile, founder_user, 'phase3_pr05_founder', 'Band Founder'),
    (member_profile, member_user, 'phase3_pr05_member', 'Ordinary Member'),
    (former_profile, former_user, 'phase3_pr05_former', 'Former Member'),
    (unrelated_profile, unrelated_user, 'phase3_pr05_unrelated', 'Unrelated Player'),
    (blocked_profile, blocked_user, 'phase3_pr05_blocked', 'Blocked Applicant');

  INSERT INTO public.bands (id, name, genre, leader_id, is_recruiting) VALUES
    (v_band_id, 'Phase 3 Recruiting Harness', 'Rock', leader_user, true),
    (v_other_band_id, 'Phase 3 Other Band', 'Pop', unrelated_user, true),
    (v_closed_band_id, 'Phase 3 Closed Band', 'Punk', leader_user, false);

  INSERT INTO public.band_members (band_id, user_id, profile_id, role, instrument_role, member_status) VALUES
    (v_band_id, leader_user, leader_profile, 'leader', 'Vocals', 'active'),
    (v_band_id, founder_user, founder_profile, 'Founder', 'Guitar', 'active'),
    (v_band_id, member_user, member_profile, 'member', 'Bass', 'active'),
    (v_band_id, former_user, former_profile, 'leader', 'Drums', 'inactive'),
    (v_other_band_id, unrelated_user, unrelated_profile, 'leader', 'Vocals', 'active');

  INSERT INTO public.band_applications (id, band_id, applicant_profile_id, instrument_role, message, status, created_at, responded_at) VALUES
    (pending_app, v_band_id, applicant_profile, 'Guitar', 'private pending message', 'pending', now() - interval '4 days', null),
    (accepted_app, v_band_id, applicant_profile, 'Bass', 'private accepted message', 'accepted', now() - interval '3 days', now() - interval '2 days'),
    (rejected_app, v_band_id, applicant_profile, 'Drums', 'private rejected message', 'rejected', now() - interval '2 days', now() - interval '1 day'),
    (withdrawn_app, v_band_id, applicant_profile, 'Vocals', 'private withdrawn message', 'withdrawn', now() - interval '1 day', now()),
    (other_app, v_band_id, other_applicant_profile, 'Keyboard', 'other applicant private message', 'pending', now(), null);

  INSERT INTO public.social_profile_blocks (blocker_profile_id, blocked_profile_id, reason)
  VALUES (blocked_profile, leader_profile, 'phase 3 harness block');

  PERFORM test_recruitment.as_user(applicant_user);
  PERFORM test_recruitment.assert_eq('applicant reads own four history rows only', (SELECT count(*) FROM public.band_applications WHERE band_id = v_band_id), 4);
  PERFORM test_recruitment.assert_eq('applicant cannot read other private application', (SELECT count(*) FROM public.band_applications WHERE id = other_app), 0);
  PERFORM test_recruitment.assert_true('applicant can read own message', EXISTS (SELECT 1 FROM public.band_applications WHERE id = pending_app AND message = 'private pending message'));

  PERFORM test_recruitment.as_user(leader_user);
  PERFORM test_recruitment.assert_eq('leader reads all band applications', (SELECT count(*) FROM public.band_applications WHERE band_id = v_band_id), 5);
  PERFORM test_recruitment.assert_true('leader can read application message', EXISTS (SELECT 1 FROM public.band_applications WHERE id = pending_app AND message = 'private pending message'));

  PERFORM test_recruitment.as_user(founder_user);
  PERFORM test_recruitment.assert_eq('founder reads all band applications', (SELECT count(*) FROM public.band_applications WHERE band_id = v_band_id), 5);

  PERFORM test_recruitment.as_user(member_user);
  PERFORM test_recruitment.assert_eq('ordinary member cannot read private history', (SELECT count(*) FROM public.band_applications WHERE band_id = v_band_id), 0);

  PERFORM test_recruitment.as_user(former_user);
  PERFORM test_recruitment.assert_eq('former leader cannot read private history', (SELECT count(*) FROM public.band_applications WHERE band_id = v_band_id), 0);

  PERFORM test_recruitment.as_user(unrelated_user);
  PERFORM test_recruitment.assert_eq('unrelated user cannot read target band private history', (SELECT count(*) FROM public.band_applications WHERE band_id = v_band_id), 0);
  PERFORM test_recruitment.assert_eq('manager cannot read applications for unmanaged band', (SELECT count(*) FROM public.band_applications WHERE band_id = v_other_band_id), 0);

  PERFORM test_recruitment.as_anon();
  PERFORM test_recruitment.assert_denied('anon cannot read private application history', format('SELECT count(*) FROM public.band_applications WHERE band_id = %L::uuid', v_band_id));
  PERFORM test_recruitment.assert_denied('anon submit rpc', format('SELECT public.submit_band_application(%L::uuid, %L, %L)', v_band_id, 'Guitar', 'hello'));

  PERFORM test_recruitment.as_user(applicant_user);
  PERFORM test_recruitment.assert_denied('direct insert denied', format('INSERT INTO public.band_applications (band_id, applicant_profile_id, instrument_role, message) VALUES (%L::uuid, %L::uuid, %L, %L)', v_band_id, applicant_profile, 'Guitar', 'direct'));
  UPDATE public.band_applications SET status = 'accepted' WHERE id = pending_app;
  PERFORM test_recruitment.assert_true('direct update denied', EXISTS (SELECT 1 FROM public.band_applications WHERE id = pending_app AND status = 'pending')); 
  SELECT public.submit_band_application(v_other_band_id, 'Guitar', 'fresh application') INTO created_app;
  PERFORM test_recruitment.assert_true('eligible authenticated submit succeeds', created_app.status = 'pending');
  PERFORM test_recruitment.assert_eq('duplicate pending submission idempotent', (SELECT count(*) FROM public.band_applications WHERE band_id = v_other_band_id AND applicant_profile_id = applicant_profile AND status = 'pending'), 1);
  SELECT public.submit_band_application(v_other_band_id, 'Guitar', 'fresh application retry') INTO created_app;
  PERFORM test_recruitment.assert_eq('duplicate retry still one pending application', (SELECT count(*) FROM public.band_applications WHERE band_id = v_other_band_id AND applicant_profile_id = applicant_profile AND status = 'pending'), 1);
  PERFORM test_recruitment.assert_denied('non recruiting band denied', format('SELECT public.submit_band_application(%L::uuid, %L, %L)', v_closed_band_id, 'Guitar', 'closed'));
  PERFORM test_recruitment.assert_denied('unsupported role denied', format('SELECT public.submit_band_application(%L::uuid, %L, %L)', v_band_id, 'Wizard', 'bad role'));
  PERFORM test_recruitment.assert_denied('overlong message denied', format('SELECT public.submit_band_application(%L::uuid, %L, repeat(%L, 501))', v_band_id, 'Guitar', 'x'));

  PERFORM test_recruitment.as_user(member_user);
  PERFORM test_recruitment.assert_denied('current target band member submit denied', format('SELECT public.submit_band_application(%L::uuid, %L, %L)', v_band_id, 'Bass', 'already member'));

  PERFORM test_recruitment.as_user(blocked_user);
  PERFORM test_recruitment.assert_denied('blocked applicant manager pair submit denied', format('SELECT public.submit_band_application(%L::uuid, %L, %L)', v_band_id, 'Bass', 'blocked'));

  PERFORM test_recruitment.as_user(member_user);
  PERFORM test_recruitment.assert_denied('ordinary member response denied', format('SELECT public.respond_band_application(%L::uuid, %L)', pending_app, 'approve'));
  PERFORM test_recruitment.as_user(former_user);
  PERFORM test_recruitment.assert_denied('former member response denied', format('SELECT public.respond_band_application(%L::uuid, %L)', pending_app, 'approve'));
  PERFORM test_recruitment.as_user(unrelated_user);
  PERFORM test_recruitment.assert_denied('unrelated response denied', format('SELECT public.respond_band_application(%L::uuid, %L)', pending_app, 'approve'));
  PERFORM test_recruitment.as_user(applicant_user);
  PERFORM test_recruitment.assert_denied('applicant self approval denied', format('SELECT public.respond_band_application(%L::uuid, %L)', pending_app, 'approve'));

  PERFORM test_recruitment.as_user(leader_user);
  SELECT count(*) INTO before_members FROM public.band_members WHERE band_id = v_band_id AND profile_id = applicant_profile AND member_status = 'active';
  SELECT public.respond_band_application(pending_app, 'approve') INTO approved_app;
  PERFORM test_recruitment.assert_true('leader approval succeeds', approved_app.status = 'accepted');
  SELECT public.respond_band_application(pending_app, 'approve') INTO approved_app;
  PERFORM test_recruitment.assert_eq('duplicate approval creates one membership', (SELECT count(*) FROM public.band_members WHERE band_id = v_band_id AND profile_id = applicant_profile AND member_status = 'active'), before_members + 1);
  PERFORM test_recruitment.assert_true('membership defaults to member role', EXISTS (SELECT 1 FROM public.band_members WHERE band_id = v_band_id AND profile_id = applicant_profile AND role = 'member'));
  PERFORM test_recruitment.assert_eq('rejection created no membership for other applicant yet', (SELECT count(*) FROM public.band_members WHERE band_id = v_band_id AND profile_id = other_applicant_profile AND member_status = 'active'), 0);

  PERFORM test_recruitment.as_user(founder_user);
  SELECT public.respond_band_application(other_app, 'reject') INTO approved_app;
  PERFORM test_recruitment.assert_true('founder rejection succeeds', approved_app.status = 'rejected');
  PERFORM test_recruitment.assert_eq('rejection creates no membership', (SELECT count(*) FROM public.band_members WHERE band_id = v_band_id AND profile_id = other_applicant_profile AND member_status = 'active'), 0);

  PERFORM test_recruitment.as_user(applicant_user);
  PERFORM test_recruitment.assert_denied('accepted application cannot be withdrawn', format('SELECT public.withdraw_band_application(%L::uuid)', accepted_app));
  PERFORM test_recruitment.assert_denied('rejected application cannot be withdrawn', format('SELECT public.withdraw_band_application(%L::uuid)', rejected_app));
  SELECT public.withdraw_band_application(withdrawn_app) INTO approved_app;
  PERFORM test_recruitment.assert_true('withdrawn retry safe', approved_app.status = 'withdrawn');

  PERFORM test_recruitment.assert_eq('approval notification created once', (SELECT count(*) FROM public.notifications WHERE metadata->>'band_application_id' = pending_app::text AND metadata->>'band_application_status' = 'accepted'), 1);
  PERFORM test_recruitment.assert_eq('rejection notification created once', (SELECT count(*) FROM public.notifications WHERE metadata->>'band_application_id' = other_app::text AND metadata->>'band_application_status' = 'rejected'), 1);
  PERFORM test_recruitment.assert_true('notification metadata excludes message contents', NOT EXISTS (SELECT 1 FROM public.notifications WHERE metadata::text LIKE '%private % message%'));
END $$;

ROLLBACK;
