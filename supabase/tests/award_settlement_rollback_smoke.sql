-- Read-only-in-effect, controlled live-schema settlement smoke test.
-- IMPORTANT: Uses real band IDs inside a PL/pgSQL EXCEPTION subtransaction.
-- The final forced error ROLLS BACK all synthetic show/votes, band changes,
-- financial ledger updates, achievement reconciliations and notifications.
-- Run as a trusted SQL operator, never as a browser client.
--
-- Successful execution produces no exception. Any unexpected runtime failure
-- aborts this statement and leaves all nested writes rolled back.
DO $awards_smoke$
DECLARE
  admin_id uuid;
  lead public.bands%ROWTYPE;
  other public.bands%ROWTYPE;
  owner_id uuid;
  show_id uuid;
  lead_nom uuid;
  other_nom uuid;
  balance_before integer;
  fame_before integer;
  preview jsonb;
  published jsonb;
  retried jsonb;
  num_wins integer;
  num_ledgers integer;
  num_notifications integer;
  show_status text;
  outcome text;
BEGIN
  BEGIN
    SELECT user_id INTO admin_id FROM public.user_roles
      WHERE role='admin' AND user_id IS NOT NULL ORDER BY user_id LIMIT 1;
    SELECT b.* INTO lead FROM public.bands b
      JOIN public.profiles p ON p.id=b.leader_id
      WHERE b.status='active' AND p.user_id IS NOT NULL
        AND b.band_balance BETWEEN 0 AND 10000000
        AND COALESCE(b.fame,0)<2000000000
      ORDER BY b.id LIMIT 1;
    SELECT b.* INTO other FROM public.bands b
      JOIN public.profiles p ON p.id=b.leader_id
      WHERE b.status='active' AND p.user_id IS NOT NULL AND b.id<>lead.id
      ORDER BY b.id LIMIT 1;
    IF admin_id IS NULL OR lead.id IS NULL OR other.id IS NULL THEN
      RAISE EXCEPTION 'No suitable admin/bands for rollback-only smoke test';
    END IF;
    SELECT user_id INTO owner_id FROM public.profiles WHERE id=lead.leader_id;
    balance_before:=lead.band_balance;
    fame_before:=lead.fame;

    PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);

    INSERT INTO public.award_shows(
      show_name,year,ceremony_date,status,categories,
      winner_fame_boost,winner_prize_money
    ) VALUES (
      'ROLLBACK TEST - award settlement',2026,now()-interval '1 day','live',
      '[{"name":"Test Best Band"},{"name":"Test Unawarded"}]'::jsonb,25,100
    ) RETURNING id INTO show_id;

    INSERT INTO public.award_nominations(
      award_show_id,category_name,nominee_type,nominee_id,nominee_name,
      band_id,user_id,status
    ) VALUES (
      show_id,'Test Best Band','band',lead.id::text,lead.name,
      lead.id,owner_id,'shortlisted'
    ) RETURNING id INTO lead_nom;

    INSERT INTO public.award_nominations(
      award_show_id,category_name,nominee_type,nominee_id,nominee_name,
      band_id,user_id,status
    ) VALUES (
      show_id,'Test Best Band','band',other.id::text,other.name,
      other.id,(SELECT user_id FROM public.profiles WHERE id=other.leader_id),
      'shortlisted'
    ) RETURNING id INTO other_nom;

    INSERT INTO public.award_votes(nomination_id,voter_type,voter_id,weight)
    VALUES
      (lead_nom,'player',gen_random_uuid(),1),
      (lead_nom,'player',gen_random_uuid(),1),
      (other_nom,'player',gen_random_uuid(),1);

    preview:=public.award_admin_preview_results(show_id);
    IF NOT COALESCE((preview->>'ready')::boolean,false)
       OR (preview->>'awards_to_issue')::integer<>1
       OR jsonb_array_length(preview->'unawarded_categories')<>1 THEN
      RAISE EXCEPTION 'Preview readiness or zero-ballot logic failed: %',preview;
    END IF;

    published:=public.award_admin_finalize_show(show_id);
    retried:=public.award_admin_finalize_show(show_id);
    SELECT status INTO show_status FROM public.award_shows WHERE id=show_id;
    SELECT count(*) INTO num_wins FROM public.award_wins WHERE award_show_id=show_id;
    SELECT count(*) INTO num_ledgers FROM public.band_earnings
      WHERE source='award_show_prize'
        AND metadata->>'award_show_id'=show_id::text;
    SELECT count(*) INTO num_notifications FROM public.notifications
      WHERE category='awards' AND metadata->>'award_show_id'=show_id::text;

    IF (published->>'awards_issued')::integer<>1
       OR (retried->>'already_completed')::boolean IS NOT TRUE
       OR num_wins<>1 OR num_ledgers<>1 OR num_notifications<1
       OR show_status<>'completed'
       OR (SELECT band_balance FROM public.bands WHERE id=lead.id)<>balance_before+100
       OR (SELECT fame FROM public.bands WHERE id=lead.id)<>COALESCE(fame_before,0)+25
       OR (SELECT count(*) FROM public.award_nominations WHERE award_show_id=show_id AND status='winner')<>1
       OR (SELECT count(*) FROM public.award_nominations WHERE award_show_id=show_id AND status='runner_up')<>1 THEN
      RAISE EXCEPTION 'Award settlement, finance or notification invariant failed';
    END IF;
    outcome:=format('PASS: winner %s, ledger %s, notifications %s; rollback all synthetic changes',num_wins,num_ledgers,num_notifications);

    -- Deliberately undo every write including award prizes and notifications.
    RAISE EXCEPTION 'rollback rollback-only awards smoke test'
      USING ERRCODE='PZX01';
  EXCEPTION WHEN SQLSTATE 'PZX01' THEN
    RAISE NOTICE '%',outcome;
  END;
END $awards_smoke$;
