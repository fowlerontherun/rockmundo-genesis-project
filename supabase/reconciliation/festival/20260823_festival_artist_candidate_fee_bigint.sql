-- Production reconciliation: high-fame artists must not overflow integer arithmetic
-- while the Festival owner searches for acts to invite.

DO $$
DECLARE
  definition text;
  patched text;
BEGIN
  SELECT pg_get_functiondef(
    'public.search_festival_edition_artist_candidates(uuid,uuid,text,integer,integer)'::regprocedure
  ) INTO definition;

  patched := definition;
  patched := replace(patched, 'coalesce(profile.fame, 0) * 100', 'coalesce(profile.fame, 0)::bigint * 100');
  patched := replace(patched, 'coalesce(profile.fame, 0) * 250', 'coalesce(profile.fame, 0)::bigint * 250');
  patched := replace(patched, 'coalesce(band.popularity, 0) * 200', 'coalesce(band.popularity, 0)::bigint * 200');
  patched := replace(patched, 'coalesce(band.popularity, 0) * 500', 'coalesce(band.popularity, 0)::bigint * 500');
  patched := replace(patched, 'coalesce(profile.fame,0)*100', 'coalesce(profile.fame,0)::bigint*100');
  patched := replace(patched, 'coalesce(profile.fame,0)*250', 'coalesce(profile.fame,0)::bigint*250');
  patched := replace(patched, 'coalesce(band.popularity,0)*200', 'coalesce(band.popularity,0)::bigint*200');
  patched := replace(patched, 'coalesce(band.popularity,0)*500', 'coalesce(band.popularity,0)::bigint*500');

  IF patched = definition
     AND position('profile.fame, 0)::bigint * 100' IN definition) = 0
     AND position('profile.fame,0)::bigint*100' IN definition) = 0 THEN
    RAISE EXCEPTION 'festival_candidate_fee_expression_not_found';
  END IF;

  IF patched <> definition THEN
    EXECUTE patched;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
